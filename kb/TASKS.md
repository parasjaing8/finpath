# FinPath — Remaining Tasks
**Branch:** `beyondv33` | **Last updated:** 2026-04-20 | **Latest commit:** `eaa2754`

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

### ❌ C1 — index.tsx routes to onboarding when SQLite=0 even after reinstall
**File:** `app/index.tsx:14`
**Problem:** `getAllProfiles()` returns 0 rows on fresh install / after SQLite wipe → routes to `/onboarding/create-profile`. `legacyMigration` runs in `login.tsx` but user never reaches login. AsyncStorage data is lost on reinstall without ever being migrated.
**Fix:** In `index.tsx`, after `getAllProfiles()` returns 0, check `AsyncStorage.getItem('@fire_onboarded')`. If it returns `'1'`, route to `/login` (legacyMigration will run there). Only route to `/onboarding/create-profile` if both SQLite=0 AND `@fire_onboarded` is not `'1'`.
```typescript
// app/index.tsx — inside the useEffect async block
const profiles = await getAllProfiles();
if (profiles.length > 0) {
  setTarget('/login');
} else {
  const onboarded = await AsyncStorage.getItem('@fire_onboarded');
  setTarget(onboarded === '1' ? '/login' : '/onboarding/create-profile');
}
```
Add `import AsyncStorage from '@react-native-async-storage/async-storage';` to imports.

### ❌ C3 — Dashboard stuck on "Calculating..." when calculateProjections throws
**File:** `app/(tabs)/dashboard.tsx`
**Problem:** `result` is `null` when `calculateProjections` throws inside `useMemo`. UI shows `"Calculating..."` forever — no error state, no retry button.
**Fix:** Add a second state `const [calcError, setCalcError] = useState(false)`. In the `useMemo`, catch errors and set `calcError(true)`. Render an error card with a "Retry" button that calls `setCalcError(false)` (triggering re-compute) when `calcError` is true and `isLoaded` is true.
```typescript
// Replace the useMemo result check section in dashboard.tsx
const [calcError, setCalcError] = useState(false);
const result = useMemo(() => {
  try {
    setCalcError(false);
    // ... existing calculation
  } catch (e) {
    setCalcError(true);
    return null;
  }
}, [...]);

// In JSX, before the "Calculating..." check:
if (calcError) return (
  <View style={styles.center}>
    <Text>Something went wrong calculating your projections.</Text>
    <Button onPress={() => setCalcError(false)}>Retry</Button>
  </View>
);
```

### ❌ C5 — Orphaned profile on SecureStore failure in createProfile
**File:** `db/queries.ts:createProfile()`
**Problem:** Profile row is inserted into SQLite first. If `SecureStore.setItemAsync(pinKey, hashedPin)` throws afterward, profile exists in SQLite without a PIN. User sees it in the list but can never log in. No rollback.
**Fix:** Wrap both operations; on SecureStore failure, delete the just-inserted profile row.
```typescript
// db/queries.ts — createProfile function
const profileId = /* insert result */;
try {
  await SecureStore.setItemAsync(pinKey, hashedPin);
} catch (e) {
  // Rollback: delete the just-inserted profile
  await db.runAsync('DELETE FROM profiles WHERE id = ?', [profileId]);
  throw new Error('Failed to save PIN — profile creation rolled back');
}
return profileId;
```

---

## HIGH

### ✅ H3 — FIRE_TARGET_AGES naming: slim → lean (already correct in code)
`FIRE_TARGET_AGES` already has `lean: 85`. Migration v9 normalizes `slim→lean` in stored goals. `goals.tsx` uses `lean` as chip key. No action needed.

### ✅ H4 — DOB validation UTC bug in create-profile.tsx (already correct)
`create-profile.tsx:114` already uses `new Date(y, m - 1, day)`. No action needed.

### ✅ H5 + H6 — withdrawal_rate dead field removed (commit `b041567`)
Removed from `engine/types.ts`, `db/queries.ts`, `context/AppContext.tsx`, `storage/legacyMigration.ts`, `app/(tabs)/dashboard.tsx`, `__tests__/__mocks__/queries.ts`, `__tests__/calculator.test.ts`. Schema migration v7 column left as harmless dead data (SQLite cannot DROP COLUMN).

### ❌ H1 — Login loadProfiles stale closure
**File:** `app/login.tsx:44`
**Problem:** `useCallback(async () => { ... }, [])` — empty dependency array captures `selectedProfile` as `null` forever. On 1-profile devices, `selectProfile()` re-triggers on every `useFocusEffect` (every tab return). Resets PIN field, re-prompts biometric.
**Fix:** Add `selectedProfile` to the `useCallback` dependency array, or use a `useRef` flag `autoSelectedRef` to guard the auto-select.
```typescript
// Option A — add dep:
const loadProfiles = useCallback(async () => { ... }, [selectedProfile]);

// Option B — ref guard (preferred, avoids re-creating callback):
const autoSelectedRef = useRef(false);
const loadProfiles = useCallback(async () => {
  // ...fetch profiles...
  if (!autoSelectedRef.current && profiles.length === 1) {
    autoSelectedRef.current = true;
    selectProfile(profiles[0]);
  }
}, []); // ref doesn't need to be a dep
```

### ❌ H2 — loadProfile errors silently swallowed on login
**File:** `app/login.tsx:89, 135`
**Problem:** `try { await loadProfile(profile.id); } catch { /* non-critical */ }` — if SQLite read fails, user navigates to assets/dashboard with all state empty and no error shown.
**Fix:** Show a toast or Alert on catch. Minimum: `Alert.alert('Load failed', 'Could not load profile data. Please try again.')` and do not navigate.

### ❌ H7 — addAsset / addExpense errors silently swallowed
**File:** `context/AppContext.tsx:243, 304`
**Problem:** If `dbCreateAsset` / `dbCreateExpense` throws, error is `console.warn`'d but swallowed. User sees no feedback; the asset/expense is never added to state (correct), but the user doesn't know.
**Fix:** Re-throw or surface to UI. At minimum, return a boolean success/fail from `addAsset`/`addExpense` and have callers show an Alert on failure.

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

### ❌ M5 — expected_roi = 0 treated as "not set" in asset growth calc
**File:** `engine/calculator.ts:computeBlendedGrowthRate`
**Problem:** `if (asset.expected_roi === 0)` falls back to category default. User cannot model a zero-return asset (e.g. cash pile, non-earning real estate).
**Fix:** Change the sentinel from `0` to `null`/`undefined`. Asset type: `expected_roi?: number | null`. In `computeBlendedGrowthRate`, check `asset.expected_roi == null` to mean "not set". `0` becomes valid and is used as-is. Also update the DB layer: `queries.ts` already stores `NULL` for missing values, so reads are fine; writes should pass `null` instead of `0` when user clears the field.
**Note:** Run full 70-test suite after this change — several tests use `expected_roi: 0`.

### ❌ M7 — Hardcoded paddingTop: 60 in login.tsx (no safe area insets)
**File:** `app/login.tsx`
**Problem:** `paddingTop: 60` hardcoded. On devices with dynamic island or tall notch, content may be clipped.
**Fix:** `import { useSafeAreaInsets } from 'react-native-safe-area-context'` and replace `paddingTop: 60` with `paddingTop: insets.top + 16`.

### ❌ M8 — Only INR/USD in currency selector despite engine supporting more
**File:** `app/onboarding/create-profile.tsx` (and `edit-profile.tsx`)
**Problem:** Selector only shows INR and USD. `calculator.ts:CURRENCY_META` already supports EUR, GBP, AUD, CAD, SGD, AED.
**Fix:** Either expose all currencies from `CURRENCY_META` in the selector, or add a comment documenting "INR/USD only — by design" and close as won't-fix.

### ❌ M9 — No PIN recovery flow
**File:** `app/login.tsx`
**Problem:** Forgotten PIN = permanent lockout for that profile. No escape hatch.
**Fix:** Add a "Forgot PIN?" link on the login screen that shows an Alert warning: "This will delete all data for this profile. Continue?" → calls `deleteProfile(profile.id)`.

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

### ❌ L4 — `FREQUENCY_TO_MONTHS_PER_PAYMENT` exported but never imported
**File:** `engine/types.ts`
Safe to delete. No external consumers found in codebase.

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

### ❌ L10 — `FIRE_TARGET_AGES` exported but no external consumer
**File:** `engine/calculator.ts`
Safe to un-export (make internal) or delete if never consumed externally.

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
| Critical | C2, C4, C6 | C1, C3, C5 |
| High | H3, H4, H5, H6 | H1, H2, H7 |
| Medium | M1, M3, M4, M6 | M5, M7, M8, M9 |
| Low | — | L1–L10 |
| Play Store | P5 | P1–P4, P6–P8 |

**Recommended fix order for next session:**
1. C1 — index.tsx routing fix (5 lines, high user impact on reinstall)
2. C5 — createProfile rollback (10 lines, prevents ghost profiles)
3. C3 — Dashboard error state + retry (20 lines, prevents stuck UI)
4. H1 — loadProfiles stale closure (2-line fix)
5. H2 + H7 — surface silent errors to user
6. M5 — null sentinel for expected_roi
