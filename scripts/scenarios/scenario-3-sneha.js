/**
 * Scenario 3: Sneha — Senior Manager in Mumbai
 * ===============================================
 * Age: 35 | Salary: ₹2,50,000/month | Married, 2 kids (ages 3 and 6)
 * 
 * PROFILE: Works at a large MNC bank in BKC. Husband also works (₹1.5L/month) but 
 * she tracks only her finances in the app. Has a running home loan.
 * Lives in Powai. Kids in nursery/playschool. High Mumbai cost of living.
 * Already has decent savings and mutual funds from 10+ years of work.
 * 
 * LIFE TIMELINE:
 * Age 35 (2026) - Current: home loan EMI, 2 young kids
 * Age 38 (2029) - Kid 2 starts school (kid 1 already in school at age 6 = now)
 * Age 40 (2031) - Car upgrade (₹18L)
 * Age 47 (2038) - Kid 1 starts college
 * Age 50 (2041) - Kid 2 starts college, home loan EMI ends
 * Age 55 (2046) - Retires
 */

const profile = {
  id: 3, name: 'Sneha', dob: '1991-09-15',
  monthly_income: 250000, currency: 'INR',
};

const assets = [
  { id: 1, category: 'SAVINGS', name: 'Savings + FD',
    current_value: 1000000, expected_roi: 5, is_self_use: 0 },
  { id: 2, category: 'MUTUAL_FUND', name: 'Mutual Funds (diversified)',
    current_value: 2500000, expected_roi: 11, is_self_use: 0 },
  { id: 3, category: 'PF', name: 'EPF',
    current_value: 1500000, expected_roi: 8.15, is_self_use: 0 },
  { id: 4, category: 'GOLD', name: 'Gold jewelry & SGB',
    current_value: 500000, expected_roi: 8, is_self_use: 0,
    gold_silver_unit: 'GRAMS', gold_silver_quantity: 60 },
  { id: 5, category: 'REAL_ESTATE', name: 'Flat in Powai',
    current_value: 15000000, expected_roi: 5, is_self_use: 1 },
];

const expenses = [
  // ── CURRENT RECURRING ──
  { id: 1, name: 'Home Loan EMI', category: 'EMI', amount: 65000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: '2041-03-31', inflation_rate: 0 },
  { id: 2, name: 'Food & Groceries', category: 'GROCERIES', amount: 20000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  { id: 3, name: 'Utilities & Internet', category: 'OTHERS', amount: 12000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 4, name: 'Transport & Fuel', category: 'TRANSPORT', amount: 8000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 5, name: 'Society Maintenance', category: 'RENT', amount: 6000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 6, name: 'Entertainment & Dining', category: 'OTHERS', amount: 12000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  { id: 7, name: 'Kid 1 Playschool', category: 'EDUCATION', amount: 250000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: '2026-05-31', inflation_rate: 10 },
  { id: 8, name: 'Kid 2 Nursery', category: 'EDUCATION', amount: 150000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: '2029-05-31', inflation_rate: 10 },
  { id: 9, name: 'Insurance (Term + Health + Kids)', category: 'INSURANCE', amount: 100000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  { id: 10, name: 'Medical', category: 'MEDICAL', amount: 25000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 8 },
  { id: 11, name: 'Annual Vacation', category: 'OTHERS', amount: 150000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 7 },
  // Kids monthly (ongoing — diapers, clothes, activities)
  { id: 12, name: 'Kids Monthly (activities, clothes)', category: 'OTHERS', amount: 10000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 7 },

  // ── FUTURE ONE-TIME ──
  { id: 13, name: 'Car Upgrade (SUV)', category: 'TRANSPORT', amount: 1800000,
    expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2031-01-01', end_date: null, inflation_rate: 6 },
  { id: 14, name: 'Home Renovation', category: 'OTHERS', amount: 500000,
    expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2033-01-01', end_date: null, inflation_rate: 6 },

  // ── FUTURE RECURRING ──
  // Kid 1 school (already started — current age 6, school till 18 = year 2038)
  { id: 15, name: 'Kid 1 School Fees', category: 'EDUCATION', amount: 300000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2026-06-01', end_date: '2038-05-31', inflation_rate: 10 },
  // Kid 2 school (starts age 6 = 2029, school till 2041)
  { id: 16, name: 'Kid 2 School Fees', category: 'EDUCATION', amount: 300000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2029-06-01', end_date: '2041-05-31', inflation_rate: 10 },
  // Kid 1 college (age 18-22 = 2038-2042)
  { id: 17, name: 'Kid 1 College', category: 'EDUCATION', amount: 800000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2038-06-01', end_date: '2042-05-31', inflation_rate: 10 },
  // Kid 2 college (age 18-22 = 2041-2045)
  { id: 18, name: 'Kid 2 College', category: 'EDUCATION', amount: 800000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2041-06-01', end_date: '2045-05-31', inflation_rate: 10 },
  // Car maintenance
  { id: 19, name: 'Car Maintenance & Fuel', category: 'TRANSPORT', amount: 6000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2031-01-01', end_date: null, inflation_rate: 6 },
];

const goals = {
  retirement_age: 55, sip_stop_age: 55,
  pension_income: 0,  // No pension — pure FIRE
};

module.exports = {
  name: 'Sneha — Senior Manager, Mumbai (Age 35)',
  description: 'Established career, ₹2.5L salary, 2 young kids, home loan running, high-cost city. Zero pension. Needs large corpus.',
  profile, assets, expenses, goals,
  sipAmount: 50000,
  sipReturnRate: 11,
  postSipReturnRate: 7,
  stepUpRate: 8,
};
