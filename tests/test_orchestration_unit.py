"""Unit tests for orchestration.py — T12.2

Tests focus on pure/low-dependency functions:
  - find_relevant_lessons()
  - _group_into_waves()  (+ _strip_cyclic_deps)
  - claude_evaluate_task() — mocking the LLM call
  - detect_intent() / detect_intent_in_project() — mocking the LLM call
"""
from __future__ import annotations
import json
import textwrap
from pathlib import Path
from typing import Optional
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

# conftest.py pre-stubs db/models/skills_mod before orchestration is imported
import orchestration as o


# ── Helpers ───────────────────────────────────────────────────────────────────

def _task(num: int, deps: Optional[list] = None, title: str = "") -> dict:
    return {
        "task_number": num,
        "title": title or f"Task {num}",
        "description": "",
        "files_to_create": [],
        "assigned_to": "deepseek",
        "depends_on": deps or [],
    }


# ── find_relevant_lessons ─────────────────────────────────────────────────────

class TestFindRelevantLessons:
    def test_returns_empty_when_no_file(self, tmp_path, monkeypatch):
        monkeypatch.setattr(o, "_universal_lessons_path",
                            lambda: tmp_path / "nonexistent.md")
        result = o.find_relevant_lessons("build a tetris game")
        assert result == []

    def test_returns_matching_lessons(self, tmp_path, monkeypatch):
        lessons_file = tmp_path / "universal_lessons.md"
        lessons_file.write_text(
            "- Always use requestAnimationFrame for game loops\n"
            "- Center divs with flexbox on the body element\n"
            "- Tetris pieces need rotation matrix logic\n",
            encoding="utf-8",
        )
        monkeypatch.setattr(o, "_universal_lessons_path", lambda: lessons_file)
        result = o.find_relevant_lessons("build a tetris game with rotation")
        # "tetris" and "rotation" should match the third lesson
        assert any("tetris" in r.lower() or "rotation" in r.lower() for r in result)

    def test_ranks_by_keyword_overlap(self, tmp_path, monkeypatch):
        lessons_file = tmp_path / "universal_lessons.md"
        lessons_file.write_text(
            "- Snake game needs grid board rendering\n"
            "- Tetris game needs board grid rotation piece\n",
            encoding="utf-8",
        )
        monkeypatch.setattr(o, "_universal_lessons_path", lambda: lessons_file)
        result = o.find_relevant_lessons("tetris game needs board grid piece")
        # Second lesson has more keyword overlap
        assert "tetris" in result[0].lower()

    def test_respects_max_lessons(self, tmp_path, monkeypatch):
        lessons_file = tmp_path / "universal_lessons.md"
        lines = "\n".join(f"- game lesson number {i}" for i in range(20))
        lessons_file.write_text(lines, encoding="utf-8")
        monkeypatch.setattr(o, "_universal_lessons_path", lambda: lessons_file)
        result = o.find_relevant_lessons("game lesson", max_lessons=3)
        assert len(result) <= 3

    def test_empty_description_returns_empty(self, tmp_path, monkeypatch):
        lessons_file = tmp_path / "universal_lessons.md"
        lessons_file.write_text("- Some lesson about stuff\n", encoding="utf-8")
        monkeypatch.setattr(o, "_universal_lessons_path", lambda: lessons_file)
        assert o.find_relevant_lessons("") == []

    def test_ignores_short_words(self, tmp_path, monkeypatch):
        """Words < 4 chars should not match."""
        lessons_file = tmp_path / "universal_lessons.md"
        lessons_file.write_text("- Add CSS for the div\n", encoding="utf-8")
        monkeypatch.setattr(o, "_universal_lessons_path", lambda: lessons_file)
        # Only short words → no overlap → empty
        result = o.find_relevant_lessons("add css for the div")
        assert result == []


# ── _group_into_waves + _strip_cyclic_deps ────────────────────────────────────

class TestGroupIntoWaves:
    def test_single_task_no_deps(self):
        tasks = [_task(1)]
        waves = o._group_into_waves(tasks)
        assert len(waves) == 1
        assert waves[0][0]["task_number"] == 1

    def test_linear_chain(self):
        """1 → 2 → 3 must produce 3 sequential waves."""
        tasks = [_task(1), _task(2, deps=[1]), _task(3, deps=[2])]
        waves = o._group_into_waves(tasks)
        assert len(waves) == 3
        assert waves[0][0]["task_number"] == 1
        assert waves[1][0]["task_number"] == 2
        assert waves[2][0]["task_number"] == 3

    def test_diamond_dependency(self):
        """Diamond: 1 → 2, 1 → 3, (2,3) → 4.
        Wave 1: [1], Wave 2: [2,3], Wave 3: [4]
        """
        tasks = [
            _task(1),
            _task(2, deps=[1]),
            _task(3, deps=[1]),
            _task(4, deps=[2, 3]),
        ]
        waves = o._group_into_waves(tasks)
        assert len(waves) == 3
        assert {t["task_number"] for t in waves[0]} == {1}
        assert {t["task_number"] for t in waves[1]} == {2, 3}
        assert {t["task_number"] for t in waves[2]} == {4}

    def test_independent_tasks_same_wave(self):
        """Tasks with no deps all go into wave 1."""
        tasks = [_task(1), _task(2), _task(3)]
        waves = o._group_into_waves(tasks)
        assert len(waves) == 1
        assert {t["task_number"] for t in waves[0]} == {1, 2, 3}

    def test_cycle_stripped_and_executed(self):
        """A → B → A cycle: both deps stripped, tasks still execute."""
        tasks = [_task(1, deps=[2]), _task(2, deps=[1])]
        waves = o._group_into_waves(tasks)
        # After stripping, both should land in a single wave
        all_nums = {t["task_number"] for wave in waves for t in wave}
        assert all_nums == {1, 2}

    def test_self_referencing_task(self):
        """A task that depends on itself (task_number = dep)."""
        tasks = [_task(1, deps=[1]), _task(2)]
        waves = o._group_into_waves(tasks)
        all_nums = {t["task_number"] for wave in waves for t in wave}
        assert all_nums == {1, 2}

    def test_depends_on_nonexistent_id_ignored(self):
        """Dep on unknown task id should be silently ignored (not in valid_ids)."""
        tasks = [_task(1, deps=[99])]
        # 99 is not in the tasks list — should not block task 1 forever
        waves = o._group_into_waves(tasks)
        all_nums = {t["task_number"] for wave in waves for t in wave}
        assert 1 in all_nums

    def test_empty_task_list(self):
        assert o._group_into_waves([]) == []

    def test_mixed_deps_and_free(self):
        """Some tasks have deps, some don't; free tasks run in first wave."""
        tasks = [_task(1), _task(2), _task(3, deps=[1])]
        waves = o._group_into_waves(tasks)
        assert {t["task_number"] for t in waves[0]} == {1, 2}
        assert {t["task_number"] for t in waves[1]} == {3}


# ── claude_evaluate_task ──────────────────────────────────────────────────────

@pytest.mark.asyncio
class TestClaudeEvaluateTask:
    """Mock master_json_call to test evaluator logic without hitting Claude API."""

    def _project(self):
        return {"id": 1, "name": "test", "folder_path": "/tmp/test_proj", "slug": "test"}

    def _task_obj(self, files=None):
        return {
            "id": 1, "task_number": 1,
            "title": "Create index.html",
            "description": "Make a simple counter page",
            "files_to_create": files or ["index.html"],
            "assigned_to": "deepseek",
        }

    def _output_with_file(self, filename="index.html", content=None):
        body = content or "<html><head><meta charset=\"UTF-8\"></head><body><div id=\"count\">0</div></body></html>"
        return f"// FILE: {filename}\n```html\n{body}\n```\n"

    async def test_no_file_markers_returns_rejected(self):
        task = self._task_obj()
        result = await o.claude_evaluate_task(self._project(), task, "Just some text, no files.")
        assert result["approved"] is False
        assert result["checks"].get("files_present") is False

    async def test_missing_expected_file_rejected(self):
        task = self._task_obj(files=["index.html", "style.css"])
        output = self._output_with_file("index.html")
        result = await o.claude_evaluate_task(self._project(), task, output)
        assert result["approved"] is False
        assert "style.css" in result["feedback"]

    async def test_html_missing_html_tag_rejected(self):
        task = self._task_obj(files=["index.html"])
        output = "// FILE: index.html\n```html\n<div>no html tag</div>\n```\n"
        result = await o.claude_evaluate_task(self._project(), task, output)
        assert result["approved"] is False
        assert result["checks"].get("html_valid") is False

    async def test_timeout_sentinel_in_output_rejected(self):
        task = self._task_obj()
        output = "*[Claude error: timeout]*"
        result = await o.claude_evaluate_task(self._project(), task, output)
        assert result["approved"] is False
        assert "timed out" in result["feedback"].lower()

    async def test_valid_output_llm_approves(self):
        task = self._task_obj()
        output = self._output_with_file()
        with patch.object(o, "master_json_call", new=AsyncMock(
            return_value='{"approved": true, "feedback": ""}'
        )):
            result = await o.claude_evaluate_task(self._project(), task, output)
        assert result["approved"] is True

    async def test_valid_output_llm_rejects(self):
        task = self._task_obj()
        output = self._output_with_file()
        with patch.object(o, "master_json_call", new=AsyncMock(
            return_value='{"approved": false, "feedback": "Missing counter logic"}'
        )):
            result = await o.claude_evaluate_task(self._project(), task, output)
        assert result["approved"] is False
        assert "counter" in result["feedback"].lower()

    async def test_llm_returns_empty_rejected(self):
        task = self._task_obj()
        output = self._output_with_file()
        with patch.object(o, "master_json_call", new=AsyncMock(return_value="")):
            result = await o.claude_evaluate_task(self._project(), task, output)
        assert result["approved"] is False

    async def test_llm_returns_invalid_json_lenient_parse_positive(self):
        task = self._task_obj()
        output = self._output_with_file()
        with patch.object(o, "master_json_call", new=AsyncMock(
            return_value="Looks good, approved LGTM"
        )):
            result = await o.claude_evaluate_task(self._project(), task, output)
        assert result["approved"] is True

    async def test_llm_returns_invalid_json_lenient_parse_negative(self):
        task = self._task_obj()
        output = self._output_with_file()
        # "missing" hits lenient negative branch; avoid "correct"/"approved" which hit positive
        with patch.object(o, "master_json_call", new=AsyncMock(
            return_value="missing implementation details — code is broken"
        )):
            result = await o.claude_evaluate_task(self._project(), task, output)
        assert result["approved"] is False

    async def test_llm_timeout_sentinel_in_response_rejected(self):
        task = self._task_obj()
        output = self._output_with_file()
        with patch.object(o, "master_json_call", new=AsyncMock(
            return_value="*[Claude error: timeout]*"
        )):
            result = await o.claude_evaluate_task(self._project(), task, output)
        assert result["approved"] is False
        assert "timed out" in result["feedback"].lower()

    async def test_game_without_loop_rejected(self):
        task = {
            "id": 1, "task_number": 1,
            "title": "Create snake game",
            "description": "Build snake game with canvas",
            "files_to_create": ["game.js"],
            "assigned_to": "deepseek",
        }
        # content with FILE: marker but no requestAnimationFrame or setInterval
        output = textwrap.dedent("""\
            // FILE: game.js
            ```javascript
            const canvas = document.getElementById('canvas');
            function draw() { canvas.getContext('2d').clearRect(0,0,400,400); }
            // no game loop here deliberately
            ```
        """)
        result = await o.claude_evaluate_task(self._project(), task, output)
        assert result["approved"] is False
        assert result["checks"].get("game_loop") is False

    async def test_structured_result_has_checks_field(self):
        task = self._task_obj()
        output = self._output_with_file()
        with patch.object(o, "master_json_call", new=AsyncMock(
            return_value='{"approved": true, "feedback": ""}'
        )):
            result = await o.claude_evaluate_task(self._project(), task, output)
        assert "checks" in result
        assert isinstance(result["checks"], dict)


# ── detect_intent ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
class TestDetectIntent:
    async def test_project_new_intent(self):
        with patch.object(o, "master_json_call", new=AsyncMock(
            return_value='{"type": "project_new", "name": "Snake Game"}'
        )):
            result = await o.detect_intent("build me a snake game")
        assert result["type"] == "project_new"
        assert result["name"] == "Snake Game"

    async def test_chat_intent(self):
        with patch.object(o, "master_json_call", new=AsyncMock(
            return_value='{"type": "chat"}'
        )):
            result = await o.detect_intent("what is the weather like?")
        assert result["type"] == "chat"

    async def test_returns_chat_on_empty_response(self):
        with patch.object(o, "master_json_call", new=AsyncMock(return_value="")):
            result = await o.detect_intent("something")
        assert result["type"] == "chat"

    async def test_returns_chat_on_invalid_json(self):
        with patch.object(o, "master_json_call", new=AsyncMock(
            return_value="I cannot classify this"
        )):
            result = await o.detect_intent("something")
        assert result["type"] == "chat"

    async def test_strips_markdown_fences_from_response(self):
        with patch.object(o, "master_json_call", new=AsyncMock(
            return_value='```json\n{"type": "project_new", "name": "Calc"}\n```'
        )):
            result = await o.detect_intent("make a calculator")
        assert result["type"] == "project_new"


# ── detect_intent_in_project ──────────────────────────────────────────────────

@pytest.mark.asyncio
class TestDetectIntentInProject:
    async def test_done_intent(self):
        with patch.object(o, "master_json_call", new=AsyncMock(return_value="done")):
            result = await o.detect_intent_in_project("looks great thanks!", "my-game")
        assert result == "done"

    async def test_build_intent(self):
        with patch.object(o, "master_json_call", new=AsyncMock(return_value="build")):
            result = await o.detect_intent_in_project("fix the rotation bug", "tetris")
        assert result == "build"

    async def test_query_intent(self):
        with patch.object(o, "master_json_call", new=AsyncMock(return_value="query")):
            result = await o.detect_intent_in_project("what files were created?", "game")
        assert result == "query"

    async def test_falls_back_to_chat(self):
        with patch.object(o, "master_json_call", new=AsyncMock(return_value="chat")):
            result = await o.detect_intent_in_project("how does async work?", "game")
        assert result == "chat"

    async def test_done_keyword_in_noisy_response(self):
        """Even if response has extra text, 'done' keyword should match."""
        with patch.object(o, "master_json_call", new=AsyncMock(
            return_value="The intent is: done"
        )):
            result = await o.detect_intent_in_project("ship it", "game")
        assert result == "done"
