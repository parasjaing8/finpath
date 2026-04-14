"""
AI Group Chat Server + Multi-Agent Development Platform
Runs on Mac Mini (192.168.0.130), port 8080
Access from any home network device: http://192.168.0.130:8080
"""
from __future__ import annotations
import asyncio
import gc
from contextlib import aclosing
from collections import defaultdict, deque
import json
import logging
import logging.handlers
import os
import re
import statistics
import subprocess
import textwrap
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import psutil

_log_fmt = logging.Formatter("%(asctime)s  %(levelname)s  %(message)s", datefmt="%H:%M:%S")
_log_handler_stream = logging.StreamHandler()
_log_handler_stream.setFormatter(_log_fmt)
_log_handler_file = logging.handlers.RotatingFileHandler(
    Path(__file__).parent / "ai-chat.log",
    maxBytes=int(os.getenv("LOG_MAX_BYTES", str(10 * 1024 * 1024))),
    backupCount=int(os.getenv("LOG_BACKUP_COUNT", "3")),
    encoding="utf-8",
)
_log_handler_file.setFormatter(_log_fmt)


class _JsonFormatter(logging.Formatter):
    """JSONL log formatter — one JSON object per line for machine parsing."""

    def format(self, record: logging.LogRecord) -> str:
        obj: dict = {
            "ts":      datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level":   record.levelname,
            "logger":  record.name,
            "module":  record.module,
            "line":    record.lineno,
            "msg":     record.getMessage(),
        }
        # Carry any extra structured fields set via logging.info(..., extra={...})
        for key in ("project_slug", "task_id", "agent", "model", "duration_s", "tokens"):
            val = record.__dict__.get(key)
            if val is not None:
                obj[key] = val
        if record.exc_info:
            obj["exc"] = self.formatException(record.exc_info)
        return json.dumps(obj, ensure_ascii=False)


_log_handler_json = logging.handlers.RotatingFileHandler(
    Path(__file__).parent / "ai-chat.jsonl",
    maxBytes=int(os.getenv("LOG_MAX_BYTES", str(10 * 1024 * 1024))),
    backupCount=int(os.getenv("LOG_BACKUP_COUNT", "3")),
    encoding="utf-8",
)
_log_handler_json.setFormatter(_JsonFormatter())

logging.basicConfig(
    level=logging.INFO,
    handlers=[_log_handler_stream, _log_handler_file, _log_handler_json],
)

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

load_dotenv(Path(__file__).parent / ".env")

# ── Config ────────────────────────────────────────────────────────────────────
# Import AFTER load_dotenv so environment overrides in .env are visible.
from config import (  # noqa: E402
    OLLAMA_BASE, KEEP_ALIVE, DB_PATH, STATIC_PATH, PROJECTS_DIR,
    MEMORY_DIR, BACKUP_DIR, CONTEXT_LEN, DISPLAY_LEN, SERVER_HOST,
    CLAUDE_COST_INPUT_PER_M, CLAUDE_COST_OUTPUT_PER_M,
    CUSTOM_AGENTS_PATH, SKILLS_DIR, BACKUP_KEEP_COUNT, BACKUP_INTERVAL,
    OLLAMA_CONCURRENCY, BUILD_WORKERS, AUTH_TOKENS, SINGLE_MODEL_MODE,
)
MEMORY_DIR.mkdir(exist_ok=True)

_BUILTIN_AGENTS = {"deepseek"}

OLLAMA_MODELS: dict[str, str] = {
    "deepseek": "deepseek-coder-v2:16b-lite-instruct-q5_K_S",  # primary coder — reliable 16B
}

MODEL_CTX: dict[str, int] = {
    "deepseek": 16384,
    "qwen35":   32768,
}

MODEL_PREDICT: dict[str, int] = {
    "deepseek": 8192,   # 16B model is slow; keep conservative
    "qwen35":   12288,  # 9B model is faster; larger output budget
}

AGENT_LABEL: dict[str, str] = {
    "claude":   "Claude",
    "deepseek": "DeepSeek",
    "user":     "Paras",
}


def _load_custom_agents() -> None:
    if not CUSTOM_AGENTS_PATH.is_file():
        return
    try:
        data: dict = json.loads(CUSTOM_AGENTS_PATH.read_text(encoding="utf-8"))
        for key, info in data.items():
            if key in _BUILTIN_AGENTS:
                continue
            OLLAMA_MODELS[key] = info["model"]
            AGENT_LABEL[key] = info.get("label", key.capitalize())
    except Exception as e:
        logging.warning("Failed to load custom_agents.json: %s", e)


def _save_custom_agents() -> None:
    custom = {
        k: {"model": v, "label": AGENT_LABEL.get(k, k.capitalize())}
        for k, v in OLLAMA_MODELS.items()
        if k not in _BUILTIN_AGENTS
    }
    CUSTOM_AGENTS_PATH.write_text(json.dumps(custom, indent=2), encoding="utf-8")


# ── Safe local command execution (SSH-style) ─────────────────────────────────

_EXEC_COMMANDS: dict[str, list[str]] = {
    "ollama-list":    ["/usr/local/bin/ollama", "list"],
    "ollama-ps":      ["/usr/local/bin/ollama", "ps"],
    "disk-usage":     ["df", "-h"],
    "uptime":         ["uptime"],
    "server-log":     ["tail", "-n", "100", "/tmp/ai-chat.log"],
    "server-status":  ["pgrep", "-lf", "uvicorn"],
    "memory":         ["vm_stat"],
}


async def execute_ssh(cmd_key: str, timeout: int = 30) -> dict:
    argv = _EXEC_COMMANDS.get(cmd_key)
    if argv is None:
        allowed = list(_EXEC_COMMANDS.keys())
        raise ValueError(f"Unknown command key {cmd_key!r}. Allowed: {allowed}")
    try:
        proc = await asyncio.create_subprocess_exec(
            *argv,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout_b, stderr_b = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            return {"ok": False, "cmd": cmd_key, "stdout": "",
                    "stderr": f"Command timed out after {timeout}s", "returncode": -1}
        return {
            "ok":         proc.returncode == 0,
            "cmd":        cmd_key,
            "stdout":     stdout_b.decode("utf-8", errors="replace").strip(),
            "stderr":     stderr_b.decode("utf-8", errors="replace").strip(),
            "returncode": proc.returncode,
        }
    except FileNotFoundError:
        return {"ok": False, "cmd": cmd_key, "stdout": "",
                "stderr": f"Executable not found: {argv[0]!r}", "returncode": -1}
    except Exception as exc:
        return {"ok": False, "cmd": cmd_key, "stdout": "", "stderr": str(exc), "returncode": -1}


# ── Runtime config (mutable via API) ─────────────────────────────────────────

_config: dict = {
    "master_model":    "claude",
    "claude_enabled":  True,
    "disabled_agents": [],
}
_config_lock = asyncio.Lock()
_agent_lock  = asyncio.Lock()  # guards OLLAMA_MODELS and AGENT_LABEL mutations


def get_enabled_agents() -> list[str]:
    disabled = set(_config.get("disabled_agents", []))
    all_agents = ["claude"] + list(OLLAMA_MODELS.keys())
    return [a for a in all_agents if a not in disabled]


def get_master_model() -> str:
    disabled = set(_config.get("disabled_agents", []))
    if _config["claude_enabled"] and os.getenv("ANTHROPIC_API_KEY", "") and "claude" not in disabled:
        return _config["master_model"]   # "claude" or a local model key
    # Claude offline/disabled — honour configured master if it is a known local model
    master = _config["master_model"]
    if master != "claude":
        # "qwen" is an alias users set via /settings/master; map to OLLAMA key
        if master == "qwen" and "qwen35" in OLLAMA_MODELS and "qwen35" not in disabled:
            return "qwen35"
        if master in OLLAMA_MODELS and master not in disabled:
            return master
    # Fall back to the first enabled local model rather than always deepseek
    for agent in OLLAMA_MODELS:
        if agent not in disabled:
            return agent
    return "deepseek"  # last resort — no enabled agents at all


def is_claude_available() -> bool:
    return _config["claude_enabled"] and bool(os.getenv("ANTHROPIC_API_KEY", ""))


SYSTEM_PROMPTS = {
    "claude": (
        "You are Claude, an AI orchestrator and senior engineer in a collaborative group chat. "
        "Other AI participants: DeepSeek (primary coder, 16B), Qwen (CSS/UI specialist, 9B). "
        "User is Paras, an indie founder building software products on a headless Mac Mini. "
        "Your responsibilities: plan projects, coordinate agents, evaluate output, and answer questions. "
        "Delegate all code writing to DeepSeek; delegate CSS-only tasks to Qwen. "
        "Before advising on changes, gather context (ask what exists, what broke, what was expected). "
        "Be concise and direct. Do not add features beyond what Paras asked for."
    ),
    "deepseek": (
        "You are DeepSeek Coder, the primary coding specialist in a group chat. "
        "Other participants: Claude (orchestrator/planner), Qwen (CSS/styling only). "
        "User is Paras, an indie founder. "
        "Write clean, production-quality code. Build on previous context. "
        "Only implement what was asked — do not add unrequested features. "
        "Be concise: output code, not prose."
    ),
    "qwen35": (
        "You are Qwen, a UI/UX and CSS specialist in a group chat. "
        "Other participants: Claude (orchestrator), DeepSeek (coding). "
        "User is Paras, an indie founder. "
        "Create beautiful, polished CSS — dark themes, neon accents, smooth animations, responsive layouts. "
        "Output only CSS unless explicitly asked otherwise. Be concise and precise. "
        "Do not add unrequested features or modify HTML/JS unless specifically asked."
    ),
}


# ── Backup ────────────────────────────────────────────────────────────────────

def _run_backup() -> dict:
    import shutil
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    dest = BACKUP_DIR / ts
    dest.mkdir(parents=True, exist_ok=True)
    copied: list[str] = []
    errors: list[str] = []
    if DB_PATH.is_file():
        try:
            shutil.copy2(DB_PATH, dest / "chat.db")
            copied.append("chat.db")
        except Exception as e:
            errors.append(f"chat.db: {e}")
    if MEMORY_DIR.is_dir():
        try:
            shutil.copytree(MEMORY_DIR, dest / "memory", dirs_exist_ok=True)
            copied.append("memory/")
        except Exception as e:
            errors.append(f"memory/: {e}")
    all_backups = sorted(BACKUP_DIR.iterdir(), key=lambda p: p.name)
    for old in all_backups[:-BACKUP_KEEP_COUNT]:
        try:
            shutil.rmtree(old)
        except Exception:
            pass
    status = {"timestamp": ts, "copied": copied, "errors": errors}
    if errors:
        logging.warning("Backup completed with errors: %s", errors)
    else:
        logging.info("Backup completed: %s", copied)
    return status


async def _backup_scheduler() -> None:
    await asyncio.sleep(60)
    while True:
        await asyncio.to_thread(_run_backup)
        await asyncio.sleep(BACKUP_INTERVAL)


# ── Configure sub-modules ────────────────────────────────────────────────────

import db as _db
import models as _models
import orchestration as _orch
from skills_mod import SKILLS_DIR as _SKILLS_DIR_MOD, load_skills as _load_skills

# Wire up db module
_db.configure(db_path=DB_PATH, projects_dir=PROJECTS_DIR, display_len=DISPLAY_LEN)

# Wire up models module
_models.configure(
    ollama_base=OLLAMA_BASE,
    keep_alive=KEEP_ALIVE,
    ollama_models=OLLAMA_MODELS,
    model_ctx=MODEL_CTX,
    model_predict=MODEL_PREDICT,
    agent_label=AGENT_LABEL,
    system_prompts=SYSTEM_PROMPTS,
    claude_cost_input=CLAUDE_COST_INPUT_PER_M,
    claude_cost_output=CLAUDE_COST_OUTPUT_PER_M,
    get_master_model=get_master_model,
    is_claude_available=is_claude_available,
    ollama_concurrency=OLLAMA_CONCURRENCY,
    single_model_mode=SINGLE_MODEL_MODE,
)

# Wire up orchestration module
_orch.configure(
    server_host=SERVER_HOST,
    memory_dir=MEMORY_DIR,
    context_len=CONTEXT_LEN,
    get_master_model=get_master_model,
    is_claude_available=is_claude_available,
    get_enabled_agents=get_enabled_agents,
    get_config=lambda: _config,
)


# ── Re-exports for backward compatibility (tests + internal references) ──────

from db import (  # noqa: E402, F401
    _db_connect, init_db, save_message, load_history, slugify,
    create_project, get_project, list_projects, update_project_status, update_project_stats,
    save_project_message, load_project_messages,
    save_tasks, get_pending_tasks, reset_stuck_tasks, get_resumable_tasks,
    reset_all_stuck_tasks,
    get_last_project_goal, get_all_tasks, update_task,
)
from files_io import (  # noqa: E402, F401
    extract_files_from_response, write_project_files,
    list_project_files, read_project_files,
    git_init, git_commit, init_devlog, append_devlog,
)
from models import (  # noqa: E402, F401
    OrchStats,
    fetch_model_info as _fetch_model_info,
    check_ollama_online, ollama_monitor as _ollama_monitor,
    build_claude_messages, build_ollama_messages,
    check_claude_online, parse_mentions,
    stream_claude, stream_ollama,
    ollama_json_call as _ollama_json_call,
    master_json_call as _master_json_call,
    master_text_call as _master_text_call,
    stream_master,
)
from orchestration import (  # noqa: E402, F401
    read_universal_lessons, read_project_lessons, append_lesson,
    extract_and_save_lesson,
    detect_intent, detect_intent_in_project,
    stream_project_query, claude_plan_project, claude_evaluate_task,
    claude_project_summary,
    safe_send, run_orchestration, run_fix_task, run_test_phase,
    close_project_thread, find_relevant_lessons,
)


# ── System stats ─────────────────────────────────────────────────────────────

_net_snap: dict = {}

def _init_net_snap() -> None:
    c = psutil.net_io_counters()
    _net_snap["sent"]  = c.bytes_sent
    _net_snap["recv"]  = c.bytes_recv
    _net_snap["ts"]    = time.monotonic()

_init_net_snap()
_server_start = time.monotonic()

# ── Session auth ─────────────────────────────────────────────────────────────
# Optional token-based auth.  When AUTH_TOKENS is empty every connection is
# treated as the single implicit user (preserves single-user behaviour).

_VALID_TOKENS: frozenset[str] = (
    frozenset(t.strip() for t in AUTH_TOKENS.split(",") if t.strip())
    if AUTH_TOKENS else frozenset()
)

def _auth_enabled() -> bool:
    return bool(_VALID_TOKENS)

def _validate_token(token: str) -> bool:
    """Return True when auth is disabled, or when the token is valid."""
    if not _auth_enabled():
        return True
    return token in _VALID_TOKENS


# ── Connected WebSocket clients registry ─────────────────────────────────────
# Clients are grouped by project subscription.
# Key None = no project open (global); key <int> = project_id.
# System-wide alerts go to ALL clients; project events go only to subscribed ones.

_ws_subscriptions: dict[int | None, set[WebSocket]] = defaultdict(set)


def _all_ws_clients() -> set[WebSocket]:
    """Return the union of all connected WebSocket clients."""
    result: set[WebSocket] = set()
    for clients in _ws_subscriptions.values():
        result.update(clients)
    return result


def _ws_subscribe(ws: WebSocket, project_id: int | None) -> None:
    """Move a WebSocket to a new subscription bucket, removing from any old one."""
    for key in list(_ws_subscriptions):
        _ws_subscriptions[key].discard(ws)
        if not _ws_subscriptions[key]:
            del _ws_subscriptions[key]
    _ws_subscriptions[project_id].add(ws)


def _ws_disconnect(ws: WebSocket) -> None:
    """Remove a disconnected WebSocket from all subscription buckets."""
    for key in list(_ws_subscriptions):
        _ws_subscriptions[key].discard(ws)
        if not _ws_subscriptions[key]:
            del _ws_subscriptions[key]


async def _broadcast_global(payload: dict) -> None:
    """Send a JSON payload to every connected WebSocket client (system alerts)."""
    dead: set[WebSocket] = set()
    for ws in _all_ws_clients():
        try:
            await ws.send_json(payload)
        except Exception:
            dead.add(ws)
    for ws in dead:
        _ws_disconnect(ws)


async def _broadcast_to_project(project_id: int, payload: dict) -> None:
    """Send a JSON payload only to clients subscribed to project_id."""
    targets = set(_ws_subscriptions.get(project_id, set()))
    dead: set[WebSocket] = set()
    for ws in targets:
        try:
            await ws.send_json(payload)
        except Exception:
            dead.add(ws)
    for ws in dead:
        _ws_disconnect(ws)


# Keep backward-compat alias used by the alert monitor below.
_broadcast_json = _broadcast_global


# ── Build concurrency ─────────────────────────────────────────────────────────
# Limits simultaneous project builds to prevent Ollama OOM on 16 GB machines.

_build_semaphore = asyncio.Semaphore(BUILD_WORKERS)
_build_queue_depth = 0           # approximate number of builds waiting
_build_queue_lock  = asyncio.Lock()


async def _acquire_build_slot(ws: WebSocket) -> None:
    """Wait for a build slot, notifying the user if they must queue."""
    global _build_queue_depth
    if _build_semaphore.locked():
        async with _build_queue_lock:
            _build_queue_depth += 1
        pos = _build_queue_depth
        try:
            await ws.send_json({
                "type":    "build_queued",
                "position": pos,
                "message": f"Server is busy — your build is queued (position {pos}). "
                           "It will start automatically when a slot opens.",
            })
        except Exception:
            pass
    await _build_semaphore.acquire()


def _release_build_slot() -> None:
    global _build_queue_depth
    _build_semaphore.release()
    if _build_queue_depth > 0:
        _build_queue_depth -= 1


# ── Agent registry isolation during builds ────────────────────────────────────
# Tracks how many tasks are actively using each agent so that admin operations
# (agent deletion, model swap) can refuse while the agent is in use.

_agent_use_counts: dict[str, int] = defaultdict(int)
_agent_use_lock = asyncio.Lock()


async def _agent_acquire(agent_key: str) -> None:
    async with _agent_use_lock:
        _agent_use_counts[agent_key] += 1


async def _agent_release(agent_key: str) -> None:
    async with _agent_use_lock:
        _agent_use_counts[agent_key] = max(0, _agent_use_counts[agent_key] - 1)


def _agent_in_use(agent_key: str) -> bool:
    return _agent_use_counts.get(agent_key, 0) > 0


async def _ollama_alert_monitor() -> None:
    """Broadcast a WebSocket alert when Ollama has been offline for > 2 minutes."""
    _offline_since: float | None = None
    _alerted = False
    while True:
        await asyncio.sleep(15)
        online: bool = _models._ollama_status.get("online", False)
        if not online:
            now = time.monotonic()
            if _offline_since is None:
                _offline_since = now
                _alerted = False
            elif not _alerted and (now - _offline_since) >= 120:
                mins = int((now - _offline_since) / 60)
                await _broadcast_json({
                    "type":     "system_alert",
                    "severity": "error",
                    "message":  f"Ollama has been offline for {mins}+ minute(s) — local model calls will fail",
                })
                _alerted = True
        else:
            if _offline_since is not None:
                # Recovery — notify clients
                await _broadcast_json({
                    "type":     "system_alert",
                    "severity": "info",
                    "message":  "Ollama is back online",
                })
            _offline_since = None
            _alerted = False


# ── Request metrics ───────────────────────────────────────────────────────────
# Per-path rolling window of latencies + counters.  Paths are normalised so
# slug/ID parts don't create unbounded cardinality.

_METRICS_WINDOW = 200   # keep last N latencies per path

_req_counts:    dict[str, int]         = defaultdict(int)
_req_errors:    dict[str, int]         = defaultdict(int)
_req_latencies: dict[str, deque]       = defaultdict(lambda: deque(maxlen=_METRICS_WINDOW))


def _normalise_path(path: str) -> str:
    """Collapse variable route segments into placeholders."""
    # /projects/123  → /projects/{id}
    path = re.sub(r"/projects/\d+", "/projects/{id}", path)
    # /play/my-slug/  → /play/{slug}/
    path = re.sub(r"/play/[^/]+", "/play/{slug}", path)
    # /admin/agents/my-agent  → /admin/agents/{key}
    path = re.sub(r"/(agents|agent)/[^/]+", r"/\1/{key}", path)
    return path


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI()


@app.middleware("http")
async def _metrics_middleware(request: Request, call_next):
    path = _normalise_path(request.url.path)
    t0 = time.monotonic()
    try:
        response = await call_next(request)
        _req_counts[path] += 1
        if response.status_code >= 500:
            _req_errors[path] += 1
        _req_latencies[path].append(round(time.monotonic() - t0, 4))
        return response
    except Exception:
        _req_counts[path] += 1
        _req_errors[path] += 1
        raise


@app.on_event("startup")
async def startup():
    init_db()
    _load_custom_agents()
    PROJECTS_DIR.mkdir(exist_ok=True)
    BACKUP_DIR.mkdir(exist_ok=True)
    # Recover tasks left in-flight by a previous crash or hard restart.
    recovered = reset_all_stuck_tasks()
    if recovered:
        logging.warning("startup: reset %d stuck in_progress task(s) to pending", recovered)
    try:
        subprocess.run(["git", "--version"], capture_output=True, timeout=5, check=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        logging.critical("git not found at startup — project version control will be disabled.")
    ollama_up = await check_ollama_online()
    if ollama_up:
        logging.info("Ollama is reachable at startup")
    else:
        logging.warning("Ollama is NOT reachable at startup — local model calls will fail until it starts")
    asyncio.create_task(_ollama_monitor())
    asyncio.create_task(_ollama_alert_monitor())
    asyncio.create_task(_backup_scheduler())


@app.on_event("shutdown")
async def shutdown():
    await _models.close_http_client()


app.mount("/static", StaticFiles(directory=str(STATIC_PATH)), name="static")


# ── Serve project web apps ───────────────────────────────────────────────────

def _auto_generate_index(src_dir: Path, slug: str) -> str | None:
    js_files  = sorted(p.relative_to(src_dir).as_posix()
                       for p in src_dir.rglob("*.js")  if p.is_file())
    css_files = sorted(p.relative_to(src_dir).as_posix()
                       for p in src_dir.rglob("*.css") if p.is_file())

    if not js_files and not css_files:
        return None

    title = slug.replace("-", " ").title()
    css_tags  = "\n  ".join(f'<link rel="stylesheet" href="{f}">' for f in css_files)
    js_tags   = "\n  ".join(f'<script src="{f}"></script>' for f in js_files)
    canvas_tag = '<canvas id="gameCanvas" width="600" height="600"></canvas>' if js_files else ""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  {css_tags}
  <style>
    * {{ margin:0; padding:0; box-sizing:border-box; }}
    body {{ background:#111; display:flex; flex-direction:column;
           align-items:center; justify-content:center; min-height:100vh; }}
  </style>
</head>
<body>
  {canvas_tag}
  {js_tags}
</body>
</html>"""


MIME_MAP = {
    ".html": "text/html",
    ".htm":  "text/html",
    ".css":  "text/css",
    ".js":   "application/javascript",
    ".mjs":  "application/javascript",
    ".json": "application/json",
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif":  "image/gif",
    ".svg":  "image/svg+xml",
    ".ico":  "image/x-icon",
    ".woff": "font/woff",
    ".woff2":"font/woff2",
    ".mp3":  "audio/mpeg",
    ".wav":  "audio/wav",
    ".ogg":  "audio/ogg",
    ".mp4":  "video/mp4",
    ".webm": "video/webm",
    ".webp": "image/webp",
    ".txt":  "text/plain",
    ".xml":  "application/xml",
}

@app.get("/play/{slug:path}")
async def serve_project(slug: str, request: Request):
    parts = slug.strip("/").split("/", 1)
    project_slug = parts[0]
    file_path = parts[1] if len(parts) > 1 else ""

    if not file_path or file_path.endswith("/"):
        file_path = file_path + "index.html" if file_path else "index.html"

    src_dir = PROJECTS_DIR / project_slug / "src"
    target = (src_dir / file_path).resolve()

    try:
        target.relative_to(src_dir.resolve())
    except ValueError:
        return JSONResponse({"error": "forbidden"}, status_code=403)

    if not target.is_file():
        if file_path == "index.html" and src_dir.exists():
            generated = _auto_generate_index(src_dir, project_slug)
            if generated:
                return HTMLResponse(generated)
        return JSONResponse({"error": "not found", "path": file_path}, status_code=404)

    suffix = target.suffix.lower()
    media_type = MIME_MAP.get(suffix, "application/octet-stream")
    return FileResponse(str(target), media_type=media_type)


@app.get("/")
async def root():
    return FileResponse(str(STATIC_PATH / "index.html"))


@app.get("/config")
async def get_config():
    return {"server_host": SERVER_HOST}


# ── Route helpers ────────────────────────────────────────────────────────────

def _require_localhost(request: Request) -> None:
    host = request.client.host if request.client else ""
    if host not in ("127.0.0.1", "::1", "localhost"):
        raise HTTPException(status_code=403, detail="This endpoint is restricted to localhost.")


def _get_request_token(request: Request) -> str:
    """Extract bearer token from Authorization header or ?token= query param."""
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return request.query_params.get("token", "")


@app.get("/health")
async def health():
    db_ok = True
    try:
        with _db_connect() as c:
            c.execute("SELECT 1")
    except Exception:
        db_ok = False

    # Disk free space
    try:
        disk_free_gb: float | None = round(psutil.disk_usage("/").free / 1e9, 1)
    except Exception:
        disk_free_gb = None

    # Most recent backup timestamp (folder name is the timestamp)
    last_backup: str | None = None
    try:
        backups = sorted(
            (p for p in BACKUP_DIR.iterdir() if p.is_dir()),
            key=lambda p: p.name,
        )
        if backups:
            last_backup = backups[-1].name
    except Exception:
        pass

    # Ollama — use cached value so /health never blocks
    ollama_online: bool = _models._ollama_status.get("online", False)

    # Claude — cached; first call may take up to 5 s if cache is cold
    claude_online: bool = await _models.check_claude_online()

    return {
        "ok":           db_ok,
        "uptime_s":     round(time.monotonic() - _server_start, 1),
        "db":           "ok" if db_ok else "error",
        "ollama":       "ok" if ollama_online else "offline",
        "claude":       "ok" if claude_online else "offline",
        "disk_free_gb": disk_free_gb,
        "last_backup":  last_backup,
    }


@app.post("/backup")
async def trigger_backup(_: None = Depends(_require_localhost)):
    result = await asyncio.to_thread(_run_backup)
    return result


@app.get("/admin/exec/commands")
async def list_exec_commands(_: None = Depends(_require_localhost)):
    return {"commands": {k: " ".join(v) for k, v in _EXEC_COMMANDS.items()}}


@app.post("/admin/exec")
async def admin_exec(data: dict, _: None = Depends(_require_localhost)):
    cmd_key = (data.get("cmd") or "").strip()
    try:
        result = await execute_ssh(cmd_key)
    except ValueError as exc:
        return JSONResponse({"error": str(exc), "allowed": list(_EXEC_COMMANDS)}, status_code=400)
    logging.info("admin/exec: %s → exit %s", cmd_key, result["returncode"])
    return result


@app.get("/status")
async def status():
    return {"claude_online": await check_claude_online()}


@app.get("/settings")
async def get_settings():
    key = os.getenv("ANTHROPIC_API_KEY", "")
    disabled = set(_config.get("disabled_agents", []))

    ollama_infos = await asyncio.gather(
        *[_fetch_model_info(m) for m in OLLAMA_MODELS.values()]
    )

    result: dict = {
        "claude": {
            "api_key_set": bool(key),
            "api_key_preview": f"sk-ant-...{key[-4:]}" if len(key) > 8 else "",
            "enabled": "claude" not in disabled,
        },
    }
    for (agent_key, model), info in zip(OLLAMA_MODELS.items(), ollama_infos):
        result[agent_key] = {
            "model":      model,
            "label":      AGENT_LABEL.get(agent_key, agent_key.capitalize()),
            "keep_alive": KEEP_ALIVE,
            "size":       info.get("size", "—"),
            "quant":      info.get("quant", "—"),
            "enabled":    agent_key not in disabled,
            "builtin":    agent_key in _BUILTIN_AGENTS,
        }
    return result


@app.post("/settings/agent")
async def toggle_agent(data: dict):
    agent = data.get("agent", "")
    if agent != "claude" and agent not in OLLAMA_MODELS:
        return {"error": "unknown agent"}
    enabled = bool(data.get("enabled", True))
    async with _config_lock:
        disabled: set = set(_config.get("disabled_agents", []))
        if not enabled:
            disabled.add(agent)
        else:
            disabled.discard(agent)
        _config["disabled_agents"] = list(disabled)
        if agent == "claude":
            _config["claude_enabled"] = enabled
        result_disabled = list(_config["disabled_agents"])
    logging.info("Agent toggle: %s enabled=%s disabled_agents=%s", agent, enabled, result_disabled)
    return {"agent": agent, "enabled": enabled, "disabled_agents": result_disabled}


@app.post("/settings/apikey")
async def save_apikey(data: dict, _: None = Depends(_require_localhost)):
    key = data.get("key", "").strip()
    if not key:
        return {"ok": False, "error": "Key cannot be empty"}
    os.environ["ANTHROPIC_API_KEY"] = key
    env_path = Path(__file__).parent / ".env"
    env_path.write_text(f"ANTHROPIC_API_KEY={key}\n")
    online = await check_claude_online()
    return {"ok": online, "error": None if online else "Key saved but Claude didn't respond — check key validity"}


@app.get("/settings/test/{agent}")
async def test_agent(agent: str):
    if agent == "claude":
        return {"online": await check_claude_online()}
    if agent in OLLAMA_MODELS:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get(f"{OLLAMA_BASE}/api/tags")
                names = [m["name"] for m in r.json().get("models", [])]
                return {"online": OLLAMA_MODELS[agent] in names}
        except Exception:
            return {"online": False}
    return {"online": False}


@app.get("/stats")
async def get_stats():
    cpu  = psutil.cpu_percent(interval=None)
    mem  = psutil.virtual_memory()
    swap = psutil.swap_memory()
    net  = psutil.net_io_counters()

    now = time.monotonic()
    dt  = now - _net_snap["ts"]
    if dt > 0:
        rx_kbs = (net.bytes_recv - _net_snap["recv"]) / dt / 1024
        tx_kbs = (net.bytes_sent - _net_snap["sent"]) / dt / 1024
    else:
        rx_kbs = tx_kbs = 0.0
    _net_snap["sent"] = net.bytes_sent
    _net_snap["recv"] = net.bytes_recv
    _net_snap["ts"]   = now

    # Total Claude API cost accumulated across all projects
    try:
        with _db_connect() as c:
            row = c.execute("SELECT COALESCE(SUM(cost_usd), 0.0) FROM tasks").fetchone()
            total_cost_usd = round(row[0], 4)
    except Exception:
        total_cost_usd = None

    # Per-path request metrics
    def _pct(vals: deque, p: int) -> float | None:
        if not vals:
            return None
        s = sorted(vals)
        idx = max(0, int(len(s) * p / 100) - 1)
        return round(s[idx], 3)

    request_metrics: dict[str, dict] = {}
    all_paths = set(_req_counts) | set(_req_errors)
    for path in sorted(all_paths):
        lats = _req_latencies[path]
        request_metrics[path] = {
            "requests":   _req_counts[path],
            "errors":     _req_errors[path],
            "p50_s":      _pct(lats, 50),
            "p95_s":      _pct(lats, 95),
            "p99_s":      _pct(lats, 99),
        }

    return {
        "cpu":             round(cpu, 1),
        "ram_used":        round(mem.used  / 1073741824, 1),
        "ram_total":       round(mem.total / 1073741824, 1),
        "swap_used":       round(swap.used  / 1073741824, 2),
        "swap_total":      round(swap.total / 1073741824, 1),
        "rx_kbs":          round(rx_kbs, 1),
        "tx_kbs":          round(tx_kbs, 1),
        "ollama_online":   _models._ollama_status["online"],
        "total_cost_usd":  total_cost_usd,
        "request_metrics": request_metrics,
    }


# ── REST endpoints for projects ──────────────────────────────────────────────

@app.get("/projects")
async def api_list_projects(request: Request):
    # When auth is enabled and a bearer token is present, filter by owner.
    owner = _get_request_token(request)
    filter_token = owner if _auth_enabled() and owner else None
    return list_projects(filter_token)


@app.post("/projects")
async def api_create_project(data: dict, request: Request):
    name = data.get("name", "").strip()
    if not name:
        return {"error": "Name is required"}
    description = data.get("description", "").strip()
    owner = _get_request_token(request)
    owner_tok = owner if _auth_enabled() and owner else ""
    project = create_project(name, description, owner_token=owner_tok)
    return project


@app.get("/projects/{project_id}")
async def api_get_project(project_id: int):
    p = get_project(project_id)
    if not p:
        return {"error": "Not found"}
    return p


@app.get("/projects/{project_id}/messages")
async def api_get_project_messages(project_id: int, limit: int = 30, before_id: Optional[int] = None):
    """Return project messages with optional cursor-based pagination.

    Pass ?before_id=<id> to load messages older than that id (scroll-up to
    load earlier history).  The response includes a ``has_more`` boolean so
    the frontend knows whether a "Load earlier" button should be shown.
    """
    p = get_project(project_id)
    if not p:
        return JSONResponse({"error": "Not found"}, status_code=404)
    limit = min(max(1, limit), 100)   # clamp: 1–100
    msgs = load_project_messages(project_id, limit=limit + 1, before_id=before_id)
    has_more = len(msgs) > limit
    return {"messages": msgs[:limit], "has_more": has_more}


@app.get("/projects/{project_id}/files")
async def api_get_project_files(project_id: int):
    p = get_project(project_id)
    if not p:
        return {"error": "Not found"}
    src = Path(p["folder_path"]) / "src"
    if not src.exists():
        return []
    result = []
    for fpath in sorted(src.rglob("*")):
        if fpath.is_file():
            try:
                rel = str(fpath.relative_to(src)).replace("\\", "/")
                result.append({"path": rel, "size": fpath.stat().st_size})
            except Exception:
                pass
    return result


@app.get("/projects/{project_id}/files/{file_path:path}")
async def api_get_project_file(project_id: int, file_path: str):
    p = get_project(project_id)
    if not p:
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse("Not found", status_code=404)
    src = Path(p["folder_path"]) / "src"
    try:
        target = (src / file_path).resolve()
        src_resolved = src.resolve()
        target.relative_to(src_resolved)
    except (ValueError, Exception):
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse("Forbidden", status_code=403)
    if not target.is_file():
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse("Not found", status_code=404)
    content = target.read_text(encoding="utf-8", errors="replace")
    return {"path": file_path, "content": content}


@app.delete("/projects/{project_id}")
async def api_delete_project(project_id: int):
    p = get_project(project_id)
    if not p:
        return {"error": "Not found"}

    folder = Path(p["folder_path"])
    if folder.exists():
        import shutil
        shutil.rmtree(folder, ignore_errors=True)

    with _db_connect() as c:
        c.execute("DELETE FROM project_messages WHERE project_id = ?", (project_id,))
        c.execute("DELETE FROM tasks WHERE project_id = ?", (project_id,))
        c.execute("DELETE FROM projects WHERE id = ?", (project_id,))

    return {"ok": True}


# ── Master model settings ────────────────────────────────────────────────────

@app.get("/settings/master")
async def get_master_settings():
    return {
        "master_model":    _config["master_model"],
        "claude_enabled":  _config["claude_enabled"],
        "effective_master": get_master_model(),
    }


@app.post("/settings/master")
async def set_master_settings(data: dict):
    async with _config_lock:
        if "model" in data and data["model"] in ("claude", "qwen", "deepseek"):
            _config["master_model"] = data["model"]
        if "claude_enabled" in data:
            _config["claude_enabled"] = bool(data["claude_enabled"])
        result = {
            "master_model":    _config["master_model"],
            "claude_enabled":  _config["claude_enabled"],
            "effective_master": get_master_model(),
        }
    logging.info(
        "Master model updated -> master=%s claude_enabled=%s effective=%s",
        result["master_model"], result["claude_enabled"], result["effective_master"]
    )
    return result


# ── Coder model (runtime swap for benchmarking) ──────────────────────────────

@app.get("/settings/coder-model")
async def get_coder_model():
    return {
        "coder_model": _models.OLLAMA_MODELS.get("deepseek", ""),
        "available": list(_models.OLLAMA_MODELS.keys()),
    }


@app.post("/settings/coder-model")
async def set_coder_model(data: dict):
    model = data.get("model", "").strip()
    label = data.get("label", "").strip()
    if not model:
        return {"error": "model required"}
    if _agent_in_use("deepseek"):
        return JSONResponse({"error": "deepseek is currently running a task — try again shortly."}, status_code=409)
    async with _agent_lock:
        _models.OLLAMA_MODELS["deepseek"] = model
        if label:
            AGENT_LABEL["deepseek"] = label
    logging.info("Coder model swapped -> deepseek=%s label=%s", model, AGENT_LABEL.get("deepseek"))
    return {"coder_model": model, "label": AGENT_LABEL.get("deepseek")}


# ── Skills ────────────────────────────────────────────────────────────────────

@app.get("/skills")
async def list_skills():
    if not SKILLS_DIR.exists():
        return []
    skills = []
    for sf in sorted(SKILLS_DIR.glob("*.md")):
        try:
            raw = sf.read_text(encoding="utf-8")
            name_m = re.search(r"^name:\s*(.+)$", raw, re.MULTILINE)
            kw_m   = re.search(r"^keywords:\s*(.+)$", raw, re.MULTILINE)
            desc_m = re.search(r"^description:\s*(.+)$", raw, re.MULTILINE)
            skills.append({
                "file":        sf.name,
                "name":        name_m.group(1).strip() if name_m else sf.stem,
                "description": desc_m.group(1).strip() if desc_m else "",
                "keywords":    [k.strip() for k in kw_m.group(1).split(",")] if kw_m else [],
            })
        except Exception:
            pass
    return skills


@app.get("/skills/{filename}")
async def get_skill(filename: str):
    if "/" in filename or "\\" in filename or ".." in filename:
        return JSONResponse({"error": "Invalid filename"}, status_code=400)
    path = SKILLS_DIR / filename
    if not path.is_file() or path.suffix != ".md":
        return JSONResponse({"error": "Not found"}, status_code=404)
    content = path.read_text(encoding="utf-8")
    return {"file": filename, "content": content}


@app.put("/skills/{filename}")
async def update_skill(filename: str, data: dict, _: None = Depends(_require_localhost)):
    if "/" in filename or "\\" in filename or ".." in filename:
        return JSONResponse({"error": "Invalid filename"}, status_code=400)
    if not filename.endswith(".md"):
        return JSONResponse({"error": "Filename must end in .md"}, status_code=400)
    content = data.get("content", "")
    if not content.strip():
        return JSONResponse({"error": "Content cannot be empty"}, status_code=400)
    path = SKILLS_DIR / filename
    path.write_text(content, encoding="utf-8")
    return {"ok": True, "file": filename}


# ── Ollama model registry ────────────────────────────────────────────────────

@app.get("/ollama/models")
async def list_ollama_models():
    available: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{OLLAMA_BASE}/api/tags")
            if r.status_code == 200:
                available = r.json().get("models", [])
    except Exception:
        pass

    model_to_key = {v: k for k, v in OLLAMA_MODELS.items()}
    result = []
    seen_names: set[str] = set()

    for m in available:
        name = m.get("name", "")
        seen_names.add(name)
        size = m.get("size", 0)
        result.append({
            "name":          name,
            "size_gb":       round(size / 1e9, 1) if size else None,
            "registered_as": model_to_key.get(name),
            "builtin":       model_to_key.get(name) in _BUILTIN_AGENTS,
            "offline":       False,
        })

    for key, model in OLLAMA_MODELS.items():
        if model not in seen_names:
            result.append({
                "name":          model,
                "size_gb":       None,
                "registered_as": key,
                "builtin":       key in _BUILTIN_AGENTS,
                "offline":       True,
            })

    return result


@app.post("/ollama/models")
async def add_ollama_agent(data: dict):
    key   = data.get("key", "").strip().lower()
    model = data.get("model", "").strip()
    label = data.get("label", "").strip() or key.capitalize()
    if not key or not model:
        return JSONResponse({"error": "key and model are required"}, status_code=400)
    if not re.match(r'^[a-z0-9_-]+$', key):
        return JSONResponse({"error": "key must be lowercase alphanumeric, dash, or underscore"}, status_code=400)
    async with _agent_lock:
        OLLAMA_MODELS[key] = model
        AGENT_LABEL[key]   = label
    await asyncio.to_thread(_save_custom_agents)
    logging.info("Custom agent registered: %s → %s (%s)", key, model, label)
    return {"ok": True, "key": key, "model": model, "label": label}


@app.delete("/ollama/models/{key}")
async def remove_ollama_agent(key: str):
    if key in _BUILTIN_AGENTS:
        return JSONResponse({"error": "Cannot remove built-in agents"}, status_code=400)
    if key not in OLLAMA_MODELS:
        return JSONResponse({"error": "Agent not found"}, status_code=404)
    if _agent_in_use(key):
        return JSONResponse({"error": f"Agent '{key}' is currently running a task — try again shortly."}, status_code=409)
    async with _agent_lock:
        OLLAMA_MODELS.pop(key, None)
        AGENT_LABEL.pop(key, None)
    async with _config_lock:
        disabled = set(_config.get("disabled_agents", []))
        disabled.discard(key)
        _config["disabled_agents"] = list(disabled)
    await asyncio.to_thread(_save_custom_agents)
    logging.info("Custom agent removed: %s", key)
    return {"ok": True}


@app.delete("/ollama/uninstall/{model_name:path}")
async def uninstall_ollama_model(model_name: str):
    """Delete a model from Ollama disk (ollama rm). Only allowed for models not in use as agents."""
    in_use = {v: k for k, v in OLLAMA_MODELS.items()}.get(model_name)
    if in_use:
        return JSONResponse({"error": f"Model is in use as agent '{in_use}'. Remove the agent first."}, status_code=400)
    try:
        proc = await asyncio.create_subprocess_exec(
            "ollama", "rm", model_name,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout_b, stderr_b = await asyncio.wait_for(proc.communicate(), timeout=30)
        if proc.returncode != 0:
            err = stderr_b.decode("utf-8", errors="replace").strip()
            return JSONResponse({"error": err or "ollama rm failed"}, status_code=500)
        logging.info("Uninstalled Ollama model: %s", model_name)
        return {"ok": True, "model": model_name}
    except asyncio.TimeoutError:
        return JSONResponse({"error": "ollama rm timed out"}, status_code=500)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ── Admin: quality dashboard (T8.8) ─────────────────────────────────────────


@app.get("/admin/quality")
async def admin_quality(_: None = Depends(_require_localhost)):
    """Return quality metrics: project stats, fix cycles, agent profiles, skill mutations."""
    projs  = list_projects()
    total  = len(projs)
    completed  = sum(1 for p in projs if p.get("status") == "completed")
    finalized  = sum(1 for p in projs if p.get("status") == "finalized")

    fix_cycles: list[int] = []
    for p in projs:
        fh = Path(p.get("folder_path", "")) / "fix_history.json"
        if fh.exists():
            try:
                entries = json.loads(fh.read_text(encoding="utf-8"))
                fix_cycles.append(len(entries))
            except Exception:
                pass

    avg_cycles = round(sum(fix_cycles) / len(fix_cycles), 2) if fix_cycles else 0

    profiles_text = ""
    profiles_path = MEMORY_DIR / "agent_profiles.md"
    if profiles_path.exists():
        profiles_text = profiles_path.read_text(encoding="utf-8")[:4000]

    mutations_raw: list[str] = []
    mutations_log = MEMORY_DIR / "skill_mutations.log"
    if mutations_log.exists():
        mutations_raw = [
            ln.strip() for ln in mutations_log.read_text(encoding="utf-8").splitlines()
            if ln.strip()
        ]

    return {
        "projects": {"total": total, "completed": completed, "finalized": finalized},
        "fix_cycles": {
            "projects_with_fixes": len(fix_cycles),
            "avg_cycles": avg_cycles,
            "total_cycles": sum(fix_cycles),
        },
        "agent_profiles_preview": profiles_text,
        "skill_mutations": {
            "count": len(mutations_raw),
            "recent": mutations_raw[-20:],
        },
    }


@app.get("/admin/skill-mutations")
async def admin_skill_mutations(_: None = Depends(_require_localhost)):
    """List all skill file mutations from the auto-learning feedback loop."""
    mutations_log = MEMORY_DIR / "skill_mutations.log"
    if not mutations_log.exists():
        return {"mutations": []}
    entries = []
    for idx, ln in enumerate(mutations_log.read_text(encoding="utf-8").splitlines()):
        ln = ln.strip()
        if ln:
            entries.append({"id": idx, "entry": ln})
    return {"mutations": entries}


@app.post("/admin/skill-mutations/{mutation_id}/revert")
async def admin_revert_mutation(mutation_id: int, _: None = Depends(_require_localhost)):
    """No-op placeholder — skill revert requires manual review of the skill file."""
    return {"status": "not_implemented",
            "message": "Review the skill file manually and remove the auto-learned rule."}


@app.get("/admin/dashboard")
async def admin_dashboard(_: None = Depends(_require_localhost)):
    """Serve a simple HTML quality dashboard."""
    html = textwrap.dedent("""\
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><title>ai-chat quality dashboard</title>
        <style>
          body{font-family:monospace;background:#0d1117;color:#c9d1d9;padding:2rem;}
          h1{color:#f0f6fc;}h2{color:#58a6ff;}
          pre{background:#161b22;padding:1rem;border-radius:6px;overflow:auto;white-space:pre-wrap;}
          .card{background:#161b22;border:1px solid #30363d;border-radius:6px;
                padding:1.2rem 1.6rem;margin-bottom:1.2rem;}
          .num{font-size:2rem;font-weight:bold;color:#3fb950;}
          .label{color:#8b949e;font-size:.85rem;}
        </style></head>
        <body>
        <h1>📊 ai-chat Quality Dashboard</h1>
        <div id="root"><p>Loading…</p></div>
        <script>
        fetch('/admin/quality').then(r=>r.json()).then(d=>{
          const p=d.projects, f=d.fix_cycles, m=d.skill_mutations;
          document.getElementById('root').innerHTML=`
            <div class="card">
              <span class="num">${p.total}</span> <span class="label">total projects</span> &nbsp;
              <span class="num">${p.completed}</span> <span class="label">completed</span> &nbsp;
              <span class="num">${p.finalized}</span> <span class="label">finalized (user said done)</span>
            </div>
            <div class="card">
              <span class="num">${f.avg_cycles}</span> <span class="label">avg fix cycles/project</span> &nbsp;
              <span class="num">${f.total_cycles}</span> <span class="label">total fix cycles</span>
            </div>
            <div class="card">
              <span class="num">${m.count}</span> <span class="label">skill mutations</span>
              <pre>${m.recent.join('\\n') || '(none yet)'}</pre>
            </div>
            <h2>Agent Profiles</h2>
            <pre>${d.agent_profiles_preview || '(none yet)'}</pre>
          `;
        }).catch(e=>document.getElementById('root').innerHTML='<pre>Error: '+e+'</pre>');
        </script></body></html>
    """)
    return HTMLResponse(html)


# ── WebSocket ─────────────────────────────────────────────────────────────────

# Simple token-bucket rate limiter for WebSocket messages.
# 10 tokens/second, burst up to 20 — enough for normal UI interaction but
# blocks automated flooding.
_WS_RATE_TOKENS   = 10   # refill rate (tokens per second)
_WS_RATE_BURST    = 20   # max tokens (burst capacity)


class _TokenBucket:
    def __init__(self, rate: float, burst: float) -> None:
        self._rate  = rate
        self._burst = burst
        self._tokens = burst
        self._last   = time.monotonic()

    def consume(self) -> bool:
        """Return True if the message is allowed, False if rate-limited."""
        now = time.monotonic()
        self._tokens = min(self._burst, self._tokens + (now - self._last) * self._rate)
        self._last = now
        if self._tokens >= 1:
            self._tokens -= 1
            return True
        return False


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    # ── T13.5: Optional token auth ────────────────────────────────────────────
    # Accept the connection first so we can send a proper auth-error message
    # rather than just closing the TCP socket.
    await ws.accept()

    token = ws.query_params.get("token", "")
    if not _validate_token(token):
        await ws.send_json({"type": "auth_error", "message": "Invalid or missing token."})
        await ws.close(code=4001)
        return

    # Derive a stable user identifier from the token (hash avoids storing raw token).
    import hashlib
    user_id: str = hashlib.sha256(token.encode()).hexdigest()[:16] if token else ""

    # Register with global subscription bucket initially.
    _ws_subscribe(ws, None)

    recv_q: asyncio.Queue = asyncio.Queue()
    cancel_event = asyncio.Event()
    active_task: asyncio.Task | None = None
    _bucket = _TokenBucket(_WS_RATE_TOKENS, _WS_RATE_BURST)

    async def _receiver():
        try:
            while True:
                msg = await ws.receive_json()
                if not _bucket.consume():
                    logging.warning("WebSocket rate limit exceeded — dropping message type=%s", msg.get("type"))
                    continue
                await recv_q.put(msg)
        except Exception:
            await recv_q.put({"type": "__disc__"})

    recv = asyncio.create_task(_receiver())

    async def _run_task(coro):
        nonlocal active_task
        cancel_event.clear()
        active_task = asyncio.create_task(coro)
        try:
            while not active_task.done():
                try:
                    side = await asyncio.wait_for(recv_q.get(), timeout=0.3)
                    if side.get("type") == "cancel":
                        cancel_event.set()
                        active_task.cancel()
                    elif side.get("type") == "__disc__":
                        active_task.cancel()
                        await recv_q.put(side)
                    else:
                        await recv_q.put(side)
                except asyncio.TimeoutError:
                    pass
            await active_task
        except asyncio.CancelledError:
            pass
        except (WebSocketDisconnect, RuntimeError):
            cancel_event.set()
            active_task.cancel()
        finally:
            active_task = None
            gc.collect()  # prompt release of LLM response strings / httpx buffers

    try:
        await ws.send_json({"type": "history", "messages": load_history()})
        claude_online = await check_claude_online()
        await ws.send_json({"type": "status", "claude_online": claude_online})

        while True:
            data = await recv_q.get()
            if data.get("type") == "__disc__":
                break

            msg_type = data.get("type", "content")

            if msg_type == "cancel":
                if active_task and not active_task.done():
                    cancel_event.set()
                    active_task.cancel()
                else:
                    await ws.send_json({"type": "cancelled"})
                continue

            if msg_type == "get_projects":
                # T13.5: filter to user's own projects when auth is active
                filter_token = user_id if _auth_enabled() else None
                await ws.send_json({"type": "project_list", "projects": list_projects(filter_token)})
                continue

            if msg_type == "load_project":
                pid = data.get("project_id")
                proj = get_project(pid)
                if proj:
                    # T13.1: subscribe this WS to project-specific broadcasts
                    _ws_subscribe(ws, pid)
                    await ws.send_json({
                        "type":     "project_loaded",
                        "project":  proj,
                        "messages": load_project_messages(pid),
                        "tasks":    get_all_tasks(pid),
                    })
                continue

            if msg_type == "start_orchestration":
                pid  = data.get("project_id")
                goal = data.get("goal", "")
                if pid and goal:
                    await _acquire_build_slot(ws)
                    try:
                        await _run_task(run_orchestration(ws, pid, goal, cancel_event=cancel_event))
                    finally:
                        _release_build_slot()
                    if cancel_event.is_set():
                        reset_stuck_tasks(pid)
                        await ws.send_json({"type": "cancelled"})
                continue

            if msg_type == "resume_orchestration":
                pid = data.get("project_id")
                if pid:
                    await _acquire_build_slot(ws)
                    try:
                        await _run_task(run_orchestration(ws, pid, goal="", resume=True, cancel_event=cancel_event))
                    finally:
                        _release_build_slot()
                    if cancel_event.is_set():
                        reset_stuck_tasks(pid)
                        await ws.send_json({"type": "cancelled"})
                continue

            if msg_type == "fix_project":
                pid      = data.get("project_id")
                feedback = data.get("feedback", "").strip()
                if pid and feedback:
                    await _acquire_build_slot(ws)
                    try:
                        await _run_task(run_fix_task(ws, pid, feedback, cancel_event))
                    finally:
                        _release_build_slot()
                    if cancel_event.is_set():
                        await ws.send_json({"type": "cancelled"})
                continue

            content    = data.get("content", "").strip()
            project_id_ctx = data.get("project_id")
            if not content:
                continue

            # /exec shortcut
            if content.startswith("/exec "):
                cmd_key = content[6:].strip()
                try:
                    result = await execute_ssh(cmd_key)
                    output  = result["stdout"] or result["stderr"] or "(no output)"
                    tick    = "\u2713" if result["ok"] else "\u2717"
                    msg_md  = f"```\n{tick} exec: {cmd_key}  [exit {result['returncode']}]\n\n{output}\n```"
                except ValueError:
                    cmds   = ", ".join(f"`{k}`" for k in _EXEC_COMMANDS)
                    msg_md = f"Unknown command key. Available:\n\n{cmds}"
                await ws.send_json({"type": "agent_count", "count": 1})
                await ws.send_json({"type": "chunk",       "agent": "system", "content": msg_md})
                await ws.send_json({"type": "done",        "agent": "system"})
                continue

            claude_online = await check_claude_online()
            master_available = True

            if project_id_ctx:
                prior_tasks_quick = []
                proj = get_project(project_id_ctx)
                if not proj:
                    routing = "chat"
                else:
                    prior_tasks_quick = get_all_tasks(project_id_ctx)
                    if not prior_tasks_quick:
                        routing = "build"
                    else:
                        routing = await detect_intent_in_project(content, proj["name"])

                if routing == "done":
                    await _run_task(close_project_thread(ws, project_id_ctx, cancel_event))
                    if cancel_event.is_set():
                        await ws.send_json({"type": "cancelled"})
                    continue

                if routing == "query":
                    await _run_task(stream_project_query(ws, project_id_ctx, content, cancel_event))
                    if cancel_event.is_set():
                        await ws.send_json({"type": "cancelled"})
                    continue

                if routing == "build":
                    if not prior_tasks_quick:
                        await _acquire_build_slot(ws)
                        try:
                            await _run_task(run_orchestration(ws, project_id_ctx, content, cancel_event=cancel_event))
                        finally:
                            _release_build_slot()
                        if cancel_event.is_set():
                            reset_stuck_tasks(project_id_ctx)
                            await ws.send_json({"type": "cancelled"})
                    elif proj.get("status") == "completed":
                        await _acquire_build_slot(ws)
                        try:
                            await _run_task(run_fix_task(ws, project_id_ctx, content, cancel_event))
                        finally:
                            _release_build_slot()
                        if cancel_event.is_set():
                            await ws.send_json({"type": "cancelled"})
                    else:
                        await ws.send_json({
                            "type":             "intent_detected",
                            "intent":           "project_continue",
                            "original_message": content,
                            "project_id":       project_id_ctx,
                        })
                    continue

            elif master_available:
                intent = await detect_intent(content)
                if intent.get("type") == "project_new":
                    await ws.send_json({
                        "type":             "intent_detected",
                        "intent":           "project_new",
                        "name":             intent.get("name", "New Project"),
                        "original_message": content,
                    })
                    continue
                if intent.get("type") == "project_continue":
                    await ws.send_json({
                        "type":             "intent_detected",
                        "intent":           "project_continue",
                        "original_message": content,
                    })
                    continue

            # Normal chat flow
            save_message("user", content)
            await ws.send_json({
                "type":      "user",
                "content":   content,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            await ws.send_json({"type": "status", "claude_online": claude_online})

            targets = parse_mentions(content, claude_online)
            ctx     = load_history(CONTEXT_LEN)
            logging.info("CHAT routed to: %s", ", ".join(targets))

            await ws.send_json({"type": "agent_count", "count": len(targets)})

            async def _do_chat():
                nonlocal ctx
                for agent in targets:
                    await ws.send_json({"type": "typing", "agent": agent})
                    full = ""
                    gen  = (stream_claude(ctx, cancel_event=cancel_event)
                            if agent == "claude"
                            else stream_ollama(agent, ctx, cancel_event=cancel_event))
                    async with aclosing(gen):
                        async for chunk in gen:
                            if cancel_event.is_set():
                                break
                            await ws.send_json({"type": "chunk", "agent": agent, "content": chunk})
                            full += chunk
                    if full.strip():
                        save_message(agent, full.strip())
                        ctx = load_history(CONTEXT_LEN)
                    await ws.send_json({"type": "done", "agent": agent})

            await _run_task(_do_chat())
            if cancel_event.is_set():
                await ws.send_json({"type": "cancelled"})

    except WebSocketDisconnect:
        pass
    finally:
        _ws_disconnect(ws)
        recv.cancel()
        if active_task and not active_task.done():
            active_task.cancel()
