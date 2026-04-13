#!/usr/bin/env python3
"""
Smoke test for qwen3.5:9b — tests it as:
  1. Worker agent (CSS/styling tasks) in multi-file projects
  2. Master orchestrator (planning + evaluation) with Claude disabled

Projects chosen to stress the 32k context window WITHOUT being too slow:
  - Simple but high-context single-file apps (single deepseek task, large output)
  - Multi-file project where qwen35 handles the CSS (3 tasks, deepseek+qwen35)
  - Complex RPG via qwen35 master (tests planning quality at 32k context)

Run on Mac Mini:  .venv/bin/python smoke_qwen35.py
"""
import asyncio
import json
import os
import sys
import time
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime

try:
    import websockets
except ImportError:
    print("pip install websockets"); sys.exit(1)

BASE = "http://localhost:8080"
WS   = "ws://localhost:8080/ws"
SEP  = "─" * 70
WIDE = "═" * 70

# ── Projects ──────────────────────────────────────────────────────────────────

PROJECTS_WORKER = [
    {
        "name": "Markdown Editor Qwen",
        "prompt": (
            "Build a markdown editor with live preview. Split into 3 files: "
            "index.html (two-panel layout: editor left, preview right), "
            "style.css (dark code-editor theme, monospace editor, styled preview panel, "
            "toolbar buttons, responsive split — assign this CSS to qwen35), "
            "app.js (all logic: parse markdown to HTML using regex for headers/bold/italic/"
            "code blocks/links/lists/blockquotes, debounced preview update, "
            "toolbar buttons for bold/italic/code/link, word count, "
            "save to localStorage on change, load on startup). "
            "No external libraries. 100% offline capable."
        ),
        "context": "3-file split, qwen35 CSS, markdown parser",
    },
    {
        "name": "Expense Tracker Qwen",
        "prompt": (
            "Build an expense tracker web app. Split into 3 files: "
            "index.html (main layout), "
            "style.css (clean modern dark theme, category color-coded badges, "
            "smooth animations for add/delete, chart styling — assign to qwen35), "
            "app.js (all logic: add/delete/edit expenses with date/category/amount/note, "
            "filter by category and date range, sort by date/amount, "
            "monthly summary bar chart drawn on canvas, "
            "category breakdown donut chart on canvas, "
            "CSV export, all data in localStorage). "
            "No external dependencies."
        ),
        "context": "3-file split, qwen35 CSS, canvas charts, localStorage",
    },
]

PROJECT_MASTER = {
    "name": "RPG Adventure Qwen Master",
    "prompt": (
        "Build a browser-based RPG text adventure engine. "
        "The game has 10+ interconnected rooms, full inventory system (pick up/drop/examine), "
        "combat with HP/attack/defense/XP, 3 enemy types, 5+ items, a shop NPC, "
        "save/load via localStorage, command parser with click-able buttons. "
        "Dark fantasy theme. All game data as JS objects. Single self-contained index.html. "
        "No external dependencies."
    ),
    "context": "complex single-file, many game systems, qwen35 as master planner",
}


# ── HTTP helpers ──────────────────────────────────────────────────────────────

def http_post(path, payload, timeout=15):
    data = json.dumps(payload).encode()
    req  = urllib.request.Request(BASE + path, data=data,
                                  headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def http_get(path, timeout=10):
    with urllib.request.urlopen(BASE + path, timeout=timeout) as r:
        return json.loads(r.read())


# ── WebSocket runner ──────────────────────────────────────────────────────────

@dataclass
class ProjectResult:
    name: str
    prompt: str
    context: str
    project_id: int = 0
    slug: str = ""
    status: str = "pending"
    duration: float = 0.0
    tasks_done: int = 0
    tasks_total: int = 0
    tasks_errored: int = 0
    agents_used: set = field(default_factory=set)
    files_created: list = field(default_factory=list)
    error: str = ""


async def run_project(proj: dict, timeout_s: int = 700) -> ProjectResult:
    result = ProjectResult(name=proj["name"], prompt=proj["prompt"], context=proj["context"])

    # Create project via REST (bypass intent-detection dialog)
    try:
        project = http_post("/projects", {"name": proj["name"], "description": ""})
        if "error" in project or "id" not in project:
            result.status = "failed"
            result.error = f"Project creation failed: {project}"
            return result
        result.project_id = project["id"]
        result.slug = project.get("slug", "")
    except Exception as e:
        result.status = "failed"
        result.error = f"POST /projects: {e}"
        return result

    start = time.time()

    try:
        async with websockets.connect(WS, ping_interval=30, open_timeout=10,
                                      max_size=10_000_000) as ws:
            try:
                await asyncio.wait_for(ws.recv(), timeout=5.0)
            except asyncio.TimeoutError:
                pass

            await ws.send(json.dumps({
                "type":       "start_orchestration",
                "project_id": result.project_id,
                "goal":       proj["prompt"],
            }))

            deadline = time.time() + timeout_s
            orch_done = False

            while time.time() < deadline:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=120.0)
                except asyncio.TimeoutError:
                    result.error = "120s silence"
                    break

                msg = json.loads(raw)
                mtype = msg.get("type", "")

                if mtype == "orch_plan":
                    tasks = msg.get("tasks", [])
                    result.tasks_total = len(tasks)
                    for t in tasks:
                        result.agents_used.add(t.get("assigned_to", "?"))
                    print(f" [{len(tasks)}t agents:{sorted(result.agents_used)}]",
                          end="", flush=True)

                elif mtype == "orch_task_done":
                    result.tasks_done += 1
                    print(".", end="", flush=True)

                elif mtype == "orch_task_error":
                    result.tasks_errored += 1
                    print("E", end="", flush=True)

                elif mtype == "orch_complete":
                    orch_done = True
                    break

                elif mtype == "orch_error":
                    result.status = "failed"
                    result.error  = msg.get("error", "orch_error")
                    break

            if orch_done:
                result.status = "completed"
            elif result.status == "pending":
                result.status = "timeout"

    except Exception as e:
        result.status = "failed"
        result.error  = str(e)

    result.duration = time.time() - start

    if result.slug:
        src_dir = f"/Users/parasjain/ai-chat/projects/{result.slug}/src"
        if os.path.isdir(src_dir):
            result.files_created = sorted(
                f for f in os.listdir(src_dir) if not f.startswith(".")
            )

    return result


# ── Validation ────────────────────────────────────────────────────────────────

def validate(result: ProjectResult) -> list[str]:
    issues = []
    if result.status != "completed":
        issues.append(f"status={result.status}" + (f": {result.error}" if result.error else ""))
    if not result.files_created:
        issues.append("no files created")
    else:
        if "index.html" not in result.files_created:
            issues.append("missing index.html")
        src_dir = f"/Users/parasjain/ai-chat/projects/{result.slug}/src"
        for fname in result.files_created:
            fpath = os.path.join(src_dir, fname)
            try:
                size = os.path.getsize(fpath)
                if size < 200:
                    issues.append(f"{fname} too small ({size}b)")
                content = open(fpath, errors="replace").read()
                for ph in ["TODO", "// add logic here", "/* add css here */", "placeholder content"]:
                    if ph.lower() in content.lower():
                        issues.append(f"{fname} has placeholder: {ph!r}")
            except Exception:
                pass
    if result.tasks_errored > 0:
        issues.append(f"{result.tasks_errored} task(s) errored")
    return issues


# ── Main ──────────────────────────────────────────────────────────────────────

async def main():
    print()
    print(WIDE)
    print("  SMOKE TEST: qwen3.5:9b — high-context project builds")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(WIDE)

    # Always restore Claude master at the start (in case previous run was interrupted)
    orig_cfg = http_get("/settings/master")
    print(f"\nOriginal config: {orig_cfg}")
    if not orig_cfg.get("claude_enabled"):
        http_post("/settings/master", {"model": "claude", "claude_enabled": True})
        print("  (restored claude master from previous interrupted run)")

    all_results: list[tuple[str, ProjectResult, list[str]]] = []

    # ── MODE A: qwen35 as WORKER (Claude orchestrates) ────────────────────────
    print()
    print(SEP)
    print("  MODE A — qwen35 as WORKER (Claude plans, qwen35 handles CSS files)")
    print(SEP)

    http_post("/settings/master", {"model": "claude", "claude_enabled": True})

    for i, proj in enumerate(PROJECTS_WORKER):
        print(f"\n[A{i+1}] {proj['name']}  ({proj['context']})")
        print(f"      Building", end="", flush=True)
        result = await run_project(proj)
        issues = validate(result)
        icon = "PASS" if not issues else "FAIL"
        print(f"\n      {icon}  {result.duration:.0f}s | {result.tasks_done}/{result.tasks_total} tasks"
              f" | agents:{sorted(result.agents_used)} | files:{result.files_created}")
        for iss in issues:
            print(f"      ISSUE: {iss}")
        all_results.append(("worker", result, issues))

    # ── MODE B: qwen35 as MASTER (Claude disabled) ────────────────────────────
    print()
    print(SEP)
    print("  MODE B — qwen35 as MASTER (Claude disabled, qwen35 orchestrates)")
    print(SEP)

    http_post("/settings/master", {"model": "qwen", "claude_enabled": False})
    master_cfg = http_get("/settings/master")
    print(f"\n  Active config: {master_cfg}")

    effective = master_cfg.get("effective_master", "?")
    if effective not in ("qwen35", "qwen"):
        print(f"  WARNING: effective_master='{effective}' — expected qwen35")

    print(f"\n[B1] {PROJECT_MASTER['name']}  ({PROJECT_MASTER['context']})")
    print(f"      Building", end="", flush=True)
    result = await run_project(PROJECT_MASTER, timeout_s=900)
    issues = validate(result)
    icon = "PASS" if not issues else "FAIL"
    print(f"\n      {icon}  {result.duration:.0f}s | {result.tasks_done}/{result.tasks_total} tasks"
          f" | agents:{sorted(result.agents_used)} | files:{result.files_created}")
    for iss in issues:
        print(f"      ISSUE: {iss}")
    all_results.append(("master", result, issues))

    # Restore
    http_post("/settings/master", {
        "model": "claude",
        "claude_enabled": True,
    })
    print(f"\n  Config restored: {http_get('/settings/master')}")

    # ── Summary ───────────────────────────────────────────────────────────────
    print()
    print(WIDE)
    print("  RESULTS SUMMARY")
    print(WIDE)

    passes = sum(1 for _, _, iss in all_results if not iss)
    fails  = len(all_results) - passes

    for mode, r, issues in all_results:
        icon = "PASS" if not issues else "FAIL"
        print(f"  [{icon}] [{mode:6}] {r.name}")
        print(f"          {r.duration:.0f}s | tasks {r.tasks_done}/{r.tasks_total}"
              f" | agents:{sorted(r.agents_used)} | files:{r.files_created}")
        for iss in issues:
            print(f"          ISSUE: {iss}")

    print()
    print(f"  TOTAL: {passes}/{len(all_results)} passed   {fails} failed")
    print(WIDE)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
