/**
 * Scenario 14: Kiran — 36-yr-old School Principal, Kochi
 * =======================================================
 * Age: 36 | Salary: ₹1,10,000/month | Married, 1 adopted child (age 8)
 *
 * PROFILE: Principal of a CBSE school in Kochi, Kerala. Wife is an Ayurvedic
 * doctor with own clinic (not modelled here — separate profile). 1 adopted child.
 * Inherited ancestral house in Thrissur (self-use). No flat to buy. Good savings
 * discipline — PPF, NPS, balanced SIP. Moderate lifestyle. Expects UGC/school-level
 * pension (private school trust — modelled as ₹25K/month).
 *
 * EDGE CASES TESTED:
 * - Inherited property already owned = zero EMI
 * - Moderate pension from private school trust
 * - Single adopted child (education costs normal but no 'delivery' expense)
 * - NPS as a significant growing asset
 * - SIP step-up 6% (salary increments at school)
 * - Fat FIRE to 100
 * - International school for kid (higher fees)
 *
 * LIFE TIMELINE:
 * Age 36 (2026) - Current: inherited home, no rent, no EMI
 * Age 44 (2034) - Adopted kid starts college
 * Age 48 (2038) - Kid college done
 * Age 55 (2045) - Retire
 */

const profile = {
  id: 14, name: 'Kiran', dob: '1990-01-15',
  monthly_income: 110000, currency: 'INR',
};

const assets = [
  { id: 1, category: 'PF', name: 'PPF',
    current_value: 1200000, expected_roi: 7.1, is_self_use: 0 },
  { id: 2, category: 'PF', name: 'NPS (Tier 1 + 2)',
    current_value: 900000, expected_roi: 10, is_self_use: 0 },
  { id: 3, category: 'MUTUAL_FUND', name: 'Balanced Advantage Fund',
    current_value: 600000, expected_roi: 11, is_self_use: 0 },
  { id: 4, category: 'SAVINGS', name: 'FD + Bank Savings',
    current_value: 350000, expected_roi: 6.5, is_self_use: 0 },
  { id: 5, category: 'REAL_ESTATE', name: 'Ancestral Home Thrissur',
    current_value: 8000000, expected_roi: 7, is_self_use: 1 },
];

const expenses = [
  // ── CURRENT RECURRING ──
  { id: 1, name: 'Groceries + Household', category: 'GROCERIES', amount: 12000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  { id: 2, name: 'Transport (car)', category: 'TRANSPORT', amount: 7000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 3, name: 'Utilities + Internet', category: 'OTHERS', amount: 4000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 4, name: 'Kid Monthly (adopted)', category: 'OTHERS', amount: 8000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: '2050-06-30', inflation_rate: 7 },
  { id: 5, name: 'Kid School Fees (ICSE Kochi)', category: 'EDUCATION', amount: 180000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: '2034-05-31', inflation_rate: 10 },
  { id: 6, name: 'Term + Health Insurance', category: 'INSURANCE', amount: 50000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 7 },
  { id: 7, name: 'Kerala vacations (domestic)', category: 'OTHERS', amount: 60000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 7 },
  { id: 8, name: 'House Maintenance (ancestral)', category: 'RENT', amount: 15000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 6 },

  // ── FUTURE RECURRING ──
  // Kid college age 44-48
  { id: 9, name: 'Kid College (medical/engineering)', category: 'EDUCATION', amount: 600000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2034-06-01', end_date: '2038-05-31', inflation_rate: 10 },
  // Kid wedding
  { id: 10, name: 'Kid Wedding', category: 'EVENTS', amount: 800000,
    expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2050-01-01', end_date: null, inflation_rate: 7 },
];

const goals = {
  retirement_age: 55, sip_stop_age: 55,
  pension_income: 25000,  // private school trust pension
  fire_type: 'fat', fire_target_age: 100, withdrawal_rate: 3,
};

module.exports = {
  name: 'Kiran — School Principal, Kochi (Age 36)',
  description: 'School principal, ₹1.1L salary, inherited home (no EMI), NPS/PPF heavy, ₹25K trust pension, 1 adopted kid, fat FIRE.',
  profile, assets, expenses, goals,
  sipAmount: 25000,
  sipReturnRate: 11,
  postSipReturnRate: 8,
  stepUpRate: 6,
};
