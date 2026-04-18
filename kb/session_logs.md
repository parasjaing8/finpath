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

## 2026-04-17 — V2 Replit merge + SVG chart redesign

**Build:** app-release-v20.aab (versionCode 20, release-signed)
**Branch:** replit-assited
**Commits:** 13683d2 (chart + V2 components), d36ee4e (Inter fonts + Pro button)

- ProjectionChart.tsx: full SVG rewrite matching Gemini reference image
  - Three zones green/blue/red, gradient fill, peak dot+label, event emoji rings
  - Range buttons 5Y/10Y/25Y/All + window slider; removed event chips row
- dashboard.tsx: chart subtitle added
- _layout.tsx: Inter fonts (400/500/600/700) + GestureHandlerRootView
- profile.tsx: Pro upgrade card + ProPaywall wired
- Added: CustomSlider, DepletionDialog, KeyboardAwareScrollViewCompat, theme.ts, engine/types.ts
- BUILD SUCCESSFUL in 1m 26s; copied to C:\Dropbox\finpath\app-release-v20.aab

## 2026-04-18 — goals flow restructure + delayed calculate handoff

**Build:** none
**Branch:** replit-assited
**Commit:** e5f5bda

- goals.tsx: Retirement Plan now appears first; old standalone FIRE Strategy card removed
- goals.tsx: FIRE strategy moved into Withdrawal Target, `moderate` relabeled to `Moderate FIRE`
- goals.tsx: Save button renamed to `Save Goals and Calculate`
- goals.tsx: 5-second calculating modal added before navigating to dashboard
- HeroCard.tsx: subtitle now hides only for the redundant plain on-track case, while preserving depletion / ahead-of-plan messaging
