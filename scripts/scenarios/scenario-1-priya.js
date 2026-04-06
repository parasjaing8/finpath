/**
 * Scenario 1: Priya — Fresh Graduate in Pune
 * =============================================
 * Age: 22 | Salary: ₹35,000/month | Single, lives with parents
 * 
 * PROFILE: Just graduated B.Tech, joined an IT services company (TCS/Infosys tier).
 * Lives at home in Pune, minimal expenses. Wants to start investing early.
 * Plans to move out at 25, get married at 28, buy flat at 30.
 * Conservative with money, influenced by personal finance YouTubers.
 * 
 * LIFE TIMELINE:
 * Age 22 (2026) - Starts job, lives with parents
 * Age 24 (2028) - Buys scooter (₹1.2L)
 * Age 25 (2029) - Moves out, starts renting (₹10K/month)
 * Age 28 (2032) - Gets married (₹8L wedding)
 * Age 30 (2034) - Buys flat (₹55L, EMI ₹38K/month x 20yrs)
 * Age 30 (2034) - Stops renting
 * Age 31 (2035) - First child born
 * Age 34 (2038) - Second child born
 * Age 37 (2041) - Kid 1 starts school
 * Age 40 (2044) - Kid 2 starts school
 * Age 51 (2055) - Kid 1 starts college
 * Age 54 (2058) - Kid 2 starts college
 * Age 50 (2054) - Flat EMI ends
 * Age 55 (2059) - Retires
 */

const profile = {
  id: 1, name: 'Priya', dob: '2004-03-10',
  monthly_income: 35000, currency: 'INR',
};

const assets = [
  { id: 1, category: 'SAVINGS', name: 'Bank Savings',
    current_value: 50000, expected_roi: 4, is_self_use: 0 },
  { id: 2, category: 'PF', name: 'PPF',
    current_value: 30000, expected_roi: 7.1, is_self_use: 0 },
];

const expenses = [
  // ── CURRENT RECURRING ──
  // Living at home - just personal + transport
  { id: 1, name: 'Personal & Misc', category: 'OTHERS', amount: 3000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  { id: 2, name: 'Transport (Metro/Bus)', category: 'TRANSPORT', amount: 2000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 3, name: 'Food (eating out)', category: 'GROCERIES', amount: 4000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  { id: 4, name: 'Phone & Subscriptions', category: 'OTHERS', amount: 1500,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 4 },
  { id: 5, name: 'Health Insurance (parents plan)', category: 'INSURANCE', amount: 15000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 8 },

  // ── FUTURE ONE-TIME ──
  { id: 6, name: 'Scooter Purchase', category: 'TRANSPORT', amount: 120000,
    expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2028-03-01', end_date: null, inflation_rate: 5 },
  { id: 7, name: 'Wedding', category: 'EVENTS', amount: 800000,
    expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2032-01-01', end_date: null, inflation_rate: 7 },

  // ── FUTURE RECURRING ──
  // Rent from age 25 to 30 (stops when flat bought)
  { id: 8, name: 'Rent', category: 'RENT', amount: 10000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2029-07-01', end_date: '2034-06-30', inflation_rate: 6 },
  // Groceries after moving out
  { id: 9, name: 'Groceries (own house)', category: 'GROCERIES', amount: 6000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2029-07-01', end_date: null, inflation_rate: 6 },
  // Flat EMI: age 30-50
  { id: 10, name: 'Flat EMI', category: 'EMI', amount: 38000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2034-07-01', end_date: '2054-06-30', inflation_rate: 0 },
  // Society maintenance after flat
  { id: 11, name: 'Society Maintenance', category: 'RENT', amount: 3000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2034-07-01', end_date: null, inflation_rate: 5 },
  // Kid 1 expenses: age 31 to 55
  { id: 12, name: 'Kid 1 Monthly', category: 'OTHERS', amount: 5000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2035-06-01', end_date: '2057-06-30', inflation_rate: 7 },
  // Kid 2 expenses: age 34 to 58
  { id: 13, name: 'Kid 2 Monthly', category: 'OTHERS', amount: 5000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2038-06-01', end_date: '2060-06-30', inflation_rate: 7 },
  // Kid 1 school: age 37 to 49
  { id: 14, name: 'Kid 1 School Fees', category: 'EDUCATION', amount: 100000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2041-06-01', end_date: '2053-05-31', inflation_rate: 10 },
  // Kid 2 school: age 40 to 52
  { id: 15, name: 'Kid 2 School Fees', category: 'EDUCATION', amount: 100000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2044-06-01', end_date: '2056-05-31', inflation_rate: 10 },
  // Kid 1 college: age 51 to 55
  { id: 16, name: 'Kid 1 College', category: 'EDUCATION', amount: 400000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2055-06-01', end_date: '2059-05-31', inflation_rate: 10 },
  // Kid 2 college: age 54 to 58
  { id: 17, name: 'Kid 2 College', category: 'EDUCATION', amount: 400000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2058-06-01', end_date: '2062-05-31', inflation_rate: 10 },
];

const goals = {
  retirement_age: 55, sip_stop_age: 55,
  pension_income: 0,  // No pension, pure FIRE
};

module.exports = {
  name: 'Priya — Fresh Graduate, Pune (Age 22)',
  description: 'Young fresher, low salary (₹35K), lives with parents, starts investing early. No pension. Conservative SIP.',
  profile, assets, expenses, goals,
  sipAmount: 5000,
  sipReturnRate: 12,
  postSipReturnRate: 7,
  stepUpRate: 15,
};
