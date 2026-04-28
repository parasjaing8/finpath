---
name: Dev Environment
description: Mac mini is the sole dev/build/debug machine for all projects. No code on Windows.
type: feedback
originSessionId: b81bf2b0-5bf5-4081-9a9c-496aaf5ad129
---
Mac mini (parasjain@192.168.0.130) is the single source of truth for ALL development work — every project, not just Finpath.

**Rule**: Never write, edit, or store codebase files on the Windows laptop. All code edits happen via SSH to the Mac mini.

**Why:** User explicitly established this as a permanent strategy to avoid split environments and sync issues.

**How to apply:**
- Code edits: SSH to Mac mini only. Never edit source files on Windows paths.
- Build/run/debug: all commands via SSH on Mac mini.
- `C:\Dropbox\<project>\`: stores `.md` files (logs, status, build guides, audit docs) + APK/AAB outputs only — no source code.
- Every Dropbox MD file must have a mirror copy in the project's `kb/` folder on Mac, kept in sync after every write.
- Large multi-file rewrites only: may draft in a Windows temp file, then `scp` to Mac. Delete the Windows draft once transferred. Mac is always canonical.
- git push is mandatory after every commit — no unpushed commits left on Mac.

## Mac mini connection
- Host: parasjain@192.168.0.130
- Codebase root: ~/finpath/
- SSH: `ssh parasjain@192.168.0.130`

## Windows role
- Claude Code UI + session orchestration only
- `C:\Dropbox\<project>\` = MD files + build outputs only
- No permanent source code here
