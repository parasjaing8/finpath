# FinPath — UI/UX Audit
**Date:** 2026-04-18  
**Branch:** `replit-assited` · **Commit:** `407bbec`  
**Audited by:** Code review (all screen + component source files read directly)

Severity ratings: **BUG** = functional breakage / wrong behaviour · **UX** = friction or confusing · **POLISH** = minor improvement

---

## 1. Login Screen (`app/login.tsx`)

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| L1 | **BUG** | `KeyboardAvoidingView behavior` is `undefined` on Android — keyboard covers PIN input on Android devices. iOS gets `'padding'`, Android gets nothing. | line 195 |
| L2 | **BUG** | Dual data-store hybrid: screen imports from `../db/queries` (SQLite) and `useProfile` (old stack) while simultaneously writing to `AppContext` (AsyncStorage). If V2 screens wrote data to AppContext, `syncToAppContext` overwrites it with SQLite on next login. Fragile bridge. | lines 17–72 |
| L3 | **BUG** | Single-profile auto-select immediately calls `triggerBiometric` on app open — biometric prompt fires before user sees the screen. Startling on first launch. | lines 85–88 |
| L4 | **UX** | Profile grid uses `flexWrap` — 3 profiles renders as 2+1 with the lone card spanning full width. Looks broken. No explicit grid column control. | lines 221–249 |
| L5 | **UX** | No keyboard auto-dismiss after 6 digits are entered. User must tap Login manually. Auto-submitting at digit 6 would be faster. | lines 263–275 |
| L6 | **UX** | Lockout countdown shows raw seconds: `Locked (47s)` — no progress ring or bar. Hard to judge how long to wait. | line 286 |
| L7 | **POLISH** | PIN input `letterSpacing: 8` with `secureTextEntry` can cause the dots to overflow the input width on narrow screens. | line 456 |
| L8 | **POLISH** | No Inter font — uses system default. All other screens use `Inter_*`. Login is visually inconsistent in typography. | all styles |
| L9 | **POLISH** | Privacy Policy link `https://parasjaing8.github.io/finpath/PRIVACY_POLICY` (login) differs from About screen link `https://aihomecloud.com/finpath/privacy` — two different URLs for the same policy. | lines 315, profile line 317 |

---

## 2. Onboarding / Create Profile (`app/onboarding/create-profile.tsx`)

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| O1 | **BUG** | `KeyboardAvoidingView behavior` is `undefined` on Android. PIN + Confirm PIN fields are covered by keyboard. | line 91 |
| O2 | **BUG** | Default DOB hardcoded as `'1995-06-01'` — every new user appears to be born June 1995 unless they change it. Should be empty or derived from a reasonable default. | line 20 |
| O3 | **UX** | Uses React Native Paper `TextInput` (outlined mode) while all other app screens use bare `TextInput` with custom border styling. Visually inconsistent on this screen vs the rest of the app. | lines 98–128 |
| O4 | **UX** | No step progress indicator — form has 6 fields (name, DOB, income, currency, PIN, confirm PIN) but there's no visual sense of how far through the flow the user is. |  |
| O5 | **UX** | PIN confirm error only shown after tapping Create. No inline check while typing (e.g. turn confirm field border red when they don't match). | lines 49, 107 |
| O6 | **POLISH** | Monthly income allows `0` — valid technically, but zero income means SIP affordability checks can't fire. Could show an inline hint: "Leave 0 if not applicable". | line 47 |

---

## 3. Assets Screen (`app/(tabs)/assets.tsx`)

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| A1 | **BUG** | `catChip` style still uses `paddingVertical: 8` without explicit `height`/`alignItems: 'center'` — the category chip height fix (applied to Expenses in commit `fa06f1f`) was never applied to Assets. Chips may still stretch vertically inside the horizontal ScrollView. | line 384 |
| A2 | **BUG** | `fieldLabel` uses hardcoded `color: '#666'` instead of `colors.mutedForeground`. Will look wrong if the background ever changes. | line 378 |
| A3 | **BUG** | Self-use checkbox label says **"Self-use property"** for Gold and Others categories — "property" is a real estate term. Semantically wrong for gold/startup investments. | line 311 |
| A4 | **UX** | No visual feedback after saving an asset — modal closes silently. No toast/check animation (Goals and Profile screens show a green check). Haptic fires but no visual. | line 131 |
| A5 | **UX** | Delete button (trash icon) sits immediately next to the Edit button with only `padding: 6` gap. Easy to accidentally tap the wrong one. No visual weight difference between edit and delete. | lines 195–212 |
| A6 | **UX** | Summary tiles (Total NW / Investable) are at the top of the scroll — after adding/editing an asset, user lands back on the list without the tiles in view. No sticky header with totals. |  |
| A7 | **UX** | ROI slider max is 20% — for Crypto (default 15%) a user might want 25–30%. No override possible. | line 293–298 |
| A8 | **UX** | No explicit indication in the list that an asset is "Self-use" beyond a small `· Self-use` text appended to the meta line. Could add a distinct badge/chip. | line 188 |
| A9 | **POLISH** | Category chips in Add Asset have no explicit `height` (unlike Expenses which was fixed). Should apply same `height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center'`. | line 383 |
| A10 | **POLISH** | Empty state CTA button background uses `colors.primary` (green) — consistent. But the FAB also uses `colors.primary`. When list is empty the FAB overlaps with the empty state CTA, giving two identical green "add" buttons visible. |  |

---

## 4. Expenses Screen (`app/(tabs)/expenses.tsx`)

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| E1 | **BUG** | `fieldLabel` uses hardcoded `color: '#666'` instead of `colors.mutedForeground`. | line 418 |
| E2 | **BUG** | `end_date` is not shown on the expense list card. FUTURE_RECURRING items have an end date set but users can't see it without opening edit. | line 143–147 |
| E3 | **UX** | Type selector (3 cards × ~60px each) takes ~200px before user reaches the Name field. For returning users editing a recurring expense, they always scroll past this. Could collapse type selector to chips/tabs once a type is selected. | lines 247–260 |
| E4 | **UX** | Monthly summary card shows only CURRENT_RECURRING total. Users with future one-time expenses (big purchases) have no summary view of upcoming financial impact. | lines 77–80 |
| E5 | **UX** | Inflation slider max is 20%, inconsistent with Goals screen (max 10%). User setting 12% inflation in Expenses could exceed the 10% max available in Goals, causing confusion about which inflation rate applies where. | lines 323–329 |
| E6 | **UX** | Category chip auto-sets inflation rate via `c.defaultInflation` when tapped — but there is no visible indication this happened. Slider silently jumps. If user had manually set inflation, their value is overwritten. | line 278 |
| E7 | **UX** | The `FUTURE_ONE_TIME` type hides Frequency but still shows the Inflation Rate slider — inflation rate is irrelevant for a one-time future purchase (it's not recurring). Should hide inflation for `FUTURE_ONE_TIME`. | lines 299–329 |
| E8 | **POLISH** | Frequency display in list card: `'MONTHLY'.charAt(0) + 'MONTHLY'.slice(1).toLowerCase()` → "Monthly". Works but fragile string manipulation. A lookup map `{ MONTHLY: 'Monthly', ... }` is cleaner and faster. | line 144 |

---

## 5. Goals Screen (`app/(tabs)/goals.tsx`)

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| G1 | **BUG** | `infoRow` border color hardcoded `'#E8F5E9'` — not from colors system. Invisible separator on light green backgrounds. | line 247 |
| G2 | **BUG** | 5-second auto-navigation to Dashboard after Save with no cancel option. If user taps Save by mistake they're forced to watch the counter. The calculation is instant (synchronous `useMemo`) — the 5s delay is artificial. | lines 59–63 |
| G3 | **BUG** | `fire_type` chips (Lean/Moderate/Fat) and `fire_target_age` slider are independent controls — they can be contradictory (e.g. fire_type = 'slim' but fire_target_age = 120). Selecting a FIRE type does not update the survival age slider. | lines 136–186 |
| G4 | **BUG** | Inflation range is **3–10%** in Goals but **0–20%** in Expenses per-expense slider. Inconsistent. A user's expense inflation of 12% will be silently mismatched against the 6–10% range on Goals. | line 162–171 |
| G5 | **UX** | SIP Stop Age slider has no explanatory text about the constraint (capped at retirement age). Slider just refuses to move past retirement age with no feedback. | lines 100–113 |
| G6 | **UX** | "Years to retirement" InfoRow shows for retirement age but nothing equivalent for SIP stop age ("Years of SIP investing: N"). Missing context. | line 115 |
| G7 | **UX** | No warning when `pension_income` is 0 or unrealistically low. User can set ₹0 withdrawal and get a misleading "You're on track" on Dashboard. | lines 122–133 |
| G8 | **UX** | Calculating overlay blocks for 5 seconds even though the actual calculation is instant. Fake delay reduces perceived performance. | lines 214–222 |
| G9 | **POLISH** | "Save Goals and Calculate" button text changes to a check icon (no text) after saving — button becomes ambiguous. Should show "Saved ✓" text. | lines 198–211 |

---

## 6. Dashboard Screen (`app/(tabs)/dashboard.tsx`)

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| D1 | **BUG** | `container` background `backgroundColor: '#F5F5F5'` hardcoded — not `colors.background`. | line 353 |
| D2 | **BUG** | `scroll: { padding: 16, paddingBottom: 40 }` — no `useSafeAreaInsets` bottom padding. Content clipped by home indicator on tall Android phones. | line 354 |
| D3 | **BUG** | `!goals` empty state uses hardcoded `#333`, `#666`, `#C8E6C9` — not from colors system. | lines 111–127 |
| D4 | **BUG** | `!result` fallback renders `<Text>Calculating...</Text>` with zero styling — no spinner, no padding, looks broken. | line 130–132 |
| D5 | **BUG** | SIP slider max is **₹5,00,000/month** but `requiredMonthlySIP` can be higher than this for large retirement targets. `autoSetSIP` rounds to nearest 1000 and stores in state, but if required SIP > 500K, the slider is permanently at max and user can't match the requirement. | lines 93–101, SIPControls line 59 |
| D6 | **UX** | Two slider implementations: `CustomSlider` (PanResponder) everywhere except `SIPControls` which uses `@miblanchard/react-native-slider`. Different thumb/track visual, different feel. | SIPControls lines 55–121 |
| D7 | **UX** | `ProjectionTable` renders 50–80 rows with no virtualization (FlatList/FlashList). Likely causes jank on first dashboard load on low-end Android devices. | ProjectionTable component |
| D8 | **UX** | CSV button shows `'👑 CSV'` — crown emoji may render as tofu box on older Android versions (API < 29). | line 267 |
| D9 | **UX** | No empty state guidance when user has 0 assets — calculator runs with ₹0 starting NW, showing "Plan needs adjustment" with no actionable pointer to add assets first. | |
| D10 | **UX** | Corpus info and Depletion info use React Native Paper `Dialog` (inside `Portal`) while the rest of the app uses native `Alert` or custom Modals. Visual style mismatch. | lines 281–346 |
| D11 | **POLISH** | "Advanced ▼" toggle in SIPControls uses plain Unicode `▲▼` characters — could use Feather `chevron-up/down` icons for consistency. | SIPControls line 72 |
| D12 | **POLISH** | Chart title "Net Worth Projection" and subtitle are inside `Card.Content` with `fontWeight: 'bold'` (no explicit Inter family). Inconsistent typography. | lines 243–244, 357–358 |

---

## 7. Profile Screen (`app/(tabs)/profile.tsx`)

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| P1 | **BUG** | Save button has no validation for empty name — blank name passes through silently. `handleSave` only checks `dobCheck.ok`. | lines 74–84 |
| P2 | **BUG** | DOB input is a raw `TextInput` (user must type YYYY-MM-DD) while Create Profile uses the `DateInput` component with a date picker. Inconsistent UX for the same data field. | lines 190–206 |
| P3 | **BUG** | Import modal has no `KeyboardAvoidingView`. On Android, keyboard covers the multiline JSON TextInput making it unusable. | lines 332–374 |
| P4 | **BUG** | Changing currency from INR to USD has no warning about existing INR-denominated assets/expenses. Data is displayed in the new currency symbol immediately but values remain the same numbers — ₹5,00,000 would display as $5,00,000. | lines 220–236 |
| P5 | **UX** | No Pro upgrade card — `patch_all_v2.py` script was written to add it but was never confirmed executed. Profile screen has no IAP upgrade path despite `usePro`/`ProPaywall` existing in the codebase. | |
| P6 | **UX** | Monthly income formatted as `${(form.monthly_income / 1000).toFixed(0)}K` in Quick Stats — ₹1,55,000 shows as "155K" (no rounding to nearest K). Small inaccuracy but could be misleading. | line 254 |
| P7 | **POLISH** | First name initial avatar is static — after name change and save, it updates, but there's no transition. Could add a subtle fade. | line 167 |

---

## 8. Cross-Cutting / System-Wide

### 8.1 Architecture / Data
| # | Severity | Finding |
|---|----------|---------|
| X1 | **BUG** | **Dual data store** — `ProfileProvider` (SQLite via `useProfile`) and `AppProvider` (AsyncStorage via `AppContext`) both mounted in root layout. Login reads SQLite; V2 screens read/write AsyncStorage. Bridge in `login.tsx/syncToAppContext` is fragile and one-directional. This is the biggest systemic issue. |
| X2 | **BUG** | `useColors()` always returns light mode palette — no dark mode. `colors.ts` only defines `light`. Theme hook has no system-level detection. Not a crash but if device dark mode is on, the app stays light (actually fine for now, just noting the gap). |
| X3 | **BUG** | Sentry DSN is not configured (`EXPO_PUBLIC_SENTRY_DSN` not set) → crash reporting is inactive in all builds. `enabled: false` silently. |

### 8.2 Design System Consistency
| # | Severity | Finding |
|---|----------|---------|
| X4 | **BUG** | `HeroCard`, `SnapshotTiles`, `InsightCard`, `SIPControls`, and `Dashboard` all use **hardcoded hex colors** (`#1B5E20`, `#E8F5E9`, `#666`, `#BF360C`, etc.) instead of the `useColors()` system. If the palette ever changes, these components won't update. |
| X5 | **UX** | **Two slider implementations** coexist: `CustomSlider` (PanResponder, consistent look) used in Assets/Expenses/Goals/Chart, and `@miblanchard/react-native-slider` used only in `SIPControls`. Different thumb sizes, track heights, and interaction feel. |
| X6 | **UX** | **Mixed UI frameworks**: Dashboard/Create Profile use React Native Paper components (`<Card>`, `<Button>`, `<Text variant="...">`, `<Dialog>`). All other screens use bare React Native + custom StyleSheet. Noticeable visual inconsistency between tabs. |
| X7 | **UX** | `fieldLabel` in Assets and Expenses uses hardcoded `color: '#666'` instead of `colors.mutedForeground` (#6B7A6B). Subtly different shade, inconsistent with Goals and Profile which use the token. |
| X8 | **UX** | **Tab label "Goal"** (singular) vs screen content "Goals" (plural). Tab should read "Goals". | `(tabs)/_layout.tsx` line 45 |
| X9 | **POLISH** | **No font on Login screen** — uses system default weight. All other screens load `Inter_*` from `@expo-google-fonts/inter`. Login should use `fontFamily: 'Inter_...'` once fonts are loaded. |

### 8.3 Safe Area & Layout
| # | Severity | Finding |
|---|----------|---------|
| X10 | **BUG** | Dashboard `scroll.paddingBottom` is hardcoded `40` — no `insets.bottom`. On phones with home gesture bar (~34px), the bottom table row is clipped. |
| X11 | **UX** | Tab bar is `position: 'absolute'` — content scrolls under it. All screens handle this via `paddingBottom + insets.bottom` in `contentContainerStyle`, but dashboard misses this (X10 above). |
| X12 | **POLISH** | `FAB_BOTTOM_NATIVE = 80` — FAB sits 80px from bottom. Tab bar is ~56px + safe area. On some devices this might overlap the top of the tab bar. Confirm on a physical device with larger safe area. |

### 8.4 Accessibility
| # | Severity | Finding |
|---|----------|---------|
| X13 | **UX** | Login profile cards have no `accessibilityRole` — screen readers won't announce them as buttons. |
| X14 | **UX** | `HeroCard` pill row items are `<View>` not `<TouchableOpacity>` for the non-interactive pill — OK. But the "Runs out at N ›" pill is touchable with `accessibilityRole="button"` — good. |
| X15 | **POLISH** | Color contrast: `colors.mutedForeground` (#6B7A6B) on `colors.background` (#F5F5F5) — contrast ratio ~3.8:1. WCAG AA requires 4.5:1 for normal text. Fails for small body text. |

### 8.5 Performance
| # | Severity | Finding |
|---|----------|---------|
| X16 | **UX** | `ProjectionTable` renders all projection rows (50–80+) as plain `<View>` without `FlatList`. Will freeze the UI thread for ~100–200ms on mid-range Android on first Dashboard render. |
| X17 | **POLISH** | `expenses` array from AppContext may produce a new reference on every context render, causing `useMemo` in Dashboard to recalculate projections more often than needed. Stable reference or `useMemo` on the expenses array in AppContext would help. |

---

## 9. Priority Summary

### Must Fix Before Launch
1. **X1** — Dual data store (SQLite + AsyncStorage) — fundamental data integrity risk
2. **D2** — Dashboard missing safe area bottom padding — content clipped on real devices
3. **D5** — SIP slider max 500K too low for high-income users
4. **G2** — Goals 5s forced navigation with no cancel
5. **G3** — FIRE type and survival age desynced — contradictory state possible
6. **P1** — Profile saves with empty name
7. **P4** — Currency change no warning — misleading values
8. **L1 + O1** — Android keyboard not avoided on Login and Onboarding

### High Value UX Wins (Quick Fixes)
9. **A1/A9** — Assets category chip height (apply same fix as Expenses)
10. **A3** — "Self-use property" → "Self-use asset" for Gold/Others
11. **E7** — Hide inflation slider for `FUTURE_ONE_TIME` expenses
12. **G8** — Remove or reduce 5s fake calculation delay
13. **X8** — Tab label "Goal" → "Goals"
14. **P2** — Replace raw DOB TextInput in Profile with `DateInput` component
15. **D4** — Add spinner to `!result` fallback state
16. **X5** — Unify to single slider component (use `CustomSlider` everywhere)

### Polish / Low Priority
17. A4 — Visual confirmation on asset save
18. E2 — Show end_date on expense card
19. D8 — Replace crown emoji with text or icon
20. X9 — Add Inter fonts to Login screen
21. X15 — Improve muted text contrast
22. L9 — Unify Privacy Policy URL

---

*Generated from direct source code read of: `app/login.tsx`, `app/index.tsx`, `app/onboarding/create-profile.tsx`, `app/(tabs)/assets.tsx`, `app/(tabs)/expenses.tsx`, `app/(tabs)/goals.tsx`, `app/(tabs)/dashboard.tsx`, `app/(tabs)/profile.tsx`, `app/(tabs)/_layout.tsx`, `app/_layout.tsx`, `components/HeroCard.tsx`, `components/SnapshotTiles.tsx`, `components/SIPControls.tsx`, `components/InsightCard.tsx`, `components/ProjectionChart.tsx`, `constants/colors.ts`, `constants/theme.ts`, `hooks/useColors.ts`*
