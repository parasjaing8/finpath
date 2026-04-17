# Graph Report - /Users/parasjain/finpath  (2026-04-17)

## Corpus Check
- 100 files · ~99,999 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 336 nodes · 404 edges · 88 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_API Client  Fetch Layer|API Client / Fetch Layer]]
- [[_COMMUNITY_SQLite Database Queries|SQLite Database Queries]]
- [[_COMMUNITY_AES Encrypted Storage|AES Encrypted Storage]]
- [[_COMMUNITY_Replit V2 Build Scripts|Replit V2 Build Scripts]]
- [[_COMMUNITY_FIRE Calculator Engine|FIRE Calculator Engine]]
- [[_COMMUNITY_Legacy Calculator Reference|Legacy Calculator Reference]]
- [[_COMMUNITY_Calculator Unit Tests|Calculator Unit Tests]]
- [[_COMMUNITY_Auth  Biometric Storage|Auth / Biometric Storage]]
- [[_COMMUNITY_Assets Screen|Assets Screen]]
- [[_COMMUNITY_Android App Entrypoint|Android App Entrypoint]]
- [[_COMMUNITY_DateInput Component|DateInput Component]]
- [[_COMMUNITY_Error Boundary|Error Boundary]]
- [[_COMMUNITY_Corpus Primer Component|Corpus Primer Component]]
- [[_COMMUNITY_Android Main Activity|Android Main Activity]]
- [[_COMMUNITY_Health Check API|Health Check API]]
- [[_COMMUNITY_App Context  State|App Context / State]]
- [[_COMMUNITY_Login  Auth Screen|Login / Auth Screen]]
- [[_COMMUNITY_Replit Dev Server|Replit Dev Server]]
- [[_COMMUNITY_SimpleChart Component|SimpleChart Component]]
- [[_COMMUNITY_Onboarding Flow|Onboarding Flow]]
- [[_COMMUNITY_Goals Screen|Goals Screen]]
- [[_COMMUNITY_Profile Screen|Profile Screen]]
- [[_COMMUNITY_Expenses Screen|Expenses Screen]]
- [[_COMMUNITY_Create Profile Screen|Create Profile Screen]]
- [[_COMMUNITY_Currency Conversion Utils|Currency Conversion Utils]]
- [[_COMMUNITY_Session Lock Manager|Session Lock Manager]]
- [[_COMMUNITY_Error Fallback UI|Error Fallback UI]]
- [[_COMMUNITY_App Entry Index|App Entry Index]]
- [[_COMMUNITY_Lock  PIN Screen|Lock / PIN Screen]]
- [[_COMMUNITY_Edit Profile Screen|Edit Profile Screen]]
- [[_COMMUNITY_Inflation Calculations|Inflation Calculations]]
- [[_COMMUNITY_Storage Migrations|Storage Migrations]]
- [[_COMMUNITY_Keyboard Aware Scroll|Keyboard Aware Scroll]]
- [[_COMMUNITY_Custom Slider Component|Custom Slider Component]]
- [[_COMMUNITY_Profile Provider Hook|Profile Provider Hook]]
- [[_COMMUNITY_Pro IAP Provider Hook|Pro IAP Provider Hook]]
- [[_COMMUNITY_Colors  Theme Hook|Colors / Theme Hook]]
- [[_COMMUNITY_SQLite Schema|SQLite Schema]]
- [[_COMMUNITY_Onboarding Layout|Onboarding Layout]]
- [[_COMMUNITY_Theme Constants|Theme Constants]]
- [[_COMMUNITY_CSV Export Utility|CSV Export Utility]]
- [[_COMMUNITY_InsightCard Component|InsightCard Component]]
- [[_COMMUNITY_ProjectionChart Component|ProjectionChart Component]]
- [[_COMMUNITY_Pro Paywall Component|Pro Paywall Component]]
- [[_COMMUNITY_Orval API Config|Orval API Config]]
- [[_COMMUNITY_Not Found Screen|Not Found Screen]]
- [[_COMMUNITY_Snapshot Tiles Component|Snapshot Tiles Component]]
- [[_COMMUNITY_Engine Types|Engine Types]]
- [[_COMMUNITY_Tab Layout|Tab Layout]]
- [[_COMMUNITY_Dashboard Screen|Dashboard Screen]]
- [[_COMMUNITY_Root Layout|Root Layout]]
- [[_COMMUNITY_FlagSecure Plugin|FlagSecure Plugin]]
- [[_COMMUNITY_Release Signing Plugin|Release Signing Plugin]]
- [[_COMMUNITY_System Alert Plugin|System Alert Plugin]]
- [[_COMMUNITY_Color Constants|Color Constants]]
- [[_COMMUNITY_Category Constants|Category Constants]]
- [[_COMMUNITY_HeroCard Component|HeroCard Component]]
- [[_COMMUNITY_SnapshotTiles Component|SnapshotTiles Component]]
- [[_COMMUNITY_SIPControls Component|SIPControls Component]]
- [[_COMMUNITY_DepletionDialog Component|DepletionDialog Component]]
- [[_COMMUNITY_ProjectionTable Component|ProjectionTable Component]]
- [[_COMMUNITY_Inflation Tests|Inflation Tests]]
- [[_COMMUNITY_V2 DB Queries|V2 DB Queries]]
- [[_COMMUNITY_Hello Util|Hello Util]]
- [[_COMMUNITY_Index Module A|Index Module A]]
- [[_COMMUNITY_API Client Module|API Client Module]]
- [[_COMMUNITY_Index Module B|Index Module B]]
- [[_COMMUNITY_Health Status|Health Status]]
- [[_COMMUNITY_Drizzle Config|Drizzle Config]]
- [[_COMMUNITY_Index Module C|Index Module C]]
- [[_COMMUNITY_Index Module D|Index Module D]]
- [[_COMMUNITY_Index Module E|Index Module E]]
- [[_COMMUNITY_API Schemas|API Schemas]]
- [[_COMMUNITY_Dashboard (Fin Dashboard)|Dashboard (Fin Dashboard)]]
- [[_COMMUNITY_ProjectionChart (Fin Dashboard)|ProjectionChart (Fin Dashboard)]]
- [[_COMMUNITY_Expo Type Declarations|Expo Type Declarations]]
- [[_COMMUNITY_Metro Config|Metro Config]]
- [[_COMMUNITY_Babel Config|Babel Config]]
- [[_COMMUNITY_V2 Tab Layout|V2 Tab Layout]]
- [[_COMMUNITY_V2 Dashboard|V2 Dashboard]]
- [[_COMMUNITY_V2 Root Layout|V2 Root Layout]]
- [[_COMMUNITY_V2 Color Constants|V2 Color Constants]]
- [[_COMMUNITY_InsightCard V2|InsightCard V2]]
- [[_COMMUNITY_HeroCard V2 Ref|HeroCard V2 Ref]]
- [[_COMMUNITY_SIPControls V2 Ref|SIPControls V2 Ref]]
- [[_COMMUNITY_DepletionDialog V2 Ref|DepletionDialog V2 Ref]]
- [[_COMMUNITY_ProjectionTable V2|ProjectionTable V2]]
- [[_COMMUNITY_Engine Types V2|Engine Types V2]]

## God Nodes (most connected - your core abstractions)
1. `main()` - 12 edges
2. `calculateProjections()` - 10 edges
3. `decryptString()` - 9 edges
4. `customFetch()` - 9 edges
5. `calculateProjections()` - 9 edges
6. `encryptString()` - 8 edges
7. `parseErrorBody()` - 8 edges
8. `calculateExpenseForYear()` - 6 edges
9. `calculateExpenseForYear()` - 6 edges
10. `concat()` - 5 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "API Client / Fetch Layer"
Cohesion: 0.15
Nodes (22): ApiError, applyBaseUrl(), buildErrorMessage(), customFetch(), getMediaType(), getStringField(), hasNoBody(), inferResponseType() (+14 more)

### Community 1 - "SQLite Database Queries"
Cohesion: 0.1
Nodes (9): biometricKey(), createProfile(), deleteProfile(), deleteProfilePin(), getBiometricEnabled(), getProfilePin(), pinKey(), saveProfilePin() (+1 more)

### Community 2 - "AES Encrypted Storage"
Cohesion: 0.2
Nodes (16): base64ToBytes(), bytesToBase64(), concat(), constantTimeEqual(), decryptString(), deriveSubKey(), encryptString(), getDerivedKeys() (+8 more)

### Community 3 - "Replit V2 Build Scripts"
Cohesion: 0.19
Nodes (18): checkMetroHealth(), clearMetroCache(), downloadAssets(), downloadBundle(), downloadBundlesAndManifests(), downloadFile(), downloadManifest(), exitWithError() (+10 more)

### Community 4 - "FIRE Calculator Engine"
Cohesion: 0.37
Nodes (14): calculateExpenseForYear(), calculateProjections(), calculateRequiredSIP(), calculateSimulationFireCorpus(), calculateVestingForYear(), computeBlendedGrowthRate(), formatCurrency(), formatCurrencyFull() (+6 more)

### Community 5 - "Legacy Calculator Reference"
Cohesion: 0.3
Nodes (12): calculateExpenseForYear(), calculatePresentValueOfExpenses(), calculateProjections(), calculateRequiredSIP(), calculateSimulationFireCorpus(), calculateVestingForYear(), computeBlendedGrowthRate(), formatCurrency() (+4 more)

### Community 6 - "Calculator Unit Tests"
Cohesion: 0.26
Nodes (7): baseInput(), makeDob(), makeGoals(), makeMFAsset(), makeProfile(), makeSavingsAsset(), makeSelfUseRealEstate()

### Community 7 - "Auth / Biometric Storage"
Cohesion: 0.33
Nodes (7): bytesToBase64(), getCredentials(), hasCredentials(), hashPin(), setBiometricEnabled(), setCredentials(), verifyPin()

### Community 8 - "Assets Screen"
Cohesion: 0.52
Nodes (5): genId(), handleDelete(), handleSave(), openAdd(), openEdit()

### Community 9 - "Android App Entrypoint"
Cohesion: 0.29
Nodes (1): MainApplication

### Community 10 - "DateInput Component"
Cohesion: 0.53
Nodes (5): confirmDate(), daysInMonth(), openPicker(), pad(), parseDate()

### Community 11 - "Error Boundary"
Cohesion: 0.33
Nodes (1): ErrorBoundary

### Community 12 - "Corpus Primer Component"
Cohesion: 0.6
Nodes (5): check(), dialogKey(), dismissDialog(), dismissHint(), hintKey()

### Community 13 - "Android Main Activity"
Cohesion: 0.33
Nodes (1): MainActivity

### Community 14 - "Health Check API"
Cohesion: 0.53
Nodes (5): getHealthCheckQueryKey(), getHealthCheckQueryOptions(), getHealthCheckUrl(), healthCheck(), useHealthCheck()

### Community 15 - "App Context / State"
Cohesion: 0.5
Nodes (2): AppProvider(), useApp()

### Community 16 - "Login / Auth Screen"
Cohesion: 0.5
Nodes (2): handleLogin(), hashPin()

### Community 17 - "Replit Dev Server"
Cohesion: 0.4
Nodes (0): 

### Community 18 - "SimpleChart Component"
Cohesion: 0.4
Nodes (0): 

### Community 19 - "Onboarding Flow"
Cohesion: 0.67
Nodes (2): onSubmit(), showError()

### Community 20 - "Goals Screen"
Cohesion: 0.67
Nodes (2): handleSave(), InfoRow()

### Community 21 - "Profile Screen"
Cohesion: 0.5
Nodes (1): handleSave()

### Community 22 - "Expenses Screen"
Cohesion: 0.67
Nodes (2): ExpensesScreen(), genId()

### Community 23 - "Create Profile Screen"
Cohesion: 0.67
Nodes (2): handleSubmit(), validate()

### Community 24 - "Currency Conversion Utils"
Cohesion: 0.5
Nodes (0): 

### Community 25 - "Session Lock Manager"
Cohesion: 0.5
Nodes (0): 

### Community 26 - "Error Fallback UI"
Cohesion: 0.5
Nodes (1): handleRestart()

### Community 27 - "App Entry Index"
Cohesion: 0.67
Nodes (1): Index()

### Community 28 - "Lock / PIN Screen"
Cohesion: 0.67
Nodes (0): 

### Community 29 - "Edit Profile Screen"
Cohesion: 1.0
Nodes (2): handleSave(), validate()

### Community 30 - "Inflation Calculations"
Cohesion: 0.67
Nodes (0): 

### Community 31 - "Storage Migrations"
Cohesion: 0.67
Nodes (0): 

### Community 32 - "Keyboard Aware Scroll"
Cohesion: 0.67
Nodes (1): KeyboardAwareScrollViewCompat()

### Community 33 - "Custom Slider Component"
Cohesion: 0.67
Nodes (1): handleLayout()

### Community 34 - "Profile Provider Hook"
Cohesion: 0.67
Nodes (0): 

### Community 35 - "Pro IAP Provider Hook"
Cohesion: 0.67
Nodes (0): 

### Community 36 - "Colors / Theme Hook"
Cohesion: 0.67
Nodes (1): useColors()

### Community 37 - "SQLite Schema"
Cohesion: 1.0
Nodes (2): getDatabase(), initializeDatabase()

### Community 38 - "Onboarding Layout"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Theme Constants"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "CSV Export Utility"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "InsightCard Component"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "ProjectionChart Component"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Pro Paywall Component"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Orval API Config"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Not Found Screen"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Snapshot Tiles Component"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Engine Types"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Tab Layout"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Dashboard Screen"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Root Layout"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "FlagSecure Plugin"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Release Signing Plugin"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "System Alert Plugin"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Color Constants"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Category Constants"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "HeroCard Component"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "SnapshotTiles Component"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "SIPControls Component"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "DepletionDialog Component"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "ProjectionTable Component"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "Inflation Tests"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "V2 DB Queries"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Hello Util"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Index Module A"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "API Client Module"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "Index Module B"
Cohesion: 1.0
Nodes (0): 

### Community 67 - "Health Status"
Cohesion: 1.0
Nodes (0): 

### Community 68 - "Drizzle Config"
Cohesion: 1.0
Nodes (0): 

### Community 69 - "Index Module C"
Cohesion: 1.0
Nodes (0): 

### Community 70 - "Index Module D"
Cohesion: 1.0
Nodes (0): 

### Community 71 - "Index Module E"
Cohesion: 1.0
Nodes (0): 

### Community 72 - "API Schemas"
Cohesion: 1.0
Nodes (0): 

### Community 73 - "Dashboard (Fin Dashboard)"
Cohesion: 1.0
Nodes (0): 

### Community 74 - "ProjectionChart (Fin Dashboard)"
Cohesion: 1.0
Nodes (0): 

### Community 75 - "Expo Type Declarations"
Cohesion: 1.0
Nodes (0): 

### Community 76 - "Metro Config"
Cohesion: 1.0
Nodes (0): 

### Community 77 - "Babel Config"
Cohesion: 1.0
Nodes (0): 

### Community 78 - "V2 Tab Layout"
Cohesion: 1.0
Nodes (0): 

### Community 79 - "V2 Dashboard"
Cohesion: 1.0
Nodes (0): 

### Community 80 - "V2 Root Layout"
Cohesion: 1.0
Nodes (0): 

### Community 81 - "V2 Color Constants"
Cohesion: 1.0
Nodes (0): 

### Community 82 - "InsightCard V2"
Cohesion: 1.0
Nodes (0): 

### Community 83 - "HeroCard V2 Ref"
Cohesion: 1.0
Nodes (0): 

### Community 84 - "SIPControls V2 Ref"
Cohesion: 1.0
Nodes (0): 

### Community 85 - "DepletionDialog V2 Ref"
Cohesion: 1.0
Nodes (0): 

### Community 86 - "ProjectionTable V2"
Cohesion: 1.0
Nodes (0): 

### Community 87 - "Engine Types V2"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Onboarding Layout`** (2 nodes): `_layout.tsx`, `OnboardingLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Theme Constants`** (2 nodes): `theme.ts`, `shadow()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `CSV Export Utility`** (2 nodes): `exportToCSV()`, `export.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `InsightCard Component`** (2 nodes): `InsightCard.tsx`, `InsightCard()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ProjectionChart Component`** (2 nodes): `ProjectionChart.tsx`, `fmtY()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Pro Paywall Component`** (2 nodes): `ProPaywall.tsx`, `handleDismiss()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Orval API Config`** (2 nodes): `titleTransformer()`, `orval.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Not Found Screen`** (2 nodes): `NotFoundScreen()`, `+not-found.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Snapshot Tiles Component`** (2 nodes): `SnapshotTiles.tsx`, `SnapshotTiles()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Engine Types`** (2 nodes): `types.ts`, `getFrequencyMonthsPerPayment()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tab Layout`** (1 nodes): `_layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dashboard Screen`** (1 nodes): `dashboard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Root Layout`** (1 nodes): `_layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `FlagSecure Plugin`** (1 nodes): `withFlagSecure.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Release Signing Plugin`** (1 nodes): `withReleaseSigning.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `System Alert Plugin`** (1 nodes): `withRemoveSystemAlertWindow.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Color Constants`** (1 nodes): `colors.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Category Constants`** (1 nodes): `categories.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `HeroCard Component`** (1 nodes): `HeroCard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `SnapshotTiles Component`** (1 nodes): `SnapshotTiles.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `SIPControls Component`** (1 nodes): `SIPControls.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DepletionDialog Component`** (1 nodes): `DepletionDialog.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ProjectionTable Component`** (1 nodes): `ProjectionTable.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Inflation Tests`** (1 nodes): `inflation.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `V2 DB Queries`** (1 nodes): `queries.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Hello Util`** (1 nodes): `hello.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Index Module A`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `API Client Module`** (1 nodes): `api.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Index Module B`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Health Status`** (1 nodes): `healthStatus.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Drizzle Config`** (1 nodes): `drizzle.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Index Module C`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Index Module D`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Index Module E`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `API Schemas`** (1 nodes): `api.schemas.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dashboard (Fin Dashboard)`** (1 nodes): `dashboard_1776389496261.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ProjectionChart (Fin Dashboard)`** (1 nodes): `ProjectionChart_1776389496261.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Expo Type Declarations`** (1 nodes): `expo-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Metro Config`** (1 nodes): `metro.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Babel Config`** (1 nodes): `babel.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `V2 Tab Layout`** (1 nodes): `_layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `V2 Dashboard`** (1 nodes): `dashboard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `V2 Root Layout`** (1 nodes): `_layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `V2 Color Constants`** (1 nodes): `colors.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `InsightCard V2`** (1 nodes): `InsightCard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `HeroCard V2 Ref`** (1 nodes): `HeroCard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `SIPControls V2 Ref`** (1 nodes): `SIPControls.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DepletionDialog V2 Ref`** (1 nodes): `DepletionDialog.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ProjectionTable V2`** (1 nodes): `ProjectionTable.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Engine Types V2`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Should `SQLite Database Queries` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._