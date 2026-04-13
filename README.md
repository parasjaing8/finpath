# ai-chat

A multi-agent AI development platform that turns plain-English requests into running web apps.

Describe a project, and three AI agents collaborate to plan, build, and immediately serve it at a playable URL — no setup required.

---

## What It Does

1. You describe a project in plain English ("build a snake game with a high-score board")
2. **Claude** plans it as an ordered task list
3. **DeepSeek** writes the code, **Qwen** handles CSS/styling
4. Files are committed to Git and served live at `http://192.168.0.130:8080/play/<slug>/`

Everything runs on a headless Mac Mini on your local network.

---

## Quick Start

### Prerequisites

- Mac Mini at `192.168.0.130` (or update `SERVER_HOST` in `.env`)
- Python 3.11+
- [Ollama](https://ollama.ai) running locally with DeepSeek and Qwen models pulled
- Anthropic API key

### Install & Run

```bash
git clone <repo-url> ~/ai-chat
cd ~/ai-chat

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Add your Anthropic API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# Pull local models
ollama pull deepseek-coder-v2:16b-lite-instruct-q5_K_S
ollama pull qwen3.5:9b

# Start the server
./start.sh
```

Open `http://192.168.0.130:8080` in a browser.

---

## Architecture

```
Browser → FastAPI :8080 → Claude (cloud) + DeepSeek/Qwen (Ollama local)
                       → SQLite (chat.db)
                       → projects/<slug>/src/ → /play/<slug>/
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full system design, data flow, DB schema, and WebSocket protocol.

---

## Configuration

All settings are in `config.py` and can be overridden with environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_HOST` | `192.168.0.130:8080` | Publicly reachable host:port |
| `CONTEXT_LEN` | `20` | Messages passed as LLM context |
| `OLLAMA_BASE` | `http://localhost:11434` | Ollama API URL |
| `CLAUDE_TIMEOUT` | `120` | Claude API timeout (seconds) |
| `BACKUP_INTERVAL` | `86400` | Backup frequency (seconds) |

---

## Project Structure

```
config.py        — Centralized configuration
server.py        — FastAPI app, REST API, WebSocket, startup
orchestration.py — Intent detection, planning, DAG execution
models.py        — LLM routing, streaming, token tracking
db.py            — SQLite persistence
files_io.py      — File extraction from LLM output, Git ops
skills_mod.py    — Keyword-based skill injection

static/          — Web UI (index.html, app.js, app.css)
docs/            — Architecture, API reference, deployment guide
kb/              — Agent rules and system knowledge base
skills/          — Skill markdown files (injected into agent prompts)
memory/          — Cross-project lessons learned
tests/           — Integration tests and benchmarks
```

---

## API

See [docs/API.md](docs/API.md) for all REST and WebSocket endpoints.

---

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Mac Mini setup, process management, and restart procedures.

---

## Agents

| Agent | Model | Role |
|-------|-------|------|
| Claude | claude-sonnet-4-6 (API) | Orchestrator, planner, evaluator |
| DeepSeek | deepseek-coder-v2:16b (Ollama) | Primary coder |
| Qwen | qwen3.5:9b (Ollama) | CSS/UI specialist |

Custom agents can be added at runtime via `POST /ollama/models`.

---

## Adding Skills

Drop a `.md` file in `skills/` with this format:

```markdown
---
name: my-skill
keywords: keyword1, keyword2, keyword3
description: One-line description shown in the UI
---

Content injected into the agent's system prompt when keywords match the task description...
```

---

## License

Private — running on personal infrastructure.
