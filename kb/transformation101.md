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
- [ ] **T01** Copy zip to Mac and extract to `~/finpathV2/`
- [ ] **T02** Install missing npm dependencies (`@expo-google-fonts/inter`, `react-native-keyboard-controller`)
- [ ] **T03** Copy `constants/theme.ts` from V2

### Phase 2 — Chart Redesign (Primary User Ask)
- [ ] **T04** Replace `components/ProjectionChart.tsx` with SVG-based chart matching reference image
  - SVG chart (react-native-svg, already installed)
  - Title: "Net Worth Projection" + subtitle "Your financial journey till age N"
  - Y-axis labels: ₹2Cr, ₹4Cr... (left aligned)
  - X-axis: Age ticks
  - "Retirement (N)" label at top of dashed vertical
  - "Peak ₹X Cr" dot + two-line label
  - "Danger zone" text in red zone (top-right of danger area)
  - Three background zones: green (accumulation), blue (post-retirement), red (from NW=0 i.e. failureAge)
  - Green gradient area fill under net worth curve
  - Event marker emojis ON the curve (rings + emoji above)
  - Range buttons (5Y / 10Y / 25Y / All) + window slider
  - **REMOVE** event chips row below chart
- [ ] **T05** Update dashboard.tsx chart card subtitle to match reference image style
- [ ] **T06** Verify danger zone starts at failureAge (NW=0), not retirement age

### Phase 3 — V2 Components
- [ ] **T07** Copy `components/CustomSlider.tsx` from V2
- [ ] **T08** Copy `components/DepletionDialog.tsx` from V2
- [ ] **T09** Copy `components/KeyboardAwareScrollViewCompat.tsx` from V2

### Phase 4 — Engine Migration
- [ ] **T10** Copy `engine/types.ts` from V2 (clean type definitions)
- [ ] **T11** Evaluate V2 `engine/calculator.ts` vs current — merge improvements without breaking existing data contract

### Phase 5 — Storage + Context (Breaking Change — Do Last)
- [ ] **T12** Copy `storage/auth.ts`, `storage/secure.ts`, `storage/migrations.ts`, `storage/session.ts`
- [ ] **T13** Copy `context/AppContext.tsx`
- [ ] **T14** Update screens to use AppContext instead of db/queries hooks

### Phase 6 — Screen Updates
- [ ] **T15** Update `app/_layout.tsx` — Inter fonts, QueryClient, GestureHandler
- [ ] **T16** Update `app/(tabs)/_layout.tsx` — BlurView tab bar (already done? verify)
- [ ] **T17** Rewire IAP in `profile.tsx` (if V2 version overrides it)
- [ ] **T18** Rewire CSV export in `dashboard.tsx` (already present, verify)

### Phase 7 — Final
- [ ] **T19** Fix `@/` path alias in tsconfig + babel (verify)
- [ ] **T20** Commit all changes, git push
- [ ] **T21** Build AAB + copy to Windows

---

## Reference Image Notes (chart tile)

- Danger zone: red shading starts **at the point where net worth = 0** (failureAge), NOT at retirement age
- No mini event tiles below chart (remove chips row)
- "Retirement (50)" label — at TOP of dashed vertical line
- "Peak ₹18.2 Cr" label — above peak dot (two lines: "Peak" then value)  
- "Danger zone" — top of red zone area, right-aligned within zone
- Event markers: emoji symbols ON the curve as rings, NO chips row below
