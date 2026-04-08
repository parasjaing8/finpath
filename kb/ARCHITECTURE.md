# FinPath App Architecture

> Reference for understanding the codebase structure, data flow, and key decisions.
> Last updated: 2026-04-06

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo (managed + bare hybrid) |
| Router | Expo Router (file-based) |
| UI | React Native Paper (Material Design 3) |
| Database | SQLite via `expo-sqlite` |
| Secure Storage | `expo-secure-store` (PIN hash, biometric flag) |
| Biometrics | `expo-local-authentication` |
| Charts | `victory-native` + `@shopify/react-native-skia` |
| Calculations | Local TypeScript engine (`engine/calculator.ts`) |
| Export | `expo-file-system` + `expo-sharing` (CSV) |

---

## Folder Structure

```
finpath/
├── app/                        # Expo Router screens
│   ├── _layout.tsx             # Root layout, Sentry init, ProfileProvider
│   ├── index.tsx               # Entry: init DB → redirect to login or create-profile
│   ├── login.tsx               # Profile selection + PIN + fingerprint login
│   ├── (tabs)/
│   │   ├── _layout.tsx         # Tab bar config
│   │   ├── assets.tsx          # Asset management
│   │   ├── expenses.tsx        # Expense management + PV banner
│   │   ├── goals.tsx           # FIRE goals config + live preview
│   │   └── dashboard.tsx       # FIRE projections, chart, net worth
│   └── onboarding/
│       └── create-profile.tsx  # Profile creation (name, DOB, income, PIN, biometric)
├── components/
│   └── DateInput.tsx           # Date picker wrapper (local-time safe)
├── constants/
│   └── categories.ts           # Asset/expense categories, frequencies
├── db/
│   ├── schema.ts               # SQLite schema + initializeDatabase()
│   └── queries.ts              # All DB read/write functions + SecureStore helpers
├── engine/
│   └── calculator.ts           # FIRE calculation engine (no side effects)
├── hooks/
│   └── useProfile.tsx          # ProfileContext: currentProfile, logout, refreshProfiles
├── kb/                         # ← YOU ARE HERE
├── memory/                     # Per-project lessons (auto-extracted)
├── releases/                   # Built APK files
├── scripts/                    # bump-version.js, test scripts
├── skills/                     # (unused in app, legacy from ai-chat)
└── utils/
    └── export.ts               # CSV export logic
```

---

## Screen Flow

```
index.tsx
  ├── DB not initialized → initializeDatabase()
  ├── No profiles → /onboarding/create-profile
  └── Profiles exist → /login
        └── Login success → /(tabs)/assets  [default tab]
```

---

## Data Model (SQLite)

### `profiles`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | |
| dob | TEXT | YYYY-MM-DD |
| monthly_income | REAL | Take-home monthly salary |
| currency | TEXT | 'INR' or 'USD' |
| pin | TEXT | NULL after SecureStore migration |
| failed_attempts | INTEGER | For lockout |
| lockout_until | INTEGER | Unix ms timestamp |

PIN hash stored in `expo-secure-store` as `finpath_pin_{id}` (format: `salt$sha256hash`).
Biometric flag stored as `finpath_biometric_{id}` = `'1'` if enabled.

### `assets`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| profile_id | INTEGER FK | |
| name | TEXT | |
| category | TEXT | See ASSET_CATEGORIES |
| current_value | REAL | |
| is_self_use | INTEGER | 0/1 — self-use real estate excluded from investable NW |
| is_recurring | INTEGER | For ESOP/RSU vesting |
| recurring_amount | REAL | Per-vesting-event amount |
| recurring_frequency | TEXT | |
| next_vesting_date | TEXT | YYYY-MM-DD |
| vesting_end_date | TEXT | YYYY-MM-DD |

### `expenses`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| profile_id | INTEGER FK | |
| name | TEXT | |
| category | TEXT | |
| expense_type | TEXT | 'CURRENT_RECURRING', 'FUTURE_ONE_TIME', 'FUTURE_RECURRING' |
| amount | REAL | |
| frequency | TEXT | For recurring types |
| inflation_rate | REAL | Per-expense inflation % |
| start_date | TEXT | For FUTURE types |
| end_date | TEXT | For recurring types (default = retirement date for CURRENT_RECURRING) |

### `goals`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| profile_id | INTEGER FK | |
| retirement_age | INTEGER | Default 60 |
| sip_stop_age | INTEGER | Default 55; must be ≤ retirement_age |
| pension_income | REAL | Desired monthly corpus withdrawal post-retirement (today's value) |
| fire_type | TEXT | 'fat', 'moderate', 'slim', 'custom' |
| life_expectancy | INTEGER | Default 100 |
| withdrawal_rate | REAL | SWR % |
| inflation_rate | REAL | Expected annual inflation % |

---

## Authentication Flow

1. **PIN login:** SHA-256(salt + pin) stored in SecureStore. Salt generated at creation.
2. **Biometric login:** Enabled per-profile via SecureStore flag. Auto-triggers on profile select if enabled.
3. **Lockout:** 5 failed attempts triggers progressive lockout (tracked in SQLite).
4. **Screenshot protection:** `FLAG_SECURE` set in `MainActivity.kt` onCreate — blocks screenshots and screen recording app-wide.

---

## Calculator Engine

`engine/calculator.ts` is a **pure function** — no DB calls, no side effects.

**Input:** `CalculationInput` (profile, assets, expenses, goals, SIP params)
**Output:** `CalculationOutput` (fireCorpus, projections[], SIP warning, PV values)

Key functions:
- `calculateProjections(input)` — main entry point
- `calculateFireCorpus(pension, yearsToRetirement, swr, postRetirementExpPV)` — corpus target
- `calculateRequiredSIP(...)` — binary search to find SIP needed to hit corpus at retirement
- `calculatePresentValueOfExpenses(profile, expenses, retirementAge)` — for expense banner
- `formatCurrency(amount, currency)` — INR formatting (K/L/Cr) or USD

---

## Key Architectural Decisions

### Why single calculator file?
All financial logic in one place makes it easy to audit, test, and reason about.
The UI screens call `calculateProjections` and render results — no financial logic in screens.

### Why SecureStore for PIN (not SQLite)?
SQLite on Android can be read if the device is rooted or the APK is extracted.
`expo-secure-store` uses Android Keystore (hardware-backed on supported devices).

### Why no backend/API?
All user financial data stays on-device. No server, no cloud sync, no accounts.
This is a privacy-first design decision.

### Why local-time date parsing in DateInput?
`new Date("2000-01-01T00:00:00")` parses as UTC, showing Dec 31 in UTC+ timezones.
Fixed to use `new Date(year, month-1, day)` which is local time.

### Why FLAG_SECURE in MainActivity?
Financial data should never appear in screenshots, screen recordings, or recent apps thumbnails.
Applied at the Activity level so it covers the entire app without per-screen logic.
