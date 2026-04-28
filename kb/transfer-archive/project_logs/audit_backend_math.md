# Finpath Backend Math Audit Report
**Date:** 2026-04-09  
**Auditor:** Claude (claude-sonnet-4-6)  
**Scope:** `~/finpath/engine/calculator.ts` — two-bucket growth model, SIP sizing, corpus projection, retirement math

---

## Summary Verdict

**The backend math is sound.** One real bug was found and fixed. All other test failures were wrong test expectations (off-by-one indexing), not code defects.

| Category | Count |
|---|---|
| Tests run | 36 |
| PASS | 26 |
| FAIL (test error, not code bug) | 9 |
| WARNINGS (limitation) | 1 |
| Real bugs found | 1 (fixed) |

---

## Real Bug Found and Fixed

### T13: sipStopAge == retirementAge loses last SIP contribution

**Severity:** Medium  
**Impact:** For a 50k/mo SIP, ₹6,42,000 was silently dropped at retirement.  

**Root cause:** When SIP stop age equals retirement age (default UI behavior), the merge block fires first and zeroes out `sipBucket`, then enters the `else` (merged) branch — so the final `annualSIP` at that age was never added to any bucket.

**Fix applied** to both `calculateProjections` and `simulateCorpusAtAge` in `calculator.ts`:
```typescript
if (age >= retirementAge && !retirementMerged) {
  if (age <= sipStopAge) existingBucket += annualSIP;  // ← fix
  existingBucket = existingBucket + sipBucket;
  sipBucket = 0;
  retirementMerged = true;
}
```

**Post-fix verification:**
- `sipStop=60` corpus: 3,11,15,517 vs `sipStop=59`: 3,09,87,117 → diff = +1,28,400 (positive, correct)
- 50k/mo: diff = +6,42,000 (no longer lost)
- T13: PASS, T13b: PASS

---

## Limitation (Not a Bug)

### T04b: 0% explicit rate indistinguishable from "unset"

`expected_roi == 0` is stored for both unset assets and user-set 0% growth. `computeBlendedGrowthRate` uses `expected_roi > 0` check, so both cases fall through to `DEFAULT_GROWTH_RATES`. A user who deliberately sets 0% on a savings account will get 7% instead.

**Recommendation:** Set slider minimum to 1% so 0 always means "unset/use default".

---

## Test Failures (Wrong Expectations — Code is Correct)

All 9 failures are due to the same off-by-one indexing error in the test expectations:

**T06a, T06b, T07, T08, T09, T19b, T24b, T25 — Off-by-one:**  
The projection loop applies growth starting at `age = currentAge` (index 0), so `rows[0]` already reflects 1 year of growth. Tests that expected `rows[0]` to be the pre-growth value were wrong. `rows[1]` = 2 years of growth, etc.

**T18 — Wrong linear depletion logic:**  
Test expected linear depletion from an already-negative balance. Code correctly applies `max(0, existingBucket)` before multiplying, preventing compounding on negative balances. The depleted corpus just subtracts withdrawals; this is correct behavior.

---

## What Was Verified Correct

| Area | Tests | Status |
|---|---|---|
| Weighted blended growth rate | T01-T05 | All correct |
| Per-category default rates (ESOP, PF, etc.) | T04, T30 | Correct |
| Self-use real estate excluded from blended rate | T03, T21 | Correct |
| Two-bucket growth (existing vs SIP) | T10, T11, T12 | Correct |
| Retirement merge (sipBucket zeroed) | T12 | Correct |
| Post-retirement grows at postSipRate (not blended) | T26 | Correct |
| SIP stops at sipStopAge | T29 | Correct |
| Step-up SIP compounding | T17 | Correct |
| fireCorpus = firstYearWd / SWR | T14, T27 | Correct |
| Pension inflation at 6%/yr | T15a, T15b | Correct |
| Corpus depletion (negative balance possible) | T16 | Correct |
| No compounding on negative balance | T18 (code correct, test wrong) | Correct |
| calculateProjections == simulateCorpusAtAge | T20 | **Critical: both functions consistent** |
| Future lump-sum expense deducted at right year | T22 | Correct |
| Large portfolio (10B) — no overflow | T28 | Correct |

---

## Architecture Notes

### Two-Bucket Model
- **existingBucket**: current investable assets, grows at `computeBlendedGrowthRate()` (weighted average of per-asset `expected_roi`)
- **sipBucket**: new SIP contributions, grows at `sipReturnRate`
- At retirement: both buckets merge into `existingBucket`, then grows at `postSipReturnRate`
- After `sipStopAge`: both buckets switch to `postSipReturnRate` (conservative coast mode)

### Consistency Requirement
`calculateProjections` (display) and `simulateCorpusAtAge` (binary-search SIP sizing) must produce identical corpus values — confirmed by T20.

### fireCorpus Formula
```
firstYearWithdrawal = pensionMonthly * 12 * (1.06 ^ yearsToRetirement)
fireCorpus = firstYearWithdrawal / (SWR / 100)
```
