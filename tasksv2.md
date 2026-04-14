# AI-Chat Platform — Task Plan v2

> Generated: 2026-04-14 | Status: **Phases 1–7 Complete**
> Scope: Industry-grade hardening, self-improving feedback loop, automated QA

---

## Executive Summary

Phases 1–7 addressed project structure, security, configuration, monitoring, prompts, graphify integration, and health endpoints. The platform is **functional and well-architected**.

This v2 plan focuses on making it **self-improving**: user feedback on generated projects should automatically refine prompts, skills, and agent behavior — creating a flywheel where every project makes the next one better.

### Current Architecture Gaps (Post-Phase 7)

| Gap | Impact | Phase |
|-----|--------|-------|
| No "done" detection — system never knows user is satisfied | Fix loop never closes, no post-project analysis | 8 |
| Per-fix lessons are 20-word snippets, no deep analysis of full conversation | Same LLM mistakes repeat across projects | 8 |
| No LLM behavior profiling — don't know WHICH agent makes WHICH mistakes | Can't target prompt/skill fixes | 8 |
| Lessons never mutate skills/prompts — just appended to a text file | Learning doesn't affect behavior | 8 |
| Lessons aren't topically matched to new projects | Irrelevant lessons waste context | 8 |
| Loading 2 local models simultaneously OOMs on 16GB | Swap thrash, slow/failed builds | 14 |
| No task splitting guidance for local LLM capability | Tasks too complex → poor output | 14 |
| Dynamic roles only reroute at task time, not at planning time | Suboptimal agent assignments | 14 |
| No contribution % visualization | User can't see cost savings | 14 |
| Evaluator auto-approves on parse failure/timeout | Broken code shipped | 9 |
| No JS/CSS/HTML validation beyond LLM review | Syntax errors slip through | 11 |
| Frontend ignores `system_alert` messages | Ollama alerts invisible | 10 |
| Zero unit tests | Regressions go undetected | 12 |
| All WS broadcasts go to all clients | O(users) waste | 13 |

---

## PHASE 8 — Self-Improving Feedback Loop
> Goal: The natural chat flow — build → test → feedback → fix → repeat → "done" → system learns everything and auto-improves prompts/skills for next time.

### The Loop (Current vs Target)

**What already works:**
```
User: "create tetris game"           → detect_intent → project_new → run_orchestration()
User: "pieces don't rotate"          → detect_intent_in_project → build → run_fix_task()
User: "now the score doesn't update" → same → run_fix_task() again
```

Each `run_fix_task()` extracts a 20-word lesson. That's it.

**What we're adding:**
```
User: "looks great, thanks!"
  → detect_intent_in_project returns NEW intent: "done"
  → Triggers: close_project_thread()
    1. Collect ENTIRE build+fix history for this project
    2. Ask Claude to do deep analysis:
       - Which agent made which mistakes?
       - What patterns repeat across this session?
       - What specific rules would prevent these?
    3. Store analysis in project's lessons.md AND memory/agent_profiles.md
    4. Auto-patch relevant skill files if pattern is actionable
    5. Mark project "finalized"
```

### T8.1 — Add "done" intent detection
**Priority:** Critical | **Effort:** Small

Extend `detect_intent_in_project()` to recognize a 4th intent:

```python
async def detect_intent_in_project(message: str, project_name: str) -> str:
    system = textwrap.dedent(f"""\
        User is inside project "{project_name}".
        Classify their message as exactly one word:
        query  — asking about status, progress, what was built, how it works
        build  — wants to add features, fix bugs, change or continue building
        done   — user is satisfied: "done", "looks good", "perfect", "thanks", "completed", "that works"
        chat   — general question unrelated to building this project
        Respond with ONLY that one word.
    """)
```

In `server.py` WebSocket handler, add the `done` routing:
```python
if routing == "done":
    await _run_task(close_project_thread(ws, project_id_ctx, cancel_event))
    continue
```

### T8.2 — Implement `close_project_thread()`
**Priority:** Critical | **Effort:** Medium

New function in `orchestration.py`. Triggered when user signals satisfaction. Does:

1. **Collect full history**: all project messages (user feedback + agent responses), all task evaluations (pass/fail/retry), all fix cycles
2. **Deep analysis prompt** to Claude:
   ```
   Analyze this complete build session for project "{name}":

   BUILD PHASE:
   - Tasks planned: {task_list}
   - Tasks that failed first evaluation: {failed_tasks}
   - Agents used: {agent_assignments}

   FIX CYCLES:
   {for each fix: user_feedback, agent_used, what_changed, files_modified}

   Answer these questions:
   1. Which agent(s) made mistakes? What SPECIFIC mistakes?
   2. What RECURRING patterns do you see in the failures?
   3. For each pattern, write ONE concrete rule (max 30 words) that would prevent it.
   4. Which skill file should each rule be added to? (game-development, web-development, etc.)
   5. Were any failures caused by poor task descriptions in the plan?

   Respond as JSON:
   {
     "agent_issues": [{"agent": "deepseek", "pattern": "...", "rule": "...", "skill_file": "..."}],
     "plan_issues": ["..."],
     "positive_patterns": ["what went RIGHT that should be replicated"]
   }
   ```
3. **Store results**: Save full analysis to `projects/<slug>/post_analysis.json`
4. **Update agent profiles**: Append to `memory/agent_profiles.md`:
   ```
   ## deepseek — 2026-04-14
   - Missed: rotation logic in Tetris (game-development pattern)
   - Rule: "Always implement all core game mechanics listed in task description"
   ```
5. **Trigger skill mutation** (T8.4)
6. **Send completion to UI**:
   ```json
   {"type": "project_finalized", "analysis_summary": "Found 2 patterns, updated 1 skill", "slug": "tetris"}
   ```

### T8.3 — Agent behavior profiling
**Priority:** High | **Effort:** Small

Create `memory/agent_profiles.md` — a running log of per-agent strengths/weaknesses:

```markdown
# Agent Behavior Profiles
Updated automatically by close_project_thread()

## deepseek
### Known weaknesses (auto-detected)
- Forgets canvas game loop initialization (3 occurrences)
- Misses rotation mechanics in puzzle games (2 occurrences)
### Strengths
- Clean HTML structure
- Good error handling in JS

## qwen35
### Known weaknesses
- CSS flexbox centering often broken (4 occurrences)
### Strengths
- Excellent color palettes and gradients
```

**Injection**: When building a task prompt for an agent, prepend its weakness list:
```python
def _build_worker_system(project, task_context=None):
    # ... existing code ...
    agent_warnings = _load_agent_weaknesses(agent)
    if agent_warnings:
        system += f"\n\nKNOWN ISSUES TO AVOID:\n{agent_warnings}"
```

Each weakness entry has an occurrence counter. After 5+ occurrences, it's promoted to a permanent skill rule (T8.4). Weaknesses that haven't occurred in 20 projects are auto-retired.

### T8.4 — Dynamic skill mutation from analysis
**Priority:** High | **Effort:** Medium

When `close_project_thread()` produces `agent_issues` with rules:

1. Match each rule to a skill file (Claude suggests which one in the analysis)
2. Validate the skill file exists in `skills/`
3. Append the rule under a `## Auto-learned rules` section:
   ```markdown
   ## Auto-learned rules
   <!-- Do not edit — managed by feedback loop -->
   - Always implement all core game mechanics listed in task description (source: tetris 2026-04-14)
   - Use requestAnimationFrame for canvas game loops, not setInterval (source: snake3 2026-04-12)
   ```
4. Log mutation in `memory/skill_mutations.log`:
   ```
   2026-04-14 12:30:00 | PATCH | skills/game-development.md | +1 rule | source: tetris | hash: abc123
   ```

**Safety guardrails:**
- Max 1 mutation per skill per day
- Max 500 chars per appended rule
- All mutations logged with before/after hash
- `GET /admin/skill-mutations` lists all mutations for review
- `POST /admin/skill-mutations/{id}/revert` rolls back a specific mutation
- Auto-learned section is clearly separated from hand-written rules

### T8.5 — Semantic lesson retrieval
**Priority:** High | **Effort:** Small

When planning a new project, don't just grab last N lessons. Match by topic:

```python
def find_relevant_lessons(description: str, max_lessons: int = 5) -> list[str]:
    keywords = set(re.findall(r'\b\w{4,}\b', description.lower()))
    scored = []
    for lesson in all_lessons:
        overlap = len(keywords & set(re.findall(r'\b\w{4,}\b', lesson.lower())))
        if overlap > 0:
            scored.append((overlap, lesson))
    scored.sort(reverse=True)
    return [lesson for _, lesson in scored[:max_lessons]]
```

Also inject relevant agent profile warnings into the planning prompt so Claude can assign tasks to the right agents:
```
Agent deepseek is known to miss game loop initialization.
Agent qwen35 excels at CSS but struggles with complex JS logic.
Consider agent strengths when assigning tasks.
```

### T8.6 — Lesson extraction on successful first-try builds
**Priority:** Medium | **Effort:** Small

Currently `extract_and_save_lesson()` only runs in `run_fix_task()`. Also call it when ALL tasks in `run_orchestration()` pass evaluation on first try:
- Prompt: "This project succeeded on first try. What did the agents do RIGHT?"
- Positive lessons are valuable: "Always initialize canvas dimensions before game loop"

### T8.7 — Fix history storage for analysis
**Priority:** Medium | **Effort:** Small

Currently fix events are logged in `devlog.md` (free-text) and project messages (chat history). For `close_project_thread()` to do proper analysis, add structured tracking:

- New DB table or JSON file per project: `projects/<slug>/fix_history.json`
  ```json
  [
    {
      "cycle": 1,
      "user_feedback": "pieces don't rotate",
      "agent": "deepseek",
      "files_changed": ["src/game.js"],
      "evaluation": {"approved": true},
      "timestamp": "2026-04-14T12:30:00Z"
    }
  ]
  ```
- Written by `run_fix_task()` after each fix cycle
- Read by `close_project_thread()` for deep analysis

### T8.8 — Quality dashboard
**Priority:** Low | **Effort:** Medium

Add `/admin/quality` endpoint (localhost only) returning:
- Total projects built vs finalized (user said "done")
- Average fix cycles per project (trending down = system is improving)
- Most common failure patterns from `agent_profiles.md`
- Skill mutation history from `skill_mutations.log`
- Per-agent failure rate

Surface in a simple admin HTML page at `/admin/dashboard`.

---

## PHASE 9 — Evaluator Hardening
> Goal: Stop approving broken code. Make evaluation strict, deterministic, and timeout-aware.

### T9.1 — Fix evaluator timeout = auto-approve bug
**Priority:** Critical | **Effort:** Small

In `claude_evaluate_task()`, when Claude times out, `stream_master()` yields `"*[Claude error: timeout]*"`. This text goes through the lenient parser which doesn't match "error" reliably (it checks `"error" in low` but the asterisks/brackets may not match cleanly).

Fix: Before lenient parsing, check for the sentinel pattern `*[Claude error:` and immediately return `{"approved": False, "feedback": "Evaluator timed out"}`.

### T9.2 — Expand evaluation checklist
**Priority:** High | **Effort:** Medium

Current `claude_evaluate_task()` pre-checks:
1. FILE: markers present
2. Expected files produced
3. HTML files have `<html>` tag

Add these pre-checks (NO LLM needed — pure Python):
4. JS files parse without syntax errors (`import subprocess; node --check`)
5. CSS files have balanced `{}` braces
6. HTML `<script src="X">` references exist in file list
7. No `http://localhost` or `127.0.0.1` in non-API code
8. No absolute file paths (`C:\`, `/Users/`, `/home/`)
9. HTML has `<meta charset>` or `<meta charset="UTF-8">`
10. Canvas games: at least one `requestAnimationFrame` OR `setInterval` call

### T9.3 — Add structured evaluation result
**Priority:** Medium | **Effort:** Small

Change evaluator return format from:
```json
{"approved": true/false, "feedback": "..."}
```
To:
```json
{
  "approved": true/false,
  "checks": {
    "files_present": true,
    "html_valid": true,
    "js_syntax": true,
    "references_valid": false
  },
  "feedback": "script.js references #gameCanvas but index.html has #canvas",
  "severity": "error|warning|info"
}
```

Store full evaluation result in tasks table (`evaluation_json` column). Use for failure pattern analysis (T8.2).

### T9.4 — Add retry budget with escalation
**Priority:** Medium | **Effort:** Small

Current: if evaluation fails, retry once with feedback, then approve regardless.

New strategy:
1. First attempt: assigned worker model
2. First retry: same worker with evaluation feedback
3. Second retry: **escalate to Claude** with full context + evaluation history
4. If Claude also fails: mark task `status="failed"`, halt DAG, notify user

Add `retry_count` and `escalated_to` columns to tasks table.

### T9.5 — Cascading failure detection
**Priority:** Medium | **Effort:** Small

If a task is marked "failed" or "errored", check all downstream dependent tasks. Mark them `status="blocked"` with `blocked_by=<failed_task_id>`. Don't attempt execution.

Send to user:
```json
{"type": "orch_blocked", "blocked_tasks": [3, 4], "root_cause_task": 2,
 "message": "Tasks 3 and 4 are blocked because Task 2 failed"}
```

---

## PHASE 10 — Frontend Polish
> Goal: Make the UI production-quality with proper error visibility and feedback mechanisms.

### T10.1 — Handle `system_alert` WebSocket messages
**Priority:** High | **Effort:** Small

T7.2 added server-side alerting but the frontend doesn't handle it. Add:
```javascript
case 'system_alert':
    showToast(msg.message, msg.severity);  // toast notification
    break;
```

Implement `showToast()`:
- Fixed-position notification at top-right
- Color-coded: red for error, yellow for warning, blue for info
- Auto-dismiss after 8s, click to dismiss immediately
- Stack multiple toasts vertically

### T10.2 — Handle `project_finalized` message
**Priority:** High | **Effort:** Small

When server sends `{"type": "project_finalized", ...}` after user says "done":
- Show summary card: "Project finalized — 2 patterns detected, 1 skill updated"
- List the agent issues found (collapsible)
- Link to play URL
- Mark project in sidebar as "finalized" (distinct from just "completed")

### T10.3 — Add inline fix feedback context
**Priority:** Medium | **Effort:** Small

When user sends fix feedback, show a subtle status line:
- "Fixing: pieces don't rotate → deepseek is working..."
- After fix: "Fixed 2 files. Fix cycle 3 of this session."
- Helps user understand the iterative nature

### T10.4 — Fix file viewer content pane
**Priority:** Medium | **Effort:** Small

The file viewer modal shows a tree of file paths but clicking a file doesn't load its content. Wire up the click handler:
- `GET /projects/{id}/files/{path}` to fetch file content
- Render in the right pane with syntax highlighting (highlight.js is already loaded)
- Add line numbers
- Add copy-to-clipboard button

### T10.5 — Add error toast on API failures
**Priority:** Medium | **Effort:** Small

Currently, failed `fetch()` calls (project create, delete, settings save) fail silently. Add `.catch()` handlers that call `showToast(error.message, 'error')`.

### T10.6 — Add loading states
**Priority:** Low | **Effort:** Small

Show skeleton/spinner states for:
- Project list loading in sidebar
- Settings panel loading agent info
- File viewer loading file content
- Play URL iframe loading

### T10.7 — Add keyboard shortcuts
**Priority:** Low | **Effort:** Small

- `Ctrl+Enter` or `Cmd+Enter` — send message
- `Escape` — cancel current generation / close modals
- `Ctrl+/` — focus chat input
- `Ctrl+Shift+N` — new project (focus "create project" flow)

---

## PHASE 11 — Automated QA Pipeline
> Goal: Validate generated projects with real tools, not just LLM review.

### T11.1 — Add JS syntax validation
**Priority:** High | **Effort:** Small

After `write_project_files()`, for each `.js` file:
```python
result = subprocess.run(
    ["node", "--check", str(js_path)],
    capture_output=True, timeout=5
)
if result.returncode != 0:
    errors.append(f"{js_path.name}: {result.stderr.decode()}")
```

If node isn't available, skip gracefully. Report errors in evaluation.

### T11.2 — Add HTML validation
**Priority:** Medium | **Effort:** Small

For each `.html` file, check:
- Has `<!DOCTYPE html>` or `<html`
- All `<script src="X">` reference files that exist in project
- All `<link href="X">` reference files that exist in project
- No unclosed tags (basic regex check for `<div>` count vs `</div>` count)

Pure Python — no external tools needed.

### T11.3 — Add CSS validation
**Priority:** Low | **Effort:** Small

For each `.css` file:
- Balanced `{` and `}` braces
- No empty rulesets `{}`
- No `@import` of non-existent files

### T11.4 — Add cross-file reference validation
**Priority:** High | **Effort:** Medium

Check that all inter-file references are valid:
- JS `document.getElementById("X")` → verify `id="X"` exists in HTML
- JS `document.querySelector(".X")` → verify `class="X"` exists in HTML
- HTML `onclick="fn()"` → verify `fn` is defined in a JS file
- JS `import './file.js'` → verify file exists

This catches the #1 category of generated project bugs.

### T11.5 — Add project "smoke open" test
**Priority:** Medium | **Effort:** Medium

After build, programmatically verify the project serves:
```python
async with httpx.AsyncClient() as client:
    r = await client.get(f"http://localhost:8080/play/{slug}/")
    assert r.status_code == 200
    assert "<html" in r.text.lower()
    # Check all referenced JS/CSS files are accessible
    for src in re.findall(r'src="([^"]+)"', r.text):
        r2 = await client.get(f"http://localhost:8080/play/{slug}/{src}")
        assert r2.status_code == 200
```

Report unreachable resources as build errors.

### T11.6 — Integrate QA results into evaluation
**Priority:** Medium | **Effort:** Small

Feed T11.1–T11.5 results into `claude_evaluate_task()` as additional context:
```python
qa_report = run_qa_checks(project, files)
if qa_report.errors:
    return {"approved": False, "feedback": f"QA failures: {qa_report.summary()}"}
```

This makes evaluation deterministic for objective issues (syntax, references) while keeping LLM review for subjective quality.

---

## PHASE 12 — Testing & Reliability
> Goal: Prevent regressions, enable confident refactoring.

### T12.1 — Unit tests for `files_io.py`
**Priority:** High | **Effort:** Medium

Test cases:
- `extract_files_from_response()` with all 4 strategies (S1–S4)
- Edge cases: empty input, no FILE: markers, overlapping markers
- `write_project_files()` with path traversal attempts (verify rejection)
- `infer_files_from_codeblocks()` with ambiguous code blocks
- Git operations with missing git binary

### T12.2 — Unit tests for `orchestration.py`
**Priority:** High | **Effort:** Medium

Test cases:
- `detect_intent()` with ambiguous messages
- `_group_into_waves()` with cycles, diamond dependencies, linear chains
- `claude_evaluate_task()` with valid JSON, invalid JSON, timeout text, empty response
- `find_relevant_lessons()` keyword matching (after T8.4)
- Plan validation with mismatched task dependencies

### T12.3 — Unit tests for `models.py`
**Priority:** Medium | **Effort:** Medium

Test cases:
- Token truncation logic in `build_claude_messages()`
- `check_ollama_online()` caching behavior
- `parse_mentions()` with edge cases
- `OrchStats` accumulation and cost calculation

### T12.4 — Unit tests for `db.py`
**Priority:** Medium | **Effort:** Small

Test cases:
- Migration logic (fresh DB, already-migrated DB)
- `update_task()` with invalid column names (SQL injection guard)
- Concurrent `_db_connect()` calls
- `ALLOWED_TASK_COLS` whitelist effectiveness

### T12.5 — Integration test harness
**Priority:** High | **Effort:** Large

Create `tests/test_e2e.py` that:
1. Starts the server programmatically
2. Connects via WebSocket
3. Sends "build a counter app" message
4. Waits for `orch_complete` or timeout
5. Verifies files were written to `projects/test-*/src/`
6. Verifies `/play/test-*/` returns 200
7. Cleans up

Run with: `python -m pytest tests/test_e2e.py -v`

### T12.6 — Add pre-commit hook for tests
**Priority:** Medium | **Effort:** Small

Install alongside the graphify hook:
```bash
# .git/hooks/pre-commit
python -m pytest tests/ -x --timeout=30 -q
```

Only run fast unit tests (not E2E) to keep commits quick.

### T12.7 — Add CI configuration
**Priority:** Low | **Effort:** Small

Create `.github/workflows/test.yml` (even if not using GitHub — documents the test matrix):
```yaml
jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r requirements.txt
      - run: python -m pytest tests/ -x -v --timeout=60
```

---

## PHASE 13 — Scalability & Multi-User
> Goal: Support multiple concurrent users without interference.

### T13.1 — Per-project WebSocket subscriptions
**Priority:** Medium | **Effort:** Medium

Replace flat `_ws_clients: set[WebSocket]` with:
```python
_ws_subscriptions: dict[int | None, set[WebSocket]] = defaultdict(set)
# None = global (system alerts), int = project_id
```

When user opens a project, send `{"type": "subscribe", "project_id": 123}`.
Broadcast project events only to subscribed clients. System alerts still go to all.

### T13.2 — Concurrent build queue
**Priority:** Medium | **Effort:** Medium

Currently, if two users start builds simultaneously, both `run_orchestration()` calls run in parallel and may compete for Ollama. Add a build queue:
```python
_build_queue: asyncio.Queue = asyncio.Queue(maxsize=10)
_build_workers: int = 2  # max concurrent builds
```

Incoming builds are queued. Workers dequeue and execute. User sees "Queued (position 3)" message.

### T13.3 — Database pagination for project messages
**Priority:** Medium | **Effort:** Small

`load_project_messages()` fetches last 30 messages. Add pagination:
```python
def load_project_messages(project_id: int, limit: int = 30, before_id: int | None = None) -> list:
```

Frontend: "Load earlier messages" button at top of chat.

### T13.4 — Project-level isolation
**Priority:** Low | **Effort:** Medium

Ensure one user's project build can't affect another's:
- File writes are already project-scoped (good)
- DB writes are parameterized (good)
- But `OLLAMA_MODELS` dict is global — agent changes affect all users
- `OrchStats` is per-build (good)

Fix: Make agent registry read-only during builds. Admin changes to agents are queued and applied between builds.

### T13.5 — Session management
**Priority:** Low | **Effort:** Medium

Currently no auth, no sessions. For multi-user:
- Add optional auth token (cookie or WS query param)
- Track per-user project ownership
- Show only user's projects in sidebar
- Admin endpoints still localhost-only

Not blocking for single-user Mac Mini setup but needed for shared access.

---

## PHASE 14 — Smart Model Orchestration & Token Economics
> Goal: Maximize local LLM usage (save cost), handle 16GB RAM constraint (one model at a time), dynamic role assignment when agents go offline, and show users the token savings.

### Current State Analysis

**What works:**
- `OrchStats` already tracks per-agent token usage and shows a colored bar + savings estimate
- `get_master_model()` falls back when Claude is offline
- `claude_plan_project()` adjusts roles when agents are disabled
- `_execute_task()` reroutes when an assigned agent is disabled/offline
- `KEEP_ALIVE="10m"` controls how long Ollama keeps a model loaded
- `OLLAMA_CONCURRENCY=1` (Semaphore) already serializes Ollama calls

**What's missing:**
- No awareness that loading deepseek + qwen simultaneously OOMs on 16GB
- No task splitting to make big tasks local-LLM-sized
- No model unload before loading a different model
- Dynamic roles don't fully adapt (e.g., qwen-only mode still plans CSS-only tasks for qwen)
- Contribution visualization exists but could be richer (percentage bar per agent)

### T14.1 — Single-model-at-a-time Ollama scheduling
**Priority:** Critical | **Effort:** Medium

On 16GB Mac Mini, loading deepseek (16B, ~9GB) + qwen (9B, ~5GB) simultaneously = swap thrash. The system must enforce one loaded model at a time.

Implementation in `models.py`:

1. Track which model is currently loaded:
   ```python
   _loaded_model: str | None = None
   ```

2. Before each Ollama call, unload the previous model if different:
   ```python
   async def _ensure_model_loaded(model_name: str) -> None:
       global _loaded_model
       if _loaded_model and _loaded_model != model_name:
           # Unload previous model by setting keep_alive to 0
           await _http_client.post(f"{OLLAMA_BASE}/api/generate", json={
               "model": _loaded_model, "keep_alive": "0"
           })
           logging.info("Unloaded %s before loading %s", _loaded_model, model_name)
       _loaded_model = model_name
   ```

3. Call `_ensure_model_loaded()` inside `stream_ollama()` and `_ollama_json_call()` before the API request.

4. Add config toggle: `SINGLE_MODEL_MODE: bool = _bool("SINGLE_MODEL_MODE", True)` — can be disabled on machines with 32GB+.

### T14.2 — Smart task decomposition for local LLMs
**Priority:** High | **Effort:** Medium

Local LLMs (9B, 16B) are most accurate on focused tasks with clear inputs/outputs. Modify `claude_plan_project()` to:

1. Add explicit guidance to Claude's planning prompt:
   ```
   LOCAL LLM TASK SIZING RULES:
   - Each task description must be SELF-CONTAINED — include all necessary context
   - Target ~200 lines of output maximum per task
   - Break complex features into separate tasks:
     BAD:  "Create game.js with board, pieces, rotation, collision, scoring, and game loop"
     GOOD: Task 1: "Create game.js with board rendering and piece definitions"
           Task 2: "Add rotation, collision detection, and piece movement to game.js"
           Task 3: "Add scoring system, level progression, and game over logic to game.js"
   - Each task must list the COMPLETE function signatures, DOM IDs, and variable names
     the agent must use — local LLMs cannot infer undocumented interfaces

   TASK COMPLEXITY BUDGET:
   - Simple (1 concept): 1 task — counter, clock, form
   - Medium (2-3 concepts): 2-3 tasks — snake (board + controls + scoring)
   - Complex (4+ concepts): 4-6 tasks — RPG (world + combat + inventory + UI + NPCs)
   ```

2. Add a post-planning validation step:
   ```python
   async def _validate_task_granularity(tasks: list[dict], goal: str) -> list[dict]:
       """Ask Claude to review if any task is too large for a local LLM."""
       # Check if any task description > 500 chars (proxy for complexity)
       big_tasks = [t for t in tasks if len(t.get("description", "")) > 500]
       if not big_tasks:
           return tasks
       # Ask Claude to split oversized tasks
       ...
   ```

### T14.3 — Dynamic role assignment
**Priority:** High | **Effort:** Medium

When agents are toggled online/offline, the system should fully adapt roles — not just reroute at task execution time but restructure the entire approach:

**Role matrix:**

| Online agents | CEO (planner/evaluator) | Worker(s) | Strategy |
|--------------|------------------------|-----------|----------|
| Claude + deepseek + qwen | Claude | deepseek (code), qwen (CSS) | Current default |
| Claude + deepseek | Claude | deepseek (all) | Skip CSS-only tasks |
| Claude + qwen | Claude | qwen (all) | qwen becomes primary coder |
| Claude only | Claude | Claude | Claude does everything (expensive) |
| deepseek + qwen | deepseek | deepseek (code), qwen (CSS) | deepseek = CEO via master_model |
| deepseek only | deepseek | deepseek | deepseek plans + executes (all-in-one) |
| qwen only | qwen | qwen | qwen plans + executes (all-in-one) |

Implementation:
1. Replace hardcoded role strings in `claude_plan_project()` with a `_build_role_matrix()` function:
   ```python
   def _build_role_matrix() -> dict:
       enabled = set(_get_enabled_agents())
       claude_up = "claude" in enabled
       roles = {}
       local_agents = [a for a in enabled if a != "claude"]

       if claude_up:
           roles["ceo"] = "claude"
           if not local_agents:
               roles["workers"] = ["claude"]  # Claude does everything
           else:
               roles["workers"] = local_agents
       else:
           # First available local model becomes CEO
           roles["ceo"] = local_agents[0] if local_agents else None
           roles["workers"] = local_agents

       # Designate primary coder and CSS specialist
       if "deepseek" in local_agents:
           roles["primary_coder"] = "deepseek"
       elif "qwen35" in local_agents:
           roles["primary_coder"] = "qwen35"
       roles["css_specialist"] = "qwen35" if "qwen35" in local_agents else roles.get("primary_coder")

       return roles
   ```

2. Feed role matrix into planning prompt dynamically.
3. When only 1 local model is available, set `KEEP_ALIVE="60m"` for that model (no unload/reload overhead).

### T14.4 — Sequential model execution with preloading
**Priority:** Medium | **Effort:** Small

When tasks are planned for multiple local models (e.g., deepseek for code, qwen for CSS):

1. **Group tasks by model** instead of just by dependency wave:
   ```python
   def _group_by_model_then_wave(waves: list[list[dict]]) -> list[list[dict]]:
       """Reorder waves so all deepseek tasks run first, then all qwen tasks.
          Respects dependency ordering within each model group."""
   ```

2. **Unload after model group completes**, not after each task.

3. **Notify user**: `{"type": "orch_phase", "phase": "model_switch", "msg": "Switching from deepseek to qwen35..."}`

This avoids 4-5 model swaps in a 6-task project. Instead: load deepseek → run 4 tasks → unload → load qwen → run 2 tasks → done.

### T14.5 — Enhanced contribution visualization
**Priority:** High | **Effort:** Small

The stats card already shows per-agent rows. Enhance to match the user's vision:

1. **Percentage contribution bar with 3 colors:**
   ```javascript
   // In appendStatsCard():
   // Calculate percentage by tokens processed
   const agentPcts = {};
   agents.forEach(agent => {
       const d = byAgent[agent];
       const tot = (d.input_tokens||0) + (d.output_tokens||0);
       agentPcts[agent] = totalTok > 0 ? Math.round((tot / totalTok) * 100) : 0;
   });

   // Render: ████████████░░░░░████████
   //         Claude 10%    Qwen 55%  DeepSeek 35%
   ```

2. **Color scheme:**
   - Claude: `#f59e0b` (amber/gold — expensive, use sparingly)
   - DeepSeek: `#60a5fa` (blue — primary coder)
   - Qwen: `#34d399` (green — CSS specialist)

3. **Below the bar**: label with `Claude 10% · Qwen 55% · DeepSeek 35%`

4. **Cost savings callout** (already exists, enhance):
   ```
   💰 85% handled locally — saved ~$0.12 vs all-Claude
   ⚡ Model switches: 1 (deepseek → qwen35)
   ```

5. **Store contribution stats in project DB** for the quality dashboard (T8.8):
   - Add `stats_json TEXT` column to projects table
   - Write `OrchStats.to_summary()` on project completion

### T14.6 — Adaptive task complexity based on model capability
**Priority:** Medium | **Effort:** Medium

Different models handle different complexity levels. Track and adapt:

1. **Model capability scores** (initial, refined by feedback loop):
   ```python
   MODEL_CAPABILITY = {
       "claude":   {"max_output_lines": 800, "accuracy_pct": 95, "cost_per_1k": 0.015},
       "deepseek": {"max_output_lines": 300, "accuracy_pct": 75, "cost_per_1k": 0.0},
       "qwen35":   {"max_output_lines": 200, "accuracy_pct": 70, "cost_per_1k": 0.0},
   }
   ```

2. **In planning prompt**, tell Claude the limits:
   ```
   MODEL CAPABILITIES:
   - deepseek: reliable up to ~300 lines, struggles with complex game logic
   - qwen35: reliable up to ~200 lines, excellent at CSS/styling
   Plan tasks so each stays within the assigned model's capability range.
   ```

3. **Update capability scores from feedback loop** (T8.3 agent profiles):
   - If deepseek fails 3x on "rotation logic" → lower its accuracy for game tasks
   - If qwen succeeds consistently at full-page CSS → increase its max_output_lines

### T14.7 — Model warm-up and readiness check
**Priority:** Low | **Effort:** Small

Before starting a build, verify the assigned models are actually loaded and warm:

```python
async def _warmup_model(model_name: str) -> bool:
    """Send a tiny generation request to ensure model is loaded and warm."""
    try:
        r = await _http_client.post(
            f"{OLLAMA_BASE}/api/generate",
            json={"model": model_name, "prompt": "Hi", "stream": False,
                  "options": {"num_predict": 1}},
            timeout=60.0  # first load can take 30-60s on 16GB
        )
        return r.status_code == 200
    except Exception:
        return False
```

Call during orchestration before first task:
```python
await ws.send_json({"type": "orch_phase", "phase": "warmup",
                    "msg": f"Loading {model_name}..."})
```

Show loading progress to user so they know why there's a delay.

---

## Recommended Execution Order

```
PHASE 8 — Feedback Loop (the core differentiator)
 1. T8.1  — "done" intent detection (small, unlocks everything)
 2. T8.7  — Fix history JSON storage (needed by T8.2)
 3. T8.2  — close_project_thread() deep analysis
 4. T8.3  — Agent behavior profiling
 5. T8.5  — Semantic lesson retrieval
 6. T8.4  — Dynamic skill mutation
 7. T8.6  — Lesson extraction on successful builds
 8. T8.8  — Quality dashboard

PHASE 9 — Evaluator Hardening
 8. T9.1  — Fix timeout auto-approve
 9. T9.2  — Expand evaluation checklist
10. T9.3  — Structured evaluation result
11. T9.4  — Retry budget with escalation
12. T9.5  — Cascading failure detection

PHASE 10 — Frontend Polish
13. T10.1 — system_alert toast handler
14. T10.2 — project_finalized message UI
15. T10.5 — Error toast on API failures
16. T10.4 — File viewer content pane
17. T10.3 — Inline fix feedback context
18. T10.6 — Loading states
19. T10.7 — Keyboard shortcuts

PHASE 11 — Automated QA
20. T11.1 — JS syntax validation (node --check)
21. T11.2 — HTML validation
22. T11.4 — Cross-file reference validation
23. T11.6 — Integrate QA into evaluation
24. T11.5 — Project smoke-open test
25. T11.3 — CSS validation

PHASE 12 — Testing
26. T12.1 — Unit tests: files_io.py
27. T12.2 — Unit tests: orchestration.py
28. T12.5 — Integration test harness
29. T12.3 — Unit tests: models.py
30. T12.4 — Unit tests: db.py
31. T12.6 — Pre-commit test hook
32. T12.7 — CI configuration

PHASE 13 — Scalability (after core is solid)
33. T13.1 — Per-project WS subscriptions
34. T13.2 — Concurrent build queue
35. T13.3 — DB pagination
36. T13.4 — Project-level isolation
37. T13.5 — Session management

PHASE 14 — Smart Model Orchestration (run early — high impact)
38. T14.1 — Single-model-at-a-time Ollama scheduling (Critical — prevents OOM)
39. T14.3 — Dynamic role assignment matrix
40. T14.5 — Enhanced contribution visualization (percentage bar)
41. T14.2 — Smart task decomposition for local LLMs
42. T14.4 — Sequential model execution with grouping
43. T14.6 — Adaptive task complexity per model
44. T14.7 — Model warm-up and readiness check
```

**Priority override:** Phase 14 tasks T14.1 and T14.3 should be implemented EARLY (before Phase 9) because they directly prevent OOM crashes and improve output quality on 16GB hardware. Recommended insertion point: after T8.1–T8.2 in Phase 8.

---

## The Self-Improving Flywheel

```
   User: "create tetris game"
       │
       ▼
   Claude plans tasks ◄── Relevant lessons (T8.5)
       │                   + Agent profile warnings (T8.3)
       ▼
   Workers execute ◄── Skills with auto-learned rules (T8.4)
       │                + Agent-specific weakness warnings (T8.3)
       ▼
   Evaluator checks ◄── Strict checklist (T9.2) + QA pipeline (T11)
       │
       ▼
   User tests at /play/tetris/
       │
       ▼                          ┌─────────────────────────┐
   User: "pieces don't rotate" ──►  run_fix_task()          │
       │                          │  fix → extract lesson   │
       ▼                          │  record to fix_history  │
   User: "score doesn't update" ──►  run_fix_task() again   │
       │                          │  fix → extract lesson   │
       ▼                          └─────────────────────────┘
   User: "looks great, thanks!"
       │
       ▼
   detect_intent: "done" (T8.1)
       │
       ▼
   close_project_thread() (T8.2)
       │
       ├── Analyze FULL build+fix history
       │   "deepseek missed rotation logic, pattern seen 3x in games"
       │
       ├── Update agent_profiles.md (T8.3)
       │   "deepseek: misses game mechanics — 3 occurrences"
       │
       ├── Patch skills/game-development.md (T8.4)
       │   "+ Always implement ALL game mechanics in task description"
       │
       └── NEXT GAME PROJECT BENEFITS AUTOMATICALLY
```

---

## Metrics to Track

| Metric | Source | Target |
|--------|--------|--------|
| First-try approval rate | tasks table | > 80% |
| Fix cycles per project | fix_history.json | < 2.0 (trending down) |
| Projects finalized (user said "done") | projects table | > 70% of completed |
| Agent-specific failure rate | agent_profiles.md | Declining per agent |
| Skill mutation revert rate | skill_mutations.log | < 10% |
| Build success rate (no errors) | projects table | > 90% |
| QA pass rate (T11 checks) | evaluation_json | > 95% |
| Avg fix cycles for game projects | fix_history.json | Track genre-specific |
| Local token % per project | stats_json | > 80% (minimize Claude usage) |
| Model swaps per build | OrchStats | ≤ 1 per build |
| Claude cost per project | tasks table | Trending down as local models improve |
| OOM/swap incidents | system logs | 0 (T14.1 should eliminate) |
