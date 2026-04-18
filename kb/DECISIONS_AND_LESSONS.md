# FinPath -- Decisions, Edge Cases & Lessons Learned

> Running log of non-obvious decisions, bugs fixed, and edge cases handled.
> Add an entry whenever a meaningful change is made. Date each entry.
> This prevents re-litigating solved problems or re-introducing fixed bugs.

---

## 2026-04-19 -- Deep audit: dual storage is the #1 risk

**Finding:** App has two storage layers (AsyncStorage encrypted blobs + SQLite normalized rows) that are NOT synchronized atomically. Mutations write to both but if one fails, data diverges permanently. On login, SQLite overwrites AppContext, which could lose AsyncStorage-only data.

**Decision:** Must resolve before next major feature. Recommended approach: make SQLite the single source of truth. Remove dual-write complexity from AppContext mutations.

**Full audit:** `kb/deepAudit.md` — 5 critical bugs, 6 high bugs, 50+ hardcoded colors, missing test coverage for `calculateFutureGoalsCorpus`, input validation gaps across all forms.

---

## 2026-04-19 -- totalNetExpenses formula is wrong

**Bug:** `calculator.ts:579` adds pension income to planned expenses post-retirement. Pension is income, not expense. Field shows inflated values in projections. Display-only (core FIRE math unaffected) but dashboard/table numbers are misleading.

**Fix needed:** Change to `plannedExpenses - pensionIncome` (net corpus withdrawal).

---

## 2026-04-06 -- Pension model clarification

**Decision:** Pension is a systematic corpus withdrawal, not external income.

**Correct model:**
- Pension = monthly amount the user withdraws from their own corpus post-retirement.
- FIRE corpus = pension/SWR. The corpus must be large enough so that withdrawing pension
  every month (inflation-adjusted) does not deplete it.
- There is no "external pension" concept in FinPath.

**What was fixed:** `calculateFireCorpus` takes only `(pension, yearsToRetirement, SWR, postRetirementExpPV)`.

---

## 2026-04-06 -- Expense funding source by type

**Rules:**
- `CURRENT_RECURRING` -> always salary-funded, always stop at retirement age.
- `FUTURE_ONE_TIME` / `FUTURE_RECURRING` -> salary-funded if before retirement, corpus-funded if at or after retirement.

**Impact on FIRE corpus:**
```
FIRE corpus = pension/SWR + PV(post-retirement FUTURE expenses)
```

---

## 2026-04-06 -- Default end date for CURRENT_RECURRING expenses

When creating a new `CURRENT_RECURRING` expense, the end date pre-fills to the user's retirement year (Dec 31, birthYear + retirementAge). User can always change it.

---

## 2026-04-06 -- Pension inflation rate vs expense inflation rate

Pension withdrawals inflate at `PENSION_INFLATION_RATE` (6% fixed), separate from the user-configurable `inflation_rate` on goals. Do not merge these two rates -- they serve different purposes.

---

## 2026-04-06 -- Screenshot blocking

`FLAG_SECURE` added to `MainActivity.kt` -- applies to entire app. Users cannot take screenshots (by design).

---

## 2026-04-06 -- Biometric login is per-profile, opt-in

Each profile independently stores a biometric opt-in flag in SecureStore.
- Biometric auto-triggers on profile select (if enrolled + enabled).
- NOT triggered during lockout.
- Toggle available during profile creation and on Profile tab.
- Flag cleared on profile deletion.

---

## 2026-04-06 -- SIP stop age must use local variable, not state

`setSipStopAge()` is async -- state does not update before the next line reads it. Compute `correctedSipStopAge = Math.min(sipStopAge, retirementAge)` as a local variable, use in both setState and saveGoals.

---

## 2026-04-06 -- Date parsing must use local time, not UTC

`new Date("2000-01-01")` is parsed as UTC. In UTC+ timezones this is fine, but UTC- shows the previous day. Fix: always use `new Date(year, month - 1, day)` for local time.

---

## 2026-04-06 -- console.error in production leaks info

All `console.error` calls gated behind `if (__DEV__)`. Production errors captured by Sentry (if DSN configured) or silently caught.

---

## 2026-04-06 -- Operator precedence with ?? (fragile)

`(goals.inflation_rate ?? DEFAULT_DISCOUNT_RATE * 100) / 100` works by accident. Fixed to: `(goals.inflation_rate ?? (DEFAULT_DISCOUNT_RATE * 100)) / 100`. Always add explicit parentheses around `??` fallback with arithmetic.

---

## 2026-04-08/09 -- Two-Bucket Growth Model

### Per-Asset Growth Rates via Two-Bucket Model

- `existingBucket`: current investable assets, grows at `computeBlendedGrowthRate()` (weighted avg of per-asset `expected_roi`)
- `sipBucket`: new SIP contributions, grows at `sipReturnRate`
- At retirement: merge into `existingBucket`, then grow at `postSipReturnRate`
- `expected_roi` stored in SQLite; 0 = unset (uses `DEFAULT_GROWTH_RATES`)
- Self-use real estate excluded from blended rate

### Bug Fixed: sipStopAge == retirementAge Drops Last SIP

When SIP stop age equals retirement age, the last annual SIP was silently dropped because merge block zeroed sipBucket before the final SIP was added. Fixed by adding `if (age <= sipStopAge) existingBucket += annualSIP` before merge in BOTH `calculateProjections` and `simulateCorpusAtAge`.

---

## 2026-04-08/09 -- UX Changes

1. Login: auto-selects single profile; redirects to Assets tab
2. Profile edit: DOB now editable via DateInput
3. Biometric: enabled by default on profile creation
4. Goals: removed FIRE terminology, FIRE type chips (Slim/Moderate/Fat/Custom)
5. Dashboard: "Corpus"/"Financial Freedom" replaces "FIRE"; chart simplified
6. Per-asset ROI slider removed from form (uses DEFAULT_GROWTH_RATES)
7. Tab reorder: tried Dashboard-first, reverted to Assets-first (final)

---

## 2026-04-09/10 -- Full UX overhaul (r7-r13)

- CorpusPrimer: first-time onboarding dialog (Goals screen) + inline lightbulb hint
- Dashboard redesign: summary tiles, collapsible Advanced section, SIP burden warning (4 severity levels)
- Goals: renamed "Pension" -> "Monthly Retirement Withdrawal", removed save alert, CTA renamed "Save Plan"
- Expenses: neutral blue-grey accent, plain-language type labels with contextual hints
- Assets: Gold/Silver grams input removed
- Chart: post-retirement shows withdrawal line only, corpus intersection dot + label
- SIP engine: switched to FV annuity formula, prorate current year to remaining months
- Inflation consistency: expenses PV uses `goals.inflation_rate`
- Return rate slider labels corrected (sipStopAge not retirementAge)
- Logout moved from Dashboard header to Profile page (r13)

---

## 2026-04-11 -- Monetization: single-app + IAP (DONE)

**Decision:** Single app on Play Store. One non-consumable IAP (`finpath_pro`, Rs.199/$4.99) gates only CSV export. All other features free including unlimited profiles.

**Old strategy:** Two separate Play Store listings (FinPath free + FinPath Pro paid).
**Why changed:** Simpler discovery, lower friction, CSV export justifies one-time purchase without blocking core value.

**Code changes (commit eb1fdcb):**
- login.tsx: removed usePro/ProPaywall imports, removed isPro gate on "Add New Profile"
- create-profile.tsx: removed getAllProfiles/usePro/ProPaywall imports, removed Pro gate block
- ProPaywall.tsx: removed `reason` prop, removed "Unlimited profiles" from FEATURES, updated headline
- dashboard.tsx: removed `reason="export"` from ProPaywall usage
- No stale Pro/profiles references remain in code.

---

## Build Process Notes

- Keystore: `~/finpath/android/app/finpath-release.jks`
- Keystore props: `~/finpath/android/keystore.properties` (not committed -- regenerate if missing)
- Build command (run on Mac Mini):
  ```bash
  export JAVA_HOME=/opt/homebrew/opt/openjdk@17
  export ANDROID_HOME=$HOME/Library/Android/sdk
  export PATH=/opt/homebrew/bin:$JAVA_HOME/bin:$PATH
  cd /Users/parasjain/finpath/android
  ./gradlew bundleRelease
  ```
- Output: `android/app/build/outputs/bundle/release/app-release.aab`
