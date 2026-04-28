# Transformation 101 — FinPath V2 Replit Merge + Chart Redesign

**Started:** 2026-04-17  
**Branch:** `replit-assited`  
**Base commit:** `13a03e4` (versionCode 19)

---

## Goal

Merge Replit V2 UI/UX into the existing project, following `FinPath_V2_Merge_Guide.md`.  
Simultaneously redesign the Net Worth Projection chart tile to match the reference image (Gemini design).

---

## Pre-merge State Audit

| Item | Status |
|---|---|
| `constants/colors.ts` | ✅ Already merged (commit c846bc1) |
| `hooks/useColors.ts` | ✅ Already merged |
| `components/HeroCard.tsx` | ✅ Already merged (commit 634f886) |
| `components/InsightCard.tsx` | ✅ Already merged |
| `components/SIPControls.tsx` | ✅ Already merged |
| `components/SnapshotTiles.tsx` | ✅ Already merged |
| `components/ErrorBoundary.tsx` | ✅ Already merged |
| `components/ErrorFallback.tsx` | ✅ Already merged |
| `components/ProjectionTable.tsx` | ✅ Present (untracked) |
| `constants/theme.ts` | ❌ Not present |
| `engine/types.ts` | ❌ Not present (V2 separate types file) |
| `engine/calculator.ts` | ❌ Old engine (imports from db/queries) |
| `storage/` layer | ❌ Not present |
| `context/AppContext.tsx` | ❌ Not present |
| `components/SimpleChart.tsx` | ❌ Not present |
| `components/CustomSlider.tsx` | ❌ Not present |
| `components/DepletionDialog.tsx` | ❌ Not present |
| `app/(tabs)/*` screens (V2) | ❌ Not yet updated to V2 versions |
| `@expo-google-fonts/inter` | ❌ Not installed |
| `react-native-keyboard-controller` | ❌ Not installed |
| `react-native-svg` | ✅ Already installed (15.12.1) |

---

## Task List

### Phase 1 — Infrastructure Setup
- [x] **T01** Copy zip to Mac and extract to `~/finpathV2/`
- [x] **T02** Install missing npm dependencies (`@expo-google-fonts/inter` installed; `react-native-keyboard-controller` installed)
- [x] **T03** Copy `constants/theme.ts` from V2

### Phase 2 — Chart Redesign (Primary User Ask)
- [x] **T04** Replace `components/ProjectionChart.tsx` with SVG-based chart matching reference image
  - SVG chart via react-native-svg ✅
  - Y-axis labels: ₹NCr/L/K ✅
  - X-axis: age ticks ✅
  - "Retirement (N)" label + dashed vertical ✅
  - "Peak ₹X Cr" two-line label + dot ✅
  - "Danger zone" text in red zone ✅
  - Three background zones: green/blue/red ✅
  - Green gradient area fill ✅
  - Event emoji rings ON curve (native Text overlay) ✅
  - Range buttons + window slider ✅
  - Event chips row removed ✅
- [x] **T05** chart subtitle "Your financial journey till age N" added to dashboard.tsx
- [x] **T06** Danger zone confirmed: starts at failureAge (NW=0), not retirement

### Phase 3 — V2 Components
- [x] **T07** `components/CustomSlider.tsx` copied from V2
- [x] **T08** `components/DepletionDialog.tsx` copied from V2
- [x] **T09** `components/KeyboardAwareScrollViewCompat.tsx` copied from V2

### Phase 4 — Engine Migration
- [x] **T10** `engine/types.ts` copied from V2
- [ ] **T11** Evaluate V2 `engine/calculator.ts` vs current — deferred (current engine is working, V2 engine uses different type contracts)

### Phase 5 — Storage + Context (Breaking Change — Deferred)
- [ ] **T12** Copy `storage/` layer — DEFERRED (requires full SQLite → AES-encrypted storage migration + data migration)
- [ ] **T13** Copy `context/AppContext.tsx` — DEFERRED (depends on T12)
- [ ] **T14** Update screens to use AppContext — DEFERRED (depends on T12-T13)

### Phase 6 — Screen Updates
- [x] **T15** `app/_layout.tsx`: Inter fonts (400/500/600/700) + GestureHandlerRootView added; Sentry + PaperProvider + ProfileProvider/ProProvider kept
- [x] **T16** `app/(tabs)/_layout.tsx`: BlurView tab bar already in place (commit e889146)
- [x] **T17** `app/(tabs)/profile.tsx`: Pro upgrade card + ProPaywall modal added
- [x] **T18** CSV export in dashboard.tsx: already wired with Pro gate (verified)

### Phase 7 — Final
- [x] **T19** `@/` path alias confirmed in tsconfig; Expo Router handles it natively
- [x] **T20** Commits: `13683d2`, `d36ee4e` — pushed to `replit-assited`
- [x] **T21** AAB v20 built (BUILD SUCCESSFUL 1m 26s) → `C:\Dropbox\finpath\app-release-v20.aab`

---

## Reference Image Notes (chart tile)

- Danger zone: red shading starts **at the point where net worth = 0** (failureAge), NOT at retirement age
- No mini event tiles below chart (remove chips row)
- "Retirement (50)" label — at TOP of dashed vertical line
- "Peak ₹18.2 Cr" label — above peak dot (two lines: "Peak" then value)  
- "Danger zone" — top of red zone area, right-aligned within zone
- Event markers: emoji symbols ON the curve as rings, NO chips row below
