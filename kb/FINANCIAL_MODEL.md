# FinPath Financial Model

> Ground truth for all financial calculations. Update this when assumptions change.
> Last updated: 2026-04-11

---

## Core Philosophy

FinPath helps salaried users achieve financial independence (retire early).
The model has two phases: **pre-retirement** (accumulation) and **post-retirement** (withdrawal).
All calculations are local, offline, and per-profile.

---

## Expense Classification

| Type | Funded By | Stops At | Example |
|---|---|---|---|
| `CURRENT_RECURRING` | Salary | Retirement age | Rent, groceries, EMIs, lifestyle |
| `FUTURE_ONE_TIME` | Salary if pre-retirement; **Corpus** if post-retirement | Specific date | House purchase, car, wedding |
| `FUTURE_RECURRING` | Salary if pre-retirement; **Corpus** if post-retirement | User-set end date | College fees, travel fund |

**Key rule:** `CURRENT_RECURRING` expenses are salary-funded and do NOT touch the corpus.
FUTURE expenses that fall after retirement are corpus-funded and directly impact the FIRE target.

**Default end date:** New `CURRENT_RECURRING` expenses default end date to the user's retirement year (Dec 31).

---

## Pension -- What It Is and Is Not

**Pension = systematic monthly withdrawal from the user's own invested corpus.**

- NOT external income (govt pension, rental income, dividends).
- The monthly amount the user wants to live on post-retirement, drawn from corpus.
- Inflates at `PENSION_INFLATION_RATE` (6%) each year post-retirement.
- Label in UI: "Monthly Retirement Withdrawal".

---

## FIRE Corpus Formula

```
FIRE Corpus = Pension Corpus + Post-Retirement Future Expenses PV

Pension Corpus          = (pension_monthly x 12 x inflation_factor) / SWR
Post-Retirement Exp PV  = PV of all FUTURE expenses falling at or after retirement age
```

Shown as the corpus target on the Dashboard. NOT used as the required SIP target (see below).

## Required SIP -- Full Lifecycle Target

Required SIP targets corpus survival to `fire_target_age` (default 100), not FIRE corpus at retirement.

Binary search runs the complete pre + post retirement simulation:
- Pre-retirement: accumulate via SIP + returns + vesting
- Post-retirement: deduct pension withdrawals + future expense dips each year

Binary search finds the SIP where corpus at `fire_target_age` = 0.

---

## Safe Withdrawal Rate (SWR)

| FIRE Type | SWR | Corpus Size | Risk |
|---|---|---|---|
| Fat | 3% | Largest | Very safe |
| Moderate | 5% | Medium | Balanced |
| Slim | 7% | Smallest | Higher risk |
| Custom | User-set | Variable | User's choice |

---

## Year-by-Year Projection Logic

### Pre-retirement (age < retirement_age)
```
net_worth += returns(sipReturnRate) + annual_SIP + vesting_income
```
- Expenses do NOT reduce corpus (salary covers them).
- SIP step-up applied annually at `stepUpRate`.

### Post-retirement (age >= retirement_age)
```
net_worth += returns(postSipReturnRate)
net_worth -= pension_withdrawal(inflation-adjusted)
net_worth -= future_expenses_in_this_year
```
- Only FUTURE expenses still active post-retirement are deducted.

### FIRE achieved when:
```
net_worth >= FIRE corpus
```

---

## Expense Banner (Expenses Screen)

**Row 1 -- Pre-Retirement Expenses (Today's Value)**
= PV of all expenses salary must cover before retirement, discounted using goals.inflation_rate.

**Row 2 -- Post-Retirement Planned Spends** (shown only if > 0)
= PV of FUTURE expenses falling at or after retirement age.

---

## SIP Burden Warning

4 severity levels based on SIP-to-income ratio:
1. CRITICAL: Required SIP > monthly income
2. HIGH: Required SIP > 60% of income
3. MODERATE: Required SIP + current monthly expenses > income
4. INFO: Required SIP + current expenses > 90% of income

---

## Key Constants

| Constant | Value | Purpose |
|---|---|---|
| `PENSION_INFLATION_RATE` | 6% | Annual inflation on pension withdrawals (hardcoded) |
| `DEFAULT_DISCOUNT_RATE` | 6% | Default discount rate for PV calculations |
| `FIRE_WITHDRAWAL_RATES` | fat=3%, moderate=5%, slim=7% | SWR by FIRE type |

---

## What the Model Does NOT Do

- Does not model tax on withdrawals or SIP returns
- Does not model employer PF/EPF contributions separately
- Does not handle currency conversion between profiles
- Does not model sequence-of-returns risk (fixed return rates assumed)
- Does not model healthcare inflation separately post-retirement

---

## Two-Bucket Growth Model

Assets and SIP contributions grow in separate buckets at different rates.

### Buckets

| Bucket | What it tracks | Growth rate |
|---|---|---|
| `existingBucket` | Current investable assets (from SQLite) | Weighted blended rate from `expected_roi` per asset |
| `sipBucket` | New SIP contributions accumulating | `sipReturnRate` (user-set, typically 12%) |

At retirement: both buckets merge. Post-retirement, combined corpus grows at `postSipReturnRate`.

### Blended Rate Computation (`computeBlendedGrowthRate`)
```
blendedRate = sum(asset.currentValue * assetRate) / sum(asset.currentValue)
```
- Self-use real estate excluded (not investable).
- If `asset.expected_roi == 0`, uses `DEFAULT_GROWTH_RATES[category]` as fallback.
- If no investable assets, falls back to `sipReturnRate`.

### Default Growth Rates
| Category | Default Rate |
|---|---|
| ESOP_RSU, STOCKS, MUTUAL_FUND | 12% |
| SAVINGS | 7% |
| GOLD_SILVER, PF | 8% |
| NPS | 10% |
| REAL_ESTATE | 9% |
| OTHERS | 8% |

### Phase Transitions
- **Pre-retirement, before sipStopAge**: existingBucket at blended rate; sipBucket at sipReturnRate.
- **Pre-retirement, after sipStopAge**: Both buckets at postSipReturnRate (coast mode).
- **At retirement**: Buckets merge. If sipStopAge == retirementAge, last SIP added BEFORE merge.
- **Post-retirement**: Combined corpus at postSipReturnRate, minus pension + future expense withdrawals.

### Known Limitation
`expected_roi == 0` is ambiguous: "unset" OR "explicitly 0%". Both use category default. Per-asset ROI slider was removed from the UI, so users cannot set per-asset ROI -- the blended rate is computed entirely from DEFAULT_GROWTH_RATES based on category mix.
