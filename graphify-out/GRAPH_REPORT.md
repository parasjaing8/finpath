# Graph Report - .  (2026-04-14)

## Corpus Check
- 11 files · ~32,104 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 311 nodes · 441 edges · 41 communities detected
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 49 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]

## God Nodes (most connected - your core abstractions)
1. `OrchStats` - 59 edges
2. `_db_connect()` - 20 edges
3. `run_orchestration()` - 11 edges
4. `ws_endpoint()` - 9 edges
5. `_build_worker_system()` - 8 edges
6. `claude_plan_project()` - 7 edges
7. `append_lesson()` - 6 edges
8. `write_project_context()` - 6 edges
9. `close_project_thread()` - 6 edges
10. `run_fix_task()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `AI Group Chat Server + Multi-Agent Development Platform Runs on Mac Mini (192.16` --uses--> `OrchStats`  [INFERRED]
  server.py → models.py
- `Return True when auth is disabled, or when the token is valid.` --uses--> `OrchStats`  [INFERRED]
  server.py → models.py
- `Return the union of all connected WebSocket clients.` --uses--> `OrchStats`  [INFERRED]
  server.py → models.py
- `Move a WebSocket to a new subscription bucket, removing from any old one.` --uses--> `OrchStats`  [INFERRED]
  server.py → models.py
- `Remove a disconnected WebSocket from all subscription buckets.` --uses--> `OrchStats`  [INFERRED]
  server.py → models.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (42): _acquire_build_slot(), admin_dashboard(), admin_exec(), admin_quality(), admin_revert_mutation(), admin_skill_mutations(), _agent_in_use(), api_create_project() (+34 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (36): OrchStats, Increment model switch counter (called by T14.4 sequential execution)., Tracks token usage and timing across an orchestration / fix run., Orchestration — intent detection, planning, evaluation, execution, memory/lesson, T11.4: Cross-file reference validation. Returns list of warning strings (not har, T11.5: Verify the project serves at its /play/ URL and all referenced resources, T11.6: Full QA pipeline — static checks, cross-file refs, optional smoke test., Write (or overwrite) PROJECT_CONTEXT.md with current project state.      Capture (+28 more)

### Community 2 - "Community 2"
Cohesion: 0.1
Nodes (44): _agent_profiles_path(), _append_fix_history(), append_lesson(), _build_role_matrix(), _build_worker_system(), _claude_classify(), claude_evaluate_task(), claude_plan_project() (+36 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (30): build_claude_messages(), build_ollama_messages(), check_ollama_online(), close_http_client(), configure(), _ensure_model_loaded(), _estimate_tokens(), fetch_model_info() (+22 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (31): configure(), create_project(), _db_connect(), get_all_tasks(), get_last_project_goal(), get_pending_tasks(), get_project(), get_resumable_tasks() (+23 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (19): apply_filename_hints(), extract_files_from_response(), git_commit(), infer_files_from_codeblocks(), list_project_files(), File I/O, Git operations, and devlog helpers., Normalise a filename coming from LLM output.      - Strips leading ``src/`` pref, Fallback when extract_files_from_response returns empty.     Matches fenced code (+11 more)

### Community 6 - "Community 6"
Cohesion: 0.25
Nodes (8): _all_ws_clients(), _broadcast_global(), _broadcast_to_project(), Return the union of all connected WebSocket clients., Remove a disconnected WebSocket from all subscription buckets., Send a JSON payload to every connected WebSocket client (system alerts)., Send a JSON payload only to clients subscribed to project_id., _ws_disconnect()

### Community 7 - "Community 7"
Cohesion: 0.33
Nodes (1): Centralized configuration for ai-chat platform.  All tunable values live here. E

### Community 8 - "Community 8"
Cohesion: 0.4
Nodes (5): load_skills(), _parse_frontmatter(), Skills system — keyword-based skill injection into worker prompts., Parse YAML-style frontmatter (---...---) and return (meta, body).      Reads o, Load skill content whose keywords match the given context string.      Each sk

### Community 9 - "Community 9"
Cohesion: 0.67
Nodes (1): Watch-only monitor — connects to existing in-progress build.

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (0): 

### Community 11 - "Community 11"
Cohesion: 1.0
Nodes (0): 

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "Community 13"
Cohesion: 1.0
Nodes (1): Apply any pending migrations sequentially.

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (1): Reset any in_progress tasks back to pending. Returns count reset.

### Community 15 - "Community 15"
Cohesion: 1.0
Nodes (1): Return pending tasks for a project (for resume). Resets stuck in_progress first.

### Community 16 - "Community 16"
Cohesion: 1.0
Nodes (1): Retrieve the first user message in a project (the original goal).

### Community 17 - "Community 17"
Cohesion: 1.0
Nodes (1): Drain the shared HTTP connection pool. Call once at server shutdown.

### Community 18 - "Community 18"
Cohesion: 1.0
Nodes (1): Called once from server.py to inject shared state references.

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (1): Tracks token usage and timing across an orchestration / fix run.

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (1): Return size/quant metadata from Ollama /api/show.  Cached for 5 minutes.

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (1): Return True if Ollama is reachable. Result is cached for 30 seconds.

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (1): Background coroutine: ping Ollama every 30 s and log state changes.

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (1): Rough token count using chars/4 heuristic. Good enough for overflow guard.

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (1): Drop oldest non-system messages until estimated token count fits max_tokens.

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (1): Route a structured JSON call to the active master model.     Claude -> Claude AP

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (1): Route a free-form text generation call to the active master model.

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (1): Stream from the active master model (Claude or local master agent).

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (1): Fallback when extract_files_from_response returns empty.     Matches fenced code

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (1): Rename generic filenames produced by the bare-block fallback     (js/main.js, st

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (1): Write files to project folder_path/src/, returns list of relative paths written.

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (1): Return relative paths of all files in src/ without reading their contents.

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (1): Return {relative_path: content} for files in src/.     If `paths` is given, only

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (1): Commit all changes. Git errors are logged and written to the project devlog.

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (1): Benchmark: qwen2.5-coder:7b vs deepseek-coder-v2:16b-lite-instruct-q5_K_S  Runs

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (1): Programmatic orchestration test — creates a project via REST, then triggers orch

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (1): Model Comparison — single coding task, 4 models, Claude-as-judge scoring.  Model

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (1): Returns (output, elapsed_seconds, output_chars)

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (1): Returns (output, elapsed_seconds, output_chars)

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (1): Ask Claude to score the output. Returns the score dict.

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (1): Pull the HTML block out of model output.

## Knowledge Gaps
- **75 isolated node(s):** `Database layer — SQLite operations for messages, projects, and tasks.`, `Called once from server.py to inject path configuration.`, `Return a SQLite connection with WAL mode, timeout, and optimised sync.`, `Apply any pending migrations sequentially.`, `T14.5: Persist OrchStats summary JSON to the projects table.` (+70 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 10`** (2 nodes): `build()`, `test_game_build.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (2 nodes): `build()`, `test_qwen_calc.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (2 nodes): `monitor_build.py`, `run_build()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (1 nodes): `Apply any pending migrations sequentially.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (1 nodes): `Reset any in_progress tasks back to pending. Returns count reset.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (1 nodes): `Return pending tasks for a project (for resume). Resets stuck in_progress first.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (1 nodes): `Retrieve the first user message in a project (the original goal).`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (1 nodes): `Drain the shared HTTP connection pool. Call once at server shutdown.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (1 nodes): `Called once from server.py to inject shared state references.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (1 nodes): `Tracks token usage and timing across an orchestration / fix run.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (1 nodes): `Return size/quant metadata from Ollama /api/show.  Cached for 5 minutes.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (1 nodes): `Return True if Ollama is reachable. Result is cached for 30 seconds.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (1 nodes): `Background coroutine: ping Ollama every 30 s and log state changes.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (1 nodes): `Rough token count using chars/4 heuristic. Good enough for overflow guard.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (1 nodes): `Drop oldest non-system messages until estimated token count fits max_tokens.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (1 nodes): `Route a structured JSON call to the active master model.     Claude -> Claude AP`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (1 nodes): `Route a free-form text generation call to the active master model.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `Stream from the active master model (Claude or local master agent).`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `Fallback when extract_files_from_response returns empty.     Matches fenced code`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `Rename generic filenames produced by the bare-block fallback     (js/main.js, st`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `Write files to project folder_path/src/, returns list of relative paths written.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `Return relative paths of all files in src/ without reading their contents.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `Return {relative_path: content} for files in src/.     If `paths` is given, only`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `Commit all changes. Git errors are logged and written to the project devlog.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `Benchmark: qwen2.5-coder:7b vs deepseek-coder-v2:16b-lite-instruct-q5_K_S  Runs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `Programmatic orchestration test — creates a project via REST, then triggers orch`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `Model Comparison — single coding task, 4 models, Claude-as-judge scoring.  Model`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `Returns (output, elapsed_seconds, output_chars)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `Returns (output, elapsed_seconds, output_chars)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `Ask Claude to score the output. Returns the score dict.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `Pull the HTML block out of model output.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `OrchStats` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`, `Community 6`?**
  _High betweenness centrality (0.319) - this node is a cross-community bridge._
- **Why does `Orchestration — intent detection, planning, evaluation, execution, memory/lesson` connect `Community 1` to `Community 2`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Why does `_TokenBucket` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Are the 49 inferred relationships involving `OrchStats` (e.g. with `_JsonFormatter` and `_TokenBucket`) actually correct?**
  _`OrchStats` has 49 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Database layer — SQLite operations for messages, projects, and tasks.`, `Called once from server.py to inject path configuration.`, `Return a SQLite connection with WAL mode, timeout, and optimised sync.` to the rest of the system?**
  _75 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._