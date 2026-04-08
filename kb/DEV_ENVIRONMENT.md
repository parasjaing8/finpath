# FinPath — Dev Environment

> Reference for the build/dev machine setup and AI tooling strategy.
> Last updated: 2026-04-09

---

## Machines

| Role | Machine | OS | Notes |
|---|---|---|---|
| Editor / Claude sessions | Windows 11 PC | Windows 11 Home | Local machine; no Android SDK |
| Build / Dev server | Mac mini (headless) | macOS | Accessed via SSH; all builds run here |

## Dev Workflow

All compilation, Expo dev server, Android builds (`eas build`, `expo run:android`), and `adb` commands run on the **Mac mini via SSH**. The Windows machine is used for:
- Running Claude Code sessions
- File editing (synced via Dropbox to `/c/dropbox/Finpath/`)
- Reviewing outputs

When suggesting terminal commands for build/run tasks, assume they execute on the Mac mini over SSH.

---

## Ollama on Mac mini

The Mac mini runs [Ollama](https://ollama.ai) with local LLM models:

| Model | Use case |
|---|---|
| Qwen (qwen3 or similar) | General reasoning, code review drafts, summarization |
| DeepSeek (deepseek-coder) | Code-specific tasks, log analysis |

### When to use Ollama (vs Claude)

**Use Ollama for:**
- Reducing Anthropic token consumption on repetitive/low-stakes tasks
- Parallel background tasks (e.g. analyzing multiple log files simultaneously)
- Summarizing large outputs before sending to Claude
- Non-critical inference (formatting, boilerplate generation, diff summaries)

**Keep in Claude (main session) for:**
- Architecture and financial model decisions
- Complex multi-file reasoning
- Final code generation and review
- Anything touching the FIRE calculation engine

### Invoking Ollama

```bash
# Over SSH to Mac mini:
ssh macmini "ollama run qwen3 'your prompt here'"
ssh macmini "ollama run deepseek-coder 'review this diff: ...'"

# Or pipe content:
cat some_file.ts | ssh macmini "ollama run deepseek-coder"
```

---

## Build Commands (run on Mac mini)

```bash
# Start Expo dev server
cd ~/finpath && npx expo start --android

# EAS local build (APK)
cd ~/finpath && eas build --platform android --profile preview --local

# Run on connected device
cd ~/finpath && npx expo run:android

# Lint + test
cd ~/finpath && npm run lint && npm test
```

---

## File Sync

Project files sync via **Dropbox**: `C:\dropbox\Finpath\` (Windows) ↔ `~/Dropbox/Finpath/` (Mac mini).
No manual rsync needed for source files.
