# Memory Index

**CLAUDE.md is the primary instruction source.** It lives at `C:\dropbox\finpath\CLAUDE.md` (auto-loaded by Claude Code). These memory files provide supplementary detail.

## Core rules
- [Dev Environment](dev_environment.md) — Mac mini (192.168.0.130) is ONLY dev/build/debug machine; no code on Windows ever
- [Mac as Sole Dev Machine](feedback_mac_as_dev_machine.md) — All code edits via SSH to Mac mini for every project, no exceptions
- [Commit and Log Rule](feedback_commit_and_log.md) — After every code change: git commit on Mac + append to logs.md for that project
- [KB Maintenance Rule](feedback_kb_maintenance.md) — Always update kb/ and memory files when code changes
- [No EAS builds](feedback_no_eas.md) — Never use eas build; always use expo prebuild + Gradle for Android APKs
- [Audit Protocol](feedback_audit_protocol.md) — Read code first via SSH, then docs. Code is truth, docs are context.

## Project facts
- [User Profile](user_profile.md) — Developer; Mac mini is sole dev machine for all projects; Windows runs Claude Code only
- [Project Overview](project_overview.md) — Finpath FIRE calculator app overview; latest commit cf58709; AAB v25; UI/UX audit complete
- [Release Keystore](project_keystore.md) — Keystore at ~/finpath/finpath-release.jks, alias finpath, pass Paras@iisc18 (corrected 2026-04-12)
- [Android Build Sequence](feedback_build_sequence.md) — Steps after expo prebuild --clean; scp from Windows to copy AAB (Dropbox not mounted on Mac in SSH)
- [SSH Scripting](feedback_ssh_scripting.md) — Write Python scripts to /tmp/ file first; never use one-liners with template literals
- [Python JSX Replacement](feedback_python_jsx_replacement.md) — Use unique end markers (include post-close content); always sed spot-check after replacement

## Audit findings (2026-04-18)
- Full UI/UX audit at `~/finpath/kb/UiUxAudit.md` and `C:\dropbox\finpath\UiUxAudit.md` — 50+ findings
- Must-fix before launch: X1 (dual data store), D2 (safe area), D5 (SIP slider cap), G2 (5s fake delay), G3 (FIRE type/age desync), P1 (empty name save), P4 (currency change no warning), L1+O1 (Android KAV on Login/Onboarding)
- High-value quick fixes: A1/A9 (catChip height in assets), A3 (self-use label), E7 (hide inflation for ONE_TIME), X8 (tab "Goal"→"Goals"), P2 (DOB TextInput), X5 (unify sliders)

## Cross-session memory (Dropbox-synced)

Full memory system at `C:\dropbox\claude\` — read `CONTEXT.md` there for complete project and environment context.
