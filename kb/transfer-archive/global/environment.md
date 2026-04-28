# Dev Environment

**Last updated:** 2026-04-09

---

## Machine roles

### Mac mini — primary dev machine
- **SSH:** `ssh parasjain@192.168.0.130`
- **Role:** All code, all builds, all debugging, all dev servers
- **OS:** macOS (Apple Silicon / arm64)
- **Shell:** zsh, Homebrew at `/opt/homebrew/`
- **Java:** OpenJDK 17 via Homebrew (`/opt/homebrew/opt/openjdk@17`)
- **Android SDK:** `$HOME/Library/Android/sdk`
- **Node:** via Homebrew
- **Ollama:** Running locally with Qwen and DeepSeek models

### Windows laptop — UI only
- **Role:** Runs Claude Code UI, Dropbox sync client, browser
- **Shell:** bash (Git Bash / WSL)
- **No code lives here** — Dropbox only holds outputs and memory files
- **Dropbox root:** `C:\dropbox\`
- **Android SDK:** `C:\Users\paras\AppData\Local\Android\Sdk\` — for local emulator/ADB only, not builds
- **Debug keystore:** `C:\Users\paras\.android\debug.keystore` — auto-generated, not critical
- **Release keystore:** Mac mini only (`~/finpath/android/app/finpath-release.jks`), never on Windows

### Dropbox — shared output + memory layer
- Synced between Windows and Mac mini (mounted at `/Volumes/Dropbox/` on Mac)
- **Contents:** APK outputs, session logs, this memory system
- **Never:** source code, node_modules, build artifacts that belong in the project

---

## Environment variables for Mac mini builds

```bash
export PATH="/opt/homebrew/bin:$PATH"
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME="$HOME/Library/Android/sdk"
```

Add to `~/.zshrc` on Mac mini so they're always available.

---

## Ollama on Mac mini

```bash
ssh parasjain@192.168.0.130 'ollama list'   # see available models
ollama run qwen3                             # interactive
```

Use for: token-saving inference tasks, code review, local reasoning — anything that doesn't need Claude's full capability.

---

## Dropbox path mapping

| Windows | Mac mini |
|---|---|
| `C:\dropbox\` | `/Volumes/Dropbox/` |
| `C:\dropbox\Finpath\` | `/Volumes/Dropbox/Finpath/` |
| `C:\dropbox\claude\` | `/Volumes/Dropbox/claude/` |
