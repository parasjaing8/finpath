# AI-Chat Platform — GitHub Copilot Instructions

## What This Project Is

**ai-chat** is a multi-agent AI development platform running headless on a Mac Mini (192.168.0.130). It orchestrates three LLMs — Claude (cloud), DeepSeek 16B (local), and Qwen 9B (local) — to collaboratively plan, write, and serve full web applications in response to plain-English requests.

Users visit `http://192.168.0.130:8080` from a browser, describe a project, and the agents build it. The output is immediately playable at `http://192.168.0.130:8080/play/<slug>/`.

---

## Repository Layout

```
config.py            — Centralized configuration (all tunable values + env overrides)
server.py            — FastAPI app: WebSocket, REST endpoints, startup, backup scheduler
orchestration.py     — Intent detection, task planning, DAG execution, evaluation, memory
models.py            — Claude API + Ollama routing, streaming, token/cost tracking
db.py                — SQLite layer: messages, projects, tasks, migrations
files_io.py          — LLM output → file extraction, Git ops, devlog
skills_mod.py        — Keyword-based skill injection into agent prompts

static/
  index.html         — Single-page web UI (do NOT edit index.html at repo root)
  app.js             — WebSocket client, project management, markdown rendering
  app.css            — Dark theme (GitHub-style), agent color coding

docs/
  ARCHITECTURE.md    — System design, data flow, DB schema, WebSocket protocol
  API.md             — All REST and WebSocket endpoints
  DEPLOYMENT.md      — Mac Mini setup, process management, restart instructions

kb/
  AGENT_RULES.md     — Strict rules injected into agent system prompts
  SYSTEM_KB.md       — Hardware/network facts about the Mac Mini environment

skills/              — Skill .md files, keyword-matched and appended to worker prompts
memory/
  universal_lessons.md — Cross-project lessons extracted by Claude after each build

tests/               — Integration tests, benchmarks, smoke tests (not pytest unit tests)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Web framework | FastAPI + Uvicorn |
| Realtime | WebSocket (FastAPI native) |
| Database | SQLite (WAL mode) via stdlib sqlite3 |
| HTTP client | httpx (async) |
| Claude | Anthropic API via httpx (not the anthropic SDK) |
| Local LLMs | Ollama at localhost:11434 |
| Frontend | Vanilla JS, marked.js, DOMPurify, highlight.js |
| Process mgmt | start.sh → uvicorn (no Docker, no systemd) |

---

## Key Conventions

### Module wiring
Modules (`models.py`, `db.py`, `orchestration.py`) declare their own default globals and expose a `configure()` function. `server.py` calls each module's `configure()` once at startup to inject shared references. This avoids circular imports.

```python
# Pattern used in every sub-module
SERVER_HOST: str = "192.168.0.130:8080"  # default
def configure(*, server_host: str, ...) -> None:
    global SERVER_HOST
    SERVER_HOST = server_host
```

### Configuration
All tunable values live in `config.py`. Import from there — do not add new magic constants to individual modules.

```python
from config import CONTEXT_LEN, OLLAMA_TIMEOUT  # correct
CONTEXT_LEN = 20  # wrong — don't do this in a module
```

### WebSocket message protocol
All WebSocket messages are JSON objects with a `"type"` field. See `docs/API.md` for the full protocol. The client (`app.js`) and server (`server.py`) must stay in sync on type names.

### Task DAG execution
`orchestration.py` plans projects as a list of tasks with optional `depends_on` fields. Tasks without dependencies run in the same "wave" (conceptually parallel, actually sequenced via `asyncio`). The DAG is built in `_group_into_waves()`.

### File extraction from LLM output
Agents write files using specific markers in their output. `files_io.extract_files_from_response()` handles 4 strategies in priority order (S3/S4 FILE: comments → S1 bold/heading before block → S2 FILE: first line inside block). Always use this function to parse agent output — do not write ad-hoc regex.

### Streaming
All LLM responses stream via WebSocket. The pattern:
1. Send `{"type": "chunk", "agent": "<name>", "content": "<delta>"}` repeatedly
2. Send `{"type": "done", "agent": "<name>"}` when complete

`safe_send()` in `orchestration.py` wraps WebSocket sends with disconnect handling.

### Memory / lessons
After each project build, `extract_and_save_lesson()` asks Claude to extract a reusable lesson. Lessons are appended to `projects/<slug>/lessons.md` and periodically sampled into `memory/universal_lessons.md`. Universal lessons are prepended to new project planning prompts.

---

## Critical Constraints (NEVER violate)

1. **Port 8080 is reserved** for this server. Agent-generated projects must NOT start their own servers.
2. **Headless environment** — the Mac Mini has no display. Never tell users to "open a file" or "use Finder".
3. **Play URL pattern** — always reference projects as `http://192.168.0.130:8080/play/<slug>/`.
4. **Relative paths only** in agent-generated web projects. No `/static/...` or `C:\...` paths.
5. **`static/index.html` is canonical** — the root `index.html` should not exist; if it does, it's stale.
6. **SQLite is the only database** — no external DB, no Redis, no message queue.
7. **Ollama is localhost-only** — never expose Ollama externally.

---

## Agent Identity & Roles

| Agent key | Model | Role |
|-----------|-------|------|
| `claude` | claude-sonnet-4-6 (API) | Orchestrator, planner, evaluator |
| `deepseek` | deepseek-coder-v2:16b-lite-instruct-q5_K_S | Primary coder |
| `qwen35` | qwen3.5:9b (custom agent) | CSS/UI specialist, fast worker |

Custom agents are registered in `custom_agents.json` and loaded at startup. Built-in agents (`deepseek`) cannot be removed via API.

---

## Common Workflows

### Adding a new REST endpoint
Add it to `server.py`. Follow the existing pattern: return dicts (FastAPI auto-serializes to JSON), use `Depends(_require_localhost)` for admin-only endpoints.

### Changing orchestration behavior
Edit `orchestration.py`. The main entry points are:
- `run_orchestration()` — full project build
- `run_fix_task()` — targeted fix given user feedback
- `claude_plan_project()` — task list generation
- `claude_evaluate_task()` — quality gate on each task

### Adding a new skill
Create `skills/<name>.md` with frontmatter:
```markdown
---
name: my-skill
keywords: keyword1, keyword2
description: One-line description
---
Skill content injected into worker system prompts when keywords match...
```

### Changing model defaults
Edit `config.py` — never hardcode in model-specific files. Models are referenced by key (`deepseek`, `qwen35`), not by model name string.

---

## Security Notes

- All `/admin/*` endpoints require localhost. Do not remove this guard.
- File paths from LLM output are validated with `pathlib.resolve().relative_to()` before writing.
- All SQL uses parameterized queries — maintain this pattern.
- The `ALLOWED_TASK_COLS` whitelist in `db.py` prevents injection via `update_task()` dynamic columns.
- Do not log the `ANTHROPIC_API_KEY` value.
