# FinPath Financial Model

> Ground truth for all financial calculations. Update this when assumptions change.
> Last updated: 2026-04-08

---

## Core Philosophy

FinPath helps salaried users achieve **FIRE** (Financial Independence, Retire Early).
The model has two phases: **pre-retirement** (accumulation) and **post-retirement** (withdrawal).
All calculations are local, offline, and per-profile.

---

## Expense Classification

| Type | Funded By | Stops At | Example |
|---|---|---|---|
| `CURRENT_RECURRING` | Salary | Retirement age | Rent, groceries, EMIs, lifestyle |
| `FUTURE_ONE_TIME` | Salary if pre-retirement; **Corpus** if post-retirement | n/a (specific date) | House purchase, car, wedding |
| `FUTURE_RECURRING` | Salary if pre-retirement; **Corpus** if post-retirement | User-set end date | Kid's college fees, travel fund |

**Key rule:** `CURRENT_RECURRING` expenses are salary-funded and do NOT touch the corpus.
FUTURE expenses that fall after retirement are corpus-funded and directly impact the FIRE target.

**Default end date:** When creating a new `CURRENT_RECURRING` expense, the end date defaults to
the user's retirement year (Dec 31). This reflects the reality that lifestyle expenses stop at retirement.

---

## Pension — What It Is and Is Not

**Pension = systematic monthly withdrawal from the user's own invested corpus.**

- It is NOT external income (govt pension, rental income, dividends).
- It is the monthly amount the user wants to live on post-retirement, drawn from corpus.
- It inflates at `PENSION_INFLATION_RATE` (6%) each year post-retirement.
- Most salaried employees have no external pension — they build their own corpus and withdraw from it.

---

## FIRE Corpus Formula (Display Reference)

```
FIRE Corpus = Pension Corpus + Post-Retirement Future Expenses PV

Pension Corpus          = (pension_monthly × 12 × inflation_factor) / SWR
Post-Retirement Exp PV  = PV of all FUTURE expenses falling at or after retirement age
```

Shown as the **At Retirement** tile and orange reference line on the chart.
NOT used as the required SIP target (see below).

## Required SIP — Full Lifecycle Target

Required SIP targets corpus survival to `fire_target_age` (default 100), not FIRE corpus at retirement.

The binary search runs the complete pre + post retirement simulation:
- Pre-retirement: accumulate via SIP + returns + vesting
- Post-retirement: deduct pension withdrawals + future expense dips each year

Binary search finds the SIP where corpus at `fire_target_age` = 0.

**Why not target FIRE corpus at retirement:**
With pension growing at 6%/year and 10% post-retirement return, a corpus sized at pension/5% SWR
depletes by age 80-90. The age-100 target forces the SIP to account for the full retirement journey.

---

## Safe Withdrawal Rate (SWR)

| FIRE Type | SWR | Corpus Size | Risk |
|---|---|---|---|
| Fat FIRE | 3% | Largest | Very safe |
| Moderate FIRE | 5% | Medium | Balanced |
| Slim FIRE | 7% | Smallest | Higher risk |
| Custom | User-set | Variable | User's choice |

---

## Year-by-Year Projection Logic

### Pre-retirement (age < retirement_age)
```
net_worth += returns(sipReturnRate) + annual_SIP + vesting_income
```
- Expenses do NOT reduce corpus (salary covers them).
- `CURRENT_RECURRING` and pre-retirement `FUTURE` expenses shown for planning, not deducted.
- SIP step-up applied annually at `stepUpRate`.

### Post-retirement (age >= retirement_age)
```
net_worth += returns(postSipReturnRate)
net_worth -= pension_withdrawal(inflation-adjusted)
net_worth -= future_expenses_in_this_year (one-time dips: house, college, etc.)
```
- Corpus keeps compounding on returns.
- `CURRENT_RECURRING` expenses are gone (lifestyle changed at retirement).
- Only `FUTURE` expenses still active post-retirement are deducted.

### FIRE achieved when:
```
net_worth >= FIRE corpus
```

---

## Expense Banner (Expenses Screen)

**Row 1 — Pre-Retirement Expenses (Today's Value)**
= PV of all expenses the salary must cover before retirement.
= `CURRENT_RECURRING` + `FUTURE` expenses with dates before retirement age, discounted to today.

**Row 2 — Post-Retirement Planned Spends** (shown only if > 0)
= PV of `FUTURE` expenses falling at or after retirement age.
= These are already baked into the FIRE corpus target.

---

## SIP Burden Warning

The dashboard warns the user when:
1. Required SIP > monthly income (FIRE not achievable)
2. Required SIP > 60% of income (very high burden)
3. Required SIP + current monthly expenses > income (cash-flow crunch)
4. Required SIP + current expenses > 90% of income (thin buffer)

---

## Key Constants

| Constant | Value | Purpose |
|---|---|---|
| `PENSION_INFLATION_RATE` | 6% | Annual inflation applied to pension withdrawals |
| `DEFAULT_DISCOUNT_RATE` | 6% | Discount rate for PV calculations |
| `FIRE_WITHDRAWAL_RATES` | fat=3%, moderate=5%, slim=7% | SWR by FIRE type |

---

## What the Model Does NOT Do

- Does not model tax on withdrawals or SIP returns
- Does not model employer PF/EPF contributions separately
- Does not handle currency conversion between profiles
- Does not model sequence-of-returns risk (fixed return rates assumed)
- Does not model healthcare inflation separately post-retirement
