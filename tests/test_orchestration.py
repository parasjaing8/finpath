"""
Programmatic orchestration test — creates a project via REST, then triggers
orchestration via WebSocket and monitors every message in real-time.

Usage (run from Mac Mini with venv Python):
  .venv/bin/python test_orchestration.py [--prompt "..."]

Flow:
  1. POST /projects   → create project, get project_id
  2. WS send {type: "start_orchestration", project_id, goal}
  3. Stream all WS events until "orch_complete" or "done"
"""

import asyncio
import json
import sys
import time
import urllib.request
import urllib.parse
from datetime import datetime

try:
    import websockets
except ImportError:
    print("ERROR: websockets not installed.")
    sys.exit(1)

BASE_URL = "http://localhost:8080"
WS_URL   = "ws://localhost:8080/ws"

# Parse --prompt argument
if "--prompt" in sys.argv:
    idx = sys.argv.index("--prompt")
    PROMPT = " ".join(sys.argv[idx+1:])
else:
    PROMPT = ("Build a simple click counter web app. "
              "Single self-contained index.html with a large number display, "
              "plus and minus buttons, and reset. No external dependencies.")

PROJECT_NAME = "test-counter"

SEP  = "─" * 70
WIDE = "═" * 70

def ts():
    return datetime.now().strftime("%H:%M:%S.%f")[:-3]

def c(code, text):
    return f"\033[{code}m{text}\033[0m"

def fmt_role(role):
    codes = {
        "system":    "90",
        "claude":    "96",
        "deepseek":  "93",
        "qwen":      "95",
        "user":      "92",
        "evaluator": "91",
        "error":     "31",
        "orch":      "36",
    }
    return c(codes.get(role, "97"), f"[{role.upper():12s}]")

def http_post(path, payload):
    data = json.dumps(payload).encode()
    req  = urllib.request.Request(
        BASE_URL + path,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())

async def run():
    print(f"\n{WIDE}")
    print(f"  ORCHESTRATION TEST — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{WIDE}")
    print(f"  Prompt  : {PROMPT}")
    print(f"  WS      : {WS_URL}")
    print(f"{WIDE}\n")

    # ── 1. Create project via REST ────────────────────────────────────────────
    print(f"{ts()} {fmt_role('system')} Creating project via POST /projects ...")
    project = http_post("/projects", {"name": PROJECT_NAME, "description": PROMPT})
    project_id = project["id"]
    print(f"{ts()} {fmt_role('system')} Project created: id={project_id}  slug={project.get('slug','?')}")

    t_start = time.time()
    tasks   = {}
    chunks  = {}
    current_task_num = None
    final_files = []

    # ── 2. Connect WS and start orchestration ─────────────────────────────────
    async with websockets.connect(WS_URL, max_size=10_000_000) as ws:
        # Drain the initial history message
        history_raw = await asyncio.wait_for(ws.recv(), timeout=5)
        try:
            history = json.loads(history_raw)
            print(f"{ts()} {fmt_role('system')} WS connected. history msgs={len(history.get('messages',[]))}")
        except Exception:
            pass

        # Send start_orchestration
        await ws.send(json.dumps({
            "type":       "start_orchestration",
            "project_id": project_id,
            "goal":       PROMPT,
        }))
        print(f"{ts()} {fmt_role('system')} Sent start_orchestration\n")

        # ── 3. Stream and parse all responses ──────────────────────────────
        try:
            async for raw in ws:
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    print(f"{ts()} {fmt_role('error')} Non-JSON: {raw[:120]}")
                    continue

                mtype = msg.get("type", "")
                agent = msg.get("agent", msg.get("role", "system"))
                now   = time.time()
                elapsed = now - t_start

                # ── Token chunks ──────────────────────────────────────────
                if mtype == "chunk":
                    text = msg.get("content", msg.get("text", ""))
                    if agent not in chunks:
                        chunks[agent] = {"chars": 0, "t": now}
                        print(f"\n{ts()} {fmt_role(agent)} streaming ", end="", flush=True)
                    chunks[agent]["chars"] += len(text)
                    # Print a dot every ~200 chars to show progress
                    if chunks[agent]["chars"] % 200 < len(text):
                        print(".", end="", flush=True)
                    continue

                # Flush streaming dot-line when non-chunk arrives
                if agent in chunks:
                    dur = now - chunks[agent]["t"]
                    chars = chunks[agent]["chars"]
                    tps = chars / dur if dur > 0 else 0
                    print(f"  [{chars} chars, {dur:.1f}s, ~{tps:.0f} c/s]")
                    del chunks[agent]

                # ── Orchestration plan ────────────────────────────────────
                if mtype == "orch_plan":
                    plan_tasks = msg.get("tasks", [])
                    print(f"\n{ts()} {fmt_role('orch')} PLAN → {len(plan_tasks)} tasks:")
                    for t in plan_tasks:
                        print(f"         #{t.get('task_number','?'):2}  [{t.get('assigned_to','?'):12}]  {t.get('title','')}")

                # ── Phase updates ─────────────────────────────────────────
                elif mtype == "orch_phase":
                    phase = msg.get("phase","")
                    mmsg  = msg.get("msg","")[:120]
                    if phase not in ("planning_tick",):
                        print(f"{ts()} {fmt_role('orch')} [{phase}] {mmsg}")

                # ── Task start ────────────────────────────────────────────
                elif mtype == "orch_task_start":
                    tnum  = msg.get("task_number", "?")
                    title = msg.get("title","")
                    ag    = msg.get("assigned_to","?")
                    tid   = msg.get("task_id","?")
                    tasks[tnum] = {"title": title, "agent": ag, "tid": tid,
                                   "status": "running", "t_start": elapsed}
                    current_task_num = tnum
                    print(f"\n{ts()} {fmt_role(ag)} TASK {tnum} START  → {title}")

                # ── Task done ─────────────────────────────────────────────
                elif mtype == "orch_task_done":
                    tnum  = msg.get("task_number", current_task_num)
                    files = msg.get("files", [])
                    err   = msg.get("error","")
                    if tnum in tasks:
                        tasks[tnum]["t_end"] = elapsed
                        dur = tasks[tnum]["t_end"] - tasks[tnum].get("t_start", 0)
                        tasks[tnum]["files"] = files
                        tasks[tnum]["error"] = err
                        ok = c("92","✓") if not err else c("91","✗")
                        print(f"{ts()} {fmt_role(tasks[tnum].get('agent','?'))} TASK {tnum} {ok}  ({dur:.1f}s)  files={files}")
                        if err:
                            print(f"         {c('91','ERR:')} {err[:200]}")
                    final_files.extend(files)

                # ── File written ──────────────────────────────────────────
                elif mtype == "orch_file":
                    path = msg.get("path","")
                    print(f"{ts()} {fmt_role('orch')} FILE  {path}")

                # ── Evaluator / retry ─────────────────────────────────────
                elif mtype in ("eval_fail","eval_retry","orch_eval_fail"):
                    reason = msg.get("reason", msg.get("feedback",""))[:250]
                    tnum   = msg.get("task_number","?")
                    print(f"{ts()} {fmt_role('evaluator')} EVAL FAIL task={tnum}  ↳ {reason}")

                # ── Test phase ────────────────────────────────────────────
                elif mtype == "orch_test":
                    print(f"{ts()} {fmt_role('orch')} TEST  {msg.get('msg','')[:120]}")

                # ── Stats card ────────────────────────────────────────────
                elif mtype == "orch_stats":
                    print(f"{ts()} {fmt_role('orch')} STATS  {msg}")

                # ── Complete ──────────────────────────────────────────────
                elif mtype == "orch_complete":
                    total = time.time() - t_start
                    summary = msg.get("summary","")[:300]
                    print(f"\n{ts()} {fmt_role('orch')} COMPLETE ({total:.1f}s)")
                    print(f"  Summary: {summary}")
                    break

                # ── Error ─────────────────────────────────────────────────
                elif mtype == "error":
                    print(f"{ts()} {fmt_role('error')} ERROR: {msg.get('message',msg)}")

                # ── Other messages (don't suppress) ──────────────────────
                elif mtype not in ("status", "agent_count"):
                    compact = str(msg)[:200]
                    print(f"{ts()} {fmt_role(agent)} [{mtype}] {compact}")

        except websockets.exceptions.ConnectionClosed as e:
            print(f"\n{ts()} {fmt_role('error')} WS closed: {e}")
        except asyncio.TimeoutError:
            print(f"\n{ts()} {fmt_role('error')} Timeout waiting for messages")

    # ── 4. Summary ────────────────────────────────────────────────────────────
    total = time.time() - t_start
    print(f"\n{WIDE}")
    print(f"  SUMMARY   project_id={project_id}   total={total:.1f}s")
    print(f"{WIDE}")
    done_n    = sum(1 for t in tasks.values() if not t.get("error"))
    errored_n = sum(1 for t in tasks.values() if t.get("error"))
    print(f"  Tasks: {len(tasks)}  done={done_n}  errored={errored_n}")
    print()
    for num, t in sorted(tasks.items()):
        dur = t.get("t_end", total) - t.get("t_start", 0)
        ok  = "✓" if not t.get("error") else "✗"
        files = ", ".join(t.get("files", [])) or "—"
        print(f"  {ok} #{num:2}  [{t.get('agent','?'):12}]  {t.get('title',''):45}  {dur:5.1f}s  {files}")
    print()
    if final_files:
        print(f"  Files written: {', '.join(final_files)}")
    print(f"  Play at: http://192.168.0.130:8080/play/{project.get('slug','?')}/")
    print(f"{WIDE}\n")

    # ── 5. Quick smoke test of generated files ────────────────────────────────
    slug = project.get("slug","")
    if slug:
        print(f"  Smoke-testing generated files...")
        import os
        src_dir = f"/Users/parasjain/ai-chat/projects/{slug}/src"
        if os.path.isdir(src_dir):
            files = []
            for root, dirs, filenames in os.walk(src_dir):
                for fn in filenames:
                    rel = os.path.relpath(os.path.join(root, fn), src_dir)
                    files.append(rel)
            print(f"  Files in src/: {files}")

            idx = os.path.join(src_dir, "index.html")
            if os.path.isfile(idx):
                with open(idx) as f:
                    html = f.read()
                issues = []
                if "src=\"/" in html or "href=\"/" in html:
                    issues.append("absolute paths (src=\"/...\")")
                if "<script" in html and "undefined" in html.lower():
                    issues.append("possible 'undefined' in script tags")
                if "TODO" in html or "PLACEHOLDER" in html:
                    issues.append("TODOs or PLACEHOLDERs found")
                if issues:
                    print(f"  ⚠ index.html issues: {issues}")
                else:
                    print(f"  ✓ index.html looks clean  ({len(html)} bytes)")
            else:
                print(f"  ✗ index.html MISSING")
        else:
            print(f"  ✗ src/ dir missing: {src_dir}")


if __name__ == "__main__":
    asyncio.run(run())
