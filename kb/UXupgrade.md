# UX Upgrade Plan — Replit fire-planner → FinPath

> Source: `~/finpath/Replit/fire-planner/` (read-only reference)
> Target: `~/finpath/` (production app)
> Branch: `replit-assited`

## Batching Strategy

**Batch 1 — Foundation (low risk, no UI change)**
Tasks 1–3: design tokens, ErrorBoundary, haptics

**Batch 2 — Component Extraction (medium risk, refactor)**
Tasks 4–7: extract HeroCard, SnapshotTiles, InsightCard, SIPControls from dashboard.tsx

**Batch 3 — New UX Features (additive)**
Tasks 8–10: success insight card, cash-flow-tight warning, goals slider UX

**Batch 4 — Polish (cosmetic)**
Tasks 11–12: BlurView tab bar, hero gradient direction

After each batch: `npx tsc --noEmit` + `./gradlew assembleRelease` to verify nothing broke.

---

## Task 1 — Create design token system (`useColors` hook)

**What:** Centralize all hardcoded hex colors into semantic tokens.

**Files to create:**
- `constants/colors.ts`

**Files to modify:**
- None yet (tokens consumed in later tasks)

**Reference:** `Replit/fire-planner/constants/colors.ts`

**Steps:**
1. Create `constants/colors.ts` with this exact structure:
```ts
const colors = {
  light: {
    background: '#F5F5F5',
    foreground: '#0f1c0f',
    card: '#ffffff',
    cardForeground: '#0f1c0f',
    primary: '#1B5E20',
    primaryForeground: '#ffffff',
    secondary: '#E8F5E9',
    secondaryForeground: '#1B5E20',
    muted: '#ECEEEC',
    mutedForeground: '#6B7A6B',
    accent: '#2E7D32',
    accentForeground: '#ffffff',
    destructive: '#C62828',
    destructiveForeground: '#ffffff',
    border: '#D8DED8',
    input: '#D8DED8',
    warning: '#E65100',
    warningLight: '#FFF3E0',
    success: '#1B5E20',
    successLight: '#E8F5E9',
    purple: '#5E35B1',
    purpleLight: '#EDE7F6',
    amber: '#F9A825',
    amberLight: '#FFF8E1',
  },
  radius: 12,
};
export default colors;
```
2. Create `hooks/useColors.ts`:
```ts
import colors from '../constants/colors';
export function useColors() {
  return { ...colors.light, radius: colors.radius };
}
```

**Acceptance:** `npx tsc --noEmit` passes. No visual change yet.

---

## Task 2 — Add ErrorBoundary

**What:** Wrap app root so crashes show a fallback instead of white screen.

**Files to create:**
- `components/ErrorBoundary.tsx`
- `components/ErrorFallback.tsx`

**Files to modify:**
- `app/_layout.tsx` — wrap children in `<ErrorBoundary>`

**Reference:** `Replit/fire-planner/components/ErrorBoundary.tsx` and `ErrorFallback.tsx`

**Steps:**
1. Copy `ErrorBoundary.tsx` from Replit verbatim (class component — required by React).
2. Adapt `ErrorFallback.tsx` from Replit:
   - Replace `useColors()` calls with hardcoded colors for now (or use the hook from Task 1).
   - Replace `reloadAppAsync` with `import { reloadAsync } from 'expo-updates'` if expo-updates is installed, OR use `Updates.reloadAsync()`. If neither available, just call `resetError()`.
   - Remove the `Platform.OS === 'web'` modal code (not needed).
3. In `app/_layout.tsx`, import `ErrorBoundary` and wrap the root `<Stack>` or `<Slot>`:
```tsx
import { ErrorBoundary } from '../components/ErrorBoundary';
// ... inside the component return:
<ErrorBoundary>
  {/* existing layout content */}
</ErrorBoundary>
```

**Acceptance:** App loads normally. Intentionally throw in a component → fallback screen appears.

---

## Task 3 — Add haptic feedback to CRUD actions

**What:** Add `expo-haptics` feedback on save/delete across assets, expenses, goals.

**Install:** `npx expo install expo-haptics` (if not already installed)

**Files to modify:**
- `app/(tabs)/assets.tsx`
- `app/(tabs)/expenses.tsx`
- `app/(tabs)/goals.tsx`

**Steps:**
1. Check if `expo-haptics` is in package.json. If not: `npx expo install expo-haptics`
2. In each file, import: `import * as Haptics from 'expo-haptics';`
3. After every successful save/add call, add:
   `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);`
4. After every delete call, add:
   `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);`

**Acceptance:** Build succeeds. Tapping save/delete triggers haptic on device.

---

## Task 4 — Extract HeroCard component

**What:** Move the hero card JSX from dashboard.tsx into a standalone component.

**Files to create:**
- `components/HeroCard.tsx`

**Files to modify:**
- `app/(tabs)/dashboard.tsx` — replace inline hero JSX with `<HeroCard ... />`

**Reference:** `Replit/fire-planner/components/HeroCard.tsx` for props interface

**Steps:**
1. Create `components/HeroCard.tsx`. Props:
```ts
interface Props {
  sipAmountDisplay: number;
  requiredMonthlySIP: number;
  currency: string;
  retirementAge: number;
  fireTargetAge: number;
  failureAge: number;
  fireAchievedAge: number;
  isOnTrack: boolean;
  investableNetWorth: number;
  planStatus: { title: string; subtitle: string; color: string };
  onDepletionPress: () => void;
}
```
2. Move the `<LinearGradient>` hero card JSX block (lines ~180–220 of dashboard.tsx) into this component.
3. Move the `heroColors` computation into the component.
4. Move hero-related styles (`heroCard`, `heroLabel`, `heroAmount`, `heroStatusTitle`, `heroSubtitle`, `heroPillRow`, `heroPill`, `heroPillStatus`, `heroPillText`) into the component.
5. In dashboard.tsx, compute `planStatus` as before, then render:
```tsx
<HeroCard
  sipAmountDisplay={sipAmountDisplay}
  requiredMonthlySIP={result.requiredMonthlySIP}
  currency={currency}
  retirementAge={retirementAge}
  fireTargetAge={goals.fire_target_age ?? 100}
  failureAge={result.failureAge}
  fireAchievedAge={result.fireAchievedAge}
  isOnTrack={result.isOnTrack}
  planStatus={planStatus}
  onDepletionPress={() => setShowDepletionInfo(true)}
/>
```

**Acceptance:** Dashboard looks identical. Hero card renders correctly in all 5 plan states.

---

## Task 5 — Extract SnapshotTiles component

**What:** Move the "TODAY" / "AT AGE X" tiles from dashboard.tsx into a component.

**Files to create:**
- `components/SnapshotTiles.tsx`

**Files to modify:**
- `app/(tabs)/dashboard.tsx`

**Steps:**
1. Create `components/SnapshotTiles.tsx`. Props:
```ts
interface Props {
  investableNetWorth: number;
  netWorthAtRetirement: number;
  retirementAge: number;
  currency: string;
  onCorpusInfoPress: () => void;
}
```
2. Move the `tilesRow` View block from dashboard.tsx into this component.
3. Move styles: `tilesRow`, `snapTile`, `snapLabel`, `snapNumber`, `snapSub`.
4. In dashboard.tsx, replace with:
```tsx
<SnapshotTiles
  investableNetWorth={result.investableNetWorth}
  netWorthAtRetirement={result.netWorthAtRetirement}
  retirementAge={retirementAge}
  currency={currency}
  onCorpusInfoPress={() => setShowCorpusInfo(true)}
/>
```

**Acceptance:** Dashboard looks identical. Info button on corpus tile still opens dialog.

---

## Task 6 — Create InsightCard component + add success/cashflow insights

**What:** Create a reusable insight card and add two new insight types.

**Files to create:**
- `components/InsightCard.tsx`

**Files to modify:**
- `app/(tabs)/dashboard.tsx` — replace inline sipWarningCard, add success + cashflow cards

**Reference:** `Replit/fire-planner/components/InsightCard.tsx`

**Steps:**
1. Create `components/InsightCard.tsx`:
```ts
interface Props {
  type: 'warning' | 'info' | 'success' | 'critical';
  title: string;
  message: string;
}
```
   - Use `MaterialCommunityIcons` (already in the project) instead of Feather:
     - warning → `alert-outline` orange
     - info → `information-outline` grey
     - success → `check-circle-outline` green
     - critical → `alert-circle-outline` red
   - Style: `borderRadius: 12`, `borderLeftWidth: 3`, `borderLeftColor` matches type, `padding: 14`.
2. In dashboard.tsx, replace the inline `sipWarningCard` block with:
```tsx
{result.sipBurdenWarning && (
  <InsightCard
    type={sipRatio > 1 ? 'critical' : sipRatio > 0.6 ? 'warning' : 'info'}
    title={sipRatio > 1 ? 'SIP Exceeds Salary' : sipRatio > 0.6 ? 'High SIP Burden' : 'Low Income Buffer'}
    message={result.sipBurdenWarning}
  />
)}
```
3. Add success insight (NEW — not in current app):
```tsx
{result.isOnTrack && !result.failureAge && insights && (
  <InsightCard
    type="success"
    title={`Peak wealth at age ${insights.peakAge}`}
    message={`Your portfolio peaks at ${formatCurrency(insights.peakValue, currency)}.`}
  />
)}
```
4. Add cash-flow-tight insight (NEW):
```tsx
{insights && !insights.isAffordable && !result.sipBurdenWarning && (
  <InsightCard
    type="warning"
    title="Cash Flow Tight"
    message="SIP + expenses exceed your monthly income. Consider reducing expenses."
  />
)}
```

**Acceptance:** SIP burden warnings still display. New success/cashflow cards appear in correct states.

---

## Task 7 — Extract SIPControls component

**What:** Move the "Adjust Your Plan" card from dashboard.tsx into a component.

**Files to create:**
- `components/SIPControls.tsx`

**Files to modify:**
- `app/(tabs)/dashboard.tsx`

**Steps:**
1. Create `components/SIPControls.tsx`. Props:
```ts
interface Props {
  sipAmountDisplay: number;
  sipReturnRateDisplay: number;
  postSipReturnRateDisplay: number;
  stepUpEnabled: boolean;
  stepUpRateDisplay: number;
  sipStopAge: number;
  currency: string;
  onSipChange: (v: number) => void;
  onSipCommit: (v: number) => void;
  onReturnChange: (v: number) => void;
  onReturnCommit: (v: number) => void;
  onPostReturnChange: (v: number) => void;
  onPostReturnCommit: (v: number) => void;
  onStepUpToggle: (v: boolean) => void;
  onStepUpChange: (v: number) => void;
  onStepUpCommit: (v: number) => void;
}
```
2. Move the `<Card style={styles.strategyCard}>` block from dashboard.tsx into this component.
3. Keep using `@miblanchard/react-native-slider` (NOT the Replit CustomSlider).
4. Move styles: `strategyCard`, `strategyHeader`, `strategyTitle`, `strategyLiveValue`, `sliderLabel`, `infoText`, `advancedToggle`, `advancedToggleText`, `switchRow`.
5. The `showAdvanced` state moves INTO SIPControls (local to the component).

**Acceptance:** Dashboard identical. Slider interactions work. Advanced toggle works.

---

## Task 8 — Goals screen: add sliders for numeric inputs

**What:** Add slider inputs alongside TextInputs for retirement age, pension, inflation rate.

**Files to modify:**
- `app/(tabs)/goals.tsx`

**Reference:** `Replit/fire-planner/app/(tabs)/goals.tsx` — uses sliders for all numeric goal inputs

**Steps:**
1. Import Slider: `import { Slider } from '@miblanchard/react-native-slider';`
2. For retirement age: add a Slider below the TextInput
   - `minimumValue={35}` `maximumValue={75}` `step={1}`
   - `onValueChange` updates the form state
3. For pension/withdrawal income: add a Slider
   - `minimumValue={10000}` `maximumValue={500000}` `step={5000}`
4. For inflation rate: add a Slider
   - `minimumValue={2}` `maximumValue={12}` `step={0.5}`
5. Style sliders with `minimumTrackTintColor="#1B5E20"` `thumbTintColor="#1B5E20"`

**Acceptance:** Goals screen has sliders. Dragging updates the TextInput value. Saving works.

---

## Task 9 — FIRE type visual cards on Goals screen

**What:** If not already present, add colored radio cards for Lean FIRE / FIRE / Fat FIRE.

**Files to modify:**
- `app/(tabs)/goals.tsx`

**Reference:** `Replit/fire-planner/app/(tabs)/goals.tsx` — FIRE_TYPES array with color + description

**Steps:**
1. Check if goals.tsx already has FIRE type selection. If it's a plain picker/dropdown, replace with:
```tsx
const FIRE_TYPES = [
  { key: 'slim', label: 'Lean FIRE', desc: 'Survive to 85 — minimal corpus', color: '#E65100' },
  { key: 'moderate', label: 'FIRE', desc: 'Sustain to 100 — comfortable', color: '#1B5E20' },
  { key: 'fat', label: 'Fat FIRE', desc: 'Preserve wealth to 120', color: '#5E35B1' },
];
```
2. Render as touchable cards with colored left border, selected state with background tint.
3. On select, update `fire_type` and `fire_target_age` accordingly.

**Acceptance:** FIRE type cards visible. Selecting changes the form. Dashboard recalculates.

---

## Task 10 — Category icons on Assets & Expenses screens

**What:** Add Feather/MaterialCommunityIcons next to each asset/expense category.

**Files to modify:**
- `app/(tabs)/assets.tsx`
- `app/(tabs)/expenses.tsx`

**Reference:** `Replit/fire-planner/app/(tabs)/assets.tsx` — `CATEGORY_ICONS` map

**Steps:**
1. In assets.tsx, create icon map:
```ts
const CATEGORY_ICONS: Record<string, string> = {
  EQUITY: 'trending-up', MUTUAL_FUND: 'pie-chart', DEBT: 'shield',
  FIXED_DEPOSIT: 'lock', PPF: 'archive', EPF: 'briefcase',
  GOLD: 'star', REAL_ESTATE: 'home', CRYPTO: 'zap',
  CASH: 'dollar-sign', ESOP_RSU: 'award', OTHERS: 'package',
};
```
2. In asset list items, add `<MaterialCommunityIcons name={icon} size={20} />` before the category label.
3. Similarly in expenses.tsx, add icons for expense types:
```ts
const TYPE_ICONS: Record<string, string> = {
  CURRENT_RECURRING: 'repeat', FUTURE_ONE_TIME: 'calendar', FUTURE_RECURRING: 'refresh-cw',
};
```

**Acceptance:** Icons visible next to categories in list view. No layout shift.

---

## Task 11 — BlurView tab bar (iOS polish)

**What:** Use frosted-glass tab bar background on iOS.

**Install:** `npx expo install expo-blur` (if not already installed)

**Files to modify:**
- `app/(tabs)/_layout.tsx`

**Reference:** `Replit/fire-planner/app/(tabs)/_layout.tsx` — `tabBarBackground` option

**Steps:**
1. Import `BlurView` from `expo-blur`.
2. In tab screen options, add:
```ts
tabBarStyle: {
  position: 'absolute',
  backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#fff',
  borderTopColor: '#D8DED8',
},
tabBarBackground: () =>
  Platform.OS === 'ios'
    ? <BlurView intensity={100} tint="light" style={StyleSheet.absoluteFill} />
    : null,
```

**Acceptance:** On iOS, tab bar has blur effect. On Android, solid white. No crash on either.

---

## Task 12 — Hero card gradient direction tweak

**What:** Change hero card gradient from vertical to diagonal.

**Files to modify:**
- `components/HeroCard.tsx` (after Task 4) or `app/(tabs)/dashboard.tsx` if Task 4 not done yet

**Steps:**
1. Change LinearGradient props:
   - FROM: `start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}`
   - TO: `start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}`

**Acceptance:** Hero card gradient runs diagonally. Subtle visual improvement.

---

## Execution Order

```
Batch 1 (foundation):  Task 1 → Task 2 → Task 3 → build check
Batch 2 (extraction):  Task 4 → Task 5 → Task 6 → Task 7 → build check
Batch 3 (features):    Task 8 → Task 9 → Task 10 → build check
Batch 4 (polish):      Task 11 → Task 12 → build check → merge to release
```

Each batch = 1 commit with conventional prefix:
- Batch 1: `feat: add design tokens, error boundary, haptic feedback`
- Batch 2: `refactor: extract dashboard into HeroCard, SnapshotTiles, InsightCard, SIPControls`
- Batch 3: `feat: goals sliders, FIRE type cards, category icons`
- Batch 4: `feat: BlurView tab bar, diagonal hero gradient`
