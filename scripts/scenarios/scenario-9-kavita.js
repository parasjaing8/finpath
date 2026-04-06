/**
 * Scenario 9: Kavita — 33-yr-old Single Mother, Nagpur
 * =====================================================
 * Age: 33 | Salary: ₹65,000/month | Divorced, 1 child (age 5)
 *
 * PROFILE: Mid-level HR manager in a manufacturing company. Divorced at 30,
 * custody of 5-year-old daughter. Alimony received ₹10K/month (not modelled as
 * salary). Renting 2BHK. No PF from earlier company (private). Very cautious
 * about taking risk — invested in FDs and gold. Parents in Nagpur (support
 * system but also aging parents to care for).
 *
 * EDGE CASES TESTED:
 * - Single parent = single income, entire household on one salary
 * - Gold as an asset (appreciates at 10%)
 * - No EMI currently (renting)
 * - High medical expenses from age 55 (aging parents care)
 * - Conservative returns (10% pre, 7% post)
 * - Late start to proper SIP (started only 2 yrs ago)
 * - Slim FIRE mode (cover only till 85 — she's realistic)
 * - Moderate pension target (₹20K/month) for basic lifestyle
 *
 * LIFE TIMELINE:
 * Age 33 (2026) - Current: renting ₹14K, single parent
 * Age 35 (2028) - Daughter starts school
 * Age 38 (2031) - Buys small flat (₹45L, EMI ₹30K x 15 yrs)
 * Age 47 (2040) - Daughter starts college
 * Age 51 (2044) - Daughter college done, EMI ends
 * Age 53 (2046) - Parents start needing care
 * Age 58 (2051) - Retire (target)
 */

const profile = {
  id: 9, name: 'Kavita', dob: '1993-02-28',
  monthly_income: 65000, currency: 'INR',
};

const assets = [
  { id: 1, category: 'SAVINGS', name: 'FD + Savings',
    current_value: 600000, expected_roi: 6.5, is_self_use: 0 },
  { id: 2, category: 'GOLD', name: 'Gold Jewellery',
    current_value: 300000, expected_roi: 10, is_self_use: 0 },
  { id: 3, category: 'MUTUAL_FUND', name: 'Debt + Balanced Funds',
    current_value: 150000, expected_roi: 10, is_self_use: 0 },
];

const expenses = [
  // ── CURRENT RECURRING ──
  { id: 1, name: 'Rent (2BHK Nagpur)', category: 'RENT', amount: 14000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: '2031-06-30', inflation_rate: 6 },
  { id: 2, name: 'Groceries + Household', category: 'GROCERIES', amount: 10000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  { id: 3, name: 'Transport (scooty fuel)', category: 'TRANSPORT', amount: 3000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 4, name: 'Utilities & Internet', category: 'OTHERS', amount: 3500,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  { id: 5, name: 'Kid Monthly (age 5)', category: 'OTHERS', amount: 5000,
    expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: '2049-06-30', inflation_rate: 7 },
  { id: 6, name: 'Health Insurance (self + kid)', category: 'INSURANCE', amount: 25000,
    expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 8 },

  // ── FUTURE RECURRING ──
  // Kid school age 35-47
  { id: 7, name: 'Kid School Fees', category: 'EDUCATION', amount: 80000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2028-06-01', end_date: '2040-05-31', inflation_rate: 10 },
  // Flat EMI from age 38 to 53
  { id: 8, name: 'Flat EMI', category: 'EMI', amount: 30000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2031-07-01', end_date: '2046-06-30', inflation_rate: 0 },
  // Society after flat
  { id: 9, name: 'Society Maintenance', category: 'RENT', amount: 2000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2031-07-01', end_date: null, inflation_rate: 5 },
  // Kid college age 47-51
  { id: 10, name: 'Kid College', category: 'EDUCATION', amount: 300000,
    expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2040-06-01', end_date: '2044-05-31', inflation_rate: 10 },
  // Parent care from age 53
  { id: 11, name: 'Aging Parent Care', category: 'MEDICAL', amount: 8000,
    expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2046-01-01', end_date: '2070-12-31', inflation_rate: 8 },
];

const goals = {
  retirement_age: 58, sip_stop_age: 55,
  pension_income: 20000,  // modest ₹20K/month target
  fire_type: 'slim', fire_target_age: 100, withdrawal_rate: 7,
};

module.exports = {
  name: 'Kavita — Single Mother, Nagpur (Age 33)',
  description: 'Divorced HR manager, ₹65K salary, 1 kid, gold + FD heavy, Slim FIRE (85), ₹20K pension, SIP stops at 55.',
  profile, assets, expenses, goals,
  sipAmount: 12000,
  sipReturnRate: 10,
  postSipReturnRate: 7,
  stepUpRate: 5,
};
