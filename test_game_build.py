#!/usr/bin/env python3
"""
Tetris game build test — full-stack (Claude + deepseek + qwen35).
Logs to /tmp/game_build.log
"""
import asyncio, json, logging, sys
import httpx
import websockets

LOG_FILE = "/tmp/game_build.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, mode="w"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger()

GOAL = (
    "Build a fully playable Tetris game as a single self-contained index.html file. "
    "Requirements: "
    "1. All 7 classic tetrominoes (I, O, T, S, Z, J, L) with proper colors. "
    "2. Keyboard controls: arrow left/right to move, arrow up or W to rotate, arrow down for soft drop, space for hard drop. "
    "3. Line clearing with scoring: 100 pts (1 line), 300 pts (2), 500 pts (3), 800 pts (4 = Tetris). "
    "4. Level system: speed increases every 10 lines cleared. "
    "5. Preview panel showing the next piece. "
    "6. Score, level, and lines display. "
    "7. Game over detection with restart button. "
    "8. Dark theme UI, canvas-based rendering (400px wide game area). "
    "9. All HTML + CSS + JS in a single index.html — no external dependencies. "
    "Ensure the game loop runs at the correct tick interval and pieces spawn at the top center."
)


async def build():
    async with httpx.AsyncClient() as c:
        r = await c.post("http://localhost:8080/projects", json={"name": "tetris-game"})
        proj = r.json()
        pid  = proj["id"]
        slug = proj["slug"]
    log.info("=== Project created: id=%d slug=%s ===", pid, slug)
    log.info("Play URL: http://192.168.0.130:8080/play/%s/", slug)
    log.info("Log:      %s", LOG_FILE)

    uri = "ws://localhost:8080/ws"
    async with websockets.connect(
        uri,
        ping_interval=20,
        ping_timeout=60,
        close_timeout=10,
        max_size=10 * 1024 * 1024,
    ) as ws:
        await ws.send(json.dumps({"type": "subscribe", "project_id": pid}))
        await ws.send(json.dumps({"type": "message", "project_id": pid, "content": GOAL}))
        log.info("Build queued — watching events...")

        while True:
            try:
                raw  = await asyncio.wait_for(ws.recv(), timeout=900)
                data = json.loads(raw)
                t    = data.get("type", "")

                if t == "orch_phase":
                    log.info("[PHASE] %s: %s", data.get("phase",""), data.get("msg",""))

                elif t == "orch_plan":
                    tasks = data.get("tasks", [])
                    log.info("[PLAN] %d task(s):", len(tasks))
                    for tk in tasks:
                        log.info("  Task %d: %-40s → agent=%s",
                                 tk["task_number"], tk["title"][:40], tk["assigned_to"])

                elif t == "orch_task_start":
                    log.info("[TASK START] #%d %s  (agent=%s)",
                             data.get("task_number",""), data.get("title",""), data.get("agent",""))

                elif t == "chunk":
                    sys.stdout.write(".")
                    sys.stdout.flush()

                elif t == "done":
                    log.info("\n[STREAM DONE] agent=%s", data.get("agent",""))

                elif t == "orch_task_complete":
                    log.info("[TASK DONE] #%d %s  status=%s",
                             data.get("task_number",""), data.get("title",""), data.get("status",""))

                elif t == "orch_task_eval":
                    approved = data.get("approved")
                    fb = (data.get("feedback") or "")[:160]
                    log.info("[EVAL] #%d %s  fb=%s",
                             data.get("task_number",""),
                             "APPROVED ✓" if approved else "REJECTED ✗",
                             fb)

                elif t == "orch_file":
                    log.info("[FILE] %s", data.get("path",""))

                elif t == "orch_blocked":
                    log.warning("[BLOCKED] %s", data.get("message",""))

                elif t == "orch_complete":
                    stats = data.get("stats", {})
                    log.info("=== BUILD COMPLETE ===")
                    log.info("  Tokens:   %d", stats.get("total_tokens", 0))
                    log.info("  Cost:     $%.4f", stats.get("total_cost_usd", 0))
                    log.info("  Switches: %d", stats.get("model_switch_count", 0))
                    for agent, d in stats.get("by_agent", {}).items():
                        log.info("  %-12s tasks=%d  output_tokens=%d",
                                 agent, d.get("tasks_completed", 0), d.get("output_tokens", 0))
                    log.info("Play URL: http://192.168.0.130:8080/play/%s/", slug)
                    break

                elif t == "error":
                    log.error("[ERROR] %s", data.get("message",""))
                    break

                elif t not in ("user","pong","subscribed","history","status","planning_tick","typing"):
                    log.info("[%s] %s", t, str(data)[:200])

            except asyncio.TimeoutError:
                log.warning("[TIMEOUT] No WS message for 15 min — build stalled?")
                break
            except Exception as e:
                log.error("[WS ERROR] %s", e)
                break

    # Report output files
    import os
    src_dir = f"/Users/parasjain/ai-chat/projects/{slug}/src"
    if os.path.isdir(src_dir):
        log.info("--- Output files ---")
        for root, dirs, files in os.walk(src_dir):
            for f in files:
                fp = os.path.join(root, f)
                log.info("  %s  (%d bytes)", fp.replace(src_dir+"/",""), os.path.getsize(fp))
    else:
        log.warning("No src/ directory found — build may have failed.")

    log.info("=== Monitor done ===")


asyncio.run(build())
