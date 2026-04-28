# Global Rules

Rules that apply across all projects and all sessions. Established by user, must be followed without being told again.

---

## Dev machine rules

1. **Mac mini is the only dev machine** — all code edits, all builds, all debug sessions happen on `parasjain@192.168.0.130`. Windows runs Claude Code UI only. No exceptions unless user explicitly overrides for a specific project.
2. **No permanent code on Windows** — source code lives on Mac mini. Exception only: for large multi-file rewrites, code may be drafted in Windows temp files then transferred to Mac via `scp`. Once transferred, the Mac copy is canonical — delete the Windows draft.
3. **Dropbox = project MD files + build outputs only** — `C:\Dropbox\<project>\` stores `.md` files (session logs, status, build guides, audit docs) and APK/AAB outputs. Never store source code here permanently. Every MD file in a project's Dropbox folder must have a mirror copy on Mac in `~/finpath/kb/` (or project equivalent), kept in sync after every write.

## Build rules (Android / Expo)

4. **Never use `eas build`** — EAS requires interactive auth, breaks SSH sessions. Always use `expo prebuild` + `./gradlew assembleRelease`.
5. **Never use `-Pandroid.injected.build.abi=`** — this flag sets `testOnly=true` and makes APKs un-installable. ABI is set in `gradle.properties`.
6. **Always use `outputs/apk/release/`** — not `intermediates/`. The signed APK is in outputs.
7. **After `expo prebuild --clean`** — always re-run `sed` to fix the `signingConfig` line in `build.gradle` (the plugin sets the `signingConfigs.release` block but the `buildTypes.release` line needs a manual sed patch).

## Code quality rules

8. **No speculative features** — only build what was asked. No future-proofing, no extra config options.
9. **No unsolicited refactors** — don't clean up surrounding code when fixing a bug.
10. **No comments on unchanged code** — don't add docstrings or type annotations to code that wasn't modified.
11. **Diagnose before fixing** — read the error and root cause. Don't blindly retry or patch around.

## Memory rules

12. **Update this memory system after every meaningful session** — add a session log, update project status.md, update decisions.md with any lessons learned.
13. **KB files are context, code is truth** — for Finpath, `~/finpath/kb/` documents financial model, architecture, and decisions. Read before touching calculator logic. But if kb/ and code disagree, code wins — fix the doc.

## Session commit + push + log rule

14. **After any code change: git commit → git push → append to logs.md. Always in that order.**
    - **git push is mandatory after every commit** — never leave unpushed commits. Push immediately, not batched at end of session.
    - After pushing, append an entry to `C:\dropbox\claude\projects\<project>\logs.md` and mirror the same entry to the Mac kb/ equivalent.
    - Log format: `## YYYY-MM-DD — <one-line summary>` followed by bullet points — what changed, why, what build was produced. Terse but self-contained enough that a future LLM can reconstruct what happened without re-reading code.
    - Do NOT wait until end of session — commit + push + log after each discrete change.
    - This prevents the r7–r13 memory loss incident from happening again.

## Audit / analysis rules

15. **Code over docs** — when auditing or analysing, read actual source files first (via SSH `cat`). Treat kb/ and memory docs as context, not truth. If code and docs disagree, code wins and the doc must be updated in the same session.
16. **Session start orientation** — at session start, run `git log --oneline -5 && git status --short` on Mac mini and read `status.md` + last 2 entries of `logs.md` before doing anything else. This prevents hallucinating about project state.

## Response style rules

17. **No trailing summaries** — don't recap what you just did at the end of a response.
18. **Lead with action** — don't explain what you're about to do, just do it.
19. **Short responses** — say it in one sentence if possible.
