---
name: Project Overview
description: Finpath — React Native + Expo FIRE calculator Android app with SQLite, local engine, and biometric auth
type: project
originSessionId: b81bf2b0-5bf5-4081-9a9c-496aaf5ad129
---
**Finpath** is a personal finance / FIRE (Financial Independence, Retire Early) calculator Android app.

**Stack:** React Native 0.81 + Expo 54 (managed+bare hybrid), Expo Router (file-based), React Native Paper (MD3 UI on Dashboard/Create Profile only), SQLite (`expo-sqlite`), local TypeScript calculation engine.

**Key features:** Multi-profile with PIN + biometric auth, asset tracking (with category icons + growth rates + self-use flag), expense management (per-expense inflation), simulation-based FIRE engine (Lean/Comfortable/Rich survival ages 85/100/120), net worth bell-curve chart (react-native-svg), CSV export (Pro only), IAP via react-native-iap v14 (`finpath_pro` SKU, Rs.199/$4.99 one-time).

**Dashboard layout:** Hero card (dark green, SIP amount + planStatus title/subtitle + On Track pill + survival pill) → Inflation Insight card (amber) → Snapshot row (TODAY / AT AGE N) → Bell-curve chart → Adjust Your Plan slider → Warning cards → Year-by-year table.

**Goals page:** Retirement Age slider → SIP Stop Age slider → FIRE chips (Lean/Comfortable/Rich/Custom, survival ages 85/100/120) → Inflation Rate slider (3–12%) → Monthly Withdrawal input + future value hint card.

**Project root:** `~/finpath/` on Mac mini (`parasjain@192.168.0.130`)
**Branch:** `replit-assited`
**Latest commit:** `cf58709` (2026-04-18)
**Latest AAB:** `C:\Dropbox\finpath\app-release-v25.aab` (versionCode 25, versionName "1.0.1")

**KB folder:** `~/finpath/kb/` on Mac mini — authoritative docs including `UiUxAudit.md` (full UI/UX audit, 2026-04-18).

**Known systemic issue:** Dual data store — `ProfileProvider` (SQLite) and `AppProvider` (AsyncStorage) both mounted in root layout; bridge via `syncToAppContext` in login.tsx is fragile.

**Why:** App is near launch-ready; audit complete; next phase is working through audit findings.
**How to apply:** Read kb/ files before touching calculator logic, DB schema, or screen layout. Update DECISIONS_AND_LESSONS.md after meaningful changes.
