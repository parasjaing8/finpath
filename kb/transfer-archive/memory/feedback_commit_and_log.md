---
name: Commit, push, and log after every project update
description: After any code change — git commit → git push → append to logs.md (Windows + Mac mirror). All three, every time, no batching.
type: feedback
originSessionId: 41d26405-a6d0-43b0-a549-9d8f1fa116a8
---
After every prompt that results in code changes, in this exact order:
1. `git commit` on Mac mini with a concise conventional message
2. `git push` — immediately, no unpushed commits ever left behind
3. Append an entry to `C:\dropbox\claude\projects\<project>\logs.md` (Windows)
4. Append the same entry to `~/finpath/kb/session_logs.md` (Mac mirror)

Log entry format:
```
## YYYY-MM-DD — one-line summary
**Build:** none / rN
**Commit:** `<hash>`
- bullet: what changed
- bullet: why
- bullet: build produced (if any)
```

**Why:** Sessions r7–r13 had no logs — 7 sessions of work lost from memory. git push added 2026-04-15 so remote always matches local; unpushed commits = silent data loss risk.

**How to apply:** Don't wait until end of session. Commit + push + log after each discrete change. Terse but self-contained — enough for a future LLM to resume without re-reading code.
