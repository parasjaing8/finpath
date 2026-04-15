# Finpath — Knowledge Graph Navigation Index

> Entry point for Claude Code. Read this before using Glob or Grep.
> If you know what you need to change, go directly to the section below.
> Last regenerated: 2026-04-15 (graphify 0.4.12 — 145 nodes, 161 edges)

---

## Quick lookup: "I need to change X"

| Task | Primary file | Secondary file |
|---|---|---|
| FIRE / SIP calculation logic | `engine/calculator.ts` | `kb/FINANCIAL_MODEL.md` |
| Blended growth rate | `engine/calculator.ts` → `computeBlendedGrowthRate()` | `constants/categories.ts` → `DEFAULT_GROWTH_RATES` |
| Expense PV / projection | `engine/calculator.ts` → `calculateExpenseForYear()` | — |
| Dashboard chart / display | `app/(tabs)/dashboard.tsx` | `engine/calculator.ts` |
| Asset add/edit/delete | `app/(tabs)/assets.tsx` | `db/queries.ts` |
| Expense add/edit/delete | `app/(tabs)/expenses.tsx` | `db/queries.ts` |
| Goals / FIRE type / inflation slider | `app/(tabs)/goals.tsx` | `engine/calculator.ts` |
| Profile info / biometric toggle | `app/(tabs)/profile.tsx` | `db/queries.ts` |
| PIN login / biometric login | `app/login.tsx` | `db/queries.ts` |
| New profile creation | `app/onboarding/create-profile.tsx` | `db/queries.ts` → `createProfile()` |
| Database schema / migrations | `db/schema.ts` | — |
| All DB CRUD operations | `db/queries.ts` | — |
| SecureStore keys (PIN, biometric) | `db/queries.ts` L1–L130 | — |
| Asset / expense categories | `constants/categories.ts` | — |
| Default growth / inflation rates | `constants/categories.ts` → `DEFAULT_GROWTH_RATES` / `DEFAULT_INFLATION_RATES` | — |
| CSV export | `utils/export.ts` → `exportToCSV()` | — |
| IAP / Pro paywall | `hooks/usePro.tsx` | `components/ProPaywall.tsx` |
| Inflation / PV utilities | `utils/inflation.ts` | — |
| Date picker | `components/DateInput.tsx` | — |
| CorpusPrimer onboarding dialog | `components/CorpusPrimer.tsx` | — |
| App root / error boundary | `app/_layout.tsx` | — |
| Tab bar layout / tab order | `app/(tabs)/_layout.tsx` | — |
| App entry / first-run detection | `app/index.tsx` | — |
| Build signing plugin | `plugins/withReleaseSigning.js` | `kb/` build docs |
| Unit tests | `__tests__/calculator.test.ts` | `__tests__/inflation.test.ts` |
| Test mock for db/queries | `__tests__/__mocks__/queries.ts` | — |

---

## God nodes (most connected — touch these carefully)

| Node | Edges | File | Why it matters |
|---|---|---|---|
| `calculateProjections()` | 9 | `engine/calculator.ts` | Main FIRE output — every screen reads this |
| `calculateExpenseForYear()` | 6 | `engine/calculator.ts` | Called in 3 loops (PV, projection, binary search) |
| `ErrorBoundary` | 5 | `app/_layout.tsx` | Wraps entire app; changes affect all screens |
| `pinKey()` | 4 | `db/queries.ts` | SecureStore key format — changing breaks existing logins |
| `getFrequencyMultiplier()` | 4 | `engine/calculator.ts` | Used by expenses + vesting; wrong value = wrong corpus |
| `calculateVestingForYear()` | 4 | `engine/calculator.ts` | ESOP income in projections and SIP binary search |
| `calculateRequiredSIP()` | 4 | `engine/calculator.ts` | Binary search entry; calls `simulateCorpusAtAge()` |

---

## Module map (by community)

### Community 0 — Auth & Profile DB (`db/queries.ts`)
All SQLite and SecureStore operations. No calculation logic here.

Functions:
- `pinKey(profileId)` — SecureStore key name for PIN hash
- `biometricKey(profileId)` — SecureStore key name for biometric flag
- `getAllProfiles()` / `getProfile(id)` / `createProfile()` / `updateProfile()` / `deleteProfile()`
- `getProfilePin(id)` / `saveProfilePin()` / `deleteProfilePin()`
- `getBiometricEnabled()` / `setBiometricEnabled()`
- `recordFailedAttempt(id)` / `resetFailedAttempts(id)`
- `getAssets(profileId)` / `createAsset()` / `updateAsset()` / `deleteAsset()` / `getTotalNetWorth()`
- `getExpenses(profileId)` / `createExpense()` / `updateExpense()` / `deleteExpense()`
- `getGoals(profileId)` / `saveGoals()`

### Community 1 — Calculator Engine (`engine/calculator.ts`)
Pure functions. No DB calls. No side effects.

Exported:
- `calculateProjections(input: CalculationInput): CalculationOutput` ← main entry
- `calculatePresentValueOfExpenses(profile, expenses, retirementAge, discountRate)`
- `formatCurrency(amount, currency)` — K / L / Cr / USD
- `formatCurrencyFull(amount, currency)`
- `FIRE_WITHDRAWAL_RATES` — `{ fat:3, moderate:5, slim:7 }`
- `FIRE_TARGET_AGES` — `{ slim:85, moderate:100, fat:120 }`
- `PENSION_INFLATION_RATE` — `0.06`
- `DEFAULT_DISCOUNT_RATE` — `0.06`

Internal (not exported — call via `calculateProjections`):
- `getAge(dob, onDate?)` — age from DOB string
- `getFrequencyMultiplier(freq)` — MONTHLY=12, QUARTERLY=4, HALF_YEARLY=2, YEARLY=1
- `calculateExpenseForYear(expense, targetYear, currentYear, currentMonth)`
- `calculateVestingForYear(assets, targetYear)`
- `computeBlendedGrowthRate(assets, fallbackRate)`
- `calculateFireCorpus(pension, yearsToRetirement, swr, postRetExpPV)` ← formula-based (legacy)
- `calculateSimulationFireCorpus(...)` ← binary search (used by main flow)
- `calculateRequiredSIP(...)` ← binary search for monthly SIP
- `simulateCorpusAtAge(...)` ← single lifecycle pass used by both binary searches
- `simulatePostRetirementCorpus(...)` ← post-retirement only pass

### Community 2 — Test helpers (`__tests__/calculator.test.ts`)
`makeDob()`, `makeProfile()`, `makeGoals()`, `makeMFAsset()`, `makeSavingsAsset()`, `baseInput()`

### Community 3/6 — Form handlers (screens)
`handleSave()`, `openForm()`, `resetForm()`, `validate()` — appear in assets.tsx and expenses.tsx

### Community 7 — Date picker (`components/DateInput.tsx`)
`confirmDate()`, `daysInMonth()`, `openPicker()`, `pad()`, `parseDate()`
Pure JS, no native modules. Local-time safe.

### Community 8 — CorpusPrimer (`components/CorpusPrimer.tsx`)
`check()`, `dialogKey()`, `dismissDialog()`, `dismissHint()`, `hintKey()`
First-run onboarding dialog + inline lightbulb hint on Goals screen.

### Community 10 — Login (`app/login.tsx`)
`handleLogin()`, `hashPin()`, `selectProfile()`, `triggerBiometric()`

### Community 17 — DB Schema (`db/schema.ts`)
`getDatabase()`, `initializeDatabase()` — 8-version migration system

### Community 22 — CSV Export (`utils/export.ts`)
`exportToCSV()` — assets + expenses + projections → share sheet. Pro-gated.

### Community 23 — ProPaywall (`components/ProPaywall.tsx`)
`handleDismiss()` — IAP bottom sheet

---

## Data flow (session context)

```
SQLite (expo-sqlite)
  └── db/queries.ts          getAssets(), getExpenses(), getGoals()
        └── app/(tabs)/*.tsx  reads data, calls calculateProjections()
              └── engine/calculator.ts  pure calculation
                    └── CalculationOutput displayed on dashboard.tsx
```

SecureStore (expo-secure-store):
- PIN hash: `finpath_pin_{id}` = `salt$sha256(salt+pin)`
- Biometric enabled: `finpath_biometric_{id}` = `"1"`
- Pro status: `finpath_pro_status` = `"1"`

---

## File list (all source files, for reference)

```
app/
  _layout.tsx              Root layout, ErrorBoundary, providers
  index.tsx                Entry point, first-run detection
  login.tsx                Profile select + PIN/biometric auth
  (tabs)/
    _layout.tsx            Tab bar (Assets > Expenses > Goal > Dashboard > Profile)
    assets.tsx             Asset CRUD + pie chart
    expenses.tsx           Expense CRUD + PV banner
    goals.tsx              FIRE goals + inflation slider
    dashboard.tsx          Projections + chart + CSV export
    profile.tsx            Profile settings + logout
  onboarding/
    create-profile.tsx     New profile wizard
    edit-profile.tsx       Edit profile

components/
  CorpusPrimer.tsx         Onboarding dialog + hint
  DateInput.tsx            Pure-JS date picker
  ProPaywall.tsx           IAP upgrade sheet

constants/
  categories.ts            ASSET_CATEGORIES, EXPENSE_CATEGORIES, FREQUENCIES,
                           DEFAULT_GROWTH_RATES, DEFAULT_INFLATION_RATES

db/
  schema.ts                Schema init + 8-step migration
  queries.ts               All CRUD + SecureStore helpers

engine/
  calculator.ts            FIRE/SIP engine (pure TS)

hooks/
  usePro.tsx               Pro IAP context
  useProfile.tsx           Current profile context

plugins/
  withReleaseSigning.js    Expo config plugin for release signing

utils/
  currency.ts              fetchGoldPrice(), getUSDToINR(), convertToINR()
  export.ts                exportToCSV()
  inflation.ts             inflationAdjusted(), presentValue()

__tests__/
  __mocks__/queries.ts     Type-only mock for Jest
  calculator.test.ts       52 unit tests
  inflation.test.ts        9 unit tests
```

---

## How graphify stays current

- **On every git commit**: post-commit hook runs `graphify update .` automatically (rebuilds graph.json + GRAPH_REPORT.md, AST only, no LLM)
- **Manual refresh after docs/image changes**: run `/graphify --update` in Claude Code session
- **This index**: hand-maintained; update when files are added/removed/renamed
