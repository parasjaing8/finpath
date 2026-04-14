#!/usr/bin/env python3
"""
Qwen-only calculator build test.
Runs as a detached background process so terminal disconnect doesn't kill the build.
Logs to /tmp/qwen_calc_build.log
"""
import asyncio, json, logging, sys
import httpx
import websockets

LOG_FILE = "/tmp/qwen_calc_build.log"
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
    "Build a simple calculator web app that looks and feels like the Android stock calculator. "
    "Dark Material Design theme, rounded buttons, layout: rows of AC/+- /% /, 7 8 9 *, "
    "4 5 6 -, 1 2 3 +, 0 . =. Large display area showing current input and previous expression. "
    "Smooth button press ripple animation. All HTML + CSS + JS in a single index.html file."
)


async def build():
    # Create a fresh project
    async with httpx.AsyncClient() as c:
        r = await c.post("http://localhost:8080/projects", json={"name": "qwen-calc-test"})
        proj = r.json()
        pid  = proj["id"]
        slug = proj["slug"]
    log.info("=== Project created: id=%d slug=%s ===", pid, slug)
    log.info("Play URL: http://192.168.0.130:8080/play/%s/", slug)
    log.info("Log: %s", LOG_FILE)

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
                raw  = await asyncio.wait_for(ws.recv(), timeout=600)
                data = json.loads(raw)
                t    = data.get("type", "")

                if t == "orch_phase":
                    log.info("[PHASE] %s: %s", data.get("phase",""), data.get("msg",""))

                elif t == "orch_plan":
                    tasks = data.get("tasks", [])
                    log.info("[PLAN] %d task(s):", len(tasks))
                    for tk in tasks:
                        log.info("  Task %d: %s  → agent=%s",
                                 tk["task_number"], tk["title"], tk["assigned_to"])

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
                    fb = (data.get("feedback") or "")[:120]
                    log.info("[EVAL] #%d %s  fb=%s",
                             data.get("task_number",""),
                             "APPROVED" if approved else "REJECTED",
                             fb)

                elif t == "orch_blocked":
                    log.warning("[BLOCKED] %s", data.get("message",""))

                elif t == "orch_complete":
                    stats = data.get("stats", {})
                    log.info("=== BUILD COMPLETE ===")
                    log.info("  Tokens:   %d", stats.get("total_tokens", 0))
                    log.info("  Cost:     $%.4f", stats.get("total_cost_usd", 0))
                    log.info("  Switches: %d", stats.get("model_switch_count", 0))
                    for agent, d in stats.get("by_agent", {}).items():
                        log.info("  %s: tasks=%d, output_tokens=%d",
                                 agent, d.get("tasks_completed", 0), d.get("output_tokens", 0))
                    log.info("Play URL: http://192.168.0.130:8080/play/%s/", slug)
                    break

                elif t == "error":
                    log.error("[ERROR] %s", data.get("message",""))
                    break

                elif t not in ("user","pong","subscribed","history","status","planning_tick"):
                    log.info("[%s] %s", t, str(data)[:150])

            except asyncio.TimeoutError:
                log.warning("[TIMEOUT] No WS message for 10 min — build stalled?")
                break
            except Exception as e:
                log.error("[WS ERROR] %s", e)
                break

    log.info("=== Monitor done ===")


if __name__ == "__main__":
    asyncio.run(build())
