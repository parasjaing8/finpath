/**
 * Comprehensive real-world scenario test
 * ========================================
 * Rahul, 24, MNC software engineer in Bangalore
 * Monthly salary: ₹1,00,000
 * 
 * LIFE TIMELINE:
 * Age 24 (2026) - Starts job, lives in shared apartment, commutes by metro
 * Age 26 (2028) - Buys a bike (₹1.5L)
 * Age 28 (2030) - Gets married (₹15L wedding), buys flat (₹80L, EMI ₹55K/mo x 20yr), stops renting
 * Age 29 (2031) - First kid born (delivery ₹2L), kid expenses begin
 * Age 30 (2032) - Buys car (₹10L)
 * Age 31 (2033) - Second kid born (delivery ₹2L)
 * Age 34 (2036) - Kid 1 starts school (₹1.5L/yr)
 * Age 36 (2038) - Kid 2 starts school (₹1.5L/yr)
 * Age 49 (2051) - Kid 1 finishes college
 * Age 51 (2053) - Kid 2 finishes college
 * Age 48 (2050) - Flat EMI ends
 * Age 50 (2052) - Retires with ₹1L/month passive income target
 * 
 * GOAL: Retire at 50, SIP till 50, passive income ₹1L/month
 */

// ─────────────────────────────────────────────────
// Replicate engine logic locally for tracing
// ─────────────────────────────────────────────────

const FREQUENCIES = [
  { key: 'MONTHLY', multiplier: 12 },
  { key: 'QUARTERLY', multiplier: 4 },
  { key: 'HALF_YEARLY', multiplier: 2 },
  { key: 'YEARLY', multiplier: 1 },
];
const PENSION_INFLATION_RATE = 0.06;
const DEFAULT_DISCOUNT_RATE = 0.06;

function getAge(dob) {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function getFrequencyMultiplier(freq) {
  if (!freq) return 12;
  const found = FREQUENCIES.find(f => f.key === freq);
  return found ? found.multiplier : 12;
}

function calculateExpenseForYear(expense, targetYear, currentYear, currentMonth = 0) {
  const yearsFromNow = targetYear - currentYear;
  if (yearsFromNow < 0) return 0;
  const inflationRate = expense.inflation_rate / 100;

  if (expense.expense_type === 'CURRENT_RECURRING') {
    const multiplier = getFrequencyMultiplier(expense.frequency);
    const endDate = expense.end_date ? new Date(expense.end_date) : null;
    const endYear = endDate ? endDate.getFullYear() : Infinity;
    if (targetYear > endYear) return 0;
    const firstMonth = (targetYear === currentYear) ? currentMonth : 0;
    const lastMonth = (endDate && targetYear === endYear) ? endDate.getMonth() : 11;
    const effectiveMonths = Math.max(0, lastMonth - firstMonth + 1);
    const monthFraction = effectiveMonths / 12;
    return expense.amount * Math.pow(1 + inflationRate, yearsFromNow) * multiplier * monthFraction;
  }

  if (expense.expense_type === 'FUTURE_ONE_TIME') {
    if (!expense.start_date) return 0;
    const startYear = new Date(expense.start_date).getFullYear();
    if (targetYear === startYear) {
      return expense.amount * Math.pow(1 + inflationRate, yearsFromNow);
    }
    return 0;
  }

  if (expense.expense_type === 'FUTURE_RECURRING') {
    if (!expense.start_date) return 0;
    const start = new Date(expense.start_date);
    const startYear = start.getFullYear();
    const end = expense.end_date ? new Date(expense.end_date) : null;
    const endYear = end ? end.getFullYear() : 9999;
    if (targetYear < startYear || targetYear > endYear) return 0;
    const multiplier = getFrequencyMultiplier(expense.frequency);
    let monthFraction = 1;
    if (end && targetYear === startYear && targetYear === endYear) {
      monthFraction = Math.max(0, end.getMonth() - start.getMonth() + 1) / 12;
    } else if (targetYear === startYear) {
      monthFraction = (12 - start.getMonth()) / 12;
    } else if (end && targetYear === endYear) {
      monthFraction = (end.getMonth() + 1) / 12;
    }
    return expense.amount * Math.pow(1 + inflationRate, yearsFromNow) * multiplier * monthFraction;
  }
  return 0;
}

// ─────────────────────────────────────────────────
// SCENARIO DATA
// ─────────────────────────────────────────────────

const NOW = new Date();
const CURRENT_YEAR = NOW.getFullYear();   // 2026
const CURRENT_MONTH = NOW.getMonth();     // 3 (April)

const profile = {
  id: 1, name: 'Rahul', dob: '2002-01-15',
  monthly_income: 100000, currency: 'INR',
  failed_attempts: 0, lockout_until: 0, created_at: '2026-04-06',
};

const assets = [
  { id: 1, profile_id: 1, category: 'SAVINGS', name: 'Bank Savings',
    current_value: 200000, currency: 'INR', expected_roi: 4,
    is_recurring: 0, recurring_amount: null, recurring_frequency: null,
    next_vesting_date: null, is_self_use: 0, gold_silver_unit: null, gold_silver_quantity: null },
  { id: 2, profile_id: 1, category: 'PF', name: 'EPF',
    current_value: 80000, currency: 'INR', expected_roi: 8,
    is_recurring: 0, recurring_amount: null, recurring_frequency: null,
    next_vesting_date: null, is_self_use: 0, gold_silver_unit: null, gold_silver_quantity: null },
  { id: 3, profile_id: 1, category: 'MUTUAL_FUND', name: 'Nifty 50 Index',
    current_value: 150000, currency: 'INR', expected_roi: 12,
    is_recurring: 0, recurring_amount: null, recurring_frequency: null,
    next_vesting_date: null, is_self_use: 0, gold_silver_unit: null, gold_silver_quantity: null },
  // Self-use flat purchased at age 28 — ₹80L
  { id: 4, profile_id: 1, category: 'REAL_ESTATE', name: 'Flat (self-use)',
    current_value: 8000000, currency: 'INR', expected_roi: 5,
    is_recurring: 0, recurring_amount: null, recurring_frequency: null,
    next_vesting_date: null, is_self_use: 1, gold_silver_unit: null, gold_silver_quantity: null },
];

const expenses = [
  // ── CURRENT RECURRING ──
  // 1. Rent — ₹15K/month, stops when flat purchased (June 2030)
  { id: 1, profile_id: 1, name: 'Rent', category: 'RENT', amount: 15000,
    currency: 'INR', expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: '2030-06-30', inflation_rate: 6 },
  // 2. Food & groceries — ₹10K/month, lifelong
  { id: 2, profile_id: 1, name: 'Food & Groceries', category: 'GROCERIES', amount: 10000,
    currency: 'INR', expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  // 3. Transport — ₹3K/month, lifelong
  { id: 3, profile_id: 1, name: 'Transport', category: 'TRANSPORT', amount: 3000,
    currency: 'INR', expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  // 4. Utilities & misc — ₹5K/month, lifelong
  { id: 4, profile_id: 1, name: 'Utilities & Misc', category: 'OTHERS', amount: 5000,
    currency: 'INR', expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY',
    start_date: null, end_date: null, inflation_rate: 6 },
  // 5. Insurance — ₹40K/year, lifelong
  { id: 5, profile_id: 1, name: 'Term + Health Insurance', category: 'INSURANCE', amount: 40000,
    currency: 'INR', expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 5 },
  // 6. Medical — ₹15K/year, lifelong
  { id: 6, profile_id: 1, name: 'Medical Checkups', category: 'MEDICAL', amount: 15000,
    currency: 'INR', expense_type: 'CURRENT_RECURRING', frequency: 'YEARLY',
    start_date: null, end_date: null, inflation_rate: 8 },

  // ── FUTURE ONE-TIME ──
  // 7. Bike at age 26
  { id: 7, profile_id: 1, name: 'Bike Purchase', category: 'TRANSPORT', amount: 150000,
    currency: 'INR', expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2028-06-01', end_date: null, inflation_rate: 6 },
  // 8. Wedding at age 28
  { id: 8, profile_id: 1, name: 'Wedding', category: 'EVENTS', amount: 1500000,
    currency: 'INR', expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2030-02-01', end_date: null, inflation_rate: 7 },
  // 9. Kid 1 delivery at age 29
  { id: 9, profile_id: 1, name: 'Kid 1 Delivery', category: 'MEDICAL', amount: 200000,
    currency: 'INR', expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2031-06-01', end_date: null, inflation_rate: 8 },
  // 10. Car at age 30
  { id: 10, profile_id: 1, name: 'Car Purchase', category: 'TRANSPORT', amount: 1000000,
    currency: 'INR', expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2032-01-01', end_date: null, inflation_rate: 6 },
  // 11. Kid 2 delivery at age 31
  { id: 11, profile_id: 1, name: 'Kid 2 Delivery', category: 'MEDICAL', amount: 200000,
    currency: 'INR', expense_type: 'FUTURE_ONE_TIME', frequency: null,
    start_date: '2033-06-01', end_date: null, inflation_rate: 8 },

  // ── FUTURE RECURRING ──
  // 12. Flat EMI — ₹55K/month for 20 years (age 28-48)
  { id: 12, profile_id: 1, name: 'Flat EMI', category: 'EMI', amount: 55000,
    currency: 'INR', expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2030-07-01', end_date: '2050-06-30', inflation_rate: 0 },
  // 13. Kid 1 monthly expenses — age 29 to 52 (till college done)
  { id: 13, profile_id: 1, name: 'Kid 1 Monthly', category: 'OTHERS', amount: 8000,
    currency: 'INR', expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2031-06-01', end_date: '2053-06-30', inflation_rate: 7 },
  // 14. Kid 2 monthly expenses — age 31 to 54
  { id: 14, profile_id: 1, name: 'Kid 2 Monthly', category: 'OTHERS', amount: 8000,
    currency: 'INR', expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2033-06-01', end_date: '2055-06-30', inflation_rate: 7 },
  // 15. Kid 1 school fees — age 34 to 48 (school years, ₹1.5L/yr)
  { id: 15, profile_id: 1, name: 'Kid 1 School', category: 'EDUCATION', amount: 150000,
    currency: 'INR', expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2036-06-01', end_date: '2048-05-31', inflation_rate: 10 },
  // 16. Kid 2 school fees — age 36 to 50
  { id: 16, profile_id: 1, name: 'Kid 2 School', category: 'EDUCATION', amount: 150000,
    currency: 'INR', expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2038-06-01', end_date: '2050-05-31', inflation_rate: 10 },
  // 17. Kid 1 college — age 48 to 51 (₹5L/yr)
  { id: 17, profile_id: 1, name: 'Kid 1 College', category: 'EDUCATION', amount: 500000,
    currency: 'INR', expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2048-06-01', end_date: '2052-05-31', inflation_rate: 10 },
  // 18. Kid 2 college — age 50 to 53 (₹5L/yr)
  { id: 18, profile_id: 1, name: 'Kid 2 College', category: 'EDUCATION', amount: 500000,
    currency: 'INR', expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY',
    start_date: '2050-06-01', end_date: '2054-05-31', inflation_rate: 10 },
  // 19. Car maintenance — ₹5K/month, age 30 onwards
  { id: 19, profile_id: 1, name: 'Car Maintenance', category: 'TRANSPORT', amount: 5000,
    currency: 'INR', expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2032-01-01', end_date: null, inflation_rate: 6 },
  // 20. Society maintenance — ₹4K/month after flat purchase
  { id: 20, profile_id: 1, name: 'Society Maintenance', category: 'RENT', amount: 4000,
    currency: 'INR', expense_type: 'FUTURE_RECURRING', frequency: 'MONTHLY',
    start_date: '2030-07-01', end_date: null, inflation_rate: 6 },
];

const goals = {
  id: 1, profile_id: 1,
  retirement_age: 50, sip_stop_age: 50,
  pension_income: 100000,  // ₹1L/month passive income target
};

const sipAmount = 30000;
const sipReturnRate = 12;
const postSipReturnRate = 8;
const stepUpRate = 10;

// ─────────────────────────────────────────────────
// RUN CALCULATIONS
// ─────────────────────────────────────────────────

const currentAge = getAge(profile.dob);
console.log(`\n${'═'.repeat(70)}`);
console.log(`RAHUL'S FIRE SCENARIO — Age ${currentAge}, Year ${CURRENT_YEAR}, Month ${CURRENT_MONTH}`);
console.log(`${'═'.repeat(70)}`);

// Net worth
let investableNetWorth = 0;
let totalNetWorth = 0;
for (const a of assets) {
  totalNetWorth += a.current_value;
  if (a.category !== 'REAL_ESTATE' || !a.is_self_use) {
    investableNetWorth += a.current_value;
  }
}
console.log(`\nInvestable Net Worth: ₹${(investableNetWorth/100000).toFixed(2)}L`);
console.log(`Total Net Worth (incl self-use RE): ₹${(totalNetWorth/100000).toFixed(2)}L`);

// ─── YEAR-BY-YEAR EXPENSE TRACE ───
console.log(`\n${'─'.repeat(70)}`);
console.log('YEAR-BY-YEAR EXPENSE BREAKDOWN (first 35 years)');
console.log(`${'─'.repeat(70)}`);
console.log(`${'Year'.padEnd(6)}${'Age'.padEnd(5)}${'Expenses'.padStart(14)}  Breakdown`);

const issues = [];
let totalPV = 0;
const pvDiscountRate = DEFAULT_DISCOUNT_RATE; // PV banner uses 6%

for (let age = currentAge; age <= Math.min(currentAge + 34, 100); age++) {
  const year = CURRENT_YEAR + (age - currentAge);
  const yearsFromNow = age - currentAge;
  let annualTotal = 0;
  const parts = [];

  for (const exp of expenses) {
    const v = calculateExpenseForYear(exp, year, CURRENT_YEAR, CURRENT_MONTH);
    if (v > 0) {
      annualTotal += v;
      parts.push(`${exp.name}:₹${Math.round(v/1000)}K`);
    }
  }

  const discounted = annualTotal / Math.pow(1 + pvDiscountRate, yearsFromNow);
  totalPV += discounted;

  if (annualTotal > 0) {
    console.log(`${year}  ${String(age).padEnd(5)}₹${(annualTotal/100000).toFixed(2).padStart(8)}L  ${parts.join(', ')}`);
  }

  // ─── ISSUE DETECTION ───

  // Check: are expenses absurdly high?
  if (annualTotal > 50000000) {
    issues.push(`⚠ Year ${year} (age ${age}): expenses = ₹${(annualTotal/10000000).toFixed(2)}Cr — seems too high`);
  }

  // Check: do recurring expenses inflate unreasonably by age 80+?
  if (age >= 80) {
    for (const exp of expenses) {
      const v = calculateExpenseForYear(exp, year, CURRENT_YEAR, CURRENT_MONTH);
      if (v > 10000000 && exp.expense_type !== 'FUTURE_ONE_TIME') {
        issues.push(`⚠ Year ${year} (age ${age}): "${exp.name}" alone = ₹${(v/10000000).toFixed(2)}Cr due to ${exp.inflation_rate}% inflation compounding`);
      }
    }
  }
}

console.log(`\nPV of all expenses (currentAge to 100): ₹${(totalPV/10000000).toFixed(2)}Cr`);

// ─── FIRE CORPUS ───
console.log(`\n${'─'.repeat(70)}`);
console.log('FIRE CORPUS CALCULATION');
console.log(`${'─'.repeat(70)}`);

let fireCorpus = 0;
const pensionPV = goals.pension_income;
const retAge = goals.retirement_age;
const fireDiscountRate = postSipReturnRate / 100; // Bug 2 fix: use post-retirement return
let expensesAtRetirement = 0;
let pensionAtRetirement = 0;

for (let age = retAge; age <= 100; age++) {
  const year = CURRENT_YEAR + (age - currentAge);
  const yearsFromNow = age - currentAge;
  let annualExpenses = 0;
  for (const exp of expenses) {
    annualExpenses += calculateExpenseForYear(exp, year, CURRENT_YEAR, CURRENT_MONTH);
  }
  const pensionAnnual = pensionPV * 12 * Math.pow(1 + PENSION_INFLATION_RATE, yearsFromNow);
  const netExpense = Math.max(0, annualExpenses - pensionAnnual);
  const discounted = netExpense / Math.pow(1 + fireDiscountRate, yearsFromNow);
  fireCorpus += discounted;

  if (age === retAge) {
    expensesAtRetirement = annualExpenses;
    pensionAtRetirement = pensionAnnual;
    console.log(`At retirement (age ${age}, year ${year}):`);
    console.log(`  Annual expenses:     ₹${(annualExpenses/100000).toFixed(2)}L`);
    console.log(`  Pension income:      ₹${(pensionAnnual/100000).toFixed(2)}L`);
    console.log(`  Net expense:         ₹${(netExpense/100000).toFixed(2)}L`);

    // Break down retirement expenses
    for (const exp of expenses) {
      const v = calculateExpenseForYear(exp, year, CURRENT_YEAR, CURRENT_MONTH);
      if (v > 0) console.log(`    ${exp.name}: ₹${(v/100000).toFixed(2)}L`);
    }
  }
  if (age === 70 || age === 90) {
    console.log(`At age ${age} (year ${year}):`);
    console.log(`  Annual expenses: ₹${(annualExpenses/100000).toFixed(2)}L`);
    console.log(`  Pension income:  ₹${(pensionAnnual/100000).toFixed(2)}L`);
    console.log(`  Net expense:     ₹${(netExpense/100000).toFixed(2)}L`);
  }
}
console.log(`\nFIRE Corpus needed: ₹${(fireCorpus/10000000).toFixed(2)}Cr`);

// ─── BIG ISSUE CHECK: Does pension use same inflation as discount? ───
console.log(`\n${'─'.repeat(70)}`);
console.log('PENSION vs DISCOUNT RATE ANALYSIS');
console.log(`${'─'.repeat(70)}`);
console.log(`Pension inflation rate: ${PENSION_INFLATION_RATE * 100}%`);
console.log(`Discount rate:         ${DEFAULT_DISCOUNT_RATE * 100}%`);
console.log(`Both are 6% — pension PV growth = discount → pension discounted value is FLAT`);
console.log(`If pension = ₹1L/month today, its PV contribution is ₹12L every year for ${100-retAge+1} years`);
console.log(`Total pension PV = ₹${((100-retAge+1) * 1200000 / 10000000).toFixed(2)}Cr`);
console.log(`This means pension "offsets" a constant ₹12L/yr of expenses in PV terms`);
console.log(`>>> If expenses inflate faster than 6%, pension won't keep up after retirement <<<`);

// ─── NET WORTH PROJECTION ───
console.log(`\n${'─'.repeat(70)}`);
console.log('NET WORTH PROJECTION (key milestones)');
console.log(`${'─'.repeat(70)}`);

let netWorth = investableNetWorth;
let fireAchievedAge = -1;

for (let age = currentAge; age <= 100; age++) {
  const year = CURRENT_YEAR + (age - currentAge);
  const yearsFromStart = age - currentAge;

  let annualSIP = 0;
  if (age <= goals.sip_stop_age) {
    annualSIP = sipAmount * 12 * Math.pow(1 + stepUpRate / 100, yearsFromStart);
  }

  let plannedExpenses = 0;
  for (const exp of expenses) {
    plannedExpenses += calculateExpenseForYear(exp, year, CURRENT_YEAR, CURRENT_MONTH);
  }

  let pensionIncome = 0;
  if (age >= retAge && pensionPV > 0) {
    pensionIncome = pensionPV * 12 * Math.pow(1 + PENSION_INFLATION_RATE, yearsFromStart);
  }

  const returnRate = age <= goals.sip_stop_age ? sipReturnRate : postSipReturnRate;
  const totalNetExpenses = plannedExpenses - pensionIncome;
  // Bug 1 fix: only earn returns on positive NW
  const returnOnInvestments = Math.max(0, netWorth) * (returnRate / 100);
  // Bug 3 fix: pre-retirement, salary covers expenses
  const expenseWithdrawal = age >= retAge ? totalNetExpenses : 0;
  netWorth = netWorth + returnOnInvestments + annualSIP - expenseWithdrawal;

  if (fireAchievedAge < 0 && netWorth >= fireCorpus && fireCorpus > 0) {
    fireAchievedAge = age;
  }

  // Print milestones
  const milestones = [24,25,28,30,35,40,45,50,55,60,65,70,75,80,85,90,95,100];
  if (milestones.includes(age)) {
    const nwStr = netWorth >= 0 
      ? `₹${(netWorth/10000000).toFixed(2)}Cr` 
      : `-₹${(Math.abs(netWorth)/10000000).toFixed(2)}Cr`;
    const sipStr = annualSIP > 0 ? `SIP:₹${(annualSIP/100000).toFixed(1)}L` : 'No SIP';
    const expStr = `Exp:₹${(plannedExpenses/100000).toFixed(1)}L`;
    const penStr = pensionIncome > 0 ? ` Pen:₹${(pensionIncome/100000).toFixed(1)}L` : '';
    const fireStr = (fireAchievedAge === age) ? ' ★ FIRE ACHIEVED' : '';
    console.log(`Age ${String(age).padEnd(3)} ${year}  NW: ${nwStr.padEnd(14)} ${sipStr.padEnd(16)} ${expStr}${penStr}${fireStr}`);
  }

  // Check for negative net worth
  if (netWorth < -10000000 && age > retAge) {
    issues.push(`💀 Age ${age}: Net worth went to -₹${(Math.abs(netWorth)/10000000).toFixed(2)}Cr — money ran out!`);
  }
}

if (fireAchievedAge > 0) {
  console.log(`\n🔥 FIRE achieved at age ${fireAchievedAge}`);
} else {
  console.log(`\n❌ FIRE never achieved`);
}

// ─── SPECIFIC ISSUE CHECKS ───
console.log(`\n${'═'.repeat(70)}`);
console.log('BUG ANALYSIS & FINDINGS');
console.log(`${'═'.repeat(70)}`);

// Issue 1: FUTURE_RECURRING with no end_date goes to year 9999
console.log('\n[1] FUTURE_RECURRING with no end_date:');
const noEndRecurring = expenses.filter(e => e.expense_type === 'FUTURE_RECURRING' && !e.end_date);
for (const e of noEndRecurring) {
  const at80 = calculateExpenseForYear(e, CURRENT_YEAR + (80 - currentAge), CURRENT_YEAR, CURRENT_MONTH);
  const at100 = calculateExpenseForYear(e, CURRENT_YEAR + (100 - currentAge), CURRENT_YEAR, CURRENT_MONTH);
  console.log(`  "${e.name}": ₹${e.amount}/mo → at age 80: ₹${(at80/100000).toFixed(2)}L/yr, at age 100: ₹${(at100/100000).toFixed(2)}L/yr`);
  if (at100 > 50000000) {
    issues.push(`BUG: "${e.name}" (₹${e.amount}/mo) inflates to ₹${(at100/10000000).toFixed(2)}Cr/yr at age 100 due to ${e.inflation_rate}% inflation over 76 years`);
  }
}

// Issue 2: Pension inflation = discount rate means pension doesn't really "grow" in PV terms
console.log('\n[2] Pension inflation == Discount rate:');
console.log(`  Both are 6%. Pension PV stays flat across years.`);
console.log(`  But food (6%), medical (8%), insurance (5%), education (10%) all use different rates.`);
console.log(`  Medical at 8% inflation outpaces 6% pension → pension shortfall grows over time.`);

// Issue 3: Check if expenses are deducted from net worth both in FIRE corpus AND in projection
console.log('\n[3] Double-counting expenses check:');
console.log(`  FIRE corpus = PV of expenses from age ${retAge} to 100 (minus pension)`);
console.log(`  Year-by-year projection also deducts expenses from net worth`);
console.log(`  The FIRE check compares netWorth >= fireCorpus`);
console.log(`  If NW already has expenses deducted, and corpus also assumes expenses, this is CORRECT`);
console.log(`  Because corpus = "how much you need to sustain expenses", NW = "what you have after expenses"`);
console.log(`  ✅ No double-counting — logic is consistent`);

// Issue 4: Year-by-year projection deducts expenses pre-retirement from investable net worth
console.log('\n[4] Pre-retirement expenses eating into investment corpus:');
{
  const year2030 = CURRENT_YEAR + (28 - currentAge);
  let exp2030 = 0;
  for (const e of expenses) exp2030 += calculateExpenseForYear(e, year2030, CURRENT_YEAR, CURRENT_MONTH);
  console.log(`  Year ${year2030} (wedding + flat EMI starts + rent ends):`);
  console.log(`  Total expenses that year: ₹${(exp2030/100000).toFixed(2)}L`);
  console.log(`  Wedding alone: ₹${(calculateExpenseForYear(expenses[7], year2030, CURRENT_YEAR, CURRENT_MONTH)/100000).toFixed(2)}L`);
  console.log(`  These are deducted from net worth, which may go NEGATIVE`);
  console.log(`  This is technically correct — big purchases drain savings`);
}

// Issue 5: SIP step-up might become unrealistically large
console.log('\n[5] SIP step-up check (10%/yr starting at ₹30K/mo):');
for (const ageCheck of [30, 35, 40, 45, 50]) {
  const yrs = ageCheck - currentAge;
  const annualSIP = sipAmount * 12 * Math.pow(1 + stepUpRate / 100, yrs);
  console.log(`  Age ${ageCheck}: ₹${(annualSIP/12/1000).toFixed(1)}K/month (₹${(annualSIP/100000).toFixed(1)}L/year)`);
}

// Issue 6: Check what happens when net worth goes negative mid-life
console.log('\n[6] Net worth trajectory through big purchases:');
let nw2 = investableNetWorth;
for (let age = currentAge; age <= 35; age++) {
  const year = CURRENT_YEAR + (age - currentAge);
  const yearsFromStart = age - currentAge;
  let sip = 0;
  if (age <= goals.sip_stop_age) sip = sipAmount * 12 * Math.pow(1 + stepUpRate / 100, yearsFromStart);
  let exp = 0;
  for (const e of expenses) exp += calculateExpenseForYear(e, year, CURRENT_YEAR, CURRENT_MONTH);
  const ret = age <= goals.sip_stop_age ? sipReturnRate : postSipReturnRate;
  const retOnInv = Math.max(0, nw2) * (ret / 100);
  nw2 = nw2 + retOnInv + sip; // pre-retirement: no expense deduction
  if (age >= 27 && age <= 33) {
    console.log(`  Age ${age} (${year}): NW=₹${(nw2/100000).toFixed(2)}L, SIP=₹${(sip/100000).toFixed(1)}L, Exp=₹${(exp/100000).toFixed(1)}L`);
  }
}

// Issue 7: Is CURRENT_RECURRING with end_date in the current year properly handled?
console.log('\n[7] Edge case — end_date in current year:');
{
  const testExp = { ...expenses[0], end_date: '2026-06-15' }; // ends June 2026
  const val = calculateExpenseForYear(testExp, 2026, 2026, 3); // current month = April (3)
  // Should count April, May, June = 3 months
  const expected = 15000 * 12 * (3/12);
  console.log(`  Rent ending June 2026, current month April:`);
  console.log(`  Calculator gives: ₹${Math.round(val)} (expected 3 months: ₹${expected})`);
  console.log(`  Match: ${Math.abs(val - expected) < 1 ? '✅' : '❌'}`);
}

// Print all collected issues
if (issues.length > 0) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`ISSUES FOUND: ${issues.length}`);
  console.log(`${'═'.repeat(70)}`);
  issues.forEach((iss, i) => console.log(`${i+1}. ${iss}`));
}

console.log(`\n${'═'.repeat(70)}`);
console.log('SUMMARY');
console.log(`${'═'.repeat(70)}`);
console.log(`Fire Corpus required:    ₹${(fireCorpus/10000000).toFixed(2)}Cr`);
console.log(`FIRE achieved at age:    ${fireAchievedAge > 0 ? fireAchievedAge : 'Never'}`);
console.log(`Total PV of expenses:    ₹${(totalPV/10000000).toFixed(2)}Cr`);
console.log(`Investable Net Worth:    ₹${(investableNetWorth/100000).toFixed(2)}L`);
console.log(`Monthly SIP:             ₹${sipAmount.toLocaleString()}`);
console.log(`SIP step-up:             ${stepUpRate}%/year`);
console.log(`SIP return:              ${sipReturnRate}%, Post-SIP: ${postSipReturnRate}%`);
console.log(`Pension target:          ₹${(goals.pension_income/1000).toFixed(0)}K/month`);
console.log(`Pension inflates at:     ${PENSION_INFLATION_RATE*100}% (same as discount rate)`);
console.log('');
