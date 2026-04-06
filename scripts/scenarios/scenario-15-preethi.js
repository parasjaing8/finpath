/**
 * Scenario 15: Preethi — 45-yr-old IIT Professor, Madurai
 * ========================================================
 * Age: 45 | Salary: ₹1,80,000/month (7th Pay Commission + Grade Pay) | Married, 2 kids (20, 17)
 *
 * PROFILE: Associate Professor at NIT Madurai. Husband is a doctor at a
 * government hospital (not modelled). UGC pension (defined benefit) at
 * retirement. Kids are in late teens — no more school fees. One in college
 * now. Almost debt-free. Good EPF + NPS accumulation. Wife's philosophy:
 * "let the pension do the work." Plans modest retirement.
 *
 * EDGE CASES TESTED:
 * - Oldest user (45) with shortest accumulation window
 * - Large pension target (₹55K/month UGC pension) — tests large withdrawal corpus
 * - Kids are mostly grown: one in college now, one in 2 years
 * - No major future expenses except kid weddings
 * - Conservative equity allocation (mostly govt bonds/NPS/EPF)
 * - Retire at 62 (NIT mandatory retirement)
 * - SIP just ₹20K (most savings already in govt instruments)
 * - Fat FIRE — wants the security
 *
 * LIFE TIMELINE:
 * Age 45 (2026) - Current: both kids in late teens
 * Age 45 (2026) - Kid 1 in college (2nd year eng), ends 2028
 * Age 47 (2028) - Kid 2 starts college
 * Age 48 (2029) - Kid 1 starts job, expenses stop
 * Age 51 (2032) - Kid 2 college done
 * Age 52 (2033) - Kid 1 wedding
 * Age 54 (2035) - Kid 2 wedding
 * Age 62 (2043) - Mandatory NIT retirement + UGC pension starts
 */

const profile = {
  id: 15, name: 'Preethi', dob: '1981-01-15',
  monthly_income: 180000, currency: 'INR',
};

const assets = [
  { id: 1, category: 'PF', name: 'GPF + EPF',
    current_value: 5000000, expected_roi: 7.5, is_self_use: 0 },
  { id: 2, category: 'PF', name: 'NPS (40% equity)',
    current_value: 2500000, expected_roi: 10, is_self_use: 0 },
  { id: 3, category: 'MUTUAL_FUND', name: 'Debt + Conservative Hybrid',
    current_value: 800000, expected_roi: 9, is_self_use: 0 },
  { id: 4, category: 'SAVINGS', name: 'FD + Bank Savings',
    current_value: 600000, expected_roi: 6.5, is_self_use: 0 },
  { id: 5, category: 'REAL_ESTATE', name: 'Self-Use Flat Madurai',
    current_value: 5000000, expected_roi: 6, is_self_use: 1 },
  { id: 6, category: 'GOLD', name: 'Gold (family)',
    current_value: 400000, expected_roi: 10, is_self_use: 0 },
];

const expenses = [
  // ── CURRENT RECURRING ──
  { id: 1, name: 'Groceries + Household', category: 'GROCERIES', amount: 14000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  { id: 2, name: 'Transport (car)', category: 'TRANSPORT', amount: 6000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 3, name: 'Utilities + Internet', category: 'OTHERS', amount: 4500,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 4, name: 'Personal + Clothing', category: 'OTHERS', amount: 5000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 5, name: 'Term + Health Insurance', category: 'INSURANCE', amount: 60000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 7 },

  // ── CURRENT RECURRING (time-bound) ──
  // Kid 1 currently in college (running)
  { id: 6, name: 'Kid 1 College Fees (ongoing)', category: 'EDUCATION', amount: 250000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: '2028-05-31', inflation_rate: 10 },

  // ── FUTURE RECURRING ──
  // Kid 2 college 2028-2032
  { id: 7, name: 'Kid 2 College', category: 'EDUCATION', amount: 250000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2028-06-01', end_date: '2032-05-31', inflation_rate: 10 },

  // ── FUTURE ONE-TIME ──
  { id: 8, name: 'Kid 1 Wedding', category: 'EVENTS', amount: 700000,
    expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2033-02-01', end_date: null, inflation_rate: 7 },
  { id: 9, name: 'Kid 2 Wedding', category: 'EVENTS', amount: 700000,
    expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2035-02-01', end_date: null, inflation_rate: 7 },
];

const goals = {
  retirement_age: 62, sip_stop_age: 60,
  pension_income: 55000,  // UGC/NIT defined benefit pension
  fire_type: 'moderate', fire_target_age: 100, withdrawal_rate: 5,
};

module.exports = {
  name: 'Preethi — NIT Professor, Madurai (Age 45)',
  description: 'NIT professor, ₹1.8L salary, UGC pension ₹55K, large EPF/NPS, kids almost done, mandatory retire at 62, fat FIRE.',
  profile, assets, expenses, goals,
  sipAmount: 20000,
  sipReturnRate: 9.5,
  postSipReturnRate: 7.5,
  stepUpRate: 3,
};
