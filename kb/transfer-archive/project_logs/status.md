# Finpath -- Current Status

**As of:** 2026-04-20
**Version:** 1.0.2 (versionCode 34)
**Last built AAB:** `app-release-v34.aab` (versionCode 34, versionName 1.0.2, release-signed, 116MB)
**Latest commit:** `b9477d9` (docs: mark M7/M8/M9 done in TASKS.md)
**Branch:** `beyondv33`
**Audit:** All C/H/M items resolved. L1–L10 (dead code) and P1–P4/P6–P8 (Play Store) remain.

---

## What's working

- [x] Multi-profile with PIN auth + biometric (fingerprint)
- [x] Asset tracking -- categories: ESOP/RSU, Stocks, MF, Savings, Gold/Silver, PF, NPS, Real Estate, Others
- [x] Blended growth rate model for existing assets (DEFAULT_GROWTH_RATES by category); sipReturnRate for new SIP
- [x] Expense management -- categories, types (current/future/one-time), per-expense inflation slider
- [x] Goals screen -- retirement age, SIP stop age, FIRE type (Slim/Moderate/Fat/Custom), monthly withdrawal target
- [x] CorpusPrimer -- first-time onboarding dialog + inline lightbulb hint on Goals screen
- [x] Dashboard -- full lifecycle SIP projection, Victory net worth chart, year-by-year table, SIP burden warning
- [x] CSV export (Pro feature -- only paid feature)
- [x] Pro paywall -- IAP via react-native-iap v14, `finpath_pro` SKU, Rs.199/$4.99 one-time
- [x] IAP error messages surface to user — red text in ProPaywall, actual error code + message shown
- [x] Profiles fully free -- no Pro gate on profile creation
- [x] Date picker (pure-JS, no native module -- components/DateInput.tsx)
- [x] Tab order: Assets -> Expenses -> Goal -> Dashboard -> Profile
- [x] Logout on Profile page
- [x] App ID: com.aihomecloud.finpath (changed Stage 1)
- [x] Release signing (keystore at ~/finpath/finpath-release.jks, alias finpath, pass Paras@iisc18)
- [x] Sentry error boundary + crash reporting wrapper in root layout
- [x] Portrait orientation locked
- [x] New Architecture enabled (newArchEnabled: true)
- [x] expo-sharing installed (v14.0.8)

## Completed (2026-04-15)

- [x] goals.tsx: renamed FIRE chips Lean/Comfortable/Rich, fire_target_age now 85/100/120 (commit 42cc830)
- [x] dashboard.tsx: failureAge warning card added (commit db911b3)
- [x] dashboard.tsx: full redesign — hero card, inflation insight, snapshot row, bell-curve chart (commit 37a26e5)
- [x] goals.tsx: inflation rate slider (3–12%) + future value hint on withdrawal input (commit dbd4295)
- [x] calculator.ts: pension inflation now uses user's inflation_rate, not hardcoded 6% (commit 7fc003d)
- [x] expenses.tsx: category icon on tile, delete moved to edit modal (commit 7441ba2)
- [x] CorpusPrimer.tsx: block 3 replaced with inflation explanation (commit 7441ba2)
- [x] dashboard.tsx: dynamic hero card gradient + white On-Track pill + chart gradient fills + red dashed withdrawal line (commit 0f5cad3)

## Known issues / TODOs

- [ ] `withReleaseSigning.js` step-3 regex broken — signingConfig release block must be manually fixed after every `expo prebuild --clean`
- [ ] keystore.properties wiped after every `expo prebuild --clean` — must recreate manually
- [ ] versionCode in build.gradle must be manually patched after every prebuild (not auto-updated from app.json)
- [ ] APK not tested on physical device since r3 (emulator-only for r6+)
- [ ] IAP product `finpath_pro` must be created in Google Play Console before publishing
- [ ] Privacy policy URL must be live: https://parasjaing8.github.io/finpath/PRIVACY_POLICY
- [ ] Hardcoded IAP price (Rs.199/$4.99) -- should fetch from Play Store billing
- [ ] Sentry DSN not configured (no .env file) -- crash reporting inactive
- [ ] R8 minification disabled -- AAB ~108MB, could shrink
- [ ] Stage 2: Privacy Policy page on aihomecloud.com
- [ ] Stage 3: App icon 512x512, feature graphic, screenshots, description
- [ ] Stage 4: Submit to Play Store

## Package name (FINAL)

**`com.aihomecloud.finpath`** — changed from `com.anonymous.finpath` in commit `9de20aa`.

## Signing (corrected 2026-04-12)

- Keystore: `~/finpath/finpath-release.jks`
- Alias: `finpath`
- Password: `Paras@iisc18`
- storeFile in keystore.properties must be absolute path

## Standard build sequence (after expo prebuild --clean)

1. Recreate keystore.properties (absolute path, Paras@iisc18)
2. Fix versionCode in build.gradle
3. Fix signingConfig (python3 regex)
4. Verify with grep
5. `./gradlew bundleRelease`
6. scp AAB to Windows

---

## Completed (2026-04-18)

- [x] expenses.tsx: sticky Cancel/Save buttons + compact category chips (commit fa06f1f)
- [x] assets.tsx: self-use checkbox extended to Gold + Others categories (commit 2de9b69)
- [x] assets.tsx + expenses.tsx: KeyboardAvoidingView layout fix for both modals (commit 0b15212)
- [x] assets.tsx + expenses.tsx: sheet flex:1 fix — form content visibility restored (commit 407bbec)
- [x] AAB versionCode 25, versionName "1.0.1" built and copied to Windows
- [x] Full UI/UX audit written to kb/UiUxAudit.md + C:\dropbox\finpath\UiUxAudit.md (commit cf58709)

## Git state (as of 2026-04-18)

Latest commit: `621459d`
Total commits: ~50
