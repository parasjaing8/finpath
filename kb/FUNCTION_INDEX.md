# Finpath — Function Index

> Quick lookup: function name → file path → approximate line.
> Use this before reading source files or running Grep.
> Last updated: 2026-04-15

---

## engine/calculator.ts

| Function | Exported | ~Line | Purpose |
|---|---|---|---|
| `getAge(dob, onDate?)` | No | L63 | Age in years from DOB string |
| `getFrequencyMultiplier(freq)` | No | L71 | MONTHLY→12, QUARTERLY→4, etc. |
| `calculateExpenseForYear(expense, targetYear, currentYear, currentMonth)` | No | L77 | Annual cost of one expense in a given year (handles inflation + proration) |
| `calculateVestingForYear(assets, targetYear)` | No | L126 | Total ESOP vesting income in a given year |
| `calculateFireCorpus(pension, yearsToRetirement, swr, postRetExpPV)` | No | L155 | Formula-based FIRE corpus (SWR method) — used for display |
| `computeBlendedGrowthRate(assets, fallbackRate)` | No | L169 | Weighted avg growth rate across all investable assets |
| `calculateProjections(input)` | **Yes** | L183 | Main entry: year-by-year projection, FIRE corpus, required SIP |
| `calculatePresentValueOfExpenses(profile, expenses, retirementAge, discountRate)` | **Yes** | L363 | PV of pre-retirement expenses (expense screen banner) |
| `simulatePostRetirementCorpus(startCorpus, ...)` | No | L385 | Post-retirement corpus simulation (no clamping, for binary search) |
| `calculateSimulationFireCorpus(expenses, ...)` | No | L413 | Binary search for minimum corpus at retirement surviving to fireTargetAge |
| `calculateRequiredSIP(initialNetWorth, ...)` | No | L448 | Binary search for monthly SIP (full lifecycle) |
| `simulateCorpusAtAge(initialNetWorth, ...)` | No | L490 | Full pre+post lifecycle corpus at targetAge — used by binary searches |
| `formatCurrency(amount, currency?)` | **Yes** | L560 | INR: K/L/Cr notation; USD: localeString |
| `formatCurrencyFull(amount, currency?)` | **Yes** | L572 | Full INR number with locale commas |
| `FIRE_WITHDRAWAL_RATES` | **Yes** | L150 | `{ fat:3, moderate:5, slim:7 }` |
| `FIRE_TARGET_AGES` | **Yes** | L157 | `{ slim:85, moderate:100, fat:120 }` |
| `PENSION_INFLATION_RATE` | **Yes** | L5 | `0.06` |
| `DEFAULT_DISCOUNT_RATE` | **Yes** | L8 | `0.06` |

---

## db/queries.ts

| Function | ~Line | Purpose |
|---|---|---|
| `pinKey(profileId)` | L6 | SecureStore key: `finpath_pin_{id}` |
| `biometricKey(profileId)` | L5 | SecureStore key: `finpath_biometric_{id}` |
| `getAllProfiles()` | L69 | Array of all profiles (for login screen) |
| `getProfile(id)` | L76 | Single profile by id |
| `getProfilePin(id)` | L89 | PIN hash from SecureStore (falls back to SQLite + migrates) |
| `saveProfilePin(profileId, hashedPin)` | L110 | Store PIN hash in SecureStore |
| `deleteProfilePin(profileId)` | L115 | Remove PIN from SecureStore |
| `getBiometricEnabled(profileId)` | L120 | Boolean: biometric enabled? |
| `setBiometricEnabled(profileId, enabled)` | L126 | Enable/disable biometric for profile |
| `updateProfile(id, income, currency, dob?)` | L137 | Edit profile fields |
| `deleteProfile(profileId)` | L146 | Delete profile + SecureStore keys |
| `createProfile(name, dob, income, currency, pin)` | L153 | Insert profile + store PIN in SecureStore |
| `recordFailedAttempt(id)` | L171 | Increment failed_attempts, set lockout_until |
| `resetFailedAttempts(id)` | L190 | Clear lockout state on successful login |
| `getAssets(profileId)` | L197 | All assets for profile |
| `createAsset(asset)` | L202 | Insert asset row |
| `updateAsset(asset)` | L219 | Update asset row |
| `deleteAsset(id)` | L235 | Delete asset by id |
| `getTotalNetWorth(profileId)` | L240 | SUM(current_value) for profile |
| `getExpenses(profileId)` | L251 | All expenses for profile |
| `createExpense(expense)` | L259 | Insert expense row |
| `updateExpense(expense)` | L274 | Update expense row |
| `deleteExpense(id)` | L288 | Delete expense by id |
| `getGoals(profileId)` | L295 | Goals row for profile (or null) |
| `saveGoals(profileId, ...)` | L300 | INSERT OR UPDATE goals row |

---

## db/schema.ts

| Function | ~Line | Purpose |
|---|---|---|
| `getDatabase()` | — | Returns initialized SQLite DB instance (singleton) |
| `initializeDatabase()` | — | Runs CREATE TABLE + 8-step migration system |

---

## constants/categories.ts

| Export | Type | Notes |
|---|---|---|
| `ASSET_CATEGORIES` | const array | 9 categories: ESOP_RSU, STOCKS, MUTUAL_FUND, SAVINGS, GOLD_SILVER, PF, NPS, REAL_ESTATE, OTHERS |
| `EXPENSE_CATEGORIES` | const array | 10 categories with `defaultInflation` per category |
| `EXPENSE_TYPES` | const array | CURRENT_RECURRING, FUTURE_ONE_TIME, FUTURE_RECURRING |
| `FREQUENCIES` | const array | MONTHLY(×12), QUARTERLY(×4), HALF_YEARLY(×2), YEARLY(×1) |
| `DEFAULT_GROWTH_RATES` | Record | ESOP_RSU/STOCKS/MUTUAL_FUND=12%, SAVINGS=7%, GOLD_SILVER/PF=8%, NPS=10%, REAL_ESTATE=9%, OTHERS=8% |
| `DEFAULT_INFLATION_RATES` | Record | GENERAL/RENT/etc=6%, EDUCATION=10%, MEDICAL=8%, EMI=0% |

---

## utils/inflation.ts

| Function | Exported | Purpose |
|---|---|---|
| `inflationAdjusted(amount, inflationRate, years)` | Yes | `amount * (1 + rate/100)^years` |
| `presentValue(futureAmount, discountRate, years)` | Yes | `futureAmount / (1 + rate/100)^years` |

---

## utils/currency.ts

| Function | Exported | Purpose |
|---|---|---|
| `fetchGoldPrice(metal, currency)` | Yes | goldapi.io price per gram (XAU/XAG in INR/USD); hardcoded fallback if no key |
| `getUSDToINR()` | Yes | open.er-api.com rate; 24h cache; fallback 83 |
| `convertToINR(amount, currency, usdToInrRate)` | Yes | USD→INR conversion |

---

## utils/export.ts

| Function | Exported | Purpose |
|---|---|---|
| `exportToCSV()` | Yes | Assets + expenses + projections → CSV → share sheet. Pro-gated. |

---

## components/DateInput.tsx

| Function | Notes |
|---|---|
| `DateInput` (default export) | Pure-JS ScrollView date picker. Props: value, onChange, minimumDate, maximumDate |
| `parseDate(str)` | Parses YYYY-MM-DD string |
| `daysInMonth(year, month)` | Days in a given month |
| `pad(n)` | Zero-pad to 2 digits |
| `openPicker()` | Shows bottom sheet |
| `confirmDate()` | Validates and calls onChange |

---

## components/CorpusPrimer.tsx

| Function | Notes |
|---|---|
| `CorpusPrimer` (default export) | Shows full dialog on first visit to Goals; lightbulb hint on subsequent visits |
| `hintKey(profileId)` | AsyncStorage key for hint dismissed state |
| `dialogKey(profileId)` | AsyncStorage key for dialog dismissed state |
| `check()` | Reads AsyncStorage to decide what to show |
| `dismissDialog()` | Sets dialog key, shows hint |
| `dismissHint()` | Sets hint key |

---

## hooks/usePro.tsx

| Export | Notes |
|---|---|
| `ProProvider` | Context provider — wrap at root |
| `usePro()` | Returns `{ isPro, purchasePro, restorePurchases }` |
| `purchasePro()` | Triggers Play Billing for `finpath_pro` SKU |
| `restorePurchases()` | Calls `getAvailablePurchases()`, matches `finpath_pro` SKU |
| `unlockPro()` | Sets `finpath_pro_status = "1"` in SecureStore |

---

## hooks/useProfile.tsx

| Export | Notes |
|---|---|
| `ProfileProvider` | Context provider — wrap at root |
| `useProfile()` | Returns `{ currentProfile, setCurrentProfileId, logout }` |

---

## app/login.tsx

| Function | ~Line | Notes |
|---|---|---|
| `selectProfile(profile)` | L48 | Loads profile, checks lockout, triggers biometric if enrolled |
| `triggerBiometric(profile)` | L62 | expo-local-authentication prompt |
| `hashPin(pin, salt?)` | L91 | SHA-256(salt + pin) via expo-crypto |
| `handleLogin()` | L103 | Validates PIN, calls recordFailedAttempt or login |

---

## app/(tabs)/dashboard.tsx

Key state / derived data:
- Reads from ProfileContext + SQLite (assets, expenses, goals)
- Calls `calculateProjections()` on every render with current sipAmount, rates
- Renders: hero card (FIRE status), net worth chart (Victory Native + Skia), year table, CSV button

---

## app/(tabs)/goals.tsx

Key state:
- `retirement_age`, `sip_stop_age`, `pension_income`, `fire_type`, `fire_target_age`, `inflation_rate`
- Writes to `goals` table via `saveGoals()`
- Renders: CorpusPrimer + FIRE type chips + inflation slider + withdrawal input with future-value hint

---

## Type interfaces (from db/queries.ts, used everywhere)

```typescript
Profile   { id, name, dob, monthly_income, currency, failed_attempts, lockout_until, created_at }
Asset     { id, profile_id, category, name, current_value, currency, expected_roi,
            is_recurring, recurring_amount, recurring_frequency, next_vesting_date,
            vesting_end_date, is_self_use, gold_silver_unit, gold_silver_quantity }
Expense   { id, profile_id, name, category, amount, currency, expense_type,
            frequency, start_date, end_date, inflation_rate }
Goals     { id, profile_id, retirement_age, sip_stop_age, pension_income, fire_type,
            fire_target_age, withdrawal_rate, inflation_rate }
FireType  = 'slim' | 'moderate' | 'fat' | 'custom'
```

---

## CalculationInput / CalculationOutput (engine/calculator.ts)

```typescript
CalculationInput {
  profile: Profile
  assets: Asset[]
  expenses: Expense[]
  goals: Goals
  sipAmount: number          // current monthly SIP (user-set slider on dashboard)
  sipReturnRate: number      // % p.a. for SIP accumulation (default 12)
  postSipReturnRate: number  // % p.a. post-retirement / coast (default 8)
  stepUpRate: number         // annual SIP step-up % (default 5)
}

CalculationOutput {
  fireCorpus: number                // target corpus at retirement
  requiredMonthlySIP: number        // binary-search result
  timeToFire: number                // years until FIRE achieved (-1 if never)
  fireAchievedAge: number           // age at FIRE (-1 if never)
  isOnTrack: boolean                // sipAmount >= requiredMonthlySIP
  projections: YearProjection[]     // age 30..100 (one entry per year)
  presentValueOfExpenses: number    // expense screen row 1
  postRetirementExpensesPV: number  // expense screen row 2
  investableNetWorth: number        // excludes self-use real estate
  totalNetWorth: number             // all assets
  sipBurdenWarning: string | null   // income adequacy warning text
  netWorthAtRetirement: number
  netWorthAtAge100: number
  failureAge: number                // age corpus depletes (-1 if survives)
}
```
