"""Orchestration — intent detection, planning, evaluation, execution, memory/lessons."""
from __future__ import annotations
import asyncio
import hashlib
import json
import logging
import re
import textwrap
import time
from datetime import datetime, timezone
from pathlib import Path

from fastapi import WebSocket, WebSocketDisconnect

from db import (
    create_project, get_all_tasks, get_last_project_goal, get_project,
    get_resumable_tasks, list_projects, load_history, load_project_messages,
    reset_stuck_tasks, save_message, save_project_message, save_tasks,
    update_project_status, update_project_stats, update_task,
)
from files_io import (
    append_devlog, extract_files_from_response,
    infer_files_from_codeblocks, apply_filename_hints, git_commit,
    list_project_files, read_project_files, write_project_files,
)
from models import (
    CLAUDE_COST_INPUT_PER_M, CLAUDE_COST_OUTPUT_PER_M,
    OrchStats, build_claude_messages, check_claude_online,
    master_json_call, master_text_call, parse_mentions,
    stream_claude, stream_master, stream_ollama, warmup_model,
)
from skills_mod import load_skills

# Path to the agent rules knowledge-base file
_AGENT_RULES_PATH = Path(__file__).parent / "kb" / "AGENT_RULES.md"
# Cached content (None = not yet loaded)
_agent_rules_cache: str | None = None


def _load_agent_rules() -> str:
    """Read kb/AGENT_RULES.md once, strip YAML frontmatter, and cache the result."""
    global _agent_rules_cache
    if _agent_rules_cache is not None:
        return _agent_rules_cache
    try:
        raw = _AGENT_RULES_PATH.read_text(encoding="utf-8")
        # Strip YAML frontmatter block (---...---) if present
        body = re.sub(r"^---.*?---\s*\n", "", raw, flags=re.DOTALL)
        _agent_rules_cache = body.strip()
    except Exception:
        _agent_rules_cache = ""
    return _agent_rules_cache


# These are injected by server.py via configure()
SERVER_HOST: str = "192.168.0.130:8080"
MEMORY_DIR: Path = Path("memory")
CONTEXT_LEN: int = 20

# Callbacks injected from server.py
_get_master_model = lambda: "deepseek"
_is_claude_available = lambda: False
_get_enabled_agents = lambda: ["deepseek"]
_get_config = lambda: {}


def configure(*, server_host: str, memory_dir: Path, context_len: int,
              get_master_model, is_claude_available, get_enabled_agents,
              get_config) -> None:
    global SERVER_HOST, MEMORY_DIR, CONTEXT_LEN
    global _get_master_model, _is_claude_available, _get_enabled_agents, _get_config
    SERVER_HOST = server_host
    MEMORY_DIR = memory_dir
    CONTEXT_LEN = context_len
    _get_master_model = get_master_model
    _is_claude_available = is_claude_available
    _get_enabled_agents = get_enabled_agents
    _get_config = get_config


# ── Memory system ─────────────────────────────────────────────────────────────

def _universal_lessons_path() -> Path:
    return MEMORY_DIR / "universal_lessons.md"


def _lessons_path(project: dict) -> Path:
    return Path(project["folder_path"]) / "lessons.md"


def read_universal_lessons(limit: int = 8) -> str:
    p = _universal_lessons_path()
    if not p.exists():
        return ""
    lines = p.read_text(encoding="utf-8").strip().splitlines()
    lessons = [l for l in lines if l.startswith("- ")]
    return "\n".join(lessons[-limit:])


def read_project_lessons(project: dict, limit: int = 5) -> str:
    p = _lessons_path(project)
    if not p.exists():
        return ""
    lines = p.read_text(encoding="utf-8").strip().splitlines()
    lessons = [l for l in lines if l.startswith("- ")]
    return "\n".join(lessons[-limit:])


def _count_project_lessons(project: dict) -> int:
    p = _lessons_path(project)
    if not p.exists():
        return 0
    return sum(1 for l in p.read_text(encoding="utf-8").splitlines() if l.startswith("- "))


def append_lesson(project: dict, lesson: str, universal: bool = False) -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    entry = f"- [{now}] [{project['name']}] {lesson.strip()}\n"
    p = _lessons_path(project)
    with open(p, "a", encoding="utf-8") as f:
        f.write(entry)
    if universal:
        with open(_universal_lessons_path(), "a", encoding="utf-8") as f:
            f.write(entry)


# ── Per-project context file ───────────────────────────────────────────────────

def _project_context_path(project: dict) -> Path:
    return Path(project["folder_path"]) / "PROJECT_CONTEXT.md"


def write_project_context(project: dict, goal: str, tasks: list[dict]) -> None:
    """Write (or overwrite) PROJECT_CONTEXT.md with current project state.

    Captures goal, task list with statuses, and created files.  Called after
    planning and after each task completion so the context stays current.
    """
    slug      = project.get("slug", "")
    status    = project.get("status", "building")
    play_url  = f"http://{SERVER_HOST}/play/{slug}/"

    lines = [
        f"# Project: {project['name']}",
        "",
        f"**Goal:** {goal}",
        f"**Status:** {status}",
        f"**URL:** {play_url}",
        "",
        "## Tasks",
    ]
    for t in tasks:
        done  = "x" if t.get("status") == "done" else " "
        agent = t.get("assigned_to", "")
        lines.append(f"- [{done}] Task {t.get('task_number', '?')}: {t['title']} ({agent}) — {t.get('status', 'pending')}")

    # Append current file list
    try:
        src_files = list_project_files(project)
        if src_files:
            lines += ["", "## Files"]
            for f in src_files:
                lines.append(f"- `{f}`")
    except Exception:
        pass

    # Append recent lessons if any
    lessons = read_project_lessons(project, limit=3)
    if lessons:
        lines += ["", "## Lessons Learned", lessons]

    try:
        _project_context_path(project).write_text(
            "\n".join(lines) + "\n", encoding="utf-8"
        )
    except Exception as e:
        logging.warning("write_project_context failed: %s", e)


def load_project_context(project: dict) -> str:
    """Return PROJECT_CONTEXT.md content, or empty string if not found."""
    p = _project_context_path(project)
    if not p.exists():
        return ""
    try:
        return p.read_text(encoding="utf-8")
    except Exception:
        return ""


async def extract_and_save_lesson(project: dict, feedback: str, fix_summary: str) -> str | None:
    system = (
        "You extract concise coding lessons from bug fixes. "
        "Respond with ONLY the lesson (max 20 words), starting with a verb. "
        "Example: 'Always initialize canvas game loop with requestAnimationFrame, not setInterval.'"
    )
    prompt = (
        f"A bug was fixed in project '{project['name']}'.\n"
        f"User feedback: {feedback}\n"
        f"What was fixed: {fix_summary[:500]}\n\n"
        f"Write ONE concise lesson (max 20 words) to avoid this bug in future projects. "
        f"Respond with ONLY the lesson, nothing else."
    )
    try:
        lesson = await master_text_call(system, prompt, max_tokens=80)
        if not lesson:
            return None
        count = _count_project_lessons(project)
        universal = (count % 3 == 0)
        append_lesson(project, lesson, universal=universal)
        return lesson
    except Exception as e:
        logging.warning("extract_lesson failed: %s", e)
        return None


# ── Fix history ──────────────────────────────────────────────────────────────

def _fix_history_path(project: dict) -> Path:
    return Path(project["folder_path"]) / "fix_history.json"


def _load_fix_history(project: dict) -> list:
    p = _fix_history_path(project)
    if not p.exists():
        return []
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return []


def _append_fix_history(project: dict, feedback: str, agent: str,
                        files_changed: list, approved: bool) -> int:
    """Append a fix-cycle record to fix_history.json. Returns the cycle number."""
    history = _load_fix_history(project)
    cycle = len(history) + 1
    entry = {
        "cycle": cycle,
        "user_feedback": feedback,
        "agent": agent,
        "files_changed": files_changed,
        "evaluation": {"approved": approved},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    history.append(entry)
    try:
        _fix_history_path(project).write_text(
            json.dumps(history, indent=2, ensure_ascii=False), encoding="utf-8"
        )
    except Exception as e:
        logging.warning("_append_fix_history failed: %s", e)
    return cycle


# ── Agent profiling ───────────────────────────────────────────────────────────

def _agent_profiles_path() -> Path:
    return MEMORY_DIR / "agent_profiles.md"


def _load_agent_weaknesses(agent: str) -> str:
    """Extract known weaknesses from agent_profiles.md for injecting into worker prompts."""
    p = _agent_profiles_path()
    if not p.exists():
        return ""
    try:
        content = p.read_text(encoding="utf-8")
        m = re.search(rf"## {re.escape(agent)}\b(.*?)(?=\n## |\Z)", content,
                      re.DOTALL | re.IGNORECASE)
        if not m:
            return ""
        section = m.group(1)
        weak_m = re.search(r"### Known weaknesses.*?\n(.*?)(?=###|\Z)",
                           section, re.DOTALL | re.IGNORECASE)
        if not weak_m:
            return ""
        lines = [ln.strip() for ln in weak_m.group(1).splitlines()
                 if ln.strip().startswith("-")]
        return "\n".join(lines[:5])
    except Exception:
        return ""


def _update_agent_profiles(agent: str, pattern: str, rule: str) -> None:
    """Append a weakness entry to memory/agent_profiles.md."""
    MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    p = _agent_profiles_path()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if not p.exists():
        p.write_text(
            "# Agent Behavior Profiles\n"
            "Updated automatically by close_project_thread()\n\n",
            encoding="utf-8",
        )
    content = p.read_text(encoding="utf-8")
    agent_header = f"## {agent}"
    new_entry = f"- [{now}] {pattern[:200]} → Rule: {rule[:200]}\n"
    if agent_header not in content:
        content = (
            content.rstrip()
            + f"\n\n{agent_header}\n### Known weaknesses (auto-detected)\n{new_entry}"
        )
    else:
        idx = content.index(agent_header)
        next_h2 = content.find("\n## ", idx + 1)
        agent_block = content[idx:] if next_h2 == -1 else content[idx:next_h2]
        if "### Known weaknesses" in agent_block:
            weak_idx = content.index("### Known weaknesses", idx)
            eol = content.index("\n", weak_idx) + 1
            content = content[:eol] + new_entry + content[eol:]
        else:
            ins = idx + len(agent_block.rstrip())
            content = (
                content[:ins]
                + f"\n### Known weaknesses (auto-detected)\n{new_entry}"
                + content[ins:]
            )
    try:
        p.write_text(content, encoding="utf-8")
    except Exception as e:
        logging.warning("_update_agent_profiles failed: %s", e)


# ── Skill mutation ────────────────────────────────────────────────────────────

def _skill_mutations_log_path() -> Path:
    return MEMORY_DIR / "skill_mutations.log"


def _mutate_skill_file(skill_file: str, rule: str, source_slug: str) -> bool:
    """Append an auto-learned rule to a skills/*.md file. Returns True if written."""
    if not skill_file.endswith(".md"):
        skill_file = skill_file + ".md"
    skills_dir = Path(__file__).parent / "skills"
    skill_path = skills_dir / skill_file
    if not skill_path.exists():
        logging.warning("_mutate_skill_file: skill not found: %s", skill_path)
        return False

    rule = rule.strip()[:500]

    # Rate limit: max 1 mutation per skill file per calendar day
    log_p = _skill_mutations_log_path()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if log_p.exists():
        if any(today in ln and skill_file in ln
               for ln in log_p.read_text(encoding="utf-8").splitlines()):
            logging.info("_mutate_skill_file: daily limit reached for %s", skill_file)
            return False

    content = skill_path.read_text(encoding="utf-8")
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    new_rule = f"- {rule} (source: {source_slug} {now_str})"
    auto_section = "## Auto-learned rules"
    if auto_section in content:
        idx = content.index(auto_section)
        eol = content.index("\n", idx) + 1
        content = content[:eol] + new_rule + "\n" + content[eol:]
    else:
        content = (
            content.rstrip()
            + f"\n\n{auto_section}\n<!-- Do not edit — managed by feedback loop -->\n{new_rule}\n"
        )

    new_hash = hashlib.md5(content.encode()).hexdigest()[:8]
    try:
        skill_path.write_text(content, encoding="utf-8")
    except Exception as e:
        logging.warning("_mutate_skill_file write error: %s", e)
        return False

    MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    log_entry = (
        f"{datetime.now(timezone.utc).isoformat()} | PATCH | {skill_file} | +1 rule"
        f" | source: {source_slug} | hash: {new_hash}\n"
    )
    try:
        with open(log_p, "a", encoding="utf-8") as f:
            f.write(log_entry)
    except Exception as e:
        logging.warning("_skill_mutations_log write error: %s", e)
    logging.info("Mutated skill file %s +1 rule from project %s", skill_file, source_slug)
    return True


# ── Semantic lesson retrieval ─────────────────────────────────────────────────

def find_relevant_lessons(description: str, max_lessons: int = 5) -> list[str]:
    """Return universal lessons topically relevant to *description*, ranked by keyword overlap."""
    keywords = set(re.findall(r'\b\w{4,}\b', description.lower()))
    if not keywords:
        return []
    u = _universal_lessons_path()
    if not u.exists():
        return []
    all_lessons = [
        ln for ln in u.read_text(encoding="utf-8").splitlines() if ln.startswith("- ")
    ]
    scored: list[tuple[int, str]] = []
    for lesson in all_lessons:
        lesson_words = set(re.findall(r'\b\w{4,}\b', lesson.lower()))
        overlap = len(keywords & lesson_words)
        if overlap > 0:
            scored.append((overlap, lesson))
    scored.sort(reverse=True)
    return [lesson for _, lesson in scored[:max_lessons]]


# ── Intent detection ──────────────────────────────────────────────────────────

async def _claude_classify(system: str, message: str, max_tokens: int = 30) -> str:
    return await master_json_call(system, message, max_tokens) or ""


async def detect_intent(message: str) -> dict:
    system = textwrap.dedent("""\
        Classify the user message. Respond ONLY with JSON, no other text.
        - "project_new"      : user wants to BUILD/CREATE a new app, game, website, tool
        - "project_continue" : user wants to ADD/FIX/CHANGE something in an existing build
        - "chat"             : question, discussion, status check, anything else

        If project_new, include name.
        Format: {"type":"project_new","name":"Name"} or {"type":"project_continue"} or {"type":"chat"}
    """)
    raw = await _claude_classify(system, message, max_tokens=80)
    if not raw:
        return {"type": "chat"}
    try:
        raw = re.sub(r'^```(?:json)?\s*', '', raw)
        raw = re.sub(r'\s*```$', '', raw)
        return json.loads(raw)
    except Exception:
        return {"type": "chat"}


async def detect_intent_in_project(message: str, project_name: str) -> str:
    system = textwrap.dedent(f"""\
        User is inside project "{project_name}".
        Classify their message as exactly one word:
        query  — asking about status, progress, what was built, how it works
        build  — wants to add features, fix bugs, change or continue building
        done   — user is satisfied: "done", "looks good", "perfect", "thanks", "that works",
                  "great", "awesome", "completed", "ship it", "it works", "looks great"
        chat   — general question unrelated to building this project
        Respond with ONLY that one word.
    """)
    result = await _claude_classify(system, message, max_tokens=20)
    result_lower = result.lower()
    if "done" in result_lower:
        return "done"
    if "build" in result_lower:
        return "build"
    if "query" in result_lower:
        return "query"
    return "chat"


async def close_project_thread(ws: WebSocket, project_id: int,
                               cancel_event: asyncio.Event | None = None) -> None:
    """Triggered when user signals satisfaction ('done').

    Performs deep retrospective analysis of the full build+fix session,
    updates agent profiles, mutates skill files where applicable, and
    sends a ``project_finalized`` event to the UI.
    """
    project = get_project(project_id)
    if not project:
        return

    await ws.send_json({"type": "orch_phase", "phase": "finalizing",
                        "msg": "✨ Great! Analyzing this build session to improve future projects..."})

    all_tasks     = get_all_tasks(project_id)
    fix_history   = _load_fix_history(project)
    goal          = get_last_project_goal(project_id) or project.get("name", "")

    task_lines = "\n".join(
        f"  Task {t['task_number']}: {t['title']} (→ {t['assigned_to']}) — {t['status']}"
        for t in all_tasks
    )
    failed_tasks = [t for t in all_tasks if t.get("status") in ("errored", "failed")]
    failed_lines = (
        "\n".join(f"  Task {t['task_number']}: {t['title']}" for t in failed_tasks)
        or "  None"
    )

    fix_lines = ""
    if fix_history:
        for entry in fix_history:
            fix_lines += (
                f"\n  Cycle {entry['cycle']}:"
                f" User: \"{entry['user_feedback'][:100]}\""
                f" | Agent: {entry['agent']}"
                f" | Files: {', '.join(entry['files_changed']) or 'none'}"
            )
    else:
        fix_lines = "\n  None (no fixes needed)"

    prompt = textwrap.dedent(f"""\
        Analyze this complete build session:
        Project: {project['name']}
        Goal: {goal}

        BUILD PHASE:
        Tasks planned:
        {task_lines}

        Tasks that failed evaluation:
        {failed_lines}

        FIX CYCLES:{fix_lines}

        Answer:
        1. Which agent(s) made mistakes? What SPECIFIC mistakes?
        2. What RECURRING patterns do you see in the failures?
        3. For each pattern, write ONE concrete rule (max 30 words) that would prevent it.
        4. Which skill file should each rule be added to?
           (game-development, web-development, database, api-development, etc.)
        5. Were any failures caused by poor task descriptions?

        If this was a first-try success (no failures, no fix cycles), note what went RIGHT.

        Respond ONLY with JSON:
        {{"agent_issues": [{{"agent": "deepseek", "pattern": "...", "rule": "...", "skill_file": "game-development.md"}}],
          "plan_issues": ["..."],
          "positive_patterns": ["what went RIGHT"]}}
    """)

    analysis_json: dict = {}
    try:
        raw = await master_json_call(
            "You analyze AI coding agent sessions to extract concrete lessons. "
            "Be specific and actionable. Respond ONLY with the JSON object.",
            prompt, max_tokens=1500,
        )
        if raw:
            raw = re.sub(r'^```(?:json)?\s*', '', raw.strip())
            raw = re.sub(r'\s*```$', '', raw.strip())
            analysis_json = json.loads(raw)
    except Exception as e:
        logging.warning("close_project_thread: analysis error: %s", e)

    # Save full analysis to project folder
    try:
        analysis_out = {
            "project": project["name"],
            "goal": goal,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "analysis": analysis_json,
        }
        (Path(project["folder_path"]) / "post_analysis.json").write_text(
            json.dumps(analysis_out, indent=2, ensure_ascii=False), encoding="utf-8"
        )
    except Exception as e:
        logging.warning("close_project_thread: post_analysis.json write failed: %s", e)

    # Update agent profiles + mutate skills for each identified issue
    agent_issues = analysis_json.get("agent_issues", [])
    mutations: list[str] = []
    for issue in agent_issues:
        a_name     = issue.get("agent", "")
        pattern    = issue.get("pattern", "")
        rule       = issue.get("rule", "")
        skill_file = issue.get("skill_file", "")
        if a_name and pattern and rule:
            _update_agent_profiles(a_name, pattern, rule)
        if rule and skill_file:
            slug = project.get("slug", project["name"])
            if _mutate_skill_file(skill_file, rule, slug):
                mutations.append(skill_file)

    # Append positive patterns as project lessons
    positive = analysis_json.get("positive_patterns", [])
    for pos in positive[:2]:
        if pos.strip():
            append_lesson(project, f"[POSITIVE] {pos.strip()[:100]}", universal=False)

    # Mark finalized
    update_project_status(project_id, "finalized")

    n_issues  = len(agent_issues)
    n_mutated = len(mutations)
    if n_issues == 0 and positive:
        summary = f"Clean build! Recorded {len(positive)} positive pattern(s)."
    elif n_issues > 0:
        summary = (
            f"Found {n_issues} pattern(s)"
            + (f", updated {n_mutated} skill file(s)" if n_mutated else "")
            + "."
        )
    else:
        summary = "Build session analyzed."

    await ws.send_json({
        "type":              "project_finalized",
        "analysis_summary":  summary,
        "agent_issues":      agent_issues,
        "positive_patterns": positive,
        "slug":              project.get("slug", ""),
    })
    logging.info("close_project_thread: project=%s issues=%d mutations=%d",
                 project["name"], n_issues, n_mutated)


async def stream_project_query(ws: WebSocket, project_id: int, question: str,
                                cancel_event: asyncio.Event | None = None) -> None:
    """Explore-mode query: read project state and answer without modifying any files."""
    project = get_project(project_id)
    if not project:
        return

    # --- GATHER CONTEXT (read-only) ---

    # 1. PROJECT_CONTEXT.md — compact structured summary if available
    ctx_doc = load_project_context(project)

    # 2. Task list
    all_tasks = get_all_tasks(project_id)
    task_lines = "\n".join(
        f"  Task {t['task_number']}: {t['title']} — {t['status']} (→ {t['assigned_to']})"
        for t in all_tasks
    )

    # 3. Actual file contents (budget 5000 chars) for deeper code questions
    file_snippets = ""
    try:
        src_files = list_project_files(project)
        if src_files:
            contents = read_project_files(project, src_files)
            budget = 5000
            parts: list[str] = []
            for fpath, fcontent in contents.items():
                if budget <= 0:
                    break
                cap = min(1500, budget)
                parts.append(f"--- {fpath} ---\n{fcontent[:cap]}")
                budget -= min(len(fcontent), cap)
            if parts:
                file_snippets = "\nFile contents:\n" + "\n\n".join(parts)
                if budget <= 0:
                    file_snippets += "\n[...truncated — reply to see more...]"
    except Exception:
        pass

    # 4. Devlog tail as fallback context
    devlog_path = Path(project["folder_path"]) / "devlog.md"
    devlog_tail = ""
    if devlog_path.exists():
        devlog_tail = "\nDev log (last 1500 chars):\n" + devlog_path.read_text(
            encoding="utf-8", errors="replace"
        )[-1500:]

    context = (
        f"Project: {project['name']} | Status: {project['status']}\n\n"
        + (f"Project context:\n{ctx_doc}\n\n" if ctx_doc else "")
        + f"Tasks:\n{task_lines or '  (none yet)'}"
        + file_snippets
        + devlog_tail
    )

    system = (
        "You are in explore mode: a read-only assistant answering questions about this project. "
        "You cannot modify files or run code. "
        "Answer concisely and accurately using the provided context. "
        "If the project is complete, include the play URL in your answer."
    )
    history = [{"role": "user", "content": f"{context}\n\nQuestion: {question}"}]

    master = _get_master_model()
    save_project_message(project_id, "user", question)
    await ws.send_json({"type": "user", "content": question, "timestamp": datetime.now(timezone.utc).isoformat()})
    await ws.send_json({"type": "agent_count", "count": 1})
    await ws.send_json({"type": "typing", "agent": master})

    full = ""
    async for chunk in stream_master(history, system_prompt=system, cancel_event=cancel_event):
        await ws.send_json({"type": "chunk", "agent": master, "content": chunk})
        full += chunk

    await ws.send_json({"type": "done", "agent": master})
    if full.strip():
        save_project_message(project_id, master, full.strip())


# ── Claude structured calls ──────────────────────────────────────────────────

# T14.3: Role matrix — derives CEO / worker / specialist assignments from
#         which agents are currently enabled.
def _build_role_matrix() -> dict:
    """Return a role mapping based on which agents are online.

    Keys:
        ceo           — planning + evaluation agent
        workers       — list of agents that can execute tasks
        primary_coder — preferred agent for code tasks
        css_specialist — preferred agent for CSS-only tasks
    """
    enabled = set(_get_enabled_agents())
    disabled = set(_get_config().get("disabled_agents", []))
    enabled -= disabled
    local_agents = [a for a in ["deepseek", "qwen35"] if a in enabled]
    claude_up = "claude" in enabled

    if claude_up:
        roles: dict = {"ceo": "claude"}
        roles["workers"] = local_agents if local_agents else ["claude"]
    else:
        roles = {"ceo": local_agents[0] if local_agents else None}
        roles["workers"] = local_agents

    roles["primary_coder"] = (
        "deepseek" if "deepseek" in local_agents
        else ("qwen35" if "qwen35" in local_agents else roles.get("ceo"))
    )
    roles["css_specialist"] = (
        "qwen35" if "qwen35" in local_agents else roles.get("primary_coder")
    )
    return roles


async def _validate_task_granularity(tasks: list[dict]) -> list[dict]:
    """T14.2: If any task description exceeds 500 chars, ask the planner to split it.

    Returns the (possibly expanded) refined task list.
    """
    big = [t for t in tasks if len(t.get("description", "")) > 500]
    if not big:
        return tasks
    oversized_titles = "\n".join(
        f"- Task {t['task_number']}: {t['title']} ({len(t.get('description',''))} chars)"
        for t in big
    )
    split_prompt = (
        f"The following tasks are too large for a local LLM (>500 char descriptions):\n"
        f"{oversized_titles}\n\n"
        f"Please split each oversized task into 2-3 smaller atomic tasks, each under 300 chars.\n"
        f"Return the COMPLETE revised task list as a JSON array (same format as before).\n"
        f"Keep all other tasks unchanged. Output only JSON."
    )
    split_system = (
        "You are a software architect. Split oversized tasks into smaller, "
        "self-contained units that a 9-16B local LLM can handle reliably. "
        "Preserve depends_on relationships. Output only a JSON array."
    )
    try:
        text = await master_json_call(split_system, split_prompt, max_tokens=4096)
        if not text:
            return tasks
        text = re.sub(r'^```(?:json)?\s*', '', text.strip())
        text = re.sub(r'\s*```$', '', text.strip())
        bracket = text.find('[')
        if bracket > 0:
            text = text[bracket:]
        revised = json.loads(text)
        if isinstance(revised, list) and len(revised) >= len(tasks):
            # Normalize: fill in missing required fields so save_tasks never raises KeyError
            default_agent = tasks[0].get("assigned_to", "deepseek") if tasks else "deepseek"
            for i, task in enumerate(revised, 1):
                task.setdefault("task_number", i)
                task.setdefault("assigned_to", default_agent)
                task.setdefault("title", f"Task {task['task_number']}")
                task.setdefault("description", "")
                task.setdefault("files_to_create", [])
                task.setdefault("depends_on", [])
            logging.info("_validate_task_granularity: split %d big tasks → %d total", len(big), len(revised))
            return revised
    except Exception as e:
        logging.warning("_validate_task_granularity failed: %s", e)
    return tasks


async def claude_plan_project(project: dict, goal: str) -> list[dict]:
    # T14.3: Build dynamic role matrix
    roles = _build_role_matrix()
    primary = roles.get("primary_coder") or "deepseek"
    css_spec = roles.get("css_specialist") or primary
    enabled_agents = _get_enabled_agents()

    disabled = set(_get_config().get("disabled_agents", []))
    worker_roles_lines = []
    for agent in ["deepseek", "qwen35"]:
        if agent in disabled:
            worker_roles_lines.append(f'- "{agent}" : DISABLED. Do NOT assign any tasks to {agent}.')
        elif agent == primary and agent == css_spec:
            worker_roles_lines.append(
                f'- "{agent}" : PRIMARY CODER & STYLING. Assign ALL tasks — every .html, .js, .py, .json, .css, README.md.'
            )
        elif agent == primary:
            worker_roles_lines.append(
                f'- "{agent}" : PRIMARY CODER. Assign all code tasks — every .html, .js, .py, .json, README.md.'
            )
        elif agent == css_spec:
            worker_roles_lines.append(
                f'- "{agent}" : STYLING SPECIALIST. Assign ONLY pure CSS files (style.css, theme.css). Max ~150 lines.'
                f' Never assign .html, .js, or logic files to {agent}.'
            )
        else:
            worker_roles_lines.append(f'- "{agent}" : Available worker.')

    worker_roles_str = "\n        ".join(worker_roles_lines)

    # T14.6: inject per-model capability hints
    from config import MODEL_CAPABILITY
    cap_lines = []
    for a in ["deepseek", "qwen35"]:
        if a not in disabled:
            cap = MODEL_CAPABILITY.get(a, {})
            cap_lines.append(
                f"- {a}: reliable up to ~{cap.get('max_output_lines', 300)} lines, "
                f"~{cap.get('accuracy_pct', 75)}% accuracy on complex tasks"
            )
    cap_block = ("MODEL CAPABILITIES — target each task within these limits:\n        "
                 + "\n        ".join(cap_lines)) if cap_lines else ""

    system = textwrap.dedent(f"""\
        You are a senior software architect planning a project for a multi-agent coding system.
        Your job is to break the goal into ATOMIC, INDEPENDENT tasks that local LLMs can execute
        reliably without making integration mistakes.

        AGENT ROLES — READ CAREFULLY:
        CURRENTLY ENABLED AGENTS: {", ".join(enabled_agents)}
        Only assign tasks to agents in the enabled list above.

        {worker_roles_str}
        - "claude"   : NEVER assign tasks to claude. Claude is planner/orchestrator only.

        {cap_block}

        LOCAL LLM TASK SIZING RULES:
        - Each task description must be SELF-CONTAINED — include all necessary context.
        - Target ~200 lines of output maximum per task for local LLMs.
        - Break complex features into separate tasks:
            BAD:  "Create game.js with board, pieces, rotation, collision, scoring, and game loop"
            GOOD: Task 1: "Create game.js with board rendering and piece definitions"
                  Task 2: "Add rotation, collision detection, and piece movement to game.js"
                  Task 3: "Add scoring system, level progression, and game over logic to game.js"
        - Each task must list COMPLETE function signatures, DOM IDs, and variable names
          so the agent does not need to infer undocumented interfaces.

        TASK COMPLEXITY BUDGET:
        - Simple (1 concept): 1 task — counter, clock, form, simple dashboard
        - Medium (2-3 concepts): 2-3 tasks — snake (board + controls + scoring)
        - Complex (4+ concepts): 4-6 tasks — RPG (world + combat + inventory + UI + NPCs)

        SINGLE-FILE RULE (default — use this whenever possible):
        Most projects MUST be ONE task producing ONE index.html with all CSS and JS inline.
        This includes: counters, calculators, clocks, forms, todo apps, stopwatches, simple
        games (snake, tetris, pong, breakout, flappy bird, memory, minesweeper), dashboards,
        landing pages, and any other app that fits in ~600 lines of HTML+CSS+JS.
        ONE file = zero integration risk. Always prefer this.

        ONLY split into multiple files when ALL of these are true:
        - The app has 4+ genuinely separate functional areas (e.g. full SPA with routing)
        - The single file would exceed ~800 lines even with dense but readable code
        - The files can be COMPLETELY independent (no shared state across files)

        ATOMIC TASK RULES (only applies when multi-file split is justified):
        1. Each task produces at most ONE file, max ~300 lines of output.
        2. Tasks must be INDEPENDENT — no task imports/requires another task's output.
           Use window.globals (not ES modules) for any shared state across files.
        3. The agent writing index.html must include ALL <script src="..."> and <link href="...">
           tags. Path in src/href must EXACTLY match files_to_create in that task.
        4. Each task description must specify EXACT element IDs, function names, window.globals
           so agents don't guess wrong names between files.

        QUALITY RULES:
        - Code must be COMPLETE — no TODOs, no placeholders, no "add logic here" comments.
        - All HTML files: include DOCTYPE, charset UTF-8, viewport meta.
        - Games must support both keyboard AND touch controls.

        ENVIRONMENT:
        - Headless Mac Mini, no display. Projects served at http://{SERVER_HOST}/play/<slug>/
        - All asset paths MUST be relative. Never use absolute paths or /path/to/file.
        - Every web project MUST have index.html as entry point.

        Return ONLY a JSON array. No markdown, no explanation, just the array.
        Each task object: {{
          "task_number": int,
          "title": "short title",
          "description": "detailed spec with exact IDs/function names/interfaces the agent must use",
          "assigned_to": "claude"|"deepseek"|"qwen35",
          "files_to_create": ["relative/path.ext"],
          "depends_on": []
        }}

        PARALLELISM FIELD — "depends_on":
        List the task_numbers that MUST complete before this task starts.
        Leave it empty ([]) if the task is fully independent and can run in parallel with others.
        Example: if task 3 needs index.html from task 1, set "depends_on": [1].
        Tasks in the same dependency wave will execute concurrently — design tasks to be
        independent whenever possible to maximise parallelism.
    """)

    relevant_lessons = find_relevant_lessons(goal, max_lessons=6)
    proj_lessons = read_project_lessons(project, limit=3)
    lessons_block = ""
    if relevant_lessons or proj_lessons:
        lessons_block = "\nLEARNED LESSONS (apply these when planning):\n"
        if relevant_lessons:
            lessons_block += "\n".join(relevant_lessons) + "\n"
        if proj_lessons:
            lessons_block += f"[{project['name']}-specific]\n" + proj_lessons + "\n"

    # T8.3: inject agent profile warnings into planning prompt
    profile_warnings = []
    for agent_key in ["deepseek", "qwen35"]:
        weaknesses = _load_agent_weaknesses(agent_key)
        if weaknesses:
            profile_warnings.append(f"  {agent_key} known weaknesses:\n" +
                                    "\n".join(f"    {ln}" for ln in weaknesses.splitlines()))
    profile_block = ""
    if profile_warnings:
        profile_block = ("\nAGENT PROFILE WARNINGS (consider when assigning tasks):\n"
                         + "\n".join(profile_warnings) + "\n")

    prompt = (
        f"Project: {project['name']}\n"
        f"Description: {project.get('description', '')}\n"
        f"Goal: {goal}\n"
        f"{lessons_block}"
        f"{profile_block}\n"
        f"Create the task plan. ALWAYS apply the SINGLE-FILE RULE first — default to ONE task "
        f"with ONE index.html unless the project genuinely cannot fit in ~600 lines. "
        f"Simple games (snake, tetris, pong, breakout, flappy bird, minesweeper) MUST be single-file. "
        f"EXCEPTION: if the goal mentions 10+ rooms, full inventory+combat+NPC systems, or multi-section apps "
        f"with 4+ independent panels, SPLIT into multiple focused files (each under 300 lines). "
        f"When in doubt, count component complexity: >4 distinct systems = split. Output only JSON."
    )

    text = ""
    for attempt in range(2):
        try:
            retry_note = "IMPORTANT: Output ONLY the JSON array. No explanation, no prose, no markdown — raw JSON only.\n\n" if attempt > 0 else ""
            text = await master_json_call(system, retry_note + prompt, max_tokens=4096)
            if not text:
                logging.error("claude_plan_project: empty response (attempt %d)", attempt + 1)
                continue
            # Strip markdown code fences
            text = re.sub(r'^```(?:json)?\s*', '', text.strip())
            text = re.sub(r'\s*```$', '', text.strip())
            # If response starts with prose, try to extract embedded JSON array
            bracket = text.find('[')
            if bracket > 0:
                text = text[bracket:]
                end = text.rfind(']')
                if end != -1:
                    text = text[:end+1]
            tasks = json.loads(text)
            if not isinstance(tasks, list):
                logging.error("claude_plan_project returned non-list (attempt %d): %s", attempt + 1, text[:200])
                continue
            tasks = tasks[:100]
            # T14.2: validate and potentially split oversized tasks
            tasks = await _validate_task_granularity(tasks)
            return tasks
        except json.JSONDecodeError as e:
            logging.error("claude_plan_project JSON parse error (attempt %d): %s — raw: %s", attempt + 1, e, text[:300])
        except Exception as e:
            logging.error("claude_plan_project error (attempt %d): %s", attempt + 1, e)
            break
    return []


def _run_static_checks(extracted: list[dict], files_to_create: list[str]) -> dict | None:
    """Run pure-Python pre-checks on extracted files. Returns a rejection dict on failure,
    or None if all checks pass. (T9.2 + T11.2 + T11.3)"""
    import subprocess as _sp
    extracted_names = {(f.get("path") or f.get("filename", "")).lower() for f in extracted}

    for f in extracted:
        fname   = (f.get("path") or f.get("filename", ""))
        content = f.get("content", "")
        ext     = Path(fname).suffix.lower()

        # Check 4: JS syntax via `node --check`
        if ext == ".js":
            try:
                result = _sp.run(
                    ["node", "--check", "/dev/stdin"],
                    input=content.encode(), capture_output=True, timeout=5,
                )
                if result.returncode != 0:
                    err = result.stderr.decode(errors="replace").strip().splitlines()[0][:200]
                    return {"approved": False,
                            "feedback": f"JS syntax error in {fname}: {err}",
                            "checks": {"js_syntax": False}}
            except FileNotFoundError:
                pass  # node not installed — skip gracefully
            except Exception:
                pass

        # Check 5: CSS balanced braces + T11.3 extras
        if ext == ".css":
            if content.count("{") != content.count("}"):
                return {"approved": False,
                        "feedback": f"CSS file {fname} has unbalanced braces "
                                    f"({{ count: {content.count('{')}, }} count: {content.count('}')})",
                        "checks": {"css_braces": False}}
            # T11.3: no @import of non-existent local files
            for imp in re.findall(r'@import\s+["\']([^"\']+)["\']', content):
                if not imp.startswith(("http://", "https://", "//")):
                    if imp.lower() not in extracted_names and imp.lower() not in {f.lower() for f in files_to_create}:
                        return {"approved": False,
                                "feedback": f"CSS {fname} @imports '{imp}' which is not in the file list.",
                                "checks": {"css_imports": False}}

        if ext in (".html", ".htm"):
            # T11.2: require <!DOCTYPE html> or <html
            if "<!doctype" not in content.lower() and "<html" not in content.lower():
                return {"approved": False,
                        "feedback": f"HTML file {fname} missing <!DOCTYPE html> or <html> tag.",
                        "checks": {"html_doctype": False}}
            # Check 6: <script src="X"> references exist
            script_srcs = re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', content, re.IGNORECASE)
            for src in script_srcs:
                if src.startswith(("http://", "https://", "//")):
                    continue  # CDN — skip
                if src.lower() not in extracted_names and src.lower() not in {f.lower() for f in files_to_create}:
                    return {"approved": False,
                            "feedback": f"HTML references <script src=\"{src}\"> but that file is not produced.",
                            "checks": {"script_refs": False}}
            # T11.2: <link href="X"> references exist
            link_hrefs = re.findall(r'<link[^>]+href=["\']([^"\']+)["\']', content, re.IGNORECASE)
            for href in link_hrefs:
                if href.startswith(("http://", "https://", "//")):
                    continue
                if href.lower() not in extracted_names and href.lower() not in {f.lower() for f in files_to_create}:
                    return {"approved": False,
                            "feedback": f"HTML references <link href=\"{href}\"> but that file is not produced.",
                            "checks": {"link_refs": False}}
            # Check 7: no localhost references in non-API context
            if re.search(r'https?://(localhost|127\.0\.0\.1)', content):
                return {"approved": False,
                        "feedback": "HTML/JS contains localhost URL — use relative paths instead.",
                        "checks": {"no_localhost": False}}
            # Check 8: no absolute file paths
            if re.search(r'["\'](?:C:\\\\|/Users/|/home/)', content):
                return {"approved": False,
                        "feedback": "Code contains absolute filesystem path — use relative paths.",
                        "checks": {"no_abs_paths": False}}
            # Check 9: charset meta
            if "<html" in content.lower() and "charset" not in content.lower():
                return {"approved": False,
                        "feedback": f"HTML file {fname} missing <meta charset> tag.",
                        "checks": {"charset_meta": False}}
            # T11.2: basic unclosed tag sanity check (div, span, section, article, main, header, footer, nav)
            for tag in ("div", "span", "section", "article", "main", "header", "footer", "nav"):
                opens  = len(re.findall(rf'<{tag}[\s>]', content, re.IGNORECASE))
                closes = len(re.findall(rf'</{tag}>', content, re.IGNORECASE))
                if opens > 0 and abs(opens - closes) > 2:
                    return {"approved": False,
                            "feedback": f"HTML {fname}: <{tag}> opened {opens}x but closed {closes}x — likely unclosed tags.",
                            "checks": {"html_tags": False}}

        # Check 8 (js): no absolute paths
        if ext == ".js":
            if re.search(r'["\'](?:C:\\\\|/Users/|/home/)', content):
                return {"approved": False,
                        "feedback": "JS code contains absolute filesystem path — use relative paths.",
                        "checks": {"no_abs_paths": False}}

    return None  # all checks passed


def _run_cross_file_checks(extracted: list[dict]) -> list[str]:
    """T11.4: Cross-file reference validation. Returns list of warning strings (not hard rejections)."""
    warnings: list[str] = []

    # Build an index: id values and class values defined in HTML
    html_ids:     set[str] = set()
    html_classes: set[str] = set()
    js_functions: set[str] = set()
    file_names:   set[str] = {
        (f.get("path") or f.get("filename", "")).lower() for f in extracted
    }

    for f in extracted:
        fname   = (f.get("path") or f.get("filename", ""))
        content = f.get("content", "")
        ext     = Path(fname).suffix.lower()

        if ext in (".html", ".htm"):
            html_ids.update(re.findall(r'\bid=["\']([^"\']+)["\']', content))
            html_classes.update(re.findall(r'\bclass=["\']([^"\']+)["\']', content))

        if ext == ".js":
            # Collect defined function names (function foo, const foo = , let foo = )
            js_functions.update(re.findall(r'\bfunction\s+(\w+)\s*\(', content))
            js_functions.update(re.findall(r'\b(?:const|let|var)\s+(\w+)\s*=\s*(?:function|\()', content))

    # Expand class strings ("foo bar") into individual class tokens
    all_classes: set[str] = set()
    for cls_str in html_classes:
        all_classes.update(cls_str.split())

    for f in extracted:
        fname   = (f.get("path") or f.get("filename", ""))
        content = f.get("content", "")
        ext     = Path(fname).suffix.lower()

        if ext == ".js":
            # getElementById("X") → id should exist in HTML
            for el_id in re.findall(r'getElementById\(["\']([^"\']+)["\']\)', content):
                if html_ids and el_id not in html_ids:
                    warnings.append(f"{fname}: getElementById('{el_id}') — id not found in HTML files.")

            # querySelector(".X") → class should exist
            for selector in re.findall(r'querySelector\(["\']([^"\']+)["\']\)', content):
                if selector.startswith("."):
                    cls = selector[1:].split(":")[0].split("[")[0]
                    if all_classes and cls not in all_classes:
                        warnings.append(f"{fname}: querySelector('{selector}') — class '{cls}' not found in HTML.")
                elif selector.startswith("#"):
                    eid = selector[1:].split(":")[0].split("[")[0]
                    if html_ids and eid not in html_ids:
                        warnings.append(f"{fname}: querySelector('{selector}') — id '{eid}' not found in HTML.")

            # import './file.js' → file must exist
            for imp in re.findall(r'import\s+.*?from\s+["\'](\.[^"\']+)["\']', content):
                imp_norm = imp.lstrip("./").lower()
                if imp_norm not in file_names:
                    warnings.append(f"{fname}: imports '{imp}' but that file is not in the project.")

        if ext in (".html", ".htm"):
            # onclick="fn()" → fn must be defined in a JS file
            for fn in re.findall(r'onclick=["\'](\w+)\s*\(', content):
                if js_functions and fn not in js_functions:
                    warnings.append(f"{fname}: onclick calls '{fn}()' but function not found in JS files.")

    return warnings


async def run_smoke_test(project: dict) -> list[str]:
    """T11.5: Verify the project serves at its /play/ URL and all referenced resources return 200."""
    import httpx as _httpx
    errors: list[str] = []
    slug = project.get("slug", "")
    if not slug:
        return errors

    base_url = f"http://localhost:8080/play/{slug}/"
    try:
        async with _httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            r = await client.get(base_url)
            if r.status_code != 200:
                errors.append(f"Play URL {base_url} returned HTTP {r.status_code}")
                return errors
            if "<html" not in r.text.lower():
                errors.append(f"Play URL response doesn't look like HTML (no <html> tag).")
                return errors
            # Check referenced JS/CSS files are accessible
            for src in re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', r.text, re.IGNORECASE):
                if src.startswith(("http://", "https://", "//")):
                    continue
                src_clean = src.lstrip("./")
                resource_url = base_url + src_clean
                try:
                    r2 = await client.get(resource_url)
                    if r2.status_code != 200:
                        errors.append(f"Referenced script '{src}' → HTTP {r2.status_code}")
                except Exception as exc:
                    errors.append(f"Referenced script '{src}' unreachable: {exc}")
            for href in re.findall(r'<link[^>]+href=["\']([^"\']+)["\']', r.text, re.IGNORECASE):
                if href.startswith(("http://", "https://", "//")):
                    continue
                href_clean = href.lstrip("./")
                resource_url = base_url + href_clean
                try:
                    r2 = await client.get(resource_url)
                    if r2.status_code != 200:
                        errors.append(f"Referenced stylesheet '{href}' → HTTP {r2.status_code}")
                except Exception as exc:
                    errors.append(f"Referenced stylesheet '{href}' unreachable: {exc}")
    except Exception as exc:
        errors.append(f"Smoke test failed: {exc}")
    return errors


async def run_qa_checks(project: dict, extracted: list[dict],
                        files_to_create: list[str],
                        run_smoke: bool = False) -> dict:
    """T11.6: Full QA pipeline — static checks, cross-file refs, optional smoke test.
    Returns {"errors": [...], "warnings": [...], "passed": bool}"""
    errors:   list[str] = []
    warnings: list[str] = []

    # Static checks (T11.1/T11.2/T11.3 — already implemented in _run_static_checks)
    static_fail = _run_static_checks(extracted, files_to_create)
    if static_fail:
        errors.append(static_fail.get("feedback", "Static check failed"))

    # Cross-file reference checks (T11.4)
    try:
        xref_warnings = _run_cross_file_checks(extracted)
        warnings.extend(xref_warnings)
    except Exception as exc:
        logging.debug("Cross-file check error: %s", exc)

    # Smoke test (T11.5) — only run when explicitly requested (post-build)
    if run_smoke:
        try:
            smoke_errors = await run_smoke_test(project)
            errors.extend(smoke_errors)
        except Exception as exc:
            logging.debug("Smoke test error: %s", exc)

    return {
        "errors":   errors,
        "warnings": warnings,
        "passed":   len(errors) == 0,
        "summary":  (f"{len(errors)} error(s), {len(warnings)} warning(s)"
                     if errors or warnings else "All QA checks passed"),
    }


async def claude_evaluate_task(project: dict, task: dict, output: str) -> dict:
    files_to_create = task.get("files_to_create") or []
    has_file_marker = bool(re.search(r'FILE:', output))
    extracted = extract_files_from_response(output)
    extracted_paths = {f["path"] if "path" in f else f.get("filename", "") for f in extracted}

    # T9.1: detect evaluator timeout sentinel BEFORE lenient parsing
    if "*[Claude error:" in output or "[Claude error:" in output:
        return {"approved": False, "feedback": "Evaluator timed out — retrying.",
                "checks": {}, "severity": "error"}

    if not has_file_marker and not extracted:
        return {"approved": False,
                "feedback": "No FILE: markers found in output — no files were produced.",
                "checks": {"files_present": False}, "severity": "error"}

    if files_to_create:
        missing = [f for f in files_to_create if f not in extracted_paths]
        if missing:
            return {"approved": False,
                    "feedback": f"Expected files not produced: {missing}",
                    "checks": {"files_present": False}, "severity": "error"}

    for f in extracted:
        fname = f.get("path", f.get("filename", ""))
        content = f.get("content", "")
        if fname.endswith((".html", ".htm")) and "<html" not in content.lower():
            return {"approved": False,
                    "feedback": f"HTML file {fname} missing <html> tag — may be incomplete.",
                    "checks": {"html_valid": False}, "severity": "error"}

    # T9.2: static pre-checks — fast, deterministic, no LLM needed
    static_fail = _run_static_checks(extracted, files_to_create)
    if static_fail:
        static_fail.setdefault("severity", "error")
        return static_fail

    # T11.4: cross-file reference check — collect warnings to feed into LLM prompt
    xref_warnings: list[str] = []
    try:
        xref_warnings = _run_cross_file_checks(extracted)
        # Hard-reject only when there are definite cross-ref errors and NO HTML ids at all
        # (avoids false-positives when HTML and JS are in different tasks)
    except Exception:
        pass

    # T9.2 check 10: canvas games must have a game loop
    task_title_lower = (task.get("title", "") + " " + task.get("description", "")).lower()
    is_game = any(w in task_title_lower for w in
                  ("game", "canvas", "snake", "tetris", "pong", "breakout", "flappy", "shooter"))
    if is_game:
        combined_js = "\n".join(
            f.get("content", "") for f in extracted
            if (f.get("path") or f.get("filename", "")).endswith(".js")
        )
        combined_html = "\n".join(
            f.get("content", "") for f in extracted
            if (f.get("path") or f.get("filename", "")).endswith((".html", ".htm"))
        )
        combined = combined_js + combined_html
        if combined and not re.search(r'requestAnimationFrame|setInterval', combined):
            return {"approved": False,
                    "feedback": "Canvas game missing game loop — no requestAnimationFrame or setInterval found.",
                    "checks": {"game_loop": False}, "severity": "error"}

    # Build base checks dict for the structured result
    base_checks = {
        "files_present": True,
        "html_valid": True,
        "js_syntax": True,
        "css_braces": True,
        "script_refs": True,
        "link_refs": True,
        "no_localhost": True,
        "no_abs_paths": True,
        "cross_refs": len(xref_warnings) == 0,
    }

    system = textwrap.dedent("""\
        You evaluate if a coding task was completed correctly.
        Respond ONLY with JSON:
        {"approved": true/false, "feedback": "brief feedback if not approved",
         "severity": "error|warning|info"}
        Be lenient about style/formatting. Reject only if: files are missing, code has obvious
        undefined variables that come from other files, wrong script/link paths, or broken logic.
    """)
    # Include existing project files for cross-file compatibility checks
    cross_context = ""
    try:
        existing = read_project_files(project)
        if existing:
            budget = 3000
            cross_context = "\n\nOther files already in the project (for cross-reference):\n"
            for fpath, fcontent in existing.items():
                if budget <= 0:
                    break
                cap = min(800, budget)
                cross_context += f"--- {fpath} ---\n{fcontent[:cap]}\n"
                budget -= min(len(fcontent), cap)
    except Exception:
        pass
    prompt = (
        f"Task: {task['title']}\n"
        f"Description: {task['description']}\n"
        f"Files expected: {json.dumps(files_to_create)}\n"
        f"{cross_context}\n"
        + (f"Cross-file reference issues detected:\n" + "\n".join(f"- {w}" for w in xref_warnings) + "\n\n"
           if xref_warnings else "")
        + f"Agent output:\n{output[:3000]}"
    )
    text = ""
    try:
        text = await master_json_call(system, prompt, max_tokens=300)
        if not text:
            # T9.1: no response = reject (don't silently approve)
            return {"approved": False,
                    "feedback": "Evaluator returned no response.",
                    "checks": base_checks, "severity": "error"}
        # T9.1: check for timeout sentinel in evaluator response too
        if "*[Claude error:" in text or "[Claude error:" in text:
            return {"approved": False,
                    "feedback": "Evaluator timed out.",
                    "checks": base_checks, "severity": "error"}
        text = re.sub(r'^```(?:json)?\s*', '', text.strip())
        text = re.sub(r'\s*```$', '', text.strip())
        result = json.loads(text)
        # Normalise into structured form (T9.3)
        result.setdefault("checks", base_checks)
        result.setdefault("severity", "error" if not result.get("approved") else "info")
        return result
    except json.JSONDecodeError:
        # Lenient free-text parse — but never auto-approve on error sentinel
        if text:
            if "*[Claude error:" in text or "[Claude error:" in text:
                return {"approved": False, "feedback": "Evaluator timed out.",
                        "checks": base_checks, "severity": "error"}
            low = text.lower()
            if "approved" in low or "looks good" in low or "lgtm" in low or "correct" in low:
                return {"approved": True, "checks": base_checks, "severity": "info"}
            if "not approved" in low or "missing" in low or "error" in low or "incorrect" in low:
                return {"approved": False, "feedback": text[:300],
                        "checks": base_checks, "severity": "error"}
        # T9.1: parse error → reject instead of silently approve
        return {"approved": False,
                "feedback": "Evaluator returned unparseable response — task needs review.",
                "checks": base_checks, "severity": "error"}
    except Exception:
        logging.warning("claude_evaluate_task crashed — rejecting to trigger retry", exc_info=True)
        return {"approved": False,
                "feedback": "Evaluator crashed — please review output manually.",
                "checks": base_checks, "severity": "error"}


async def claude_project_summary(project: dict, goal: str, tasks: list) -> str:
    task_desc = "\n".join(f"- Task {t['task_number']}: {t['title']} ({t['status']})" for t in tasks)
    slug = project.get("slug", "project")
    system = "You write concise project summaries for a developer. Be direct and helpful."
    prompt = (
        f"Project: {project['name']}\n"
        f"Goal: {goal}\n\n"
        f"Tasks completed:\n{task_desc}\n\n"
        f"Write a brief summary (2-4 sentences) for Paras about what was built and how to use it.\n"
        f"IMPORTANT: Always end your summary with this exact line:\n"
        f"To play/test: open http://{SERVER_HOST}/play/{slug}/ in your browser"
    )
    play_url = f"http://{SERVER_HOST}/play/{slug}/"
    summary = await master_json_call(system, prompt, max_tokens=500)
    if not summary:
        summary = f"Project '{project['name']}' completed with {len(tasks)} tasks."
    if play_url not in summary:
        summary = summary.rstrip() + f"\n\nTo play/test: {play_url}"
    return summary


# ── Orchestration loop ────────────────────────────────────────────────────────

async def safe_send(ws: WebSocket, payload: dict,
                    cancel_event: asyncio.Event | None = None) -> bool:
    try:
        await ws.send_json(payload)
        return True
    except (WebSocketDisconnect, RuntimeError):
        if cancel_event:
            cancel_event.set()
        return False


def _strip_cyclic_deps(tasks: list[dict]) -> list[dict]:
    """Detect and remove depends_on edges that form cycles using DFS.

    Returns a (possibly modified) copy of the task list where any edge that
    would create a cycle has been removed.  All removals are logged as warnings.
    """
    valid_ids = {t["task_number"] for t in tasks}
    # Build adjacency as dict of task_number -> set of deps
    adj: dict[int, set[int]] = {
        t["task_number"]: {d for d in (t.get("depends_on") or []) if d in valid_ids}
        for t in tasks
    }

    # Kahn's algorithm: repeatedly remove nodes with zero in-degree
    # Any node that never reaches zero in-degree is part of a cycle.
    in_degree = {n: len(deps) for n, deps in adj.items()}
    queue = [n for n, d in in_degree.items() if d == 0]
    processed: set[int] = set()
    while queue:
        node = queue.pop()
        processed.add(node)
        for other, deps in adj.items():
            if node in deps:
                deps.discard(node)
                in_degree[other] -= 1
                if in_degree[other] == 0:
                    queue.append(other)

    cyclic_nodes = valid_ids - processed
    if not cyclic_nodes:
        return tasks  # no cycles — nothing to do

    logging.warning(
        "depends_on cycle detected among task(s) %s; "
        "stripping their depends_on to allow sequential execution",
        sorted(cyclic_nodes),
    )
    result = []
    for t in tasks:
        if t["task_number"] in cyclic_nodes:
            result.append({**t, "depends_on": []})
        else:
            result.append(t)
    return result


def _group_into_waves(tasks: list[dict]) -> list[list[dict]]:
    """Group tasks into execution waves based on depends_on.

    Tasks whose depends_on are all satisfied by previous waves are batched
    together and will execute concurrently via asyncio.gather().
    Cycles are stripped by _strip_cyclic_deps() before grouping.
    """
    tasks = _strip_cyclic_deps(tasks)
    done_ids: set[int] = set()
    waves: list[list[dict]] = []
    remaining = list(tasks)
    while remaining:
        wave = [
            t for t in remaining
            if all(dep in done_ids for dep in (t.get("depends_on") or []))
        ]
        if not wave:
            # Should not happen after cycle stripping, but guard against it.
            logging.error("_group_into_waves: no progress after cycle stripping — running all remaining sequentially")
            wave = remaining
        waves.append(wave)
        done_ids.update(t["task_number"] for t in wave)
        wave_set = {id(t) for t in wave}
        remaining = [t for t in remaining if id(t) not in wave_set]
    return waves


def _group_by_model_then_wave(tasks: list[dict]) -> list[list[dict]]:
    """T14.4: Reorder waves so all tasks for one local model run before switching to another.

    Strategy:
    1. Compute standard dependency waves (honouring depends_on).
    2. Within each wave collect tasks by assigned agent.
    3. Between waves, minimise model switches by running the same-model tasks
       from consecutive waves together before switching.

    Returns the reordered list of waves (each wave is a list of tasks).
    Falls back to standard wave grouping if all tasks are for the same model.
    """
    base_waves = _group_into_waves(tasks)

    # Collect the distinct local agents used across all tasks
    local_agents: list[str] = []
    for w in base_waves:
        for t in w:
            agent = t.get("assigned_to", "")
            if agent not in ("claude", "") and agent not in local_agents:
                local_agents.append(agent)

    if len(local_agents) <= 1:
        # Only one (or zero) local models — no reordering needed
        return base_waves

    # Group tasks per agent while PRESERVING dependency order within each group.
    # A task can be "moved" to a later same-model group only if all its
    # dependencies are satisfied before it runs.
    done_task_numbers: set[int] = set()
    reordered: list[list[dict]] = []

    for agent in local_agents:
        # Gather all tasks for this agent that are dependency-safe to run once
        # all previous agent groups have completed.
        runnable = []
        prev_done = set(done_task_numbers)
        remaining_for_agent = [
            t for w in base_waves for t in w
            if t.get("assigned_to") == agent
        ]
        for t in remaining_for_agent:
            deps = set(t.get("depends_on") or [])
            if deps <= prev_done:
                runnable.append(t)
                prev_done.add(t["task_number"])
        if runnable:
            reordered.append(runnable)
            done_task_numbers.update(t["task_number"] for t in runnable)

    # Append any tasks that weren't covered (claude tasks, mixed-dependency tasks)
    covered = {t["task_number"] for w in reordered for t in w}
    leftover = [t for w in base_waves for t in w if t["task_number"] not in covered]
    if leftover:
        for t in leftover:
            reordered.append([t])

    return reordered


async def run_orchestration(ws: WebSocket, project_id: int, goal: str, resume: bool = False,
                            cancel_event: asyncio.Event | None = None) -> None:
    project = get_project(project_id)
    if not project:
        await ws.send_json({"type": "orch_phase", "phase": "error", "msg": "Project not found."})
        return
    stats = OrchStats()

    if resume:
        saved_tasks = get_resumable_tasks(project_id)
        if not saved_tasks:
            await ws.send_json({"type": "orch_phase", "phase": "error", "msg": "No incomplete tasks found. Project may already be complete."})
            return
        goal = get_last_project_goal(project_id) or "continue project"
        all_tasks = get_all_tasks(project_id)
        await ws.send_json({"type": "orch_plan", "tasks": [
            {"id": t["id"], "task_number": t["task_number"], "title": t["title"],
             "assigned_to": t["assigned_to"], "status": t["status"]}
            for t in all_tasks
        ]})
        await ws.send_json({"type": "orch_phase", "phase": "resuming",
                            "msg": f"Resuming — {len(saved_tasks)} task(s) remaining."})
        append_devlog(project, f"## Resumed\nResuming with {len(saved_tasks)} remaining tasks.")
    else:
        save_project_message(project_id, "user", goal)
        await ws.send_json({"type": "user", "content": goal, "timestamp": datetime.now(timezone.utc).isoformat()})

        planner = _get_master_model()
        await ws.send_json({"type": "orch_phase", "phase": "planning",
                            "msg": f"🧠 {planner.capitalize()} is planning the project..."})

        _plan_start = time.monotonic()

        async def _planning_ticker():
            while True:
                await asyncio.sleep(5)
                elapsed = int(time.monotonic() - _plan_start)
                await safe_send(ws, {"type": "orch_phase", "phase": "planning_tick",
                                     "msg": f"Still planning… {elapsed}s elapsed"})

        _ticker_task = asyncio.create_task(_planning_ticker())
        try:
            tasks = await claude_plan_project(project, goal)
        finally:
            _ticker_task.cancel()

        if not tasks:
            await ws.send_json({"type": "orch_phase", "phase": "error", "msg": "Failed to generate a task plan. Please try again."})
            return

        saved_tasks = save_tasks(project_id, tasks)

        task_summary = [
            {"id": t["id"], "task_number": t["task_number"], "title": t["title"],
             "assigned_to": t["assigned_to"], "status": t["status"]}
            for t in saved_tasks
        ]
        await ws.send_json({"type": "orch_plan", "tasks": task_summary})

        task_list_str = "\n".join(f"{t['task_number']}. {t['title']} (→ {t['assigned_to']})" for t in saved_tasks)
        append_devlog(project, f"## Planning\nGoal: {goal}\n\nTasks:\n{task_list_str}")
        write_project_context(project, goal, saved_tasks)

    # Execute tasks in dependency waves — independent tasks run concurrently
    # T14.4: group by model first to minimise model switches (single-model-at-a-time)
    # T9.5: track which task_numbers have errored so dependents can be blocked
    errored_task_numbers: set[int] = set()
    waves = _group_by_model_then_wave(saved_tasks)

    # T14.7: warm up the first local model before executing any tasks
    first_local_model_agent = next(
        (t.get("assigned_to") for w in waves for t in w
         if t.get("assigned_to") not in ("claude", None, "")),
        None,
    )
    if first_local_model_agent:
        from models import OLLAMA_MODELS as _OM
        first_model_name = _OM.get(first_local_model_agent)
        if first_model_name:
            await safe_send(ws, {"type": "orch_phase", "phase": "warmup",
                                 "msg": f"⚡ Loading {first_local_model_agent} ({first_model_name})…"})
            ok = await warmup_model(first_model_name)
            if not ok:
                logging.warning("Warmup failed for %s — continuing anyway", first_model_name)

    _prev_wave_agent: str | None = None
    for wave in waves:
        if cancel_event and cancel_event.is_set():
            append_devlog(project, "**Cancelled** by user.")
            await ws.send_json({"type": "cancelled"})
            return

        # T14.4: detect model switch and notify user
        wave_agents = {t.get("assigned_to") for t in wave if t.get("assigned_to") not in ("claude", None, "")}
        if len(wave_agents) == 1:
            wave_agent = next(iter(wave_agents))
            if _prev_wave_agent and _prev_wave_agent != wave_agent:
                stats.record_model_switch()
                await safe_send(ws, {"type": "orch_phase", "phase": "model_switch",
                                     "msg": f"🔄 Switching from {_prev_wave_agent} to {wave_agent}…"})
            _prev_wave_agent = wave_agent

        # T9.5: before executing this wave, check if any task is blocked by an errored upstream
        if errored_task_numbers:
            blocked = []
            runnable = []
            for t in wave:
                deps = set(t.get("depends_on") or [])
                blocking = deps & errored_task_numbers
                if blocking:
                    blocked.append((t, blocking))
                else:
                    runnable.append(t)
            for t, blocking in blocked:
                root = next(iter(blocking))
                logging.warning("Task %d blocked by errored task %d", t["task_number"], root)
                update_task(t["id"], status="errored",
                            blocked_by=root,
                            completed_at=datetime.now(timezone.utc).isoformat())
                await ws.send_json({
                    "type": "orch_blocked",
                    "task_id": t["id"],
                    "task_number": t["task_number"],
                    "blocked_by": root,
                    "message": f"Task {t['task_number']} ({t['title']}) blocked — upstream task {root} failed.",
                })
                errored_task_numbers.add(t["task_number"])
            wave = runnable
            if not wave:
                continue

        if len(wave) == 1:
            try:
                await _execute_task(ws, project, wave[0], goal, cancel_event=cancel_event, stats=stats)
                # Check if task ended up errored (3 attempts exhausted)
                refreshed = get_all_tasks(project_id)
                tmap = {t["task_number"]: t for t in refreshed}
                if tmap.get(wave[0]["task_number"], {}).get("status") == "errored":
                    errored_task_numbers.add(wave[0]["task_number"])
            except Exception as e:
                t = wave[0]
                logging.error("Task %d failed: %s", t["task_number"], e)
                append_devlog(project, f"**Task {t['task_number']} ERRORED**: {e}")
                update_task(t["id"], status="errored", completed_at=datetime.now(timezone.utc).isoformat())
                await ws.send_json({"type": "orch_task_done", "task_id": t["id"], "files": [], "error": str(e)})
                errored_task_numbers.add(t["task_number"])
        else:
            results = await asyncio.gather(
                *[_execute_task(ws, project, t, goal, cancel_event=cancel_event, stats=stats) for t in wave],
                return_exceptions=True,
            )
            refreshed = get_all_tasks(project_id)
            tmap = {t["task_number"]: t for t in refreshed}
            for t, result in zip(wave, results):
                if isinstance(result, Exception):
                    logging.error("Task %d failed: %s", t["task_number"], result)
                    append_devlog(project, f"**Task {t['task_number']} ERRORED**: {result}")
                    update_task(t["id"], status="errored", completed_at=datetime.now(timezone.utc).isoformat())
                    await ws.send_json({"type": "orch_task_done", "task_id": t["id"], "files": [], "error": str(result)})
                    errored_task_numbers.add(t["task_number"])
                elif tmap.get(t["task_number"], {}).get("status") == "errored":
                    errored_task_numbers.add(t["task_number"])

    # Automated test phase
    if not (cancel_event and cancel_event.is_set()):
        await run_test_phase(ws, project, cancel_event=cancel_event)

    if cancel_event and cancel_event.is_set():
        return

    # Extract positive lesson if build succeeded on first try with no fix cycles (T8.6)
    _final_tasks = get_all_tasks(project_id)
    _errored_count = sum(1 for t in _final_tasks if t.get("status") == "errored")
    if _errored_count == 0 and not _load_fix_history(project):
        try:
            pos_lesson = await master_text_call(
                "You extract positive coding patterns from successful builds. "
                "Respond with ONE lesson max 20 words, starting with a verb.",
                f"Project '{project['name']}' succeeded without any fix cycles.\n"
                f"Goal: {goal}\n"
                f"Write ONE positive lesson about what the agents did right.",
                max_tokens=80,
            )
            if pos_lesson:
                append_lesson(project, f"[POSITIVE] {pos_lesson.strip()[:100]}",
                              universal=False)
        except Exception as _pos_err:
            logging.debug("Positive lesson extraction failed: %s", _pos_err)

    # Summary
    all_tasks = get_all_tasks(project_id)
    summary = await claude_project_summary(project, goal, all_tasks)

    append_devlog(project, f"## Summary\n\n{summary}")
    git_commit(project["folder_path"], "docs: project complete")
    update_project_status(project_id, "completed")
    # Final context update with completed status + full file list
    project_final = {**project, "status": "completed"}
    write_project_context(project_final, goal, all_tasks)

    # T11.5: smoke test — verify the project actually serves
    try:
        smoke_errors = await run_smoke_test(project)
        if smoke_errors:
            await ws.send_json({"type": "system_alert",
                                "message": "⚠️ Smoke test: " + "; ".join(smoke_errors),
                                "severity": "warning"})
            logging.warning("Smoke test failures for %s: %s", project.get("slug"), smoke_errors)
    except Exception as _smoke_err:
        logging.debug("Smoke test exception: %s", _smoke_err)

    await ws.send_json({"type": "orch_complete", "summary": summary, "slug": project.get("slug", "")})
    stats_summary = stats.to_summary()
    await ws.send_json({"type": "orch_stats", **stats_summary})
    # T14.5: persist stats to DB for quality dashboard
    try:
        update_project_stats(project_id, json.dumps(stats_summary))
    except Exception as _stats_err:
        logging.debug("Failed to save project stats: %s", _stats_err)


async def _execute_task(ws: WebSocket, project: dict, task: dict, goal: str,
                        cancel_event: asyncio.Event | None = None,
                        stats: OrchStats | None = None) -> None:
    tid = task["id"]
    tnum = task["task_number"]
    agent = task["assigned_to"]

    css_exts  = {".css"}
    code_exts = {".html", ".js", ".ts", ".css", ".py", ".json", ".jsx", ".tsx"}
    files_to_create = task.get("files_to_create", [])
    has_code_files = any(
        Path(f).suffix.lower() in code_exts for f in files_to_create
    ) if files_to_create else False
    only_css_files = bool(files_to_create) and all(
        Path(f).suffix.lower() in css_exts for f in files_to_create
    )
    config = _get_config()
    disabled_set = set(config.get("disabled_agents", []))

    # qwen35 is allowed to keep CSS-only tasks; reroute everything else to deepseek
    if agent == "qwen35" and not only_css_files and has_code_files and "deepseek" not in disabled_set:
        logging.info("Task %d: rerouting non-CSS task from qwen35 to deepseek", tnum)
        agent = "deepseek"
    elif agent == "claude" and has_code_files and "deepseek" not in disabled_set:
        logging.info("Task %d: rerouting code task from '%s' to 'deepseek'", tnum, agent)
        agent = "deepseek"

    if agent in disabled_set:
        fallback = next((a for a in ["deepseek", "qwen35", "claude"] if a not in disabled_set), None)
        if fallback:
            logging.info("Task %d: agent '%s' is disabled, rerouting to '%s'", tnum, agent, fallback)
            await ws.send_json({"type": "status", "message": f"⚙️ {agent} is disabled, routing task to {fallback}..."})
            agent = fallback
        else:
            logging.error("Task %d: all agents disabled, cannot execute", tnum)
            await ws.send_json({"type": "orch_task_done", "task_id": tid, "files": [], "error": "All agents disabled"})
            return

    update_task(tid, status="in_progress")

    await ws.send_json({
        "type": "orch_task_start",
        "task_id": tid,
        "task_number": tnum,
        "title": task["title"],
        "assigned_to": agent,
    })

    # Build prompt for worker
    files_to_create = task.get("files_to_create", [])
    file_context = ""
    if tnum > 1:
        all_file_paths = list_project_files(project)
        if all_file_paths:
            # Include ALL existing files for small projects; filter for large ones
            if len(all_file_paths) <= 20:
                relevant_paths = all_file_paths
            else:
                task_text = (task['description'] + " " + " ".join(files_to_create)).lower()
                ALWAYS_INCLUDE = {"index.html", "main.js", "app.js", "game.js", "style.css"}
                relevant_paths = [
                    p for p in all_file_paths
                    if any(part in task_text
                           for part in [p.lower(), p.lower().split("/")[-1].replace(".", "")])
                    or p.lower() in ALWAYS_INCLUDE
                    or p.lower().split("/")[-1] in ALWAYS_INCLUDE
                ]
            existing_files = read_project_files(project, relevant_paths) if relevant_paths else {}
            if existing_files:
                budget = 8000
                file_context = "\n\nExisting project files (use these for reference — do not duplicate them):\n"

                ftc_set = {f.lower() for f in files_to_create}
                def _file_priority(fpath: str) -> int:
                    fl = fpath.lower()
                    if fl in ftc_set or fl.split("/")[-1] in ftc_set:
                        return 0
                    if fl in ("index.html", "src/index.html"):
                        return 1
                    return 2

                priority_caps = {0: 3000, 1: 2000, 2: 1500}
                for fpath, fcontent in sorted(existing_files.items(), key=lambda kv: _file_priority(kv[0])):
                    if budget <= 0:
                        break
                    tier = _file_priority(fpath)
                    cap  = min(priority_caps[tier], budget)
                    snippet = fcontent[:cap]
                    file_context += f"\n--- {fpath} ---\n{snippet}\n"
                    budget -= len(snippet)
                if budget <= 0:
                    file_context += "\n[...truncated for brevity...]\n"

    worker_system = _build_worker_system(project, task_context=task["description"], agent=agent)

    worker_prompt = (
        f"Task {tnum}: {task['title']}\n\n"
        f"Description:\n{task['description']}\n\n"
        f"Files to create: {json.dumps(files_to_create)}\n"
        f"{file_context}"
    )

    history = [{"role": "user", "content": worker_prompt}]

    await ws.send_json({"type": "typing", "agent": agent})

    full = ""
    tok: dict = {}
    if agent == "claude":
        gen = stream_claude(history, system_prompt=worker_system, cancel_event=cancel_event, usage=tok, max_tokens=8192)
    else:
        gen = stream_ollama(agent, history, system_prompt=worker_system, cancel_event=cancel_event, usage=tok)

    async for chunk in gen:
        if cancel_event and cancel_event.is_set():
            break
        await ws.send_json({"type": "chunk", "agent": agent, "content": chunk})
        full += chunk
    # Always close the generator explicitly so _ollama_lock is released immediately
    # instead of waiting for GC — avoids a deadlock in the evaluation step below.
    await gen.aclose()

    await ws.send_json({"type": "done", "agent": agent})

    # Detect Ollama connection failure — fall back to master model
    if agent != "claude" and "[Ollama error:" in full:
        logging.warning("Task %d: %s unavailable, retrying with master model", tnum, agent)
        await ws.send_json({"type": "status", "message": f"⚠️ {agent} unavailable, falling back to master model..."})
        full = ""
        tok = {}
        fallback_agent = _get_master_model()
        await ws.send_json({"type": "typing", "agent": fallback_agent})
        async for chunk in stream_master(history, system_prompt=worker_system, cancel_event=cancel_event, usage=tok, max_tokens=8192):
            if cancel_event and cancel_event.is_set():
                break
            await ws.send_json({"type": "chunk", "agent": fallback_agent, "content": chunk})
            full += chunk
        await ws.send_json({"type": "done", "agent": fallback_agent})
        agent = fallback_agent

    # Check for empty output
    if not full.strip():
        logging.warning("Task %d: %s returned empty output — marking errored", tnum, agent)
        await ws.send_json({
            "type": "orch_phase",
            "phase": f"⚠️ Task {tnum} ({agent}): LLM returned no output — model may be down or unloaded.",
        })
        update_task(tid, status="errored", completed_at=datetime.now(timezone.utc).isoformat())
        await ws.send_json({"type": "orch_task_done", "task_id": tid, "files": []})
        return

    if stats:
        inp_tok = tok.get("input_tokens", len(worker_prompt) // 4)
        out_tok = tok.get("output_tokens", len(full) // 4)
        stats.record(agent, inp_tok, out_tok)
        # Record per-task Claude API cost (Ollama is free/local)
        if agent == "claude":
            task_cost = (inp_tok * CLAUDE_COST_INPUT_PER_M + out_tok * CLAUDE_COST_OUTPUT_PER_M) / 1_000_000
            update_task(tid, cost_usd=round(task_cost, 6))

    save_project_message(project["id"], agent, full.strip(), task_id=tid)

    files = extract_files_from_response(full)
    if not files:
        files = infer_files_from_codeblocks(full, files_to_create)
        if files:
            logging.info("Task %d: FILE: markers absent — inferred %d file(s) from code blocks", tnum, len(files))
    else:
        files = apply_filename_hints(files, files_to_create)

    # Detect truncated output — if no files extracted and response is suspiciously short,
    # escalate to Claude immediately rather than wasting an evaluate round-trip
    if not files and len(full.strip()) < 200 and agent != "claude" and _is_claude_available():
        logging.warning("Task %d: %s returned only %d chars with no files — escalating to Claude", tnum, agent, len(full.strip()))
        await ws.send_json({"type": "status", "message": f"⚙️ Task {tnum}: DeepSeek output too short — escalating to Claude..."})
        escalate_history = [{"role": "user", "content": worker_prompt}]
        await ws.send_json({"type": "typing", "agent": "claude"})
        full = ""
        tok2: dict = {}
        async for chunk in stream_claude(escalate_history, system_prompt=worker_system, cancel_event=cancel_event, usage=tok2):
            if cancel_event and cancel_event.is_set():
                break
            await ws.send_json({"type": "chunk", "agent": "claude", "content": chunk})
            full += chunk
        await ws.send_json({"type": "done", "agent": "claude"})
        agent = "claude"
        if stats:
            stats.record("claude", tok2.get("input_tokens", 0), tok2.get("output_tokens", 0))
        files = extract_files_from_response(full)
        if not files:
            files = infer_files_from_codeblocks(full, files_to_create)
            if files:
                logging.info("Task %d: escalation — inferred %d file(s) from code blocks", tnum, len(files))
        else:
            files = apply_filename_hints(files, files_to_create)

    written = write_project_files(project, files) if files else []

    for fp in written:
        await ws.send_json({"type": "orch_file", "path": fp})

    if written:
        git_commit(project["folder_path"], f"Task {tnum}: {task['title']}")

    files_str = ", ".join(written) if written else "(no files extracted)"
    append_devlog(project, f"**Task {tnum}** ({agent}): {task['title']}\nFiles: {files_str}")

    # ── Evaluation + retry budget (T9.4) ─────────────────────────────────────
    # If cancelled, mark task pending (so it can be resumed) and return early.
    if cancel_event and cancel_event.is_set():
        update_task(tid, status="pending")
        await ws.send_json({"type": "orch_task_done", "task_id": tid, "files": written})
        return

    # Attempt 1: initial evaluation
    evaluation = await claude_evaluate_task(project, task, full)
    update_task(tid, evaluation_json=json.dumps(evaluation))

    if evaluation.get("approved", False):
        update_task(tid, status="done", retry_count=0,
                    completed_at=datetime.now(timezone.utc).isoformat())
        _all_tasks = get_all_tasks(project["id"])
        write_project_context(project, goal, _all_tasks)
        await ws.send_json({"type": "orch_task_done", "task_id": tid, "files": written})
        return

    if not evaluation.get("feedback"):
        # No feedback = nothing to retry with, accept
        update_task(tid, status="done", retry_count=0,
                    completed_at=datetime.now(timezone.utc).isoformat())
        _all_tasks = get_all_tasks(project["id"])
        write_project_context(project, goal, _all_tasks)
        await ws.send_json({"type": "orch_task_done", "task_id": tid, "files": written})
        return

    # Attempt 2: retry with feedback (same worker)
    logging.info("Task %d: not approved (attempt 1), retrying — feedback: %s",
                 tnum, evaluation.get("feedback", "")[:120])
    await ws.send_json({"type": "status",
                        "message": f"⚙️ Task {tnum}: refining output based on review feedback..."})

    def _build_retry_file_ctx(budget: int = 6000) -> str:
        all_written = list_project_files(project)
        if not all_written:
            return ""
        rfd = read_project_files(project, all_written)
        if not rfd:
            return ""
        ctx = "\n\nCurrent project files after your previous attempt:\n"
        for fpath, fcontent in rfd.items():
            if budget <= 0:
                break
            cap = min(2000, budget)
            ctx += f"\n--- {fpath} ---\n{fcontent[:cap]}\n"
            budget -= min(len(fcontent), cap)
        return ctx

    retry_file_context = _build_retry_file_ctx()
    retry_prompt = (
        f"The previous output was reviewed and needs changes:\n"
        f"Feedback: {evaluation['feedback']}\n\n"
        f"{retry_file_context}\n"
        f"Please fix and resubmit the corrected file(s). Start each code block's first line with "
        f"// FILE: relative/path/to/file.ext"
    )
    retry_history = [
        {"role": "user", "content": worker_prompt},
        {"role": "assistant", "content": full},
        {"role": "user", "content": retry_prompt},
    ]
    retry_agent = agent  # attempt 2 uses the same worker
    await ws.send_json({"type": "typing", "agent": retry_agent})
    retry_full = ""
    gen2 = (stream_claude(retry_history, system_prompt=worker_system, cancel_event=cancel_event)
            if retry_agent == "claude"
            else stream_ollama(retry_agent, retry_history, system_prompt=worker_system,
                               cancel_event=cancel_event))
    async for chunk in gen2:
        if cancel_event and cancel_event.is_set():
            break
        await ws.send_json({"type": "chunk", "agent": retry_agent, "content": chunk})
        retry_full += chunk
    await gen2.aclose()  # release _ollama_lock immediately
    await ws.send_json({"type": "done", "agent": retry_agent})
    save_project_message(project["id"], retry_agent, retry_full.strip(), task_id=tid)
    update_task(tid, retry_count=1)

    retry_files = extract_files_from_response(retry_full)
    if not retry_files:
        retry_files = infer_files_from_codeblocks(retry_full, files_to_create)
        if retry_files:
            logging.info("Task %d: retry — inferred %d file(s) from code blocks", tnum, len(retry_files))
    else:
        retry_files = apply_filename_hints(retry_files, files_to_create)
    retry_written = write_project_files(project, retry_files) if retry_files else []
    for fp in retry_written:
        await ws.send_json({"type": "orch_file", "path": fp})
    if retry_written:
        git_commit(project["folder_path"], f"Task {tnum} (retry): {task['title']}")
        written = retry_written

    if cancel_event and cancel_event.is_set():
        update_task(tid, status="pending")
        await ws.send_json({"type": "orch_task_done", "task_id": tid, "files": written})
        return

    retry_eval = await claude_evaluate_task(project, task, retry_full)
    update_task(tid, evaluation_json=json.dumps(retry_eval))

    if retry_eval.get("approved", False):
        update_task(tid, status="done", completed_at=datetime.now(timezone.utc).isoformat())
        _all_tasks = get_all_tasks(project["id"])
        write_project_context(project, goal, _all_tasks)
        await ws.send_json({"type": "orch_task_done", "task_id": tid, "files": written})
        return

    # Attempt 3: escalate to Claude (T9.4 second retry)
    if not _is_claude_available() or agent == "claude":
        # No Claude available or already using Claude — fail the task
        logging.warning("Task %d: two attempts failed, no Claude escalation available — marking errored", tnum)
        update_task(tid, status="errored", completed_at=datetime.now(timezone.utc).isoformat())
        await ws.send_json({
            "type": "orch_phase",
            "phase": f"⚠️ Task {tnum} failed quality check after retry: {retry_eval.get('feedback', '')}",
        })
        await ws.send_json({"type": "orch_task_done", "task_id": tid, "files": written})
        return

    logging.info("Task %d: two attempts failed — escalating to Claude (attempt 3)", tnum)
    await ws.send_json({"type": "status",
                        "message": "⚙️ Escalating to Claude for a higher quality fix..."})

    escalate_ctx = _build_retry_file_ctx()
    escalate_prompt = (
        f"Two previous attempts failed evaluation.\n"
        f"Attempt 1 feedback: {evaluation.get('feedback', '')}\n"
        f"Attempt 2 feedback: {retry_eval.get('feedback', '')}\n\n"
        f"{escalate_ctx}\n"
        f"Produce the final, correct version of the required file(s). "
        f"Start each code block's first line with // FILE: path/to/file.ext"
    )
    escalate_history = [
        {"role": "user", "content": worker_prompt},
        {"role": "assistant", "content": full},
        {"role": "user", "content": retry_prompt},
        {"role": "assistant", "content": retry_full},
        {"role": "user", "content": escalate_prompt},
    ]
    await ws.send_json({"type": "typing", "agent": "claude"})
    escalate_full = ""
    async for chunk in stream_claude(escalate_history, system_prompt=worker_system,
                                      cancel_event=cancel_event):
        if cancel_event and cancel_event.is_set():
            break
        await ws.send_json({"type": "chunk", "agent": "claude", "content": chunk})
        escalate_full += chunk
    await ws.send_json({"type": "done", "agent": "claude"})
    save_project_message(project["id"], "claude", escalate_full.strip(), task_id=tid)
    update_task(tid, retry_count=2, escalated_to="claude")

    escalate_files = extract_files_from_response(escalate_full)
    if not escalate_files:
        escalate_files = infer_files_from_codeblocks(escalate_full, files_to_create)
    else:
        escalate_files = apply_filename_hints(escalate_files, files_to_create)
    escalate_written = write_project_files(project, escalate_files) if escalate_files else []
    for fp in escalate_written:
        await ws.send_json({"type": "orch_file", "path": fp})
    if escalate_written:
        git_commit(project["folder_path"], f"Task {tnum} (escalated): {task['title']}")
        written = escalate_written

    final_eval = await claude_evaluate_task(project, task, escalate_full)
    update_task(tid, evaluation_json=json.dumps(final_eval))

    if not final_eval.get("approved", False):
        # T9.4: all three attempts failed → mark as "failed" (distinct from "errored")
        logging.warning("Task %d: all 3 attempts failed — marking failed", tnum)
        update_task(tid, status="errored",
                    completed_at=datetime.now(timezone.utc).isoformat())
        await ws.send_json({
            "type": "orch_phase",
            "phase": f"⚠️ Task {tnum} failed after 3 attempts: {final_eval.get('feedback', '')}",
        })
        await ws.send_json({"type": "orch_task_done", "task_id": tid, "files": written})
        return

    update_task(tid, status="done", completed_at=datetime.now(timezone.utc).isoformat())
    # Refresh PROJECT_CONTEXT.md so fix/query calls see up-to-date task statuses
    _all_tasks = get_all_tasks(project["id"])
    write_project_context(project, goal, _all_tasks)
    await ws.send_json({"type": "orch_task_done", "task_id": tid, "files": written})


def _build_worker_system(project: dict, task_context: str = "", agent: str = "") -> str:
    slug = project.get("slug", "project")
    skills_block = load_skills(task_context) if task_context else ""
    agent_rules   = _load_agent_rules()

    # Inject the most recent lessons so workers don't repeat known mistakes
    proj_lessons    = read_project_lessons(project, limit=3)
    universal_les   = read_universal_lessons(limit=4)
    lessons_block   = ""
    if proj_lessons or universal_les:
        lessons_block = "\n\nLEARNED LESSONS — avoid repeating these past mistakes:\n"
        if universal_les:
            lessons_block += universal_les + "\n"
        if proj_lessons:
            lessons_block += f"[{project['name']}-specific]\n" + proj_lessons

    # Inject this agent's known weaknesses (T8.3)
    agent_warnings = _load_agent_weaknesses(agent) if agent else ""
    warnings_block = ""
    if agent_warnings:
        warnings_block = f"\n\nKNOWN ISSUES TO AVOID (patterns this agent has missed before):\n{agent_warnings}"

    return textwrap.dedent(f"""\
        You are implementing a specific task for project '{project['name']}'.

        WORKFLOW — follow in strict order:
        1. GATHER CONTEXT: Read every provided file carefully before writing a single line of code.
           Identify all existing IDs, function names, global variables, and import paths.
        2. PLAN: Add a brief plan comment (2-4 lines) near the top of your first code block:
             HTML: <!-- PLAN: what this file does and how it connects -->
             JS:   // PLAN: ...
             CSS:  /* PLAN: ... */
        3. IMPLEMENT: Write complete, immediately-runnable code. Zero TODOs, zero placeholders.
        4. VERIFY: Before finishing, confirm every <script src>, getElementById, function call,
           and window.global referenced in your output actually exists in the project.

        IMPLEMENTATION DISCIPLINE:
        - Only build what the task description explicitly requests. No extra features.
        - Do NOT refactor or "improve" existing code unless the task says to.
        - Do NOT create extra files beyond what files_to_create specifies.
        - Validate only at system boundaries — do not guard against impossible scenarios.

        ⚠️  CRITICAL — FILE MARKER REQUIRED ON FIRST LINE OF EVERY CODE BLOCK:
        The VERY FIRST LINE inside each ``` block MUST be the file path comment:
          HTML:       <!-- FILE: index.html -->
          JavaScript: // FILE: js/game.js
          CSS:        /* FILE: css/style.css */
          Python:     # FILE: script.py
        Without this marker, the file WILL NOT BE SAVED. Do not skip it.
        Do NOT write any explanation text before or after code blocks.

        QUALITY RULES:
        - Code must be COMPLETE and immediately runnable — NO TODOs, NO placeholders, NO "add logic here".
        - NEVER add a <script src="X"> in HTML unless X is either already in the project or you are
          creating it in this same response.
        - No ES module import/export unless all files use type="module". Default: use window globals.
        - All IDs, class names, and function names must exactly match what the task spec says.
        - For HTML: include <!DOCTYPE html>, <meta charset="UTF-8">, <meta name="viewport">.
        - For games/canvas: include both keyboard AND touch/swipe controls.
        - CANVAS INITIALIZATION: Any JS file that uses canvas MUST obtain its own context reference
          via document.getElementById() inside a DOMContentLoaded listener or init function.
          Never assume `ctx`, `canvas`, etc. are already global — always get them yourself.
        - GAME LOOP: If your task includes a game loop, you MUST call requestAnimationFrame or
          setInterval to kick it off inside DOMContentLoaded. The loop runs update() then render().

        ENVIRONMENT:
        - Headless Mac Mini. No display, no GUI. Users access via browser.
        - Project URL: http://{SERVER_HOST}/play/{slug}/
        - Asset paths MUST be relative (e.g. 'js/game.js' not '/js/game.js').
        {lessons_block}{warnings_block}
    """).strip() + ("\n\n" + agent_rules if agent_rules else "") + skills_block


async def run_test_phase(ws: WebSocket, project: dict, cancel_event: asyncio.Event | None = None) -> None:
    files = read_project_files(project)
    if not files:
        return

    await ws.send_json({"type": "orch_phase", "phase": "testing",
                        "msg": "🔍 Claude is reviewing the code for bugs..."})

    file_list = list(files.keys())
    file_context_parts = []
    budget = 8000
    for path, content in files.items():
        chunk = f"=== {path} ===\n{content}"
        if len(chunk) > budget:
            chunk = chunk[:budget] + "\n[...truncated...]"
        file_context_parts.append(chunk)
        budget -= len(chunk)
        if budget <= 0:
            break
    file_context = "\n\n".join(file_context_parts)

    test_system = textwrap.dedent(f"""\
        You are a code reviewer for a browser web project. Be precise and concrete.
        Files in this project: {json.dumps(file_list)}

        Check ONLY for these CONCRETE, OBJECTIVE bugs (not style suggestions):
        1. HTML <script src="X"> or <link href="X"> where X is NOT in the file list above
        2. JS calls document.getElementById("X") or querySelector("#X")/(".X") where that ID/class
           is NOT present in index.html
        3. Button has onclick="fn()" or addEventListener where fn is never defined in any file
        4. JS uses `import ... from './file'` without type="module" on the script tag in HTML
        5. A variable or function used in file A was supposed to be defined in file B but isn't
        6. Canvas game: game loop never starts (no initial requestAnimationFrame or setInterval call)
        7. Obvious syntax errors (unclosed brackets, undefined variables on first use)

        For each real bug: BUG [file]: <issue> → FIX: <exact fix>
        If everything is correct: respond with exactly "LGTM ✓"
        Do NOT suggest improvements, refactors, or style changes. Only broken things.
    """)

    review_prompt = f"Review this project for the bugs listed:\n\n{file_context}"

    master = _get_master_model()
    await ws.send_json({"type": "typing", "agent": master})
    test_output = await master_json_call(test_system, review_prompt, max_tokens=1024)
    if test_output:
        await ws.send_json({"type": "chunk", "agent": master, "content": test_output})
        await ws.send_json({"type": "done", "agent": master})
        save_project_message(project["id"], master, test_output)

    if not test_output:
        await ws.send_json({"type": "orch_phase", "phase": "test_warn",
                            "msg": "⚠️ Code review LLM returned no output — review skipped."})
        return

    lgtm = "LGTM" in test_output.upper() and "BUG" not in test_output.upper()
    if lgtm:
        await ws.send_json({"type": "orch_phase", "phase": "test_pass",
                            "msg": "✅ Code review passed — no issues found."})
        return

    # Bugs found — fix them
    await ws.send_json({"type": "orch_phase", "phase": "fixing",
                        "msg": "🔧 Fixing issues found in code review..."})

    fix_system = _build_worker_system(project)
    fix_prompt = (
        f"Code review found these bugs:\n{test_output}\n\n"
        f"Current project files:\n{file_context}\n\n"
        f"Rewrite ONLY the files that need changes to fix all listed bugs. "
        f"Output the complete corrected file content(s) using FILE: markers on the first line."
    )

    await ws.send_json({"type": "typing", "agent": master})
    fix_output = ""
    async for chunk in stream_master([{"role": "user", "content": fix_prompt}],
                                      system_prompt=fix_system, cancel_event=cancel_event,
                                      max_tokens=8192):
        if cancel_event and cancel_event.is_set():
            return
        await ws.send_json({"type": "chunk", "agent": master, "content": chunk})
        fix_output += chunk
    await ws.send_json({"type": "done", "agent": master})

    save_project_message(project["id"], master, fix_output.strip())
    fixed = write_project_files(project, extract_files_from_response(fix_output))
    for fp in fixed:
        await ws.send_json({"type": "orch_file", "path": fp})
    if fixed:
        git_commit(project["folder_path"], "fix: code review auto-fixes")
    append_devlog(project, f"## Code Review Fix\nBugs fixed in: {', '.join(fixed) or 'none'}")
    await ws.send_json({"type": "orch_phase", "phase": "test_fixed",
                        "msg": f"✅ Fixed {len(fixed)} file(s) — running second review pass..."})

    # Second review pass
    await ws.send_json({"type": "typing", "agent": master})
    second_output = await master_json_call(test_system, review_prompt, max_tokens=1024)
    if second_output:
        await ws.send_json({"type": "chunk", "agent": master, "content": second_output})
        await ws.send_json({"type": "done", "agent": master})
        save_project_message(project["id"], master, second_output)

    second_lgtm = (not second_output) or \
                  ("LGTM" in second_output.upper() and "BUG" not in second_output.upper())
    if second_lgtm:
        await ws.send_json({"type": "orch_phase", "phase": "test_pass",
                            "msg": "✅ Second review passed — project is ready."})
    else:
        await ws.send_json({"type": "orch_phase", "phase": "test_warn",
                            "msg": "⚠️ Some issues may remain after two review passes — check manually."})


async def run_fix_task(ws: WebSocket, project_id: int, feedback: str,
                       cancel_event: asyncio.Event | None = None) -> None:
    project = get_project(project_id)
    if not project:
        return

    files = read_project_files(project)

    context_parts, budget = [], 8000
    for path, content in files.items():
        part = f"=== {path} ===\n{content}"
        context_parts.append(part[:budget])
        budget -= len(part)
        if budget <= 0:
            break
    file_context = "\n\n".join(context_parts)

    # Prepend project context so the fixer knows the original goal and task history
    proj_ctx = load_project_context(project)
    proj_ctx_block = f"Project context:\n{proj_ctx}\n\n" if proj_ctx else ""

    fix_system = _build_worker_system(project, task_context=feedback, agent=agent_used)
    fix_prompt = (
        f"{proj_ctx_block}"
        f"User feedback / request:\n{feedback}\n\n"
        f"Current project files:\n{file_context}\n\n"
        f"Analyze what needs to change, then output the COMPLETE corrected file(s) using FILE: markers. "
        f"Only output files that actually need to change. Make sure every fix is complete and working."
    )

    save_project_message(project_id, "user", feedback)
    await ws.send_json({"type": "user", "content": feedback,
                        "timestamp": datetime.now(timezone.utc).isoformat()})
    await ws.send_json({"type": "agent_count", "count": 1})

    fix_stats = OrchStats()
    full = ""
    tok: dict = {}
    agent_used = _get_master_model()
    await ws.send_json({"type": "typing", "agent": agent_used})

    async for chunk in stream_master([{"role": "user", "content": fix_prompt}],
                                      system_prompt=fix_system, cancel_event=cancel_event, usage=tok):
        if cancel_event and cancel_event.is_set():
            await ws.send_json({"type": "cancelled"})
            return
        await ws.send_json({"type": "chunk", "agent": agent_used, "content": chunk})
        full += chunk

    await ws.send_json({"type": "done", "agent": agent_used})
    fix_stats.record(agent_used,
                     tok.get("input_tokens", len(fix_prompt) // 4),
                     tok.get("output_tokens", len(full) // 4))
    save_project_message(project_id, agent_used, full.strip())

    fixed = write_project_files(project, extract_files_from_response(full))
    for fp in fixed:
        await ws.send_json({"type": "orch_file", "path": fp})
    if fixed:
        git_commit(project["folder_path"], f"fix: {feedback[:60]}")
    append_devlog(project, f"## Fix\nFeedback: {feedback}\nFiles updated: {', '.join(fixed) or 'none'}")

    _append_fix_history(project, feedback, agent_used, list(fixed), approved=True)

    fix_summary = f"Fixed files: {', '.join(fixed)}. Agent: {agent_used}."
    lesson = await extract_and_save_lesson(project, feedback, fix_summary)

    if fixed and not (cancel_event and cancel_event.is_set()):
        await run_test_phase(ws, project, cancel_event=cancel_event)

    slug = project.get("slug", "")
    await ws.send_json({"type": "fix_complete", "files_fixed": fixed,
                        "project_slug": slug, "lesson": lesson})
    await ws.send_json({"type": "orch_stats", **fix_stats.to_summary()})
