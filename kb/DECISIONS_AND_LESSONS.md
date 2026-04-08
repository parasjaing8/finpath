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
