"""
conftest.py — pre-stubs heavy dependencies (db, models, skills_mod) so that
orchestration.py can be imported in unit tests without a real DB, network,
or Ollama instance.

These stubs live in sys.modules BEFORE orchestration is first imported.
"""
import sys
import types
import asyncio

# ── db stub ───────────────────────────────────────────────────────────────────
_db = types.ModuleType("db")
_noop = lambda *a, **kw: None
_db.create_project = lambda *a, **kw: 1
_db.get_project = lambda *a, **kw: None
_db.list_projects = lambda *a, **kw: []
_db.update_project_status = _noop
_db.update_project_stats = _noop
_db.get_all_tasks = lambda *a, **kw: []
_db.get_tasks = lambda *a, **kw: []
_db.save_tasks = _noop
_db.update_task = _noop
_db.get_resumable_tasks = lambda *a, **kw: []
_db.get_last_project_goal = lambda *a, **kw: None
_db.reset_stuck_tasks = _noop
_db.save_message = _noop
_db.save_project_message = _noop
_db.load_history = lambda *a, **kw: []
_db.load_project_messages = lambda *a, **kw: []
sys.modules.setdefault("db", _db)

# ── models stub ───────────────────────────────────────────────────────────────
_models = types.ModuleType("models")
_models.CLAUDE_COST_INPUT_PER_M = 3.0
_models.CLAUDE_COST_OUTPUT_PER_M = 15.0

class _OrchStats:
    def __init__(self):
        self.by_agent = {}
        self.total_cost_usd = 0.0
        self.model_switch_count = 0
    def record(self, *a, **kw): pass
    def record_model_switch(self): self.model_switch_count += 1
    def summary_line(self): return ""
    def to_dict(self): return {}
    def to_summary(self): return {}

_models.OrchStats = _OrchStats
_models.build_claude_messages = lambda *a, **kw: []
_models.check_claude_online = lambda *a, **kw: True
_models.master_json_call = lambda *a, **kw: asyncio.coroutine(lambda: "")()
_models.master_text_call = lambda *a, **kw: asyncio.coroutine(lambda: "")()
_models.parse_mentions = lambda *a, **kw: (None, "")
_models.stream_claude = lambda *a, **kw: (_ for _ in ())
_models.stream_master = lambda *a, **kw: (_ for _ in ())
_models.stream_ollama = lambda *a, **kw: (_ for _ in ())
_models.warmup_model = lambda *a, **kw: asyncio.coroutine(lambda: True)()
_models.OLLAMA_MODELS = {}
sys.modules.setdefault("models", _models)

# ── skills_mod stub ───────────────────────────────────────────────────────────
_skills = types.ModuleType("skills_mod")
_skills.load_skills = lambda *a, **kw: ""
sys.modules.setdefault("skills_mod", _skills)
