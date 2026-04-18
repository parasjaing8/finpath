# FinPath — Project Context
Last Updated: April 2026

## What is FinPath
A 100% offline personal finance freedom planner for salaried professionals aged 20-45.
No pension after retirement — FinPath helps build a corpus that generates passive income
from retirement until age 100. Purely offline. No cloud. No data collection.

## App ID
- Current: com.aihomecloud.finpath ✓ DONE

## App Version
- Target: 1.0.0

## Developer Note shown in app
"51% of FinPath's profits go towards food and education for underprivileged
children in rural India. Your plan, their future."

## Tech Stack
- Built with React Native / Expo (confirm exact stack)
- Android target
- Offline only — local storage, no backend

## Full App Flow

### Screen 1 — Profile Creation
- Welcome to FinPath / Personal Finance Freedom Planner
- Fields: Full Name, DOB, Monthly Take-Home Income, Currency (INR/USD), PIN (6-digit), Confirm PIN
- Create Profile button
- Developer note at bottom

### Screen 2 — Assets (Default Tab)
- Top tile: Total Net Worth (default 0)
- Note: Excludes self-use real estate
- Asset categories: ESOP/RSU, Stocks, Mutual Fund, Savings, Gold/Silver, PF/MPS, Real Estate, Others
- Each asset: Name, Current Value, Growth Rate slider
- ESOP/RSU includes vesting schedule: start date, end date
- Each asset saved as individual tile
- Net worth updates live

### Screen 3 — Expenses
- Top tile (red): Pre-retirement expenses in today's value
- Label: "What your salary must cover before retirement"
- 3 expense types:
  - Regular Expense: Amount, End Date (optional, default retirement age 60), Inflation Rate slider
  - Future One-Time Cost: Amount, Start Date, Inflation Rate slider
  - Future Recurring Cost: Amount, Frequency (Monthly/Quarterly/Half-Yearly/Yearly), Start Date, End Date, Inflation Rate slider
- Each expense shown as tile in red with delete option

### Screen 4 — Goals
- Two educational popups on entry
  - Popup 1: How FinPath Plans Your Retirement (4 sections: Corpus, Monthly Withdrawal, SWR, SIP)
  - Popup 2: Bulb tip popup
- Fields: Retirement Age, SIP Stoppage Age (cannot exceed retirement age)
- SWR Section with info popup:
  - 3% Fat FIRE — conservative debt fund
  - 5% Moderate FIRE — balanced equity/debt
  - 7% Slim FIRE — equity-heavy aggressive
  - Red warning: Tax, TDS, exit loads may reduce actual returns. Plan conservatively.
- Monthly Withdrawal Target (today's value)
- Save Plan button → goes to Dashboard

### Screen 5 — Dashboard
- Top indicator tiles (dynamic, respond to sliders):
  - Monthly SIP Required (rounded to nearest 1000)
  - Financial Freedom Age
  - Goal Status (green/red circle — On Track / Off Track + surplus amount)
- Today tile: Investable Net Worth + Total Net Worth
- Projection tile: Corpus at retirement age + Corpus at age 100
- Adjust SIP Plan section: Monthly SIP slider, SIP stop age, step-up %, returns
- Advanced toggle: Pre-retirement return % slider, Post-retirement return % slider
- Step-up toggle (default ON) with step-up % slider
- Net Worth Projection Chart: 3 plots — Corpus growth, Withdrawal, FIRE number line
- Year-by-Year Projection Table: Year, Age, Annual Pension, Net Worth
- Download Report: ₹199 (INR) / $4.99 (USD) — In-App Purchase

### Screen 6 — Profile
- Edit: DOB, Monthly Salary, Currency, PIN
- Delete Profile option

## Bottom Navigation
Assets | Expenses | Goals | Dashboard | Profile

## Monetization
- One-time IAP: Download full report
- INR: ₹199
- USD: $4.99

## Known Bugs / Pending Fixes
- [ ] FIRE number and corpus-at-age reference showing two inconsistent calculations
      → Both must anchor to retirement age, project forward to age 100 — unified formula needed

## Play Store Readiness — Stage Tracker
- [x] Developer account created and active
- [x] Stage 1: Change App ID to com.aihomecloud.finpath — DONE (commit 9de20aa)
- [ ] Stage 2: Privacy Policy page on aihomecloud.com
- [ ] Stage 3: App icon 512x512, Feature graphic 1024x500, Screenshots, Description
- [ ] Stage 4: Generate release keystore, Build signed AAB
- [ ] Stage 5: Submit — content rating, target audience, IAP setup, review

## Build Notes

### keystore.properties
- File location: ~/finpath/android/keystore.properties
- This file is gitignored and NOT committed — exists on Mac only
- **Must be recreated after every expo prebuild --clean** — that command wipes the entire android/ folder
- Contents:
  storeFile=/Users/parasjain/finpath/finpath-release.jks
  storePassword=Paras@iisc18
  keyAlias=finpath
  keyPassword=Paras@iisc18
- Keystore file lives at: ~/finpath/finpath-release.jks
- storeFile must be ABSOLUTE PATH — relative path causes "keystore not found" error
- signingConfig in release buildType also reverts after clean prebuild — fix with python3 regex (see logs.md)
- versionCode in build.gradle must be manually patched after every prebuild

## Decisions — FINAL (Do Not Reopen)
- App is 100% offline. No cloud. No backend. FINAL.
- Single codebase on Mac Mini only. FINAL.
- App ID: com.aihomecloud.finpath. FINAL.
- Currency support: INR and USD. FINAL.
- Default retirement age: 60. FINAL.
- IAP price: ₹199 / $4.99. FINAL.

## Session Log
### April 2026 — Session 1
- Full app documented from scratch
- Master KB and CONTEXT.md created
- Play Store stage plan defined
- Environment architecture finalized
- Pending: Start Stage 1 — App ID change

### April 2026 — Session 2 + 3
- Stage 1 complete: App ID changed from com.anonymous.finpath to com.aihomecloud.finpath (commit 9de20aa)
- expo prebuild --clean run — android/ regenerated with correct App ID
- IAP error handling added: errorMessage state in usePro, red error text in ProPaywall (commits 3b49de1, 8aab2f4, 0d44795)
- react-native-iap v14 API fixed: getProducts→fetchProducts, requestPurchase signature updated (commit c6cf1d8)
- versionCode bumped to 5; release AAB built and signed (108MB)
- AAB at: C:\dropboxinpathpp-release.aab
- Latest commit: c6cf1d8
