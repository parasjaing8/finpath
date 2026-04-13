"""Centralized configuration for ai-chat platform.

All tunable values live here. Every setting can be overridden via an
environment variable of the same name (upper-cased). Example:
    CONTEXT_LEN=30 uvicorn server:app ...

Import this module instead of defining constants directly in other modules:
    from config import cfg
    ctx_len = cfg.CONTEXT_LEN
"""
from __future__ import annotations
import os
from pathlib import Path


def _int(key: str, default: int) -> int:
    return int(os.getenv(key, default))


def _float(key: str, default: float) -> float:
    return float(os.getenv(key, default))


def _str(key: str, default: str) -> str:
    return os.getenv(key, default)


# ── Paths ─────────────────────────────────────────────────────────────────────

BASE_DIR     = Path(__file__).parent
DB_PATH      = BASE_DIR / "chat.db"
STATIC_PATH  = BASE_DIR / "static"
PROJECTS_DIR = BASE_DIR / "projects"
MEMORY_DIR   = BASE_DIR / "memory"
BACKUP_DIR   = BASE_DIR / "backups"
SKILLS_DIR   = BASE_DIR / "skills"
LOGS_DIR     = BASE_DIR / "logs"
CUSTOM_AGENTS_PATH = BASE_DIR / "custom_agents.json"

# ── Server ────────────────────────────────────────────────────────────────────

# Publicly reachable host:port used to build play URLs sent to users.
# Override via SERVER_HOST env var when behind a proxy or on a different IP.
SERVER_HOST: str = _str("SERVER_HOST", "192.168.0.130:8080")

# ── Chat / context ────────────────────────────────────────────────────────────

# Number of previous messages included as context for each LLM call.
CONTEXT_LEN: int = _int("CONTEXT_LEN", 20)

# Number of messages loaded into the UI on page open.
DISPLAY_LEN: int = _int("DISPLAY_LEN", 60)

# ── Ollama ────────────────────────────────────────────────────────────────────

OLLAMA_BASE: str   = _str("OLLAMA_BASE", "http://localhost:11434")
KEEP_ALIVE: str    = _str("KEEP_ALIVE", "10m")

# Timeout (seconds) for Ollama streaming requests.
OLLAMA_TIMEOUT: int = _int("OLLAMA_TIMEOUT", 600)

# Semaphore that caps concurrent Ollama requests.
# Increase to 2 on machines with sufficient VRAM/RAM to run models in parallel.
OLLAMA_CONCURRENCY: int = _int("OLLAMA_CONCURRENCY", 1)

# ── Ollama model defaults ──────────────────────────────────────────────────────

# Per-agent context window sizes (num_ctx). Keys match OLLAMA_MODELS keys.
DEEPSEEK_CTX: int     = _int("DEEPSEEK_CTX", 16384)
QWEN35_CTX: int       = _int("QWEN35_CTX", 32768)

# Per-agent max tokens to generate (num_predict).
DEEPSEEK_PREDICT: int = _int("DEEPSEEK_PREDICT", 8192)
QWEN35_PREDICT: int   = _int("QWEN35_PREDICT", 12288)

# ── Claude API ────────────────────────────────────────────────────────────────

CLAUDE_TIMEOUT: int = _int("CLAUDE_TIMEOUT", 120)

# Pricing per 1M tokens (used for cost display only; not billed here).
CLAUDE_COST_INPUT_PER_M: float  = _float("CLAUDE_COST_INPUT_PER_M", 3.0)
CLAUDE_COST_OUTPUT_PER_M: float = _float("CLAUDE_COST_OUTPUT_PER_M", 15.0)

# ── Availability / cache TTLs ─────────────────────────────────────────────────

# How long (seconds) to cache Ollama online/offline status.
CACHE_TTL_OLLAMA: int      = _int("CACHE_TTL_OLLAMA", 30)

# How long (seconds) to cache per-model metadata (size, quant).
CACHE_TTL_MODEL_INFO: int  = _int("CACHE_TTL_MODEL_INFO", 300)

# ── Backup ────────────────────────────────────────────────────────────────────

# Seconds between automatic backups (default: 24 h).
BACKUP_INTERVAL: int   = _int("BACKUP_INTERVAL", 86400)

# Number of backup snapshots to retain (oldest removed beyond this limit).
BACKUP_KEEP_COUNT: int = _int("BACKUP_KEEP_COUNT", 14)

# ── Logging ───────────────────────────────────────────────────────────────────

# Max size in bytes before log file is rotated (default: 10 MB).
LOG_MAX_BYTES: int    = _int("LOG_MAX_BYTES", 10 * 1024 * 1024)

# Number of rotated log files to keep.
LOG_BACKUP_COUNT: int = _int("LOG_BACKUP_COUNT", 3)

# ── Memory / lessons ─────────────────────────────────────────────────────────

# Every N project lessons, one is sampled and added to universal_lessons.md.
LESSON_SAMPLE_RATE: int = _int("LESSON_SAMPLE_RATE", 3)
