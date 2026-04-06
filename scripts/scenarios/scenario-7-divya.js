/**
 * Scenario 7: Divya — 24-yr-old CA, Chennai
 * ==========================================
 * Age: 24 | Salary: ₹90,000/month | Single, lives with parents
 *
 * PROFILE: Newly qualified Chartered Accountant at Big-4 firm. Good salary
 * for age. Conservative investor (FDs, PPF, some mutual funds). Tamil Brahmin
 * family — parents will fund her wedding. Plans: independent flat at 26,
 * arranged marriage at 27-28, 1 child. No pension target — wants corpus only.
 *
 * EDGE CASES TESTED:
 * - Single child (not 2) — tests low education cost scenario
 * - No car (uses Rapido/auto) — transport is low
 * - Parental financial support for wedding (low wedding expense)
 * - Very high savings rate (₹40K SIP on ₹90K salary = 44%)
 * - No step-up (salary grows slowly as CA in firm)
 * - Conservative return expectations (11% pre-ret, 7.5% post-ret)
 *
 * LIFE TIMELINE:
 * Age 24 (2026) - Current: lives with parents
 * Age 26 (2028) - Rents 1BHK in Chennai (₹14K/month)
 * Age 27 (2029) - Gets married (₹3L from parents, ₹2L own)
 * Age 28 (2030) - Buys flat (₹65L, EMI ₹42K x 20 yrs)
 * Age 29 (2031) - Child born
 * Age 35 (2037) - Kid starts school
 * Age 47 (2049) - Kid starts college
 * Age 48 (2050) - Flat EMI ends
 * Age 52 (2054) - Kid college done
 * Age 55 (2057) - Retire
 */

const profile = {
  id: 7, name: 'Divya', dob: '2002-03-15',
  monthly_income: 90000, currency: 'INR',
};

const assets = [
  { id: 1, category: 'SAVINGS', name: 'Savings + FD',
    current_value: 250000, expected_roi: 6.5, is_self_use: 0 },
  { id: 2, category: 'PF', name: 'PPF Account',
    current_value: 80000, expected_roi: 7.1, is_self_use: 0 },
  { id: 3, category: 'MUTUAL_FUND', name: 'Balanced Fund',
    current_value: 120000, expected_roi: 11, is_self_use: 0 },
];

const expenses = [
  // ── CURRENT RECURRING ──
  { id: 1, name: 'Personal & Clothing', category: 'OTHERS', amount: 5000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 2, name: 'Food (eating out/home)', category: 'GROCERIES', amount: 4000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  { id: 3, name: 'Transport (auto/Rapido)', category: 'TRANSPORT', amount: 3000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 4, name: 'Phone & Internet', category: 'OTHERS', amount: 1500,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 4 },
  { id: 5, name: 'Term + Health Insurance', category: 'INSURANCE', amount: 30000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 7 },
  { id: 6, name: 'Professional Development', category: 'EDUCATION', amount: 20000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: '2032-12-31', inflation_rate: 5 },

  // ── FUTURE ONE-TIME ──
  { id: 7, name: 'Wedding (own share)', category: 'EVENTS', amount: 200000,
    expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2029-02-01', end_date: null, inflation_rate: 7 },

  // ── FUTURE RECURRING ──
  // Rent age 26-28 (stops on flat)
  { id: 8, name: 'Rent (1BHK Chennai)', category: 'RENT', amount: 14000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2028-01-01', end_date: '2030-06-30', inflation_rate: 6 },
  { id: 9, name: 'Groceries (own place)', category: 'GROCERIES', amount: 6000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2028-01-01', end_date: null, inflation_rate: 6 },
  // Flat EMI age 28-48
  { id: 10, name: 'Flat EMI', category: 'EMI', amount: 42000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2030-07-01', end_date: '2050-06-30', inflation_rate: 0 },
  // Society maintenance
  { id: 11, name: 'Society Maintenance', category: 'RENT', amount: 2500,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2030-07-01', end_date: null, inflation_rate: 5 },
  // Kid expenses from age 29
  { id: 12, name: 'Kid Monthly', category: 'OTHERS', amount: 6000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2031-06-01', end_date: '2055-06-30', inflation_rate: 7 },
  // Kid school age 35-47
  { id: 13, name: 'Kid School Fees (CBSE)', category: 'EDUCATION', amount: 150000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2037-06-01', end_date: '2049-05-31', inflation_rate: 10 },
  // Kid college age 47-51
  { id: 14, name: 'Kid College (engineering)', category: 'EDUCATION', amount: 400000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2049-06-01', end_date: '2053-05-31', inflation_rate: 10 },
];

const goals = {
  retirement_age: 55, sip_stop_age: 50,
  pension_income: 0,
  fire_type: 'moderate', fire_target_age: 100, withdrawal_rate: 5,
};

module.exports = {
  name: 'Divya — CA, Chennai (Age 24)',
  description: 'Conservative CA, ₹90K salary, no step-up, high savings rate (44%), 1 child, SIP stops at 50, retire 55.',
  profile, assets, expenses, goals,
  sipAmount: 40000,
  sipReturnRate: 11,
  postSipReturnRate: 7.5,
  stepUpRate: 0,
};
