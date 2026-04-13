# Deployment Guide — ai-chat Platform

> Target: Mac Mini (Apple Silicon M-series, 16 GB RAM), macOS, headless
> Last updated: 2026-04-14

---

## Prerequisites

| Tool | Install | Notes |
|------|---------|-------|
| Python 3.11+ | Homebrew: `brew install python` | Must be 3.11+ for `asyncio` features used |
| Git | Bundled with macOS or Xcode CLT | Required for project versioning |
| Ollama | [ollama.ai](https://ollama.ai) | Runs local AI models |
| Anthropic API key | [console.anthropic.com](https://console.anthropic.com) | Claude access |

---

## First-Time Setup

```bash
# 1. Clone the repository
git clone <repo-url> ~/ai-chat
cd ~/ai-chat

# 2. Create and activate Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Create environment file
cat > .env << 'EOF'
ANTHROPIC_API_KEY=sk-ant-your-key-here
# Optional overrides:
# SERVER_HOST=192.168.0.130:8080
# CONTEXT_LEN=20
# OLLAMA_BASE=http://localhost:11434
EOF

# 5. Pull required Ollama models
ollama pull deepseek-coder-v2:16b-lite-instruct-q5_K_S
ollama pull qwen3.5:9b

# 6. Start the server
./start.sh
```

Open `http://192.168.0.130:8080` in any browser on the local network.

---

## Starting & Stopping

### Start (background, survives SSH disconnect)

```bash
cd ~/ai-chat
nohup .venv/bin/uvicorn server:app --host 0.0.0.0 --port 8080 > /tmp/ai-chat.log 2>&1 &
echo "Server PID: $!"
```

### Stop

```bash
kill $(ps aux | grep 'uvicorn server:app' | grep -v grep | awk '{print $2}') 2>/dev/null
echo "Server stopped"
```

### Restart (stop + start)

```bash
kill $(ps aux | grep 'uvicorn server:app' | grep -v grep | awk '{print $2}') 2>/dev/null
sleep 1
cd ~/ai-chat
nohup .venv/bin/uvicorn server:app --host 0.0.0.0 --port 8080 > /tmp/ai-chat.log 2>&1 &
echo "Restarted — PID: $!"
```

### Check if running

```bash
pgrep -lf "uvicorn server:app"
# or
curl -s http://localhost:8080/health | python3 -m json.tool
```

### View logs

```bash
tail -f /tmp/ai-chat.log
# or the rotating log:
tail -f ~/ai-chat/ai-chat.log
```

---

## Ollama Management

```bash
# Check running models
ollama ps

# List installed models
ollama list

# Pull a new model
ollama pull <model-name>

# Remove a model
ollama rm <model-name>
```

Ollama must be running before starting the server. It auto-starts on macOS if installed via the official installer.

---

## Configuration

All settings are in `config.py` with environment variable overrides. Edit `.env` to customize:

```bash
# .env example
ANTHROPIC_API_KEY=sk-ant-...
SERVER_HOST=192.168.0.130:8080   # change if IP changes
CONTEXT_LEN=25                    # more context per LLM call
BACKUP_INTERVAL=43200             # backup every 12h instead of 24h
```

---

## Backup & Recovery

Backups run automatically every 24 hours, keeping the last 14 snapshots in `backups/`.

**Manual backup:**
```bash
curl -s -X POST http://localhost:8080/backup
```

**Backup contents:**
- `chat.db` (all messages, projects, tasks)
- `memory/universal_lessons.md`

**Restore from backup:**
```bash
# Stop the server first
kill $(ps aux | grep uvicorn | grep -v grep | awk '{print $2}') 2>/dev/null

# Restore database from a backup
cp ~/ai-chat/backups/20260414_120000/chat.db ~/ai-chat/chat.db
cp -r ~/ai-chat/backups/20260414_120000/memory/ ~/ai-chat/memory/

# Restart
cd ~/ai-chat && nohup .venv/bin/uvicorn server:app --host 0.0.0.0 --port 8080 > /tmp/ai-chat.log 2>&1 &
```

---

## Updating

```bash
# Pull latest code
cd ~/ai-chat
git pull

# Install any new dependencies
source .venv/bin/activate
pip install -r requirements.txt

# Restart
kill $(ps aux | grep uvicorn | grep -v grep | awk '{print $2}') 2>/dev/null
sleep 1
nohup .venv/bin/uvicorn server:app --host 0.0.0.0 --port 8080 > /tmp/ai-chat.log 2>&1 &
```

---

## Disk Space

Projects accumulate in `projects/`. To free space:

```bash
# Check disk usage
df -h

# See project sizes
du -sh ~/ai-chat/projects/*/

# Delete a specific project's source (DB record remains)
rm -rf ~/ai-chat/projects/<slug>/src/

# Or delete via the API (removes DB records + files)
curl -X DELETE http://localhost:8080/projects/<id>
```

---

## Troubleshooting

### Server won't start
```bash
# Check if port 8080 is in use
lsof -i :8080

# Check Python venv
source ~/ai-chat/.venv/bin/activate
python3 -c "import fastapi; print('FastAPI OK')"
```

### Ollama not responding
```bash
# Check Ollama status
curl http://localhost:11434/api/tags

# Restart Ollama (macOS)
pkill ollama && sleep 2 && ollama serve &
```

### Claude API errors
```bash
# Test API key
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4-6","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

### Database locked
```bash
# Check for WAL files (safe to delete if server is stopped)
ls -la ~/ai-chat/chat.db*

# Reset WAL if server crashed mid-write
sqlite3 ~/ai-chat/chat.db "PRAGMA wal_checkpoint(FULL);"
```

### Stuck tasks
Open the app → select the project → the UI shows a "Resume" button if tasks are pending. Or via WebSocket: send `{type: "resume_orchestration", project_id: N}`.
