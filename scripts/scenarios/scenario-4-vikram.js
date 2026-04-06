/**
 * Scenario 4: Vikram — Freelance Consultant in Delhi  
 * =====================================================
 * Age: 40 | Income: ₹4,00,000/month | Divorced, 1 teenage son (age 15)
 * 
 * PROFILE: Senior tech consultant, works with US/EU clients remotely.
 * Divorced 3 years ago, pays alimony ₹30K/month. Son lives with him.
 * Rents a 3BHK in Gurgaon. No employer benefits (no EPF, no insurance).
 * Has accumulated good savings but started late on SIPs.
 * Son is in class 10, will need college funding in 3 years.
 * Wants to buy a flat to stop renting. Plans to retire at 55.
 * 
 * LIFE TIMELINE:
 * Age 40 (2026) - Current: renting, son in school, paying alimony
 * Age 42 (2028) - Buys flat (₹1.5Cr, EMI ₹90K/month x 15yrs)
 * Age 43 (2029) - Son starts college (₹10L/yr x 4 years)
 * Age 45 (2031) - Upgrades car (₹20L)
 * Age 47 (2033) - Son finishes college
 * Age 57 (2043) - Flat EMI ends
 * Age 55 (2041) - Retires (but EMI still running 2 more years!)
 */

const profile = {
  id: 4, name: 'Vikram', dob: '1986-01-25',
  monthly_income: 400000, currency: 'INR',
};

const assets = [
  { id: 1, category: 'SAVINGS', name: 'Bank Savings',
    current_value: 2000000, expected_roi: 4, is_self_use: 0 },
  { id: 2, category: 'FD', name: 'Fixed Deposits',
    current_value: 3000000, expected_roi: 7, is_self_use: 0 },
  { id: 3, category: 'MUTUAL_FUND', name: 'Mutual Funds',
    current_value: 5000000, expected_roi: 11, is_self_use: 0 },
  { id: 4, category: 'STOCKS', name: 'US & Indian Stocks',
    current_value: 1500000, expected_roi: 13, is_self_use: 0 },
];

const expenses = [
  // ── CURRENT RECURRING ──
  { id: 1, name: 'Rent (3BHK Gurgaon)', category: 'RENT', amount: 40000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: '2028-06-30', inflation_rate: 6 },
  { id: 2, name: 'Food & Groceries', category: 'GROCERIES', amount: 18000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  { id: 3, name: 'Utilities & Internet', category: 'OTHERS', amount: 10000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 4, name: 'Transport & Fuel', category: 'TRANSPORT', amount: 10000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 5, name: 'Alimony', category: 'OTHERS', amount: 30000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 6, name: 'Son School Fees (current)', category: 'EDUCATION', amount: 400000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: '2029-05-31', inflation_rate: 10 },
  { id: 7, name: 'Insurance (Term + Health, self-bought)', category: 'INSURANCE', amount: 120000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  { id: 8, name: 'Medical Checkups', category: 'MEDICAL', amount: 30000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 8 },
  { id: 9, name: 'Personal & Entertainment', category: 'OTHERS', amount: 15000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  { id: 10, name: 'Son Monthly (pocket money, tuition, activities)', category: 'OTHERS', amount: 12000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: '2033-06-30', inflation_rate: 6 },

  // ── FUTURE ONE-TIME ──
  { id: 11, name: 'Car Upgrade (luxury)', category: 'TRANSPORT', amount: 2000000,
    expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2031-01-01', end_date: null, inflation_rate: 6 },
  { id: 12, name: 'Son Wedding Fund', category: 'EVENTS', amount: 2000000,
    expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2041-01-01', end_date: null, inflation_rate: 7 },

  // ── FUTURE RECURRING ──
  // Flat EMI: age 42 to 57
  { id: 13, name: 'Flat EMI', category: 'EMI', amount: 90000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2028-07-01', end_date: '2043-06-30', inflation_rate: 0 },
  // Society after flat
  { id: 14, name: 'Society & Maintenance', category: 'RENT', amount: 8000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2028-07-01', end_date: null, inflation_rate: 5 },
  // Son college: age 43-47
  { id: 15, name: 'Son College Fees', category: 'EDUCATION', amount: 1000000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2029-06-01', end_date: '2033-05-31', inflation_rate: 10 },
  // Car maintenance from upgrade
  { id: 16, name: 'Car Maintenance (luxury)', category: 'TRANSPORT', amount: 8000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2031-01-01', end_date: null, inflation_rate: 6 },
];

const goals = {
  retirement_age: 55, sip_stop_age: 55,
  pension_income: 0,  // Freelancer — no pension at all
};

module.exports = {
  name: 'Vikram — Freelance Consultant, Delhi (Age 40)',
  description: 'High-income freelancer (₹4L), divorced, 1 teenage son, no employer benefits. Flat EMI extends past retirement. No pension.',
  profile, assets, expenses, goals,
  sipAmount: 100000,
  sipReturnRate: 10,
  postSipReturnRate: 7,
  stepUpRate: 5,
};
