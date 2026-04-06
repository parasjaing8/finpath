/**
 * Scenario 10: Rahul — 38-yr-old Mid-level Govt Officer, Lucknow
 * ===============================================================
 * Age: 38 | Salary: ₹85,000/month | Married, 2 kids (10, 7)
 *
 * PROFILE: Group B central government officer (UPSC selected). Has defined
 * pension (old pension scheme). Disciplined but passive — all savings in PF/PPF/NPS.
 * Very little equity exposure. Joint family home (no rent). Buying a flat for family.
 * Will retire at 60 mandatorily. Government pension will cover basic expenses.
 *
 * EDGE CASES TESTED:
 * - Government pension ₹35K/month (old pension scheme) — tests pension-as-withdrawal
 * - NPS corpus as asset (₹8L)
 * - Mandatory retirement at 60 (not a choice)
 * - Zero step-up (government pay commission happens once in 7 yrs, not modelled)
 * - Conservative returns (9.5% pre-ret, 7% post-ret — mostly debt instruments)
 * - Fat FIRE type but on modest salary
 *
 * LIFE TIMELINE:
 * Age 38 (2026) - Current: joint family home, 2 kids
 * Age 40 (2028) - Buys flat (₹60L, EMI ₹40K x 15 yrs)
 * Age 44 (2032) - Kid 1 starts college
 * Age 47 (2035) - Kid 2 starts college
 * Age 52 (2040) - Kid 1 + 2 college done, EMI ends
 * Age 55 (2043) - Kid weddings estimated
 * Age 60 (2048) - Mandatory retirement + govt pension starts
 */

const profile = {
  id: 10, name: 'Rahul', dob: '1988-03-15',
  monthly_income: 85000, currency: 'INR',
};

const assets = [
  { id: 1, category: 'PF', name: 'GPF + PPF',
    current_value: 1800000, expected_roi: 7.5, is_self_use: 0 },
  { id: 2, category: 'PF', name: 'NPS (Tier 1)',
    current_value: 800000, expected_roi: 9, is_self_use: 0 },
  { id: 3, category: 'SAVINGS', name: 'Post Office + FD',
    current_value: 400000, expected_roi: 6.8, is_self_use: 0 },
  { id: 4, category: 'GOLD', name: 'Gold (family)',
    current_value: 200000, expected_roi: 10, is_self_use: 0 },
];

const expenses = [
  // ── CURRENT RECURRING ──
  { id: 1, name: 'Groceries + Household', category: 'GROCERIES', amount: 12000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  { id: 2, name: 'Transport (car fuel)', category: 'TRANSPORT', amount: 6000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 3, name: 'Utilities + Internet', category: 'OTHERS', amount: 4000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 4, name: 'Kids Monthly (2 kids)', category: 'OTHERS', amount: 10000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: '2047-12-31', inflation_rate: 7 },
  { id: 5, name: 'Health Insurance', category: 'INSURANCE', amount: 20000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 8 },
  { id: 6, name: 'School Fees (2 kids, CBSE)', category: 'EDUCATION', amount: 120000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: '2031-05-31', inflation_rate: 10 },

  // ── FUTURE RECURRING ──
  // Flat EMI age 40-55
  { id: 7, name: 'Flat EMI', category: 'EMI', amount: 40000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2028-07-01', end_date: '2043-06-30', inflation_rate: 0 },
  // Society maintenance
  { id: 8, name: 'Society Maintenance', category: 'RENT', amount: 2500,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2028-07-01', end_date: null, inflation_rate: 5 },
  // Kid 1 college age 44-48
  { id: 9, name: 'Kid 1 College', category: 'EDUCATION', amount: 200000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2032-06-01', end_date: '2036-05-31', inflation_rate: 10 },
  // Kid 2 college age 47-51
  { id: 10, name: 'Kid 2 College', category: 'EDUCATION', amount: 200000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2035-06-01', end_date: '2039-05-31', inflation_rate: 10 },

  // ── FUTURE ONE-TIME ──
  { id: 11, name: 'Kid 1 Wedding', category: 'EVENTS', amount: 600000,
    expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2048-01-01', end_date: null, inflation_rate: 7 },
  { id: 12, name: 'Kid 2 Wedding', category: 'EVENTS', amount: 600000,
    expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2051-01-01', end_date: null, inflation_rate: 7 },
];

const goals = {
  retirement_age: 60, sip_stop_age: 58,
  pension_income: 35000,  // govt pension OPS ₹35K/month
  fire_type: 'fat', fire_target_age: 100, withdrawal_rate: 3,
};

module.exports = {
  name: 'Rahul — Govt Officer, Lucknow (Age 38)',
  description: 'Govt Group B officer, ₹85K salary, OPS pension ₹35K, conservative PF/PPF heavy, fat FIRE, mandatory retire at 60.',
  profile, assets, expenses, goals,
  sipAmount: 8000,
  sipReturnRate: 9.5,
  postSipReturnRate: 7,
  stepUpRate: 0,
};
