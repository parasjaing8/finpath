/**
 * Scenario 13: Tanvi — 31-yr-old FMCG Brand Manager, Mumbai (DINKs)
 * ==================================================================
 * Age: 31 | Salary: ₹1,60,000/month | Married, no kids (DINK couple)
 *
 * PROFILE: Brand manager at a leading FMCG company. Husband is an architect
 * earning ₹1.2L. Deliberately child-free (DINK — Dual Income, No Kids).
 * Combined household but modelled on Tanvi's income only (husband has
 * separate app profile). Lots of travel, experiences, gadgets. Renting in
 * Bandra. No flat purchase planned (prefers flexibility). Retire at 48.
 *
 * EDGE CASES TESTED:
 * - DINK lifestyle (no kids = no education expenses)
 * - No real estate purchase (renting forever — tests perpetual rent inflation)
 * - High discretionary expenses (travel, experience economy)
 * - Very early retirement target (age 48 — only 17 years away)
 * - SIP stops at 45 (3 years before retirement)
 * - Medium pension target (₹45K/month) — comfortable lifestyle
 * - Perpetual rent (never buys flat) — key stress test
 *
 * LIFE TIMELINE:
 * Age 31 (2026) - Renting Bandra 2BHK ₹45K/month
 * Age 35 (2030) - Husband's architecture firm income grows (not modelled here)
 * Age 48 (2043) - Retire
 * Age 60 (2055) - Parents' care begins
 */

const profile = {
  id: 13, name: 'Tanvi', dob: '1995-02-14',
  monthly_income: 160000, currency: 'INR',
};

const assets = [
  { id: 1, category: 'MUTUAL_FUND', name: 'Index Funds (Nifty50 + MidCap)',
    current_value: 1500000, expected_roi: 12, is_self_use: 0 },
  { id: 2, category: 'STOCKS', name: 'Direct Stocks',
    current_value: 400000, expected_roi: 14, is_self_use: 0 },
  { id: 3, category: 'SAVINGS', name: 'Emergency Fund',
    current_value: 500000, expected_roi: 6, is_self_use: 0 },
  { id: 4, category: 'PF', name: 'EPF',
    current_value: 600000, expected_roi: 8.15, is_self_use: 0 },
];

const expenses = [
  // ── CURRENT RECURRING (perpetual rent — tests forever-renting scenario) ──
  { id: 1, name: 'Rent (Bandra 2BHK)', category: 'RENT', amount: 45000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  { id: 2, name: 'Groceries + Dining', category: 'GROCERIES', amount: 20000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  { id: 3, name: 'Transport (Uber/car fuel)', category: 'TRANSPORT', amount: 15000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 4, name: 'Utilities + Subscriptions', category: 'OTHERS', amount: 8000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 4 },
  { id: 5, name: 'Shopping + Lifestyle', category: 'OTHERS', amount: 20000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  { id: 6, name: 'Skincare + Personal', category: 'OTHERS', amount: 8000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 7, name: 'Term + Health Insurance', category: 'INSURANCE', amount: 60000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 7 },
  { id: 8, name: 'International Travel (4 trips/yr)', category: 'OTHERS', amount: 400000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 8 },
  { id: 9, name: 'Gadgets + Tech', category: 'OTHERS', amount: 80000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 5 },

  // ── FUTURE ONE-TIME ──
  { id: 10, name: 'Sabbatical trip', category: 'OTHERS', amount: 800000,
    expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2035-03-01', end_date: null, inflation_rate: 8 },

  // ── FUTURE RECURRING ──
  // Parent care from age 60
  { id: 11, name: 'Parent Medical Care', category: 'MEDICAL', amount: 15000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2055-01-01', end_date: '2080-12-31', inflation_rate: 8 },
];

const goals = {
  retirement_age: 48, sip_stop_age: 45,
  pension_income: 45000,
  fire_type: 'moderate', fire_target_age: 100, withdrawal_rate: 5,
};

module.exports = {
  name: 'Tanvi — FMCG Brand Manager, Mumbai (DINK, Age 31)',
  description: 'DINK, ₹1.6L salary, renting forever Bandra, no kids, high discretionary, FIRE at 48, Medium FIRE (95), SIP stops at 45.',
  profile, assets, expenses, goals,
  sipAmount: 60000,
  sipReturnRate: 12,
  postSipReturnRate: 9,
  stepUpRate: 10,
};
