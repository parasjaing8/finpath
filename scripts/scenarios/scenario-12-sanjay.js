/**
 * Scenario 12: Sanjay — 42-yr-old Real Estate Developer, Ahmedabad
 * =================================================================
 * Age: 42 | Salary: ₹5,00,000/month | Married, 2 kids (15, 12)
 *
 * PROFILE: Runs a small real estate development firm. High but irregular income
 * (modelled as ₹5L/month stable equivalent). Multiple properties — 1 self-use,
 * 2 commercial (income generating but modelled as assets). High lifestyle expenses.
 * Private school fees, multiple cars. Very little in equity/SIP — most wealth in
 * real estate. Wants ₹1.5L/month passive income at retirement.
 *
 * EDGE CASES TESTED:
 * - Multiple real estate assets (self-use + investment)
 * - Very high salary, high expenses — tests wealth level
 * - Business-class lifestyle (luxury car, vacations, staff)
 * - High pension target (₹1.5L/month) — largest pension in all scenarios
 * - Short runway to retirement (only 8 years)
 * - No step-up (business income is already at peak)
 * - Real estate dominated NW (investable vs total NW gap)
 * - Fat FIRE with ₹1.5L pension
 *
 * LIFE TIMELINE:
 * Age 42 (2026) - Current: high income, heavy real estate
 * Age 45 (2029) - Kid 1 starts college
 * Age 47 (2031) - Kid 2 starts college
 * Age 48 (2032) - Car upgrade
 * Age 50 (2034) - Kids done, expenses drop dramatically
 * Age 50 (2034) - Retire (target)
 */

const profile = {
  id: 12, name: 'Sanjay', dob: '1984-02-20',
  monthly_income: 500000, currency: 'INR',
};

const assets = [
  { id: 1, category: 'SAVINGS', name: 'Business Current Account',
    current_value: 3000000, expected_roi: 5, is_self_use: 0 },
  { id: 2, category: 'MUTUAL_FUND', name: 'Index Funds',
    current_value: 2000000, expected_roi: 12, is_self_use: 0 },
  { id: 3, category: 'REAL_ESTATE', name: 'Self-use Bungalow Ahmedabad',
    current_value: 25000000, expected_roi: 7, is_self_use: 1 },
  { id: 4, category: 'REAL_ESTATE', name: 'Commercial Shop (investment)',
    current_value: 8000000, expected_roi: 8, is_self_use: 0 },
  { id: 5, category: 'REAL_ESTATE', name: 'Rental Flat (investment)',
    current_value: 5000000, expected_roi: 7, is_self_use: 0 },
  { id: 6, category: 'GOLD', name: 'Gold + Jewellery',
    current_value: 1500000, expected_roi: 10, is_self_use: 0 },
];

const expenses = [
  // ── CURRENT RECURRING ──
  { id: 1, name: 'Groceries + Household Staff', category: 'GROCERIES', amount: 35000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  { id: 2, name: 'Transport + Fuel (2 luxury cars)', category: 'TRANSPORT', amount: 30000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 3, name: 'Utilities + Club + Internet', category: 'OTHERS', amount: 20000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 4, name: 'Entertainment + Dining', category: 'OTHERS', amount: 40000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 7 },
  { id: 5, name: 'Insurance (business + personal)', category: 'INSURANCE', amount: 300000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 6, name: 'Annual Vacation (international)', category: 'OTHERS', amount: 500000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 8 },
  { id: 7, name: 'Kid 1 School (IGCSE)', category: 'EDUCATION', amount: 400000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: '2028-05-31', inflation_rate: 10 },
  { id: 8, name: 'Kid 2 School (IGCSE)', category: 'EDUCATION', amount: 400000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: '2031-05-31', inflation_rate: 10 },

  // ── FUTURE ONE-TIME ──
  { id: 9, name: 'Car Upgrade (luxury sedan)', category: 'TRANSPORT', amount: 5000000,
    expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2032-01-01', end_date: null, inflation_rate: 6 },

  // ── FUTURE RECURRING ──
  // Kid 1 abroad college age 45-49
  { id: 10, name: 'Kid 1 Abroad College', category: 'EDUCATION', amount: 5000000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2029-06-01', end_date: '2033-05-31', inflation_rate: 8 },
  // Kid 2 abroad college age 47-51
  { id: 11, name: 'Kid 2 Abroad College', category: 'EDUCATION', amount: 5000000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2031-06-01', end_date: '2035-05-31', inflation_rate: 8 },
];

const goals = {
  retirement_age: 50, sip_stop_age: 50,
  pension_income: 150000,  // ₹1.5L/month lifestyle income
  fire_type: 'moderate', fire_target_age: 100, withdrawal_rate: 5,
};

module.exports = {
  name: 'Sanjay — Real Estate Developer, Ahmedabad (Age 42)',
  description: 'High-income developer, ₹5L/month, real estate dominant NW, ₹1.5L pension, FIRE at 50, 2 kids abroad college.',
  profile, assets, expenses, goals,
  sipAmount: 150000,
  sipReturnRate: 12,
  postSipReturnRate: 9,
  stepUpRate: 0,
};
