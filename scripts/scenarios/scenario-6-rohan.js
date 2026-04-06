/**
 * Scenario 6: Rohan — 20-yr-old CS Student turned SaaS Founder
 * =============================================================
 * Age: 20 | Salary: ₹0 (bootstrapped startup, takes ₹25K stipend) | Single
 *
 * PROFILE: Dropped out of NIT to build a B2B SaaS. Takes minimal salary now.
 * Living with parents in Hyderabad. Expects to hit revenue/funding in 2-3 years.
 * Very aggressive investor mindset. No expenses except personal.
 * Plans to take proper salary at 23, scale to ₹2L+ by 28.
 *
 * EDGE CASES TESTED:
 * - Minimal current income (₹25K stipend as salary for engine)
 * - No EMI, no kids, ultra-lean lifestyle
 * - Very early start (age 20) — tests max compounding
 * - Zero assets right now
 * - High step-up (20%/yr as income grows)
 * - Early retirement goal at 40 — aggressive FIRE
 * - No pension (pure portfolio withdrawal)
 *
 * LIFE TIMELINE:
 * Age 20 (2026) - Bootstrapping, stipend ₹25K
 * Age 23 (2029) - Proper job/salary ₹1.5L (reflected via step-up)
 * Age 25 (2031) - Moves out, rents apartment
 * Age 28 (2034) - Marries, buys flat (₹80L, EMI ₹52K x 20 yrs)
 * Age 30 (2036) - First child
 * Age 40 (2046) - Retires (target)
 * Age 48 (2054) - Flat EMI ends
 */

const profile = {
  id: 6, name: 'Rohan', dob: '2006-01-15',
  monthly_income: 25000, currency: 'INR',
};

const assets = [
  { id: 1, category: 'SAVINGS', name: 'Bank Account',
    current_value: 20000, expected_roi: 4, is_self_use: 0 },
];

const expenses = [
  // ── CURRENT RECURRING ──
  { id: 1, name: 'Personal & Misc', category: 'OTHERS', amount: 5000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  { id: 2, name: 'Phone & Internet', category: 'OTHERS', amount: 2000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 4 },
  { id: 3, name: 'Health Insurance', category: 'INSURANCE', amount: 12000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 8 },

  // ── FUTURE RECURRING ──
  // Rent from 25 to 28
  { id: 4, name: 'Rent (Hyderabad)', category: 'RENT', amount: 15000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2031-01-01', end_date: '2034-06-30', inflation_rate: 6 },
  { id: 5, name: 'Groceries (own place)', category: 'GROCERIES', amount: 7000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2031-01-01', end_date: null, inflation_rate: 6 },
  // Flat EMI age 28-48
  { id: 6, name: 'Flat EMI', category: 'EMI', amount: 52000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2034-07-01', end_date: '2054-06-30', inflation_rate: 0 },
  // Society maintenance
  { id: 7, name: 'Society Maintenance', category: 'RENT', amount: 3500,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2034-07-01', end_date: null, inflation_rate: 5 },
  // Kid from age 30
  { id: 8, name: 'Kid Monthly Expenses', category: 'OTHERS', amount: 8000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2036-06-01', end_date: '2060-06-30', inflation_rate: 7 },
  // Kid school age 36-48
  { id: 9, name: 'Kid School Fees', category: 'EDUCATION', amount: 150000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2042-06-01', end_date: '2054-05-31', inflation_rate: 10 },
  // Kid college age 48-52
  { id: 10, name: 'Kid College', category: 'EDUCATION', amount: 500000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2054-06-01', end_date: '2058-05-31', inflation_rate: 10 },

  // ── FUTURE ONE-TIME ──
  { id: 11, name: 'Wedding', category: 'EVENTS', amount: 1200000,
    expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2034-02-01', end_date: null, inflation_rate: 7 },
  { id: 12, name: 'Car Purchase', category: 'TRANSPORT', amount: 800000,
    expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2035-01-01', end_date: null, inflation_rate: 6 },
];

const goals = {
  retirement_age: 40, sip_stop_age: 38,
  pension_income: 0,
  fire_type: 'moderate', fire_target_age: 100, withdrawal_rate: 5,
};

module.exports = {
  name: 'Rohan — SaaS Founder, Hyderabad (Age 20)',
  description: 'Dropout founder, ₹25K stipend now, aggressive 20% step-up, targets FIRE at 40. Minimal assets, zero debt, ultra-lean.',
  profile, assets, expenses, goals,
  sipAmount: 3000,
  sipReturnRate: 14,
  postSipReturnRate: 10,
  stepUpRate: 20,
};
