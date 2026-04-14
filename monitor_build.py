import asyncio, json, websockets, sys, httpx

GOAL = ("Build a calculator web app that looks and feels exactly like the Android stock "
        "calculator app. It should have the same dark Material Design theme with rounded "
        "buttons, the same button layout (0-9, +, -, *, /, =, %, AC, +/-), large display "
        "showing current number and expression history, smooth button press animations, "
        "and responsive design. Make it pixel-perfect to Android's calculator.")

async def run_build():
    # Create fresh project
    async with httpx.AsyncClient() as c:
        r = await c.post('http://localhost:8080/projects', json={'name': 'android-calculator'})
        proj = r.json()
        PROJECT_ID = proj['id']
        SLUG = proj['slug']
    print(f"Created project: {PROJECT_ID} (slug={SLUG})")
    print(f"Play URL: http://192.168.0.130:8080/play/{SLUG}/")
    print("="*60)

    uri = "ws://localhost:8080/ws"
    async with websockets.connect(uri, ping_interval=30, ping_timeout=60) as ws:
        await ws.send(json.dumps({"type": "subscribe", "project_id": PROJECT_ID}))
        await ws.send(json.dumps({"type": "message", "project_id": PROJECT_ID, "content": GOAL}))
        print("Build message sent — keeping connection open...")
        print("="*60)

        while True:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=300)
                data = json.loads(msg)
                t = data.get("type", "")

                if t == "orch_phase":
                    print(f"\n[PHASE] {data.get('phase','')}: {data.get('msg','')}")
                elif t == "orch_plan":
                    tasks = data.get("tasks", [])
                    print(f"\n[PLAN] {len(tasks)} tasks:")
                    for task in tasks:
                        print(f"  Task {task['task_number']}: {task['title']} -> {task['assigned_to']}")
                elif t == "orch_task_start":
                    print(f"\n[TASK START] #{data.get('task_number')}: {data.get('title')} ({data.get('agent')})")
                elif t == "chunk":
                    pass  # skip noisy streaming chunks
                elif t == "orch_task_complete":
                    print(f"[TASK DONE] #{data.get('task_number')}: {data.get('title')} -> {data.get('status','')}")
                elif t == "orch_task_eval":
                    approved = data.get("approved")
                    fb = (data.get("feedback") or "")[:100]
                    print(f"[EVAL] Task #{data.get('task_number')}: {'APPROVED' if approved else 'REJECTED'} -- {fb}")
                elif t == "orch_blocked":
                    print(f"\n[BLOCKED] {data.get('message','')}")
                elif t == "orch_complete":
                    print(f"\n[COMPLETE] Build finished!")
                    stats = data.get("stats", {})
                    if stats:
                        print(f"  Total tokens: {stats.get('total_tokens',0)}")
                        print(f"  Cost: ${stats.get('total_cost_usd',0):.4f}")
                        print(f"  Model switches: {stats.get('model_switch_count',0)}")
                    break
                elif t == "error":
                    print(f"\n[ERROR] {data.get('message','')}")
                    break
                elif t not in ("user", "pong", "subscribed"):
                    print(f"[{t}] {str(data)[:120]}")

            except asyncio.TimeoutError:
                print("\n[TIMEOUT] No message for 5 min")
                break

asyncio.run(run_build())
