# FinPath — Production Readiness Audit

**Date:** 2025-07-25  
**Version:** 1.0.0 (versionCode 1)  
**Stack:** Expo 54 / React Native 0.81.5 / TypeScript 5.9.2 / expo-sqlite 16

---

## 🔴 Play Store Blockers (Must Fix)

### 1. ~~Placeholder Package Name~~ ✅ FIXED
**Fix:** Changed `android.package` in `app.json` and `namespace` + `applicationId` in `android/app/build.gradle` to `com.parasjain.finpath`.

### 2. ~~No Privacy Policy~~ ✅ FIXED
**Fix:** Created `PRIVACY_POLICY.md` covering all data types, local-only storage, Sentry crash reporting, and deletion instructions. Added `privacyPolicyUrl` pointing to `https://parasjaing8.github.io/finpath/PRIVACY_POLICY` in `app.json`. Added a tappable "Privacy Policy" footer link in `login.tsx` via `Linking.openURL`. **Action required:** Enable GitHub Pages on the repo (Settings → Pages → branch: main) to make the URL live, then add it in Play Console.

### 3. ~~No Data Safety Declaration~~ ✅ FIXED
**Fix:** Created `DATA_SAFETY.md` with exact Play Console Data Safety form answers: personal info (name, DOB), financial info (income/assets/expenses), and crash logs (Sentry — no PII). Added `android.allowBackup: false` to `app.json` to prevent the SQLite DB from being backed up to Google Drive and restored onto another device. **Action required:** Submit the Data Safety form in Play Console using the answers in `DATA_SAFETY.md`.

### 4. ~~Missing App Signing~~ ✅ FIXED
**Fix:** Added `keystoreProperties` loader and `signingConfigs.release` block to `android/app/build.gradle`. Falls back to debug keystore when `keystore.properties` is absent (local dev). Template `android/keystore.properties.template` provided. `android/keystore.properties` and `*.keystore` are in `.gitignore`.

### 5. ~~No ProGuard/R8 Obfuscation Config~~ ✅ FIXED
**Fix:** Release buildType in `android/app/build.gradle` now has `minifyEnabled true`, `shrinkResources true`, and `proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"`.

---

## 🟡 Security Issues

### 6. ~~PIN Hashing Without Salt~~ ✅ FIXED
**Files:** `app/onboarding/create-profile.tsx`, `app/login.tsx`  
**Issue:** PIN is hashed with bare SHA-256 (`Crypto.digestStringAsync`). A 6-digit PIN has only 1 million possibilities — a rainbow table can crack this instantly.  
**Impact:** Low for a local-only app, but still a weakness. If the SQLite DB file is extracted, all PINs are trivially reversible.  
**Fix:** Use PBKDF2 or bcrypt with a per-profile random salt stored alongside the hash. At minimum, prepend a random salt before hashing:
```ts
const salt = Crypto.getRandomValues(new Uint8Array(16));
const hash = SHA256(salt + pin);
// Store both salt and hash
```

### 7. ~~No Rate Limiting on PIN Attempts~~ ✅ FIXED
**File:** `app/login.tsx`  
**Issue:** Users can brute-force the 6-digit PIN indefinitely. No lockout, delay, or attempt counter.  
**Fix:** After 5 failed attempts, add an exponential backoff (30s, 1min, 5min) or a temporary lockout stored in AsyncStorage with a timestamp.

### 8. ~~PIN Stored in Profile Object in Memory~~ ✅ FIXED
**Files:** `hooks/useProfile.tsx`, `db/queries.ts`, `app/login.tsx`  
**Fix:** Removed `pin` from the `Profile` interface. `getAllProfiles()` and `getProfile()` now use explicit column SELECTs that exclude `pin`. Added `getProfilePin(id)` (auth-only function) which `login.tsx` calls at the moment of verification — the PIN hash is never stored in React state or passed through context.

### 9. No Sensitive Data Protection
**Issue:** SQLite database is stored as a plain file on the device. No encryption at rest. If the device is rooted or the DB file is extracted via backup, all financial data is exposed.  
**Fix (nice-to-have):** Consider `expo-secure-store` for the PIN and `sqlcipher` for DB encryption if targeting security-conscious users.

---

## 🐛 Bugs

### 10. ~~`is_income` Dead Code Path in `calculatePresentValueOfExpenses`~~ ✅ FIXED
**File:** `engine/calculator.ts` (line ~237)  
**Issue:** The standalone `calculatePresentValueOfExpenses()` function filters `expenses.filter(e => !e.is_income)`. Since the income toggle was removed and `is_income` is always `0`, this filter always passes — it's dead code today but would silently break if `is_income` were ever reintroduced.  
**Fix:** Remove the `is_income` filter since income is now handled exclusively via goals-based pension.

### 11. ~~`is_income` Rendering in Expenses List~~ ✅ FIXED
**File:** `app/(tabs)/expenses.tsx` (lines ~197-203)  
**Issue:** The expense card still conditionally renders `'📈 '` prefix and uses green vs red color based on `exp.is_income`. Since `is_income` is always `0`, this dead code path is never triggered but adds confusion.  
**Fix:** Remove all `is_income` conditional rendering from the expenses screen.

### 12. ~~PENSION_INCOME Still in Expense Categories~~ ✅ FIXED
**File:** `constants/categories.ts`  
**Issue:** `PENSION_INCOME` is listed as an expense category even though pension/income is now handled on the Goals screen. Users can still select this category and create "pension" expenses that would be counted as expenses (not income), which is confusing.  
**Fix:** Remove `PENSION_INCOME` from `EXPENSE_CATEGORIES` or rename it to something less confusing. Also remove from `DEFAULT_INFLATION_RATES`.

### 13. ~~Currency Affix Hardcoded to ₹ for Non-ESOP Assets~~ ✅ FIXED
**File:** `app/(tabs)/assets.tsx` (line ~217)  
**Issue:** The current value TextInput shows `₹` for non-ESOP assets regardless of the profile's currency. If the profile currency is USD, it should show `$`.  
**Fix:** Use `currentProfile?.currency === 'INR' ? '₹' : '$'` instead of the hardcoded `₹`.

### 14. ~~Goals Screen Inflation Hardcoded to 6%~~ ✅ FIXED
**Fix:** Extracted `PENSION_INFLATION_RATE = 0.06` constant in `engine/calculator.ts` (exported). Both `calculator.ts` and `goals.tsx` now use this constant everywhere `1.06` appeared. Hint text dynamically shows the rate.

### 15. ~~Discount Rate Hardcoded to 6%~~ ✅ FIXED
**Fix:** Extracted `DEFAULT_DISCOUNT_RATE = 0.06` constant in `engine/calculator.ts` (exported). `calculateProjections` and `calculatePresentValueOfExpenses` use this constant instead of the literal `0.06`.

### 16. ~~SIP Binary Search Cap at ₹5L/month~~ ✅ FIXED
**File:** `engine/calculator.ts`  
**Fix:** Raised `high` from `500000` to `5000000` (₹50L/month).

### 17. ~~`handleLogout` Closure Stale Reference~~ ✅ FIXED
**File:** `app/(tabs)/dashboard.tsx`  
**Fix:** Wrapped `handleLogout` in `useCallback([logout, router])` and added it to the `useEffect` dependency array.

### 18. ~~`useMemo` Dependency on `result?.requiredMonthlySIP`~~ ✅ FIXED
**Fix:** Replaced the fragile `sipAmount === 10000` guard with a `hasAutoSetSip` ref. The `useEffect` now auto-sets the SIP exactly once on first valid result and depends on `[result]`.

---

## ⚡ Performance

### 19. ~~No Memoization of Expensive Chart Computations~~ ✅ FIXED
**File:** `app/(tabs)/dashboard.tsx`  
**Fix:** Wrapped `chartData` in `useMemo([projections])`.

### 20. ~~Expense Category Count Computed Inline~~ ✅ FIXED
**File:** `app/(tabs)/expenses.tsx`  
**Fix:** Pre-computes `categoryCounts` in a single `useMemo` pass; chip rendering uses `categoryCounts[cat.key]`.

### 21. ~~`findIndex` + `indexOf` in DataTable Row~~ ✅ FIXED
**File:** `app/(tabs)/dashboard.tsx`  
**Fix:** Pre-computes `firstFireYear` once with `useMemo`; each row checks `row.year === firstFireYear` for O(1) highlight.

---

## 🎨 UX / UI Issues

### 22. ~~No Error Boundary~~ ✅ FIXED
**File:** `app/_layout.tsx`  
**Issue:** No React error boundary wraps the app. Unhandled JS errors crash the app with a white screen.  
**Fix:** Add an error boundary component at the root that shows a friendly "Something went wrong" screen with a restart option.

### 23. ~~No Loading States on Data Fetches~~ ✅ FIXED
**Fix:** Added `loading` state (initial `true`) + `ActivityIndicator` spinner to both `assets.tsx` and `expenses.tsx`. Screens show the spinner until first data load completes.

### 24. ~~No Pull-to-Refresh~~ ✅ FIXED
**Fix:** Added `RefreshControl` (green spinner, `onRefresh` callback) to the main `ScrollView` in both `assets.tsx` and `expenses.tsx`.

### 25. ~~No Confirmation Before Overwriting Goals~~ ✅ FIXED
**Fix:** Wrapped the save logic in `Alert.alert('Save Goals', 'This will overwrite...')` with Cancel/Save buttons in `goals.tsx`. Save only proceeds on confirmation.

### 26. ~~Real Estate Self-Use Assets Excluded from Net Worth on Dashboard~~ ✅ FIXED
**Fix:** Added `investableNetWorth` and `totalNetWorth` to `CalculationOutput` in `engine/calculator.ts`. Dashboard now shows a split card beneath the summary tiles with both figures side-by-side: "Investable Net Worth (Used in FIRE projections)" vs "Total Net Worth (Incl. self-use real estate)". Assets screen net worth card updated with a subtitle "Incl. self-use real estate · excludes from FIRE calc" so users understand the discrepancy.

### 27. ~~Export CSV Not Escaped~~ ✅ FIXED
**File:** `utils/export.ts`  
**Issue:** Asset/expense names containing commas, quotes, or newlines will break the CSV format. No field escaping is performed.  
**Fix:** Wrap fields in double quotes and escape internal quotes: `field.replace(/"/g, '""')`.

### 28. ~~Date Validation Allows Invalid Dates~~ ✅ FIXED
**Files:** `app/(tabs)/expenses.tsx`  
**Fix:** Added `isNaN(new Date(startDate).getTime())` check after the regex pass in `validate()`. (Profile screen already had this check.)

---

## 🧹 Code Quality / Dead Code

### 29. ~~`is_income` Column Should Be Removed~~ ✅ FIXED (type + queries cleaned; DB column retains DEFAULT 0 for SQLite backward compat)
**Files:** `db/schema.ts`, `db/queries.ts`, `engine/calculator.ts`, `app/(tabs)/expenses.tsx`  
**Issue:** The `is_income` column in the expenses table, its field in the `Expense` interface, and all references throughout the codebase are dead code. The income toggle was removed and pension was moved to Goals.  
**Fix:** Remove the column (add a migration), remove from the type interface, and clean up all references.

### 30. ~~`currency.ts` / `inflation.ts` Utils Partially Unused~~ ✅ FIXED
**Fix:** Deleted `utils/currency.ts` and `utils/inflation.ts` entirely — neither file was imported by any app code.

### 31. ~~`verifyPin` Query Unused~~ ✅ FIXED
**Fix:** Removed from `db/queries.ts`.

### 32. ~~`getAssetsByCategory` Query Unused~~ ✅ FIXED
**Fix:** Removed from `db/queries.ts`.

### 33. ~~`updateProfile` Query Unused~~ ✅ FIXED
**Fix:** Removed from `db/queries.ts`.

### 34. ~~`deleteProfile` Query Unused~~ ✅ FIXED
**Fix:** Removed from `db/queries.ts`.

### 35. ~~`fire_corpus` Column in Goals Table~~ ✅ FIXED
**Fix:** Removed `fire_corpus` from `Goals` interface and from `saveGoals()` INSERT/UPDATE SQL in `db/queries.ts`. Column remains in DB schema for backward compat (SQLite won’t fail on extra columns) but is no longer written or read.

---

## 📦 Build & Deployment

### 36. `newArchEnabled: true` Risk
**File:** `app.json`  
**Issue:** React Native New Architecture is enabled. While supported in RN 0.81, some third-party libraries may have subtle incompatibilities (particularly `victory-native` and `react-native-svg`).  
**Fix:** Test thoroughly. If any rendering glitches appear on Fabric, consider disabling for v1.0.

### 37. ~~No Version Automation~~ ✅ FIXED
**Fix:** Added `scripts/bump-version.js` — a Node.js script that increments `versionCode` by 1 and the semver patch version in `app.json`. Three npm scripts added to `package.json`: `bump` (patch), `bump:minor`, `bump:major`. Run `npm run bump` before every Play Store upload. Output: `✅ Bumped: v1.0.0 → v1.0.1 | versionCode 1 → 2`.

### 38. ~~APKs Tracked via Git LFS~~ ✅ FIXED
**Fix:** Removed `!releases/*.apk` exception from `.gitignore` and the LFS rule from `.gitattributes` — APKs are now fully ignored by git. Ran `git rm --cached releases/FinPath-v1.0.apk` to untrack the existing 126 MB APK (file preserved on disk). Added `.github/workflows/release.yml`: pushes to `v*` tags trigger a full build → `assembleRelease` → GitHub Release with the APK attached. **Action required:** Add three repo secrets in GitHub Settings → Secrets: `RELEASE_KEYSTORE_BASE64` (base64-encoded keystore), `KEYSTORE_STORE_PASSWORD`, `KEYSTORE_KEY_ALIAS`, `KEYSTORE_KEY_PASSWORD`. Then tag a release: `npm run bump && git tag v1.0.1 && git push origin v1.0.1`.

### 39. ~~No CI/CD Pipeline~~ ✅ FIXED
**Fix:** Added `.github/workflows/ci.yml` that runs on push/PR to `main`: installs deps, runs `tsc --noEmit` (type check), and `npm test`.

### 40. ~~No Crash Reporting / Analytics~~ ✅ FIXED
**Issue:** No Sentry, Bugsnag, Firebase Crashlytics, or similar. Production crashes will be invisible.  
**Fix:** Integrated `@sentry/react-native`. DSN configured via `EXPO_PUBLIC_SENTRY_DSN` env var. `Sentry.init()` in `_layout.tsx`; `ErrorBoundary.componentDidCatch` calls `Sentry.captureException`; `RootLayout` wrapped with `Sentry.wrap()`.

---

## 🧪 Testing

### 41. ~~Zero Test Coverage~~ ✅ FIXED
**Issue:** No test framework (`jest`, `react-native-testing-library`, etc.) configured. No tests exist.  
**Files at highest risk without tests:**
- `engine/calculator.ts` — complex financial math with many edge cases
- `db/queries.ts` — data integrity
- `utils/export.ts` — CSV generation  
**Fix:** Added `jest` + `ts-jest` with `"test"` script. Created `__tests__/calculator.test.ts` with 23 passing tests covering `formatCurrency`, `calculatePresentValueOfExpenses`, and `calculateProjections` (all edge cases: empty inputs, pension, self-use assets, step-up SIP, date ranges).

### 42. ~~No Linting or Formatting~~ ✅ FIXED
**Fix:** Added `eslint` + `@typescript-eslint` + `eslint-config-prettier` + `prettier`. Config files: `.eslintrc.json`, `.prettierrc.json`. Scripts added: `lint`, `format`.

---

## 📝 Summary

| Priority | Count | Examples |
|----------|-------|---------|
| 🔴 Play Store Blockers | 5 | Package name, privacy policy, signing, ProGuard |
| 🟡 Security | 4 | Unsalted PIN, no rate limiting, PIN in memory |
| 🐛 Bugs | 9 | Dead `is_income` paths, hardcoded currency affix, SIP cap |
| ⚡ Performance | 3 | Unmemoized chart data, inline filter counts |
| 🎨 UX | 7 | No error boundary, no loading states, CSV not escaped |
| 🧹 Dead Code | 7 | `is_income`, unused utils, unused queries |
| 📦 Build | 5 | No CI, no crash reporting, LFS bloat |
| 🧪 Testing | 2 | Zero tests, no linter |

**Total: 42 findings**

### Recommended Fix Order
1. **Package name** → `com.parasjain.finpath` (blocks everything)
2. **Release signing** → generate keystore, configure build.gradle
3. **Privacy policy** → host and link in Play Console
4. **Remove dead `is_income` code** → schema migration + code cleanup
5. **Remove `PENSION_INCOME` from expense categories**
6. **Fix currency affix** in assets form
7. **Add error boundary** at root
8. **CSV escaping** in export
9. **PIN salt** + rate limiting
10. **Add crash reporting** (Sentry/Firebase)
11. **Unit tests** for calculator
12. **Everything else**
