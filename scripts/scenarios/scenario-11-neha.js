/**
 * Scenario 11: Neha — 26-yr-old Nurse, Kolkata
 * ==============================================
 * Age: 26 | Salary: ₹45,000/month | Single, renting
 *
 * PROFILE: Staff nurse at a private hospital in Kolkata. Low but stable salary.
 * Very small SIP (₹3K/month). No assets except savings. Works night shifts.
 * Plans to do a postgrad (M.Sc Nursing) in 2 years — will pause SIP for 2 years.
 * Plans to work as senior nurse in a Gulf country for 5 years (age 30-35) for
 * higher earnings — modelled via step-up then flat.
 * Will come back and settle down. Wants to retire at 58.
 *
 * EDGE CASES TESTED:
 * - Very low salary + very small SIP (stress test for low-income users)
 * - SIP pause not directly modelled but low amount + step-up covers it
 * - No EMI, no kids (simplest expense profile)
 * - No pension target — tests pure expense corpus
 * - Slim FIRE (85) appropriate for realistic horizon
 * - Very low asset base (₹50K total)
 *
 * LIFE TIMELINE:
 * Age 26 (2026) - Current: renting ₹8K, no assets
 * Age 28 (2028) - Postgrad (SIP reduced, modelled as current low SIP)
 * Age 30 (2030) - Gulf stint begins, income jumps
 * Age 35 (2035) - Returns to India
 * Age 36 (2036) - Marries (late marriage)
 * Age 37 (2037) - Buys flat (₹50L, EMI ₹33K x 15 yrs)
 * Age 38 (2038) - Child
 * Age 44 (2044) - Kid starts school
 * Age 52 (2052) - Flat EMI ends
 * Age 56 (2056) - Kid starts college
 * Age 58 (2058) - Retire
 */

const profile = {
  id: 11, name: 'Neha', dob: '2000-03-15',
  monthly_income: 45000, currency: 'INR',
};

const assets = [
  { id: 1, category: 'SAVINGS', name: 'Savings Account',
    current_value: 50000, expected_roi: 4, is_self_use: 0 },
];

const expenses = [
  // ── CURRENT RECURRING ──
  { id: 1, name: 'Rent (1BHK Kolkata)', category: 'RENT', amount: 8000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: '2037-06-30', inflation_rate: 6 },
  { id: 2, name: 'Groceries + Food', category: 'GROCERIES', amount: 6000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  { id: 3, name: 'Transport (bus/metro)', category: 'TRANSPORT', amount: 2000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 4, name: 'Utilities & Phone', category: 'OTHERS', amount: 2500,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 4 },
  { id: 5, name: 'Health Insurance', category: 'INSURANCE', amount: 15000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 8 },

  // ── FUTURE ONE-TIME ──
  { id: 6, name: 'Wedding', category: 'EVENTS', amount: 300000,
    expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2036-02-01', end_date: null, inflation_rate: 7 },

  // ── FUTURE RECURRING ──
  // Flat EMI age 37-52
  { id: 7, name: 'Flat EMI', category: 'EMI', amount: 33000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2037-07-01', end_date: '2052-06-30', inflation_rate: 0 },
  { id: 8, name: 'Society Maintenance', category: 'RENT', amount: 1500,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2037-07-01', end_date: null, inflation_rate: 5 },
  // Kid from age 38
  { id: 9, name: 'Kid Monthly', category: 'OTHERS', amount: 5000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2038-06-01', end_date: '2062-06-30', inflation_rate: 7 },
  // Kid school age 44-56
  { id: 10, name: 'Kid School Fees', category: 'EDUCATION', amount: 60000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2044-06-01', end_date: '2056-05-31', inflation_rate: 10 },
  // Kid college age 56-60 (post retirement — tests expense past retire)
  { id: 11, name: 'Kid College', category: 'EDUCATION', amount: 250000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2056-06-01', end_date: '2060-05-31', inflation_rate: 10 },
];

const goals = {
  retirement_age: 58, sip_stop_age: 58,
  pension_income: 0,
  fire_type: 'slim', fire_target_age: 100, withdrawal_rate: 7,
};

module.exports = {
  name: 'Neha — Nurse, Kolkata (Age 26)',
  description: 'Low-income nurse, ₹45K salary, ₹3K SIP, slim FIRE, no pension, kid college extends past retirement.',
  profile, assets, expenses, goals,
  sipAmount: 3000,
  sipReturnRate: 10,
  postSipReturnRate: 7,
  stepUpRate: 8,
};
