# FinPath — Fresh Codebase Audit
**Branch:** `beyondv33` | **Commit:** `ef622ae` | **versionCode:** 33 | **Date:** 2026-04-19

> This audit was produced by reading every source file directly via SSH. No stale docs were used as primary source. Where docs and code disagree, code is truth.

---

## What Was Fixed Before This Audit (Confirmed in Code)

| # | Fix | Where |
|---|-----|--------|
| F1 | `syncToAppContext` no longer overwrites AsyncStorage from SQLite when same profile is already loaded | `login.tsx:45–57` |
| F2 | `importAll` now writes assets/expenses/goals to SQLite with ID remapping | `AppContext.tsx:importAll` |
| F3 | `sha256()` now passes `Uint8Array` directly (Android bridge fix) | `storage/secure.ts:sha256` |
| F4 | Dead code deleted: `auth.ts`, `currency.ts`, `categories.ts`, `CorpusPrimer.tsx`, `session.ts`, `DepletionDialog.tsx`, `Replit/` | commit `d8880f9` |
| F5 | Dashboard shows CTA empty state when Goals not set | `dashboard.tsx:86–102` |
| F6 | `deleteAllData` properly cascades: `dbDeleteProfile` → `deleteProfilePin` → SQLite CASCADE | `AppContext.tsx:deleteAllData` |
| F7 | `totalNetExpenses` formula is correct: both `pensionIncome` and `plannedExpenses` are corpus outflows, summed and subtracted | `calculator.ts:~490` |
| F8 | `calculateProjections` errors are caught; returns `null` instead of crashing | `dashboard.tsx:useMemo` |
| F9 | Frequency aliases `ANNUAL`/`YEARLY` → `ANNUALLY` normalized in migrations v1→v2 | `storage/migrations.ts` |
| F10 | Error boundary wraps full app; Sentry integration present (disabled — no DSN) | `app/_layout.tsx` |

---

## Issue State Table

### CRITICAL — Must fix before any production release

| ID | File | Issue | Impact | Fix Direction |
|----|------|--------|--------|---------------|
| **C1** | `app/index.tsx:14` | Routes to onboarding when SQLite has 0 profiles — even if AsyncStorage has valid encrypted data. On SQLite wipe (reinstall, corruption), user is sent to onboarding and all data appears lost. AsyncStorage is the actual store but index.tsx never checks it. | **Data loss on reinstall** | Check AsyncStorage `@fire_onboarded` flag first; only route to onboarding if both SQLite=0 AND onboarded≠'1' |
| **C2** | `app/(tabs)/assets.tsx:genId()` | `genId()` still generates alphanumeric IDs (`Date.now() + random hex`). Pre-SQLite assets carry these IDs. When `updateAsset`/`deleteAsset` is called, `parseInt('1713456789abc', 10)` gives a truncated wrong number — SQLite update silently fails. AsyncStorage updates. Stores diverge permanently. | **Silent data corruption on old assets** | On login, detect non-numeric IDs and re-insert to SQLite to get canonical numeric IDs |
| **C3** | `app/(tabs)/dashboard.tsx:useMemo` | When `calculateProjections` throws, `result` = `null`. UI shows `"Calculating..."` forever with no error recovery or reset button. User is stuck. | **Permanent broken UI state** | Add explicit error state: show message + retry button when `result` is null after `isLoaded` is true |
| **C4** | `engine/calculator.ts:getAge()`, `calculateVestingForYear()` | `new Date(dob)` and `new Date(asset.next_vesting_date)` parse `YYYY-MM-DD` as UTC midnight. In IST (+5:30) this is 5h30m behind local midnight — near-birthday/near-vesting-date age calculations are off by 1 day. | **Wrong age → wrong SIP target** | Use `new Date(year, month-1, day)` for local time everywhere |
| **C5** | `db/queries.ts:createProfile()` | Profile row inserted into SQLite first. If `SecureStore.setItemAsync(pinKey, ...)` throws afterward, profile exists without a PIN. User sees the profile in the list but can never log into it. No rollback or cleanup. | **Permanent locked-out ghost profile** | Wrap both operations; on SecureStore failure, delete the just-inserted profile row |
| **C6** | `app/index.tsx` + `context/AppContext.tsx` | Dual-store architecture is still fundamentally present. SQLite and AsyncStorage (AES-encrypted) hold parallel copies of all user data. Mutations attempt both writes but SQLite failures are silently swallowed (`catch { console.warn }`). No atomic transaction covers both. Any single-write failure causes silent divergence with no user-visible error. | **Root cause of all data loss bugs** | Make SQLite sole source of truth; remove AsyncStorage blob layer for data (keep only for encryption key); load on login from SQLite directly |

---

### HIGH — Fix before public release

| ID | File | Issue | Impact | Fix Direction |
|----|------|--------|--------|---------------|
| **H1** | `app/login.tsx:loadProfiles` | `useCallback(async () => { ... !selectedProfile ... }, [])` — empty dependency array captures `selectedProfile` as `null` forever. `useFocusEffect` fires on every tab return. With 1 profile, `selectProfile()` re-triggers on every screen focus even if already selected. Resets PIN field, re-triggers biometric prompt. | **Annoying UX loop; re-prompts biometric** | Add `selectedProfile` to deps, or use a `ref` for the auto-select flag |
| **H2** | `app/login.tsx:handleLogin`, `triggerBiometric` | `try { await syncToAppContext(profile); } catch { /* non-critical */ }` — if sync fails (storage corrupted), user navigates to assets with empty data and no error. Failure is invisible. | **Silent empty-data login** | Log at minimum; consider showing a toast if sync fails |
| **H3** | `engine/calculator.ts:FIRE_TARGET_AGES` | Exported constant maps `slim: 85` but Goals UI uses `lean` as the chip key. Any consumer of `FIRE_TARGET_AGES['lean']` gets `undefined`. Also: SQLite may have old records with `slim` stored from before the rename — these are never normalized. | **API inconsistency; potential undefined lookup** | Rename `slim` → `lean` in `FIRE_TARGET_AGES`; add migration to normalize `slim` → `lean` in stored goals |
| **H4** | `app/onboarding/create-profile.tsx:validate()` | DOB validation uses `new Date(dob)` (UTC parse bug — same as C4). `new Date('1995-05-15') > new Date()` evaluates against UTC, not local time. Edge case near today's date. | **Wrong validation on today's date** | Use `new Date(y, m-1, d)` for local-time validation |
| **H5** | `app/(tabs)/goals.tsx:form state` | `form` state type does not include `withdrawal_rate`. When `setGoals(form)` is called, the Goals object persisted to AsyncStorage has no `withdrawal_rate`. SQLite `saveGoals` defaults it to `5.0`. The two stores hold different Goals objects. | **AsyncStorage/SQLite Goals mismatch** | Add `withdrawal_rate` to goals form state with default 5.0 |
| **H6** | `engine/calculator.ts` + `app/(tabs)/goals.tsx` | `withdrawal_rate` is stored in SQLite (migration 7), present in engine `Goals` type as optional, passed to `saveGoals`, but **never read anywhere in `calculateProjections`**. The field is completely dead — stored but ignored. | **Dead field; user confusion if labelled** | Either wire it into the SWR calculation or remove it entirely |
| **H7** | `context/AppContext.tsx:addAsset/addExpense` | If SQLite `dbCreateAsset` succeeds (returns `sqliteId`) but the returned ID is used to update `assetsRef`, but if it fails, the fallback `mutateAssets(prev => [...prev, a])` uses the original `a.id` which may be a `genId()` string. Future updates on this asset will fail SQLite writes silently. | **Orphaned AsyncStorage-only asset** | Require SQLite write to succeed; surface error to user if it fails |

---

### MEDIUM — Fix before v1.1

| ID | File | Issue | Impact | Fix Direction |
|----|------|--------|--------|---------------|
| **M1** | `app/(tabs)/dashboard.tsx:~130` | `currentAge` computed inline with duplicated DOB logic instead of calling `getAge()` from calculator. Same UTC date bug (C4). Two sources of truth for age. | **Drift risk** | Replace with `getAge(currentProfile.dob)` |
| ~~**M2**~~ | `app/login.tsx:privacyLink` | ~~URL mismatch with master prompt~~ | ✅ **Not a bug** — `https://aihomecloud.com/finpath/privacy` is live, used consistently in Play Store listing and Profile screen. Master prompt had wrong reference URL. | — |
| **M3** | `app/(tabs)/dashboard.tsx` | `sipAmount` seeded at hardcoded `10000`. Auto-set fires when `result` first computes, but there's a visible flash of `₹10,000/month` before the correct SIP value appears. | **UX flash** | Seed to 0 or use `null` sentinel; show skeleton until result ready |
| **M4** | `app/(tabs)/_layout.tsx` | Tab label is `'Goal'` (singular). All other screens use plural or full noun. Should be `'Goals'`. | **Typo/UX** | Change to `'Goals'` |
| **M5** | `engine/calculator.ts:computeBlendedGrowthRate` | `expected_roi = 0` is treated as "not set" and falls back to category default. User cannot explicitly set 0% ROI (e.g., cash pile). The comment in code even acknowledges this contradiction ("0 means not set — fall back"). | **Cannot model zero-return assets** | Use `null`/`undefined` to mean "not set"; treat `0` as explicit zero |
| **M6** | `app/(tabs)/dashboard.tsx`, `app/(tabs)/goals.tsx` | No financial disclaimer anywhere. Finance apps on Play Store typically require a disclaimer that the app does not constitute regulated financial advice. | **Play Store risk** | Add disclaimer card on Dashboard and Goals screens |
| **M7** | `app/login.tsx` | `paddingTop: 60` hardcoded. Uses no `useSafeAreaInsets`. On devices with dynamic island or notch, content may be clipped. | **Display clipping on some devices** | Use `useSafeAreaInsets().top` |
| **M8** | All onboarding/profile screens | Only INR and USD offered in currency selector, but `calculator.ts:CURRENCY_META` supports EUR, GBP, AUD, CAD, SGD, AED. User cannot choose other currencies. | **Incomplete feature** | Either expose all currencies or document INR/USD-only scope |
| **M9** | — | No PIN recovery flow. Forgotten PIN = permanent lockout for that profile (only recourse is delete account). | **User experience blocker** | Consider backup-code or "delete profile" escape hatch from login screen |

---

### LOW / Dead Code / Polish

| ID | File | Issue |
|----|------|--------|
| **L1** | `db/schema.ts` | `fire_corpus REAL` column in `goals` table — created but never written by `saveGoals`, never read anywhere. Dead column. |
| **L2** | `db/schema.ts` | `inflation_defaults` table — created and seeded with defaults, but never queried anywhere in the codebase. Dead table. |
| **L3** | `db/schema.ts` | `is_income INTEGER DEFAULT 0` column in `expenses` table — in schema, never used in queries or types. Dead column. |
| **L4** | `engine/types.ts` | `FREQUENCY_TO_MONTHS_PER_PAYMENT` exported but never imported anywhere in the codebase. Dead export. |
| **L5** | `hooks/useColors.ts` | Always returns `colors.light`. No dark mode. Single line implementation. |
| **L6** | `app/_layout.tsx` | Sentry `enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN` — DSN not set, crash reporting fully inactive in production. |
| **L7** | Multiple screens | ~50+ hardcoded color hex values (`#1B5E20`, `#C8E6C9`, etc.) not using `useColors()` or `constants/colors.ts`. |
| **L8** | `plugins/withReleaseSigning.js` | Step-3 regex is broken — requires manual `sed` patch after every `expo prebuild --clean`. |
| **L9** | `android/app/build.gradle` | `versionCode` not auto-synced from `app.json` — must be manually patched after prebuild. |
| **L10** | `engine/calculator.ts` | `FIRE_TARGET_AGES` is exported but not used internally. Only consumers would be outside the file. Currently no external consumer found. |
| **L11** | `app/(tabs)/goals.tsx` | `PRESET_AGE` maps `lean/moderate/fat` but `FIRE_TARGET_AGES` in calculator maps `slim/moderate/fat`. Naming divergence. |

---

### Play Store Blockers

| ID | Status | Item |
|----|--------|------|
| **P1** | ❌ Open | Privacy policy URL must be publicly live before submission |
| **P2** | ❌ Open | `finpath_pro` IAP product must be created in Play Console as `inapp` (non-subscription) |
| **P3** | ❌ Open | `versionCode` in `build.gradle` must match `app.json` — currently requires manual patch after every prebuild |
| **P4** | ❌ Open | Sentry DSN not configured — crash reporting inactive in production release |
| **P5** | ❌ Open | Financial disclaimer missing on Dashboard and Goals |
| **P6** | ❌ Open | Store listing assets not created: screenshots, feature graphic, short/long description |
| **P7** | ❌ Open | "51% of profits to charity" claim must be substantiated or softened before public listing |
| **P8** | ❌ Open | Physical device test not done since r3; all builds after that are emulator-only |

---

## Priority Action Plan

### Phase 1 — Pre-release blockers (fix in order)

1. **C4** — UTC date bug in `getAge()` and vesting. All age math is wrong near birthdays. One-line fix each.
2. **C5** — Orphaned profile on SecureStore failure. Add rollback to `createProfile`.
3. **C3** — Dashboard stuck on "Calculating..." on error. Add error state with retry.
4. **H1** — Login `loadProfiles` stale closure. Add `selectedProfile` to deps or use ref.
5. **H3** — Rename `slim` → `lean` in `FIRE_TARGET_AGES`; add goals normalization migration.
6. **M4** — Tab label "Goal" → "Goals".
7. ~~**M2**~~ — Privacy URL is correct and live (closed).
8. **M6** — Add financial disclaimer on Dashboard and Goals.

### Phase 2 — Stability (before v1.1)

9. **C2** — Old alphanumeric asset IDs. On login, detect and re-insert to SQLite.
10. **H5 + H6** — `withdrawal_rate`: add to form state OR remove the field entirely (it's unused in calculations).
11. **H2** — `syncToAppContext` errors: surface to user minimally.
12. **M1** — Replace inline age calc in dashboard with `getAge()`.
13. **M3** — Remove hardcoded `sipAmount` seed.
14. **M5** — Allow explicit `0` ROI by using `null` as "not set" sentinel.

### Phase 3 — Architecture (before v2.0)

15. **C6 (C1)** — Full dual-store resolution: SQLite as sole source of truth. Remove AsyncStorage data blobs. This is the most impactful architectural change and eliminates C1, C2, H2, H5, H7 at once.
16. **L1/L2/L3/L4** — Remove dead schema columns and unused exports.
17. **M7/M8/M9** — Safe area insets, more currencies, PIN recovery.

---

## Code Health Summary

| Layer | Health | Notes |
|-------|--------|-------|
| Calculator engine | ✅ Good | Pure, well-tested (70/70), correctly handles two-bucket model. One UTC date bug (C4). |
| Storage layer (secure.ts) | ✅ Good | AES-256-CBC + HMAC-SHA256, constant-time compare, single-flight key init. Solid. |
| Migration system | ✅ Good | Versioned, idempotent, defensive. Only 2 versions so far. |
| Schema (SQLite) | ⚠ OK | Functional with migration system. 3 dead columns (L1/L2/L3). |
| AppContext | ⚠ Fragile | Dual-write pattern with silent failure swallowing. Core architectural debt. |
| Login flow | ⚠ Fragile | Stale closure bug (H1), silent sync failure (H2), orphaned profile risk (C5). |
| Dashboard | ✅ Good | Clean component decomposition. Error handling partial (C3). |
| Goals screen | ⚠ OK | Missing `withdrawal_rate` in form (H5); FIRE type naming drift (H3). |
| IAP (usePro) | ✅ Good | Correct listener pattern, SecureStore persistence, restore on init. |
| Build pipeline | ⚠ Manual | Two manual patches required after every prebuild --clean (signing, versionCode). |
