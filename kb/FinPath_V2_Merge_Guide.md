# FinPath V2 → Existing Project Merge Guide

## Overview

V2 (Replit) has a significantly better UI with a proper design system, gradient hero cards, custom sliders, SVG charts, themed components, and Inter fonts. Your existing project has working IAP, Play Store setup, expo-sharing, and the Android build pipeline.

**Strategy: Copy V2's entire `artifacts/fire-planner/` folder structure into `~/finpath`, then re-wire your IAP and sharing features.**

---

## What V2 Brings (Copy These)

| V2 File/Folder | What It Adds |
|---|---|
| `constants/colors.ts` | Green design palette, card/border/accent tokens |
| `constants/theme.ts` | Cross-platform shadows (iOS/Android/Web), layout constants |
| `hooks/useColors.ts` | Dark/light mode aware color hook |
| `engine/types.ts` | Clean TypeScript types (Profile, Asset, Expense, Goals, Frequency) |
| `engine/calculator.ts` | Full FIRE calculator engine |
| `components/HeroCard.tsx` | Gradient status card (the crown jewel of V2 UI) |
| `components/SnapshotTiles.tsx` | "Today" vs "At Retirement" tiles |
| `components/SIPControls.tsx` | Interactive sliders card |
| `components/SimpleChart.tsx` | SVG projection chart with zoom |
| `components/ProjectionTable.tsx` | Year-by-year table |
| `components/DepletionDialog.tsx` | Corpus depletion warning modal |
| `components/InsightCard.tsx` | AI-style insight cards |
| `components/CustomSlider.tsx` | Styled platform slider |
| `components/ErrorBoundary.tsx` | Crash protection wrapper |
| `components/ErrorFallback.tsx` | Better error UI |
| `context/AppContext.tsx` | Full state management (profile, assets, expenses, goals) |
| `storage/auth.ts` | PIN/biometric auth |
| `storage/secure.ts` | AES-encrypted storage |
| `storage/migrations.ts` | Schema version migrations |
| `storage/session.ts` | Session-level unlock state |
| `app/(tabs)/_layout.tsx` | BlurView tab bar + iOS Liquid Glass support |
| `app/_layout.tsx` | Inter fonts, QueryClient, GestureHandler |
| `app/onboarding.tsx` | Clean onboarding with PIN setup |
| `app/(tabs)/dashboard.tsx` | Full dashboard screen with all V2 components |
| `app/(tabs)/assets.tsx` | Assets screen |
| `app/(tabs)/expenses.tsx` | Expenses screen |
| `app/(tabs)/goals.tsx` | Goals screen |
| `app/(tabs)/profile.tsx` | Profile screen |

## What to Keep from Your Existing Project

| Existing File | Why Keep |
|---|---|
| `android/` folder | Entire build pipeline, keystore, build.gradle |
| `app.json` | App ID `com.aihomecloud.finpath`, version codes |
| `hooks/usePro.tsx` | IAP logic — not in V2 |
| `components/ProPaywall.tsx` | Paywall modal — not in V2 |
| `expo-sharing` integration | CSV export — not in V2 |

---

## Step-by-Step Merge

### Step 1 — Install New Dependencies

V2 uses packages your project may not have. Run inside `~/finpath`:

```bash
npx expo install \
  @expo-google-fonts/inter \
  expo-blur \
  expo-glass-effect \
  expo-symbols \
  expo-linear-gradient \
  expo-local-authentication \
  expo-secure-store \
  expo-crypto \
  aes-js \
  react-native-gesture-handler \
  react-native-keyboard-controller \
  react-native-reanimated \
  @tanstack/react-query \
  @react-native-community/slider
```

> **Note:** `expo-linear-gradient` powers the HeroCard gradient — critical for the V2 look.

---

### Step 2 — Copy the Design System

```bash
# Inside ~/finpath — create folders if they don't exist
mkdir -p constants hooks storage
```

Copy these files verbatim from V2:

- `finpathV2-main/artifacts/fire-planner/constants/colors.ts` → `~/finpath/constants/colors.ts`
- `finpathV2-main/artifacts/fire-planner/constants/theme.ts` → `~/finpath/constants/theme.ts`
- `finpathV2-main/artifacts/fire-planner/hooks/useColors.ts` → `~/finpath/hooks/useColors.ts`

---

### Step 3 — Copy the Engine

```bash
mkdir -p engine
```

Copy verbatim:

- `engine/types.ts` → `~/finpath/engine/types.ts`
- `engine/calculator.ts` → `~/finpath/engine/calculator.ts`

> If your existing project has calculation logic spread across different files, the V2 engine is a complete replacement. It handles SIP, step-up SIP, corpus growth, depletion age, and inflation.

---

### Step 4 — Copy the Storage Layer

```bash
mkdir -p storage
```

Copy verbatim:

- `storage/auth.ts`
- `storage/secure.ts`
- `storage/migrations.ts`
- `storage/session.ts`

---

### Step 5 — Copy All Components

```bash
# Remove old components (back them up first!)
cp -r ~/finpath/components ~/finpath/components_OLD_BACKUP
```

Copy all V2 components into `~/finpath/components/`:

- `HeroCard.tsx`
- `SnapshotTiles.tsx`
- `SIPControls.tsx`
- `SimpleChart.tsx`
- `ProjectionTable.tsx`
- `DepletionDialog.tsx`
- `InsightCard.tsx`
- `CustomSlider.tsx`
- `ErrorBoundary.tsx`
- `ErrorFallback.tsx`
- `KeyboardAwareScrollViewCompat.tsx`

**Also keep from your backup:**
- `components_OLD_BACKUP/ProPaywall.tsx` → copy back to `components/ProPaywall.tsx`

---

### Step 6 — Copy the Context

```bash
mkdir -p context
```

Copy: `context/AppContext.tsx` → `~/finpath/context/AppContext.tsx`

> V2's AppContext has `completeOnboarding`, `exportAll`, `importAll` plus full CRUD for assets/expenses. It replaces any older context/state you had.

---

### Step 7 — Copy Screens

Back up your screens first:

```bash
cp -r ~/finpath/app ~/finpath/app_OLD_BACKUP
```

Then copy from V2:

- `app/_layout.tsx` (root layout with Inter fonts)
- `app/index.tsx` (entry gate)
- `app/onboarding.tsx`
- `app/lock.tsx`
- `app/(tabs)/_layout.tsx`
- `app/(tabs)/dashboard.tsx`
- `app/(tabs)/assets.tsx`
- `app/(tabs)/expenses.tsx`
- `app/(tabs)/goals.tsx`
- `app/(tabs)/profile.tsx`

---

### Step 8 — Re-wire IAP into V2 Profile Screen

V2's `profile.tsx` doesn't have IAP. After copying it, add your upgrade button back.

Open `~/finpath/app/(tabs)/profile.tsx` and add:

```tsx
// At the top — add these imports
import { usePro } from '@/hooks/usePro';
import { ProPaywall } from '@/components/ProPaywall';

// Inside the component
const { isPro, showPaywall, setShowPaywall } = usePro();

// Add this button in the profile screen (find the Export section or add a new one)
{!isPro && (
  <TouchableOpacity
    style={[styles.upgradeBtn, { backgroundColor: colors.primary }]}
    onPress={() => setShowPaywall(true)}
  >
    <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold' }}>
      ✦ Upgrade to Pro — Export Reports
    </Text>
  </TouchableOpacity>
)}

<ProPaywall visible={showPaywall} onClose={() => setShowPaywall(false)} />
```

---

### Step 9 — Re-wire CSV Export into Dashboard

V2's dashboard doesn't have the share/export button. In `app/(tabs)/dashboard.tsx`, find the top area and add:

```tsx
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { usePro } from '@/hooks/usePro';

// Inside component:
const { isPro, setShowPaywall } = usePro();

// Export handler (reuse your existing CSV generation logic)
const handleExport = async () => {
  if (!isPro) { setShowPaywall(true); return; }
  // ... your existing CSV generation code ...
};

// In the JSX, add export button near the header
```

---

### Step 10 — Fix Import Paths

V2 uses `@/` path aliases. Make sure your `tsconfig.json` has:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

And `babel.config.js` has the module resolver:

```js
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module-resolver', {
        root: ['./'],
        alias: { '@': './' }
      }]
    ]
  };
};
```

If `babel-plugin-module-resolver` isn't installed: `npm install --save-dev babel-plugin-module-resolver`

---

### Step 11 — Update app.json

Keep your existing `app.json` but add the font asset:

```json
{
  "expo": {
    "assetBundlePatterns": ["**/*"],
    "plugins": [
      "expo-router",
      "expo-secure-store",
      "expo-local-authentication"
    ]
  }
}
```

---

### Step 12 — Test Build

```bash
cd ~/finpath

# Clear cache
npx expo start --clear

# Or for Android build
cd android && ./gradlew bundleRelease
```

---

## Common Issues to Watch For

| Issue | Fix |
|---|---|
| `LinearGradient` not found | `npx expo install expo-linear-gradient` |
| `Inter_700Bold` undefined | `npx expo install @expo-google-fonts/inter` |
| `useColors` returning undefined | Check `constants/colors.ts` has `light` key |
| `isLiquidGlassAvailable` crash | `npx expo install expo-glass-effect` |
| `expo-symbols` crash on Android | It's iOS-only — V2's layout falls back to Feather icons on Android automatically |
| `KeyboardProvider` not found | `npx expo install react-native-keyboard-controller` |
| AsyncStorage import error | `npx expo install @react-native-async-storage/async-storage` |

---

## Final Checklist

- [ ] All new packages installed
- [ ] `constants/colors.ts` and `theme.ts` in place
- [ ] `hooks/useColors.ts` in place
- [ ] `engine/types.ts` and `calculator.ts` in place
- [ ] `storage/` layer (auth, secure, migrations, session) in place
- [ ] All V2 components copied, ProPaywall kept
- [ ] `context/AppContext.tsx` copied
- [ ] All screens copied, IAP re-wired in profile
- [ ] CSV export re-wired in dashboard
- [ ] `@/` path alias configured in tsconfig + babel
- [ ] App starts without crash on clean cache
- [ ] Dashboard shows HeroCard with gradient
- [ ] IAP paywall still triggers correctly
- [ ] CSV share sheet still works post-purchase
- [ ] Android release build succeeds (`bundleRelease`)
