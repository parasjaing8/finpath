# FinPath -- Transformation Audit & Plan

> Full-stack audit: math, UX, information architecture, human psychology, and Android implementation.
> Date: 2026-04-09. Status updated: 2026-04-11.

---

## Implementation Status Summary

Most Phase 1-5 items have been implemented across r7-r13 sessions and commit eb1fdcb.
Items marked DONE below are verified in code. Items marked OPEN are still pending.

---

## SECTION 1 -- Math & Model Bugs

### M1 -- Goals firePreview excludes postRetirementExpensesPV
**Status: DONE (removed).** Goals preview tile removed entirely.

### M2 -- Dashboard "FIRE Corpus" label on wrong number
**Status: DONE.** Dashboard redesigned with corpus-needed + corpus-at-100 tiles. Surplus/deficit shown.

### M3 -- Pension inflation hardcoded at 6%, ignores goals inflationRate
**Status: OPEN.** PENSION_INFLATION_RATE is still 0.06 hardcoded in calculator.ts. This is intentional (Option B from original audit) -- 6% pension inflation is a model assumption, not a user preference. The goals inflation_rate is used for expense PV discounting only.

### M4 -- postSipReturnRate applied at sipStopAge, not retirementAge
**Status: DONE.** Dashboard slider labels corrected to reference sipStopAge.

### M5 -- calculatePresentValueOfExpenses ignores goals.inflation_rate
**Status: DONE.** expenses.tsx now passes goals.inflation_rate to the PV function.

---

## SECTION 2 -- Information Architecture

### IA1 -- Tab order
**Status: DONE.** Tried Dashboard-first, reverted. Final order: Assets -> Expenses -> Goal -> Dashboard -> Profile. Assets-first chosen because it is the natural data entry starting point.

### IA2 -- Tab names
**Status: NOT DONE (decided against).** Original names kept. "Assets/Expenses/Goal/Dashboard/Profile" are clear enough.

### IA3 -- Empty dashboard state
**Status: DONE.** Empty state shows icon + "Set Your Plan" CTA navigating to Goals.

---

## SECTION 3 -- Goals Screen

### G1 -- Remove FIRE corpus preview tile
**Status: DONE.**

### G2 -- "Pension" terminology
**Status: DONE.** Renamed to "Monthly Retirement Withdrawal".

### G3 -- Save confirmation alert
**Status: DONE.** Removed. Save is immediate.

### G4 -- CTA button name
**Status: DONE.** Renamed to "Save Plan".

### G5 -- Inflation rate slider context
**Status: DONE.** Inflation slider correctly labeled. PENSION_INFLATION_RATE kept as separate constant (see M3).

### G6 -- SWR dialog hidden behind icon
**Status: OPEN.** Still only accessible via (i) icon. Low priority.

---

## SECTION 4 -- Dashboard

### D1 -- Fix the "At Retirement" tile
**Status: DONE.** Redesigned with corpus-needed + corpus-at-100.

### D2 -- Reduce slider complexity
**Status: DONE.** Primary slider (Monthly SIP) always visible. Advanced section (SIP return, post-SIP return, step-up) collapsible.

### D3 -- Chart improvements
**Status: PARTIALLY DONE.** Corpus target line + FIRE intersection dot added. Post-retirement shows withdrawal line only. "You Are Here" current-position marker not yet added.

### D4 -- SIP burden warning hierarchy
**Status: DONE.** 4 severity levels (CRITICAL/HIGH/MODERATE/INFO) with distinct visual treatment.

### D5 -- "No SIP needed" celebration state
**Status: OPEN.** Still shows plain text.

### D6 -- Year-by-year table: hide empty Vesting column
**Status: OPEN.**

---

## SECTION 5 -- Assets Screen

### A1 -- Per-asset ROI slider
**Status: DONE.** Removed from form. Uses DEFAULT_GROWTH_RATES. Blended rate computed from portfolio automatically.

### A2 -- Gold/Silver grams input
**Status: DONE.** Grams mode removed. Value-only.

### A3 -- Self-use real estate toggle
**Status: OPEN.** Toggle still uses text-switching button style.

---

## SECTION 6 -- Expenses Screen

### E1 -- Red banner color
**Status: KEPT AS-IS.** Banner uses #B71C1C (deep red). Decision to keep for visual emphasis.

### E2 -- Expense type labels
**Status: DONE.** Plain-language labels with contextual hints: "Regular Expense", "Future One-Time Cost", "Future Recurring Cost".

### E3 -- Keyboard avoidance
**Status: OPEN.** Still uses manual keyboardOffset calculation.

---

## SECTION 7 -- Profile Screen

### P1 -- Edit profile functionality
**Status: DONE.** Edit profile screen exists at app/onboarding/edit-profile.tsx. Supports income, DOB, currency, PIN change.

### P2 -- Income display format
**Status: OPEN.** Still uses manual K truncation instead of formatCurrency.

---

## SECTION 8 -- Onboarding & Login

### O1 -- Primer on pension/withdrawal concept
**Status: DONE.** CorpusPrimer component added to Goals screen -- first-time dialog explains corpus, withdrawal, SWR, SIP.

### O2 -- Biometric auto-trigger on profile selection
**Status: OPEN.** Still auto-triggers for all profiles, not just single-profile case.

---

## SECTION 9 -- Remaining Open Items (Priority-Ordered)

1. **D3 partial:** "You Are Here" current-position marker on chart
2. **D5:** "No SIP needed" celebration state
3. **D6:** Hide empty Vesting column in year-by-year table
4. **E3:** Keyboard avoidance fix in expenses form
5. **A3:** Self-use real estate toggle UX
6. **P2:** Income display format consistency
7. **G6:** Inline SWR summary under chip selector
8. **O2:** Biometric auto-trigger only for single profile

---

## One-Number Principle (Design North Star)

FinPath's one number: **"You need X/month SIP to retire at age Y."**
Every screen supports that number. Dashboard leads with it. Goals screen sizes it. Assets and expenses feed it. Chart shows the journey.
