# Finpath — Mac Direct Dev Transfer Pack

This folder contains all Claude context files needed when running Claude Code directly on Mac mini (no Windows SSH).

---

## Where each file goes on Mac

### 1. CLAUDE.md → `~/finpath/CLAUDE.md`
The primary project instructions file. Claude Code auto-loads it.
**Must update:** change `SSH: parasjain@192.168.0.130` references to reflect you're now working locally, not via SSH. Build commands should drop the `ssh parasjain@192.168.0.130 '...'` wrapper.

### 2. `memory/` → `~/.claude/projects/<finpath-project-hash>/memory/`
Claude's auto-memory for this project. On Mac, the project path will be `~/finpath`, so the Claude project hash folder will be different from Windows.
- Find the right folder: after opening Claude Code in `~/finpath`, run `/memory` or check `~/.claude/projects/` for the folder matching `~/finpath`.
- Copy all `memory/*.md` files there, plus `memory/MEMORY.md` as the index.

### 3. `project_logs/` → `~/finpath/kb/` (already there) + keep as reference
- `logs.md` → append into `~/finpath/kb/session_logs.md`
- `status.md` → read as current state snapshot; update after first session
- `build.md` → already mirrored as `~/finpath/kb/` docs; verify content matches
- `stack.md`, `decisions.md`, `audit_backend_math.md` → cross-check with `~/finpath/kb/` versions

### 4. `global/` → `~/.claude/` or a global memory folder on Mac
- `rules.md` → cross-project rules; put in Mac Claude global memory
- `profile.md`, `environment.md` → user context for Claude
- `CONTEXT.md`, `build_recipes.md` → reference

### 5. Root MDs (CLAUDE.md, UiUxAudit.md, TASKS.md, AUDIT_BEYONDV33.md, etc.)
These are already mirrored to `~/finpath/kb/` from prior sessions. Verify they match.

---

## Key CLAUDE.md edits needed on Mac

When Claude Code runs natively on Mac, update these sections in CLAUDE.md:

1. **Session start protocol** — remove SSH prefix from git commands (just `cd ~/finpath && git log ...`)
2. **Build commands** — drop `ssh parasjain@192.168.0.130 '...'` wrapper; run locally
3. **Copy APK to Dropbox** — path changes: Dropbox may be at `~/Dropbox/` or `/Volumes/Dropbox/`
4. **Windows role section** — update to reflect Mac is now primary Claude Code machine
5. **Post-change protocol** — "git commit on Mac mini" is now just "git commit"; no mirror step needed

---

## Mac memory folder path

On Mac, Claude Code stores project memory at:
```
~/.claude/projects/<hash>/memory/
```
The hash is derived from the absolute project path. For `~/finpath`, run:
```bash
ls ~/.claude/projects/
```
Look for the folder that corresponds to `~/finpath`. Copy the `memory/` files there.

---

## Files collected: 2026-04-24
