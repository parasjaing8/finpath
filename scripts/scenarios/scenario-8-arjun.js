/**
 * Scenario 8: Arjun — 29-yr-old NRI (UAE return), Bengaluru
 * ===========================================================
 * Age: 29 | Salary: ₹3,50,000/month | Married, no kids yet
 *
 * PROFILE: Worked in Dubai for 5 years, came back with savings. Now a senior
 * engineer at an MNC in Bengaluru. Has substantial NRI savings in foreign assets
 * (modelled as SAVINGS). No PF during Dubai years. Buying a luxury flat now.
 * Wife works too (modelled as higher household SIP). ESOP grant from new company.
 * Thinking of early retirement — wants ₹1L/month passive income post-retirement.
 *
 * EDGE CASES TESTED:
 * - High initial NW (NRI savings ₹45L)
 * - ESOP/RSU vesting (recurring ₹3L/year from age 29-34)
 * - Large luxury flat (₹2.1Cr, EMI ₹1.2L/month x 20 yrs)
 * - Pension target ₹1L/month (large corpus multiplier)
 * - Medium FIRE type (covers till 95)
 * - 2 international vacations yearly
 * - No kids (lower education expenses)
 *
 * LIFE TIMELINE:
 * Age 29 (2026) - Buys 3BHK luxury flat ₹2.1Cr, EMI starts
 * Age 31 (2028) - ESOP vesting ends
 * Age 32 (2029) - First child
 * Age 33 (2030) - Career break year (wife), household income drops
 * Age 38 (2035) - Kid starts school
 * Age 45 (2042) - Early retirement target
 * Age 49 (2046) - Flat EMI ends
 * Age 50 (2047) - Kid starts college
 */

const profile = {
  id: 8, name: 'Arjun', dob: '1997-03-05',
  monthly_income: 350000, currency: 'INR',
};

const assets = [
  { id: 1, category: 'SAVINGS', name: 'NRI Savings (USD converted)',
    current_value: 3500000, expected_roi: 7, is_self_use: 0 },
  { id: 2, category: 'MUTUAL_FUND', name: 'Index Funds (INR)',
    current_value: 1200000, expected_roi: 12, is_self_use: 0 },
  { id: 3, category: 'STOCKS', name: 'US Stocks (401k equivalent)',
    current_value: 800000, expected_roi: 12, is_self_use: 0 },
  { id: 4, category: 'REAL_ESTATE', name: 'Luxury Flat Bengaluru',
    current_value: 21000000, expected_roi: 7, is_self_use: 1 },
  // ESOP grant — recurring vesting
  { id: 5, category: 'ESOP_RSU', name: 'Company RSU',
    current_value: 0, expected_roi: 0, is_self_use: 0,
    is_recurring: 1, recurring_amount: 300000, recurring_frequency: 'YEARLY',
    next_vesting_date: '2026-06-01' },
];

const expenses = [
  // ── CURRENT RECURRING ──
  { id: 1, name: 'Groceries + Food', category: 'GROCERIES', amount: 20000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  { id: 2, name: 'Transport + Fuel (luxury car)', category: 'TRANSPORT', amount: 15000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 3, name: 'Utilities + Internet', category: 'OTHERS', amount: 12000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 4, name: 'Entertainment & Dining out', category: 'OTHERS', amount: 25000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 7 },
  { id: 5, name: 'Flat EMI (₹2.1Cr luxury)', category: 'EMI', amount: 120000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: '2046-06-30', inflation_rate: 0 },
  { id: 6, name: 'Society + Maintenance', category: 'RENT', amount: 10000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 7, name: 'Term + Health Insurance', category: 'INSURANCE', amount: 120000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 7 },
  { id: 8, name: 'International Vacations (2x)', category: 'OTHERS', amount: 300000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 8 },

  // ── FUTURE ONE-TIME ──
  { id: 9, name: 'Second Car (upgrade)', category: 'TRANSPORT', amount: 2500000,
    expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2032-01-01', end_date: null, inflation_rate: 6 },

  // ── FUTURE RECURRING ──
  // Kid from age 32
  { id: 10, name: 'Kid Monthly', category: 'OTHERS', amount: 15000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2029-06-01', end_date: '2053-06-30', inflation_rate: 7 },
  // Kid school age 38-50
  { id: 11, name: 'Kid International School', category: 'EDUCATION', amount: 500000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2035-06-01', end_date: '2047-05-31', inflation_rate: 10 },
  // Kid college age 50-54
  { id: 12, name: 'Kid College (abroad)', category: 'EDUCATION', amount: 3000000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2047-06-01', end_date: '2051-05-31', inflation_rate: 8 },
];

const goals = {
  retirement_age: 45, sip_stop_age: 45,
  pension_income: 100000,  // ₹1L/month lifestyle — tests large pension corpus
  fire_type: 'moderate', fire_target_age: 100, withdrawal_rate: 5,
};

module.exports = {
  name: 'Arjun — NRI Return, Bengaluru (Age 29)',
  description: 'NRI return, ₹3.5L salary, ₹45L NW, RSU vesting, luxury lifestyle, ₹1L pension target, FIRE at 45, Medium FIRE (95).',
  profile, assets, expenses, goals,
  sipAmount: 100000,
  sipReturnRate: 12,
  postSipReturnRate: 9,
  stepUpRate: 8,
};
