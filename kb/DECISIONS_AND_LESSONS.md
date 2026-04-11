# FinPath — Decisions, Edge Cases & Lessons Learned

> Running log of non-obvious decisions, bugs fixed, and edge cases handled.
> Add an entry whenever a meaningful change is made. Date each entry.
> This prevents re-litigating solved problems or re-introducing fixed bugs.

---

## 2026-04-06 — Pension model clarification

**Decision:** Pension is a systematic corpus withdrawal, not external income.

**Context:** Early implementation incorrectly treated pension as income that *reduces*
the corpus needed (subtracting it from expenses). This was wrong.

**Correct model:**
- Pension = monthly amount the user withdraws from their own corpus post-retirement.
- FIRE corpus = pension/SWR. The corpus must be large enough so that withdrawing pension
  every month (inflation-adjusted) does not deplete it.
- There is no "external pension" concept in FinPath. Users are salaried employees
  who build their own corpus.

**What was fixed:** `calculateFireCorpus` now takes only `(pension, yearsToRetirement, SWR, postRetirementExpPV)`.
Expenses were removed from the corpus formula entirely.

---

## 2026-04-06 — Expense funding source by type

**Decision:** Not all expenses are pre-retirement. Future expenses can be corpus-funded.

**Context:** A user retiring at 50 may still have a child in college until 55,
or want to buy a house at age 55. These are FUTURE_ONE_TIME or FUTURE_RECURRING
expenses that fall after the retirement age.

**Rules established:**
- `CURRENT_RECURRING` → always salary-funded, always stop at retirement age.
- `FUTURE_ONE_TIME` / `FUTURE_RECURRING` → salary-funded if before retirement,
  corpus-funded if at or after retirement.

**Impact on FIRE corpus:**
```
FIRE corpus = pension/SWR + PV(post-retirement FUTURE expenses)
```
Post-retirement future expenses are discounted back to today and added to the corpus target.

**Impact on year projections:**
Post-retirement net worth is reduced by both pension AND any FUTURE expenses in that year.
The chart shows natural dips (e.g. house purchase) with corpus resuming growth after.

---

## 2026-04-06 — Default end date for CURRENT_RECURRING expenses

**Decision:** When creating a new `CURRENT_RECURRING` expense, the end date field
pre-fills to the user's retirement year (Dec 31, birthYear + retirementAge).

**Why:** These expenses stop at retirement. If the user leaves no end date, the old
model would count them forever, inflating the pre-retirement PV figure.

**Implementation:** `expenses.tsx openForm()` computes retirement year from `goals.retirement_age ?? 60`
and the profile's DOB. User can always change it.

---

## 2026-04-06 — Pension corpus inflation rate vs expense inflation rate

**Decision:** Pension withdrawals inflate at `PENSION_INFLATION_RATE` (6% fixed),
separate from the user-configurable `inflation_rate` on goals.

**Why:** The user-set inflation rate is for post-retirement lifestyle inflation
(used as discount rate for PV). Pension inflation is a separate constant
representing how purchasing power requirements grow year-over-year.

**Do not merge these two rates.** They serve different purposes.

---

## 2026-04-06 — Screenshot blocking

**Decision:** `FLAG_SECURE` added to `MainActivity.kt` — applies to entire app.

**Why:** FinPath contains highly sensitive financial data. Screenshot protection
must be unconditional, not opt-in per screen. Also prevents content appearing
in Android's recent apps switcher.

**Side effect:** Users cannot take screenshots of the app at all (by design).

---

## 2026-04-06 — Biometric login is per-profile, opt-in

**Decision:** Each profile independently stores a biometric opt-in flag in SecureStore.

**Key behaviours:**
- Biometric auto-triggers on profile select (if enrolled + enabled).
- Biometric is NOT triggered if the profile is in lockout.
- Toggle available both during profile creation and in Dashboard settings.
- Flag is cleared when profile is deleted.
- Biometric availability checked via `LocalAuthentication.hasHardwareAsync()` +
  `isEnrolledAsync()` — toggle hidden if device has no enrolled fingerprints.

---

## 2026-04-06 — SIP stop age must use local variable, not state

**Bug fixed:** `setSipStopAge(retirementAge)` is async — the state doesn't update
before the next line reads `sipStopAge`. Using `Math.min(sipStopAge, retirementAge)`
in the save call worked by coincidence but the UI showed stale state.

**Fix:** Compute `correctedSipStopAge = Math.min(sipStopAge, retirementAge)` as a
local variable, use it in both `setSipStopAge()` and `saveGoals()`.

**General lesson:** Never read state immediately after setting it in the same synchronous
block. Compute derived values as local variables.

---

## 2026-04-06 — Date parsing must use local time, not UTC

**Bug fixed:** `new Date("2000-01-01T00:00:00")` is parsed as UTC by JavaScript.
In UTC+5:30 (India) this is fine, but any UTC or UTC- timezone shows the previous day
in the date picker.

**Fix in `DateInput.tsx`:**
```typescript
const [year, month, day] = value.split('-').map(Number);
return new Date(year, month - 1, day); // local time
```

**General lesson:** Always construct dates with `new Date(y, m, d)` for local time.
Only use string parsing (`new Date(string)`) when you explicitly want UTC.

---

## 2026-04-06 — console.error in production leaks info

**Fix:** All `console.error` calls are now gated behind `if (__DEV__)`.
In production, errors are captured by Sentry (if DSN configured) or silently caught.

---

## 2026-04-06 — Operator precedence in discount rate (fragile)

**Was:** `(goals.inflation_rate ?? DEFAULT_DISCOUNT_RATE * 100) / 100`
This worked by accident because `*` binds tighter than `??`.

**Fixed to:** `(goals.inflation_rate ?? (DEFAULT_DISCOUNT_RATE * 100)) / 100`

**General lesson:** Always add explicit parentheses around `??` fallback expressions
when the fallback contains arithmetic.

---

## Build Process Notes

- Keystore: `android/app/finpath-release.keystore`
- Keystore props: `android/app/keystore.properties` (not committed — regenerate if missing)
- Build command (run on Mac Mini):
  ```bash
  export JAVA_HOME=/opt/homebrew/opt/openjdk@17
  export ANDROID_HOME=$HOME/Library/Android/sdk
  export PATH=/opt/homebrew/bin:$JAVA_HOME/bin:$PATH
  cd /Users/parasjain/finpath/android
  ./gradlew assembleRelease
  ```
- Output: `android/app/build/outputs/apk/release/app-release.apk`
- Copy to releases: `releases/FinPath-v{version}-build{n}.apk`

---

## 2026-04-08/09 — Two-Bucket Growth Model + Bug Fix + UX Changes

### Decision: Per-Asset Growth Rates via Two-Bucket Model

**Context:** Previously all assets grew at the uniform `sipReturnRate`. User wanted ESOP/stocks/PF to grow at different rates.

**Architecture:**
- `existingBucket`: current investable assets, grows at `computeBlendedGrowthRate()` (weighted avg of per-asset `expected_roi`)
- `sipBucket`: new SIP contributions, grows at `sipReturnRate`
- At retirement: merge into `existingBucket`, then grow at `postSipReturnRate`
- `expected_roi` stored in SQLite `assets` table as integer %; 0 = unset (uses `DEFAULT_GROWTH_RATES`)
- Self-use real estate excluded from blended rate (not investable)

**Why weighted blended:** Per-asset post-retirement tracking would require storing full asset history. Blended rate is a practical simplification that still correctly weights growth by asset size.

**Consistency requirement:** `calculateProjections` and `simulateCorpusAtAge` must use identical logic, or the binary-search SIP sizing will be wrong. Verified by T20.

---

### Bug Fixed: sipStopAge == retirementAge Drops Last SIP

**Bug:** When SIP stop age equals retirement age (the default), the last annual SIP was silently dropped.

**Root cause:** Merge block ran `existingBucket += sipBucket; sipBucket = 0` before the final `annualSIP` could be added.

**Fix:** Added `if (age <= sipStopAge) existingBucket += annualSIP` before the merge in BOTH `calculateProjections` and `simulateCorpusAtAge`.

**Impact:** For 50k/mo SIP, 6,42,000 was being lost (would compound to ~96L by age 100 at 7%).

**Lesson:** Any time sipStop and retirement coincide (the common case), verify the merge boundary handles the final period correctly. Always keep both projection functions in sync.

---

### UX Changes (session 2026-04-08)

1. Asset form: growth rate slider (0–25%, defaults to category default); stored as `expected_roi`
2. Login: auto-selects single profile; redirects to Assets tab (not Dashboard)
3. Profile edit: DOB is now editable via DateInput
4. Profile screen: removed "Switch Profile" (single-profile UX)
5. Biometric: enabled by default on profile creation
6. Expenses: total tile is now red (#B71C1C)
7. Goals: removed FIRE terminology, removed expense discount rate section, removed "grows at 6%/yr" info text
8. Dashboard: "FIRE" replaced with "Corpus"/"Financial Freedom"; chart simplified to net worth + expenses + corpus target line + vertical marker


---

## 2026-04-11 — Monetization: moved from 2-app to single-app + IAP

**Decision:** Single app on Play Store. One non-consumable IAP (`finpath_pro`, Rs.199/$4.99) gates only CSV export. All other features free including unlimited profiles.

**Old strategy:** Two separate Play Store listings — FinPath (free) + FinPath Pro (paid).
**New strategy:** One listing, IAP for CSV export only.

**Why changed:** Simpler discovery, lower friction, users do not need to find a second app. CSV export is a power-user feature that justifies a one-time purchase without blocking core value.

**Stale code to fix:** login.tsx and create-profile.tsx still gate adding a second profile behind `isPro`. Must be removed — profiles are now free. Also ProPaywall.tsx lists "Unlimited profiles" as a Pro feature — needs updating.

---

## 2026-04-11 — ProPaywall feature list is stale

**Issue:** `components/ProPaywall.tsx` FEATURES array lists "Unlimited profiles" and "CSV export" as Pro features. Under the new single-app strategy only CSV export is Pro.

**Fix needed:** Remove "Unlimited profiles" from FEATURES. Update headline text. Remove isPro gate from login.tsx (line 260) and create-profile.tsx (lines 58-60).

---

## 2026-04-09/10 — Full UX overhaul (r7-r13 sessions)

Summarised from git log — individual decisions not logged at the time.

- CorpusPrimer: first-time onboarding dialog (Goals screen) + inline lightbulb hint. Shown once per profile via SecureStore flags.
- Dashboard redesign: summary tiles simplified to corpus-needed + corpus-at-100. Today vs Projections two-column layout.
- SIP burden warning: 4 severity levels (CRITICAL/HIGH/MODERATE/INFO) based on SIP-to-income ratio.
- Collapsible Advanced section: SIP return rate, post-SIP return rate, step-up rate hidden by default.
- Chart: post-retirement shows withdrawal line only (not pre-retirement expenses which are salary-funded).
- Goals screen: FIRE type chips (Slim/Moderate/Fat/Custom) replace dropdown. "Monthly Retirement Withdrawal" replaces "Pension Income". Save navigates directly to Dashboard.
- Assets: per-asset ROI slider removed from form — DEFAULT_GROWTH_RATES used, user cannot override per-asset (simplification).
- Expenses: neutral blue-grey accent. Plain-language type labels with contextual hints.
- Tab reorder: Assets first (tried Dashboard-first, reverted).
- Logout: moved from Dashboard header to Profile screen (r13).
- SIP engine: switched to FV annuity formula; current year prorated to remaining months.
