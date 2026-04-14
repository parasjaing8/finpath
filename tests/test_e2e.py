"""Integration (E2E) test harness — T12.5

Starts the server (or attaches to one already running), creates a project,
sends ``start_orchestration``, waits for ``orch_complete`` or ``orch_blocked``,
then verifies:
  - Files were written to projects/<slug>/src/
  - GET /play/<slug>/ returns HTTP 200

Run the full suite:
    python -m pytest tests/test_e2e.py -v

Environment variables that influence the test:
  ANTHROPIC_API_KEY   — Required for orchestration to work
  E2E_PORT            — Port to use (default: 18080, avoids conflict with prod)
  E2E_TIMEOUT         — Seconds to wait for orch_complete (default: 120)
  RUN_E2E             — Must be set to "1" to run these tests (safety gate)
"""
from __future__ import annotations

import asyncio
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import AsyncGenerator

import httpx
import pytest

# ── Safety gate ───────────────────────────────────────────────────────────────
# E2E tests hit real APIs and cost money; require explicit opt-in.
if not os.getenv("RUN_E2E"):
    pytest.skip(
        "E2E tests are opt-in. Set RUN_E2E=1 to run them.",
        allow_module_level=True,
    )

_BASE_DIR = Path(__file__).parent.parent
_E2E_PORT = int(os.getenv("E2E_PORT", "18080"))
_E2E_TIMEOUT = int(os.getenv("E2E_TIMEOUT", "120"))
_BASE_URL = f"http://localhost:{_E2E_PORT}"
_WS_URL = f"ws://localhost:{_E2E_PORT}/ws"

# ── Fixtures ──────────────────────────────────────────────────────────────────


def _server_listening(port: int) -> bool:
    """Return True if something is already listening on *port*."""
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        return s.connect_ex(("127.0.0.1", port)) == 0


@pytest.fixture(scope="session")
def live_server():
    """Start the server on E2E_PORT and yield the base URL.

    If the port is already occupied (e.g., a dev server is running there),
    the fixture attaches to it directly instead of spawning a new process.
    The server process is always stopped at the end of the session if WE
    started it.
    """
    proc = None

    if _server_listening(_E2E_PORT):
        yield _BASE_URL
        return

    env = {**os.environ, "PORT": str(_E2E_PORT)}
    proc = subprocess.Popen(
        [
            sys.executable, "-m", "uvicorn",
            "server:app",
            "--host", "127.0.0.1",
            "--port", str(_E2E_PORT),
            "--log-level", "warning",
        ],
        cwd=str(_BASE_DIR),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # Wait for the server to become ready (up to 30s)
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if _server_listening(_E2E_PORT):
            break
        if proc.poll() is not None:
            pytest.fail(f"Server process exited prematurely with code {proc.returncode}")
        time.sleep(0.5)
    else:
        proc.kill()
        pytest.fail(f"Server did not start within 30s on port {_E2E_PORT}")

    yield _BASE_URL

    proc.terminate()
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        proc.kill()


@pytest.fixture
def created_project_ids():
    """Collect project IDs created during the test so we can delete them after."""
    ids: list[int] = []
    yield ids
    # cleanup: delete test projects from disk (DB rows are cheap to leave)
    for pid in ids:
        try:
            r = httpx.get(f"{_BASE_URL}/projects/{pid}", timeout=5)
            if r.status_code == 200:
                proj = r.json()
                folder = proj.get("folder_path")
                if folder and Path(folder).exists():
                    shutil.rmtree(folder, ignore_errors=True)
        except Exception:
            pass


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _collect_ws_until(url: str, send_msg: dict, stop_types: set,
                             timeout: float = _E2E_TIMEOUT) -> list[dict]:
    """Connect to *url*, send *send_msg*, collect messages until a *stop_types*
    message arrives or *timeout* seconds elapse.  Returns the message list."""
    import websockets  # local import — only needed in E2E tests

    messages: list[dict] = []
    deadline = asyncio.get_event_loop().time() + timeout

    async with websockets.connect(url) as ws:
        # drain the initial `history` + `status` messages
        while True:
            remaining = deadline - asyncio.get_event_loop().time()
            if remaining <= 0:
                raise TimeoutError("Timed out waiting for initial handshake")
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=min(remaining, 5))
                msg = json.loads(raw)
                messages.append(msg)
                if msg.get("type") in ("status", "history"):
                    if msg.get("type") == "status":
                        break  # status is always sent after history
            except asyncio.TimeoutError:
                break

        # send our command
        await ws.send(json.dumps(send_msg))

        # collect until stop type or timeout
        while True:
            remaining = deadline - asyncio.get_event_loop().time()
            if remaining <= 0:
                break
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=min(remaining, 2))
                msg = json.loads(raw)
                messages.append(msg)
                if msg.get("type") in stop_types:
                    break
            except asyncio.TimeoutError:
                continue

    return messages


# ── Tests ─────────────────────────────────────────────────────────────────────


class TestServerHealthcheck:
    """Quick sanity checks that the server is up before running expensive tests."""

    def test_health_endpoint(self, live_server):
        r = httpx.get(f"{live_server}/health", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "status" in body

    def test_list_projects_returns_200(self, live_server):
        r = httpx.get(f"{live_server}/projects", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_static_index_serves(self, live_server):
        r = httpx.get(f"{live_server}/", timeout=10)
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "")


class TestProjectCRUD:
    """REST project lifecycle without orchestration."""

    def test_create_and_retrieve_project(self, live_server, created_project_ids):
        # Create
        r = httpx.post(
            f"{live_server}/projects",
            json={"name": "E2E Test Project", "description": "automated test"},
            timeout=10,
        )
        assert r.status_code == 200
        proj = r.json()
        assert "id" in proj
        assert proj["name"] == "E2E Test Project"
        created_project_ids.append(proj["id"])

        # Retrieve
        r2 = httpx.get(f"{live_server}/projects/{proj['id']}", timeout=10)
        assert r2.status_code == 200
        assert r2.json()["id"] == proj["id"]

    def test_create_project_without_name_returns_error(self, live_server):
        r = httpx.post(f"{live_server}/projects", json={}, timeout=10)
        assert r.status_code == 200  # FastAPI returns 200+error body by convention
        assert "error" in r.json()


@pytest.mark.asyncio
class TestOrchestrationE2E:
    """Full build loop: create project → orchestrate → verify files + play URL."""

    @pytest.mark.skipif(
        not os.getenv("ANTHROPIC_API_KEY"),
        reason="ANTHROPIC_API_KEY not set — skipping LLM orchestration test",
    )
    async def test_build_counter_app(self, live_server, created_project_ids):
        """
        Happy-path: build a simple counter app and verify the deliverables.

        Flow:
          1. POST /projects → get project_id
          2. WS send start_orchestration with goal "build a simple counter app"
          3. Wait for orch_complete (or orch_blocked)
          4. Assert at least one file was written to src/
          5. Assert GET /play/<slug>/ returns 200 with <html>
        """
        # Step 1: create project
        r = httpx.post(
            f"{live_server}/projects",
            json={"name": "E2E Counter App", "description": "integration test"},
            timeout=10,
        )
        assert r.status_code == 200
        proj = r.json()
        project_id = proj["id"]
        slug = proj["slug"]
        created_project_ids.append(project_id)

        # Step 2+3: orchestrate via WebSocket
        ws_url = f"ws://localhost:{_E2E_PORT}/ws"
        try:
            messages = await _collect_ws_until(
                url=ws_url,
                send_msg={
                    "type": "start_orchestration",
                    "project_id": project_id,
                    "goal": "build a simple counter app with increment and decrement buttons",
                },
                stop_types={"orch_complete", "orch_blocked"},
                timeout=_E2E_TIMEOUT,
            )
        except TimeoutError:
            pytest.fail(f"orch_complete not received within {_E2E_TIMEOUT}s")

        msg_types = {m["type"] for m in messages}
        assert "orch_complete" in msg_types or "orch_blocked" in msg_types, (
            f"Neither orch_complete nor orch_blocked received. Types seen: {msg_types}"
        )

        # Step 4: verify files on disk
        r2 = httpx.get(f"{live_server}/projects/{project_id}/files", timeout=10)
        assert r2.status_code == 200
        files = r2.json()
        assert len(files) > 0, "Expected at least one file to be written to src/"

        # Step 5: verify the play URL works
        r3 = httpx.get(f"{live_server}/play/{slug}/", timeout=15, follow_redirects=True)
        assert r3.status_code == 200
        assert "<html" in r3.text.lower(), "Play URL did not return HTML"

    async def test_ws_connect_and_receive_history(self, live_server):
        """Verifies WebSocket handshake sends history and status immediately."""
        import websockets

        async with websockets.connect(f"ws://localhost:{_E2E_PORT}/ws") as ws:
            msg_types_seen = set()
            deadline = asyncio.get_event_loop().time() + 5
            while asyncio.get_event_loop().time() < deadline:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=1)
                    msg_types_seen.add(json.loads(raw).get("type"))
                    if "status" in msg_types_seen:
                        break
                except asyncio.TimeoutError:
                    break

        assert "history" in msg_types_seen, "Expected 'history' message on WS connect"
        assert "status" in msg_types_seen, "Expected 'status' message on WS connect"

    async def test_get_projects_via_ws(self, live_server):
        """Verifies the get_projects WS message returns a project_list."""
        import websockets

        async with websockets.connect(f"ws://localhost:{_E2E_PORT}/ws") as ws:
            # drain handshake
            await asyncio.sleep(0.2)
            try:
                while True:
                    await asyncio.wait_for(ws.recv(), timeout=0.3)
            except asyncio.TimeoutError:
                pass

            await ws.send(json.dumps({"type": "get_projects"}))

            deadline = asyncio.get_event_loop().time() + 5
            while asyncio.get_event_loop().time() < deadline:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=1)
                    msg = json.loads(raw)
                    if msg.get("type") == "project_list":
                        assert isinstance(msg.get("projects"), list)
                        return
                except asyncio.TimeoutError:
                    continue

        pytest.fail("Did not receive project_list response")
