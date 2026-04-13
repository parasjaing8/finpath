"""
Benchmark: qwen2.5-coder:7b vs deepseek-coder-v2:16b-lite-instruct-q5_K_S

Runs identical tasks against each model and measures:
  - Planning time
  - Per-task: duration, chars generated, chars/sec, pass/fail
  - Total build time
  - Tasks errored
  - Test-phase fixes applied
  - Code quality (smoke checks on final files)

Usage (run on Mac Mini with venv Python):
  .venv/bin/python benchmark.py
"""

import asyncio
import json
import sys
import time
import urllib.request
from datetime import datetime
from dataclasses import dataclass, field

try:
    import websockets
except ImportError:
    print("pip install websockets"); sys.exit(1)

BASE_URL = "http://localhost:8080"
WS_URL   = "ws://localhost:8080/ws"

MODELS = [
    {
        "model":  "qwen2.5-coder:7b",
        "label":  "Qwen Coder 7B",
        "key":    "7b",
    },
    {
        "model":  "deepseek-coder-v2:16b-lite-instruct-q5_K_S",
        "label":  "DeepSeek 16B",
        "key":    "16b",
    },
]

TASKS = [
    {
        "name":   "simple-app",
        "prompt": (
            "Build a simple click counter web app. "
            "Single self-contained index.html. Large number display, "
            "+1 button, -1 button, reset button. No external dependencies."
        ),
    },
    {
        "name":   "snake-game",
        "prompt": (
            "Build a playable Snake game. Canvas-based, 20x20 grid. "
            "Score display, speed increases each level. "
            "Keyboard (arrow keys) and touch swipe controls. "
            "Game over on wall/self collision. Restart button."
        ),
    },
    {
        "name":   "tetris-game",
        "prompt": (
            "Build a playable Tetris game. 90s neon style. Canvas 10x20 board. "
            "Score, level, lines cleared, next piece preview. "
            "Keyboard and on-screen touch controls. requestAnimationFrame game loop."
        ),
    },
]

WIDE = "═" * 72
SEP  = "─" * 72


def http_post(path, payload):
    data = json.dumps(payload).encode()
    req  = urllib.request.Request(
        BASE_URL + path, data=data,
        headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def http_get(path):
    with urllib.request.urlopen(BASE_URL + path, timeout=10) as r:
        return json.loads(r.read())


@dataclass
class TaskResult:
    number: int
    title: str
    agent: str
    status: str = "pending"   # done / errored
    duration: float = 0.0
    chars: int = 0
    cps: float = 0.0          # chars per second
    files: list = field(default_factory=list)
    retried: bool = False
    eval_fail_reason: str = ""


@dataclass
class RunResult:
    model_key: str
    model_name: str
    task_name: str
    plan_time: float = 0.0
    total_time: float = 0.0
    task_count: int = 0
    tasks: list = field(default_factory=list)   # list[TaskResult]
    test_phase_bugs: int = 0
    test_phase_files_fixed: int = 0
    final_files: list = field(default_factory=list)
    smoke_ok: bool = False
    smoke_issues: list = field(default_factory=list)
    project_id: int = 0
    project_slug: str = ""


async def run_one(model_cfg: dict, task_cfg: dict) -> RunResult:
    result = RunResult(
        model_key=model_cfg["key"],
        model_name=model_cfg["label"],
        task_name=task_cfg["name"],
    )
    prompt = task_cfg["prompt"]

    # Swap coder model
    resp = http_post("/settings/coder-model", {
        "model": model_cfg["model"],
        "label": model_cfg["label"],
    })
    print(f"\n  Coder model set: {resp.get('coder_model')} ({resp.get('label')})")

    # Create project
    proj_name = f"bench-{task_cfg['name']}-{model_cfg['key']}"
    project = http_post("/projects", {"name": proj_name, "description": prompt})
    result.project_id   = project["id"]
    result.project_slug = project.get("slug", "")

    t_run   = time.time()
    tasks   = {}     # task_number -> TaskResult
    chunks  = {}     # agent -> {chars, t_start}
    current_tnum = None
    plan_t_start = t_run

    async with websockets.connect(WS_URL, max_size=10_000_000) as ws:
        # drain history
        await asyncio.wait_for(ws.recv(), timeout=5)

        await ws.send(json.dumps({
            "type":       "start_orchestration",
            "project_id": result.project_id,
            "goal":       prompt,
        }))

        try:
            async for raw in ws:
                try:
                    msg = json.loads(raw)
                except Exception:
                    continue

                mtype = msg.get("type", "")
                agent = msg.get("agent", "system")
                now   = time.time()
                elapsed = now - t_run

                if mtype == "chunk":
                    text = msg.get("content", "")
                    if agent not in chunks:
                        chunks[agent] = {"chars": 0, "t": now}
                    chunks[agent]["chars"] += len(text)
                    continue

                # flush chunk tracker
                if agent in chunks and mtype != "chunk":
                    dur = now - chunks[agent]["t"]
                    cps = chunks[agent]["chars"] / dur if dur > 0 else 0
                    # attach to current task
                    if current_tnum and current_tnum in tasks:
                        tasks[current_tnum].chars += chunks[agent]["chars"]
                        tasks[current_tnum].cps    = cps
                    del chunks[agent]

                if mtype == "orch_plan":
                    result.plan_time = elapsed
                    plan_tasks = msg.get("tasks", [])
                    result.task_count = len(plan_tasks)
                    print(f"    Plan: {len(plan_tasks)} tasks  (plan_time={elapsed:.1f}s)")

                elif mtype == "orch_task_start":
                    tnum  = msg.get("task_number")
                    title = msg.get("title", "")
                    ag    = msg.get("assigned_to", agent)
                    if tnum:
                        tasks[tnum] = TaskResult(
                            number=tnum, title=title, agent=ag,
                        )
                        tasks[tnum]._t_start = elapsed
                        current_tnum = tnum
                        print(f"    [{elapsed:5.0f}s] Task {tnum} start: {title[:50]}")

                elif mtype == "orch_task_done":
                    tnum  = msg.get("task_number", current_tnum)
                    files = msg.get("files", [])
                    err   = msg.get("error", "")
                    if tnum and tnum in tasks:
                        t = tasks[tnum]
                        t.duration = elapsed - getattr(t, "_t_start", elapsed)
                        t.files    = files
                        t.status   = "errored" if err else "done"
                        ok = "✓" if not err else "✗"
                        print(f"    [{elapsed:5.0f}s] Task {tnum} {ok}  {t.duration:.0f}s  "
                              f"{t.chars}ch  {t.cps:.0f}c/s  files={files}")

                elif mtype == "orch_phase":
                    phase = msg.get("phase", "")
                    mmsg  = msg.get("msg", phase)[:80]
                    if "failed quality" in phase.lower() or "⚠️ task" in phase.lower():
                        tnum_str = ""
                        import re
                        m = re.search(r'Task (\d+)', phase)
                        if m:
                            tnum_str = int(m.group(1))
                            if tnum_str in tasks:
                                tasks[tnum_str].retried = True
                                tasks[tnum_str].eval_fail_reason = phase[phase.find(":")+1:].strip()[:120]
                        print(f"    [{elapsed:5.0f}s] EVAL FAIL: {phase[:80]}")
                    elif "test_fixed" in phase or "fixing" in phase:
                        print(f"    [{elapsed:5.0f}s] TEST PHASE: {mmsg}")
                    elif "test_pass" in phase:
                        print(f"    [{elapsed:5.0f}s] TEST PASS ✓")

                elif mtype == "orch_file":
                    result.final_files.append(msg.get("path", ""))

                elif mtype == "orch_stats":
                    files_fixed = msg.get("files_fixed", 0)
                    if isinstance(files_fixed, list):
                        result.test_phase_files_fixed = len(files_fixed)
                    elif isinstance(files_fixed, int):
                        result.test_phase_files_fixed = files_fixed

                elif mtype == "orch_complete":
                    result.total_time = elapsed
                    print(f"    [{elapsed:5.0f}s] COMPLETE")
                    break

                elif mtype == "error":
                    print(f"    ERROR: {msg.get('message','')}")

        except (websockets.exceptions.ConnectionClosed, asyncio.TimeoutError) as e:
            print(f"    WS ended: {e}")

    result.tasks = list(tasks.values())
    result.total_time = result.total_time or (time.time() - t_run)

    # Smoke test
    import os
    src = f"/Users/parasjain/ai-chat/projects/{result.project_slug}/src"
    if os.path.isdir(src):
        idx = os.path.join(src, "index.html")
        if os.path.isfile(idx):
            with open(idx) as f:
                html = f.read()
            if 'src="/' in html or "href='/" in html:
                result.smoke_issues.append("absolute paths")
            if "TODO" in html or "PLACEHOLDER" in html:
                result.smoke_issues.append("TODOs found")
            result.smoke_ok = not result.smoke_issues
        else:
            result.smoke_issues.append("index.html missing")

    return result


def print_comparison(results_7b: list[RunResult], results_16b: list[RunResult]):
    print(f"\n\n{WIDE}")
    print(f"  BENCHMARK RESULTS  —  {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"{WIDE}")

    all_7b_total  = sum(r.total_time for r in results_7b)
    all_16b_total = sum(r.total_time for r in results_16b)

    for task_name in [t["name"] for t in TASKS]:
        r7  = next((r for r in results_7b  if r.task_name == task_name), None)
        r16 = next((r for r in results_16b if r.task_name == task_name), None)
        if not r7 or not r16:
            continue

        print(f"\n  TASK: {task_name.upper()}")
        print(f"  {SEP}")
        print(f"  {'Metric':<30} {'Qwen Coder 7B':>18} {'DeepSeek 16B':>18}  {'Winner':>8}")
        print(f"  {SEP}")

        def row(label, v7, v16, fmt=lambda x: str(x), lower_is_better=False):
            s7  = fmt(v7)
            s16 = fmt(v16)
            if isinstance(v7, (int, float)) and isinstance(v16, (int, float)):
                if lower_is_better:
                    winner = "7B ✓" if v7 < v16 else ("16B ✓" if v16 < v7 else "tie")
                else:
                    winner = "7B ✓" if v7 > v16 else ("16B ✓" if v16 > v7 else "tie")
            else:
                winner = "—"
            print(f"  {label:<30} {s7:>18} {s16:>18}  {winner:>8}")

        row("Plan time (s)",       r7.plan_time,  r16.plan_time,  fmt=lambda x: f"{x:.1f}s", lower_is_better=True)
        row("Total build time (s)",r7.total_time, r16.total_time, fmt=lambda x: f"{x:.0f}s", lower_is_better=True)
        row("Task count",          r7.task_count, r16.task_count, fmt=lambda x: str(x))
        row("Tasks errored",
            sum(1 for t in r7.tasks  if t.status == "errored"),
            sum(1 for t in r16.tasks if t.status == "errored"),
            fmt=lambda x: str(x), lower_is_better=True)
        row("Tasks retried",
            sum(1 for t in r7.tasks  if t.retried),
            sum(1 for t in r16.tasks if t.retried),
            fmt=lambda x: str(x), lower_is_better=True)
        row("Test phase fixes",    r7.test_phase_files_fixed, r16.test_phase_files_fixed,
            fmt=lambda x: str(x), lower_is_better=True)

        # Speed: avg chars/sec across code tasks
        def avg_cps(r):
            code_tasks = [t for t in r.tasks if t.agent == "deepseek" and t.cps > 0]
            return sum(t.cps for t in code_tasks) / len(code_tasks) if code_tasks else 0
        row("Avg coder speed (c/s)", avg_cps(r7), avg_cps(r16), fmt=lambda x: f"{x:.0f}")

        row("Files written",
            len(set(r7.final_files)),
            len(set(r16.final_files)),
            fmt=lambda x: str(x))
        row("Smoke test",
            "✓ clean" if r7.smoke_ok else f"✗ {','.join(r7.smoke_issues[:2])}",
            "✓ clean" if r16.smoke_ok else f"✗ {','.join(r16.smoke_issues[:2])}",
            fmt=lambda x: x)

        # Per-task detail
        print(f"\n  Task breakdown:")
        print(f"  {'#':<3} {'Title':<36} {'7B dur':>8} {'7B c/s':>7} {'16B dur':>9} {'16B c/s':>8}  status")
        all_tnums = sorted(set(
            [t.number for t in r7.tasks] + [t.number for t in r16.tasks]
        ))
        for tnum in all_tnums:
            t7  = next((t for t in r7.tasks  if t.number == tnum), None)
            t16 = next((t for t in r16.tasks if t.number == tnum), None)
            d7  = f"{t7.duration:.0f}s"  if t7  else "—"
            d16 = f"{t16.duration:.0f}s" if t16 else "—"
            c7  = f"{t7.cps:.0f}"        if t7  and t7.cps  > 0 else "—"
            c16 = f"{t16.cps:.0f}"       if t16 and t16.cps > 0 else "—"
            title = (t7 or t16).title[:35] if (t7 or t16) else f"task {tnum}"
            s7  = "✓" if t7  and t7.status  == "done" else ("✗" if t7  else "—")
            s16 = "✓" if t16 and t16.status == "done" else ("✗" if t16 else "—")
            print(f"  {tnum:<3} {title:<36} {d7:>8} {c7:>7} {d16:>9} {c16:>8}  7b:{s7} 16b:{s16}")

        print(f"\n  URLs:")
        print(f"  7B  → http://192.168.0.130:8080/play/{r7.project_slug}/")
        print(f"  16B → http://192.168.0.130:8080/play/{r16.project_slug}/")

    # Overall summary
    print(f"\n{WIDE}")
    print(f"  OVERALL  (all {len(TASKS)} tasks combined)")
    print(f"  {SEP}")
    total_err_7b  = sum(sum(1 for t in r.tasks if t.status == "errored") for r in results_7b)
    total_err_16b = sum(sum(1 for t in r.tasks if t.status == "errored") for r in results_16b)
    all_cps_7b    = [t.cps for r in results_7b  for t in r.tasks if t.agent == "deepseek" and t.cps > 0]
    all_cps_16b   = [t.cps for r in results_16b for t in r.tasks if t.agent == "deepseek" and t.cps > 0]
    avg7  = sum(all_cps_7b)  / len(all_cps_7b)  if all_cps_7b  else 0
    avg16 = sum(all_cps_16b) / len(all_cps_16b) if all_cps_16b else 0

    print(f"  {'Total build time':<30} {all_7b_total/60:>15.1f}min  {all_16b_total/60:>15.1f}min")
    print(f"  {'Total tasks errored':<30} {total_err_7b:>18} {total_err_16b:>18}")
    print(f"  {'Avg coder speed (c/s)':<30} {avg7:>18.0f} {avg16:>18.0f}")
    speed_ratio = avg7 / avg16 if avg16 > 0 else 0
    print(f"  {'Speed ratio (7B/16B)':<30} {speed_ratio:>18.2f}x {'':>18}")
    print(f"{WIDE}\n")


async def main():
    print(f"\n{WIDE}")
    print(f"  BENCHMARK  —  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Models: {' vs '.join(m['label'] for m in MODELS)}")
    print(f"  Tasks:  {', '.join(t['name'] for t in TASKS)}")
    print(f"{WIDE}")

    results_7b  = []
    results_16b = []

    for task_cfg in TASKS:
        print(f"\n{'─'*72}")
        print(f"  TASK: {task_cfg['name'].upper()}")
        print(f"{'─'*72}")

        for model_cfg in MODELS:
            print(f"\n  [{model_cfg['label']}]  task={task_cfg['name']}")
            t0 = time.time()
            try:
                result = await run_one(model_cfg, task_cfg)
            except Exception as e:
                print(f"  ERROR: {e}")
                import traceback; traceback.print_exc()
                result = RunResult(
                    model_key=model_cfg["key"],
                    model_name=model_cfg["label"],
                    task_name=task_cfg["name"],
                    total_time=time.time() - t0,
                )

            if model_cfg["key"] == "7b":
                results_7b.append(result)
            else:
                results_16b.append(result)

            print(f"  Done: {result.total_time:.0f}s  "
                  f"tasks={result.task_count}  "
                  f"errored={sum(1 for t in result.tasks if t.status=='errored')}")

    # Restore 7B as default
    http_post("/settings/coder-model", {
        "model": "qwen2.5-coder:7b",
        "label": "Qwen Coder",
    })
    print("\n  Restored default coder model: qwen2.5-coder:7b")

    print_comparison(results_7b, results_16b)


if __name__ == "__main__":
    asyncio.run(main())
