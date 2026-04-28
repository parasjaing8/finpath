# Graph Report - .  (2026-04-29)

## Corpus Check
- 49 files · ~247,769 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 173 nodes · 198 edges · 43 communities detected
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]

## God Nodes (most connected - your core abstractions)
1. `decryptString()` - 9 edges
2. `calculateProjections()` - 9 edges
3. `encryptString()` - 8 edges
4. `calculateExpenseForYear()` - 8 edges
5. `concat()` - 5 edges
6. `hmacSha256()` - 5 edges
7. `MainActivity` - 5 edges
8. `parseDateStr()` - 5 edges
9. `calculateVestingForYear()` - 5 edges
10. `utf8ToBytes()` - 4 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

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

### Community 0 - "Community 0"
Cohesion: 0.1
Nodes (9): biometricKey(), createProfile(), deleteProfile(), deleteProfilePin(), getBiometricEnabled(), getProfilePin(), pinKey(), saveProfilePin() (+1 more)

### Community 1 - "Community 1"
Cohesion: 0.2
Nodes (16): base64ToBytes(), bytesToBase64(), concat(), constantTimeEqual(), decryptString(), deriveSubKey(), encryptString(), getDerivedKeys() (+8 more)

### Community 2 - "Community 2"
Cohesion: 0.28
Nodes (17): calculateExpenseForYear(), calculateFutureGoalsCorpus(), calculatePresentValueOfExpenses(), calculateProjections(), calculateRequiredSIP(), calculateSimulationFireCorpus(), calculateVestingForYear(), computeBlendedGrowthRate() (+9 more)

### Community 3 - "Community 3"
Cohesion: 0.26
Nodes (7): baseInput(), makeDob(), makeGoals(), makeMFAsset(), makeProfile(), makeSavingsAsset(), makeSelfUseRealEstate()

### Community 4 - "Community 4"
Cohesion: 0.29
Nodes (0): 

### Community 5 - "Community 5"
Cohesion: 0.29
Nodes (1): MainApplication

### Community 6 - "Community 6"
Cohesion: 0.4
Nodes (2): handleSubmit(), validate()

### Community 7 - "Community 7"
Cohesion: 0.33
Nodes (1): MainActivity

### Community 8 - "Community 8"
Cohesion: 0.5
Nodes (2): handleLogin(), hashPin()

### Community 9 - "Community 9"
Cohesion: 0.4
Nodes (0): 

### Community 10 - "Community 10"
Cohesion: 0.5
Nodes (0): 

### Community 11 - "Community 11"
Cohesion: 0.67
Nodes (2): inflationAdjusted(), presentValue()

### Community 12 - "Community 12"
Cohesion: 0.67
Nodes (3): runLegacyMigration(), safeParse(), Storage Migrations

### Community 13 - "Community 13"
Cohesion: 0.5
Nodes (0): 

### Community 14 - "Community 14"
Cohesion: 0.67
Nodes (0): 

### Community 15 - "Community 15"
Cohesion: 1.0
Nodes (2): handleSave(), validate()

### Community 16 - "Community 16"
Cohesion: 1.0
Nodes (2): DateInput(), formatDateMask()

### Community 17 - "Community 17"
Cohesion: 1.0
Nodes (2): getDatabase(), initializeDatabase()

### Community 18 - "Community 18"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (1): Profile Hook

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (1): Pro IAP Hook

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (1): Colors Hook

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **4 isolated node(s):** `Storage Migrations`, `Profile Hook`, `Pro IAP Hook`, `Colors Hook`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 18`** (2 nodes): `dashboard.tsx`, `if()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (2 nodes): `expenses.tsx`, `ExpensesScreen()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (2 nodes): `_layout.tsx`, `OnboardingLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (2 nodes): `withFlagSecure.js`, `withRemoveSystemAlertWindow.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (2 nodes): `theme.ts`, `shadow()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (2 nodes): `exportToCSV()`, `export.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (2 nodes): `ErrorBoundary.tsx`, `ErrorFallback.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (1 nodes): `aes-js.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (1 nodes): `index.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `_layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `_layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `withReleaseSigning.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `colors.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `_label_and_html.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `KeyboardAwareScrollViewCompat.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `InsightCard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `HeroCard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `SnapshotTiles.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `ProjectionTable.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `ProPaywall.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `queries.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `Profile Hook`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `Pro IAP Hook`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (1 nodes): `Colors Hook`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `Storage Migrations`, `Profile Hook`, `Pro IAP Hook` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._