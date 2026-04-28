# Claude Session Context — Master Briefing

> **Read this first in every session.** It tells you who the user is, how the machines are set up, and where to find everything. Then read the relevant project file under `projects/`.

---

## Who is the user

Paras Jain — developer building personal finance tools and other apps. Works from Windows laptop but all code lives and runs on a Mac mini. Not a beginner; expects concise, direct responses. Does not want summaries of what you just did — just do it.

Full profile → `global/profile.md`

---

## Machine setup (critical — read before touching any code)

| Machine | Role | How to access |
|---|---|---|
| Mac mini | **All code, all builds, all dev** | `ssh parasjain@192.168.0.130` |
| Windows laptop | Claude Code UI only | Current shell |
| Dropbox (`C:\dropbox\`) | Outputs + this memory system | Local filesystem |

**Golden rule: Never write or edit source code on Windows. All code edits go through SSH to the Mac mini. Dropbox is for outputs (APKs, logs, memories) only.**

Full environment details → `global/environment.md`

---

## Active projects

| Project | Mac path | Status | Notes |
|---|---|---|---|
| **Finpath** | `~/finpath/` | Active | Android FIRE calculator app |

Full project context → `projects/finpath/README.md`

---

## Non-negotiable rules

1. **No EAS builds** — always `expo prebuild` + `./gradlew assembleRelease` on Mac mini
2. **No code on Windows** — Mac mini is the only dev machine for every project
3. **After code changes** — update the relevant project `decisions.md` and `status.md` here
4. **Build signing** — keystore on Mac mini only, never committed to git

Full rules → `global/rules.md`

---

## Quick-start for a new session

```bash
# 1. Connect to Mac mini
ssh parasjain@192.168.0.130

# 2. Navigate to project
cd ~/finpath          # or whatever project

# 3. Check git status
git status && git log --oneline -5

# 4. Build Android APK (Finpath)
export PATH="/opt/homebrew/bin:$PATH"
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME="$HOME/Library/Android/sdk"
cd ~/finpath/android && ./gradlew assembleRelease

# 5. Copy APK/AAB to Windows — run this on WINDOWS, not Mac
# (Dropbox is not mounted on Mac mini in SSH sessions — use scp pull)
scp parasjain@192.168.0.130:~/finpath/android/app/build/outputs/apk/release/app-release.apk "C:\dropbox\finpath\FinPath-vX.X.X-rN.apk"
# For AAB:
scp parasjain@192.168.0.130:~/finpath/android/app/build/outputs/bundle/release/app-release.aab "C:\dropbox\finpath\app-release.aab"
```

---

## Session logs

Chronological record of all sessions → `sessions/`
Latest session → check most recent date file in `sessions/`
