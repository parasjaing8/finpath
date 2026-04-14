"""Unit tests for db.py — T12.4

Tests:
  - Migration logic (fresh DB, already-migrated DB, idempotency)
  - update_task() ALLOWED_TASK_COLS whitelist (SQL injection guard)
  - Basic CRUD round-trips: projects, tasks, messages
  - reset_stuck_tasks() and get_resumable_tasks()
  - slugify() edge cases
  - Concurrent _db_connect() calls
"""
from __future__ import annotations

import importlib.util
import json
import sqlite3
import sys
import threading
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# conftest.py puts a lightweight stub under sys.modules["db"] and
# sys.modules["files_io"] for orchestration tests.  We need the REAL modules
# here, so load them under private names and point each other's references
# at the real implementations.

# 1. Load real files_io under a private key
_fi_spec = importlib.util.spec_from_file_location(
    "_files_io_real",
    str(Path(__file__).parent.parent / "files_io.py"),
)
_files_io = importlib.util.module_from_spec(_fi_spec)
_fi_spec.loader.exec_module(_files_io)  # type: ignore[union-attr]

# 2. Load real db under a private key; during exec it will try to import
#    files_io — temporarily shadow sys.modules so it gets our real version.
_db_spec = importlib.util.spec_from_file_location(
    "_db_real",
    str(Path(__file__).parent.parent / "db.py"),
)
db = importlib.util.module_from_spec(_db_spec)
sys.modules["_files_io_real"] = _files_io
# Temporarily replace the stub with the real files_io so db.py's `from
# files_io import …` resolves correctly.
_orig_files_io = sys.modules.get("files_io")
sys.modules["files_io"] = _files_io
_db_spec.loader.exec_module(db)  # type: ignore[union-attr]
# Restore whatever was there before (the stub, or nothing)
if _orig_files_io is None:
    sys.modules.pop("files_io", None)
else:
    sys.modules["files_io"] = _orig_files_io


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def isolated_db(tmp_path):
    """Give every test its own in-memory-equivalent DB and projects dir."""
    db_path = tmp_path / "test.db"
    projects_dir = tmp_path / "projects"
    projects_dir.mkdir()
    db.configure(db_path=db_path, projects_dir=projects_dir, display_len=20)
    db.init_db()
    yield


# ── slugify ───────────────────────────────────────────────────────────────────

class TestSlugify:
    def test_lowercase(self):
        assert db.slugify("Hello World") == "hello-world"

    def test_special_chars(self):
        assert db.slugify("My App! (2.0)") == "my-app-2-0"

    def test_leading_trailing_dashes_stripped(self):
        slug = db.slugify("---test---")
        assert not slug.startswith("-")
        assert not slug.endswith("-")

    def test_empty_string_returns_project(self):
        assert db.slugify("") == "project"

    def test_multiple_spaces_become_single_dash(self):
        assert db.slugify("a   b") == "a-b"


# ── Migration ─────────────────────────────────────────────────────────────────

class TestMigrations:
    def test_fresh_db_latest_version(self):
        """After init_db(), schema_version should be at the latest migration."""
        expected = max(v for v, _, _ in db._MIGRATIONS)
        with db._db_connect() as c:
            row = c.execute("SELECT version FROM schema_version").fetchone()
        assert row is not None
        assert row[0] == expected

    def test_depends_on_column_exists(self):
        """Migration 1 adds depends_on to tasks."""
        with db._db_connect() as c:
            cols = [r[1] for r in c.execute("PRAGMA table_info(tasks)").fetchall()]
        assert "depends_on" in cols

    def test_retry_columns_exist(self):
        """Migration 4 adds retry_count, escalated_to, evaluation_json, blocked_by."""
        with db._db_connect() as c:
            cols = [r[1] for r in c.execute("PRAGMA table_info(tasks)").fetchall()]
        for col in ("retry_count", "escalated_to", "evaluation_json", "blocked_by"):
            assert col in cols, f"Column {col} missing from tasks"

    def test_already_migrated_db_is_idempotent(self, tmp_path):
        """Calling init_db() twice on the same DB should not raise."""
        db.init_db()  # second call on the already-migrated test DB
        with db._db_connect() as c:
            row = c.execute("SELECT version FROM schema_version").fetchone()
        assert row[0] == max(v for v, _, _ in db._MIGRATIONS)

    def test_run_migrations_no_op_when_current(self):
        """_run_migrations with current version should change nothing."""
        current = max(v for v, _, _ in db._MIGRATIONS)
        db._run_migrations(current)  # should not raise or change anything
        with db._db_connect() as c:
            row = c.execute("SELECT version FROM schema_version").fetchone()
        assert row[0] == current


# ── update_task() ALLOWED_TASK_COLS whitelist ─────────────────────────────────

class TestUpdateTaskWhitelist:
    def _create_task(self) -> int:
        proj = db.create_project("whitelist-test", "desc")
        tasks = db.save_tasks(proj["id"], [{
            "task_number": 1, "title": "t", "description": "d",
            "assigned_to": "deepseek", "files_to_create": [],
        }])
        return tasks[0]["id"]

    def test_valid_column_accepted(self):
        tid = self._create_task()
        db.update_task(tid, status="done")
        task = next(t for t in db.get_all_tasks(
            db.list_projects()[0]["id"]) if t["id"] == tid)
        assert task["status"] == "done"

    def test_invalid_column_raises(self):
        tid = self._create_task()
        with pytest.raises(ValueError, match="disallowed"):
            db.update_task(tid, title="injected")

    def test_sql_injection_attempt_raises(self):
        """Column names with SQL syntax are rejected."""
        tid = self._create_task()
        with pytest.raises(ValueError):
            db.update_task(tid, **{"status; DROP TABLE tasks;--": "x"})

    def test_empty_kwargs_is_noop(self):
        """update_task() with no fields should not raise or modify anything."""
        tid = self._create_task()
        db.update_task(tid)  # no-op

    def test_multiple_valid_columns(self):
        tid = self._create_task()
        db.update_task(tid, status="done", retry_count=2, cost_usd=0.05)
        tasks = db.get_all_tasks(db.list_projects()[0]["id"])
        task = next(t for t in tasks if t["id"] == tid)
        assert task["status"] == "done"

    def test_all_allowed_cols_accepted(self):
        """Every column in ALLOWED_TASK_COLS must be accepted without raising."""
        tid = self._create_task()
        for col in db.ALLOWED_TASK_COLS:
            # Use dummy values of appropriate types
            val = 0 if col in ("retry_count", "blocked_by", "cost_usd") else "x"
            db.update_task(tid, **{col: val})  # should not raise


# ── Project CRUD ──────────────────────────────────────────────────────────────

class TestProjectCRUD:
    def test_create_and_get_project(self):
        proj = db.create_project("My App", "a cool app")
        fetched = db.get_project(proj["id"])
        assert fetched is not None
        assert fetched["name"] == "My App"
        assert fetched["slug"] == "my-app"
        assert fetched["status"] == "active"

    def test_duplicate_name_gets_different_slug(self):
        p1 = db.create_project("calc", "first")
        p2 = db.create_project("calc", "second")
        assert p1["slug"] != p2["slug"]

    def test_get_nonexistent_project(self):
        assert db.get_project(99999) is None

    def test_list_projects(self):
        db.create_project("App A", "")
        db.create_project("App B", "")
        projects = db.list_projects()
        assert len(projects) >= 2
        names = [p["name"] for p in projects]
        assert "App A" in names
        assert "App B" in names

    def test_update_project_status(self):
        proj = db.create_project("status-test", "")
        db.update_project_status(proj["id"], "completed")
        fetched = db.get_project(proj["id"])
        assert fetched["status"] == "completed"

    def test_create_project_creates_src_dir(self, tmp_path):
        proj = db.create_project("dir-test", "")
        src = Path(proj["folder_path"]) / "src"
        assert src.is_dir()


# ── Messages ──────────────────────────────────────────────────────────────────

class TestMessages:
    def test_save_and_load_global_history(self):
        db.save_message("user", "hello")
        db.save_message("claude", "hi there")
        history = db.load_history()
        assert len(history) == 2
        assert history[0]["role"] == "user"
        assert history[1]["role"] == "claude"

    def test_load_history_respects_limit(self):
        for i in range(10):
            db.save_message("user", f"msg {i}")
        history = db.load_history(limit=5)
        assert len(history) == 5

    def test_save_and_load_project_messages(self):
        proj = db.create_project("msg-test", "")
        db.save_project_message(proj["id"], "user", "hello")
        db.save_project_message(proj["id"], "deepseek", "response")
        msgs = db.load_project_messages(proj["id"])
        assert len(msgs) == 2
        assert msgs[0]["role"] == "user"

    def test_project_messages_isolated_per_project(self):
        p1 = db.create_project("proj-msg-1", "")
        p2 = db.create_project("proj-msg-2", "")
        db.save_project_message(p1["id"], "user", "for p1")
        db.save_project_message(p2["id"], "user", "for p2")
        assert len(db.load_project_messages(p1["id"])) == 1
        assert len(db.load_project_messages(p2["id"])) == 1

    def test_get_last_project_goal(self):
        proj = db.create_project("goal-test", "")
        db.save_project_message(proj["id"], "user", "build a tetris game")
        db.save_project_message(proj["id"], "claude", "planning...")
        db.save_project_message(proj["id"], "user", "make it faster")
        goal = db.get_last_project_goal(proj["id"])
        assert goal == "build a tetris game"  # first user message

    def test_get_last_project_goal_no_messages(self):
        proj = db.create_project("empty-goal", "")
        assert db.get_last_project_goal(proj["id"]) == ""


# ── Task management ───────────────────────────────────────────────────────────

class TestTasks:
    def _setup_project_with_tasks(self, n: int = 3):
        proj = db.create_project("task-test", "")
        tasks_data = [
            {"task_number": i + 1, "title": f"Task {i+1}",
             "description": f"desc {i+1}", "assigned_to": "deepseek",
             "files_to_create": [f"src/file{i+1}.js"]}
            for i in range(n)
        ]
        tasks = db.save_tasks(proj["id"], tasks_data)
        return proj, tasks

    def test_save_and_get_tasks(self):
        proj, tasks = self._setup_project_with_tasks(3)
        fetched = db.get_all_tasks(proj["id"])
        assert len(fetched) == 3
        assert fetched[0]["title"] == "Task 1"

    def test_tasks_have_pending_status(self):
        proj, tasks = self._setup_project_with_tasks(2)
        for t in db.get_all_tasks(proj["id"]):
            assert t["status"] == "pending"

    def test_files_to_create_round_trips(self):
        proj = db.create_project("ftc-test", "")
        tasks = db.save_tasks(proj["id"], [{
            "task_number": 1, "title": "t", "description": "d",
            "assigned_to": "deepseek",
            "files_to_create": ["src/index.html", "src/style.css"],
        }])
        fetched = db.get_all_tasks(proj["id"])
        assert fetched[0]["files_to_create"] == ["src/index.html", "src/style.css"]

    def test_depends_on_round_trips(self):
        proj = db.create_project("dep-test", "")
        tasks = db.save_tasks(proj["id"], [{
            "task_number": 1, "title": "base", "description": "d",
            "assigned_to": "deepseek", "files_to_create": [], "depends_on": [],
        }, {
            "task_number": 2, "title": "follow", "description": "d",
            "assigned_to": "deepseek", "files_to_create": [], "depends_on": [1],
        }])
        fetched = db.get_all_tasks(proj["id"])
        assert fetched[1]["depends_on"] == [1]

    def test_reset_stuck_tasks(self):
        proj, tasks = self._setup_project_with_tasks(2)
        # Manually mark one as in_progress
        db.update_task(tasks[0]["id"], status="in_progress")
        count = db.reset_stuck_tasks(proj["id"])
        assert count == 1
        fetched = db.get_all_tasks(proj["id"])
        assert fetched[0]["status"] == "pending"

    def test_get_resumable_tasks_excludes_done(self):
        proj, tasks = self._setup_project_with_tasks(3)
        db.update_task(tasks[0]["id"], status="done")
        resumable = db.get_resumable_tasks(proj["id"])
        assert len(resumable) == 2
        assert all(t["status"] != "done" for t in resumable)

    def test_get_resumable_resets_in_progress(self):
        proj, tasks = self._setup_project_with_tasks(2)
        db.update_task(tasks[0]["id"], status="in_progress")
        resumable = db.get_resumable_tasks(proj["id"])
        # Should be reset to pending and included
        assert any(t["id"] == tasks[0]["id"] for t in resumable)
        assert all(t["status"] == "pending" for t in resumable)


# ── Concurrent _db_connect() calls ───────────────────────────────────────────

class TestConcurrentAccess:
    def test_concurrent_writes_do_not_raise(self):
        """Multiple threads writing messages concurrently shouldn't cause errors."""
        proj = db.create_project("concurrent-test", "")
        errors: list[Exception] = []

        def write_messages(i: int):
            try:
                for j in range(5):
                    db.save_project_message(proj["id"], "user", f"thread {i} msg {j}")
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=write_messages, args=(i,)) for i in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert errors == [], f"Concurrent write errors: {errors}"
        msgs = db.load_project_messages(proj["id"], limit=100)
        assert len(msgs) == 25  # 5 threads × 5 messages

    def test_concurrent_reads_do_not_raise(self):
        """Multiple threads reading simultaneously shouldn't cause errors."""
        db.save_message("user", "hello")
        errors: list[Exception] = []

        def read():
            try:
                db.load_history()
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=read) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert errors == []
