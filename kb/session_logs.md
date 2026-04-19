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

---

## 2026-04-16 — Bug fix: FUTURE_ONE_TIME pre-retirement corpus deduction

**Commit:** f191c9f

engine/calculator.ts — 4 changes:
1. calculateProjections PV loop: FUTURE_ONE_TIME excluded from salary-funded presentValueOfExpenses
2. calculateProjections bucket: preRetOneTimeCost deducted from existingBucket pre-retirement; totalNetExpenses now = preRetOneTimeCost (was 0)
3. simulateCorpusAtAge !merged branch: same deduction so required-SIP binary search is accurate
4. calculatePresentValueOfExpenses: FUTURE_ONE_TIME excluded from expenses banner PV

Why: net worth grew through ₹2.18 Cr one-time purchase in 2035 — lump-sum corpus withdrawals were never deducted. Full audit in kb/../observation/audit101.md.

---

## 2026-04-16 — Tests: FUTURE_ONE_TIME pre-retirement corpus deduction

**Commit:** 01d05b0

__tests__/calculator.test.ts — new section 15, 6 new tests + stale comment fix.
58/58 pass.

---

## 2026-04-16 — Step 1: FUTURE_RECURRING corpus-funded pre-retirement + AAB v10

**Commits:** 7a746bb
**Build:** app-release-v10.aab (versionCode 9)

engine/calculator.ts: CURRENT_RECURRING = salary-funded; ALL future (FUTURE_ONE_TIME + FUTURE_RECURRING) = corpus-funded pre-retirement. Guard changed from FUTURE_ONE_TIME-specific to futureExpenses loop in all 3 sites. calculatePresentValueOfExpenses guard → !== CURRENT_RECURRING.
Tests: 60/60. Graphify updated: 145 nodes, 161 edges, 32 communities.

---

## 2026-04-16 — existingBucket overflow fix + AAB v11

**Commit:** 453f84f | **Build:** app-release-v11.aab (versionCode 11)

When purchase > existingBucket, overflow now spills into sipBucket instead of being silently forgiven. Both calculateProjections and simulateCorpusAtAge fixed. 61/61 tests pass.

---

## 2026-04-16 — Precision fixes + AAB v12

**Commit:** e9f340b | **Build:** app-release-v12.aab (versionCode 12)

Fix 1: existing assets year-0 growth now uses (1+er)^(monthsThisYear/12) in both calculateProjections and simulateCorpusAtAge.
Fix 2: FUTURE_ONE_TIME inflation uses fractionalYears = yearsFromNow + (startMonth - currentMonth)/12.
61/61 tests pass.

## 2026-04-16 — Projection Graph 2.0

**Build:** none
**Commit:** `4dac778`

### Changes
- New `components/ProjectionChart.tsx`: pinch-to-zoom + pan via gesture-handler/reanimated
- Background zones: light green (pre-ret), light blue (post-ret), light red (danger)
- Peak dot, retirement corpus dot, depletion dot + labels; "Sustains to N" when no depletion
- Event markers: orange rings at FUTURE_ONE_TIME expense ages; tappable chips row below chart
- Micro-insight labels: Wealth growth / Withdrawals / Depleted
- Outflow line post-retirement only; dashboard.tsx cleaned of all Skia/Victory imports

## 2026-04-16 — AAB build versionCode 13

**Build:** `app-release-v13.aab` (108 MB, versionCode 13, release-signed)
**Commit:** `4dac778`
- Includes Projection Graph 2.0 + all calculator fixes from this session
- BUILD SUCCESSFUL in 36s; scpd to C:dropboxfinpathapp-release-v13.aab

## 2026-04-16 — AAB build versionCode 13

**Build:** app-release-v13.aab (108 MB, versionCode 13, release-signed)
**Commit:** 4dac778
- Includes Projection Graph 2.0 + all calculator fixes from this session
- BUILD SUCCESSFUL in 36s; scp'd to Windows Dropbox


## 2026-04-16 — insights useMemo + planStatus hero card

**Build:** none
**Commit:** 604bc3b
- insights useMemo: peak, depletionAge, isAffordable, sipGap
- planStatus IIFE: 5 states (NO_SIP/FAIL/TIGHT/SHORT/AHEAD/ON_TRACK)
- Hero card subtitle replaced with actionable planStatus.title + subtitle


## 2026-04-16 — fix: chart labels + AAB versionCode 14

**Build:** app-release-v14.aab (108 MB, versionCode 14, release-signed)
**Commits:** ae9a7c0 (label fixes), 604bc3b (insights/planStatus)
- retirement label: Age N -> Retirement (N)
- peak dot label: bare value -> Peak <value>
- All chatgpt.txt sections fully implemented
- BUILD SUCCESSFUL in 23s; copied to Windows Dropbox

---
## 2026-04-18 — Dead code cleanup (commit d8880f9)

**What changed:**
- Deleted storage/auth.ts — superseded by db/queries.ts per-profile PIN system
- Deleted utils/currency.ts — fetchGoldPrice/getUSDToINR never called anywhere
- Deleted constants/categories.ts — all screens use inline arrays; jest mapper also removed
- Deleted components/CorpusPrimer.tsx — never imported in any screen
- Deleted storage/session.ts — session-lock flow never integrated
- Deleted components/DepletionDialog.tsx — dashboard.tsx re-implements inline
- Deleted Replit/ legacy subfolder entirely
- Removed CHART_HEIGHT, CHART_PADDING, BRAND_COLORS from constants/theme.ts
- Removed getFrequencyMonthsPerPayment from engine/types.ts
- Removed completeOnboarding, SAMPLE_ASSETS, SAMPLE_EXPENSES from AppContext.tsx

**Verified:** 0 TypeScript errors after all changes  
**Commit:** d8880f9 | Branch: verified24 | No APK built

---
## 2026-04-18 - Dead code cleanup (commit d8880f9)

**What changed:**
- Deleted storage/auth.ts (superseded by db/queries.ts per-profile PIN system)
- Deleted utils/currency.ts (fetchGoldPrice/getUSDToINR never called anywhere)
- Deleted constants/categories.ts (all screens use inline arrays; jest mapper also removed)
- Deleted components/CorpusPrimer.tsx (never imported in any screen)
- Deleted storage/session.ts (session-lock flow never integrated)
- Deleted components/DepletionDialog.tsx (dashboard.tsx re-implements inline)
- Deleted Replit/ legacy subfolder entirely
- Removed CHART_HEIGHT, CHART_PADDING, BRAND_COLORS from constants/theme.ts
- Removed getFrequencyMonthsPerPayment from engine/types.ts
- Removed completeOnboarding, SAMPLE_ASSETS, SAMPLE_EXPENSES from AppContext.tsx

**Verified:** 0 TypeScript errors after all changes
**Commit:** d8880f9 | Branch: verified24 | No APK built

---

## 2026-04-19 — fix: data persistence across sessions + crypto digest fix (v33)

**Build:** app-release-v33.aab (versionCode 33, release-signed)
**Commit:** d7bd1a0 | Branch: audit19April

### Bug: Assets/expenses/goals lost across sessions

**Root causes (3 bugs):**
1. `login.tsx` `syncToAppContext()` — unconditionally overwrites AsyncStorage from SQLite on every login. If SQLite empty, good data destroyed.
2. `AppContext.tsx` `importAll()` — wrote only to AsyncStorage, not SQLite. Next login → empty SQLite overwrites → data lost.
3. `storage/secure.ts` `sha256()` — passed `ArrayBuffer` to `Crypto.digest()`, but Android Kotlin bridge can only marshal `TypedArray`. Caused crypto crash on import.

**Fixes:**
- `syncToAppContext`: skip SQLite overwrite when same profile already loaded (`currentProfile?.id === selectedId`)
- `importAll`: accepts `sqliteProfileId`, writes assets/expenses/goals to SQLite with ID remapping
- `sha256`: pass `Uint8Array` directly instead of `ArrayBuffer`
- Updated callers: `create-profile.tsx`, `profile.tsx`

**Verified on emulator:** Import backup → force-stop → restart → login → assets+expenses persisted ✓
**Tests:** 70/70 pass
**Detailed log:** `kb/v33logs.md`

---

## 2026-04-19 — Fresh deep audit of beyondv33 branch

**Build:** None (read-only audit session)
**Branch:** beyondv33 | Commit: ef622ae | versionCode: 33

### Confirmed fixed
- syncToAppContext same-profile guard, importAll SQLite ID remapping, sha256 Uint8Array fix
- Dead code cleanup (auth.ts, currency.ts, CorpusPrimer.tsx, etc.)
- Dashboard Goals=null empty state, deleteAllData PIN cascade, totalNetExpenses formula correct

### Active critical issues
- C1: index.tsx routes on SQLite only → data loss on reinstall
- C2: genId() alphanumeric IDs → silent SQLite update failures
- C3: Dashboard "Calculating..." forever on calculateProjections error
- C4: UTC date bug in getAge() → wrong age near birthdays in IST
- C5: Orphaned profile if SecureStore fails after SQLite INSERT in createProfile
- C6: Dual-store architecture (AsyncStorage + SQLite) still present

### Audit output
Full audit: ~/finpath/kb/AUDIT_BEYONDV33.md (also at C:\dropbox\finpath\AUDIT_BEYONDV33.md)

### Next session
Start with Phase 1 fixes: C4 (UTC dates), C5 (profile rollback), C3 (dashboard error state), H1 (login stale closure)

---

## 2026-04-20 — Fix C4: UTC date bug (commit af126ce)

- Added parseDateStr() helper in calculator.ts; replaced all 7 new Date(dateString) calls
- dashboard.tsx: replaced inline age calc with getAge(); added to import
- create-profile.tsx: DOB validation now uses new Date(y, m-1, day)
- 70/70 tests pass

---

## 2026-04-20 — Fix C5: orphaned profile rollback (commit 5290d88)

- db/queries.ts createProfile(): try/catch around saveProfilePin; DELETE profile row on failure, rethrow
- 70/70 tests pass

---

## 2026-04-20 — Fix C3: dashboard error state (commit 8896e42)

- dashboard.tsx: split !result into spinner (!isLoaded) vs error card (calc threw)
- Added ActivityIndicator import; error card has "Review Plan" button → goals
- 70/70 tests pass
