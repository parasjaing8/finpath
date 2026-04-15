# Finpath — Session Logs (Mac mirror)

> Mirror of C:\dropbox\claude\projectsinpath\logs.md
> Updated after every commit+push. Both copies must stay in sync.

---

## 2026-04-15 — Rules update: git push mandatory + Windows/Mac role clarification

**Build:** none
**Commit:** `984dc31` (currency fix + UXaudit), CLAUDE.md update (gitignored, not committed)

### Changes
- **Post-change protocol**: git push added as mandatory step 2 after every commit. No unpushed commits allowed.
- **CLAUDE.md (Mac + Windows)**: Updated machine setup section — Windows role explicitly defined as UI+orchestration only. Dropbox = MD files + outputs, always mirrored to Mac kb/. Large rewrites may be drafted on Windows then scp'd to Mac.
- **global rules.md**: Rules 1-3 and 14 updated to reflect above.
- **kb/session_logs.md**: This file created as permanent mirror of Windows logs.md.
- **kb/UXaudit.md**: Pre-launch audit — 24 tasks across P0/P1/P2.
- **app/(tabs)/profile.tsx L75**: Currency symbol bug fixed (INR/USD string → ₹/$ symbol).

### Rules established this session
- git push is mandatory after every commit — same session, no batching
- Windows = Claude Code UI only; C:\Dropboxinpath\ = MD files only
- Every Dropbox MD must have a Mac kb/ mirror (this file is that mirror for logs.md)
- Large code rewrites: draft on Windows → scp to Mac → delete Windows draft


---

## 2026-04-15 — AAB build versionCode 7

**Build:** app-release-v7.aab (108MB, versionCode 7, release-signed)
**Commit:** 9738c5c

- app.json versionCode 4 → 7 (was stale); build.gradle 6 → 7
- bundleRelease BUILD SUCCESSFUL in 40s
- AAB scp to Windows: C:\dropbox\finpath\app-release-v7.aab
