# FinPath — Transformation Audit & Plan

> Full-stack audit: math, UX, information architecture, human psychology, and Android implementation.
> Written as a senior principal engineer with finance, UX, and mobile expertise.
> Date: 2026-04-09

---

## Executive Summary

FinPath has a solid financial model and a working end-to-end flow. The core calculation engine is
well-designed and handles the hard parts correctly (full lifecycle SIP, postRetirementExpensesPV,
progressive lockout, ESOP vesting). What needs work is **trust** and **clarity** — users interacting
with their financial future need absolute confidence in every number they see. Right now there are
at least two places where numbers contradict each other or wear the wrong label, and the information
architecture puts users in the wrong place at the wrong time.

The transformation is primarily **UX and information architecture** with targeted math fixes and a
few missing features that meaningfully change the product's completeness.

---

## SECTION 1 — Math & Model Bugs

These are correctness issues. Fix before any UX work.

### M1 — Goals firePreview excludes postRetirementExpensesPV (REMOVE)
**Status:** Moot — user has decided to remove the goals firePreview tile entirely. ✓

### M2 — Dashboard "FIRE Corpus" label on wrong number (HIGH)
**File:** `dashboard.tsx` — Projections tile
**Bug:** `result.netWorthAtRetirement` (projected accumulated corpus = what you WILL have) is labeled
"FIRE Corpus". FIRE corpus is what you NEED. These are completely different numbers.
```
netWorthAtRetirement  = simulation output — corpus accumulated by retirement via SIP
result.fireCorpus     = pension/SWR + postRetirementExpensesPV — the target
```
**Fix:** Relabel as "Projected at Retirement" with a secondary line showing the FIRE target for
context: "Need: {fireCorpus}" or integrate as a gap indicator (see UX section).

### M3 — Pension inflation hardcoded at 6%, ignores goals inflationRate (MEDIUM)
**File:** `calculator.ts` — `PENSION_INFLATION_RATE = 0.06` hardcoded
**Bug:** The Goals screen has an inflation rate slider (0–9%) and displays it in the subtitle
("Inflation X%"). But `PENSION_INFLATION_RATE` is always 6% regardless of what the user sets.
So "Inflation 7%" in the goals subtitle does nothing to the pension corpus formula.
The inflation rate only affects `postRetirementExpensesPV` discounting — users have no idea.
**Fix Options:**
- Option A (minimal): Use `goals.inflation_rate` as pension inflation rate in the corpus formula.
  Replace `PENSION_INFLATION_RATE` with `discountRate` (which already reads from `goals.inflation_rate`).
  This makes the system consistent. The constant still serves as a default for display/reference.
- Option B (correct model): Keep pension inflation at 6% (it's a reasonable long-run assumption)
  but rename the slider to "Expense Discount Rate" and remove it from the FIRE corpus subtitle.
  The inflation slider should only appear in the expenses context.
**Recommended:** Option B. The 6% pension inflation is a financial model assumption, not a user preference.
Remove the inflation slider from the goals FIRE corpus subtitle line. Move it to the "Post-Retirement
Future Expenses" section if kept at all.

### M4 — postSipReturnRate applied at sipStopAge, not retirementAge in simulateCorpusAtAge (LOW)
**File:** `calculator.ts:simulateCorpusAtAge`
```ts
const returnRate = age <= sipStopAge ? sipReturnRate : postSipReturnRate;
```
This is correct design (returns step down when SIP stops because portfolio shifts defensive) but
the label on the dashboard says "Expected Return (Post-Retirement)". Users read this as applying
after retirement, but it actually applies after SIP stops. If sipStopAge=55 and retirementAge=60,
the lower rate applies from 55, not 60.
**Fix:** Rename dashboard slider label to "Return Rate After SIP Stops (age {sipStopAge})" or
add a tooltip. The calculation is intentional; the label is wrong.

### M5 — calculatePresentValueOfExpenses in expenses.tsx uses DEFAULT_DISCOUNT_RATE, ignores goals.inflation_rate (LOW)
**File:** `expenses.tsx` calls `calculatePresentValueOfExpenses(currentProfile, expList, retirementAge)`
The function signature uses `DEFAULT_DISCOUNT_RATE` (6%) as the default. But if the user set
inflation to 8% in goals, the expenses banner shows PV discounted at 6%.
**Fix:** Pass `goals?.inflation_rate / 100 ?? DEFAULT_DISCOUNT_RATE` to the function call.

---

## SECTION 2 — Information Architecture

### IA1 — Tab order is backwards for new users (HIGH)

**Current:** Assets → Expenses → Goals → Dashboard → Profile

**Problem:** After login, users land on Assets — a data entry screen. For a new user, this
is a blank sheet asking "add assets by category" with no context. Finance apps succeed when
they show the destination (projection, outcome) before asking for inputs. Apps like Groww,
Zerodha Coin, and CRED all show the "what you have/gain" screen first, then drill down.

The natural journey should be:
1. Dashboard first — "here's what your FIRE looks like" (even with default/zero data)
2. Goals — set your retirement target
3. Assets — enter what you have today  
4. Expenses — enter what you spend
5. Profile — settings

**Recommended new order:** Dashboard → Goals → Assets → Expenses → Profile

The dashboard should handle the empty-state gracefully ("Set goals to see your projection" →
CTA button to Goals). This creates a pull-forward UX instead of a push-from-behind one.

### IA2 — Tab names don't communicate value (MEDIUM)

| Current | Proposed | Reason |
|---|---|---|
| Assets | Wealth | More aspirational. "Assets" is accounting jargon. |
| Expenses | Outflows | Clearer in FIRE context — these are what the plan must cover |
| Goals | Plan | FIRE plan is the mental model. "Goals" is generic. |
| Dashboard | Projection | More specific — tells users what they'll find |
| Profile | Profile | Keep as-is |

These are tab label changes only (no logic change). Purely psychological framing.

### IA3 — Empty dashboard state sends users to a dead end (MEDIUM)

**Current:** If no goals are set, dashboard shows "Set your goals first to see projections." with no
action. Users must know to tap the Goals tab.
**Fix:** Show a CTA button: "Set Your Retirement Plan →" that navigates to Goals. The empty state
is a conversion moment — treat it as one.

---

## SECTION 3 — Goals Screen Transformation

### G1 — Remove FIRE corpus preview tile (CONFIRMED)
Decision made. Done.

### G2 — "Pension" terminology is wrong for the model (HIGH)

**Current label:** "Monthly pension / passive income"
**Helper text:** "e.g. rental income, govt pension. It will be inflation-adjusted at 6% and credited from retirement age onwards."

**Problem:** Per the financial model and kb/FINANCIAL_MODEL.md, this is NOT rental income or govt
pension. It is the **monthly corpus withdrawal target** — the amount the user wants to draw from
their own invested portfolio each month in retirement. Calling it "pension or passive income" invites
users to enter their rental income here, which would completely missize the corpus.

A user with ₹30K/month rental income + wanting ₹70K/month lifestyle should enter ₹70K (total
withdrawal), not ₹30K. But the label implies ₹30K. This is a model-breaking UX bug.

**Fix:** Rename to "Monthly Retirement Withdrawal" or "Monthly Living Target in Retirement".
Helper text: "How much you want to withdraw from your corpus each month after retiring (in today's
value). This sizes your FIRE corpus target via the SWR you set above."
Remove "e.g. rental income, govt pension" — it's factually wrong for this model.

### G3 — Save confirmation alert is unnecessary friction (MEDIUM)
**Current:** Tapping "Calculate & View Dashboard" shows Alert.alert with "This will overwrite your
current goals" message requiring a second tap to confirm.
**Problem:** This is the user's own data in their own profile. It's not a destructive action — it's
a save. The alert adds friction with no real protection. YNAB, Mint, Personal Capital — none of
them confirm goal saves.
**Fix:** Remove the Alert.alert. Save immediately on button tap, show a brief inline confirmation
("Saved ✓"), and navigate. If goals changed materially, the dashboard will reflect it automatically.

### G4 — CTA button name is wrong (LOW)
**Current:** "Calculate & View Dashboard"
**Fix:** "Save Plan" — cleaner, one job, no false promise of instant calculation.
The dashboard will always show the calculation automatically.

### G5 — Inflation rate slider context is wrong (MEDIUM)
**Current:** The inflation rate slider is under "Post-Retirement Inflation" but its subtitle says
"Expected inflation rate for your post-retirement lifestyle expenses." The slider shows in the
FIRE corpus subtitle line as "Inflation X%", implying it affects the main FIRE number. It does
not — pension inflation is hardcoded at 6% (see M3).
**Fix (aligned with M3 fix):** If pension inflation stays hardcoded, remove "Inflation X%" from the
corpus subtitle. The slider label should say "Expense Discount Rate (for future planned spends)" and
only appear if the user has future post-retirement expenses. This removes confusion for 95% of users
who just have current recurring expenses and a pension withdrawal target.

### G6 — SWR dialog is hidden behind an icon (LOW)
**Current:** The (i) icon next to "FIRE Type — Withdrawal Rate" opens an explanation dialog.
Most users won't tap it, and those who need it most won't know it's there.
**Fix:** Show a 1-2 line inline summary under the chip selector (always visible), keep the (i)
for the full Trinity Study explainer. Example inline text: "Lower rate = larger corpus needed, safer.
3% (Fat) is ultra-conservative, 5% (Moderate) is the common choice, 7% (Slim) is optimistic."

---

## SECTION 4 — Dashboard Transformation

### D1 — Fix the "At Retirement" tile (HIGH)
**Current:** Shows `netWorthAtRetirement` labeled "FIRE Corpus"
**Problem:** This is the projected accumulated corpus (what you WILL have), not the FIRE target
(what you NEED). They're fundamentally different numbers. Labeling accumulated corpus as "FIRE Corpus"
is the single biggest trust-breaking issue in the app.

**Proposed redesign for the Projections tile:**
```
Projections                           (purple header)
─────────────────────────────────────
At Retirement (Age {retirement_age})
Projected Corpus     ₹1.2 Cr         ← netWorthAtRetirement (what you WILL have)
FIRE Target          ₹95 L           ← result.fireCorpus (what you NEED)
──── Surplus: ₹25 L (26% buffer) ───  ← green if surplus, red if deficit
─────────────────────────────────────
At Age 100
₹45 L remaining                      ← netWorthAtAge100
```

This single redesign eliminates the confusion, adds the surplus/deficit gap (the number users
actually want to know), and keeps both pieces of information visible.

### D2 — Reduce slider complexity (HIGH)

**Current sliders:** Monthly SIP, SIP Return Rate, Post-Retirement Return Rate, Step-Up toggle + rate.
That's up to 5 interactive controls in one section, which is cognitively overwhelming.

**Finance app psychology:** Users want to know "am I on track" and "what levers do I have." They
don't want to tune 5 parameters simultaneously. Wealthfront, Vanguard, and all mature planning tools
expose 1-2 primary sliders and hide the rest behind "Advanced."

**Proposed structure:**
```
Primary slider:  Monthly SIP  (always visible)
Secondary row:   Expected Return [12%]  Step-Up [10%/yr ON]  ← tappable, opens Advanced
Advanced panel:  SIP return rate, post-SIP return rate, step-up rate (collapsible)
```

The primary interaction is "how much can I invest per month" — keep that front and center.

### D3 — Chart improvements (MEDIUM)

1. **Add "You Are Here" dot** — A circle on the net worth line at current age/year, labeled
   "Today: ₹X". Users anchored on their current position track the chart better.

2. **Rename chart lines in legend:**
   - "Net Worth" → "Your Corpus"
   - "Outflow" → "Annual Withdrawal" (the pre-retirement outflow line is salary-funded expenses,
     which don't affect corpus. Showing them alongside corpus growth misleads users. Consider
     removing the outflow line pre-retirement entirely, or only showing it post-retirement
     where it actually hits the corpus.)
   - "FIRE @ Age X" → "FIRE Target" (the orange line is the corpus level, not the age label)

3. **Chart empty state** — When chartData.length === 0, show a minimal motivational placeholder,
   not just "No projection data available."

### D4 — SIP burden warning needs hierarchy (LOW)

**Current:** Four different conditions all producing the same visual treatment (colored card, same
icon style). Users can't tell severity at a glance.

**Fix:** Use distinct visual weight:
- CRITICAL (SIP > income): Red card with bold warning — "FIRE target unreachable on current income"
- HIGH (SIP > 60% income): Orange card — "High SIP burden"
- MODERATE (combined > income): Yellow card — "Cash flow risk"
- INFO (combined > 90% income): Subtle note, not a card

### D5 — "No SIP needed" state needs celebration (LOW)

If `requiredMonthlySIP === 0` (user's existing assets are enough), the tile says "No SIP needed"
in the same visual style as the SIP amount. This is a win — treat it as one. Show a "🏆 You're
already FIRE!" or similar positive state.

### D6 — Year-by-year table: hide empty Vesting column (LOW)

If the user has no ESOP/RSU assets, the Vesting column is always "—". Compute whether any row
has a non-zero vesting value; if not, omit the column. Reduces visual noise for 80% of users.

---

## SECTION 5 — Assets Screen

### A1 — Per-asset ROI slider has no projection effect (MEDIUM)

**Current:** Each asset has an "Expected Annual ROI" slider (0–30%) with helper text: "For reference
only. Projections use the blended return rate set on the Dashboard."

**Problem:** Asking users to enter per-asset ROI when it's not used creates effort with no value.
It also implies the app is more sophisticated than it is, raising expectations.

**Options:**
- Remove the ROI slider from the asset form entirely, keep only the dashboard blended rate.
- OR use per-asset ROI in the projection (weighted-average blended rate auto-computed from portfolio
  mix instead of user-set dashboard sliders). This is more accurate but a significant engine change.

**Recommended:** Remove the per-asset ROI slider for now. If the model evolves to per-asset returns,
re-add it then. The "For reference only" notice is a smell — if it's only for reference, don't ask.

### A2 — Gold/Silver grams input is incomplete (LOW)

**Current:** User can enter gold in "GRAMS" mode but no price-per-gram is provided, so the current
value must still be entered manually. The gram quantity is stored in `gold_silver_quantity` but
never used in projections.

**Fix:** Either remove the GRAMS mode (it's cosmetic only) or add a live gold price fetch (requires
network). Simplest: remove GRAMS mode, store value only. The gram quantity field creates an illusion
of functionality that doesn't exist.

### A3 — Self-use real estate toggle is unclear (LOW)

**Current:** A button that toggles its label between "Self-Use Property (excluded from FIRE)" and
"Investment Property". The visual is confusing — the button changes text but looks the same.

**Fix:** Use a proper toggle/switch with both states always visible:
```
Self-Use Property (home, car)    [ ON / OFF ]
Excluded from FIRE calculation
```

---

## SECTION 6 — Expenses Screen

### E1 — Red banner color signals danger (MEDIUM)

**Current:** The PV banner at the top is `backgroundColor: '#B71C1C'` (deep red). Red in finance
UX universally means "loss" or "danger." But this banner is informational — it shows the PV of
expenses the user's salary will cover.

**Fix:** Use a neutral or muted purple/indigo, or a dark blue. Reserve red for over-budget states.
The copy can stay the same; just change the color to remove the alarm response.

### E2 — Expense type labels are too technical (MEDIUM)

**Current radio labels (from `constants/categories.ts` EXPENSE_TYPES):**
- `CURRENT_RECURRING` → "Current Recurring"
- `FUTURE_ONE_TIME` → "Future One-Time"
- `FUTURE_RECURRING` → "Future Recurring"

Technically accurate, but users who don't understand FIRE terminology will find these confusing.

**Proposed plain labels:**
- "Regular Expense" (happens now, stops at retirement) — with note: "Salary covers this"
- "Future One-Time Cost" (buy a house, wedding, car) — with note: "Planned lump sum"
- "Future Recurring Cost" (child's college, travel fund) — with note: "Planned regular spend"

Keep the db keys as-is. Only the display labels change.

### E3 — Keyboard avoidance is fragile (LOW)

**Current:** Manual `keyboardOffset` calculation with `transform: [{ translateY: -Math.min(keyboardOffset * 0.32, 180) }]`
**Fix:** Use `KeyboardAvoidingView` properly around the modal content with `behavior="padding"` for
Android. The 0.32 magic number will break on tablets and different screen densities.

---

## SECTION 7 — Profile Screen

### P1 — No edit profile functionality (HIGH)

**Current:** Profile screen shows name, income, biometric toggle, switch profile, delete profile.
There is no way to edit name, date of birth, income, or PIN after creation.

Income in particular changes frequently (raises, job changes). DOB rarely, but errors happen.
PIN change is a basic security feature.

**Fix:** Add an "Edit Profile" row that navigates to a pre-filled edit form (reuse create-profile
form with modifications). At minimum: income edit and PIN change. DOB edit is lower priority.

### P2 — Income display is truncated oddly (LOW)

**Current:** `((currentProfile.monthly_income ?? 0) / 1000).toFixed(0)}K` — shows ₹150K as "150K"
but ₹85,000 as "85K". For INR users, this should use the L/K formatting from formatCurrency.
Minor, but inconsistent with the rest of the app.

---

## SECTION 8 — Onboarding & Login

### O1 — No primer on the pension/withdrawal concept (MEDIUM)

**Current:** Onboarding collects name, DOB, income, currency, PIN. Users then land in Assets.
When they eventually reach Goals, the "Monthly Retirement Withdrawal" field is conceptually
unfamiliar — "how much do I want to withdraw from my corpus?"

**Fix:** Add one onboarding step after profile creation (or a tooltip on first Goals visit)
that explains: "FinPath helps you build a corpus — a pool of investments — that you'll live off
in retirement. The key number is how much you want to withdraw from it each month."

This is a single educational moment that prevents the #1 model misunderstanding.

### O2 — Biometric auto-trigger on profile selection can surprise users (LOW)

**Current:** Selecting a profile auto-triggers biometric auth (fingerprint prompt appears immediately).
If the user accidentally taps the wrong profile, they get a fingerprint prompt for a profile they
didn't intend. The prompt cancels OK, but it's jarring.

**Fix:** Auto-trigger biometric only if there's exactly one profile (unambiguous intent). With
multiple profiles, require the user to also tap a "Login with fingerprint" button after selecting.

---

## SECTION 9 — Missing Features (Priority-Ordered)

### F1 — Edit profile (income, PIN) — HIGH
See P1 above. Income accuracy directly affects SIP burden warnings and on-track status.

### F2 — "What-if" plan comparison — MEDIUM
Users often want to compare: "If I retire at 55 vs 60, what's the difference?" Currently each
goal save overwrites the previous. 
**Design:** "Scenarios" tab (replaces Goals tab) with 2-3 named scenarios side by side, each with
their own retirement_age, SWR, pension_amount. The primary scenario drives the dashboard.

### F3 — Current position marker on chart — MEDIUM
See D3. Already documented as a chart improvement, but worth calling out as a standalone feature.
Users track their progress against the projection — the "You Are Here" dot makes the app feel like
a live tracker, not a one-time calculator.

### F4 — Income growth modeling — LOW
**Current:** Income is static throughout the projection. A 30-year-old's income doesn't stay flat
for 30 years.
**Model addition:** Add an "Income Growth Rate" field (default 8%) to goals. Use it to model
SIP step-up potential — if income grows 8%/year, the user can afford higher SIP over time. This
is separate from the manual step-up rate.
This feature significantly improves projection accuracy for salaried users but adds complexity.
Leave for v2.

### F5 — Net worth history tracking — LOW
**Design:** Store a snapshot of total net worth and investable net worth at the end of each month
(triggered on app open if the last snapshot is from a prior month). Show an "Actual vs Projected"
overlay on the chart. This turns FinPath from a calculator into a tracker.
High development cost, high engagement value. v2.

---

## SECTION 10 — Implementation Order

Work in this sequence to maximize user-visible impact with minimum risk:

| Phase | Items | Impact | Risk |
|---|---|---|---|
| **Phase 1 — Fix** | M2 (dashboard label), G1 (remove goals tile), G2 (pension rename), G3 (remove save alert) | Eliminates confusion, builds trust | Low — mostly label/text changes |
| **Phase 2 — Simplify** | D1 (retirement tile redesign), D2 (slider collapse), G4 (CTA rename), M3/M5 (inflation consistency) | Cleaner UI, correct math | Low–Medium |
| **Phase 3 — Restructure** | IA1 (tab reorder), IA3 (empty state CTA), D3 (chart improvements), E1 (PV banner color) | Better first-run experience | Medium — tab order change needs flow testing |
| **Phase 4 — Polish** | A1 (remove ROI slider), A2 (gold grams), E2 (expense type labels), E3 (keyboard), D4 (warning hierarchy), D6 (vesting column) | Reduced noise, better UX details | Low |
| **Phase 5 — Features** | P1 (edit profile), O1 (onboarding primer), M4 (slider label fix) | Fills critical gaps | Medium |
| **Phase 6 — New** | F2 (scenarios), F3 (chart position marker), F4 (income growth) | Differentiation | High |

---

## One-Number Principle (Design North Star)

Every mature finance app is anchored on **one number** the user remembers and comes back for.
- Mint: your net worth
- YNAB: your budget remaining this month
- Groww: your portfolio returns today
- NPS: your projected pension amount

FinPath's one number should be: **"You need ₹X/month to retire at age Y."**

Every screen should support that number. The dashboard leads with it (Monthly SIP Required — good).
The goals screen sizes it. The assets and expenses screens feed it. The chart shows the journey.

When a user doesn't know the answer to "what does FinPath tell me I need to invest?", the app
has failed. Right now, that number is clear on the dashboard but confused by the mislabeled FIRE
Corpus tile below it. Fix that confusion first.

---

*Update this file after each phase is implemented. Log completed items with date under each section.*
