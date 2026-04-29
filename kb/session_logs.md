# Finpath — Session Logs

One entry per session. Each entry is self-contained — enough for a future LLM to resume without re-reading code.
Format: date, build produced, what changed, why, open items.

---

## 2026-04-29 — Wave 3 (commit 659a1bd)

**Commit:** `659a1bd` | Branch: `beyondv33` | No build produced (code changes only).

**Wave 3 audit findings addressed:** A1, A2, C5, D1, D2, D3, D4.

**Changes:**
- `engine/types.ts`: Added `ASSET_CATEGORIES` (canonical list; replaces local const in assets.tsx), `ESOP_RSU_KEY` const, `HALF_YEARLY` to Frequency/FrequencyInput/FREQUENCY_TO_PAYMENTS_PER_YEAR/MONTHS_PER_PAYMENT/FREQUENCIES. Added `cliff_date`, `value_currency`, `recurring_amount_currency` to Asset interface.
- `db/schema.ts`: Migrations v10 (cliff_date TEXT), v11 (value_currency TEXT), v12 (recurring_amount_currency TEXT) on assets table.
- `db/queries.ts`: Asset interface and createAsset/updateAsset SQL updated for the three new columns.
- `utils/fx.ts` (new): `getFxRates()` with 24hr AsyncStorage cache → open.er-api.com → stale cache → FALLBACK_RATES. `convertCurrency(amount, from, to, rates)` via USD pivot.
- `engine/calculator.ts`: Imports `ESOP_RSU_KEY`, `FxRates`, `convertCurrency`. `CalculationInput` gains optional `fxRates`. `calculateProjections` converts asset values at compute time using `value_currency`. `calculateVestingForYear` gains `profileCurrency`/`fxRates` params; uses `cliff_date` as vesting gate; FX-converts recurring_amount_currency. `simulateCorpusAtAge` gains same optional params.
- `app/(tabs)/assets.tsx`: Imports ASSET_CATEGORIES+FREQUENCIES from engine/types (removes local CATEGORIES). AssetForm + EMPTY_FORM extended with 6 vesting fields. openEdit populates them. handleSave persists them. Vesting section renders conditionally when category=ESOP_RSU.
- `app/(tabs)/dashboard.tsx`: Imports getFxRates/FxRates; fetches on mount; passes to calculateProjections; fxRates in useMemo dep array.
- `__tests__/calculator.test.ts`: Added cliff_date/value_currency/recurring_amount_currency: null to test asset fixtures.

**Tests:** 61/61 pass. TypeScript: no new errors.

**Open items (Wave 3 not in scope):** A3 (quick-add), A4 (ROI overwrite), A6 (null ROI), B4 (share image), C4 (per-asset currency in engine — partially done: value_currency column + FX conversion now live), D5 (full RSU tax model).

---

## 2026-04-29 — Audit + Wave 1 fixes (commit a8690d4)

**Commit:** `a8690d4` | Branch: `beyondv33` | No build produced.

### What changed
- **Audit:** New `kb/Audit29April.md` — 50+ findings, A1–K3, from Opus 4.6 full codebase audit. Tester feedback translated into findable issues.
- **J1:** Extended `plugins/withRemoveSystemAlertWindow.js` to also strip `READ_EXTERNAL_STORAGE` + `WRITE_EXTERNAL_STORAGE` from the generated manifest (durable fix; android/ is gitignored so manifest edits don't persist).
- **C1:** Added EUR/GBP/AUD/CAD/SGD/AED to `CURRENCIES` in `app/(tabs)/profile.tsx`. Previously INR/USD only; non-INR/USD users had their currency silently overwritten on save.
- **K1:** Replaced stale "Dual Storage Warning" in `ARCHITECTURE.md` with accurate description — SQLite is the single source of truth; no dual-write path remains.
- **K2:** Fixed asset category list in `ARCHITECTURE.md` + `FUNCTION_INDEX.md` to match actual `assets.tsx` code (12 categories: EQUITY/MUTUAL_FUND/DEBT/FIXED_DEPOSIT/PPF/EPF/GOLD/REAL_ESTATE/CRYPTO/CASH/ESOP_RSU/OTHERS).
- **K3:** Corrected two stale entries in `DECISIONS_AND_LESSONS.md`:
  - `totalNetExpenses` audit entry: formula is CORRECT (not a bug); prior audit's "display-only" claim was wrong but its suggested fix `plannedExpenses - pensionIncome` would have broken the model.
  - `PENSION_INFLATION_RATE` entry: constant is dead code; both paths use `goals.inflation_rate`.
- **E1 in audit:** Marked as false positive — see DECISIONS_AND_LESSONS correction.

### Open: Wave 2–4 in kb/Audit29April.md

---

## 2026-04-29 — Wave 2 (commits 531be24 + d36f6f7)

**Commits:** `531be24` (qwen bulk wave2) + `d36f6f7` (completions + fixes) | Branch: `beyondv33` | No build.

### What changed
- **C2:** `constants/currencies.ts` — 29-currency list (G20 + FIRE communities). `components/CurrencyPicker.tsx` — searchable modal (flag + code + name, common chips shortcut). Replaced chip rows in `create-profile.tsx`, `edit-profile.tsx`, `profile.tsx`.
- **C3:** `WESTERN_SHORT_SCALE` (K/M/B) added to all non-INR entries in `CURRENCY_META` (calculator.ts). CHF/JPY/NZD/SEK/NOK/DKK/HKD/MYR/THB/IDR/PHP/ZAR/BRL/MXN/SAR/QAR/KWD/BHD/OMR/KRW/TWD also added to CURRENCY_META.
- **B3:** `utils/export.ts` — SUMMARY section at top of CSV: name, age, currency, income, required SIP, FIRE corpus, NW at retirement/100, FIRE age, depletion age.
- **B2:** CSV projection columns renamed: "Pension/Income" → "Annual Withdrawal", "Total Net Expenses" → "Corpus Withdrawal".
- **B1:** `utils/exportPdf.ts` — HTML+SVG PDF via expo-print. Inline SVG bar chart (sampled every 5 years, dark green = FIRE achieved). Summary stat cards, assets table, 5-year projection snapshot. Shared via expo-sharing.
- PDF button added to dashboard next to CSV; ProPaywall updated (no more "coming soon").
- Bug fixed: `svgBarChart fmt()` had unreachable 1e9 branch — now branches on INR (Cr/L) vs other (B/M).
- Test updated for C3 USD short-scale.

### Open: Wave 3–4 in kb/Audit29April.md

2026-04-20 9d23585: fix(login,onboarding): M7 safe area insets (useSafeAreaInsets replaces paddingTop:60 in login.tsx), M8 all 8 currencies exposed via chip row in create-profile+edit-profile (CURRENCIES const, income affix lookup), M9 Forgot PIN link + destructive Alert → deleteProfile + state reset in login.tsx. No build. Pushed.

---

## 2026-04-20 — Fix C2: remove genId() (commit a73afc6)

**Commit:** `a73afc6` | Branch: `beyondv33` | 70/70 tests pass.

### What changed
- `app/(tabs)/assets.tsx` + `app/(tabs)/expenses.tsx`:
  - Deleted `genId()` function from both files
  - `id: editId ?? genId()` → `id: editId ?? ''` (empty string placeholder for new items)
  - `addAsset`/`addExpense` in AppContext ignores `a.id` for new items and overwrites with SQLite AUTOINCREMENT ID — `''` is safe

### Why
C2 is architecturally resolved by the SQLite-only migration (C6): all assets in SQLite have numeric IDs assigned by AUTOINCREMENT; `runLegacyMigration` re-inserts any legacy AsyncStorage assets with new numeric IDs; `loadProfile` loads only from SQLite. `genId()` was vestigial dead code producing alphanumeric IDs that were already being overwritten.

---

## 2026-04-20 — C6 Batch 4: profile.tsx importAll guard (commit 9f6e198)

**Commit:** `9f6e198` | Branch: `beyondv33` | 70/70 tests pass.

### What changed
- `app/(tabs)/profile.tsx` — `runImport` callback:
  - Added early-exit guard: if `profile` is null, shows Alert and returns (was passing `undefined` to `importAll` which now throws)
  - Extracted `profileId = parseInt(String(profile.id), 10)` at top of callback
  - Both `importAll(parsed, ...)` call sites now use `profileId` directly
  - Added `profile` to `useCallback` deps array

### Why
`importAll` in the new AppContext throws if `sqliteProfileId` is undefined. The old code passed `undefined` as a fallback — this fixes that. In practice profile is always set on this tab (user must be logged in), but the guard surfaces the impossible case cleanly.

### C6 Resolution — COMPLETE
All 4 batches done. SQLite is now the sole data store:
- Batch 1: `storage/legacyMigration.ts` — one-time AsyncStorage→SQLite migration (13ce523)
- Batch 2: `context/AppContext.tsx` — removed all AsyncStorage data writes (dc44776)
- Batch 3: `app/login.tsx` — wired migration + replaced syncToAppContext with loadProfile (582101d)
- Batch 4: `app/(tabs)/profile.tsx` — fixed importAll call sites (9f6e198)

---

## 2026-04-20 — C6 Batch 3: login.tsx — loadProfile + runLegacyMigration (commit 582101d)

**Commit:** `582101d` | Branch: `beyondv33` | 70/70 tests pass.

### What changed
- `app/login.tsx`:
  - Added `import { runLegacyMigration }` — wires the one-time migration
  - Added `useEffect(() => { runLegacyMigration().catch(() => {}); }, [])` — fires on mount, non-blocking, idempotent
  - `useApp()` destructuring: removed `setProfile, setAssets, setExpenses, setGoals, profile`; replaced with `loadProfile`
  - Deleted `syncToAppContext` function entirely (54 lines removed)
  - Both call sites replaced: `syncToAppContext(profile)` → `loadProfile(profile.id)` (PIN login + biometric)
  - Removed now-unused imports: `getAssets, getExpenses, getGoals` from db/queries; engine type aliases
  - Added `useRef` to React import (was missing — `autoSelectedRef` used it)

### Why
C6 resolution batch 3 — login screen now loads all profile data directly from SQLite via `loadProfile`. The legacy AsyncStorage→SQLite migration runs once on first mount after upgrade.

### Open
- Batch 4: fix `profile.tsx` `importAll` call sites (still pass `undefined` fallback — now throws)

---

## 2026-04-20 — C6 Batch 2: AppContext SQLite-only rewrite (commit dc44776)

**Commit:** `dc44776` | Branch: `beyondv33` | 70/70 tests pass.

### What changed
- `context/AppContext.tsx` complete rewrite — removed AsyncStorage dual-write pattern:
  - `loadData()` replaced with no-op `setIsLoaded(true)` (data now loaded via `loadProfile`)
  - Added `loadProfile(profileId)` — reads profile/assets/expenses/goals from SQLite, sets in-memory state
  - `setProfile`, `setAssets`, `setExpenses` → in-memory only (login.tsx compat until Batch 3)
  - `setGoals` → now writes to SQLite via `dbSaveGoals` + updates memory (replaces `secureSetItem`)
  - All CRUD mutations (add/update/delete asset/expense) → SQLite required, state only updates on SQLite success, no fallback with alphanumeric IDs (fixes H7)
  - `importAll` → SQLite writes only, throws if `sqliteProfileId` is undefined
  - `deleteAllData` → SQLite CASCADE only + clears legacy migration sentinel
  - `logout` → in-memory clear only (unchanged behaviour)
  - Removed: `onboarded` state, all `secureSetItem`/`secureGetItem` data calls, `STORAGE_KEYS`, migrations imports
  - Added `profileRef` for stale-closure-safe profile_id access in `setGoals`

### Why
C6 resolution (dual storage crisis) — removes all AsyncStorage data blob writes. SQLite is now the sole persistence layer. AsyncStorage only used for: encryption key (SecureStore), disclaimer ack flag, migration sentinel.

### Open
- Batch 3: update login.tsx — call `runLegacyMigration` on boot, replace `syncToAppContext` with `loadProfile`
- Batch 4: fix profile.tsx `importAll` undefined fallback call sites

---

## 2026-04-20 — C6 Batch 1 fix: legacyMigration.ts bug fixes (commit 13ce523)

**Commit:** `13ce523` | Branch: `beyondv33`

### What changed
- `storage/legacyMigration.ts`: fixed 2 bugs found in audit:
  1. Expenses + goals were skipped when `blobs.assets.length === 0` — the entire transaction was gated on assets existing. Fixed by separating the `sqliteHasData` check: assets+expenses only skip if SQLite already has assets; goals always upsert via `ON CONFLICT DO UPDATE`.
  2. Added `hasAnyLegacyData` early-exit check to skip the whole transaction when AsyncStorage has nothing to migrate.
- Bug 3 (migration never called) is by design — will be wired up in Batch 3 (login.tsx update).

---

## 2026-04-20 — C6 Batch 1: legacyMigration.ts (commit 15c8312)

**Commit:** `15c8312` | Branch: `beyondv33`

### What changed
- `storage/legacyMigration.ts` (new file): one-time AsyncStorage→SQLite migration.
  Reads encrypted AsyncStorage blobs (profile/assets/expenses/goals), runs them through the existing `runMigrations` pipeline, finds matching SQLite profile by name, inserts data into SQLite only if SQLite has 0 assets for that profile (non-destructive). All inserts wrapped in `db.withTransactionAsync`. Sentinel `@finpath_sqlite_migrated_v1` set after COMMIT. Blobs cleared after sentinel. Non-fatal: on any error, sentinel is NOT set so it retries next boot.

### Why
Part of C6 resolution — dual-store crisis. Existing users may have data in AsyncStorage that hasn't reached SQLite. This migration safely bridges the gap before AsyncStorage data writes are removed.

### Open
- Batch 2: rewrite AppContext.tsx (remove AsyncStorage data writes, load from SQLite)
- Batch 3: update login.tsx (call runLegacyMigration, use loadProfile)
- Batch 4: fix profile.tsx importAll call sites

---

## 2026-04-20 — Fix M6: one-time financial disclaimer modal (commit 2455a20)

**Commit:** `2455a20` | Branch: `beyondv33` | 70/70 tests pass.

### What changed
- `app/(tabs)/dashboard.tsx`: one-time disclaimer Dialog shown on first load. Checks `@finpath_disclaimer_ack` in AsyncStorage on mount; shows modal if unset; sets flag on "Got it" tap. `dismissable={false}` forces acknowledgement. AsyncStorage import added.

---

## 2026-04-20 — Fix M4: tab label Goal→Goals (commit 6999658)

**Commit:** `6999658` | Branch: `beyondv33` | 70/70 tests pass.

---

## 2026-04-20 — Fix H3: slim→lean FIRE type rename (commits b483d10, 7178ef0, 81f860f)

**Build:** None
**Commits:** `b483d10` `7178ef0` `81f860f` | Branch: `beyondv33`

### What changed
- `engine/calculator.ts`: `FIRE_TARGET_AGES.slim` → `FIRE_TARGET_AGES.lean`
- `db/schema.ts`: added migration v9 — `UPDATE goals SET fire_type = 'lean' WHERE fire_type = 'slim'` for existing users
- `db/queries.ts`: `FireType = 'slim' | ...` → `FireType = 'lean' | ...`
- `__tests__/calculator.test.ts`: all `slim` references updated to `lean`

### Tests
70/70 pass.

---

## 2026-04-20 — Fix H1: login stale closure (commit e574dff)

**Build:** None
**Commit:** `e574dff` | Branch: `beyondv33`

### What changed
- `app/login.tsx`: replaced `!selectedProfile` stale-closure check in `loadProfiles` with `!autoSelectedRef.current`. Ref is set to `true` on first auto-select, preventing re-trigger on every `useFocusEffect` focus event. Resets naturally on component remount (logout).

### Tests
70/70 pass.

---

## 2026-04-20 — Fix C3: dashboard error state (commit 8896e42)

**Build:** None
**Commit:** `8896e42` | Branch: `beyondv33`

### What changed
- `app/(tabs)/dashboard.tsx`: split `!result` null check into two states — spinner (`!isLoaded`) and error card (`isLoaded` but calculateProjections threw). Added `ActivityIndicator` to RN import.

### Why
`calculateProjections` errors were caught and returned null, but the UI showed "Calculating..." with no recovery path. Now shows an error card with "Review Plan" button routing to goals.

### Tests
70/70 pass.

---

## 2026-04-20 — Fix C5: orphaned profile rollback (commit 5290d88)

**Build:** None
**Commit:** `5290d88` | Branch: `beyondv33`

### What changed
- `db/queries.ts:createProfile()`: wrapped `saveProfilePin` in try/catch; on failure deletes the just-inserted SQLite profile row and rethrows. Caller (`create-profile.tsx`) already catches and shows Alert.

### Why
If SecureStore failed after SQLite INSERT, a ghost profile appeared in the login list but could never be logged into (no PIN stored). No cleanup path existed.

### Tests
70/70 pass.

---

## 2026-04-20 — Fix C4: UTC date bug (commit af126ce)

**Build:** None
**Commit:** `af126ce` | Branch: `beyondv33`

### What changed
- `engine/calculator.ts`: added `parseDateStr(s)` helper (parses YYYY-MM-DD as local time via `new Date(y, m-1, d)`). Replaced all 7 `new Date(dateString)` calls in `getAge()`, `calculateExpenseForYear()`, and `calculateVestingForYear()`.
- `app/(tabs)/dashboard.tsx`: replaced inline duplicate age calc with `getAge(currentProfile.dob)`; added `getAge` to import.
- `app/onboarding/create-profile.tsx`: DOB validation now uses `new Date(y, m-1, day)` instead of `new Date(dob)`.

### Why
`new Date("YYYY-MM-DD")` is parsed as UTC midnight. In timezones behind UTC (US, EU), this resolves to the previous calendar day locally — causing off-by-one errors in age and vesting-year calculations. `new Date(y, m-1, d)` always uses local time.

### Tests
70/70 pass.

---

## 2026-04-19 — Fresh deep audit of beyondv33 branch

**Build:** None (read-only audit session)
**Branch:** `beyondv33` | **Commit:** `ef622ae` | **versionCode:** 33

### What was done
- Ran full session start protocol (git log, status.md, session_logs.md, graphify)
- Read every source file via SSH: calculator.ts, AppContext.tsx, db/queries.ts, db/schema.ts, login.tsx, dashboard.tsx, goals.tsx, assets.tsx, expenses.tsx, profile.tsx, storage/secure.ts, storage/migrations.ts, all hooks, all components, app/_layout.tsx, index.tsx, create-profile.tsx
- Produced fresh audit document: `AUDIT_BEYONDV33.md` (Dropbox + Mac kb/)

### Confirmed fixed (code verified)
- syncToAppContext no longer overwrites on same-profile login (F1)
- importAll writes to SQLite with ID remapping (F2)
- sha256 Uint8Array fix (F3)
- Dead code cleanup: auth.ts, currency.ts, CorpusPrimer.tsx, etc. (F4)
- Dashboard empty state when Goals=null (F5)
- deleteAllData cascades PINs correctly (F6)
- totalNetExpenses formula is correct — not a bug (F7)
- Error boundary wraps app (F10)

### Active critical issues (6)
- C1: index.tsx routes on SQLite only — data loss on reinstall
- C2: genId() alphanumeric IDs cause silent SQLite update failures
- C3: Dashboard shows "Calculating..." forever on calculateProjections error
- C4: UTC date bug in getAge() / vesting — off-by-1 near birthdays (IST)
- C5: Orphaned profile if SecureStore fails after SQLite INSERT in createProfile
- C6: Dual-store architecture still fundamentally present

### Next recommended actions
Phase 1: Fix C4, C5, C3, H1, H3, M4, M2, M6 (pre-release blockers)
Phase 2: Fix C2, H5+H6, H2, M1, M3, M5 (stability before v1.1)
Phase 3: Full dual-store resolution (C6/C1) — biggest architectural fix

---

## 2026-04-18 — UX fixes + keyboard handling + AAB v25 + UI/UX audit

**Build:** `app-release-v25.aab` (versionCode 25, versionName "1.0.1", release-signed, `C:\Dropbox\finpath\`)
**Branch:** `replit-assited`
**Commits:** `fa06f1f`, `2de9b69`, `0b15212`, `407bbec`, `cf58709`

### Changes
- `expenses.tsx` (`fa06f1f`): sticky Cancel/Save footer outside scroll; category chips height:34/borderRadius:17/justifyContent:center; overlay justifyContent:flex-end; maxHeight:92%; scrollContent paddingBottom:4; modalBtns top separator
- `assets.tsx` (`2de9b69`): self-use checkbox extended to GOLD + OTHERS categories; investable filter changed from `!(REAL_ESTATE && is_self_use)` to `!is_self_use`; checkbox label still says "Self-use property" for all three (known bug A3)
- `assets.tsx` + `expenses.tsx` (`0b15212`): KeyboardAvoidingView from `react-native-keyboard-controller` wraps sheet; sheetHeader moved outside scroll (fixed); KAwareScrollViewCompat gets `style={{ flex: 1 }}`; justifyContent:flex-end moved from overlay to kavWrapper; maxHeight:100%
- `assets.tsx` + `expenses.tsx` (`407bbec`): added `flex: 1` to `sheet`/`modalSheet` styles — critical fix; without it, flex:1 on scroll had no parent height to flex against, making form invisible
- `kb/UiUxAudit.md` (`cf58709`): full UI/UX audit of all screens — 50+ findings across Login, Onboarding, Assets, Expenses, Goals, Dashboard, Profile; priorities listed

### Key learnings
- Bottom-sheet modal needs 3 cooperating parts: KAV (pushes above keyboard) + KAwareScroll (flex:1 to scroll within) + sheet (flex:1 so scroll has real parent height)
- `maxHeight: '100%'` is a cap, not a size — sheet still collapses without `flex: 1`
- Python patches via Windows temp → scp to Mac is the only reliable approach for multi-block JSX replacements

### Open items from audit (priority order)
- X1: Dual data store (SQLite + AsyncStorage) — fundamental risk
- D2: Dashboard missing safe area bottom padding
- D5: SIP slider max 500K too low
- G2: Goals 5s forced nav (fake delay)
- G3: FIRE type + survival age desynced
- P1: Profile saves with empty name
- P4: Currency change no warning
- L1+O1: Android keyboard not avoided on Login + Onboarding

---

## 2026-04-17 — V2 Replit merge + SVG chart redesign

**Build:** `app-release-v20.aab` (versionCode 20, release-signed, copied to `C:\Dropbox\finpath\`)
**Branch:** `replit-assited`
**Commits:** `13683d2` (chart + V2 components), `d36ee4e` (Inter fonts + Pro button)

### Changes
- `components/ProjectionChart.tsx`: full rewrite — react-native-svg (no Skia/Victory)
  - SVG-based, matches Gemini reference image design
  - Three zones: green (accumulation), blue (post-retirement), red (danger from failureAge/NW=0)
  - LinearGradient fill, dashed retirement line, peak dot + two-line label
  - "Retirement (N)", "Peak ₹X Cr", "Danger zone" text labels
  - Event markers as emoji rings ON curve (native Text overlay for emoji rendering)
  - Range buttons (5Y/10Y/25Y/All) + window slider for zoomed view
  - Removed event chips row below chart (was noise per user)
- `app/(tabs)/dashboard.tsx`: subtitle "Your financial journey till age N" added to chart card
- `app/_layout.tsx`: Inter fonts (400/500/600/700), GestureHandlerRootView, null-guard on font load
- `app/(tabs)/profile.tsx`: Pro upgrade card + ProPaywall modal added (was missing)
- Added V2 components: `CustomSlider.tsx`, `DepletionDialog.tsx`, `KeyboardAwareScrollViewCompat.tsx`
- Added V2 design system: `constants/theme.ts`, `engine/types.ts`
- `@expo-google-fonts/inter` installed

### V2 merge status
- ✅ Phase 1-3 (infrastructure, chart, components)
- ✅ Phase 6 (screens: tab bar, layout, profile IAP, CSV export already wired)
- ❌ Phase 5 (storage/context migration) — deferred, requires full SQLite → secure-store migration

---

## 2026-04-16 — AAB build versionCode 14

**Build:** `app-release-v14.aab` (108 MB, versionCode 14, release-signed)
**Commits:** `604bc3b` → `ae9a7c0`

### Includes
- insights useMemo + planStatus 5-state hero card (604bc3b)
- Chart label fixes: "Retirement (N)" + "Peak <value>" (ae9a7c0)
- All chatgpt.txt suggestions fully implemented
- BUILD SUCCESSFUL in 23s; scp'd to `C:\dropbox\finpath\app-release-v14.aab`

---

## 2026-04-16 — fix: chart labels (chatgpt.txt gap closure)

**Build:** none
**Commit:** `ae9a7c0`

### Changes
- `ProjectionChart.tsx`: retirement dashed-line label `Age N` → `Retirement (N)`
- `ProjectionChart.tsx`: peak dot label bare value → `Peak <value>`
- All 6 sections of chatgpt.txt now fully implemented

---

## 2026-04-16 — insights useMemo + planStatus hero card

**Build:** none
**Commit:** `604bc3b`

### Changes
- `dashboard.tsx`: `insights` useMemo — peak age/value, depletionAge, isAffordable (freq-normalised CURRENT_RECURRING expenses vs monthly income), sipGap
- `planStatus` IIFE (5 states): NO_SIP / FAIL / TIGHT / SHORT / AHEAD / ON_TRACK — each with actionable title + subtitle
- Hero card subtitle replaced: was inline ternary showing "Min. required: X"; now `planStatus.title` (bold) + `planStatus.subtitle` (dimmed)
- New `heroStatusTitle` style (15px bold white)
- Chart sections already covered by Graph 2.0 commit; skipped

### Why
ChatGPT spec §1–2: insights layer + decision-engine hero card makes the app feel actionable rather than just numeric.

---

## 2026-04-16 — AAB build versionCode 13

**Build:** `app-release-v13.aab` (108 MB, versionCode 13, release-signed)
**Commit:** `4dac778`

### Changes
- Includes Projection Graph 2.0 (pinch-to-zoom chart, background zones, event markers)
- Includes all calculator fixes from this session (partial-year growth, overflow spill, FUTURE_RECURRING corpus deduction, month-accurate inflation)
- BUILD SUCCESSFUL in 36s
- AAB scp'd to `C:\dropbox\finpath\app-release-v13.aab`

---

## 2026-04-16 — Projection Graph 2.0

**Build:** none
**Commit:** `4dac778`

### Changes
- New `components/ProjectionChart.tsx` (280 lines): pinch-to-zoom + pan via react-native-gesture-handler/reanimated
- Background zones: light green (pre-retirement), light blue (post-retirement), light red (danger after depletion)
- Peak net worth dot + label; retirement corpus dot + label; depletion dot + "Runs out at N" label
- "Sustains to N" label when corpus never depletes
- Event markers: orange rings on net worth curve at FUTURE_ONE_TIME expense ages
- Tappable event chips row below chart (emoji + name + age) — tap opens Portal tooltip dialog with amount + net worth
- Micro-insight labels inside chart: "Wealth growth", "Withdrawals", "Depleted"
- Outflow line now post-retirement only (pre-retirement outflow removed — salary-funded, not corpus)
- `app/(tabs)/dashboard.tsx`: removed CartesianChart/Line import, all Skia imports, `fireAgeFont` useMemo, `chartData` variable; replaced 170-line chart card with `<ProjectionChart>` 8-line call

### Why
User requested ChatGPT spec for Graph 2.0: pinch-to-zoom like gallery, background zones, event markers, micro-insights.

---

## 2026-04-16 — AAB build versionCode 9

**Build:** `app-release-v9.aab` (versionCode 9, release-signed)
**Commit:** `7e921af`

### Changes
- `app.json` + `build.gradle`: versionCode 8 → 9
- BUILD SUCCESSFUL in 24s
- AAB scp'd to `C:\dropbox\finpath\app-release-v9.aab`

### Includes all changes since v8
- Removed redundant inflation insight card (dashboard)
- Expense date picker range extended to age 101
- SWR dialog updated (Rich/Comfortable/Lean, horizon years, Lean warning)
- Profile name now editable in Edit Profile screen

---

## 2026-04-16 — Profile: name now editable in Edit Profile screen

**Build:** none
**Commit:** `d34fa0b`

### Changes
- `db/queries.ts`: `updateProfile()` signature extended with optional `name` param; SQL updated to include `name =?` when provided (4 SQL variants: name+dob, name only, dob only, neither)
- `app/onboarding/edit-profile.tsx`: name field changed from read-only display row to editable `TextInput`; name state + validation ("Name cannot be empty") added; `name.trim()` passed to `updateProfile`; unused `readOnlyRow/Label/Value` styles removed

---

## 2026-04-16 — Goals: SWR dialog updated

**Build:** none
**Commit:** `3e47ddb`

### Changes
- `app/(tabs)/goals.tsx` SWR dialog: synced bullet names from Fat/Moderate/Slim → Rich/Comfortable/Lean to match current UI chips
- Added corpus horizon years to each bullet (120/100/85 yrs)
- Added orange warning: "Despite the name, Lean is the most aggressive option — 7% SWR leaves least margin for bad market years"
- Existing post-tax warning retained

---

## 2026-04-16 — Expense date picker range extended to age 101

**Build:** none
**Commit:** `4780350`

### Changes
- `app/(tabs)/expenses.tsx`: computed `maxExpenseDate = new Date(dobYear + 101, 11, 31)` from `currentProfile.dob`; fallback to +80 years if no DOB
- `minExpenseDate = new Date()` (today)
- Both `Start Date` and `End Date` pickers now receive `minimumDate` + `maximumDate` props
- Root cause: `DateInput.tsx:42` defaults `maxYear` to current year when no `maximumDate` passed — now always passed from expenses page

---

## 2026-04-16 — Remove redundant inflation insight card

**Build:** none
**Commit:** `64bd8f6`

### Changes
- `app/(tabs)/dashboard.tsx`: Removed the "💡 Why ₹X Cr?" yellow insight card between hero and snapshot tiles
- Content is fully covered by the ⓘ button on the purple "AT AGE X / Projected Corpus" tile
- 20 lines deleted, one tile of vertical space recovered

---

## 2026-04-16 — AAB build versionCode 8

**Build:** `app-release-v8.aab` (108MB, versionCode 8, release-signed)
**Commit:** `6d23c6a`

### Changes
- `app.json` + `build.gradle`: versionCode 7 → 8
- AAB built via `./gradlew bundleRelease` — BUILD SUCCESSFUL in 36s
- AAB scp'd to `C:\dropbox\finpath\app-release-v8.aab`

### Includes all changes since v7
- Corpus info i-button on projected corpus tile (dashboard)
- Hero card shows live SIP amount from slider
- Depletion warning card replaced with tappable pill dialog
- SIP label moved to card header right
- Outcome info consolidated to hero subtitle; slider info line removed
- Chart: unified pre+post outflow line, solid stroke, red gradient fill
- Profile: About section with website link + footer tagline

---

## 2026-04-16 — Profile: footer tagline update

**Build:** none
**Commit:** `7252fda`

### Changes
- `profile.tsx` footer: "Made with ♥ for India" → "Made with ♥ in 🇮🇳 for the world"

---

## 2026-04-16 — Profile: About section

**Build:** none
**Commit:** `58e3e49`

### Changes
- `app/(tabs)/profile.tsx`: Added ABOUT section at bottom of profile page
  - FinPath row: leaf icon + app name + version number (v1.0.1), non-tappable
  - Visit Website row: web icon + "Visit Website" + open-in-new icon → `Linking.openURL('https://aihomecloud.com/finpath/')`
  - "Made with ♥ for India" footer text below the card
- Added `Linking` to React Native imports
- Added `APP_VERSION` and `WEBSITE_URL` constants at top of file
- Added `footerText` style

---

## 2026-04-16 — Chart: unified expenses + withdrawals outflow line

**Build:** none
**Commit:** `d9bda68`

### Changes
- `app/(tabs)/dashboard.tsx` chart: outflow line now spans full projection range
  - Pre-retirement: `p.plannedExpenses` (annual expenses from expenses page)
  - Post-retirement: `p.totalOutflow` (annual withdrawals, unchanged)
  - Both joined into single `allOutflowPts` array → one continuous path
- Line changed from dashed (`DashPathEffect`) to solid stroke
- Red gradient fill now covers the full unified line (pre + post)
- Legend: "Withdrawals" → "Expenses & Withdrawals"; condition updated to show when either segment has data
- If no expenses entered, pre-retirement segment is empty and behaviour identical to before

---

## 2026-04-16 — Outcome info consolidated to hero card; slider info line removed

**Build:** none
**Commit:** `b275258`

### Changes
- `app/(tabs)/dashboard.tsx` hero subtitle now has 3 dynamic states:
  - `requiredMonthlySIP <= 0` → "Assets cover retirement · Retire at Y"
  - SIP meaningfully above required + early FIRE achievable → "🎯 Retire at Y · Z yrs earlier"
  - Default → "Min. required: ₹X · Retire at Y"
- Removed the info text IIFE block below the SIP slider (all 3 variants now covered by hero subtitle)
- Config summary ("SIP stops at Y · Step-up Z%") moved to right side of Advanced toggle row as small italic note

---

## 2026-04-16 — SIP label moved to card header right

**Build:** none
**Commit:** `8cd1f41`

### Changes
- `app/(tabs)/dashboard.tsx`: "Monthly SIP: ₹X" label removed from below the title; replaced with `strategyHeader` row — title left, live value (`formatCurrency` short form + "/mo") right
- Saves one line of height in the Adjust Your Plan card
- Added `strategyHeader`, `strategyLiveValue` styles; `strategyTitle` lost its `marginBottom` (now owned by the row)

---

## 2026-04-16 — Depletion warning: card removed, pill made tappable

**Build:** none
**Commit:** `43028cf`

### Changes
- `app/(tabs)/dashboard.tsx`: Removed standalone orange "Corpus depletes at age X" warning card (was redundant with hero pill)
- Hero card "⚠ Runs out at X" pill converted from plain `View` to `TouchableOpacity` with `›` affordance indicator
- Tap opens a `Portal/Dialog` showing: current SIP, age corpus runs out, years into retirement, and recommended SIP to fix it
- Green "✓ Lasts till X" pill stays as plain `View` (not tappable — no action needed)
- Frees one full card of vertical space when depletion occurs

---

## 2026-04-16 — Hero card shows live SIP amount

**Build:** none
**Commit:** `1ee66ae`

### Changes
- `app/(tabs)/dashboard.tsx` hero card: big number now shows `sipAmountDisplay` (updates live while dragging slider) instead of fixed `result.requiredMonthlySIP`
- Label changed from "YOUR PLAN" → "YOUR MONTHLY SIP"
- Subtitle now shows "Min. required: ₹X · Retire at Y" (or "Assets cover retirement · Retire at Y" when no SIP needed)
- `result.requiredMonthlySIP` demoted to subtitle — still visible but no longer the primary number

---

## 2026-04-16 — Corpus info i-button on dashboard

**Build:** none
**Commit:** `8f1c62f`

### Changes
- `app/(tabs)/dashboard.tsx`: Added `IconButton icon="information-outline"` (size 16, purple) to top-right corner of the "AT AGE X / Projected Corpus" snapshot tile
- On tap, opens a `Portal` + `Dialog` explaining why the corpus is large:
  - Shows today's monthly withdrawal (e.g. ₹50K/month)
  - Computes inflation-adjusted amount at retirement (e.g. ₹1.6L/month at 6% over 30 yrs)
  - Explains corpus must fund those inflated withdrawals — hence the large number
  - Falls back to a generic explanation if withdrawal target or years-to-retire is zero
- Added `Portal`, `Dialog`, `IconButton` to react-native-paper import; added `showCorpusInfo` state
- Pattern mirrors the Goals page SWR info dialog (`IconButton` → `Portal/Dialog` → "Got it" button)

---

## 2026-04-15 — AAB build versionCode 7

**Build:** `app-release-v7.aab` (108MB, versionCode 7, release-signed)
**Commit:** `9738c5c`

### Changes
- `app.json`: versionCode 4 → 7 (was stale vs build.gradle's 6; synced both to 7)
- `android/app/build.gradle`: versionCode 6 → 7
- AAB built via `./gradlew bundleRelease` — BUILD SUCCESSFUL in 40s
- AAB scp'd to `C:\dropbox\finpath\app-release-v7.aab`

### Notes
- build.gradle versionCode is not gitignored but android/ is typically regenerated — the app.json versionCode (now 7) is the source of truth for next prebuild
- R8 minification still disabled; AAB remains ~108MB

---

## 2026-04-15 — Rules update: git push mandatory + Windows/Mac role clarification

**Build:** none
**Commits:** `984dc31`, `a6b28c8`

### Changes
- **Post-change protocol**: git push added as mandatory step after every commit — no unpushed commits allowed at any point
- **CLAUDE.md (Mac + Windows)**: Machine setup rewritten — Windows = UI+orchestration only; `C:\Dropbox\finpath\` = MD files + outputs only; every Dropbox MD must mirror to Mac `kb/`; large rewrites may draft on Windows then scp to Mac
- **global rules.md**: Rules 1–3 and 14 updated to match above
- **`kb/session_logs.md`**: Created on Mac as permanent mirror of this file
- **`kb/UXaudit.md`**: Committed to Mac (was already created in prior entry)

### Rules established
- `commit → push → log` is the mandatory sequence after every code change
- Windows = Claude Code UI only; no permanent source code on Windows ever
- Dropbox MD files always have a Mac `kb/` mirror, synced after every write

---

## 2026-04-15 — Currency symbol fix + UXaudit

**Build:** none
**Commit:** `984dc31`

### Changes
- **`app/(tabs)/profile.tsx` L75**: Fixed currency display bug — was printing the raw string "INR" or "USD" before the income amount. Now correctly renders `₹` (INR) or `$` (USD) using the same ternary pattern already used everywhere else in the app.
- **`kb/UXaudit.md`** (new): Full pre-launch UX audit saved as structured todo list. 24 tasks across P0 (must-do before submit), P1 (before v1.1), P2 (nice-to-have). Item #10 (currency fix) marked complete in the audit.

### Context
- Audit was generated by a full UX review in the prior session (compacted). Covers IAP, privacy policy, store listing, disclaimer, CorpusPrimer, FIRE naming, empty states, R8 minification, and more.
- All other screens (goals, assets, expenses, dashboard, create-profile, edit-profile) already used the correct `currency === 'INR' ? '₹' : '$'` pattern — profile.tsx was the only outlier.

---

## 2026-04-15 — Graphify knowledge graph + wiki nav index + function index

**Build:** none
**Commits:** `2809d86`

### Changes
- **graphify 0.4.12 installed** (was already present, `graphifyy` pip package under python3.11)
- **`graphify update .`** from `~/finpath`: AST extraction produced 145 nodes, 161 edges, 32 communities. Zero LLM cost (pure AST). Files: `graphify-out/graph.json`, `graphify-out/GRAPH_REPORT.md`
- **`graphify claude install`**: appended graphify section to `~/finpath/CLAUDE.md` + registered PreToolUse hook in `~/finpath/.claude/settings.json` — fires before every Glob/Grep to redirect Claude to check the graph first
- **`graphify hook install`**: installed post-commit + post-checkout git hooks that auto-run `graphify update .` on every commit (graph stays current, no manual rebuild needed)
- **`graphify-out/wiki/index.md`** (hand-crafted, ~150 lines): task-oriented navigation hub. Maps "I need to change X" → exact file + function. Primary pre-search checkpoint. More useful than auto-wiki for this codebase size.
- **`kb/FUNCTION_INDEX.md`** (~200 lines): every function in every file with approximate line numbers. Eliminates most Grep calls for "where is X".
- **`graphify-out/cache/`** added to .gitignore (SHA256 cache files, regenerated automatically)
- **CLAUDE.md (Windows/Dropbox)** updated: fixed 5 stale facts (package name, commit hash, versionCode, keystore path/alias), added graphify section (rule 7: check wiki before Glob/Grep), added graph nav index + function index to detailed docs table

### God nodes (most risky to touch)
1. `calculateProjections()` — 9 edges (every screen reads this)
2. `calculateExpenseForYear()` — 6 edges (called in 3 separate loops)
3. `pinKey()` — 4 edges (changing breaks all existing user logins)

### Key lessons
- `graphify .` is a Claude Code skill invocation, not a CLI command. Use `graphify update <path>` from terminal for AST-only graph rebuild.
- `graphify cache/` generates 32 SHA256 JSON files — add to .gitignore immediately after first run.
- The Mac mini CLAUDE.md (gitignored) and Windows Dropbox CLAUDE.md are separate files. Both were updated.

### Open items
- graphify `--wiki` flag is a skill-mode feature (requires Claude as LLM); CLI produces wiki only via hand-craft or `/graphify --wiki` inside a session.
- CONTEXT.md appeared as untracked on Mac — it's a legacy project summary, left untracked.

---

## 2026-04-15 — Full backend audit + 61 unit tests

**Build:** none
**Commit:** `5d8c1e2`

### Changes
- **`__tests__/__mocks__/queries.ts`**: Type-only mock for `db/queries` (interfaces only, no SQLite/SecureStore at test runtime). Required by Jest `moduleNameMapper` already wired in `package.json`.
- **`__tests__/inflation.test.ts`** (9 tests): `inflationAdjusted` and `presentValue` pure-function tests. Covers basic compounding, zero-rate, roundtrip, and relative ordering.
- **`__tests__/calculator.test.ts`** (52 tests): Full audit of `engine/calculator.ts` across 14 describe blocks:
  - `formatCurrency` / `formatCurrencyFull` — K/L/Cr suffix boundaries, negative, USD
  - Projection structure — length, age sequence, annualSIP pre/post sipStopAge, pensionIncome pre/post retirement
  - Self-use real estate exclusion from investableNetWorth
  - Blended growth rate — equity (12%) vs savings (7%) impact on corpus and required SIP
  - `fireCorpus` — zero pension, pension scaling, Fat > Moderate > Slim ordering, inflation impact, post-retirement expense PV
  - `requiredMonthlySIP` — already-wealthy (zero SIP), fresh starter realistic range, mid-career vs fresh starter comparison, isOnTrack flag
  - `netWorthAtRetirement`, `failureAge` detection, monotonic pre-retirement growth
  - Coast FIRE (sipStopAge < retirementAge) — no SIP after stop age, corpus grows in coast phase
  - ESOP quarterly vesting — vestingIncome value, reduces SIP need, stops after vesting_end_date
  - Expense PV — current recurring in presentValueOfExpenses, post-retirement future recurring in postRetirementExpensesPV, month-aware PV calculation, inflation ordering
  - `fireAchievedAge` — isFireAchieved flag propagation, never-achieved case
  - SIP burden warnings — null when wealthy, "exceeds income" text, combined SIP+expenses, zero income guard
  - FIRE type corpus ordering (fat > moderate > slim), required SIP ordering
  - Step-up rate — higher step-up reduces required SIP, annualSIP grows over time

### Key lessons
- `calculateExpenseForYear` prorate year-0 to remaining calendar months (`12 - currentMonth`). Manual PV assertions must mirror this.
- `toBeCloseTo(N, 0)` precision means within 0.5 of N — 50000 * 1.08^20 = 233047.86 rounds to 233048, not 233047.
- `ts-jest` node environment resolves `moduleNameMapper` on import string literals — the `^../db/queries$` pattern correctly intercepts `engine/calculator.ts`'s import.

### Open items
- All 61 tests pass in 1.3s. No build needed (JS-only, no native deps).

---

## 2026-04-15 — Pension inflation fix, expense tile polish, CorpusPrimer update, dashboard visual overhaul

**Build:** none (no AAB built this session — JS-only changes, no native deps changed except expo-linear-gradient install)
**Commits:** `7fc003d`, `7441ba2`, `0f5cad3`

### Changes
- **calculator.ts** (`7fc003d`): Threaded `discountRate` (from `goals.inflation_rate`) through all 4 pension functions instead of hardcoded `PENSION_INFLATION_RATE = 0.06`. Affected: `simulatePostRetirementCorpus`, `simulateCorpusAtAge`, `calculateSimulationFireCorpus`, `calculateRequiredSIP`, and the main projection loop. This means the FIRE corpus and required SIP now correctly reflect the user's chosen inflation rate.
- **expenses.tsx + CorpusPrimer.tsx** (`7441ba2`):
  - Expense tile: added category icon (left of name), removed inline delete `IconButton`, Delete moved to edit modal `formActions`
  - CorpusPrimer block 3: replaced stale SWR explanation with "How Inflation Shapes Your Target" — today's ₹1L → ₹3.2L in 20 yrs at 6% inflation
- **dashboard.tsx + expo-linear-gradient** (`0f5cad3`):
  - Installed `expo-linear-gradient` (npm, --legacy-peer-deps due to react-dom peer conflict)
  - Hero card: `<View>` → `<LinearGradient>` with dynamic colors based on `sipRatio` (teal≥1.15x, green≥1.0x, amber≥0.7x, red<0.7x)
  - On Track pill: white background + colored text (green/red), not transparent
  - Survival pill: amber background `rgba(255,167,38,0.9)` when `failureAge > 0`
  - Chart: green gradient fill under net worth line (`SkiaLinearGradient` inside `SkiaPath style="fill"`)
  - Chart: red gradient fill + red dashed line for post-retirement withdrawals (built from `projections` manually via `xScale`/`yScale`, not Victory `yKeys`)
  - Legend: added Withdrawals item (red dashed)

### Key lessons
- Complex Python scripts should be written via `Write` tool + SCP, not SSH heredoc — single quotes in Python strings break local shell parsing at >100 lines
- `expo install` requires PATH fix; use `npm install --legacy-peer-deps` if peer conflicts with react-dom
- CorpusPrimer: use `python3 -c "..."` with `c[start:end]` slice approach when pattern has emoji + JSX escape sequences

### Open items
- No AAB built yet; versionCode still 6. Build next session if user confirms no further changes.
- `expo-linear-gradient` added to package.json — next clean prebuild will need `npm install --legacy-peer-deps` step

---

## 2026-04-09 (r1–r3) — Initial builds, date picker, tab order, signing

- Rewrote date picker: `@react-native-community/datetimepicker` → pure-JS `components/DateInput.tsx` (ScrollView columns bottom-sheet)
- Tab order set: Assets → Expenses → Goal → Dashboard → Profile
- "Plan" tab renamed to "Goal"
- Fixed `assets.tsx` `resetForm()` crash: 3 dead setters (`setExpectedRoi`, `setGoldSilverUnit`, `setGoldSilverQuantity`) called but never declared — removed
- Fixed `withReleaseSigning.js` idempotency guard: was checking `'finpath-release.jks'` (never in build.gradle) → changed to `'keystorePropertiesFile'`
- Fixed `usePro.tsx`: `endConnection()` wrapped in try/catch (unhandled rejection on emulator)
- Built r3 APK, installed on emulator, verified ESOP/RSU + Stocks chips open without crash
- **Open:** Step-3 regex in plugin still broken — signingConfig in buildTypes.release needs manual sed

---

## 2026-04-09 (r4–r6) — Full codebase audit + UX audit

- Re-applied tab order + Goal rename on Mac (previous fix was on Windows only, never reached Mac)
- Removed dead `@react-native-community/datetimepicker` from package.json
- Built r6 APK (~54MB), installed on emulator
- Created `C:\dropbox\claude\` memory system (CONTEXT.md, global/, projects/finpath/, sessions/)
- **Package name:** `com.anonymous.finpath` — kept deliberately (changing = new app on Play Store, sideloaders lose data)

---

## 2026-04-09 (r7) — Dashboard redesign + SIP engine

- Full lifecycle SIP model: two-phase return rate (pre/post SIP stop age)
- Dashboard redesign: summary tiles, net worth chart (Victory Native + Skia), year-by-year table
- Skia.Font(undefined) crash in release → fixed with `matchFont({ fontSize: 11 })`
- 9-point dashboard audit fixes: Profile tab, FIRE/SIP display, chart improvements
- Post-retirement slider added, FIRE corpus target line on chart
- **status.md last updated here — r8–r13 sessions had no logs (laptop restart)**

---

## 2026-04-09–10 (r8–r12) — UX overhaul (reconstructed from git log)

Commits: `0c943b6` through `cd312b1`

- Product audit + TRANSFORM.md written
- Goals screen: removed FIRE corpus preview tile, renamed "Pension" → "Monthly Retirement Withdrawal", removed save alert, renamed CTA to "Save Plan", FIRE type chips (Slim/Moderate/Fat/Custom)
- Expenses screen: accent changed to neutral blue-grey, plain-language type labels with contextual hints
- Assets screen: per-asset ROI slider removed (uses DEFAULT_GROWTH_RATES), Gold/Silver grams input removed
- Dashboard: empty state → icon + "Set Your Plan" CTA, Advanced settings collapsible, SIP burden warning card (4 severity levels), corpus clarity notes
- Chart: withdrawals-only post-retirement, legend rename, corpus intersection dot + label
- SIP engine: switched to FV annuity formula, prorate current year to remaining months
- Inflation consistency: expenses PV now uses `goals.inflation_rate`
- Return rate slider labels corrected (sipStopAge not retirementAge)
- CorpusPrimer: first-time onboarding dialog + inline lightbulb hint on Goals screen
- Tab reorder: tried Dashboard-first → reverted → Assets-first (final)
- Package name change attempted → reverted (commit `8812adf`)

---

## 2026-04-10 (r13) — Logout moved to Profile

- Commit `38051fa`: logout button moved from Dashboard header to Profile page
- Cleaner header, logout now in expected settings location

---

## 2026-04-11 — Data safety doc + gitignore CLAUDE.md

**Commit:** `615fa04 docs: add data-safety Play Console reference + gitignore CLAUDE.md`

- `docs/data-safety.html`: new file — exact answers for Play Console Data Safety form. Covers personal info (name, DOB), financial info (income, assets, expenses, goals), purchase history (→ Google Play only), biometrics (opt-in flag only, raw data stays with Android OS), Sentry disabled caveat.
- `.gitignore`: added `CLAUDE.md` — local instructions file, not for repo
- No code changes. No APK built.

---

## 2026-04-11 — Remove multi-profile Pro gate (no APK built yet)

**Commit:** `eb1fdcb feat: remove multi-profile Pro gate — profiles free, CSV export is only IAP feature`

- `login.tsx`: removed `usePro`/`ProPaywall` imports, removed `showPaywall` state, removed `isPro` gate on "Add New Profile" button — now navigates directly to create-profile
- `create-profile.tsx`: removed `getAllProfiles`/`usePro`/`ProPaywall` imports, removed Pro gate block in `handleSubmit`
- `ProPaywall.tsx`: removed `reason` prop entirely, removed "Unlimited profiles" from FEATURES, updated headline to "Export your full projection to CSV"
- `dashboard.tsx`: removed `reason="export"` from ProPaywall usage (prop no longer exists)
- All four files: no stale Pro/profiles references remain
- **Next:** build APK (r14) to verify no regressions

---

## 2026-04-11 — Monetization strategy update + kb/architecture sync

**No APK built.** Docs-only session.

- Identified stale code: login.tsx + create-profile.tsx still gate multiple profiles behind isPro — remnant of old 2-app strategy. Under current strategy profiles are FREE, only CSV export is Pro (IAP).
- ProPaywall.tsx FEATURES list also stale — still shows "Unlimited profiles" as a Pro feature.
- Updated kb/ARCHITECTURE.md: added monetization model section, added missing files (usePro, ProPaywall, CorpusPrimer, edit-profile), updated tech stack (react-native-iap, Sentry), updated data model, updated calculator engine docs.
- Appended to kb/DECISIONS_AND_LESSONS.md: 2-app -> single-app decision, stale code note, full UX overhaul summary (r7-r13).
- Committed: `3f49735 docs: update kb — monetization model, architecture, UX decisions (r7-r13)`
- **Open (code fix needed):** Remove isPro gate from login.tsx:260, create-profile.tsx:58-60. Update ProPaywall.tsx FEATURES to remove "Unlimited profiles".

---

## 2026-04-11 — Play Store audit + memory recovery

- No code changes this session
- Full Play Store readiness audit performed
- Confirmed package name decision correct (don't change)
- **Blockers identified:**
  1. Create `finpath_pro` IAP product in Google Play Console
  2. Verify privacy policy URL: https://parasjaing8.github.io/finpath/PRIVACY_POLICY
  3. Remove `SYSTEM_ALERT_WINDOW` + `READ/WRITE_EXTERNAL_STORAGE` permissions from AndroidManifest
- **Other issues:** hardcoded IAP price, R8 disabled (~54MB APK), Sentry DSN not set, withReleaseSigning step-3 regex broken
- Established new rule: every code change → git commit + log entry here
- Updated `status.md` to r13, created this `logs.md`

---

## 2026-04-11 — Full kb + memory sync (docs only, no code changes)

**Commit:** `7deddf9 docs: full kb sync — reflect current codebase, remove stale info`

**Problem:** kb/ markdown files and Dropbox memory files were stale — written during r7-r13 sessions and never fully updated after commit eb1fdcb (profile gate removal). Caused audit to give wrong recommendations.

**What was synced (kb/ on Mac mini):**
- `ARCHITECTURE.md`: removed stale "STALE CODE" note about profile gate (already fixed in eb1fdcb). Updated tech stack (added sliders, testing). Removed stale `expo-secure-store` from plugins list (not in app.json). Added is_income column to expenses schema. Added known issues section.
- `DECISIONS_AND_LESSONS.md`: marked all "fix needed" items as DONE (profile gate, ProPaywall feature list). Removed redundant future-tense language. Consolidated entries. Fixed keystore filename (.jks not .keystore).
- `FINANCIAL_MODEL.md`: removed reference to per-asset ROI slider (was removed in r8-r12). Fixed known limitation text. Minor cleanup.
- `TRANSFORM.md`: marked all implemented items with DONE/OPEN status. Removed speculation. Added consolidated open items list at end. Sections 1-8 all annotated with current implementation status.
- `DEV_ENVIRONMENT.md`: removed `eas build` from build commands (contradicts project rules). Fixed file sync section (Dropbox is outputs only, not source code). Simplified Ollama section.

**What was synced (Dropbox memory files):**
- `status.md`: updated latest commit to eb1fdcb, total commits to 36, added r14 not-yet-built note, added edit-profile and New Architecture to working features.
- `decisions.md`: added missing entries for monetization pivot, two-bucket model, UX overhaul (r7-r13), FLAG_SECURE, PIN in SecureStore, date parsing lesson.
- `build.md`: updated version info from "r3 build" to "r13 last built / eb1fdcb latest commit". Updated date.
- `stack.md`: removed `expo-secure-store` from plugins (not in app.json). Added react-native-iap, @sentry/react-native, slider, testing/linting. Added React version. Added permissions list. Updated date.

**Key corrections made:**
1. Profile gate removal (eb1fdcb) was already done but docs said "fix needed" — fixed.
2. `expo-secure-store` was listed as an Expo plugin but is NOT in app.json plugins array — removed from docs.
3. Keystore filename was `.keystore` in one place, `.jks` everywhere else — standardized to `.jks`.
4. DEV_ENVIRONMENT.md referenced `eas build` — removed (violates project rules).
5. TRANSFORM.md had no completion tracking — all items now marked DONE or OPEN.
6. status.md said latest commit was 38051fa — updated to eb1fdcb.

**No code changes. No APK built.**

---

## 2026-04-11 — Stage 1: App ID change to com.aihomecloud.finpath

**Commit:** `9de20aa feat: change app ID to com.aihomecloud.finpath`

- `app.json`: `"package"` changed from `com.anonymous.finpath` → `com.aihomecloud.finpath`
- `android/app/build.gradle`: `namespace` and `applicationId` both updated (gitignored, not in commit)
- `android/app/src/main/java/com/anonymous/finpath/MainActivity.kt`: package declaration updated, file moved to `com/aihomecloud/finpath/` (gitignored)
- `android/app/src/main/java/com/anonymous/finpath/MainApplication.kt`: same as above, old folder deleted
- Note: actual App ID in code was `com.anonymous.finpath` (not `com.anonymous.app` as CONTEXT.md said) — CONTEXT.md was stale, now corrected
- **Stage 1 complete. Next: Stage 2 — Privacy Policy page on aihomecloud.com**
- No APK built yet (r14 still pending)

---

## 2026-04-11 — Release AAB built (Play Store Stage 4 partial)

- Created `~/finpath/android/keystore.properties` with storeFile, storePassword, keyAlias, keyPassword
- Ran `./gradlew bundleRelease` — BUILD SUCCESSFUL in 2m 50s
- AAB signed with release key (`finpath-release.jks`, alias `finpath`)
- Output: `~/finpath/android/app/build/outputs/bundle/release/app-release.aab`
- `keystore.properties` confirmed working — `validateSigningRelease` passed
- No code changes. No git commit. Build artifact only.
- Note: `keystore.properties` must be recreated after every `expo prebuild --clean` (wipes android/)

---

## 2026-04-11 — Fixed signingConfig + correct keystore password + release AAB built

- Fixed `build.gradle` release buildType: `signingConfig signingConfigs.debug` → `signingConfigs.release`
- Fixed `keystore.properties`: `storeFile` changed from `../finpath-release.jks` to absolute path `/Users/parasjain/finpath/finpath-release.jks`
- Fixed password: `FinPath@2026` was wrong — correct password confirmed via keytool
- Alias confirmed via keytool: `finpath` ✓
- `./gradlew bundleRelease` — BUILD SUCCESSFUL in 5s
- `validateSigningRelease` ✓ and `signReleaseBundle` ✓ both passed
- AAB copied to `C:\dropbox\finpath\app-release.aab` (108MB, release-signed)
- **This AAB is correctly signed with the release keystore — ready for Play Store upload**

---

## 2026-04-12 — IAP error handling + final release AAB

**Commits:**
- `3b49de1 feat: surface IAP error messages — errorMessage state + clearError in usePro`
- `8aab2f4 feat: show IAP error message in ProPaywall — red text below Upgrade button, clearError on dismiss`

**Changes:**
- `hooks/usePro.tsx`: added `errorMessage` state + `clearError` to context. Purchase failures now surface a message to the user instead of silently swallowing the error in production
- `components/ProPaywall.tsx`: displays `errorMessage` in red below Upgrade button. All dismiss paths call `clearError()` to reset error on close

**Build:**
- Recreated `keystore.properties` (wiped by previous session)
- Verified `signingConfigs.release` already in place in `build.gradle`
- `./gradlew bundleRelease` — BUILD SUCCESSFUL in 30s
- `validateSigningRelease` ✓ `signReleaseBundle` ✓
- AAB copied to `C:\dropbox\finpath\app-release.aab` (108MB, release-signed, 2026-04-12)

---

## 2026-04-12 — versionCode bump to 3 + new release AAB

**Commit:** `0b4593c feat: bump versionCode to 3 (1.0.1 build 3)`

- `app.json`: `versionCode` 2 → 3, `version` stays `1.0.1`
- Recreated `keystore.properties`, `signingConfigs.release` already in place
- `./gradlew bundleRelease` — BUILD SUCCESSFUL in 11s
- `validateSigningRelease` ✓ `signReleaseBundle` ✓
- AAB copied to `C:\dropbox\finpath\app-release.aab` (108MB, release-signed, versionCode 3, 2026-04-12)

---

## 2026-04-12 — Fixed versionCode in build.gradle + final AAB rebuild

- `android/app/build.gradle` line 102: `versionCode 2` → `versionCode 3` (was not updated by prebuild, fixed manually)
- Recreated `keystore.properties`, fixed `signingConfigs.release` in release buildType
- `./gradlew bundleRelease` — BUILD SUCCESSFUL in 14s
- `signReleaseBundle` ✓
- AAB copied to `C:\dropbox\finpath\app-release.aab` (108MB, versionCode 3, 11:09 2026-04-12)

---

## 2026-04-12 — IAP error detail: show actual code + message

**Commit:** `0d44795 fix: show actual error code and message in IAP purchase failures`

- `hooks/usePro.tsx` line 77: `purchaseErrorListener` now shows `` `Billing error: ${error?.code} ${error?.message}` ``
- `hooks/usePro.tsx` line 109: `purchasePro` catch now shows `` `Purchase failed: ${e?.code} ${e?.message}` ``
- No APK/AAB built — code change only

---

## 2026-04-12 — versionCode 4 + release AAB rebuild

**Commit:** `62ab1ad feat: bump versionCode to 4 (1.0.1 build 4)`

- `app.json` + `android/app/build.gradle`: `versionCode` 3 → 4
- Recreated `keystore.properties`, fixed `signingConfigs.release`
- `./gradlew bundleRelease` — BUILD SUCCESSFUL in 24s
- `signReleaseBundle` ✓
- AAB copied to `C:\dropbox\finpath\app-release.aab` (108MB, versionCode 4, 11:56 2026-04-12)
- Includes all commits: App ID change, IAP error handling, error detail messages
- Note: `android/` is gitignored — build.gradle versionCode fix is not committed. Must reapply after every `expo prebuild --clean`

---

## 2026-04-11 — Fixed release signingConfig in build.gradle

- `withReleaseSigning.js` step-3 regex failed during prebuild — left `release` buildType using `signingConfigs.debug`
- Manually patched `android/app/build.gradle`: changed `signingConfig signingConfigs.debug` → `signingConfig signingConfigs.release` in release block only
- `debug` block unchanged — still uses `signingConfigs.debug`
- `android/` is gitignored — no commit. Fix must be reapplied after every `expo prebuild --clean`

---

## 2026-04-12 — SESSION SUMMARY + LESSONS LEARNED

### What was done this session (all commits)

| Commit | Description |
|---|---|
| `9de20aa` | Stage 1: App ID changed from `com.anonymous.finpath` → `com.aihomecloud.finpath` |
| `3b49de1` | Added `errorMessage` state + `clearError` to `usePro.tsx` — IAP errors now surface in production |
| `8aab2f4` | `ProPaywall.tsx` shows red error text below Upgrade button, clears on dismiss |
| `0d44795` | Error messages show actual `e?.code` and `e?.message` instead of hardcoded strings |
| `0b4593c` | versionCode bumped to 3 |
| `62ab1ad` | versionCode bumped to 4 |
| `c6cf1d8` | Fixed react-native-iap v14 API: `getProducts` → `fetchProducts`, `requestPurchase` signature updated |
| *(pending)* | versionCode 5 — built and copied to Dropbox but app.json not yet committed |

**Final AAB:** `C:\dropbox\finpath\app-release.aab` — 108MB, versionCode 5, release-signed, 2026-04-12

---

### Lessons learned — CRITICAL for future sessions

**1. keystore.properties is wiped after every `expo prebuild --clean`**
- File: `~/finpath/android/keystore.properties`
- Must recreate manually every time android/ is regenerated
- Correct contents:
  ```
  storeFile=/Users/parasjain/finpath/finpath-release.jks
  storePassword=Paras@iisc18
  keyAlias=finpath
  keyPassword=Paras@iisc18
  ```
- `storeFile` must be **absolute path** — relative path `../finpath-release.jks` resolves to wrong directory (`android/app/`, not `android/`)
- Keystore lives at `~/finpath/finpath-release.jks` (root of project, not inside android/)

**2. signingConfig in release buildType reverts after every expo prebuild --clean**
- `withReleaseSigning.js` step-3 regex is broken — doesn't switch release buildType from `signingConfigs.debug` to `signingConfigs.release`
- Must manually fix `android/app/build.gradle` after every prebuild:
  ```python
  python3 -c "
  content = open('/Users/parasjain/finpath/android/app/build.gradle').read()
  import re
  fixed = re.sub(r'(release\s*\{[^}]*)signingConfigs\.debug', r'\1signingConfigs.release', content, flags=re.DOTALL)
  open('/Users/parasjain/finpath/android/app/build.gradle', 'w').write(fixed)
  "
  ```

**3. versionCode in build.gradle is NOT updated by app.json — must patch separately**
- After prebuild, build.gradle versionCode resets to whatever prebuild generates
- Must manually run: `sed -i '' 's/versionCode N/versionCode M/' ~/finpath/android/app/build.gradle`
- Always keep app.json and build.gradle versionCode in sync

**4. Keystore credentials (corrected)**
- Password: `Paras@iisc18` (NOT `FinPath@2026` — that was wrong and documented incorrectly)
- Alias: `finpath` (NOT `finpath-key` — CLAUDE.md had wrong alias)
- File: `~/finpath/finpath-release.jks`

**5. react-native-iap v14 API is breaking vs v12/v13**
- `getProducts` → `fetchProducts`
- `requestPurchase({ skus: [...] })` → `requestPurchase({ request: { google: { skus: [...] } }, type: 'in-app' })`
- `fetchProducts({ skus: [...] })` → `fetchProducts({ skus: [...], type: 'inapp' })`

**6. CONTEXT.md location**
- Real file: `~/finpath/CONTEXT.md` (inside the project root)
- `~/projects/finpath/CONTEXT.md` also exists but is the old/separate KB file — not the main one

**7. Shell quoting for template literals via SSH**
- Template literal strings (backtick + `${}`) cannot be safely written in Python one-liners via SSH
- Always write Python fix scripts to `/tmp/fix_name.py` first, then execute with `python3 /tmp/fix_name.py`

**8. Standard build sequence (after expo prebuild --clean)**
```
1. Recreate keystore.properties (absolute storeFile path, password Paras@iisc18)
2. Fix versionCode in build.gradle
3. Fix signingConfig (python3 regex replace)
4. Verify: grep -n "versionCode\|signingConfig" build.gradle
5. ./gradlew bundleRelease
6. scp AAB to Windows
```
- AAB copied earlier (108MB) was built before this fix — was debug-signed, not release-signed. Must rebuild.


---

## 2026-04-13 — FIRE corpus engine rewrite (calculator.ts)

**Commit:** f37be0e  
**Build:** none (engine-only change)

### What changed
- `engine/calculator.ts`: replaced SWR-formula FIRE corpus with simulation-based approach
  - Added `FIRE_TARGET_AGES`: slim=85, moderate=100, fat=120 (replaces SWR % knob)
  - Added `calculateSimulationFireCorpus()`: binary search for min retirement corpus that survives to `fireTargetAge`; fat/Rich mode requires corpus preservation (corpus at targetAge ≥ starting corpus)
  - Added `simulatePostRetirementCorpus()`: unclamped post-retirement helper for binary search
  - Added `failureAge` to `CalculationOutput`: first year post-retirement corpus goes negative (-1 if never depletes)
  - `fireCorpus` now consistent with `requiredMonthlySIP` — both simulation-based, eliminating SWR/simulation mismatch

### Why
SWR formula (withdrawal/SWR%) calibrated for US equity real returns (4-7%). At Indian postSipReturnRate=7% and pension inflation=6%, real return=1% — SWR of 5% depletes corpus by age 74, not 100. The SWR formula was giving a fireCorpus of ₹8.16Cr while simulation correctly required ₹15+Cr, causing FIRE age to show as 45 instead of 50.

### Open (next)
- goals.tsx: rename FIRE type chips Slim/Moderate/Fat → Lean/Comfortable/Rich; pass correct fire_target_age (85/100/120) to DB instead of hardcoded 100
- dashboard.tsx: show failureAge warning; update FIRE age display

## 2026-04-13 — Goals screen: Safety Level UI (goals.tsx)

**Commit:** 42cc830  
**Build:** none

### What changed
- `app/(tabs)/goals.tsx`: FIRE type chips renamed Lean/Comfortable/Rich (DB keys slim/moderate/fat unchanged — no migration)
- `fire_target_age` now saved correctly as 85/100/120 instead of hardcoded 100
- Custom type: target age slider (75–120) replaces withdrawal rate % slider
- Info dialog rewritten in plain English — no SWR jargon
- State: `withdrawalRate` removed, `fireTargetAge` drives all logic
- Import: `FIRE_TARGET_AGES` replaces `FIRE_WITHDRAWAL_RATES`

### Open (next)
- dashboard.tsx: show `failureAge` warning; update FIRE age display logic

## 2026-04-13 — Dashboard: corpus depletion warning (dashboard.tsx)

**Commit:** db911b3  
**Build:** none

### What changed
- `app/(tabs)/dashboard.tsx`: orange warning card inserted below corpus tiles when `result.failureAge > 0`
- Shows: "⚠ Corpus depletes at age X. Increase your monthly SIP or consider a later retirement age."
- Uses `failureAge` from `CalculationOutput` (added in f37be0e)

### All 3 FIRE engine changes now complete
1. f37be0e — calculator.ts: simulation-based FIRE corpus, failureAge detection
2. 42cc830 — goals.tsx: Lean/Comfortable/Rich chips, fire_target_age correctly saved
3. db911b3 — dashboard.tsx: corpus depletion warning shown when corpus fails before age 100

## 2026-04-13 — Asset/Expense tile UX fixes (assets.tsx, expenses.tsx)

**Commit:** da33001
**Build:** none

### What changed
- `app/(tabs)/assets.tsx`: saved asset tiles now show category icon (Icon component from react-native-paper) + `{expected_roi}% p.a.` instead of currency text (INR/USD)
- `app/(tabs)/expenses.tsx`: `expRow` padding set to `paddingVertical:8, paddingHorizontal:12` to match asset tile size

### All 5 UX fixes from feedback session now complete
1. da33001 — asset tiles: category icon added
2. da33001 — asset tiles: growth rate shown instead of currency
3. da33001 — expense tiles: padding matched to asset tiles
4. f37be0e/42cc830/db911b3 — FIRE engine + Goals + Dashboard: simulation-based corpus, Lean/Comfortable/Rich, failure age warning

## 2026-04-13 — Dashboard redesign: hero card, insight card, bell-curve chart

**Commit:** 37a26e5
**Build:** none

### What changed
`app/(tabs)/dashboard.tsx` — full Section A overhaul + chart simplification:

**Section A (was: 4 tiles across 3 rows → now: 3 focused blocks)**
- Hero card (dark green #1B5E20): large ₹X/month SIP amount, "To retire at age N", On Track/Off Track pill, "✓ Lasts till N" or "⚠ Runs out at N" pill
- Inflation insight card (amber #FFFDE7, left border #F9A825): "💡 Why ₹X Cr?" — shows today's withdrawal inflated to retirement-age value with inflation_rate and years, plus annual corpus draw required
- Snapshot row: TODAY (investable NW, #E8F5E9 green) + AT AGE N (projected corpus, #EDE7F6 purple) — replaces dual-column card

**Chart (was: 2 lines + orange dashed corpus line → now: single bell curve)**
- Removed: red withdrawal line (totalOutflow was confusing), orange horizontal FIRE corpus dashed line (now redundant since corpus ≈ peak)
- Added: green vertical dashed line at retirement age + "Age N" label at top
- Added: green dot + corpus value label at retirement peak
- Added: red dot + "Runs out at N" label at failure age (only when corpus depletes)
- Legend simplified: Net Worth + Retirement marker + conditional Depletes item

**SIP slider feedback (was: technical params → now: human outcome)**
- Above minimum: "📍 At ₹X → retire at N, Y yrs earlier"
- At minimum: "Minimum to retire at N · SIP stops at N · Step-up X%/yr"
- No SIP needed: "✓ Your existing assets cover retirement"

### Color system
Hero card anchors all downstream color: green (#1B5E20) = identity/positive, purple (#5E35B1) = future/projection, amber (#F9A825) = insight/read-me, red (#C62828) = warning/depletes

### New styles added
heroCard, heroLabel, heroAmount, heroSubtitle, heroPillRow, heroPill, heroPillText, insightCard, insightTitle, insightBody, insightHighlight, snapTile, snapLabel, snapNumber, snapSub

### Open
- Build not yet produced — dashboard redesign uncommitted changes from session start are now all committed
- Goals page: inflation slider + future value message for monthly withdrawal target (deferred from this session)

## 2026-04-13 — Goals page: inflation slider + future value hint

**Commit:** dbd4295
**Build:** none

### What changed
`app/(tabs)/goals.tsx`:
- **Inflation Rate slider** (3–12%, step 1, default 6%) inserted between FIRE type chips and Monthly Retirement Withdrawal section. `inflationRate` state + DB save already existed — this adds the missing UI.
- **Future value hint** inserted immediately below the withdrawal TextInput. Shows: "{today's withdrawal}/month today = {inflated}/month at age {retirementAge} ({X}% inflation, {Y} yrs)". Uses same amber card style (#FFFDE7, left border #F9A825) as dashboard insight card. Only visible when pensionIncome > 0 and yearsToRetirement > 0.
- New styles: fvCard, fvText, fvHighlight

### Why
User sees ₹1L/month as the withdrawal target but has no sense of what that means at retirement. Without showing the inflated value, the corpus target on Dashboard (₹16 Cr) feels arbitrary. This grounds the insight at the point of data entry.

## 2026-04-13 — Build: AAB versionCode 6

**Commit:** ce99da6 (fix) on top of dbd4295
**Build:** app-release.aab, versionCode 6, 108MB, at C:\dropbox\finpath\app-release.aab

### What happened
- First bundleRelease failed: JSX syntax error — orphaned old legend items (Withdrawals + Corpus Target) left in dashboard.tsx after Script 3's legend replacement found the wrong closing </View>
- Fix commit ce99da6: removed orphaned block
- Second bundleRelease succeeded in 29s
- AAB copied to Windows via scp (Dropbox not mounted on Mac mini)

### Build sequence used
- No expo prebuild --clean (android/ intact from previous build)
- versionCode manually bumped 5 → 6 in android/app/build.gradle
- keystore.properties already in place
- signingConfig already correct (release → release)
- git push → bundleRelease → scp to Windows

---

## 2026-04-16 — Bug fix: FUTURE_ONE_TIME pre-retirement corpus deduction

**Build:** none (logic-only fix; AAB build deferred)
**Commit:** `f191c9f`

**What changed:**
- `engine/calculator.ts` — 4 targeted changes:
  1. `calculateProjections` PV loop: `FUTURE_ONE_TIME` excluded from salary-funded `presentValueOfExpenses` (they are corpus-funded)
  2. `calculateProjections` bucket update: added `preRetOneTimeCost` loop over `FUTURE_ONE_TIME` expenses per year; subtracted from `existingBucket` in `!retirementMerged` branch; `totalNetExpenses` now = `preRetOneTimeCost` pre-retirement (was hardcoded 0)
  3. `simulateCorpusAtAge` `!merged` branch: same `preRetOneTimeCost` deduction so required-SIP binary search correctly accounts for lump-sum withdrawals
  4. `calculatePresentValueOfExpenses`: excluded `FUTURE_ONE_TIME` from "salary must cover" expenses banner PV

**Why:** User observed net worth growing through ₹2.18 Cr one-time purchase in 2035 (Home + Car). `totalNetExpenses = 0` for all pre-retirement rows — lump-sum corpus withdrawals were never deducted. Full audit logged in `C:\Dropbox\finpath\observation\audit101.md`.

**Expected outcome:** Net worth chart now dips visibly at 2035 (Home+Car) and 2046 (Car2). Required monthly SIP will increase. Expenses banner "salary must cover" number will decrease.

**Open:** Unit tests in `__tests__/calculator.test.ts` may need updating to reflect new pre-retirement corpus behaviour. Not yet run.

---

## 2026-04-16 — Tests: FUTURE_ONE_TIME pre-retirement corpus deduction

**Build:** none
**Commit:** `01d05b0`

**What changed:**
- `__tests__/calculator.test.ts` — new section 15 with 6 tests:
  1. Net worth dips in purchase year (not monotonic growth through lump-sum)
  2. `totalNetExpenses` == one-time cost in purchase year pre-retirement (was 0 before fix)
  3. `totalNetExpenses` == 0 when only `CURRENT_RECURRING` expenses (no regression)
  4. `FUTURE_ONE_TIME` excluded from salary-funded `presentValueOfExpenses`
  5. `requiredMonthlySIP` increases when large pre-ret one-time expense added
  6. `calculatePresentValueOfExpenses` (expenses banner) excludes `FUTURE_ONE_TIME`
- Fixed stale comment in existing test (said "not a corpus draw" — now it is)

**Result:** 58/58 tests pass.

---

## 2026-04-16 — Step 1: FUTURE_RECURRING corpus-funded pre-retirement + AAB v10

**Build:** `app-release-v10.aab` (versionCode 9, copied to `C:\dropbox\finpath\`)
**Commits:** `7a746bb` (logic + tests)

**What changed:**
- `engine/calculator.ts` — rule is now: CURRENT_RECURRING = salary-funded; ALL future expenses (FUTURE_ONE_TIME + FUTURE_RECURRING) = corpus-funded pre-retirement
  - PV loop: FUTURE_RECURRING dropped from salary-funded presentValueOfExpenses
  - Bucket deduction: `preRetFutureCost` covers all futureExpenses (removed FUTURE_ONE_TIME-only guard)
  - `simulateCorpusAtAge` !merged: same generalisation — required-SIP binary search accurate
  - `calculatePresentValueOfExpenses`: guard changed to `!== CURRENT_RECURRING`
- `__tests__/calculator.test.ts` — 60/60 pass; 2 new FUTURE_RECURRING tests; updated PV exclusion and banner tests to cover both types; fixed one test assertion (compare with/without fees rather than absolute dip)
- Graphify updated: 145 nodes, 161 edges, 32 communities

**Why:** School fees / new EMIs starting in future cannot reliably come from monthly salary — corpus withdrawal is the correct treatment, same as FUTURE_ONE_TIME.

---

## 2026-04-16 — versionCode bumped to 10, AAB rebuilt

**Build:** `app-release-v10.aab` (versionCode 10, release-signed)
**Commit:** android/ is gitignored — no commit needed for build.gradle change

**What changed:** versionCode 9 was already used; bumped to 10 in `android/app/build.gradle`, rebuilt AAB, copied to `C:\dropbox\finpath\app-release-v10.aab`.

---

## 2026-04-16 — Bug fix: existingBucket overflow spills into sipBucket + AAB v11

**Build:** `app-release-v11.aab` (versionCode 11)
**Commit:** `453f84f`

**Bug:** When a large pre-retirement purchase (e.g. ₹2.02 Cr house+car) exceeded existingBucket (~₹89L), existingBucket went negative and was silently clamped to 0 the next year — forgiving the debt and causing an artificial net worth jump (₹71L → ₹2.15 Cr in one year).

**Fix:** `calculateProjections` and `simulateCorpusAtAge` — when `grownExisting < 0`, set existingBucket = 0 and deduct the shortfall from sipBucket (liquidate investments to fund the gap). Net worth now stays consistently lower after large purchases.

**Test:** 61/61 pass. New test verifies gap between with-house and without-house corpus persists at yr+1 (> ₹80L), proving no debt forgiveness.

---

## 2026-04-16 — Precision fixes: partial-year growth + month-accurate inflation + AAB v12

**Build:** `app-release-v12.aab` (versionCode 12)
**Commit:** `e9f340b`

**Fix 1 — Existing assets partial-year growth (calculateProjections + simulateCorpusAtAge):**
Year-0 existing assets used full annual rate `(1+er)` even when only part of the year remains.
Now uses `(1+er)^(monthsThisYear/12)` — consistent with SIP which already used remaining-months logic.
Example: April start → 9/12 year growth on existing assets instead of full 12 months.

**Fix 2 — FUTURE_ONE_TIME month-accurate inflation (calculateExpenseForYear):**
Inflation used integer `yearsFromNow` only, ignoring purchase month.
Now uses `fractionalYears = yearsFromNow + (startMonth - currentMonth) / 12`.
Jan purchase inflates ~0.25yr less than Dec purchase in the same target year.

**Tests:** 61/61 pass (no test changes needed).

---

## 2026-04-18 — Add Expense modal UX polish

**Commit:** `fa06f1f`
**Build:** none (UI-only fix)

**What changed:**
- `app/(tabs)/expenses.tsx`: restructured Add/Edit Expense modal so Cancel+Save buttons are a sticky footer (outside the scroll area). Previously buttons were inside `KeyboardAwareScrollViewCompat` and got cut off on long forms.
- Category chips: added explicit `height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center'` to prevent vertical stretching in horizontal ScrollView.
- Sheet anchors to bottom of screen (`justifyContent: 'flex-end'` on overlay, `maxHeight: '92%'` on sheet, removed `marginTop: 80 + minHeight: 100%`).
- Thin top border separator above buttons, `paddingBottom` accounts for safe-area insets.

**Why:** Screenshot showed category tiles taller than needed (chips stretching vertically in horizontal ScrollView) and Cancel/Save buttons half-cut off at bottom of screen.


---

## 2026-04-18 — Self-use flag extended to Gold and Others

**Commit:** `2de9b69`
**Build:** none

**What changed:**
- `app/(tabs)/assets.tsx`: self-use checkbox (excluded from investable net worth) now appears for GOLD and OTHERS categories in addition to REAL_ESTATE.
- `investable` filter broadened from `!(category === 'REAL_ESTATE' && is_self_use)` to `!is_self_use` — any asset marked self-use is excluded regardless of category.

**Why:** User requested physical gold / other non-investable holdings to be excludable from investable net worth calculation.


---

## 2026-04-18 — Keyboard-aware modal fix (Assets + Expenses)

**Commit:** `0b15212`
**Build:** none

**What changed:**
- Both `app/(tabs)/assets.tsx` and `app/(tabs)/expenses.tsx` modals restructured for proper keyboard handling.
- Added `KeyboardAvoidingView` (from `react-native-keyboard-controller` v1.18.5) wrapping each sheet with `behavior="padding"`. This uses precise native keyboard frame data to push the sheet above the keyboard — more reliable than RN's built-in KAV.
- Added `style={{ flex: 1 }}` to `KeyboardAwareScrollViewCompat` in both modals — without this the scroll view sized to content with no scrollable space, so `KeyboardAwareScrollView`'s auto-scroll-to-focused-input had nothing to scroll.
- `maxHeight` changed from `85%`/`92%` to `100%` (relative to KAV, which already accounts for keyboard) — prevents sheet overflowing behind keyboard.
- `justifyContent: 'flex-end'` moved from overlay onto `kavWrapper` so KAV owns the bottom-anchoring.
- Assets: buttons moved out of scroll to sticky footer (matching expenses pattern from fa06f1f).
- Sheet header in expenses moved outside scroll — stays fixed while content scrolls.

**Why:** Keyboard was covering input fields; no scrolling was possible because scroll view had no constrained height.


---

## 2026-04-18 — AAB v24 build

**Build:** `app-release-v24.aab` (versionCode 24, versionName "1.0.2", release-signed)
**Location:** `C:\Dropbox\finpath\app-release-v24.aab` (112 MB)
**Commit:** `0b15212` (no source changes — build only)
**Build time:** 35s

**Changes since v20:** keyboard-aware modal fix (assets+expenses), self-use flag for Gold/Others, sticky buttons + compact category chips in Add Expense.


---

## 2026-04-18 — AAB v25 build

**Build:** `app-release-v25.aab` (versionCode 25, versionName "1.0.1", release-signed)
**Location:** `C:\Dropbox\finpath\app-release-v25.aab` (112 MB)
**Commit:** `0b15212` (no source changes — build only)
**Build time:** 11s


---

## 2026-04-18 — Fix form content invisible in Asset/Expense modals

**Commit:** `407bbec`
**Build:** none

**Root cause:** `sheet`/`modalSheet` had only `maxHeight: '100%'` (a cap, not a size). `flex: 1` on the `KeyboardAwareScrollView` inside it collapsed to zero height because its parent had no intrinsic height — only header + footer rendered.

**Fix:** Added `flex: 1` to both sheet styles. `flex: 1` fills the `KeyboardAvoidingView`'s available space, giving the scroll view a real height to flex into. `maxHeight: '85%'` caps the sheet so it doesn't go full-screen.

Layout now: KAV (flex:1, justifyContent:flex-end) → sheet (flex:1, maxHeight:85%) → [header | scroll(flex:1) | footer]


---

## 2026-04-20 — Remove withdrawal_rate field entirely (H5+H6) (commit b041567)

**Commit:** `b041567` | Branch: `beyondv33` | 70/70 tests pass.

- Removed `withdrawal_rate` from 7 files: engine/types.ts, db/queries.ts, context/AppContext.tsx, storage/legacyMigration.ts, app/(tabs)/dashboard.tsx, __tests__/__mocks__/queries.ts, __tests__/calculator.test.ts
- Field was stored in SQLite (migration v7) but never read by calculateProjections — dead field
- saveGoals now takes 7 params instead of 8
- Schema migration v7 column left as harmless dead data
2026-04-20 4886c33: fix(dashboard): add Retry button when calculateProjections throws (C3). retryKey state added; incremented on Retry tap to force useMemo re-eval; Review Plan button kept below Retry. No build.
2026-04-20 ba2455a: fix(index): route to /login on reinstall if @fire_onboarded=1 (C1). Added AsyncStorage check — SQLite=0 + sentinel='1' → /login so legacyMigration runs. No build.
2026-04-20 11d3cf0: fix(login,context): surface loadProfile + addAsset/addExpense errors (H2, H7). login.tsx: Alert on loadProfile failure + no navigation. AppContext: addAsset/addExpense return boolean; callers Alert on false. No build.
2026-04-20 e996989: fix(engine): null sentinel for expected_roi (M5). 0 now valid (zero-return asset). null → category default. 6 files. All 70 tests pass. No build.

## 2026-04-22 — SIP Financial Planner webapp built, audited, and deployed

**Build:** None (side project — ~/games/sip_planner.html, not finpath)
- deepseek-coder-v2:16b failed on 4-module SIP planner (9,315-char prompt → 1,338 token skeleton, finish=stop early)
- Claude wrote complete implementation: 4 tabs, Chart.js charts, expense management, Indian number format
- Deployed at http://192.168.0.130:8080/sip_planner.html (26KB)
- Post-deploy audit found and fixed 2 bugs: (1) mkDs hex color not converted to rgba — fills showed solid; (2) Tab 3 missing stacked:true on y-axis
- Financial formulas verified: SIP annuity-due, month-by-month step-up, lumpsum+SIP combined corpus, year-end expense deduction
- LLManalysis.md updated: Workflow 13 (single-file webapp) added with complexity ceiling finding and routing table

## 2026-04-22 — Qwen3.5:9b webapp benchmark: 6-stage atomic generation + audit

**Build:** None (side project — ~/games/sip_planner_qwen.html)
- 6 atomic stages (<2k char prompts), think:false, all finish=stop — no complexity ceiling
- Total: ~8,722 tokens · 704s
- Stages correct: CSS, JS helpers, SIP+Stepup calcs (3/6)
- Bugs found+fixed: HTML truncation (Tab 4 missing), g().value double-dereference, if-without-parens syntax error, JSON.stringify for string literals
- Served at http://192.168.0.130:8080/sip_planner_qwen.html
- LLManalysis.md: Qwen3.5 benchmark table + Q1-Q4 failure patterns added

## 2026-04-22 — Qwen3.5 v2: 9-stage refined generation

- Split HTML into 4 × single-tab stages → no truncation (Q1 fixed)
- System prompt rules → Q2 (g().value) and Q3 (if parens) fixed
- Remaining: Q4 partial (field values vs strings), Q5 (missing let), Q6 (cross-stage redeclaration)
- After 3 targeted line patches → fully working webapp at /games/sip_planner_qwen2.html
- LLManalysis.md: v2 benchmark table + Q5/Q6 new patterns + refined routing added

## 2026-04-24 — CLAUDE.md path migration
- Updated all `~/finpath/` paths → `~/dev/apps/finpath/` in CLAUDE.md
- Removed `ssh parasjain@192.168.0.130 ...` wrappers from all build/git commands
- Updated session start protocol, post-change protocol, docs table, graphify section, rules summary
- Logs/status now point to `~/dev/apps/finpath/kb/` instead of Windows Dropbox paths
- CLAUDE.md is gitignored — no commit; copied to Mac via scp
- Transfer folder created at `~/dev/apps/finpath/transfer/` with all Windows context MDs
