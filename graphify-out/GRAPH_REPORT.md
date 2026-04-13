# Graph Report - .  (2026-04-14)

## Corpus Check
- 7 files · ~18,477 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 195 nodes · 273 edges · 15 communities detected
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.5)
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

## God Nodes (most connected - your core abstractions)
1. `OrchStats` - 22 edges
2. `_db_connect()` - 19 edges
3. `run_orchestration()` - 7 edges
4. `_build_worker_system()` - 7 edges
5. `write_project_context()` - 6 edges
6. `load_project_context()` - 6 edges
7. `get_resumable_tasks()` - 5 edges
8. `_TokenBucket` - 5 edges
9. `_truncate_to_context()` - 5 edges
10. `read_project_lessons()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `AI Group Chat Server + Multi-Agent Development Platform Runs on Mac Mini (192.16` --uses--> `OrchStats`  [INFERRED]
  server.py → models.py
- `OrchStats` --uses--> `Orchestration — intent detection, planning, evaluation, execution, memory/lesson`  [INFERRED]
  models.py → orchestration.py
- `OrchStats` --uses--> `Read kb/AGENT_RULES.md once, strip YAML frontmatter, and cache the result.`  [INFERRED]
  models.py → orchestration.py
- `OrchStats` --uses--> `Write (or overwrite) PROJECT_CONTEXT.md with current project state.      Capture`  [INFERRED]
  models.py → orchestration.py
- `OrchStats` --uses--> `Return PROJECT_CONTEXT.md content, or empty string if not found.`  [INFERRED]
  models.py → orchestration.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (12): admin_exec(), _auto_generate_index(), _backup_scheduler(), execute_ssh(), get_master_model(), get_master_settings(), _load_custom_agents(), AI Group Chat Server + Multi-Agent Development Platform Runs on Mac Mini (192.16 (+4 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (28): append_lesson(), _build_worker_system(), _claude_classify(), claude_evaluate_task(), claude_plan_project(), claude_project_summary(), _count_project_lessons(), detect_intent() (+20 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (28): configure(), create_project(), _db_connect(), get_all_tasks(), get_last_project_goal(), get_pending_tasks(), get_project(), get_resumable_tasks() (+20 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (26): build_claude_messages(), build_ollama_messages(), check_ollama_online(), close_http_client(), configure(), _estimate_tokens(), fetch_model_info(), master_json_call() (+18 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (12): OrchStats, Tracks token usage and timing across an orchestration / fix run., _group_into_waves(), Detect and remove depends_on edges that form cycles using DFS.      Returns a (p, Group tasks into execution waves based on depends_on.      Tasks whose depends_o, _strip_cyclic_deps(), _JsonFormatter, Return True if the message is allowed, False if rate-limited. (+4 more)

### Community 5 - "Community 5"
Cohesion: 0.1
Nodes (17): apply_filename_hints(), extract_files_from_response(), git_commit(), infer_files_from_codeblocks(), list_project_files(), File I/O, Git operations, and devlog helpers., Normalise a filename coming from LLM output.      - Strips leading ``src/`` pref, Fallback when extract_files_from_response returns empty.     Matches fenced code (+9 more)

### Community 6 - "Community 6"
Cohesion: 0.4
Nodes (5): load_skills(), _parse_frontmatter(), Skills system — keyword-based skill injection into worker prompts., Parse YAML-style frontmatter (---...---) and return (meta, body).      Reads o, Load skill content whose keywords match the given context string.      Each sk

### Community 7 - "Community 7"
Cohesion: 0.4
Nodes (1): Centralized configuration for ai-chat platform.  All tunable values live here. E

### Community 8 - "Community 8"
Cohesion: 1.0
Nodes (1): Benchmark: qwen2.5-coder:7b vs deepseek-coder-v2:16b-lite-instruct-q5_K_S  Runs

### Community 9 - "Community 9"
Cohesion: 1.0
Nodes (1): Programmatic orchestration test — creates a project via REST, then triggers orch

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (1): Model Comparison — single coding task, 4 models, Claude-as-judge scoring.  Model

### Community 11 - "Community 11"
Cohesion: 1.0
Nodes (1): Returns (output, elapsed_seconds, output_chars)

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (1): Returns (output, elapsed_seconds, output_chars)

### Community 13 - "Community 13"
Cohesion: 1.0
Nodes (1): Ask Claude to score the output. Returns the score dict.

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (1): Pull the HTML block out of model output.

## Knowledge Gaps
- **39 isolated node(s):** `Database layer — SQLite operations for messages, projects, and tasks.`, `Called once from server.py to inject path configuration.`, `Return a SQLite connection with WAL mode, timeout, and optimised sync.`, `Apply any pending migrations sequentially.`, `Reset any in_progress tasks back to pending. Returns count reset.` (+34 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 8`** (1 nodes): `Benchmark: qwen2.5-coder:7b vs deepseek-coder-v2:16b-lite-instruct-q5_K_S  Runs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 9`** (1 nodes): `Programmatic orchestration test — creates a project via REST, then triggers orch`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 10`** (1 nodes): `Model Comparison — single coding task, 4 models, Claude-as-judge scoring.  Model`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (1 nodes): `Returns (output, elapsed_seconds, output_chars)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (1 nodes): `Returns (output, elapsed_seconds, output_chars)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (1 nodes): `Ask Claude to score the output. Returns the score dict.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (1 nodes): `Pull the HTML block out of model output.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `OrchStats` connect `Community 4` to `Community 0`, `Community 1`, `Community 3`?**
  _High betweenness centrality (0.295) - this node is a cross-community bridge._
- **Why does `Orchestration — intent detection, planning, evaluation, execution, memory/lesson` connect `Community 1` to `Community 4`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `_TokenBucket` connect `Community 4` to `Community 0`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Are the 13 inferred relationships involving `OrchStats` (e.g. with `_JsonFormatter` and `_TokenBucket`) actually correct?**
  _`OrchStats` has 13 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Database layer — SQLite operations for messages, projects, and tasks.`, `Called once from server.py to inject path configuration.`, `Return a SQLite connection with WAL mode, timeout, and optimised sync.` to the rest of the system?**
  _39 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._