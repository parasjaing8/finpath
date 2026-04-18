# FinPath Deep Audit — 19 April 2026

> Comprehensive code audit across all source files. Use as a transformation handbook to reach Apple-quality polish.
> Branch: `audit19April` | Base: `beyond24pro` @ `1910e07`

---

## Table of Contents

1. [Architecture — Dual Storage Crisis](#1-architecture--dual-storage-crisis)
2. [Critical Bugs](#2-critical-bugs)
3. [High-Severity Bugs](#3-high-severity-bugs)
4. [Security Issues](#4-security-issues)
5. [Data Integrity & Migration Risks](#5-data-integrity--migration-risks)
6. [Form Validation Gaps](#6-form-validation-gaps)
7. [UX & Navigation Issues](#7-ux--navigation-issues)
8. [Performance Bottlenecks](#8-performance-bottlenecks)
9. [Dead Code & Redundancy](#9-dead-code--redundancy)
10. [Theme & Style Consistency](#10-theme--style-consistency)
11. [Accessibility Gaps](#11-accessibility-gaps)
12. [Test Coverage Gaps](#12-test-coverage-gaps)
13. [Config & Dependency Issues](#13-config--dependency-issues)
14. [Polish — Apple-Quality Gaps](#14-polish--apple-quality-gaps)
15. [Action Plan (Priority Order)](#15-action-plan-priority-order)

---

## 1. Architecture — Dual Storage Crisis

**SEVERITY: 🔴 CRITICAL — Must fix before next production release**

The app has two parallel storage layers that are not synchronized:

| Layer | Stores | Used by |
|-------|--------|---------|
| **AsyncStorage** (encrypted via `secure.ts`) | Profile, Assets[], Expenses[], Goals as JSON blobs | `AppContext.tsx` — all reads on app launch |
| **SQLite** (`db/schema.ts` + `db/queries.ts`) | Normalized rows in profiles, assets, expenses, goals tables | `login.tsx` — auth + sync; mutations in AppContext |

### The Problem

- **App reads from AsyncStorage** on launch (lines 107–130 in `AppContext.tsx`)
- **Mutations write to BOTH** AsyncStorage and SQLite (lines 228–346 in `AppContext.tsx`)
- **Login reads from SQLite** and overwrites AppContext (`syncToAppContext` in `login.tsx`)
- **No atomic transactions** — if one write succeeds and the other fails, data diverges permanently

### Divergence Scenarios

| Scenario | Result |
|----------|--------|
| SQLite insert fails, AsyncStorage succeeds | Asset in blob but not in SQLite. `getAssets()` returns nothing. SQLite-based queries wrong. |
| AsyncStorage fails, SQLite succeeds | Asset in SQLite but not in blob. Next load from blob = asset missing. |
| `deleteAllData` — SQLite delete fails (caught) | Zombie profiles remain in SQLite; AsyncStorage cleared. Next launch sees profiles in SQLite, routes to login. |
| Decrypt fails (corrupt blob) | `secureGetItem` returns `{value: null, source: 'missing'}`. Data silently lost. |

### Recommended Fix

**Choose ONE source of truth.** Options:
- **Option A (recommended):** Make SQLite the sole source of truth. Remove AsyncStorage blob layer for data. Keep encryption at the SQLite column level or via SQLCipher. `AppContext` reads from SQLite, writes to SQLite.
- **Option B:** Keep AsyncStorage blobs as source of truth. Remove SQLite writes from mutations. Use SQLite only for auth/PIN.
- **Option C:** Wrap both writes in a transaction mechanism with rollback on partial failure.

---

## 2. Critical Bugs

### C1. `totalNetExpenses` formula wrong post-retirement
**File:** `engine/calculator.ts:579`
```ts
const totalNetExpenses = age >= retirementAge ? (pensionIncome + plannedExpenses) : preRetFutureCost;
```
Pension is **income**, not expense. Adding it to expenses inflates the field. Should be `plannedExpenses - pensionIncome` (net withdrawal from corpus). Same issue on `totalOutflow` at line 604. Display-only (core math not affected), but dashboard shows wrong numbers.

### C2. Dashboard infinite "Calculating..." state
**File:** `app/(tabs)/dashboard.tsx:72–81`
If `calculateProjections` throws, `result` stays null and the user sees "Calculating..." forever. No error boundary, no retry button.

### C3. State-Storage Divergence on Mutations
**File:** `context/AppContext.tsx:189–195`
`setProfile/setAssets/setExpenses/setGoals` update React state synchronously BEFORE awaiting `secureSetItem()`. If encryption fails, in-memory state differs from persisted state. Next app launch loses the update.

### C4. ID becomes `'null'` on SQLite failure
**File:** `context/AppContext.tsx:248`
If SQLite `lastInsertRowId` returns null/undefined, `String(null)` = `'null'`. Asset stored with id=`'null'`. Later `parseInt('null')` = `NaN`. Update/delete fail silently.

### C5. `deleteAllData` doesn't flush SecureStore PINs
**File:** `context/AppContext.tsx:384–400`
Deletes profiles from SQLite (CASCADE), clears AsyncStorage, but does NOT clear `finpath_pin_*` keys from SecureStore. Dead PINs remain. If SQLite delete partially fails (caught), zombie profiles persist.

---

## 3. High-Severity Bugs

### H1. Unsafe date parsing in vesting logic
**File:** `engine/calculator.ts:212–213`
No validation on `next_vesting_date`. Malformed string → `getFullYear()` returns `NaN` → SIP binary search breaks silently.
**Fix:** `if (!asset.next_vesting_date || isNaN(new Date(asset.next_vesting_date).getTime())) continue;`

### H2. Login dependency array stale closure
**File:** `app/login.tsx:95–106`
`loadProfiles` callback doesn't include `selectedProfile` in deps but references it via `selectProfile(all[0])`. Stale closure on subsequent profile reloads.

### H3. `syncToAppContext` failure swallowed silently
**File:** `app/login.tsx:186–188`
Wrapped in try-catch with comment `/* non-critical */`. If it fails, dashboard runs on stale/empty data. Should log to Sentry and show warning.

### H4. Orphaned profiles on PIN save failure
**File:** `db/queries.ts:174–176`
`createProfile` inserts into SQLite, then calls `saveProfilePin(profileId, hashedPin)`. If SecureStore fails, profile exists without a PIN. Auth always fails for that profile.

### H5. Lockout timer interval leak
**File:** `app/login.tsx:156`
Lockout countdown interval cleans up on `lockoutSeconds` change but not on component unmount.

### H6. Biometric errors not handled
**File:** `db/queries.ts:160–162`
`setBiometricEnabled` calls `deleteItemAsync` without try-catch. Failure leaves inconsistent state.

---

## 4. Security Issues

### S1. `as any` casts bypass type safety (MEDIUM)
**Files:** `context/AppContext.tsx` lines 228, 235–236, 245, 275, 281–282, 312, 318–319, 330–331
Fields like `currency`, `gold_silver_unit`, `gold_silver_quantity` cast to `any`. Hides schema mismatches, could allow undefined values to persist.

### S2. No input validation on mutations (MEDIUM)
**Files:** `context/AppContext.tsx:330–331`, `db/queries.ts:86–91`
Currency, amounts, dates accepted without validation. Malformed data corrupts calculations.

### S3. Corrupt encrypted data = silent data loss (MEDIUM)
**File:** `storage/secure.ts:307–309`
If decrypt fails, returns `{value: null, source: 'missing'}`. User loses data without knowing. Should alert user and offer restore from backup.

### S4. Non-standard key derivation (LOW)
**File:** `storage/secure.ts:100–115`
Uses SHA256 with domain labels instead of PBKDF2/scrypt. Acceptable for random keys but deviates from crypto best practices.

### S5. Backup import validation too shallow (MEDIUM)
**File:** `app/(tabs)/profile.tsx:251`
Only checks `parsed.version` type and `parsed.profile` presence. Doesn't validate structure of assets/expenses arrays. Malformed backup could crash `importAll`.

### S6. `syncToAppContext` error not logged to Sentry (LOW)
**File:** `app/login.tsx:188`
No audit trail for failed syncs. Should `Sentry.captureException(e)`.

---

## 5. Data Integrity & Migration Risks

### M1. Two migration systems, not coordinated
- `AppContext` runs `runMigrations()` on AsyncStorage blobs (from `storage/migrations.ts`)
- `schema.ts` runs `ALTER TABLE` migrations on SQLite
- No validation that both are at same version. A user could have v2 AsyncStorage + v1 SQLite.

### M2. Silent migration failure in schema.ts
**File:** `db/schema.ts:139–153`
If ALTER TABLE fails, error is caught. Migration not recorded in `schema_version`. Next launch re-attempts indefinitely.

### M3. `inflation_defaults` table possibly dead
**File:** `db/schema.ts:107–113`
Created with seed data but appears never queried. Verify with `grep -r "inflation_defaults" .` If unused, remove.

### M4. Legacy `pin TEXT` column in profiles
**File:** `db/schema.ts:58`
PINs migrated to SecureStore. Column unused. Kept for backward compat but clutters schema.

---

## 6. Form Validation Gaps

| Screen | Validates | Missing |
|--------|-----------|---------|
| **Assets** (assets.tsx:95) | Name non-empty, value > 0 | ROI range (0–100%), max value cap, specific error messages |
| **Expenses** (expenses.tsx:99) | Name non-empty, amount > 0 | `inflation_rate > 0`, `start_date <= end_date`, date format validation |
| **Goals** (goals.tsx) | None explicitly | `fire_target_age >= retirement_age`, `pension_income >= 0`, `inflation_rate > 0` |
| **Create Profile** (create-profile.tsx:100) | DOB thorough, PIN 6 digits | Income upper limit, validate on blur (not just submit) |
| **Edit Profile** (edit-profile.tsx) | Basic | Same as create-profile |
| **Import backup** (profile.tsx:251) | JSON parse, version field | Deep structure validation for assets/expenses/goals arrays |

### Calculator input validation (engine/calculator.ts)
Zero input validation on public functions. All assume valid data:
- No guard for `null` profile/assets/goals
- No guard for `NaN` amounts, negative retirement age, malformed dates
- `retirement_age > current_age` not checked
- `sip_stop_age <= retirement_age` not enforced

---

## 7. UX & Navigation Issues

### N1. Login always routes to Assets tab
**File:** `app/login.tsx:193`
`router.replace('/(tabs)/assets')` hardcoded. Should route to Dashboard if goals are set, or remember last-visited tab.

### N2. DB init failure sends user to onboarding silently
**File:** `app/index.tsx:26–31`
If `initializeDatabase()` fails, redirects to create-profile. User sees "Set up new profile" without knowing data may be corrupted. Should show error dialog with Retry.

### N3. Profile save feedback is weak
**File:** `app/(tabs)/profile.tsx:87`
Checkmark appears for 2 seconds then reverts. Hard to notice. Should use a persistent toast/snackbar.

### N4. Slider ranges too restrictive
**File:** `app/(tabs)/goals.tsx:95–101`
Retirement age range 35–70 is too narrow. Some users may want 25 or 80. Widen to at least 20–100.

### N5. No empty state for expenses
**File:** `app/(tabs)/expenses.tsx`
When no expenses exist, only summary cards show (with ₹0). No helpful empty state illustration or "Add your first expense" prompt like Assets has.

### N6. Date entry is manual text, not picker
**Files:** `expenses.tsx:160–167`, `create-profile.tsx`
Users type YYYY-MM-DD manually. Should use a native date picker. `create-profile.tsx` uses `DateInput` component, but `edit-profile.tsx` and expenses don't consistently.

### N7. Fire strategy auto-switch not explained
**File:** `app/(tabs)/goals.tsx:149–146`
When user adjusts target age slider away from a preset, Fire type silently switches to "Custom". No tooltip/feedback about what happened.

### N8. "Coming soon" features still shown in paywall
**File:** `components/ProPaywall.tsx:23`
Feature list shows "PDF report (coming soon)" and "Tips (coming soon)". Remove unshipped features or show a roadmap badge.

---

## 8. Performance Bottlenecks

### P1. Missing `useMemo` on computed values
| File | Line | Computation |
|------|------|-------------|
| `assets.tsx` | 73–74 | `totalNetWorth`, `investableNetWorth` — `.reduce()` on every render |
| `expenses.tsx` | 88–91 | `monthlyTotal` — `.reduce()` with frequency division on every render |
| `ProjectionTable.tsx` | 29 | `rows = projections.slice(...)` — re-sliced every render |

### P2. Missing `useCallback` on slider handlers
**File:** `components/SIPControls.tsx:28–38`
Slider callbacks created fresh on every parent re-render. Causes child Slider re-renders. Wrap in `useCallback`.

### P3. Missing `React.memo` on list items
**File:** `assets.tsx:154–185`, `expenses.tsx` similar
Asset/expense card components re-render even when data unchanged. Should extract to `React.memo` wrapped component.

### P4. `Dimensions.get()` called every render
**File:** `components/ProjectionChart.tsx:67`
`Dimensions.get('window').width` on every render instead of `onLayout` or `useWindowDimensions()`.

### P5. `validateDob` defined inside component
**File:** `app/(tabs)/profile.tsx:125–139`
Same function also in `create-profile.tsx`. Duplicated + re-created each render. Hoist to a utility.

### P6. `shadow()` calls `Platform.select()` every time
**File:** `constants/theme.ts:28–30`
Should memoize per-level. Pre-compute a static `SHADOW_STYLES` object.

---

## 9. Dead Code & Redundancy

### Dead Code

| Location | What | Action |
|----------|------|--------|
| `db/schema.ts:58` | `pin TEXT` column in profiles | Remove (PINs in SecureStore) |
| `db/schema.ts:107–113` | `inflation_defaults` table | Remove if never queried |
| `components/DateInput.tsx:9–10` | `maximumDate`, `minimumDate` props | Remove or implement |
| `storage/secure.ts:178–211` | Pure-JS base64 fallback | Remove (`atob`/`btoa` always available in RN) |
| `components/ProPaywall.tsx:23` | "Coming soon" features | Remove or flag |

### Redundancy

| Pattern | Locations | Fix |
|---------|-----------|-----|
| Dual-write try-SQLite-then-AsyncStorage | `AppContext.tsx` lines 228–248, 273–296, 298–307, 309–346 | Extract to helper function |
| `setProfile/setAssets/setExpenses/setGoals` near-identical | `AppContext.tsx` lines 189–195 | Factory function |
| Bucket merge logic duplicated | `calculator.ts:339–343` and `586–589` | Extract to helper |
| `validateDob` duplicated | `profile.tsx` and `create-profile.tsx` | Extract to `utils/validation.ts` |
| Hardcoded `#1B5E20` repeated 50+ times | ProjectionChart, InsightCard, ProPaywall, SIPControls, SnapshotTiles, HeroCard, login.tsx, dashboard.tsx, goals.tsx | Use `colors.primary` from theme |
| Modal overlay `rgba(0,0,0,0.4)` hardcoded | `assets.tsx:220`, `expenses.tsx:184` | Extract to `theme.ts` constant |

---

## 10. Theme & Style Consistency

**50+ hardcoded color instances** that should use the theme system in `constants/colors.ts`.

### Worst offenders

| File | Hardcoded Colors | Should Use |
|------|-----------------|------------|
| `ProjectionChart.tsx` | 15+ instances (#1B5E20, #C62828, #E65100, rgba values) | `colors.success`, `colors.destructive`, `colors.warning` |
| `login.tsx` | #1B5E20, #C8E6C9, #B71C1C, #999 | `colors.primary`, `colors.primaryContainer`, `colors.destructive` |
| `dashboard.tsx` | #333, #666, #E65100, #5E35B1 | `colors.foreground`, `colors.mutedForeground`, theme colors |
| `goals.tsx` | #E65100, #1B5E20, #5E35B1, #0277BD | Extract to `FIRE_TYPE_COLORS` constant |
| `HeroCard.tsx` | Gradient arrays hardcoded | Extract to `HERO_GRADIENTS` |
| `InsightCard.tsx` | TYPE_CONFIG with hardcoded colors | Map to theme colors |
| `SIPControls.tsx` | #1B5E20 repeated 5× for slider colors | `colors.primary` |
| `_layout.tsx` (root) | #1B5E20, #C8E6C9, #F5F5F5 | PaperProvider theme should source from `colors.ts` |
| `(tabs)/_layout.tsx` | Hardcoded tab bar colors | Theme-source |
| `SnapshotTiles.tsx` | #E8F5E9, #1B5E20, #EDE7F6, #5E35B1 | Theme variants |

### Recommendation
Create a `useThemeColor(name)` hook or extend `colors.ts` with all semantic tokens. Refactor all hardcoded hex values in one pass.

---

## 11. Accessibility Gaps

| Component | Issue | Fix |
|-----------|-------|-----|
| `ProjectionChart.tsx` | SVG chart has no accessibility labels, no screen-reader fallback | Add `accessibilityLabel` for chart, provide table fallback |
| `ProjectionTable.tsx:33` | Table headers lack `accessibilityRole="header"` | Add role |
| `HeroCard.tsx:43–58` | Status pills (✓, ✗, ⚠) not screen-reader friendly | Add `accessibilityLabel` per pill |
| `SIPControls.tsx:47` | Expanded advanced options not announced | Use `accessibilityLiveRegion="polite"` |
| `ProPaywall.tsx:62` | Modal backdrop is `TouchableOpacity` without `accessibilityRole` | Add `role="button"` with label |
| `SnapshotTiles.tsx` | Tile values not labeled for screen readers | Add `accessibilityLabel` per tile |
| All screens | Missing `testID` props | Add for E2E testing |
| `login.tsx:259` | PIN input label references possibly-null `selectedProfile` | Guard with fallback |

---

## 12. Test Coverage Gaps

### Coverage Summary

| Area | Coverage | Status |
|------|----------|--------|
| `calculateProjections` | ~90% | ✅ Excellent |
| `formatCurrency` / `formatCurrencyFull` | ~80% | ✅ Good |
| `calculateRequiredSIP` | ~85% | ✅ Good (indirect) |
| `calculateFutureGoalsCorpus` | **0%** | 🔴 CRITICAL GAP |
| `calculatePresentValueOfExpenses` | ~40% | ⚠️ Indirect only |
| `calculateVestingForYear` | ~50% | ⚠️ Partial |
| `getAge` | 0% | 🔴 Not tested |
| Invalid inputs | 0% | 🔴 No error case tests |
| Edge cases (NaN, negatives, extremes) | ~20% | ⚠️ Minimal |

### Missing Test Cases

- **Invalid inputs:** negative amounts, NaN, null profile, malformed dates
- **Boundary conditions:** `sip_stop_age < retirement_age`, `current_age > retirement_age`
- **Extreme values:** inflation 50%+, corpus ₹1000 Cr+, 200-year projections
- **Invalid frequency strings** passed to `getFrequencyMultiplier`
- **Negative pension income** (not guarded)
- **formatCurrency** with NaN, Infinity, extremely negative values
- **Currency not in CURRENCY_META** (fallback path)

### Magic Numbers in Engine (should be named constants)

| Line | Value | Purpose | Suggested Name |
|------|-------|---------|---------------|
| 551 | `100` | Max projection age | `MAX_PROJECTION_AGE` |
| 627 | `80` | Safety cap for future years | `MAX_FUTURE_YEARS` |
| 305 | `60` | Binary search iterations | `MAX_BINARY_SEARCH_ITERATIONS` |
| 310 | `10_000` | Convergence tolerance | `FIRE_CORPUS_TOLERANCE` |
| 434 | `5_000_000` | SIP upper bound floor | `MIN_MONTHLY_SIP_BOUND` |
| 447 | `8` | Bound-bracketing iterations | `MAX_BOUND_ITERATIONS` |
| dashboard.tsx:195 | `500` | SIP gap threshold | `SIP_GAP_THRESHOLD` |

---

## 13. Config & Dependency Issues

### Version Mismatches
- `app.json` version: `1.0.2` — `package.json` version: `1.0.0`. Must match.
- `app.json` versionCode: `28` — actual latest: `31`. `app.json` is stale (Gradle is canonical).

### Config Concerns
| File | Issue | Action |
|------|-------|--------|
| `eas.json:18` | Production build has `buildType: "apk"` instead of `"aab"` | Change to `"aab"` for Play Store |
| `app.json:10` | `newArchEnabled: true` | Verify New Architecture is actually used; if not, disable |
| `tsconfig.json:6` | `ignoreDeprecations: "6.0"` | Investigate + fix deprecations instead of silencing |
| `tsconfig.json:7–10` | `@/*` maps to root — too broad | Consider per-folder aliases |

### Dependency Concerns
| Package | Issue |
|---------|-------|
| `react: 19.1.0` | Very new major version. Verify all deps are React 19 compatible |
| `react-native-iap: ^14.7.20` | Caret allows breaking minor bumps. Use `~14.7.0` |
| `victory-native: ^41.20.2` | Large charting lib. Verify it's actually imported anywhere. If not, remove |
| `@shopify/react-native-skia: 2.2.12` | Large native lib. Verify usage. Remove if unused |
| `react-native-keyboard-controller` | May not be compatible with future RN versions. Pin version |

---

## 14. Polish — Apple-Quality Gaps

### Missing Gestures
- **Swipe-to-delete** on asset/expense cards (currently requires tap on trash icon)
- **Pull-to-refresh** on asset/expense lists and login profile list
- **Swipe back** navigation — supported by expo-router but not customized

### Missing Loading/Skeleton States
- Dashboard: "Calculating..." text instead of skeleton chart
- Import/Export: no loading indicator during file operations
- Profile save: 2-second checkmark instead of persistent toast

### Missing Animations & Transitions
- Modal entries: just appear, no slide-up animation
- Chart updates: bars don't animate on data change
- Number changes: no counter/tween animation
- Lockout countdown: number changes abruptly, no pulse/fade

### Missing Micro-interactions
- Slider drags: no live preview tooltip
- Form focus: no ring animation
- Button press: no scale-down feedback
- Empty → non-empty state: no entry animation

### Missing Features (Commercial Apps Have)
- **Undo toast** after delete (instead of irreversible Alert)
- **Share projection** as image/text from dashboard
- **Remember last tab** on app relaunch
- **Persist scroll position** on back navigation
- **Biometric "not available" explanation** (currently just hides toggle)
- **Tooltip/info icons** for complex concepts (SIP burden, FIRE corpus, discount rate)
- **Onboard tour** — first-time walkthrough of each screen

---

## 15. Action Plan (Priority Order)

### 🔴 P0 — Critical (Fix Before Next Release)

| # | Task | Files | Effort |
|---|------|-------|--------|
| 1 | **Resolve dual storage** — choose SQLite OR AsyncStorage as single source of truth | `AppContext.tsx`, `schema.ts`, `queries.ts`, `secure.ts` | Large |
| 2 | **Fix `totalNetExpenses` formula** — pension is income, not expense | `calculator.ts:579` | Small |
| 3 | **Fix dashboard infinite loading** — add error boundary/catch in projection calc | `dashboard.tsx:72–81` | Small |
| 4 | **Fix `deleteAllData` to clear SecureStore PINs** | `AppContext.tsx:384–400` | Small |
| 5 | **Guard against NaN IDs** — validate `lastInsertRowId` before `String()` | `AppContext.tsx:248` | Small |
| 6 | **Log `syncToAppContext` failures to Sentry** | `login.tsx:188` | Small |

### 🟠 P1 — High Priority (Next Sprint)

| # | Task | Files | Effort |
|---|------|-------|--------|
| 7 | **Add input validation to calculator public functions** | `calculator.ts` | Medium |
| 8 | **Fix form validation gaps** — ROI range, inflation > 0, date ordering | `assets.tsx`, `expenses.tsx`, `goals.tsx` | Medium |
| 9 | **Validate backup import deeply** | `profile.tsx:251` | Medium |
| 10 | **Fix date parsing safety** in vesting logic | `calculator.ts:212–213` | Small |
| 11 | **Fix login dependency array** stale closure | `login.tsx:95–106` | Small |
| 12 | **Fix lockout timer cleanup** on unmount | `login.tsx:156` | Small |
| 13 | **Unify migration systems** — single versioning for SQLite + blob | `schema.ts`, `migrations.ts` | Medium |
| 14 | **Fix version mismatches** — `package.json` → 1.0.2 | `package.json` | Small |

### 🟡 P2 — Medium Priority (Polish Sprint)

| # | Task | Files | Effort |
|---|------|-------|--------|
| 15 | **Theme all hardcoded colors** (50+ instances) | All component files | Large |
| 16 | **Add `useMemo`/`useCallback`** to computed values and handlers | `assets.tsx`, `expenses.tsx`, `SIPControls.tsx`, `ProjectionTable.tsx` | Medium |
| 17 | **Extract `React.memo` list items** for assets/expenses | `assets.tsx`, `expenses.tsx` | Medium |
| 18 | **Extract `validateDob`** to shared utility | `profile.tsx`, `create-profile.tsx` → `utils/validation.ts` | Small |
| 19 | **Remove dead code** — unused props, legacy base64 fallback, dead DB table | Various | Small |
| 20 | **Add empty state** for expenses screen | `expenses.tsx` | Small |
| 21 | **Login routes to Dashboard** when goals are set | `login.tsx:193` | Small |
| 22 | **Fix `eas.json`** production buildType to `"aab"` | `eas.json` | Small |
| 23 | **Extract magic numbers** to named constants | `calculator.ts` | Small |
| 24 | **Widen retirement age slider** to 20–100 | `goals.tsx:95` | Small |

### 🟢 P3 — Nice-to-Have (Quality Sprint)

| # | Task | Files | Effort |
|---|------|-------|--------|
| 25 | **Add accessibility labels** — chart, table, tiles, pills | Various components | Medium |
| 26 | **Add `testID` props** for E2E testing | All screens | Medium |
| 27 | **Add test coverage** for `calculateFutureGoalsCorpus`, `getAge`, edge cases | `__tests__/` | Medium |
| 28 | **Swipe-to-delete** on asset/expense cards | `assets.tsx`, `expenses.tsx` | Medium |
| 29 | **Skeleton loading screens** | `dashboard.tsx`, lists | Medium |
| 30 | **Modal slide-up animation** | `assets.tsx`, `expenses.tsx` | Small |
| 31 | **Undo toast** after delete (replace Alert) | All delete flows | Medium |
| 32 | **Date picker** instead of manual text input | `expenses.tsx` | Medium |
| 33 | **Remember last tab** on app relaunch | `login.tsx`, storage | Small |
| 34 | **Tooltips** for complex financial concepts | `dashboard.tsx`, `expenses.tsx` | Medium |
| 35 | **Remove/audit `victory-native` and `@shopify/react-native-skia`** | `package.json` | Small |
| 36 | **Remove `ProPaywall` coming-soon features** | `ProPaywall.tsx` | Small |

---

## Metrics Summary

| Category | Count |
|----------|-------|
| Critical Bugs | 5 |
| High-Severity Bugs | 6 |
| Security Issues | 6 |
| Data Integrity Risks | 4 |
| Form Validation Gaps | 15+ fields |
| UX / Navigation Issues | 8 |
| Performance Bottlenecks | 6 |
| Dead Code Items | 5 |
| Redundancy Patterns | 6 |
| Hardcoded Color Instances | 50+ |
| Accessibility Gaps | 8 |
| Test Coverage Gaps | 8 untested areas |
| Config Issues | 5 |
| Polish Items | 15+ |

**Overall Risk Level: 🔴 HIGH** — Dual storage architecture is the #1 risk. Data loss is possible on partial write failures. Fix this before any major feature work.
