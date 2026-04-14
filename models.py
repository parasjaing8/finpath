"""AI model routing, streaming, structured calls, and connectivity checks."""
from __future__ import annotations
import asyncio
import json
import logging
import os
import re
import time
from typing import AsyncGenerator

import httpx


# These are injected by server.py via configure()
OLLAMA_BASE: str = "http://localhost:11434"
KEEP_ALIVE: str = "10m"
OLLAMA_MODELS: dict[str, str] = {}
MODEL_CTX: dict[str, int] = {}  # per-agent num_ctx override; default 16384
MODEL_PREDICT: dict[str, int] = {}  # per-agent num_predict override; default 8192
AGENT_LABEL: dict[str, str] = {}
SYSTEM_PROMPTS: dict[str, str] = {}
CLAUDE_COST_INPUT_PER_M: float = 3.0
CLAUDE_COST_OUTPUT_PER_M: float = 15.0

# Callbacks injected from server.py
_get_master_model = lambda: "deepseek"
_is_claude_available = lambda: False

# Semaphore caps concurrent Ollama requests. Reconfigured by configure().
_ollama_lock = asyncio.Semaphore(1)

# T14.1 — single-model-at-a-time tracking
SINGLE_MODEL_MODE: bool = True
_loaded_model: str | None = None

# Shared HTTP client — reuses connections across all LLM calls.
# Call close_http_client() at server shutdown to drain the connection pool.
_http_client = httpx.AsyncClient()


async def close_http_client() -> None:
    """Drain the shared HTTP connection pool. Call once at server shutdown."""
    await _http_client.aclose()


def configure(*, ollama_base: str, keep_alive: str,
              ollama_models: dict, model_ctx: dict | None = None,
              model_predict: dict | None = None,
              agent_label: dict, system_prompts: dict,
              claude_cost_input: float, claude_cost_output: float,
              get_master_model, is_claude_available,
              ollama_concurrency: int = 1,
              single_model_mode: bool = True) -> None:
    """Called once from server.py to inject shared state references."""
    global OLLAMA_BASE, KEEP_ALIVE, OLLAMA_MODELS, MODEL_CTX, MODEL_PREDICT, AGENT_LABEL, SYSTEM_PROMPTS
    global CLAUDE_COST_INPUT_PER_M, CLAUDE_COST_OUTPUT_PER_M
    global _get_master_model, _is_claude_available, _ollama_lock, SINGLE_MODEL_MODE
    OLLAMA_BASE = ollama_base
    KEEP_ALIVE = keep_alive
    OLLAMA_MODELS = ollama_models
    MODEL_CTX = model_ctx or {}
    MODEL_PREDICT = model_predict or {}
    AGENT_LABEL = agent_label
    SYSTEM_PROMPTS = system_prompts
    CLAUDE_COST_INPUT_PER_M = claude_cost_input
    CLAUDE_COST_OUTPUT_PER_M = claude_cost_output
    _get_master_model = get_master_model
    _is_claude_available = is_claude_available
    _ollama_lock = asyncio.Semaphore(max(1, ollama_concurrency))
    SINGLE_MODEL_MODE = single_model_mode


# ── OrchStats — token & time tracking across one orchestration run ────────────

class OrchStats:
    """Tracks token usage and timing across an orchestration / fix run."""

    def __init__(self):
        self.start_time: float = time.time()
        self.by_agent: dict[str, dict] = {}
        self.model_switch_count: int = 0  # T14.4: count model switches during build

    def record(self, agent: str, input_tok: int, output_tok: int) -> None:
        if agent not in self.by_agent:
            self.by_agent[agent] = {"tasks": 0, "input_tokens": 0, "output_tokens": 0}
        self.by_agent[agent]["tasks"] += 1
        self.by_agent[agent]["input_tokens"]  += input_tok
        self.by_agent[agent]["output_tokens"] += output_tok

    def elapsed(self) -> str:
        secs = int(time.time() - self.start_time)
        return f"{secs // 60}m {secs % 60}s" if secs >= 60 else f"{secs}s"

    def claude_tokens(self) -> tuple[int, int]:
        c = self.by_agent.get("claude", {})
        return c.get("input_tokens", 0), c.get("output_tokens", 0)

    def local_tokens(self) -> int:
        total = 0
        for agent, data in self.by_agent.items():
            if agent != "claude":
                total += data.get("input_tokens", 0) + data.get("output_tokens", 0)
        return total

    def total_tasks(self) -> int:
        return sum(d["tasks"] for d in self.by_agent.values())

    def record_model_switch(self) -> None:
        """Increment model switch counter (called by T14.4 sequential execution)."""
        self.model_switch_count += 1

    def to_summary(self) -> dict:
        inp, out = self.claude_tokens()
        local = self.local_tokens()
        cost_usd = (inp * CLAUDE_COST_INPUT_PER_M + out * CLAUDE_COST_OUTPUT_PER_M) / 1_000_000
        return {
            "elapsed":           self.elapsed(),
            "by_agent":          self.by_agent,
            "claude_input":      inp,
            "claude_output":     out,
            "local_tokens":      local,
            "cost_usd":          round(cost_usd, 4),
            "total_tasks":       self.total_tasks(),
            "model_switch_count": self.model_switch_count,
        }


# ── Ollama availability cache ─────────────────────────────────────────────────
_ollama_status: dict = {"online": False, "checked_at": 0.0}


# ── T14.1: Single-model-at-a-time scheduling ──────────────────────────────────

async def _get_ollama_running_models() -> list[str]:
    """Return names of models currently loaded in Ollama memory via /api/ps."""
    try:
        r = await _http_client.get(f"{OLLAMA_BASE}/api/ps", timeout=5.0)
        if r.status_code == 200:
            return [m["name"] for m in r.json().get("models", [])]
    except Exception:
        pass
    return []


async def _ensure_model_loaded(model_name: str) -> None:
    """Enforce one-model-at-a-time: unload every other model before loading this one.

    Must be called *inside* _ollama_lock to avoid races.

    Strategy:
    1. Query /api/ps for ground truth of what Ollama actually has in RAM —
       this handles keep_alive expiry and server restarts where _loaded_model
       may be stale.
    2. Unload any model that is loaded but isn't the one we need.
    3. Update _loaded_model to reflect reality.

    No-op when SINGLE_MODEL_MODE is False.
    """
    global _loaded_model
    if not SINGLE_MODEL_MODE:
        _loaded_model = model_name
        return

    # Ground-truth check: what does Ollama actually have in RAM right now?
    running = await _get_ollama_running_models()

    # Sync our in-process tracker in case keep_alive evicted the model.
    if _loaded_model and _loaded_model not in running:
        logging.debug("ollama: %s evicted from RAM (keep_alive expired or restart)", _loaded_model)
        _loaded_model = None

    # Unload every model that is loaded but isn't the one we want.
    for loaded in running:
        if loaded != model_name:
            try:
                await _http_client.post(
                    f"{OLLAMA_BASE}/api/generate",
                    json={"model": loaded, "keep_alive": "0"},
                    timeout=10.0,
                )
                logging.info("ollama: unloaded %s before loading %s", loaded, model_name)
            except Exception as e:
                logging.warning("ollama: failed to unload %s: %s", loaded, e)

    _loaded_model = model_name


# ── T14.7: Model warm-up ──────────────────────────────────────────────────────

async def warmup_model(model_name: str) -> bool:
    """Send a minimal generation request to ensure the model is loaded and warm.

    Returns True on success.  First load on 16 GB Mac Mini can take 30-60 s.
    """
    try:
        async with _ollama_lock:
            await _ensure_model_loaded(model_name)
            r = await _http_client.post(
                f"{OLLAMA_BASE}/api/generate",
                json={
                    "model": model_name,
                    "prompt": "Hi",
                    "stream": False,
                    "keep_alive": KEEP_ALIVE,
                    "options": {"num_predict": 1},
                },
                timeout=90.0,
            )
            return r.status_code == 200
    except Exception as e:
        logging.warning("warmup_model(%s) failed: %s", model_name, e)
        return False

# ── Ollama model-info cache ───────────────────────────────────────────────────
_model_info_cache: dict[str, dict] = {}
_MODEL_INFO_TTL = 300.0


async def fetch_model_info(model_name: str) -> dict:
    """Return size/quant metadata from Ollama /api/show.  Cached for 5 minutes."""
    now = time.monotonic()
    cached = _model_info_cache.get(model_name)
    if cached and now - cached.get("_fetched_at", 0) < _MODEL_INFO_TTL:
        return cached
    try:
        r = await _http_client.post(
            f"{OLLAMA_BASE}/api/show",
            json={"name": model_name, "verbose": False},
            timeout=5.0,
        )
        if r.status_code != 200:
            return {}
        data = r.json()
        details = data.get("details", {})
        info: dict = {}
        param_size = (
            data.get("model_info", {}).get("general.parameter_count")
            or details.get("parameter_size", "")
        )
        if isinstance(param_size, int):
            gb = param_size * 2 / 1e9
            info["size"] = f"{gb:.1f} GB"
        elif param_size:
            info["size"] = str(param_size)
        quant = details.get("quantization_level", "")
        if quant:
            info["quant"] = quant
        info["_fetched_at"] = now
        _model_info_cache[model_name] = info
        return info
    except Exception:
        return {}


async def check_ollama_online() -> bool:
    """Return True if Ollama is reachable. Result is cached for 30 seconds."""
    now = time.monotonic()
    if now - _ollama_status["checked_at"] < 30:
        return _ollama_status["online"]
    try:
        r = await _http_client.get(f"{OLLAMA_BASE}/api/tags", timeout=3.0)
        online = r.status_code == 200
    except Exception:
        online = False
    _ollama_status["online"] = online
    _ollama_status["checked_at"] = now
    return online


async def ollama_monitor() -> None:
    """Background coroutine: ping Ollama every 30 s and log state changes."""
    prev: bool | None = None
    while True:
        await asyncio.sleep(30)
        try:
            r = await _http_client.get(f"{OLLAMA_BASE}/api/tags", timeout=3.0)
            online = r.status_code == 200
        except Exception:
            online = False
        _ollama_status["online"] = online
        _ollama_status["checked_at"] = time.monotonic()
        if prev is not None and prev != online:
            if online:
                logging.info("Ollama came back online")
            else:
                logging.warning("Ollama went offline — local model calls will fail")
        prev = online


# ── Context builders ──────────────────────────────────────────────────────────

def build_claude_messages(history: list[dict]) -> list[dict]:
    msgs: list[dict] = []
    ai_pending: list[str] = []
    user_pending: list[str] = []

    def flush_ai():
        if ai_pending:
            msgs.append({"role": "assistant", "content": "\n\n".join(ai_pending)})
            ai_pending.clear()

    def flush_user():
        if user_pending:
            msgs.append({"role": "user", "content": "\n\n".join(user_pending)})
            user_pending.clear()

    for m in history:
        if m["role"] == "user":
            flush_ai()
            user_pending.append(m["content"])
        else:
            flush_user()
            label = AGENT_LABEL.get(m["role"], m["role"])
            ai_pending.append(f"[{label}]: {m['content']}")

    flush_ai()
    flush_user()

    if not msgs or msgs[-1]["role"] != "user":
        return []
    return msgs


def build_ollama_messages(history: list[dict], agent: str, system: str) -> list[dict]:
    msgs = [{"role": "system", "content": system}]
    other_buf: list[str] = []

    def _last_role() -> str:
        for m in reversed(msgs):
            if m["role"] in ("user", "assistant"):
                return m["role"]
        return "system"

    def _append_user(text: str):
        if _last_role() == "user":
            msgs[-1]["content"] += "\n\n" + text
        else:
            msgs.append({"role": "user", "content": text})

    def flush_others():
        if other_buf:
            context = "[Group chat context]\n" + "\n\n".join(other_buf)
            _append_user(context)
            other_buf.clear()

    for m in history:
        if m["role"] == "user":
            flush_others()
            _append_user(m["content"])
        elif m["role"] == agent:
            flush_others()
            msgs.append({"role": "assistant", "content": m["content"]})
        else:
            label = AGENT_LABEL.get(m["role"], m["role"])
            other_buf.append(f"[{label}]: {m['content']}")

    flush_others()

    if _last_role() == "assistant":
        msgs.append({"role": "user", "content": "[Your turn to respond.]"})

    return msgs


# ── Claude connectivity ───────────────────────────────────────────────────────

_claude_online_cache: dict = {"result": False, "ts": 0.0}
_CLAUDE_ONLINE_TTL = 30.0

async def check_claude_online() -> bool:
    if not os.environ.get("_CLAUDE_ENABLED", "1") == "1":
        return False
    key = os.getenv("ANTHROPIC_API_KEY", "")
    if not key:
        return False
    now = asyncio.get_event_loop().time()
    if now - _claude_online_cache["ts"] < _CLAUDE_ONLINE_TTL:
        return _claude_online_cache["result"]
    try:
        r = await _http_client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-6",
                "max_tokens": 1,
                "messages": [{"role": "user", "content": "hi"}],
            },
            timeout=5.0,
        )
        result = r.status_code == 200
    except Exception:
        result = False
    _claude_online_cache["result"] = result
    _claude_online_cache["ts"] = now
    return result


# ── Mention parser ────────────────────────────────────────────────────────────

def parse_mentions(msg: str, claude_online: bool) -> list[str]:
    lo = msg.lower()
    claude_usable = claude_online and _is_claude_available()

    if "@all" in lo:
        base = ["deepseek"]
        return (["claude"] + base) if claude_usable else base

    targets: list[str] = []
    if "@claude" in lo and claude_usable:
        targets.append("claude")
    if "@deepseek" in lo:
        targets.append("deepseek")

    return targets or ([_get_master_model()] if (_get_master_model() != "claude" or claude_usable) else ["deepseek"])


# ── Context window helpers ────────────────────────────────────────────────────

def _estimate_tokens(messages: list[dict]) -> int:
    """Rough token count using chars/4 heuristic. Good enough for overflow guard."""
    return sum(len(str(m.get("content", ""))) // 4 for m in messages)


def _truncate_to_context(messages: list[dict], max_tokens: int) -> list[dict]:
    """Drop oldest non-system messages until estimated token count fits max_tokens."""
    system_msgs = [m for m in messages if m.get("role") == "system"]
    non_system  = [m for m in messages if m.get("role") != "system"]
    original_len = len(non_system)
    while non_system and _estimate_tokens(system_msgs + non_system) > max_tokens:
        non_system.pop(0)
    dropped = original_len - len(non_system)
    if dropped:
        logging.warning("context_truncation: dropped %d messages to fit %d token limit", dropped, max_tokens)
    return system_msgs + non_system


# ── Streaming ─────────────────────────────────────────────────────────────────

async def stream_claude(history: list[dict], system_prompt: str | None = None,
                        cancel_event: asyncio.Event | None = None,
                        usage: dict | None = None,
                        max_tokens: int = 4096):
    key  = os.getenv("ANTHROPIC_API_KEY", "")
    msgs = build_claude_messages(history)
    if not msgs:
        return
    # Claude's context window is ~200k tokens; stay well within it
    msgs = _truncate_to_context(msgs, 150_000)
    sys_prompt = system_prompt or SYSTEM_PROMPTS["claude"]
    try:
        async with _http_client.stream(
            "POST",
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-6",
                "max_tokens": max_tokens,
                "system": sys_prompt,
                "messages": msgs,
                "stream": True,
            },
            timeout=120.0,
        ) as resp:
            async for line in resp.aiter_lines():
                if cancel_event and cancel_event.is_set():
                    return
                if line.startswith("data: "):
                    try:
                        ev = json.loads(line[6:])
                        etype = ev.get("type", "")
                        if etype == "content_block_delta":
                            text = ev.get("delta", {}).get("text", "")
                            if text:
                                yield text
                        elif etype == "message_start" and usage is not None:
                            u = ev.get("message", {}).get("usage", {})
                            usage["input_tokens"] = usage.get("input_tokens", 0) + u.get("input_tokens", 0)
                        elif etype == "message_delta" and usage is not None:
                            u = ev.get("usage", {})
                            usage["output_tokens"] = usage.get("output_tokens", 0) + u.get("output_tokens", 0)
                    except json.JSONDecodeError:
                        pass
    except Exception as e:
        yield f"\n\n*[Claude error: {e}]*"


async def stream_ollama(agent: str, history: list[dict], system_prompt: str | None = None,
                        cancel_event: asyncio.Event | None = None,
                        usage: dict | None = None):
    model = OLLAMA_MODELS[agent]
    sys_prompt = system_prompt or SYSTEM_PROMPTS.get(agent, "You are a helpful AI assistant. Be concise.")
    msgs  = build_ollama_messages(history, agent, sys_prompt)

    # Truncate if history exceeds 85% of the model's context window
    num_ctx = MODEL_CTX.get(agent, 16384)
    msgs = _truncate_to_context(msgs, int(num_ctx * 0.85))

    # Per-model output budget — qwen35 is faster so can afford higher limit
    num_predict = MODEL_PREDICT.get(agent, 8192)

    in_think = False
    pending  = ""

    async def _do_stream():
        nonlocal in_think, pending
        try:
            async with _http_client.stream(
                "POST",
                f"{OLLAMA_BASE}/api/chat",
                json={
                    "model":      model,
                    "messages":   msgs,
                    "stream":     True,
                    "keep_alive": KEEP_ALIVE,
                    "options":    {"num_ctx": MODEL_CTX.get(agent, 16384), "num_predict": num_predict},
                },
                timeout=600.0,
            ) as resp:
                async for line in resp.aiter_lines():
                    if cancel_event and cancel_event.is_set():
                        return
                    if not line:
                        continue
                    try:
                        ev    = json.loads(line)
                        if ev.get("done") and usage is not None:
                            usage["input_tokens"]  = usage.get("input_tokens", 0)  + ev.get("prompt_eval_count", 0)
                            usage["output_tokens"] = usage.get("output_tokens", 0) + ev.get("eval_count", 0)
                        chunk = ev.get("message", {}).get("content", "")
                        if not chunk:
                            continue
                        pending += chunk

                        while pending:
                            if in_think:
                                end = pending.find("</think>")
                                if end == -1:
                                    pending = ""
                                    break
                                pending  = pending[end + 8:]
                                in_think = False
                            else:
                                start = pending.find("<think>")
                                if start == -1:
                                    yield pending
                                    pending = ""
                                    break
                                if start > 0:
                                    yield pending[:start]
                                pending  = pending[start + 7:]
                                in_think = True
                    except json.JSONDecodeError:
                        pass
        except Exception as e:
            yield f"\n\n*[Ollama error: {e}]*"

    async with _ollama_lock:
        await _ensure_model_loaded(model)
        async for chunk in _do_stream():
            yield chunk


# ── Ollama structured (non-streaming) call ────────────────────────────────────

async def ollama_json_call(agent: str, system: str, prompt: str, max_tokens: int = 2048) -> str | None:
    model = OLLAMA_MODELS.get(agent, OLLAMA_MODELS.get("deepseek", "deepseek-coder-v2:16b-lite-instruct-q5_K_S"))
    async with _ollama_lock:
        await _ensure_model_loaded(model)
        try:
            r = await _http_client.post(
                f"{OLLAMA_BASE}/api/chat",
                json={
                    "model":    model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user",   "content": "/no_think\n" + prompt},
                    ],
                    "stream":     False,
                    "keep_alive": KEEP_ALIVE,
                    "options":    {"num_predict": max_tokens, "num_ctx": MODEL_CTX.get(agent, 16384)},
                },
                timeout=600.0,
            )
            if r.status_code != 200:
                logging.warning("ollama_json_call HTTP %d for %s", r.status_code, agent)
                return None
            text = r.json().get("message", {}).get("content", "").strip()
            text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
            return text or None
        except Exception as e:
            logging.warning("ollama_json_call(%s) error: %s", agent, e)
            return None


async def master_json_call(system: str, prompt: str, max_tokens: int = 512) -> str | None:
    """Route a structured JSON call to the active master model.
    Claude -> Claude API.  Any other master -> that Ollama agent, fallback deepseek."""
    master = _get_master_model()
    if master == "claude":
        key = os.getenv("ANTHROPIC_API_KEY", "")
        if key:
            try:
                r = await _http_client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={"x-api-key": key, "anthropic-version": "2023-06-01",
                             "content-type": "application/json"},
                    json={"model": "claude-sonnet-4-6", "max_tokens": max_tokens,
                          "system": system,
                          "messages": [{"role": "user", "content": prompt}]},
                    timeout=45.0,
                )
                if r.status_code == 200:
                    text = r.json().get("content", [{}])[0].get("text", "").strip()
                    return text or None
                logging.warning("master_json_call(claude) HTTP %d — falling back to deepseek", r.status_code)
            except Exception as e:
                logging.warning("master_json_call(claude) error: %s — falling back to deepseek", e)
    # Local master (qwen35, deepseek, or any registered agent)
    agent = master if master in OLLAMA_MODELS else "deepseek"
    return await ollama_json_call(agent, system, prompt, max_tokens)


async def master_text_call(system: str, prompt: str, max_tokens: int = 512) -> str | None:
    """Route a free-form text generation call to the active master model."""
    return await master_json_call(system, prompt, max_tokens)


async def stream_master(history: list[dict], system_prompt: str | None = None,
                        cancel_event: asyncio.Event | None = None,
                        usage: dict | None = None,
                        max_tokens: int = 4096):
    """Stream from the active master model (Claude or local master agent)."""
    master = _get_master_model()
    if master == "claude" and _is_claude_available():
        async for chunk in stream_claude(history, system_prompt, cancel_event, usage, max_tokens):
            yield chunk
    else:
        agent = master if master in OLLAMA_MODELS else "deepseek"
        async for chunk in stream_ollama(agent, history, system_prompt, cancel_event, usage):
            yield chunk
