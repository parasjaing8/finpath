---
name: Mac mini is sole dev machine for all projects
description: Never write or edit code on Windows. Mac mini (192.168.0.130) handles all dev/build/debug for every project.
type: feedback
---

**Rule**: Mac mini at parasjain@192.168.0.130 is the one and only dev, debug, and build machine for every project — unless the user explicitly says otherwise for a specific project.

**Why:** User decided to stop keeping any codebase on the Windows laptop to avoid split environments, sync headaches, and confusion about which copy is current.

**How to apply:**
- Never use Edit, Write, or code-producing Bash commands targeting Windows paths (C:\...) for any codebase file.
- All code changes go through SSH to the Mac mini.
- Dropbox (C:\dropbox\) is only for: compiled outputs (APKs), session logs, memory files — never source code.
- If user asks to make a code change and is in a Windows session, SSH to Mac mini and make the change there.
- This rule applies to ALL projects, not just Finpath.
