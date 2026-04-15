# Finpath — UX & Pre-Launch Audit

> Generated: 2026-04-15. Implement tasks one-by-one; mark [x] when done.
> Priority tiers: **P0** = must-do before Play Store submit | **P1** = should-do before v1.1 | **P2** = nice to have

---

## Strengths (do not change these)

- Fully offline, zero backend — strongest possible privacy story for a finance app
- `FLAG_SECURE` — financial data cannot be screenshotted or appear in recent apps
- Hardware-backed PIN storage (Android Keystore via SecureStore)
- Binary search SIP sizing — full lifecycle simulation, not a simplified formula
- Per-expense inflation rate — EDUCATION 10%, EMI 0% independently
- CorpusPrimer — education flow before goals entry
- SWR dialog with Indian context (3%/5%/7%, SWP note, post-tax risk)
- Progressive PIN lockout — 5→8→11 attempts with escalating delays
- Cause story (51% to charity)

---

## P0 — Must-do before Play Store submit

| # | Status | Task | Detail | Effort |
|---|--------|------|--------|--------|
| 1 | [ ] | Deploy privacy policy | Single URL; fix both code references (ProPaywall.tsx + any other). Target: `https://parasjaing8.github.io/finpath/PRIVACY_POLICY` | 1 hr |
| 2 | [ ] | Create `finpath_pro` in Play Console | In-app product, type must be `"inapp"` (not subscription). Fix product type string in `hooks/usePro.tsx` if needed. | 2 hr |
| 3 | [ ] | Remove "coming soon" items from ProPaywall | Delete or hide any features listed as coming soon in `components/ProPaywall.tsx` — Play Store rejects placeholder content | 5 min |
| 4 | [ ] | Fix `app.json` versionCode to 6 | Currently `versionCode` in `app.json` may be mismatched from `build.gradle`. Align to 6. | 5 min |
| 5 | [ ] | Test full IAP + biometric flow on physical device | Emulator cannot test Play Billing. Need sideload on real Android device. | 2 hr |
| 6 | [ ] | Create store listing assets | 4 screenshots (1080×1920 or 1080×2400), feature graphic (1024×500), short + full description | 4 hr |
| 7 | [ ] | Add Sentry DSN | Create project on sentry.io, add DSN to `.env`, rebuild. Currently crash reporting is inactive. | 30 min |
| 8 | [ ] | Add financial advice disclaimer | Small text on Dashboard + Goals: "For illustrative purposes only. Not financial advice." Reduces legal risk. | 30 min |
| 9 | [ ] | Substantiate or soften the 51% charity claim | Either link to a registered trust/NGO or change copy to "we plan to donate..." — false claims = Play Store policy violation | 1 hr |
| 10 | [x] | Fix currency symbol on Profile screen | `profile.tsx:75` was printing "INR"/"USD" string instead of ₹/$ symbol. Fixed 2026-04-15. | done |

---

## P1 — Should-do before v1.1

| # | Status | Task | Detail | Effort |
|---|--------|------|--------|--------|
| 11 | [ ] | Fix FIRE type naming confusion | "Lean" (7% SWR, 85 yr horizon) is risky, not conservative — name misleads. Add risk labels or rename chips (e.g. Aggressive / Balanced / Conservative) | 2 hr |
| 12 | [ ] | Empty dashboard state when Goals not set | Dashboard shows NaN/zero corpus when user hasn't visited Goals. Show a CTA card: "Set your retirement goal to see projections." | 1 hr |
| 13 | [ ] | Seed SIP slider to 10% of income | Currently seeds to 0. Default to `Math.round(profile.monthly_income * 0.10 / 1000) * 1000` for a meaningful first view. | 30 min |
| 14 | [ ] | Move asset delete to edit modal | Expenses already do this (delete in modal, not swipe). Assets still use swipe-to-delete. Make consistent. | 1 hr |
| 15 | [ ] | Fix CorpusPrimer dismissal | Verify dismiss state persists in AsyncStorage correctly across app restarts (not just in-session state). | 1 hr |
| 16 | [ ] | Fix ESOP vesting date validity check | Validate that `vesting_end_date >= next_vesting_date` on asset save; currently silently accepts invalid ranges. | 30 min |
| 17 | [ ] | Change expense card accent from red to neutral | Expense tiles use a red left-border/tint — implies negative/error. Use grey or category color instead. | 10 min |
| 18 | [ ] | Enable R8 minification | `minifyEnabled false` in `build.gradle` keeps AAB at ~108 MB. Enable R8 + add keep rules for expo/react-native. | 2 hr |
| 19 | [ ] | Fix `withReleaseSigning.js` regex | Step-3 regex is broken — signingConfig block must be manually patched after every `expo prebuild --clean`. | 2 hr |
| 20 | [ ] | Add "About / version" to Profile screen | Show app version (from `app.json`) and build number. Helps support and Play Store review. | 30 min |

---

## P2 — Nice to have

| # | Status | Task | Detail |
|---|--------|------|--------|
| 21 | [ ] | Setup sequence guide for first-time users | 3-step progress indicator: "Add assets → Add expenses → Set goal". Guides new users to the correct flow. |
| 22 | [ ] | Profile avatar color differentiation | Each profile gets a distinct color (hash name → hue) so multi-profile users can distinguish at a glance. |
| 23 | [ ] | PIN recovery flow | Name + DOB challenge to reset PIN. Currently a forgotten PIN = locked out forever. |
| 24 | [ ] | No-goals empty state on Dashboard with CTA | Specific empty state (separate from #12) for the chart area when no projection data exists. |

---

## Completed

| Date | # | What was done | Commit |
|------|---|---------------|--------|
| 2026-04-15 | 10 | Fixed currency symbol on Profile screen (`profile.tsx:75` — `INR`/`USD` string → `₹`/`$` symbol) | TBD |

