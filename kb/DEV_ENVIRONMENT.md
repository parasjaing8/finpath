# FinPath -- Dev Environment

> Reference for the build/dev machine setup.
> Last updated: 2026-04-11

---

## Machines

| Role | Machine | OS | Notes |
|---|---|---|---|
| Editor / Claude sessions | Windows 11 laptop | Windows 11 Home | No Android SDK, no source code |
| Build / Dev server | Mac mini (headless) | macOS | SSH: parasjain@192.168.0.130 |

---

## Dev Workflow

All code, compilation, Expo dev server, Android builds, and adb commands run on the **Mac mini via SSH**. The Windows machine is used only for:
- Running Claude Code sessions
- Reviewing APK outputs (via Dropbox)

**Never write or edit code on Windows. All code edits go through SSH to the Mac mini.**

**Never use `eas build`.** Always use `expo prebuild` + `./gradlew assembleRelease` on Mac mini.

---

## Build Commands (run on Mac mini via SSH)

```bash
# Standard release build
export PATH="/opt/homebrew/bin:$PATH"
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME="$HOME/Library/Android/sdk"
cd ~/finpath/android && ./gradlew assembleRelease

# Clean build (after native dep or plugin changes)
cd ~/finpath
rm -rf android
npx expo prebuild --platform android
# Fix signingConfig line (plugin step-3 regex broken)
sed -i "" \
  "s/signingConfig signingConfigs\.debug$/signingConfig keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug/" \
  android/app/build.gradle
cd android && ./gradlew assembleRelease

# Start Expo dev server
cd ~/finpath && npx expo start --android

# Lint + test
cd ~/finpath && npm run lint && npm test
```

APK output: `~/finpath/android/app/build/outputs/apk/release/app-release.apk` (~54 MB)

---

## File Sync (Dropbox)

Dropbox is used for **outputs only** (APKs, memory files), not source code.
- `C:\dropbox\Finpath\` (Windows) -- APK releases
- `C:\dropbox\claude\` (Windows) -- memory system for Claude Code sessions
- Source code lives only at `~/finpath/` on Mac mini (git-managed)

---

## Ollama on Mac mini

The Mac mini runs Ollama with local LLM models (Qwen, DeepSeek) for low-stakes tasks like log analysis, diff summaries, and boilerplate generation. Use Claude for architecture decisions, financial model changes, and multi-file reasoning.

```bash
ssh parasjain@192.168.0.130 "ollama run qwen3 'your prompt here'"
```
