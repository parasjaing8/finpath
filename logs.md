# AI-Chat Session Logs

---

## Session: 2026-04-14

### Summary
End-to-end testing session covering: Phase 8-14 task audit, server restart, Python 3.12 migration, qwen-only orchestration test, game build test, and graphify graph refresh.

---

### Bug Fixes

#### BUG-1: `get_master_model()` ignored `disabled_agents` — `server.py`
- **Symptom**: With claude + deepseek disabled, build log showed `"🧠 Deepseek is planning the project..."` — deepseek was selected as planner despite being in `disabled_agents`.
- **Root cause**: Fallback `return "deepseek"` was unconditional; never consulted `_config["disabled_agents"]`.
- **Fix**: Function now iterates `OLLAMA_MODELS` and returns the first agent not in the `disabled` set.
- **Impact**: Qwen-only mode now correctly routes all orchestration through `qwen35`.

#### BUG-2: `_validate_task_granularity` missing field normalization — `orchestration.py`
- **Symptom**: `KeyError: 'task_number'` crash in `db.save_tasks()` when Qwen35 returned split tasks after granularity validation.
- **Root cause**: Qwen35's JSON response omitted required fields (`task_number`, `assigned_to`, etc.); no normalization was applied after parsing.
- **Fix**: After parsing revised JSON, `setdefault()` fills all required fields (`task_number`, `assigned_to`, `title`, `description`, `files_to_create`, `depends_on`) before returning.
- **Impact**: Build no longer crashes when `_validate_task_granularity` splits tasks using a local model.

#### BUG-3: Trailing ` ``` ` fences in extracted file content — `files_io.py`
- **Symptom**: Qwen35-generated files (`index.html`, `calculator.js`) had stray ` ``` ` or ` ```javascript` appended after the last line of code.
- **Root cause**: Qwen35 writes a closing fence after file content; the S3/S4 raw-extraction path and S2 path did not strip it.
- **Fix**: Added `_strip_trailing_fence()` helper using `re.sub(r'\n?```[\w]*\s*$', '', code)`; applied to all three extraction paths.
- **Impact**: All future Qwen35-generated files will be clean; existing code review pass still runs as backup.

#### BUG-4 (partial — T10.5): Missing `fetch()` error toasts — `static/app.js`
- **Symptom**: 20 `fetch()` calls, only 1 had `.catch()` — network errors silently swallowed.
- **Fix**: 7 functions wrapped with `try/catch` + `showToast(e.message, 'error')`: `fetch('/projects')`, `loadSettings()`, `saveApiKey()`, `testClaude()`, `testLocal()`, `setAgentEnabled()`, `syncPillStates()`.

---

### Build Tests

#### Qwen-only Calculator Build
- **Project**: `qwen-calc-test-2` (id=69)
- **URL**: `http://192.168.0.130:8080/play/qwen-calc-test-2/`
- **Mode**: claude + deepseek disabled; qwen35 handled planning + all tasks
- **Planning time**: ~255s (9B model)
- **Tasks**: 3 tasks, all assigned to `qwen35`
- **Output**: `index.html` + `js/calculator.js`
- **Post-build fixes applied manually**:
  - Added Android dark Material Design CSS (dark `#212121` theme, orange operators, circular buttons, ripple effect)
  - Fixed eval symbol mismatch: `×`→`*`, `÷`→`/`, `−`→`-` before `Function()` eval
  - Stripped trailing ` ``` ` from both files (pre-dates the `files_io.py` systemic fix)

#### Tetris Game Build (All Agents)
- **Project**: `tetris-game` (id=70)
- **URL**: `http://192.168.0.130:8080/play/tetris-game/`
- **Mode**: claude (planner) + deepseek (coder) + qwen35 (CSS/UI)
- **Planning time**: ~30s (Claude)
- **Tasks**: 3 tasks assigned to `deepseek`
- **Issue**: Task 1 produced a scaffold stub + referenced missing `css/style.css`; tasks 2 & 3 blocked by upstream failure.
- **Claude fix pass**: Inlined CSS, removed external ref — HTML became usable.
- **Post-build full rewrite**: `js/game.js` replaced with complete Tetris implementation:
  - All 7 tetrominoes (I, O, T, S, Z, J, L) with correct 4-rotation bitmasks
  - Ghost piece (semi-transparent drop preview)
  - Wall-kick rotation (tries offsets: 0, ±1, ±2)
  - Line clearing: 100 / 300 / 500 / 800 pts for 1–4 lines, multiplied by level
  - Level system: speed increases every 10 lines (`dropInterval = max(100, 800 - (level-1)*70)`)
  - Hard drop (Space, +2pts per row), soft drop (↓, +1pt), rotate (↑/W), move (←/→)
  - Next-piece preview canvas
  - Game-over detection + Restart button
  - Dark neon theme: `#0d1117` background, `#7c3aed` borders, `#00ffe7` score glow
- **JS syntax**: verified clean with `node --check`

---

### Infrastructure

#### Python 3.12 Migration
- Deleted `.venv` (Python 3.9.6) → recreated with `/opt/homebrew/bin/python3.12` (3.12.13)
- All deps reinstalled from `requirements.txt` + `pytest` + `websockets`
- **153 unit tests pass** on Python 3.12 (`1.12s`)
- Python 3.9.6 (Apple CLT system Python) left in place — harmless

#### Graphify Knowledge Graph
- Graph was stale (last built: 03:54, 18 source files modified after)
- Rebuilt at 20:40: **311 nodes · 441 edges · 41 communities**
- God nodes: `OrchStats` (59 edges), `_db_connect()` (20), `run_orchestration()` (11), `ws_endpoint()` (9), `_build_worker_system()` (8)

---

### Known Issues / Not Fixed

| Issue | Status | Notes |
|-------|--------|-------|
| WebSocket cancel-on-disconnect | Known, by design | `_receiver()` → `__disc__` → cancels active build when monitoring WS disconnects. Workaround: `nohup` + persistent connection. |
| Task titles from local planner | Generic | Qwen35 returns `"Task 1"`, `"Task 2"` etc. instead of descriptive titles. Cosmetic only. |
| `stats.total_tokens` always 0 | Suspected | Build complete event shows `Tokens: 0, Cost: $0.0000` — token tracking may not be wired for local-only builds. |
| Tetris tasks 2 & 3 were blocked | Post-build patched | Only task 1 ran; tasks 2–3 depended on task 1 passing eval. Full game written manually. |
