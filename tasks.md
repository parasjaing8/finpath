# AI-Chat Platform — Audit & Task Plan

> Generated: 2026-04-14 | Status: **Phase 1 Complete**
> Scope: All files except `projects/` folder

---

## Executive Summary

**ai-chat** is a multi-agent AI development platform running on a Mac Mini (Apple Silicon). It orchestrates Claude (cloud), DeepSeek 16B, and Qwen 9B (local via Ollama) to collaboratively plan and build web projects via a FastAPI + WebSocket server with a dark-themed web UI.

**Current state:** Functional prototype, ~4K lines Python + ~2K lines JS/CSS/HTML, flat file structure, no `.gitignore`, 40+ hardcoded values, no unit tests, no CI, moderate security gaps.

---

## Architecture (Current)

```
server.py (1100 LOC) ─── FastAPI, WebSocket, REST, backup, static files
orchestration.py (850 LOC) ─── intent detection, task planning, DAG execution, evaluation
models.py (600 LOC) ─── Claude API, Ollama routing, streaming, token tracking
db.py (350 LOC) ─── SQLite (messages, projects, tasks), migrations
files_io.py (450 LOC) ─── file extraction from LLM output, Git, devlog
skills_mod.py (50 LOC) ─── keyword-based skill injection
```

Supporting: `modelcomp.py`, `benchmark.py`, `smoke_qwen35.py`, `test_orchestration.py`
Frontend: `static/app.js` (1000 LOC), `static/app.css` (900 LOC), `static/index.html`
Config: `AGENT_RULES.md`, `SYSTEM_KB.md`, `custom_agents.json`, `.env`

---

## PHASE 1 — Codebase Structure & Copilot Instructions
> Goal: Transform flat layout into a maintainable, navigable project with proper documentation and AI-assistant context files.

### T1.1 — Create structured directory layout ✅ DONE
**Priority:** Critical | **Effort:** Medium

Reorganize from flat structure to:
```
ai-chat/
├── .copilot/
│   └── copilot-instructions.md      # Copilot context for this project
├── .github/
│   └── copilot-instructions.md      # GitHub Copilot instructions (repo-level)
├── docs/
│   ├── ARCHITECTURE.md              # System architecture & data flow
│   ├── DEPLOYMENT.md                # Mac Mini setup, start.sh, systemd
│   ├── API.md                       # REST + WebSocket endpoint reference
│   └── CHANGELOG.md                 # Version history
├── kb/                              # Knowledge base (rename from current MD files)
│   ├── AGENT_RULES.md               # Agent behavior rules (move from root)
│   └── SYSTEM_KB.md                 # Hardware/network facts (move from root)
├── logs/                            # Runtime logs (gitignored)
├── memory/                          # Lessons system (keep as-is)
│   └── universal_lessons.md
├── skills/                          # Skill definitions (keep as-is)
├── static/                          # Frontend (keep as-is)
├── src/                             # Python source (NEW — move core modules here)
│   ├── __init__.py
│   ├── server.py
│   ├── orchestration.py
│   ├── models.py
│   ├── db.py
│   ├── files_io.py
│   ├── skills_mod.py
│   └── config.py                    # NEW — centralized configuration
├── tests/                           # Test suite (NEW — move test files here)
│   ├── test_orchestration.py
│   ├── benchmark.py
│   ├── modelcomp.py
│   └── smoke_qwen35.py
├── backups/                         # DB + memory backups (gitignored)
├── projects/                        # Generated projects (gitignored)
├── .env                             # Secrets (gitignored)
├── .env.example
├── .gitignore                       # NEW
├── requirements.txt
├── start.sh
├── tasks.md                         # This file
└── README.md                        # NEW — project overview
```

**Decision needed:** Moving modules to `src/` requires updating all imports. Alternative: keep flat but add `docs/`, `kb/`, `tests/` folders only. **Recommend the simpler approach first** — just add new folders, move test/benchmark files, and keep core Python files at root to avoid import churn.

### T1.2 — Create `.gitignore` ✅ DONE
**Priority:** Critical | **Effort:** Small

Must ignore:
```
.env
chat.db
chat.db-wal
chat.db-shm
__pycache__/
*.pyc
.venv/
backups/
projects/
logs/
*.log
.DS_Store
graphify-out/
```

### T1.3 — Create Copilot instructions ✅ DONE
**Priority:** High | **Effort:** Medium

Create `.github/copilot-instructions.md` with:
- Project overview and purpose
- Architecture summary
- Tech stack (FastAPI, SQLite, httpx, Ollama, Claude API)
- Key conventions (WebSocket streaming, task DAG, file extraction patterns)
- Code style preferences
- Testing approach
- Common workflows

### T1.4 — Create `docs/ARCHITECTURE.md` ✅ DONE
**Priority:** High | **Effort:** Medium

Document:
- System architecture diagram (ASCII/Mermaid)
- Data flow: user message → intent detection → planning → task execution → evaluation
- Module dependency graph
- Database schema
- WebSocket message protocol
- Skill injection pipeline
- Memory/lessons system

### T1.5 — Create `README.md` ✅ DONE
**Priority:** High | **Effort:** Small

Project overview, quick start, prerequisites, architecture link.

### T1.6 — Create `docs/API.md` ✅ DONE
**Priority:** Medium | **Effort:** Medium

Document all REST endpoints and WebSocket message types from `server.py`.

### T1.7 — Create `config.py` (centralized configuration) ✅ DONE
**Priority:** High | **Effort:** Medium

Extract hardcoded values into a single config module:

| Value | Current Location | Default |
|-------|-----------------|---------|
| `CONTEXT_LEN` | server.py, orchestration.py | 20 |
| `DISPLAY_LEN` | server.py, db.py | 60 |
| `PLAY_HOST` | server.py | "192.168.0.130:8080" |
| `OLLAMA_BASE` | models.py | "http://localhost:11434" |
| `KEEP_ALIVE` | models.py | "10m" |
| `CLAUDE_COST_INPUT_PER_M` | models.py | 3.0 |
| `CLAUDE_COST_OUTPUT_PER_M` | models.py | 15.0 |
| `CLAUDE_TIMEOUT` | models.py | 120 |
| `OLLAMA_TIMEOUT` | models.py | 600 |
| `BACKUP_INTERVAL` | server.py | 86400 |
| `BACKUP_KEEP_COUNT` | server.py | 14 |
| `LOG_MAX_SIZE` | server.py | 10MB |
| `CACHE_TTL_OLLAMA` | models.py | 30 |
| `CACHE_TTL_MODEL_INFO` | models.py | 300 |
| `MODEL_CTX` | server.py | dict |
| `MODEL_PREDICT` | server.py | dict |
| `LESSON_SAMPLE_RATE` | orchestration.py | 3 |

All should be overridable via environment variables with sensible defaults.

### T1.8 — Investigate duplicate `index.html` ✅ DONE
**Priority:** Medium | **Effort:** Small

**Finding:** Root `index.html` was a stale copy never served by the server (`GET /` always returns `static/index.html`). **Deleted** the root copy. `static/index.html` is canonical.

---

## PHASE 2 — Cleanup
> Goal: Remove dead weight, fix inconsistencies, standardize patterns.

### T2.1 — Deduplicate `CONTEXT_LEN` and `DISPLAY_LEN`
**Priority:** High | **Effort:** Small

Both constants are defined in multiple files (server.py, orchestration.py, db.py). After T1.7, all modules should import from `config.py`.

### T2.2 — Remove/archive old benchmark files ✅ DONE
**Priority:** Low | **Effort:** Small

`modelcomp.py`, `benchmark.py`, `smoke_qwen35.py` are one-off comparison scripts. Move to `tests/benchmarks/` folder to declutter root.

**Resolution:** Completed in Phase 1 — all benchmark files moved to `tests/` during directory restructure.

### T2.3 — Clean up `start.sh`
**Priority:** Medium | **Effort:** Small

Add:
- Error message if venv activation fails
- Log redirect to `logs/server.log`
- PID file for process management
- Graceful shutdown signal handling

### T2.4 — Standardize error handling patterns
**Priority:** Medium | **Effort:** Medium

Current inconsistencies:
- `orchestration.py` auto-approves tasks when evaluator crashes (`except Exception: return {"approved": True}`)
- `files_io.py` swallows git errors into devlog, caller can't detect failure
- `models.py` has inconsistent timeouts (Claude: 120s, Ollama: 600s)

Define a consistent pattern: log + propagate or log + return error object.

### T2.5 — Fix connection pooling
**Priority:** Medium | **Effort:** Small

`server.py` creates new `httpx.AsyncClient()` per request. Create a shared client with connection pooling at app startup, close on shutdown.

### T2.6 — Clean up `requirements.txt`
**Priority:** Low | **Effort:** Small

Add missing implicit dependencies:
- `websockets` (required by FastAPI WebSocket)
- Pin all transitive dependencies or add `requirements-dev.txt` for test deps

---

## PHASE 3 — Bugs & Security Issues
> Goal: Fix actual bugs and security vulnerabilities found during audit.

### T3.1 — Fix path traversal in `files_io.py`
**Priority:** Critical | **Effort:** Small

**Bug:** Filename sanitization strips `src/` prefix but doesn't fully block `../../etc/passwd`.
```python
if filename.startswith('src/'):
    filename = filename[4:]
```
**Fix:** Use `pathlib.Path.resolve()` + `relative_to()` to ensure all paths stay within project directory. Add explicit check and reject any path containing `..`.

### T3.2 — Fix race condition in agent registry
**Priority:** High | **Effort:** Small

`_load_custom_agents()` and REST add endpoint both modify `OLLAMA_MODELS` dict without lock. Add `asyncio.Lock` around all agent registry modifications.

### T3.3 — Fix evaluator crash = auto-approve
**Priority:** High | **Effort:** Small

In `orchestration.py`, if `claude_evaluate_task()` throws, the task is silently approved:
```python
except Exception:
    return {"approved": True}
```
**Fix:** Return `{"approved": False, "error": str(e)}` and retry evaluation once. If second attempt fails, flag task for human review.

### T3.4 — Fix DAG cycle handling
**Priority:** Medium | **Effort:** Small

Currently falls back to sequential execution with warning. Should either:
- Fail hard with clear error message, or
- Remove cyclic edges and warn which dependencies were dropped

### T3.5 — Add rate limiting on WebSocket
**Priority:** Medium | **Effort:** Small

No protection against message flooding. Add per-connection rate limit (e.g., 10 messages/second).

### T3.6 — Fix file size limits
**Priority:** Medium | **Effort:** Small

No limit on files written by `write_project_files()`. LLM could generate extremely large output. Cap at reasonable limit (e.g., 1MB per file, 10MB per project).

### T3.7 — Sanitize LLM output before streaming to browser
**Priority:** Medium | **Effort:** Small

Model output is streamed directly to WebSocket client. If model outputs raw `<script>` tags outside code blocks, they could execute. Ensure `escHtml()` in `app.js` covers all rendering paths.

### T3.8 — Add DB indexes for common queries
**Priority:** Low | **Effort:** Small

Add indexes on:
- `project_messages(project_id)`
- `tasks(project_id, status)`
- `messages(role)` (if queried)

---

## PHASE 4 — Improvements
> Goal: Enhance reliability, performance, and observability.

### T4.1 — Add `/health` endpoint ⚠️ PARTIAL
**Priority:** High | **Effort:** Small

**Finding:** A basic `/health` endpoint already exists in `server.py` (returns `ok`, `uptime_s`, `db`). Needs enhancement to add:
- Ollama online/offline status
- Disk space available
- Last backup timestamp
- Claude API reachable

### T4.2 — Add structured logging
**Priority:** Medium | **Effort:** Medium

Replace ad-hoc `logging.info()` calls with structured JSON logging. Include:
- Request ID
- Project slug
- Task ID
- Model name
- Duration
- Token usage

### T4.3 — Add WebSocket reconnection backoff
**Priority:** Medium | **Effort:** Small

Frontend reconnects every 3s. Add exponential backoff (3s → 6s → 12s → max 60s), reset on successful connection.

### T4.4 — Allow parallel Ollama requests
**Priority:** Medium | **Effort:** Small

Current `_ollama_lock = asyncio.Semaphore(1)` serializes all Ollama calls. On M-series with ample memory, increase to `Semaphore(2)` (configurable via config.py).

### T4.5 — Add context window overflow protection
**Priority:** High | **Effort:** Medium

No check that message history exceeds model's context window. Before API call:
- Estimate token count (rough: chars/4)
- Truncate oldest messages if over limit
- Log truncation warning

### T4.6 — Improve skill matching
**Priority:** Low | **Effort:** Small

Current keyword matching is loose. Enhance:
- Support YAML frontmatter (---...---) instead of just `keywords:` line
- Add skill priority (avoid injecting 5 skills when 1 is enough)
- Deduplicate overlapping skills

### T4.7 — Add cost trending to stats
**Priority:** Low | **Effort:** Medium

Track per-project and daily API costs in DB. Surface in `/stats` endpoint and UI.

### T4.8 — Add log rotation
**Priority:** Medium | **Effort:** Small

`app.log` grows unbounded. Add `RotatingFileHandler` (already partially set up with 10MB max, but verify backupCount is set).

---

## PHASE 5 — Skills & Master Prompts (Claude Code Integration)
> Goal: Extract powerful prompting patterns from Claude Code ecosystem to enhance the ai-chat orchestration.

### T5.1 — Research and adapt Claude Code's master system prompt
**Priority:** High | **Effort:** Medium

Key patterns to adopt from Claude Code's approach:
- **Tool-use discipline:** Structured rules for when/how agents should use tools (read before write, gather context before acting)
- **Implementation discipline:** "Don't add features beyond what was asked", "Only validate at system boundaries"
- **Operational safety:** Reversible actions freely, destructive actions need confirmation
- **Memory system:** Session memory + persistent memory + repo memory (similar to existing lessons but more structured)
- **Parallel execution:** Independent read-only ops can be parallelized

Apply these principles to the system prompt templates in `orchestration.py`.

### T5.2 — Enhance agent rules with structured skill format
**Priority:** Medium | **Effort:** Medium

Current `AGENT_RULES.md` is free-form. Convert to structured format:
```yaml
---
name: agent-rules
applies_to: all_agents
priority: critical
---
```
Add versioning, conditional rules (e.g., game projects get touch-control rules, non-game projects don't).

### T5.3 — Add "think before acting" to orchestration
**Priority:** Medium | **Effort:** Medium

Claude Code's approach: before executing, gather context → plan → execute → validate. Enhance orchestration to:
- Have agents read existing project files before generating new code
- Cross-reference task output with project context
- Validate imports/references across files in evaluation

### T5.4 — Create per-project context files
**Priority:** Medium | **Effort:** Small

Auto-generate a `PROJECT_CONTEXT.md` in each project's folder after creation containing:
- Project goal and description
- Task list and status
- Key files and their roles
- Lessons learned during build

Feed this as context to agents during `project_continue` intent.

### T5.5 — Implement exploration agent pattern
**Priority:** Low | **Effort:** Medium

Add a lightweight "Explore" agent mode that only reads/searches project files without modifying. Useful for answering questions about existing projects without risk of corruption.

---

## PHASE 6 — Graphify Integration
> Goal: Build knowledge graph of the codebase to reduce token usage and improve AI navigation.

### T6.1 — Install graphify
**Priority:** High | **Effort:** Small

```bash
pip install graphifyy
graphify install
```

Add `graphifyy` to `requirements.txt`.

### T6.2 — Generate knowledge graph
**Priority:** High | **Effort:** Small

```bash
# Create .graphifyignore to exclude non-core files
cat > .graphifyignore << 'EOF'
projects/
backups/
static/
.venv/
__pycache__/
*.db
*.log
EOF

# Generate graph
graphify .
```

Output: `graphify-out/GRAPH_REPORT.md`, `graph.json`, `graph.html`, `cache/`

### T6.3 — Setup Copilot integration
**Priority:** High | **Effort:** Small

```bash
graphify copilot install
```

This installs a skill at `~/.copilot/skills/graphify/SKILL.md` so GitHub Copilot reads the graph before searching files.

### T6.4 — Setup Claude Code integration (if using)
**Priority:** Medium | **Effort:** Small

```bash
graphify claude install
```

Writes `CLAUDE.md` section + PreToolUse hook so Claude Code navigates via graph.

### T6.5 — Add graph rebuild to workflow
**Priority:** Medium | **Effort:** Small

Options:
- **Git hook:** `graphify hook install` — rebuilds on every commit
- **Watch mode:** `graphify . --watch` — auto-rebuild on save
- **Manual:** `graphify . --update` — only reprocess changed files

### T6.6 — Integrate graph into ai-chat's own pipeline (Future)
**Priority:** Low | **Effort:** Large

Long-term: feed `GRAPH_REPORT.md` as context to orchestration agents so they understand the ai-chat codebase structure when making modifications to it (meta-improvement).

### T6.7 — Add `graphify-out/` to `.gitignore`
**Priority:** High | **Effort:** Trivial

Keep `GRAPH_REPORT.md` and `graph.json` tracked, ignore `cache/` and `graph.html`.

---

## PHASE 7 — Health & Monitoring (Added per discussion)
> Goal: Operational visibility and reliability.

### T7.1 — Add `/health` endpoint
**Priority:** High | **Effort:** Small

(See T4.1 — combined here for sequencing.)

### T7.2 — Add Ollama offline alerting
**Priority:** Medium | **Effort:** Small

When `ollama_monitor()` detects Ollama offline for > 2 minutes, send a WebSocket notification to connected clients.

### T7.3 — Add request metrics
**Priority:** Low | **Effort:** Medium

Track per-endpoint:
- Request count
- Latency (p50, p95, p99)
- Error rate

Expose via `/stats` or Prometheus-compatible endpoint.

---

## Recommended Execution Order

```
1. T1.2  — .gitignore (protect secrets immediately)
2. T3.1  — Fix path traversal (security critical)
3. T3.3  — Fix evaluator auto-approve
4. T1.7  — Create config.py
5. T2.1  — Deduplicate constants (depends on T1.7)
6. T1.8  — Investigate duplicate index.html
7. T1.3  — Copilot instructions
8. T1.4  — Architecture docs
9. T1.5  — README
10. T1.1 — Directory restructure (after docs exist)
11. T2.2 — Archive benchmarks
12. T3.2 — Fix agent registry race
13. T3.4 — Fix DAG cycle handling
14. T2.5 — Connection pooling
15. T4.1 — Health endpoint
16. T4.5 — Context window protection
17. T6.1 — Install graphify
18. T6.2 — Generate knowledge graph
19. T6.3 — Copilot graphify setup
20. T6.4 — Claude Code graphify setup
21. T5.1 — Master prompt enhancement
22. T5.3 — Think-before-acting pattern
23. Remaining tasks by priority
```

---

## Audit Findings Summary

### Critical Issues
| # | Issue | File | Description |
|---|-------|------|-------------|
| 1 | Path traversal | files_io.py | Weak filename sanitization allows `../` |
| 2 | No .gitignore | (root) | `.env`, `chat.db`, backups exposed |
| 3 | Auto-approve on crash | orchestration.py | Evaluator exception = task approved |

### High Priority Issues
| # | Issue | File | Description |
|---|-------|------|-------------|
| 4 | Race condition | server.py | Agent registry modified without lock |
| 5 | 40+ hardcoded values | multiple | No centralized config |
| 6 | No context overflow check | models.py | History can exceed model context |
| 7 | No health endpoint | server.py | No way to monitor service health |
| 8 | Connection pooling | server.py | New httpx client per request |

### Medium Priority Issues
| # | Issue | File | Description |
|---|-------|------|-------------|
| 9 | DAG cycle = silent fallback | orchestration.py | Cycles cause sequential instead of error |
| 10 | No rate limiting | server.py | WebSocket message flooding possible |
| 11 | No file size limit | files_io.py | LLM could write unlimited files |
| 12 | Ollama 600s timeout | models.py | Hang when Ollama offline |
| 13 | Inconsistent error handling | multiple | Some swallow, some propagate, some auto-approve |
| 14 | No reconnection backoff | app.js | Reconnects every 3s flat |
| 15 | Log grows unbounded | server.py | No rotation/cleanup |
| 16 | Duplicate index.html | root + static/ | Potential confusion |

### Low Priority Issues
| # | Issue | File | Description |
|---|-------|------|-------------|
| 17 | No unit tests | (none) | Only integration/smoke tests |
| 18 | No type hints | multiple | No mypy/pydantic validation |
| 19 | Fragile skill matching | skills_mod.py | No YAML frontmatter, no priority |
| 20 | `<think>` block stripping fragile | models.py | Malformed XML could drop content |
| 21 | SYNCHRONOUS=NORMAL in SQLite | db.py | Could lose data on power failure |
| 22 | No cascade delete | db.py | Orphaned records possible |
