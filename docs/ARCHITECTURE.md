# Architecture — ai-chat Platform

> Last updated: 2026-04-14

---

## Overview

ai-chat is a multi-agent AI platform that turns plain-English requests into running web apps. The user describes a project; Claude plans it as a task DAG; each task is executed by a coding agent (DeepSeek or Qwen); the resulting code is written to disk, committed to Git, and instantly served via the play URL.

```
Browser (192.168.0.67)
        │
        │  HTTP / WebSocket
        ▼
┌────────────────────────────────────────────────────────┐
│           FastAPI Server  :8080  (server.py)           │
│                                                        │
│  Static files  /static/*    ←  static/                 │
│  Chat UI  /                 ←  static/index.html       │
│  Play URL /play/<slug>/     ←  projects/<slug>/src/    │
│  REST API /projects /settings /skills …                │
│  WebSocket /ws              ←  main chat channel       │
│                                                        │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────┐  │
│  │ orchestration│  │    models.py  │  │   db.py    │  │
│  │    .py       │  │               │  │            │  │
│  │ intent detect│  │ Claude (API)  │  │ SQLite WAL │  │
│  │ task planning│  │ Ollama (local)│  │ messages   │  │
│  │ DAG execution│  │ streaming     │  │ projects   │  │
│  │ evaluation   │  │ token tracking│  │ tasks      │  │
│  └──────┬───────┘  └───────────────┘  └────────────┘  │
│         │                                              │
│  ┌──────▼───────┐  ┌───────────────┐                  │
│  │  files_io.py │  │ skills_mod.py │                  │
│  │              │  │               │                  │
│  │ LLM → files  │  │ keyword match │                  │
│  │ Git ops      │  │ inject into   │                  │
│  │ devlog       │  │ agent prompts │                  │
│  └──────────────┘  └───────────────┘                  │
└────────────────────────────────────────────────────────┘
        │
        │  localhost:11434
        ▼
┌────────────────┐       ┌──────────────────────────┐
│  Ollama        │       │  Anthropic API (cloud)   │
│  DeepSeek 16B  │       │  claude-sonnet-4-6        │
│  Qwen 9B       │       └──────────────────────────┘
└────────────────┘
```

---

## Module Dependency Graph

```
server.py
  ├── config.py          (configuration constants)
  ├── db.py              (SQLite persistence)
  │     └── files_io.py  (init_devlog, git_init called on project create)
  ├── models.py          (LLM calls, streaming)
  ├── orchestration.py   (planning, evaluation)
  │     ├── db.py
  │     ├── files_io.py
  │     ├── models.py
  │     └── skills_mod.py
  └── skills_mod.py      (skill loading)
```

**Module wiring:** Each sub-module exposes a `configure()` function. `server.py` calls all `configure()` calls at import time, injecting shared paths, constants, and callbacks. This avoids circular imports.

---

## Data Flow: New Project Build

```
User types "build a snake game"
    │
    ▼
WebSocket /ws  →  detect_intent()  →  {"type": "project_new"}
    │
    ▼
UI shows project creator dialog  →  user confirms name + description
    │
    ▼
POST /projects    →  db.create_project()  →  git_init()  →  init_devlog()
    │
    ▼
WebSocket: start_orchestration  →  run_orchestration()
    │
    ├─ 1. read_universal_lessons()       (inject past learnings)
    ├─ 2. claude_plan_project()          (Claude → JSON task list)
    ├─ 3. db.save_tasks()                (persist task DAG)
    │
    ├─ 4. FOR EACH WAVE in DAG:
    │      FOR EACH TASK in wave:
    │        ├─ load_skills(task description)      (keyword matching)
    │        ├─ read_project_files()               (existing code context)
    │        ├─ stream_master() / stream_ollama()  (generate code)
    │        ├─ extract_files_from_response()      (parse FILE: markers)
    │        ├─ write_project_files()              (write to disk)
    │        ├─ git_commit()                       (version control)
    │        ├─ claude_evaluate_task()             (quality gate)
    │        └─ update_task(status=completed)
    │
    └─ 5. extract_and_save_lesson()   (cross-project memory)
           claude_project_summary()   (completion message)
```

---

## Task DAG Execution

Tasks are planned by Claude as a JSON array. Each task optionally has a `depends_on` field listing task numbers it requires to complete first.

```python
[
  {"task": 1, "title": "HTML structure", "assigned_to": "deepseek", "depends_on": []},
  {"task": 2, "title": "Game logic",     "assigned_to": "deepseek", "depends_on": [1]},
  {"task": 3, "title": "CSS styling",    "assigned_to": "qwen35",   "depends_on": [1]},
  {"task": 4, "title": "Touch controls", "assigned_to": "deepseek", "depends_on": [2, 3]},
]
```

`_group_into_waves()` in `orchestration.py` groups independent tasks into execution waves:
- Wave 1: task 1 (no deps)
- Wave 2: tasks 2 and 3 (both depend only on task 1, already done)
- Wave 3: task 4 (depends on 2 and 3)

Tasks in the same wave are executed sequentially via `asyncio` (Ollama is serialized via `Semaphore`).

---

## File Extraction from LLM Output

Agents embed files in their output using markers. `files_io.extract_files_from_response()` tries four strategies in order, stopping at the first that yields results:

| Priority | Strategy | Example |
|----------|----------|---------|
| S3/S4 | `FILE:` comment before or inside block | `// FILE: game.js` |
| S1 | Bold/heading path before block | `**\`game.js\`**` |
| S2 | `FILE:` as first line inside block | first line of code block |
| Fallback | Language hint → extension mapping | ` ```javascript ` |

Files are then validated (no path traversal), written to `projects/<slug>/src/`, and committed to Git.

---

## Database Schema

```sql
-- Global chat messages (General Chat tab)
CREATE TABLE messages (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    role      TEXT NOT NULL,           -- 'user' | 'claude' | 'deepseek' | 'qwen35' | 'system'
    content   TEXT NOT NULL,
    timestamp TEXT NOT NULL            -- ISO-8601 UTC
);

-- Projects
CREATE TABLE projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    slug        TEXT UNIQUE NOT NULL,  -- URL-safe identifier
    description TEXT DEFAULT '',
    folder_path TEXT NOT NULL,         -- absolute path to projects/<slug>/
    status      TEXT DEFAULT 'active', -- 'active' | 'completed' | 'error'
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

-- Per-project chat messages
CREATE TABLE project_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    role       TEXT NOT NULL,
    content    TEXT NOT NULL,
    task_id    INTEGER DEFAULT NULL,   -- links message to a task
    timestamp  TEXT NOT NULL
);

-- Project tasks (DAG nodes)
CREATE TABLE tasks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER NOT NULL,
    task_number     INTEGER NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT NOT NULL,
    assigned_to     TEXT NOT NULL,     -- 'deepseek' | 'qwen35' | 'claude'
    status          TEXT DEFAULT 'pending',  -- 'pending' | 'in_progress' | 'completed' | 'error'
    files_to_create TEXT DEFAULT '[]', -- JSON array of expected filenames
    output_result   TEXT DEFAULT '',   -- full LLM output for this task
    created_at      TEXT NOT NULL,
    completed_at    TEXT DEFAULT NULL,
    depends_on      TEXT DEFAULT '[]'  -- JSON array of task_number ints (migration v1)
);

-- Schema version tracker
CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
```

**Migrations:** `db.py:_run_migrations()` applies incremental migrations. Current version: **1** (added `depends_on` column to tasks).

---

## WebSocket Message Protocol

See `docs/API.md` for the full message reference. The channel is at `ws://192.168.0.130:8080/ws`.

**Client → Server (sends):**
- `{type: "content", content: "..."}` — user chat message
- `{type: "content", content: "...", project_id: N}` — project-scoped message
- `{type: "start_orchestration", project_id: N, goal: "..."}` — start build
- `{type: "resume_orchestration", project_id: N}` — resume interrupted build
- `{type: "fix_project", project_id: N, feedback: "..."}` — targeted fix
- `{type: "get_projects"}` — refresh project list
- `{type: "load_project", project_id: N}` — load project state
- `{type: "cancel"}` — cancel active task

**Server → Client (sends):**
- `{type: "history", messages: [...]}` — initial load
- `{type: "status", claude_online: bool}` — Claude availability
- `{type: "chunk", agent: "claude", content: "..."}` — streaming delta
- `{type: "done", agent: "claude"}` — stream complete
- `{type: "user", content: "...", timestamp: "..."}` — echoed user message
- `{type: "intent_detected", intent: "project_new|project_continue", ...}` — needs UI confirmation
- `{type: "project_list", projects: [...]}` — project list response
- `{type: "project_loaded", project, messages, tasks}` — project load response
- `{type: "task_start", task_id: N, title: "..."}` — task execution beginning
- `{type: "task_complete", task_id: N}` — task done
- `{type: "plan", tasks: [...]}` — task plan generated
- `{type: "complete", summary: "..."}` — project build complete
- `{type: "cancelled"}` — cancellation confirmed
- `{type: "error", message: "..."}` — error occurred

---

## Skill Injection Pipeline

```
Task description text
    │
    ▼
skills_mod.load_skills(context)
    │
    ├─ Scans skills/*.md for frontmatter keywords
    ├─ Matches if any keyword appears as a whole word in context
    └─ Returns concatenated bodies of matched skills
    │
    ▼
Appended to agent system prompt before LLM call
```

Skill files live in `skills/`. Each must have `keywords:` in frontmatter. Example:
```markdown
---
name: game-development
keywords: game, canvas, collision, sprite, animation
description: Game dev patterns and best practices
---

When building browser games: use requestAnimationFrame, ...
```

---

## Memory & Lessons System

```
Project build completes
    │
    ▼
extract_and_save_lesson()  →  Claude summarises key lesson  →  projects/<slug>/lessons.md
    │
    │  Every LESSON_SAMPLE_RATE new lessons:
    ▼
append_lesson(universal=True)  →  memory/universal_lessons.md
    │
    │  Next project build:
    ▼
read_universal_lessons()  →  prepended to claude_plan_project() prompt
```

---

## Agent Roles

| Key | Model | Role | Context |
|-----|-------|------|---------|
| `claude` | claude-sonnet-4-6 | Orchestrator, planner, evaluator | Cloud API |
| `deepseek` | deepseek-coder-v2:16b-lite-instruct-q5_K_S | Primary coder | Ollama local |
| `qwen35` | qwen3.5:9b | CSS/UI specialist, fast worker | Ollama local (custom) |

Custom agents are added via `POST /ollama/models` and persisted in `custom_agents.json`. Built-in agents (`deepseek`) cannot be removed.

---

## Process Management

```
start.sh
  └── source .venv/bin/activate
  └── exec uvicorn server:app --host 0.0.0.0 --port 8080

Background tasks (started in server startup):
  ├── ollama_monitor()      — pings Ollama every 30s, updates availability status
  └── _backup_scheduler()   — copies chat.db + memory/ every 24h to backups/<timestamp>/
```

**Restart command:**
```bash
kill $(ps aux | grep 'uvicorn server:app' | grep -v grep | awk '{print $2}') 2>/dev/null
cd ~/ai-chat && nohup .venv/bin/uvicorn server:app --host 0.0.0.0 --port 8080 > /tmp/ai-chat.log 2>&1 &
```
