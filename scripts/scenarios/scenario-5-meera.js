/**
 * Scenario 5: Meera — Government School Teacher in Jaipur
 * =========================================================
 * Age: 45 | Salary: ₹60,000/month | Married, 2 kids (ages 18 and 21)
 * 
 * PROFILE: Government school teacher for 20 years. Husband runs a small 
 * tailoring business (₹30K/month, not tracked here). Conservative investor.
 * Owns a house (self-use) in Jaipur. Low cost of living.
 * Elder son (21) is in B.Com 3rd year, younger daughter (18) just starting college.
 * Expects government pension after retirement at 60.
 * Has saved slowly in PPF and FDs over the years.
 * 
 * LIFE TIMELINE:
 * Age 45 (2026) - Current: son in college, daughter starting college
 * Age 48 (2029) - Son finishes college, daughter in 3rd year
 * Age 49 (2030) - Son's wedding (₹10L)
 * Age 50 (2031) - Daughter finishes college
 * Age 52 (2033) - Daughter's wedding (₹12L)
 * Age 55 (2036) - Home renovation (₹8L)
 * Age 60 (2041) - Retires with government pension
 */

const profile = {
  id: 5, name: 'Meera', dob: '1981-07-05',
  monthly_income: 60000, currency: 'INR',
};

const assets = [
  { id: 1, category: 'SAVINGS', name: 'Bank Savings',
    current_value: 300000, expected_roi: 4, is_self_use: 0 },
  { id: 2, category: 'FD', name: 'Fixed Deposits',
    current_value: 1000000, expected_roi: 7, is_self_use: 0 },
  { id: 3, category: 'PF', name: 'PPF',
    current_value: 800000, expected_roi: 7.1, is_self_use: 0 },
  { id: 4, category: 'PF', name: 'GPF',
    current_value: 2000000, expected_roi: 7.1, is_self_use: 0 },
  { id: 5, category: 'GOLD', name: 'Gold Jewelry',
    current_value: 400000, expected_roi: 8, is_self_use: 0,
    gold_silver_unit: 'GRAMS', gold_silver_quantity: 50 },
  { id: 6, category: 'REAL_ESTATE', name: 'House in Jaipur',
    current_value: 6000000, expected_roi: 4, is_self_use: 1 },
];

const expenses = [
  // ── CURRENT RECURRING ──
  { id: 1, name: 'Food & Groceries', category: 'GROCERIES', amount: 8000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  { id: 2, name: 'Utilities & Gas', category: 'OTHERS', amount: 5000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 3, name: 'Transport (scooter)', category: 'TRANSPORT', amount: 3000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 4, name: 'Medical', category: 'MEDICAL', amount: 20000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 8 },
  { id: 5, name: 'Insurance (health)', category: 'INSURANCE', amount: 25000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  { id: 6, name: 'Clothing & Personal', category: 'OTHERS', amount: 3000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 7, name: 'Temple donations & festivals', category: 'OTHERS', amount: 2000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 4 },
  // Son college fees (2 more years: 2026,2027)
  { id: 8, name: 'Son College Fees (B.Com)', category: 'EDUCATION', amount: 80000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: '2027-05-31', inflation_rate: 8 },
  // Daughter college fees (4 years: 2026-2030)
  { id: 9, name: 'Daughter College Fees', category: 'EDUCATION', amount: 120000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: '2030-05-31', inflation_rate: 8 },
  // Kids pocket money & expenses
  { id: 10, name: 'Kids Allowance & Misc', category: 'OTHERS', amount: 5000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: '2031-12-31', inflation_rate: 5 },

  // ── FUTURE ONE-TIME ──
  { id: 11, name: 'Son Wedding', category: 'EVENTS', amount: 1000000,
    expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2030-11-01', end_date: null, inflation_rate: 7 },
  { id: 12, name: 'Daughter Wedding', category: 'EVENTS', amount: 1200000,
    expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2033-02-01', end_date: null, inflation_rate: 7 },
  { id: 13, name: 'Home Renovation', category: 'OTHERS', amount: 800000,
    expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2036-01-01', end_date: null, inflation_rate: 6 },
  { id: 14, name: 'Pilgrimage Trip (Char Dham)', category: 'OTHERS', amount: 200000,
    expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2042-01-01', end_date: null, inflation_rate: 7 },

  // ── FUTURE RECURRING ──
  // House maintenance (increases as house ages)
  { id: 15, name: 'House Maintenance', category: 'RENT', amount: 2000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2030-01-01', end_date: null, inflation_rate: 6 },
  // Additional medical as she ages (from 55 onwards, ₹10K/quarter)
  { id: 16, name: 'Additional Medical (age 55+)', category: 'MEDICAL', amount: 10000,
    expense_type: 'FUTURE_RECURRING', frequency: 'QUARTERLY',
    start_date: '2036-01-01', end_date: null, inflation_rate: 8 },
];

const goals = {
  retirement_age: 60, sip_stop_age: 60,
  pension_income: 40000,  // Government pension ₹40K/month
};

module.exports = {
  name: 'Meera — Govt Teacher, Jaipur (Age 45)',
  description: 'Government employee, modest salary (₹60K), 2 kids finishing college, weddings coming up. Has govt pension ₹40K/month. Conservative investor.',
  profile, assets, expenses, goals,
  sipAmount: 10000,
  sipReturnRate: 9,
  postSipReturnRate: 6,
  stepUpRate: 5,
};
