/**
 * Scenario 2: Amit — Product Manager in Bangalore
 * ==================================================
 * Age: 28 | Salary: ₹1,80,000/month | Married, no kids yet
 * 
 * PROFILE: Works at a funded startup. Good salary with ESOPs.
 * Recently married (last year). Rents a 2BHK in HSR Layout.
 * Has a car loan EMI. Planning to buy flat next year and start family.
 * Active investor — SIPs in index funds + some direct stocks.
 * 
 * LIFE TIMELINE:
 * Age 28 (2026) - Current: renting, car EMI running
 * Age 29 (2027) - Car EMI ends
 * Age 30 (2028) - Buys flat (₹1.2Cr, EMI ₹72K/month x 20yrs), stops renting
 * Age 31 (2029) - First child born
 * Age 33 (2031) - Second child born
 * Age 35 (2033) - Upgrades car (₹15L)
 * Age 37 (2035) - Kid 1 starts school
 * Age 39 (2037) - Kid 2 starts school
 * Age 50 (2048) - Flat EMI ends, retires
 * Age 51 (2049) - Kid 1 starts college
 * Age 53 (2051) - Kid 2 starts college
 */

const profile = {
  id: 2, name: 'Amit', dob: '1998-06-20',
  monthly_income: 180000, currency: 'INR',
};

const assets = [
  { id: 1, category: 'SAVINGS', name: 'Savings Account',
    current_value: 500000, expected_roi: 4, is_self_use: 0 },
  { id: 2, category: 'MUTUAL_FUND', name: 'Index Funds',
    current_value: 800000, expected_roi: 12, is_self_use: 0 },
  { id: 3, category: 'PF', name: 'EPF',
    current_value: 300000, expected_roi: 8.15, is_self_use: 0 },
  { id: 4, category: 'STOCKS', name: 'Direct Equity',
    current_value: 200000, expected_roi: 14, is_self_use: 0 },
];

const expenses = [
  // ── CURRENT RECURRING ──
  { id: 1, name: 'Rent (2BHK HSR)', category: 'RENT', amount: 25000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: '2028-06-30', inflation_rate: 6 },
  { id: 2, name: 'Food & Groceries', category: 'GROCERIES', amount: 15000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  { id: 3, name: 'Transport & Fuel', category: 'TRANSPORT', amount: 5000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 4, name: 'Utilities & Internet', category: 'OTHERS', amount: 8000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 5, name: 'Entertainment & Dining', category: 'OTHERS', amount: 10000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  { id: 6, name: 'Car EMI (existing)', category: 'EMI', amount: 18000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: '2027-09-30', inflation_rate: 0 },
  { id: 7, name: 'Insurance (Term + Health)', category: 'INSURANCE', amount: 60000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 8, name: 'Annual Vacation', category: 'OTHERS', amount: 80000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 7 },

  // ── FUTURE ONE-TIME ──
  { id: 9, name: 'Car Upgrade', category: 'TRANSPORT', amount: 1500000,
    expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2033-01-01', end_date: null, inflation_rate: 6 },
  { id: 10, name: 'Kid 1 Delivery', category: 'MEDICAL', amount: 250000,
    expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2029-06-01', end_date: null, inflation_rate: 8 },
  { id: 11, name: 'Kid 2 Delivery', category: 'MEDICAL', amount: 250000,
    expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2031-06-01', end_date: null, inflation_rate: 8 },

  // ── FUTURE RECURRING ──
  // Flat EMI: age 30.to 50
  { id: 12, name: 'Flat EMI', category: 'EMI', amount: 72000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2028-07-01', end_date: '2048-06-30', inflation_rate: 0 },
  // Society + maintenance after flat
  { id: 13, name: 'Society & Maintenance', category: 'RENT', amount: 5000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2028-07-01', end_date: null, inflation_rate: 5 },
  // Kid 1 monthly expenses
  { id: 14, name: 'Kid 1 Expenses', category: 'OTHERS', amount: 7000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2029-06-01', end_date: '2051-06-30', inflation_rate: 7 },
  // Kid 2 monthly expenses
  { id: 15, name: 'Kid 2 Expenses', category: 'OTHERS', amount: 7000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2031-06-01', end_date: '2053-06-30', inflation_rate: 7 },
  // Kid 1 school (age 37-49)
  { id: 16, name: 'Kid 1 School', category: 'EDUCATION', amount: 200000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2035-06-01', end_date: '2047-05-31', inflation_rate: 10 },
  // Kid 2 school (age 39-51)
  { id: 17, name: 'Kid 2 School', category: 'EDUCATION', amount: 200000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2037-06-01', end_date: '2049-05-31', inflation_rate: 10 },
  // Kid 1 college (age 51-55)
  { id: 18, name: 'Kid 1 College', category: 'EDUCATION', amount: 600000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2049-06-01', end_date: '2053-05-31', inflation_rate: 10 },
  // Kid 2 college (age 53-57)
  { id: 19, name: 'Kid 2 College', category: 'EDUCATION', amount: 600000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2051-06-01', end_date: '2055-05-31', inflation_rate: 10 },
  // Car maintenance from car upgrade
  { id: 20, name: 'Car Maintenance', category: 'TRANSPORT', amount: 4000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2033-01-01', end_date: null, inflation_rate: 6 },
];

const goals = {
  retirement_age: 50, sip_stop_age: 50,
  pension_income: 50000,  // ₹50K passive income from ESOPs/dividends
};

module.exports = {
  name: 'Amit — Product Manager, Bangalore (Age 28)',
  description: 'Mid-career startup PM, ₹1.8L salary, married, aggressive SIP, planning flat + 2 kids. ₹50K passive income target.',
  profile, assets, expenses, goals,
  sipAmount: 40000,
  sipReturnRate: 12,
  postSipReturnRate: 8,
  stepUpRate: 10,
};
