# FinPath — Remaining Tasks
**Branch:** `beyondv33` | **Last updated:** 2026-04-20 | **Latest commit:** `9d23585`

> Source of truth for what is done and what is pending. Based on `AUDIT_BEYONDV33.md`.
> All code lives on Mac Mini at `~/finpath/`. Edit via SSH: `parasjain@192.168.0.130`.
> After every change: `git commit` → `git push` → append to `kb/session_logs.md` + `C:\dropbox\claude\projects\finpath\logs.md` → update `status.md`.

---

## CRITICAL

### ✅ C2 — Remove genId() alphanumeric IDs (commit `a73afc6`)
Removed `genId()` from `assets.tsx` and `expenses.tsx`. New assets/expenses use `id: ''`; AppContext overwrites with SQLite-assigned numeric ID after insert.

### ✅ C4 — UTC date bug in date string parsing (commit `eaa2754`)
`new Date(exp.end_date)` / `new Date(exp.start_date)` in `calculator.ts:640-641` replaced with `parseDateStr()`. All other date parsing (`getAge`, vesting, create-profile DOB) was already correct.

### ✅ C6 — Dual storage crisis: SQLite as sole source of truth (commits `15c8312`, `13ce523`, `dc44776`, `582101d`, `9f6e198`)
Full 4-batch migration:
- **Batch 1** (`15c8312`, `13ce523`): `storage/legacyMigration.ts` — one-time AsyncStorage→SQLite migration with sentinel key `@finpath_sqlite_migrated_v1`
- **Batch 2** (`dc44776`): `context/AppContext.tsx` — full rewrite; removed all AsyncStorage dual-writes; added `loadProfile(profileId)` to read from SQLite into state
- **Batch 3** (`582101d`): `app/login.tsx` — replaced `syncToAppContext` with `loadProfile`; wired `runLegacyMigration()` on mount
- **Batch 4** (`9f6e198`): `app/(tabs)/profile.tsx` — fixed `importAll` null guard and profileId extraction

### ✅ C1 — index.tsx routes to onboarding when SQLite=0 even after reinstall (commit `ba2455a`)
Added `AsyncStorage.getItem('@fire_onboarded')` check after `getAllProfiles()` returns 0. Routes to `/login` if sentinel is `'1'` (legacyMigration runs there); routes to `/onboarding/create-profile` otherwise.

### ✅ C3 — Dashboard stuck on "Calculating..." when calculateProjections throws (commit `4886c33`)
Added `retryKey` state (incremented on Retry tap) to `useMemo` dep array. Error card shown when `result === null && isLoaded && goals !== null`. "Retry" + "Review Plan" buttons visible.

### ✅ C5 — Orphaned profile on SecureStore failure in createProfile (already correct in code)
`db/queries.ts:createProfile()` already wraps `saveProfilePin()` in try/catch; on failure, deletes the just-inserted profile row and re-throws. No action needed.

---

## HIGH

### ✅ H3 — FIRE_TARGET_AGES naming: slim → lean (already correct in code)
`FIRE_TARGET_AGES` already has `lean: 85`. Migration v9 normalizes `slim→lean` in stored goals. `goals.tsx` uses `lean` as chip key. No action needed.

### ✅ H4 — DOB validation UTC bug in create-profile.tsx (already correct)
`create-profile.tsx:114` already uses `new Date(y, m - 1, day)`. No action needed.

### ✅ H5 + H6 — withdrawal_rate dead field removed (commit `b041567`)
Removed from `engine/types.ts`, `db/queries.ts`, `context/AppContext.tsx`, `storage/legacyMigration.ts`, `app/(tabs)/dashboard.tsx`, `__tests__/__mocks__/queries.ts`, `__tests__/calculator.test.ts`. Schema migration v7 column left as harmless dead data (SQLite cannot DROP COLUMN).

### ✅ H1 — Login loadProfiles stale closure (already correct in code)
`app/login.tsx:43` already uses `autoSelectedRef = useRef(false)` to guard the auto-select. Empty dep array is correct. No action needed.

### ✅ H2 — loadProfile errors silently swallowed on login (commit `11d3cf0`)
Both `triggerBiometric` and `handleLogin` now show `Alert.alert('Load failed', ...)` on catch and do not navigate.

### ✅ H7 — addAsset / addExpense errors silently swallowed (commit `11d3cf0`)
`addAsset`/`addExpense` return `Promise<boolean>`. Callers in `assets.tsx` and `expenses.tsx` show `Alert.alert('Save failed', ...)` on false and skip haptic/modal-close.

---

## MEDIUM

### ✅ M1 — Inline currentAge in dashboard (already correct)
`dashboard.tsx:174` already uses `getAge(currentProfile.dob)`. No action needed.

### ✅ M3 — sipAmount hardcoded seed 10000 (commit `5975eff`)
Both `useState(10000)` instances changed to `useState(0)`. Auto-set fires when result first computes.

### ✅ M4 — Tab label "Goal" → "Goals" (commit `9c4d6f4`)
`tabBarAccessibilityLabel` fixed. `title: 'Goals'` was already correct.

### ✅ M6 — Financial disclaimer missing (commit `2455a20`)
One-time disclaimer modal added to Dashboard on first load.

### ✅ M5 — expected_roi = 0 treated as "not set" in asset growth calc (commit `e996989`)
Sentinel changed from `0` to `null`. `expected_roi?: number | null` in types. `computeBlendedGrowthRate` checks `== null`. DB writes pass `null` instead of `?? 0`. All 70 tests pass.

### ✅ M7 — Hardcoded paddingTop: 60 in login.tsx (commit `9d23585`)
Replaced `paddingTop: 60` with `insets.top + 16` via `useSafeAreaInsets`. Style moved to inline on ScrollView.

### ✅ M8 — Only INR/USD in currency selector (commit `9d23585`)
Replaced `SegmentedButtons` with TouchableOpacity chip row in both `create-profile.tsx` and `edit-profile.tsx`. All 8 currencies exposed: INR, USD, EUR, GBP, AUD, CAD, SGD, AED. Income affix symbol now uses chip lookup.

### ✅ M9 — No PIN recovery flow (commit `9d23585`)
Added "Forgot PIN?" link below biometric button in `login.tsx`. Tapping shows a destructive Alert warning about data deletion, then calls `deleteProfile(profile.id)` and resets login state.

---

## LOW / DEAD CODE

### ❌ L1 — `fire_corpus` column in `goals` table never written or read
**File:** `db/schema.ts`
Dead column. SQLite cannot `DROP COLUMN` below v3.35. Leave as-is or add a migration to a new schema version (complex for low value). Low priority.

### ❌ L2 — `inflation_defaults` table never queried anywhere
**File:** `db/schema.ts`
Created and seeded but never used. Same SQLite caveat — cannot drop table without full schema recreation. Low priority.

### ❌ L3 — `is_income` column in `expenses` table never used
**File:** `db/schema.ts`
Dead column. Same as L1.

### ✅ L4 — `FREQUENCY_TO_MONTHS_PER_PAYMENT` exported but never imported (false positive)
Actually IS imported and used in `app/(tabs)/expenses.tsx:8,78`. Audit was stale. No action needed.

### ❌ L5 — `useColors` always returns light theme
**File:** `hooks/useColors.ts`
Single-line implementation, no dark mode. Leave until dark mode is scoped.

### ❌ L6 — Sentry DSN not configured — crash reporting inactive
**File:** `app/_layout.tsx`, `.env` (missing)
Set `EXPO_PUBLIC_SENTRY_DSN` in `.env` file on Mac. Sentry project must be created first.

### ❌ L7 — 50+ hardcoded color hex values not using theme system
Multiple screens use raw hex values (`#1B5E20`, `#C8E6C9`, etc.) instead of `useColors()` / `constants/colors.ts`. Low priority — cosmetic.

### ❌ L8 — `withReleaseSigning.js` step-3 regex broken (requires manual sed after every prebuild)
**File:** `plugins/withReleaseSigning.js`
Workaround documented in `CLAUDE.md`. Fix the regex so `expo prebuild --clean` auto-applies signing config.

### ❌ L9 — versionCode not auto-synced from app.json after prebuild
**File:** `android/app/build.gradle`
Must be manually patched after every `expo prebuild --clean`. Low priority.

### ✅ L10 — `FIRE_TARGET_AGES` exported but no external consumer (false positive)
Actually IS used in `__tests__/calculator.test.ts` (lines 339, 340, 697, 700, 703, 711, 715). Audit was stale. No action needed.

---

## PLAY STORE BLOCKERS

| ID | Status | Task |
|----|--------|------|
| P1 | ❌ Open | Privacy policy URL must be publicly live: `https://aihomecloud.com/finpath/privacy` |
| P2 | ❌ Open | Create `finpath_pro` IAP product in Google Play Console as type `inapp` (non-subscription), price ₹199 / $4.99 |
| P3 | ❌ Open | Fix `versionCode` alignment: `app.json` vs `android/app/build.gradle` — currently requires manual patch after every prebuild |
| P4 | ❌ Open | Add Sentry DSN — crash reporting inactive in production |
| P5 | ✅ Done | Financial disclaimer added (commit `2455a20`) |
| P6 | ❌ Open | Store listing assets: screenshots (phone + 7-inch tablet), feature graphic (1024×500), short description (80 chars), full description |
| P7 | ❌ Open | "51% of profits to charity" claim — substantiate with evidence or soften to "we plan to donate 51% of profits" |
| P8 | ❌ Open | Physical device test not done since r3. Test full flow (login, assets, goals, dashboard, IAP, biometric) on a real Android device before submission |

---

## Summary

| Category | Done | Todo |
|----------|------|------|
| Critical | C1, C2, C3, C4, C5, C6 | — |
| High | H1, H2, H3, H4, H5, H6, H7 | — |
| Medium | M1, M3, M4, M5, M6, M7, M8, M9 | — |
| Low | L4, L10 | L1, L2, L3, L5, L6, L7, L8, L9 |
| Play Store | P5 | P1–P4, P6–P8 |

**Recommended fix order for next session:**
1. C1 — index.tsx routing fix (5 lines, high user impact on reinstall)
2. C5 — createProfile rollback (10 lines, prevents ghost profiles)
3. C3 — Dashboard error state + retry (20 lines, prevents stuck UI)
4. H1 — loadProfiles stale closure (2-line fix)
5. H2 + H7 — surface silent errors to user
6. M5 — null sentinel for expected_roi
