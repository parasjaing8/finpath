"""Watch-only monitor — connects to existing in-progress build."""
import asyncio, json, websockets, sys

PROJECT_ID = 65

async def watch():
    uri = "ws://localhost:8080/ws"
    async with websockets.connect(uri) as ws:
        await ws.send(json.dumps({"type": "subscribe", "project_id": PROJECT_ID}))
        print(f"Watching project {PROJECT_ID}...")

        while True:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=300)
                data = json.loads(msg)
                t = data.get("type", "")

                if t == "orch_phase":
                    print(f"[PHASE] {data.get('phase','')}: {data.get('msg','')}")
                elif t == "orch_plan":
                    tasks = data.get("tasks", [])
                    print(f"[PLAN] {len(tasks)} tasks:")
                    for task in tasks:
                        print(f"  Task {task['task_number']}: {task['title']} -> {task['assigned_to']}")
                elif t == "orch_task_start":
                    print(f"\n[TASK START] #{data.get('task_number')}: {data.get('title')} ({data.get('agent')})")
                elif t == "chunk":
                    # Print first char of each chunk to show activity
                    content = data.get("content", "")
                    agent = data.get("agent", "")
                    sys.stdout.write(".")
                    sys.stdout.flush()
                elif t == "done":
                    print(f"\n[STREAM DONE] {data.get('agent','')}")
                elif t == "orch_task_complete":
                    print(f"[TASK DONE] #{data.get('task_number')}: {data.get('title')} -> {data.get('status','')}")
                elif t == "orch_task_eval":
                    approved = data.get("approved")
                    fb = (data.get("feedback") or "")[:120]
                    print(f"[EVAL] Task #{data.get('task_number')}: {'APPROVED' if approved else 'REJECTED'} -- {fb}")
                elif t == "orch_blocked":
                    print(f"\n[BLOCKED] {data.get('message','')}")
                elif t == "orch_complete":
                    print(f"\n[COMPLETE] Build done!")
                    stats = data.get("stats", {})
                    if stats:
                        print(f"  Total tokens: {stats.get('total_tokens',0)}")
                        print(f"  Cost: ${stats.get('total_cost_usd',0):.4f}")
                        print(f"  Model switches: {stats.get('model_switch_count',0)}")
                        by_agent = stats.get("by_agent", {})
                        for agent, d in by_agent.items():
                            print(f"  {agent}: {d.get('tasks_completed',0)} tasks, "
                                  f"{d.get('output_tokens',0)} output tokens")
                    break
                elif t == "error":
                    print(f"\n[ERROR] {data.get('message','')}")
                    break
                elif t not in ("user", "pong", "subscribed", "history", "status"):
                    print(f"\n[{t}] {str(data)[:150]}")

            except asyncio.TimeoutError:
                print("\n[TIMEOUT] No message for 5 min")
                break

asyncio.run(watch())
