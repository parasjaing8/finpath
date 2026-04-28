# FinPath App Architecture

> Last updated: 2026-04-11

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.81.5 + Expo SDK 54 (managed + bare hybrid) |
| Router | Expo Router (file-based) |
| UI | React Native Paper (Material Design 3) |
| Database | SQLite via expo-sqlite |
| Secure Storage | expo-secure-store (PIN hash, biometric flag, Pro status) |
| Biometrics | expo-local-authentication |
| Charts | victory-native + @shopify/react-native-skia |
| Sliders | @miblanchard/react-native-slider |
| Calculations | Local TypeScript engine (engine/calculator.ts) |
| Export | expo-file-system + expo-sharing (CSV) |
| In-App Purchase | react-native-iap (Google Play Billing) |
| Crash Reporting | @sentry/react-native (disabled -- no EXPO_PUBLIC_SENTRY_DSN set) |
| Testing | jest + ts-jest |

---

## Monetization Model

**Single app. One IAP. CSV export is the only paid feature.**

- SKU: `finpath_pro` -- one-time non-consumable, Rs.199 / $4.99
- Only gated feature: CSV export (dashboard -> CSV button)
- Everything else -- unlimited profiles, all screens, all calculations -- is free.
- Pro status cached in expo-secure-store (`finpath_pro_status = "1"`) for instant offline restore.
- Purchase flow: usePro -> purchasePro() -> Play Billing -> purchaseUpdatedListener -> unlockPro()
- Restore flow: restorePurchases() -> getAvailablePurchases() -> match finpath_pro SKU
- ProPaywall features list: CSV export, PDF report (coming soon), personalized tips (coming soon)
- No profile gate anywhere in code. Profiles are fully free. Gate was removed in commit eb1fdcb.

---

## Folder Structure

```
finpath/
  app/
    _layout.tsx             # Root: ErrorBoundary, Sentry.wrap, PaperProvider, ProProvider, ProfileProvider
    index.tsx               # Entry: initDB -> /login or /onboarding/create-profile
    login.tsx               # Profile select + PIN + biometric login
    (tabs)/
      _layout.tsx           # Tab bar: Assets -> Expenses -> Goal -> Dashboard -> Profile
      assets.tsx            # Asset CRUD + SVG pie chart + net worth header
      expenses.tsx          # Expense CRUD + PV banner
      goals.tsx             # Retirement goals + CorpusPrimer + FIRE type chips
      dashboard.tsx         # Projections, Victory chart, year-by-year table, CSV export (Pro-gated)
      profile.tsx           # Profile info, biometric toggle, edit, logout, delete
    onboarding/
      create-profile.tsx    # New profile: name, DOB, income, PIN, biometric
      edit-profile.tsx      # Edit income, DOB, currency, change PIN
  components/
    CorpusPrimer.tsx        # First-time onboarding dialog + inline lightbulb hint (Goals screen)
    DateInput.tsx           # Pure-JS date picker (bottom-sheet ScrollView columns, local-time safe)
    ProPaywall.tsx          # IAP upgrade bottom sheet (no reason prop, no profiles feature)
  constants/
    categories.ts           # Asset/expense categories, frequencies, default ROI/inflation rates
  db/
    schema.ts               # SQLite schema + initializeDatabase() + 8-version migration system
    queries.ts              # All DB read/write + SecureStore helpers (PIN, biometric, profile CRUD)
  engine/
    calculator.ts           # Pure FIRE calculation engine -- no side effects, no DB calls
  hooks/
    usePro.tsx              # ProContext: isPro, purchasePro, restorePurchases, IAP lifecycle
    useProfile.tsx          # ProfileContext: currentProfile, setCurrentProfileId, logout
  plugins/
    withReleaseSigning.js   # Expo config plugin: injects keystore signing into build.gradle
  utils/
    export.ts               # CSV export: assets + expenses + projections -> share sheet
  __tests__/                # Jest tests (ts-jest, mocked queries)
```

---

## Screen Flow

```
index.tsx
  |-- No profiles -> /onboarding/create-profile
  +-- Profiles exist -> /login
        +-- Login success -> /(tabs)/assets  [default landing tab]
```

---

## Data Model (SQLite)

### profiles
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | |
| dob | TEXT | YYYY-MM-DD |
| monthly_income | REAL | Take-home monthly salary |
| currency | TEXT | INR, USD, EUR, GBP, AUD, CAD, SGD, or AED |
| pin | TEXT | NULL after SecureStore migration |
| failed_attempts | INTEGER | Lockout counter |
| lockout_until | INTEGER | Unix ms timestamp |

SecureStore keys: `finpath_pin_{id}` = salt$sha256(salt+pin) | `finpath_biometric_{id}` = "1" | `finpath_pro_status` = "1"

### assets
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| profile_id | INTEGER FK | |
| category | TEXT | EQUITY, MUTUAL_FUND, DEBT, FIXED_DEPOSIT, PPF, EPF, GOLD, REAL_ESTATE, CRYPTO, CASH, ESOP_RSU, OTHERS |
| name | TEXT | |
| current_value | REAL | Stored in profile currency; no per-asset FX conversion today |
| currency | TEXT | Profile currency code (INR/USD/EUR/GBP/AUD/CAD/SGD/AED) — stored but not used by engine |
| expected_roi | REAL | Annual growth % -- 0 means use DEFAULT_GROWTH_RATES fallback |
| is_recurring | INTEGER | 0/1 -- ESOP vesting schedule enabled |
| recurring_amount | REAL | Per-vesting-event amount |
| recurring_frequency | TEXT | |
| next_vesting_date | TEXT | YYYY-MM-DD |
| vesting_end_date | TEXT | YYYY-MM-DD -- null = vest indefinitely |
| is_self_use | INTEGER | 0/1 -- excluded from investable NW and FIRE calc |
| gold_silver_unit | TEXT | Always VALUE (quantity mode removed) |
| gold_silver_quantity | REAL | Unused legacy column |

### expenses
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| profile_id | INTEGER FK | |
| name | TEXT | |
| category | TEXT | |
| expense_type | TEXT | CURRENT_RECURRING, FUTURE_ONE_TIME, FUTURE_RECURRING |
| amount | REAL | Today's value |
| currency | TEXT | INR default |
| frequency | TEXT | For recurring types |
| inflation_rate | REAL | Per-expense inflation % |
| start_date | TEXT | For FUTURE types |
| end_date | TEXT | Default = retirement year Dec 31 for CURRENT_RECURRING |
| is_income | INTEGER | 0/1 default 0 |

### goals (one row per profile, UNIQUE constraint)
| Column | Type | Notes |
|---|---|---|
| retirement_age | INTEGER | |
| sip_stop_age | INTEGER | Must be <= retirement_age |
| pension_income | REAL | Monthly corpus withdrawal target -- today's value |
| fire_type | TEXT | fat=3%, moderate=5%, slim=7%, custom |
| fire_target_age | INTEGER | Default 100 |
| withdrawal_rate | REAL | SWR % -- editable when fire_type = custom |
| inflation_rate | REAL | Expected annual inflation % |

---

## Authentication Flow

1. PIN login: SHA-256(salt+pin) in SecureStore. Salt generated at profile creation. Legacy bare-SHA256 also supported.
2. Biometric: per-profile opt-in. Auto-triggers on profile select if enrolled+enabled. Skipped if locked out.
3. Lockout: 5 failed attempts -> progressive lockout via SQLite failed_attempts + lockout_until.
4. Screenshot protection: FLAG_SECURE in MainActivity.kt -- app-wide, no exceptions.

---

## Calculator Engine

engine/calculator.ts -- pure function, no DB, no side effects.

Input:  CalculationInput { profile, assets, expenses, goals, sipAmount, sipReturnRate, postSipReturnRate, stepUpRate }
Output: CalculationOutput { fireCorpus, projections[], requiredMonthlySIP, sipBurdenWarning, investableNetWorth, totalNetWorth, netWorthAtRetirement, netWorthAtAge100 }

Two-bucket growth model:
- existingBucket: current investable assets, grows at computeBlendedGrowthRate() (weighted avg expected_roi)
- sipBucket: new SIP contributions, grows at sipReturnRate
- Merge at retirement age; post-retirement grows at postSipReturnRate with withdrawals deducted

SIP sizing: binary search, Rs.1K tolerance, target = corpus >= 0 at age 100.

Expense funding:
- CURRENT_RECURRING: salary-funded; stop at retirement; NOT deducted from corpus
- FUTURE_ONE_TIME / FUTURE_RECURRING: corpus-funded if at or after retirement

Key exports:
- calculateProjections(input): main entry
- calculateRequiredSIP(...): binary search wrapper
- simulateCorpusAtAge(...): single lifecycle pass used by binary search
- calculateFireCorpus(pension, yearsToRetirement, swr, postRetExpPV): corpus target formula
- calculatePresentValueOfExpenses(profile, expenses, retirementAge, discountRate): expense screen PV
- formatCurrency / formatCurrencyFull: INR K/L/Cr notation, USD localeString
- FIRE_WITHDRAWAL_RATES: { fat: 3, moderate: 5, slim: 7 }
- PENSION_INFLATION_RATE: 0.06
- DEFAULT_DISCOUNT_RATE: 0.06

---

## Key Architectural Decisions

- **Single calculator file:** All financial logic in engine/calculator.ts only. No financial math in screens.
- **SecureStore for PIN:** SQLite readable on rooted devices. expo-secure-store uses Android Keystore (hardware-backed).
- **No backend / no cloud:** All data on-device. No server, no sync, no accounts. Privacy-first.
- **Pure-JS date picker:** Zero native deps. Local-time safe.
- **FLAG_SECURE app-wide:** Applied at Activity level. Financial data never in screenshots or recent-apps.
- **Single IAP (CSV export only):** One non-consumable SKU finpath_pro. Only gates CSV export. All other features free.
- **New Architecture enabled:** newArchEnabled: true in app.json (Fabric + TurboModules).

---

## Storage Architecture (updated 2026-04-29)

**SQLite is the single source of truth.** The dual-write path described in the 2026-04-19 audit has been resolved. `AppContext` mutations write to SQLite only (via `dbCreateAsset`, `dbCreateExpense`, etc.). AsyncStorage is used only for:
- The migration sentinel (one-time flag that the SQLite migration has run)
- The export/import JSON payload (backup restore — reads from SQLite, writes back to SQLite)

The "Dual Storage Warning" in earlier versions of this doc is stale and no longer applies.

---

## Known Issues

- withReleaseSigning.js step-3 regex fails to patch buildTypes.release signingConfig. Manual sed needed after clean prebuild.
- Sentry DSN not configured (no .env). Crash reporting inactive.
- R8 minification disabled. APK ~54MB.
- Hardcoded IAP price in ProPaywall (should fetch from Play Store billing).
- gold_silver_quantity and gold_silver_unit columns are legacy/unused (value-only mode).
- Per-asset `currency` column exists in schema but engine does not use it for FX conversion — all assets treated in profile currency.
- `calculateFutureGoalsCorpus` has zero test coverage.
- 50+ hardcoded color instances instead of using theme system.
