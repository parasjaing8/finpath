# Graph Report - .  (2026-04-18)

## Corpus Check
- Large corpus: 281 files · ~188,097 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 241 nodes · 301 edges · 43 communities detected
- Extraction: 93% EXTRACTED · 6% INFERRED · 1% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.76)
- Token cost: 37,000 input · 4,900 output

## Community Hubs (Navigation)
- [[_COMMUNITY_DB Queries Layer|DB Queries Layer]]
- [[_COMMUNITY_AES Encryption Helpers|AES Encryption Helpers]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_Core App Context|Core App Context]]
- [[_COMMUNITY_FIRE Calculator Engine|FIRE Calculator Engine]]
- [[_COMMUNITY_Calculator Tests|Calculator Tests]]
- [[_COMMUNITY_Auth  PIN Storage|Auth / PIN Storage]]
- [[_COMMUNITY_Currency & CSV Export|Currency & CSV Export]]
- [[_COMMUNITY_Error Boundary|Error Boundary]]
- [[_COMMUNITY_Android Native Module|Android Native Module]]
- [[_COMMUNITY_Login Screen|Login Screen]]
- [[_COMMUNITY_Assets Screen|Assets Screen]]
- [[_COMMUNITY_Date Input Component|Date Input Component]]
- [[_COMMUNITY_Corpus Primer Dialog|Corpus Primer Dialog]]
- [[_COMMUNITY_Android MainActivity|Android MainActivity]]
- [[_COMMUNITY_AppProvider & State|AppProvider & State]]
- [[_COMMUNITY_Onboarding Create Profile|Onboarding Create Profile]]
- [[_COMMUNITY_Session Lock|Session Lock]]
- [[_COMMUNITY_Goals Screen|Goals Screen]]
- [[_COMMUNITY_Profile Screen|Profile Screen]]
- [[_COMMUNITY_Expenses Screen|Expenses Screen]]
- [[_COMMUNITY_Onboarding Edit Profile|Onboarding Edit Profile]]
- [[_COMMUNITY_Schema Migrations|Schema Migrations]]
- [[_COMMUNITY_Profile Hook|Profile Hook]]
- [[_COMMUNITY_Pro IAP Hook|Pro IAP Hook]]
- [[_COMMUNITY_SQLite Schema|SQLite Schema]]
- [[_COMMUNITY_Onboarding Layout|Onboarding Layout]]
- [[_COMMUNITY_Android Security Plugins|Android Security Plugins]]
- [[_COMMUNITY_Keyboard Scroll Compat|Keyboard Scroll Compat]]
- [[_COMMUNITY_Insight Card Component|Insight Card Component]]
- [[_COMMUNITY_Pro Paywall Component|Pro Paywall Component]]
- [[_COMMUNITY_Colors Hook|Colors Hook]]
- [[_COMMUNITY_Engine Types|Engine Types]]
- [[_COMMUNITY_AES-JS Declaration|AES-JS Declaration]]
- [[_COMMUNITY_App Entry Point|App Entry Point]]
- [[_COMMUNITY_Root Layout|Root Layout]]
- [[_COMMUNITY_Dashboard Screen|Dashboard Screen]]
- [[_COMMUNITY_Tabs Layout|Tabs Layout]]
- [[_COMMUNITY_Release Signing Plugin|Release Signing Plugin]]
- [[_COMMUNITY_Projection Table Component|Projection Table Component]]
- [[_COMMUNITY_Test Mocks|Test Mocks]]
- [[_COMMUNITY_Tabs Layout Config|Tabs Layout Config]]
- [[_COMMUNITY_useColors Hook|useColors Hook]]

## God Nodes (most connected - your core abstractions)
1. `App Context Provider` - 13 edges
2. `Engine Types` - 10 edges
3. `decryptString()` - 9 edges
4. `calculateProjections()` - 9 edges
5. `encryptString()` - 8 edges
6. `DB Queries` - 7 edges
7. `calculateExpenseForYear()` - 6 edges
8. `concat()` - 5 edges
9. `hmacSha256()` - 5 edges
10. `MainActivity` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Profile Screen` --shares_data_with--> `Engine Types`  [INFERRED]
  app/(tabs)/profile.tsx → engine/types.ts
- `Index Screen` --calls--> `DB Queries`  [EXTRACTED]
  app/index.tsx → db/queries.ts
- `Login Screen` --references--> `Session State`  [INFERRED]
  app/login.tsx → storage/session.ts
- `Assets Screen` --shares_data_with--> `Engine Types`  [INFERRED]
  app/(tabs)/assets.tsx → engine/types.ts
- `Expenses Screen` --shares_data_with--> `Engine Types`  [INFERRED]
  app/(tabs)/expenses.tsx → engine/types.ts

## Hyperedges (group relationships)
- **Authentication and Session Flow** — login_loginscreen, db_queries, storage_auth, hooks_useprofile, storage_session [INFERRED 0.82]
- **FIRE Calculation Pipeline** — tabs_dashboardscreen, engine_calculator, engine_types, context_appcontext [INFERRED 0.92]
- **Data Persistence and Migration Layer** — context_appcontext, storage_secure, storage_migrations, storage_session [INFERRED 0.87]
- **Profile Management Flow** — onboarding_createprofile, onboarding_editprofile, db_queries, hooks_useprofile, context_appcontext [INFERRED 0.85]
- **Tab Screens as AppContext Consumers** — tabs_assetsscreen, tabs_expensesscreen, tabs_goalsscreen, tabs_dashboardscreen, tabs_profilescreen, context_appcontext [INFERRED 0.92]
- **React Provider Tree** — layout_rootlayout, context_appcontext, hooks_usepro, hooks_useprofile [INFERRED 0.95]
- **Dashboard Rendering Cluster** — components_herocard_tsx, components_snapshottiles_tsx, components_insightcard_tsx, components_sipcontrols_tsx, components_projectionchart_tsx, components_projectiontable_tsx, components_propaywall_tsx [EXTRACTED 1.00]
- **Potentially Dead / Unused Components** — components_depletiondialog_depletiondialog, components_depletiondialog_corpusinfodialog, components_corpusprimer_tsx [INFERRED 0.80]
- **Android Security Build Plugins** — plugins_withflagsecure_js, plugins_withremovesystemalertwindow_js [INFERRED 0.90]
- **Dual Slider Implementation (CustomSlider vs @miblanchard)** — components_customslider_tsx, components_sipcontrols_tsx, components_projectionchart_tsx [INFERRED 0.85]
- **Unit Test Suite** — tests_calculator_test_ts, tests_inflation_test_ts [EXTRACTED 1.00]
- **Currency / FX Utilities (possibly dead in app)** — utils_currency_fetchgoldprice, utils_currency_getusdtoinr, utils_currency_converttoinr [AMBIGUOUS 0.25]
- **Expo Config Plugins** — plugins_withflagsecure_js, plugins_withreleasesigning_js, plugins_withremovesystemalertwindow_js [INFERRED 0.95]
- **Inflation Math Layer (utils vs engine)** — utils_inflation_inflationadjusted, utils_inflation_presentvalue, tests_inflation_test_ts [INFERRED 0.80]
- **Domain Configuration Constants** — constants_categories_ts, constants_colors_ts, constants_theme_ts [INFERRED 0.80]

## Communities

### Community 0 - "DB Queries Layer"
Cohesion: 0.1
Nodes (9): biometricKey(), createProfile(), deleteProfile(), deleteProfilePin(), getBiometricEnabled(), getProfilePin(), pinKey(), saveProfilePin() (+1 more)

### Community 1 - "AES Encryption Helpers"
Cohesion: 0.2
Nodes (16): base64ToBytes(), bytesToBase64(), concat(), constantTimeEqual(), decryptString(), deriveSubKey(), encryptString(), getDerivedKeys() (+8 more)

### Community 2 - "UI Components"
Cohesion: 0.12
Nodes (5): CorpusInfoDialog component, DepletionDialog component, shadow(), inflationAdjusted(), presentValue()

### Community 3 - "Core App Context"
Cohesion: 0.22
Nodes (19): App Context Provider, DB Queries, DB Schema, Calculator Engine, Engine Types, Pro IAP Hook, Profile Hook, Index Screen (+11 more)

### Community 4 - "FIRE Calculator Engine"
Cohesion: 0.29
Nodes (15): calculateExpenseForYear(), calculatePresentValueOfExpenses(), calculateProjections(), calculateRequiredSIP(), calculateSimulationFireCorpus(), calculateVestingForYear(), computeBlendedGrowthRate(), formatCurrency() (+7 more)

### Community 5 - "Calculator Tests"
Cohesion: 0.21
Nodes (7): baseInput(), makeDob(), makeGoals(), makeMFAsset(), makeProfile(), makeSavingsAsset(), makeSelfUseRealEstate()

### Community 6 - "Auth / PIN Storage"
Cohesion: 0.26
Nodes (9): bytesToBase64(), getCredentials(), hasCredentials(), hashPin(), setBiometricEnabled(), setCredentials(), verifyPin(), Auth Storage (+1 more)

### Community 7 - "Currency & CSV Export"
Cohesion: 0.22
Nodes (2): fetchGoldPrice(), getUSDToINR()

### Community 8 - "Error Boundary"
Cohesion: 0.29
Nodes (1): ErrorBoundary

### Community 9 - "Android Native Module"
Cohesion: 0.29
Nodes (1): MainApplication

### Community 10 - "Login Screen"
Cohesion: 0.53
Nodes (4): handleLogin(), hashPin(), syncToAppContext(), triggerBiometric()

### Community 11 - "Assets Screen"
Cohesion: 0.4
Nodes (2): genId(), handleSave()

### Community 12 - "Date Input Component"
Cohesion: 0.53
Nodes (5): confirmDate(), daysInMonth(), openPicker(), pad(), parseDate()

### Community 13 - "Corpus Primer Dialog"
Cohesion: 0.6
Nodes (5): check(), dialogKey(), dismissDialog(), dismissHint(), hintKey()

### Community 14 - "Android MainActivity"
Cohesion: 0.33
Nodes (1): MainActivity

### Community 15 - "AppProvider & State"
Cohesion: 0.5
Nodes (0): 

### Community 16 - "Onboarding Create Profile"
Cohesion: 0.67
Nodes (2): handleSubmit(), validate()

### Community 17 - "Session Lock"
Cohesion: 0.5
Nodes (0): 

### Community 18 - "Goals Screen"
Cohesion: 0.67
Nodes (0): 

### Community 19 - "Profile Screen"
Cohesion: 0.67
Nodes (0): 

### Community 20 - "Expenses Screen"
Cohesion: 0.67
Nodes (0): 

### Community 21 - "Onboarding Edit Profile"
Cohesion: 1.0
Nodes (2): handleSave(), validate()

### Community 22 - "Schema Migrations"
Cohesion: 0.67
Nodes (0): 

### Community 23 - "Profile Hook"
Cohesion: 0.67
Nodes (0): 

### Community 24 - "Pro IAP Hook"
Cohesion: 0.67
Nodes (0): 

### Community 25 - "SQLite Schema"
Cohesion: 1.0
Nodes (2): getDatabase(), initializeDatabase()

### Community 26 - "Onboarding Layout"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Android Security Plugins"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Keyboard Scroll Compat"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Insight Card Component"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Pro Paywall Component"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Colors Hook"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Engine Types"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "AES-JS Declaration"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "App Entry Point"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Root Layout"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Dashboard Screen"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Tabs Layout"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Release Signing Plugin"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Projection Table Component"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Test Mocks"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Tabs Layout Config"
Cohesion: 1.0
Nodes (1): Tab Layout

### Community 42 - "useColors Hook"
Cohesion: 1.0
Nodes (1): Colors Hook

## Ambiguous Edges - Review These
- `currency.ts` → `HeroCard.tsx`  [AMBIGUOUS]
  utils/currency.ts · relation: shares_data_with
- `SnapshotTiles.tsx` → `DepletionDialog.tsx`  [AMBIGUOUS]
  components/DepletionDialog.tsx · relation: shares_data_with

## Knowledge Gaps
- **4 isolated node(s):** `Tab Layout`, `Colors Hook`, `Auth Storage`, `Session State`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Onboarding Layout`** (2 nodes): `_layout.tsx`, `OnboardingLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Android Security Plugins`** (2 nodes): `withFlagSecure.js`, `withRemoveSystemAlertWindow.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Keyboard Scroll Compat`** (2 nodes): `KeyboardAwareScrollViewCompat.tsx`, `KeyboardAwareScrollViewCompat()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Insight Card Component`** (2 nodes): `InsightCard.tsx`, `InsightCard()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Pro Paywall Component`** (2 nodes): `ProPaywall.tsx`, `handleDismiss()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Colors Hook`** (2 nodes): `useColors.ts`, `useColors()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Engine Types`** (2 nodes): `types.ts`, `getFrequencyMonthsPerPayment()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `AES-JS Declaration`** (1 nodes): `aes-js.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `App Entry Point`** (1 nodes): `index.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Root Layout`** (1 nodes): `_layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dashboard Screen`** (1 nodes): `dashboard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tabs Layout`** (1 nodes): `_layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Release Signing Plugin`** (1 nodes): `withReleaseSigning.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Projection Table Component`** (1 nodes): `ProjectionTable.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Test Mocks`** (1 nodes): `queries.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tabs Layout Config`** (1 nodes): `Tab Layout`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `useColors Hook`** (1 nodes): `Colors Hook`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `currency.ts` and `HeroCard.tsx`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **What is the exact relationship between `SnapshotTiles.tsx` and `DepletionDialog.tsx`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **Why does `Engine Types` connect `Core App Context` to `FIRE Calculator Engine`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `DB Schema` connect `Core App Context` to `DB Queries Layer`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `App Context Provider` connect `Core App Context` to `Auth / PIN Storage`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `Engine Types` (e.g. with `Assets Screen` and `Expenses Screen`) actually correct?**
  _`Engine Types` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Tab Layout`, `Colors Hook`, `Auth Storage` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._