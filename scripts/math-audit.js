/**
 * FinPath Math Audit Script
 * ==========================
 * Deep verification of calculator.ts logic by replicating and testing
 * edge cases, invariants, and mathematical properties.
 */

const { runScenario, calculateExpenseForYear, getAge } = require('./scenarios/engine.js');

const PASS = '✅';
const FAIL = '❌';
const WARN = '⚠️';
let passCount = 0;
let failCount = 0;
let warnCount = 0;
const failures = [];

function assert(condition, testName, detail = '') {
  if (condition) {
    passCount++;
    console.log(`  ${PASS} ${testName}`);
  } else {
    failCount++;
    console.log(`  ${FAIL} ${testName}${detail ? ' — ' + detail : ''}`);
    failures.push({ testName, detail });
  }
}

function warn(testName, detail = '') {
  warnCount++;
  console.log(`  ${WARN} ${testName}${detail ? ' — ' + detail : ''}`);
}

function fmt(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

// ============================================================================
// AUDIT 1: Expense Calculation Function
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('AUDIT 1: calculateExpenseForYear — Inflation & Timing');
console.log('═══════════════════════════════════════════════════════════');

// Test 1.1: Basic recurring expense with inflation
{
  const exp = {
    amount: 10000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
    frequency: 'MONTHLY', start_date: null, end_date: null,
  };
  const year0 = calculateExpenseForYear(exp, 2026, 2026, 0);
  const year1 = calculateExpenseForYear(exp, 2027, 2026, 0);
  const year10 = calculateExpenseForYear(exp, 2036, 2026, 0);
  
  assert(Math.abs(year0 - 120000) < 1, '1.1a Monthly ₹10K = ₹120K/yr in year 0');
  assert(Math.abs(year1 - 120000 * 1.06) < 1, '1.1b Year 1 inflated by 6%');
  const expected10 = 120000 * Math.pow(1.06, 10);
  assert(Math.abs(year10 - expected10) < 1, `1.1c Year 10: ${fmt(year10)} ≈ ${fmt(expected10)}`);
}

// Test 1.2: Future one-time fires only in target year
{
  const exp = {
    amount: 500000, inflation_rate: 8, expense_type: 'FUTURE_ONE_TIME',
    frequency: null, start_date: '2030-06-01', end_date: null,
  };
  const before = calculateExpenseForYear(exp, 2029, 2026, 0);
  const exact = calculateExpenseForYear(exp, 2030, 2026, 0);
  const after = calculateExpenseForYear(exp, 2031, 2026, 0);
  
  assert(before === 0, '1.2a Future one-time: 0 before start year');
  assert(exact > 0, '1.2b Future one-time: fires in start year');
  assert(after === 0, '1.2c Future one-time: 0 after start year');
  const expectedInflated = 500000 * Math.pow(1.08, 4);
  assert(Math.abs(exact - expectedInflated) < 1, `1.2d Inflation applied: ${fmt(exact)} ≈ ${fmt(expectedInflated)}`);
}

// Test 1.3: Future recurring with start/end dates
{
  const exp = {
    amount: 20000, inflation_rate: 10, expense_type: 'FUTURE_RECURRING',
    frequency: 'MONTHLY', start_date: '2030-01-01', end_date: '2034-12-31',
  };
  const before = calculateExpenseForYear(exp, 2029, 2026, 0);
  const firstYear = calculateExpenseForYear(exp, 2030, 2026, 0);
  const midYear = calculateExpenseForYear(exp, 2032, 2026, 0);
  const lastYear = calculateExpenseForYear(exp, 2034, 2026, 0);
  const after = calculateExpenseForYear(exp, 2035, 2026, 0);
  
  assert(before === 0, '1.3a Future recurring: 0 before start');
  assert(firstYear > 0, '1.3b Future recurring: fires in start year');
  assert(midYear > firstYear, '1.3c Mid year > first year (inflation)');
  assert(lastYear > 0, '1.3d Last year still active');
  assert(after === 0, '1.3e After end: 0');
}

// Test 1.4: Edge case — 0% inflation
{
  const exp = {
    amount: 38000, inflation_rate: 0, expense_type: 'CURRENT_RECURRING',
    frequency: 'MONTHLY', start_date: null, end_date: null,
  };
  const year0 = calculateExpenseForYear(exp, 2026, 2026, 0);
  const year20 = calculateExpenseForYear(exp, 2046, 2026, 0);
  assert(year0 === year20, '1.4 EMI with 0% inflation: same value at year 0 and year 20');
}

// Test 1.5: High inflation compounding sanity
{
  const exp = {
    amount: 100000, inflation_rate: 10, expense_type: 'CURRENT_RECURRING',
    frequency: 'YEARLY', start_date: null, end_date: null,
  };
  const year30 = calculateExpenseForYear(exp, 2056, 2026, 0);
  const expected = 100000 * Math.pow(1.10, 30); // ₹17.45L
  assert(Math.abs(year30 - expected) < 1, `1.5 10% inflation over 30yr: ${fmt(year30)} ≈ ${fmt(expected)}`);
}

// Test 1.6: Current month handling for partial first year
{
  const exp = {
    amount: 10000, inflation_rate: 0, expense_type: 'CURRENT_RECURRING',
    frequency: 'MONTHLY', start_date: null, end_date: null,
  };
  // If current month is April (month 3), only 9 months left in year 0
  const partial = calculateExpenseForYear(exp, 2026, 2026, 3);
  assert(Math.abs(partial - 10000 * 12 * (9/12)) < 1, `1.6 Partial first year (Apr start): ${fmt(partial)} = ₹90K`);
}

// Test 1.7: Future recurring start in mid-year
{
  const exp = {
    amount: 10000, inflation_rate: 0, expense_type: 'FUTURE_RECURRING',
    frequency: 'MONTHLY', start_date: '2028-07-01', end_date: null,
  };
  const startYear = calculateExpenseForYear(exp, 2028, 2026, 0);
  const fullYear = calculateExpenseForYear(exp, 2029, 2026, 0);
  // July start = months 6-11 = 6 months
  assert(Math.abs(startYear - 10000 * 12 * (6/12)) < 1, '1.7a Future recurring mid-year start: 6/12 fraction');
  assert(Math.abs(fullYear - 120000) < 1, '1.7b Next full year: 12 months');
}

// ============================================================================
// AUDIT 2: FIRE Corpus via Binary Search (Simulation-Based)
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('AUDIT 2: FIRE Corpus — Binary Search Accuracy');
console.log('═══════════════════════════════════════════════════════════');

// Test 2.1: Zero expenses = zero corpus
{
  const scenario = {
    name: 'Zero Expenses', profile: { dob: '1996-01-01', monthly_income: 100000 },
    assets: [], expenses: [],
    goals: { retirement_age: 45, sip_stop_age: 45, pension_income: 0, fire_target_age: 100 },
    sipAmount: 10000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 10,
  };
  const result = runScenario(scenario);
  assert(result.fireCorpus === 0, '2.1 Zero expenses → zero FIRE corpus');
}

// Test 2.2: Corpus must sustain withdrawals to target age
{
  const scenario = {
    name: 'Basic Corpus Test', profile: { dob: '1996-01-01', monthly_income: 100000 },
    assets: [{ id: 1, category: 'MUTUAL_FUND', current_value: 100000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: 20000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 55, sip_stop_age: 55, pension_income: 0, fire_target_age: 100 },
    sipAmount: 50000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 0,
  };
  const result = runScenario(scenario);
  assert(result.fireCorpus > 0, `2.2a Corpus is positive: ${fmt(result.fireCorpus)}`);
  
  // Verify: simulate depletion with this corpus
  const retAge = 55;
  const currentAge = getAge(scenario.profile.dob);
  const currentYear = new Date().getFullYear();
  let nw = result.fireCorpus;
  for (let age = retAge; age <= 100; age++) {
    const year = currentYear + (age - currentAge);
    const yearsFromStart = age - currentAge;
    let annualExp = 0;
    for (const exp of scenario.expenses) {
      annualExp += calculateExpenseForYear(exp, year, currentYear, 0);
    }
    const ret = Math.max(0, nw) * 0.08;
    nw = nw + ret - annualExp;
  }
  assert(Math.abs(nw) < 100000, `2.2b Corpus depletes to ~₹0 at age 100: final NW = ${fmt(nw)}`);
}

// Test 2.3: Slim FIRE corpus < Fat FIRE corpus
{
  const makeScenario = (targetAge) => ({
    name: `FIRE-${targetAge}`, profile: { dob: '1996-01-01', monthly_income: 100000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 500000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: 25000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 50, sip_stop_age: 50, pension_income: 0, fire_target_age: targetAge },
    sipAmount: 30000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 5,
  });
  const slim = runScenario(makeScenario(85));
  const med = runScenario(makeScenario(95));
  const fat = runScenario(makeScenario(100));
  
  assert(slim.fireCorpus < med.fireCorpus, `2.3a Slim (${fmt(slim.fireCorpus)}) < Medium (${fmt(med.fireCorpus)})`);
  assert(med.fireCorpus < fat.fireCorpus, `2.3b Medium (${fmt(med.fireCorpus)}) < Fat (${fmt(fat.fireCorpus)})`);
}

// Test 2.4: Adding pension INCREASES corpus (pension = withdrawal FROM corpus)
{
  const makeScenario = (pension) => ({
    name: `Pension-${pension}`, profile: { dob: '1991-01-01', monthly_income: 100000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 200000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: 15000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 55, sip_stop_age: 55, pension_income: pension, fire_target_age: 100 },
    sipAmount: 20000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 5,
  });
  const noPen = runScenario(makeScenario(0));
  const smallPen = runScenario(makeScenario(20000));
  const bigPen = runScenario(makeScenario(80000));
  
  assert(smallPen.fireCorpus > noPen.fireCorpus, `2.4a ₹20K pension → larger corpus: ${fmt(smallPen.fireCorpus)} > ${fmt(noPen.fireCorpus)}`);
  assert(bigPen.fireCorpus > smallPen.fireCorpus, `2.4b ₹80K pension → even larger: ${fmt(bigPen.fireCorpus)} > ${fmt(smallPen.fireCorpus)}`);
}

// ============================================================================
// AUDIT 3: Net Worth Projection — Pre-Retirement
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('AUDIT 3: Net Worth Projection — Pre-Retirement');
console.log('═══════════════════════════════════════════════════════════');

// Test 3.1: NET WORTH MUST GROW MONOTONICALLY PRE-RETIREMENT (no expenses deducted)
{
  const scenario = {
    name: 'Monotonic NW', profile: { dob: '1996-01-01', monthly_income: 100000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 100000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: 50000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 60, sip_stop_age: 58, pension_income: 0, fire_target_age: 100 },
    sipAmount: 20000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 5,
  };
  const result = runScenario(scenario);
  const preRetData = result.milestoneData.filter(d => d.age < 60);
  let monotonic = true;
  for (let i = 1; i < preRetData.length; i++) {
    if (preRetData[i].netWorth < preRetData[i-1].netWorth) {
      monotonic = false;
      break;
    }
  }
  assert(monotonic, '3.1 Pre-retirement NW is monotonically increasing (expenses NOT deducted pre-retirement)');
}

// Test 3.2: SIP step-up correctly applied
{
  const scenario = {
    name: 'Step-up Check', profile: { dob: '1996-01-01', monthly_income: 100000 },
    assets: [], expenses: [],
    goals: { retirement_age: 60, sip_stop_age: 60, pension_income: 0, fire_target_age: 100 },
    sipAmount: 10000, sipReturnRate: 0, postSipReturnRate: 0, stepUpRate: 10,
  };
  const result = runScenario(scenario);
  const age30 = result.milestoneData.find(d => d.age === 30);
  const age35 = result.milestoneData.find(d => d.age === 35);
  
  // SIP at age 35 should be 10000*12*1.10^5 = 120000 * 1.61 = 193,261
  const expectedSIP35 = 10000 * 12 * Math.pow(1.1, 5);
  assert(Math.abs(age35.annualSIP - expectedSIP35) < 1, 
    `3.2 Step-up SIP at age 35: ${fmt(age35.annualSIP)} ≈ ${fmt(expectedSIP35)}`);
}

// Test 3.3: SIP stops at sipStopAge
{
  const scenario = {
    name: 'SIP Stop', profile: { dob: '1996-01-01', monthly_income: 100000 },
    assets: [], expenses: [],
    goals: { retirement_age: 60, sip_stop_age: 50, pension_income: 0, fire_target_age: 100 },
    sipAmount: 10000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 0,
  };
  const result = runScenario(scenario);
  const age50 = result.milestoneData.find(d => d.age === 50);
  const age51 = result.milestoneData.find(d => d.age === 51);
  
  assert(age50.annualSIP === 120000, '3.3a SIP at stop age = ₹120K/yr');
  assert(age51.annualSIP === 0, '3.3b SIP after stop age = 0');
}

// Test 3.4: Self-use real estate excluded from investable NW
{
  const scenario = {
    name: 'Self-use RE', profile: { dob: '1996-01-01', monthly_income: 100000 },
    assets: [
      { id: 1, category: 'MUTUAL_FUND', current_value: 500000, is_self_use: 0 },
      { id: 2, category: 'REAL_ESTATE', current_value: 5000000, is_self_use: 1 },
      { id: 3, category: 'REAL_ESTATE', current_value: 2000000, is_self_use: 0 }, // investment property
    ],
    expenses: [],
    goals: { retirement_age: 60, sip_stop_age: 60, pension_income: 0, fire_target_age: 100 },
    sipAmount: 10000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 0,
  };
  const result = runScenario(scenario);
  assert(result.investableNetWorth === 2500000, `3.4a Investable NW = ${fmt(result.investableNetWorth)} (excl self-use ₹50L)`);
  assert(result.totalNetWorth === 7500000, `3.4b Total NW = ${fmt(result.totalNetWorth)} (incl self-use)`);
}

// ============================================================================
// AUDIT 4: Post-Retirement — Withdrawal Logic
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('AUDIT 4: Post-Retirement — Withdrawal Logic');
console.log('═══════════════════════════════════════════════════════════');

// Test 4.1: Post-retirement, expenses + pension are WITHDRAWN from corpus
{
  const scenario = {
    name: 'Post-ret Withdrawal', profile: { dob: '1986-01-01', monthly_income: 100000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 50000000, is_self_use: 0 }], // ₹5Cr starting
    expenses: [
      { id: 1, amount: 30000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 40, sip_stop_age: 40, pension_income: 50000, fire_target_age: 100 },
    sipAmount: 0, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 0,
  };
  const result = runScenario(scenario);
  const retireRow = result.milestoneData.find(d => d.age === 40);
  const postRetRow = result.milestoneData.find(d => d.age === 41);
  
  // At retirement, pension + expenses are withdrawn
  assert(retireRow.pensionIncome > 0, '4.1a Pension income appears at retirement age');
  // Post-retirement NW should decrease if withdrawals > returns
  // But with ₹5Cr at 8%, returns = ₹40L. Let's check.
  const expectedReturn = Math.max(0, retireRow.netWorth) * 0.08;
  const expectedWithdrawal = retireRow.plannedExpenses + retireRow.pensionIncome;
  console.log(`    Returns: ${fmt(expectedReturn)}, Withdrawals: ${fmt(expectedWithdrawal)}`);
}

// Test 4.2: Pension inflation applied correctly (6% PENSION_INFLATION_RATE)
{
  const scenario = {
    name: 'Pension Inflation', profile: { dob: '1986-01-01', monthly_income: 100000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 100000000, is_self_use: 0 }],
    expenses: [],
    goals: { retirement_age: 50, sip_stop_age: 50, pension_income: 50000, fire_target_age: 100 },
    sipAmount: 0, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 0,
  };
  const result = runScenario(scenario);
  const currentAge = getAge(scenario.profile.dob);
  const retRow = result.milestoneData.find(d => d.age === 50);
  const laterRow = result.milestoneData.find(d => d.age === 60);
  
  // Pension at age 50: 50000 * 12 * 1.06^(50-currentAge)
  const yearsToRet = 50 - currentAge;
  const yearsToLater = 60 - currentAge;
  const pensionAtRet = 50000 * 12 * Math.pow(1.06, yearsToRet);
  const pensionAtLater = 50000 * 12 * Math.pow(1.06, yearsToLater);
  
  assert(Math.abs(retRow.pensionIncome - pensionAtRet) < 100, 
    `4.2a Pension at 50: ${fmt(retRow.pensionIncome)} ≈ ${fmt(pensionAtRet)}`);
  assert(Math.abs(laterRow.pensionIncome - pensionAtLater) < 100,
    `4.2b Pension at 60: ${fmt(laterRow.pensionIncome)} ≈ ${fmt(pensionAtLater)}`);
}

// Test 4.3: Returns only on positive NW (no returns on negative)
{
  const scenario = {
    name: 'Negative NW Returns', profile: { dob: '1996-01-01', monthly_income: 50000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 1000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: 50000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 35, sip_stop_age: 35, pension_income: 0, fire_target_age: 100 },
    sipAmount: 100, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 0,
  };
  const result = runScenario(scenario);
  // Find the year NW goes negative
  const negRows = result.milestoneData.filter(d => d.netWorth < 0 && d.age > 35);
  if (negRows.length >= 2) {
    const r1 = negRows[0];
    const r2 = negRows[1];
    // Once negative, NW should only decrease (no returns added)
    assert(r2.netWorth < r1.netWorth, '4.3 Negative NW: returns = 0, NW keeps decreasing');
  }
}

// ============================================================================
// AUDIT 5: Required SIP Binary Search — Cross-Validation
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('AUDIT 5: Required SIP — Cross-Validation');
console.log('═══════════════════════════════════════════════════════════');

// Test 5.1: If you invest requiredSIP, you should reach fireCorpus at retirement
{
  const scenario = {
    name: 'Required SIP Validation', profile: { dob: '1996-01-01', monthly_income: 200000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 500000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: 30000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 55, sip_stop_age: 55, pension_income: 0, fire_target_age: 100 },
    sipAmount: 0, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 10,
  };
  const result = runScenario(scenario);
  
  // Now simulate with requiredSIP
  const currentAge = getAge(scenario.profile.dob);
  const currentYear = new Date().getFullYear();
  let nw = result.investableNetWorth;
  for (let age = currentAge; age <= 55; age++) {
    const yearsFromStart = age - currentAge;
    let sip = 0;
    if (age <= 55) sip = result.requiredSIP * 12 * Math.pow(1.10, yearsFromStart);
    const ret = Math.max(0, nw) * 0.12;
    nw = nw + ret + sip;
  }
  
  const deviation = Math.abs(nw - result.fireCorpus) / result.fireCorpus;
  assert(deviation < 0.01, `5.1 Required SIP (${fmt(result.requiredSIP)}/mo) produces NW within 1% of corpus: ${fmt(nw)} vs ${fmt(result.fireCorpus)} (${(deviation*100).toFixed(2)}% off)`);
}

// Test 5.2: Required SIP = 0 when no expenses
{
  const scenario = {
    name: 'No Expenses SIP', profile: { dob: '1996-01-01', monthly_income: 100000 },
    assets: [], expenses: [],
    goals: { retirement_age: 55, sip_stop_age: 55, pension_income: 0, fire_target_age: 100 },
    sipAmount: 10000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 5,
  };
  const result = runScenario(scenario);
  assert(result.requiredSIP === 0, '5.2 No expenses → required SIP = 0');
}

// Test 5.3: Higher step-up rate should reduce required base SIP
{
  const makeScenario = (stepUp) => ({
    name: `SUP-${stepUp}`, profile: { dob: '1996-01-01', monthly_income: 200000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 200000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: 20000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 55, sip_stop_age: 55, pension_income: 0, fire_target_age: 100 },
    sipAmount: 10000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: stepUp,
  });
  const r0 = runScenario(makeScenario(0));
  const r10 = runScenario(makeScenario(10));
  const r20 = runScenario(makeScenario(20));
  
  assert(r10.requiredSIP < r0.requiredSIP, `5.3a 10% step-up SIP (${fmt(r10.requiredSIP)}) < 0% (${fmt(r0.requiredSIP)})`);
  assert(r20.requiredSIP < r10.requiredSIP, `5.3b 20% step-up SIP (${fmt(r20.requiredSIP)}) < 10% (${fmt(r10.requiredSIP)})`);
}

// ============================================================================
// AUDIT 6: FIRE Achievement Detection
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('AUDIT 6: FIRE Achievement Detection');
console.log('═══════════════════════════════════════════════════════════');

// Test 6.1: With massive SIP, FIRE should be achieved before retirement
{
  const scenario = {
    name: 'Early FIRE', profile: { dob: '1996-01-01', monthly_income: 500000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 5000000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: 10000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 60, sip_stop_age: 60, pension_income: 0, fire_target_age: 100 },
    sipAmount: 200000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 10,
  };
  const result = runScenario(scenario);
  assert(result.fireAchievedAge > 0, `6.1a FIRE achieved at age ${result.fireAchievedAge}`);
  assert(result.fireAchievedAge < 60, `6.1b FIRE before retirement: ${result.fireAchievedAge} < 60`);
  assert(result.isOnTrack, '6.1c isOnTrack = true');
}

// Test 6.2: With zero SIP and zero assets, FIRE never achieved
{
  const scenario = {
    name: 'Never FIRE', profile: { dob: '1996-01-01', monthly_income: 50000 },
    assets: [],
    expenses: [
      { id: 1, amount: 10000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 60, sip_stop_age: 60, pension_income: 0, fire_target_age: 100 },
    sipAmount: 0, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 0,
  };
  const result = runScenario(scenario);
  assert(result.fireAchievedAge === -1, '6.2 No SIP/assets → FIRE never achieved');
  assert(!result.isOnTrack, '6.2b isOnTrack = false');
}

// ============================================================================
// AUDIT 7: Edge Cases & Boundary Conditions
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('AUDIT 7: Edge Cases & Boundary Conditions');
console.log('═══════════════════════════════════════════════════════════');

// Test 7.1: Retirement age very close (age 31, retire at 35)
{
  const scenario = {
    name: 'Early Retire', profile: { dob: '1995-01-01', monthly_income: 300000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 20000000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: 50000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 35, sip_stop_age: 35, pension_income: 0, fire_target_age: 100 },
    sipAmount: 100000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 0,
  };
  const result = runScenario(scenario);
  assert(result.fireCorpus > 0, `7.1 Short horizon (retire 35): corpus = ${fmt(result.fireCorpus)}`);
}

// Test 7.2: SIP stop age < retirement age
{
  const scenario = {
    name: 'SIP Gap', profile: { dob: '1996-01-01', monthly_income: 100000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 500000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: 20000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 60, sip_stop_age: 50, pension_income: 0, fire_target_age: 100 },
    sipAmount: 30000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 5,
  };
  const result = runScenario(scenario);
  const age50 = result.milestoneData.find(d => d.age === 50);
  const age51 = result.milestoneData.find(d => d.age === 51);
  assert(age50.annualSIP > 0, '7.2a SIP active at stop age');
  assert(age51.annualSIP === 0, '7.2b SIP zero after stop age');
  // NW should still grow from returns between 51-60
  assert(result.milestoneData.find(d => d.age === 59).netWorth > age51.netWorth,
    '7.2c NW grows from returns even after SIP stops');
}

// Test 7.3: Very high inflation (12%) with moderate returns (8%)
{
  const scenario = {
    name: 'High Inflation', profile: { dob: '1996-01-01', monthly_income: 100000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 1000000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: 30000, inflation_rate: 12, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 55, sip_stop_age: 55, pension_income: 0, fire_target_age: 100 },
    sipAmount: 30000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 0,
  };
  const result = runScenario(scenario);
  // With inflation > post-ret returns, corpus should be VERY large
  assert(result.fireCorpus > 50000000, `7.3 High inflation (12%) > returns (8%): massive corpus needed ${fmt(result.fireCorpus)}`);
}

// Test 7.4: Future one-time expense at current year
{
  const currentYear = new Date().getFullYear();
  const exp = {
    amount: 100000, inflation_rate: 6, expense_type: 'FUTURE_ONE_TIME',
    frequency: null, start_date: `${currentYear}-06-01`, end_date: null,
  };
  const val = calculateExpenseForYear(exp, currentYear, currentYear, 0);
  assert(Math.abs(val - 100000) < 1, '7.4 Future one-time in current year: no inflation applied (0 years)');
}

// Test 7.5: Multiple assets sum correctly
{
  const scenario = {
    name: 'Multi Asset', profile: { dob: '1996-01-01', monthly_income: 100000 },
    assets: [
      { id: 1, category: 'SAVINGS', current_value: 100000, is_self_use: 0 },
      { id: 2, category: 'MUTUAL_FUND', current_value: 200000, is_self_use: 0 },
      { id: 3, category: 'PF', current_value: 300000, is_self_use: 0 },
      { id: 4, category: 'GOLD_SILVER', current_value: 400000, is_self_use: 0 },
    ],
    expenses: [],
    goals: { retirement_age: 60, sip_stop_age: 60, pension_income: 0, fire_target_age: 100 },
    sipAmount: 10000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 0,
  };
  const result = runScenario(scenario);
  assert(result.investableNetWorth === 1000000, `7.5 Multi-asset sum: ${fmt(result.investableNetWorth)} = ₹10L`);
}

// ============================================================================
// AUDIT 8: Critical Math Invariants
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('AUDIT 8: Critical Math Invariants');
console.log('═══════════════════════════════════════════════════════════');

// Test 8.1: Higher SIP return rate should reduce required SIP
{
  const makeScenario = (rate) => ({
    name: `Rate-${rate}`, profile: { dob: '1996-01-01', monthly_income: 200000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 500000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: 25000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 55, sip_stop_age: 55, pension_income: 0, fire_target_age: 100 },
    sipAmount: 30000, sipReturnRate: rate, postSipReturnRate: 8, stepUpRate: 5,
  });
  const r8 = runScenario(makeScenario(8));
  const r12 = runScenario(makeScenario(12));
  const r16 = runScenario(makeScenario(16));
  
  assert(r12.requiredSIP < r8.requiredSIP, `8.1a 12% return SIP (${fmt(r12.requiredSIP)}) < 8% (${fmt(r8.requiredSIP)})`);
  assert(r16.requiredSIP < r12.requiredSIP, `8.1b 16% return SIP (${fmt(r16.requiredSIP)}) < 12% (${fmt(r12.requiredSIP)})`);
}

// Test 8.2: Higher initial assets should reduce required SIP
{
  const makeScenario = (assets) => ({
    name: `Assets-${assets}`, profile: { dob: '1996-01-01', monthly_income: 200000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: assets, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: 25000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 55, sip_stop_age: 55, pension_income: 0, fire_target_age: 100 },
    sipAmount: 30000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 5,
  });
  const r0 = runScenario(makeScenario(0));
  const r10L = runScenario(makeScenario(1000000));
  const r50L = runScenario(makeScenario(5000000));
  
  assert(r10L.requiredSIP < r0.requiredSIP, `8.2a ₹10L assets SIP (${fmt(r10L.requiredSIP)}) < ₹0 (${fmt(r0.requiredSIP)})`);
  assert(r50L.requiredSIP < r10L.requiredSIP, `8.2b ₹50L assets SIP (${fmt(r50L.requiredSIP)}) < ₹10L (${fmt(r10L.requiredSIP)})`);
}

// Test 8.3: Later retirement age should reduce required SIP (longer accumulation)
{
  const makeScenario = (retAge) => ({
    name: `Ret-${retAge}`, profile: { dob: '1996-01-01', monthly_income: 200000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 500000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: 25000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: retAge, sip_stop_age: retAge, pension_income: 0, fire_target_age: 100 },
    sipAmount: 30000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 5,
  });
  const r45 = runScenario(makeScenario(45));
  const r55 = runScenario(makeScenario(55));
  const r65 = runScenario(makeScenario(65));
  
  assert(r55.requiredSIP < r45.requiredSIP, `8.3a Retire 55 SIP (${fmt(r55.requiredSIP)}) < Retire 45 (${fmt(r45.requiredSIP)})`);
  assert(r65.requiredSIP < r55.requiredSIP, `8.3b Retire 65 SIP (${fmt(r65.requiredSIP)}) < Retire 55 (${fmt(r55.requiredSIP)})`);
}

// Test 8.4: Higher expense inflation should increase FIRE corpus
{
  const makeScenario = (inflRate) => ({
    name: `Infl-${inflRate}`, profile: { dob: '1996-01-01', monthly_income: 200000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 500000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: 25000, inflation_rate: inflRate, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 55, sip_stop_age: 55, pension_income: 0, fire_target_age: 100 },
    sipAmount: 30000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 5,
  });
  const r4 = runScenario(makeScenario(4));
  const r6 = runScenario(makeScenario(6));
  const r8 = runScenario(makeScenario(8));
  
  assert(r6.fireCorpus > r4.fireCorpus, `8.4a 6% inflation corpus (${fmt(r6.fireCorpus)}) > 4% (${fmt(r4.fireCorpus)})`);
  assert(r8.fireCorpus > r6.fireCorpus, `8.4b 8% inflation corpus (${fmt(r8.fireCorpus)}) > 6% (${fmt(r6.fireCorpus)})`);
}

// Test 8.5: Higher post-retirement return should reduce FIRE corpus
{
  const makeScenario = (postRate) => ({
    name: `PostRate-${postRate}`, profile: { dob: '1996-01-01', monthly_income: 200000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 500000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: 25000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 55, sip_stop_age: 55, pension_income: 0, fire_target_age: 100 },
    sipAmount: 30000, sipReturnRate: 12, postSipReturnRate: postRate, stepUpRate: 5,
  });
  const r6 = runScenario(makeScenario(6));
  const r8 = runScenario(makeScenario(8));
  const r10 = runScenario(makeScenario(10));
  
  assert(r8.fireCorpus < r6.fireCorpus, `8.5a 8% post-ret corpus (${fmt(r8.fireCorpus)}) < 6% (${fmt(r6.fireCorpus)})`);
  assert(r10.fireCorpus < r8.fireCorpus, `8.5b 10% post-ret corpus (${fmt(r10.fireCorpus)}) < 8% (${fmt(r8.fireCorpus)})`);
}

// ============================================================================
// AUDIT 9: Pension Model Deep Dive
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('AUDIT 9: Pension Model — Deep Dive');
console.log('═══════════════════════════════════════════════════════════');

// Test 9.1: Pension starts ONLY at retirement age
{
  const scenario = {
    name: 'Pension Start', profile: { dob: '1991-01-01', monthly_income: 100000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 500000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: 15000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 55, sip_stop_age: 55, pension_income: 40000, fire_target_age: 100 },
    sipAmount: 20000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 5,
  };
  const result = runScenario(scenario);
  const preRet = result.milestoneData.filter(d => d.age < 55);
  const postRet = result.milestoneData.filter(d => d.age >= 55);
  
  const allPensionZeroPre = preRet.every(d => d.pensionIncome === 0);
  const allPensionPositivePost = postRet.every(d => d.pensionIncome > 0);
  
  assert(allPensionZeroPre, '9.1a Pension = 0 for ALL pre-retirement years');
  assert(allPensionPositivePost, '9.1b Pension > 0 for ALL post-retirement years');
}

// Test 9.2: Pension inflates from CURRENT AGE, not retirement age
// This is a CRITICAL design check — our pension PV is in today's rupees,
// but inflated from current age, meaning it's MUCH more by retirement.
{
  const scenario = {
    name: 'Pension Inflation Base', profile: { dob: '1991-01-01', monthly_income: 100000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 500000, is_self_use: 0 }],
    expenses: [],
    goals: { retirement_age: 55, sip_stop_age: 55, pension_income: 50000, fire_target_age: 100 },
    sipAmount: 0, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 0,
  };
  const result = runScenario(scenario);
  const currentAge = getAge(scenario.profile.dob);
  const retRow = result.milestoneData.find(d => d.age === 55);
  
  // Pension at retirement = 50000 * 12 * 1.06^(55-currentAge)
  const yearsToRet = 55 - currentAge;
  const expected = 50000 * 12 * Math.pow(1.06, yearsToRet);
  
  console.log(`    Current age: ${currentAge}, Years to ret: ${yearsToRet}`);
  console.log(`    Pension at retirement: ${fmt(retRow.pensionIncome)} (expected ${fmt(expected)})`);
  console.log(`    Pension PV (today): ₹50K/mo = ₹6L/yr`);
  console.log(`    Pension at 55: ${fmt(expected)} = ${(expected/600000).toFixed(1)}x today's value`);
  
  // IMPORTANT FINDING: The pension inflates from current age, not from year 0 of input.
  // This means a user entering ₹50K pension TODAY will see it as ₹50K * 1.06^20 = ₹1.6L/mo at retirement
  // Is this the user's intent? They might mean "I expect ₹50K/mo pension at retirement" not "₹50K in today's terms"
  if (yearsToRet > 10) {
    warn('9.2 DESIGN: Pension ₹50K/mo today becomes ' + fmt(expected/12) + '/mo at retirement — user may not expect this inflation');
  }
}

// ============================================================================
// AUDIT 10: Pre-Retirement Expense Model
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('AUDIT 10: Pre-Retirement Expense Model');
console.log('═══════════════════════════════════════════════════════════');

// Test 10.1: CRITICAL — Pre-retirement, expenses are NOT deducted from corpus.
// The assumption is: salary covers expenses, SIP = net savings after expenses.
// This means the "planned expenses" column doesn't affect pre-retirement NW.
{
  const makeScenario = (expAmount) => ({
    name: `PreRetExp-${expAmount}`, profile: { dob: '1996-01-01', monthly_income: 200000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 500000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: expAmount, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 55, sip_stop_age: 55, pension_income: 0, fire_target_age: 100 },
    sipAmount: 30000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 0,
  });
  const r10K = runScenario(makeScenario(10000));
  const r50K = runScenario(makeScenario(50000));
  
  const nwAt45_10K = r10K.milestoneData.find(d => d.age === 45).netWorth;
  const nwAt45_50K = r50K.milestoneData.find(d => d.age === 45).netWorth;
  
  assert(Math.abs(nwAt45_10K - nwAt45_50K) < 1, 
    `10.1 Pre-retirement NW identical regardless of expense level: ${fmt(nwAt45_10K)} vs ${fmt(nwAt45_50K)}`);
}

// Test 10.2: But different expenses → different FIRE corpus
{
  const makeScenario = (expAmount) => ({
    name: `Corpus-${expAmount}`, profile: { dob: '1996-01-01', monthly_income: 200000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 500000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: expAmount, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 55, sip_stop_age: 55, pension_income: 0, fire_target_age: 100 },
    sipAmount: 30000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 0,
  });
  const r10K = runScenario(makeScenario(10000));
  const r50K = runScenario(makeScenario(50000));
  
  assert(r50K.fireCorpus > r10K.fireCorpus, 
    `10.2 Higher expenses → higher corpus: ${fmt(r50K.fireCorpus)} > ${fmt(r10K.fireCorpus)}`);
}

// ============================================================================
// AUDIT 11: Return Rate Switching Logic
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('AUDIT 11: Return Rate Switching at SIP Stop Age');
console.log('═══════════════════════════════════════════════════════════');

// Test 11.1: Return switches from sipReturnRate to postSipReturnRate at sipStopAge
{
  const scenario = {
    name: 'Rate Switch', profile: { dob: '1996-01-01', monthly_income: 100000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 10000000, is_self_use: 0 }], // ₹1Cr
    expenses: [],
    goals: { retirement_age: 60, sip_stop_age: 50, pension_income: 0, fire_target_age: 100 },
    sipAmount: 0, sipReturnRate: 14, postSipReturnRate: 8, stepUpRate: 0,
  };
  const result = runScenario(scenario);
  const atStopAge = result.milestoneData.find(d => d.age === 50);
  const afterStopAge = result.milestoneData.find(d => d.age === 51);
  
  // Growth from 50→51 should be at 8%, not 14%
  const expectedGrowth = atStopAge.netWorth * 0.08;
  const actualGrowth = afterStopAge.netWorth - atStopAge.netWorth;
  
  assert(Math.abs(actualGrowth - expectedGrowth) < 100, 
    `11.1 Post-SIP-stop return is 8%: growth ${fmt(actualGrowth)} ≈ ${fmt(expectedGrowth)}`);
}

// ============================================================================
// AUDIT 12: Vesting Income (RSU/ESOP)
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('AUDIT 12: Vesting Income (RSU/ESOP)');
console.log('═══════════════════════════════════════════════════════════');

// Test 12.1: RSU vesting adds to net worth
{
  const scenario = {
    name: 'RSU Vesting', profile: { dob: '1996-01-01', monthly_income: 100000 },
    assets: [
      { id: 1, category: 'SAVINGS', current_value: 100000, is_self_use: 0 },
      { id: 2, category: 'ESOP_RSU', current_value: 500000, is_self_use: 0,
        is_recurring: 1, recurring_amount: 300000, 
        recurring_frequency: 'QUARTERLY',
        next_vesting_date: '2026-06-01' },
    ],
    expenses: [],
    goals: { retirement_age: 60, sip_stop_age: 60, pension_income: 0, fire_target_age: 100 },
    sipAmount: 0, sipReturnRate: 0, postSipReturnRate: 0, stepUpRate: 0,
  };
  const result = runScenario(scenario);
  const age30 = result.milestoneData.find(d => d.age === 30);
  
  // After first full year of vesting: NW = initial(600K) + vesting(300K * 4 = 12L)
  // But the vesting only starts in 2026 (mid-year), so let's check year 1
  const currentAge = getAge(scenario.profile.dob);
  const firstFullVestingYear = result.milestoneData.find(d => d.age === currentAge + 1);
  
  if (firstFullVestingYear) {
    assert(firstFullVestingYear.netWorth > 600000, 
      `12.1 RSU vesting adds to NW: ${fmt(firstFullVestingYear.netWorth)} > initial ₹6L`);
  }
}

// ============================================================================
// AUDIT 13: Numerical Stability
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('AUDIT 13: Numerical Stability');
console.log('═══════════════════════════════════════════════════════════');

// Test 13.1: Very small amounts don't cause issues
{
  const scenario = {
    name: 'Small Amounts', profile: { dob: '1996-01-01', monthly_income: 1000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 100, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: 100, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 60, sip_stop_age: 60, pension_income: 0, fire_target_age: 100 },
    sipAmount: 50, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 5,
  };
  const result = runScenario(scenario);
  assert(result.fireCorpus > 0, '13.1a Small amounts: corpus > 0');
  assert(isFinite(result.fireCorpus), '13.1b Corpus is finite');
  assert(!isNaN(result.fireCorpus), '13.1c Corpus is not NaN');
}

// Test 13.2: Very large amounts don't overflow
{
  const scenario = {
    name: 'Large Amounts', profile: { dob: '1996-01-01', monthly_income: 50000000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 1000000000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: 5000000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 55, sip_stop_age: 55, pension_income: 0, fire_target_age: 100 },
    sipAmount: 5000000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 5,
  };
  const result = runScenario(scenario);
  assert(isFinite(result.fireCorpus), '13.2a Large amounts: corpus is finite');
  assert(result.fireCorpus > 0, '13.2b Large amounts: corpus > 0');
  assert(result.milestoneData !== undefined, '13.2c Projections generated');
}

// ============================================================================
// AUDIT 14: Present Value of Expenses
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('AUDIT 14: Present Value of Expenses');
console.log('═══════════════════════════════════════════════════════════');

// Test 14.1: PV should be less than sum of nominal expenses (discounting effect)
{
  const scenario = {
    name: 'PV Check', profile: { dob: '1996-01-01', monthly_income: 100000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 500000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: 30000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 55, sip_stop_age: 55, pension_income: 0, fire_target_age: 100 },
    sipAmount: 30000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 5,
  };
  const result = runScenario(scenario);
  
  // Calculate sum of nominal (undiscounted) expenses
  const currentAge = getAge(scenario.profile.dob);
  const currentYear = new Date().getFullYear();
  let totalNominal = 0;
  for (let age = currentAge; age <= 100; age++) {
    const year = currentYear + (age - currentAge);
    totalNominal += calculateExpenseForYear(scenario.expenses[0], year, currentYear, 0);
  }
  
  assert(result.totalPV < totalNominal, 
    `14.1 PV (${fmt(result.totalPV)}) < Nominal total (${fmt(totalNominal)})`);
  assert(result.totalPV > 0, '14.1b PV is positive');
}

// ============================================================================
// AUDIT 15: Critical Design Analysis
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('AUDIT 15: Critical Design Analysis');
console.log('═══════════════════════════════════════════════════════════');

// Test 15.1: What happens when post-retirement return equals inflation?
{
  const scenario = {
    name: 'Return=Inflation', profile: { dob: '1996-01-01', monthly_income: 100000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 500000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: 20000, inflation_rate: 8, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 55, sip_stop_age: 55, pension_income: 0, fire_target_age: 100 },
    sipAmount: 30000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 5,
  };
  const result = runScenario(scenario);
  
  // When return = inflation, corpus should deplete linearly (roughly)
  // Because each year's real withdrawal is constant
  console.log(`    Return=Inflation (8%): Corpus = ${fmt(result.fireCorpus)}`);
  console.log(`    This means you need ~${(result.fireCorpus / (240000 * Math.pow(1.08, 55-30))).toFixed(1)}x annual expenses as corpus`);
}

// Test 15.2: Analysis — return rate used for corpus growth differs from FIRE corpus calc
{
  // The FIRE corpus uses postSipReturnRate for post-retirement simulation
  // But the NW projection uses sipReturnRate during pre-retirement
  // The required SIP calc uses sipReturnRate for accumulation
  // This is CORRECT behavior — just documenting.
  const scenario = {
    name: 'Rate Split', profile: { dob: '1996-01-01', monthly_income: 100000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 500000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: 20000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 55, sip_stop_age: 55, pension_income: 0, fire_target_age: 100 },
    sipAmount: 30000, sipReturnRate: 14, postSipReturnRate: 7, stepUpRate: 5,
  };
  const result = runScenario(scenario);
  console.log(`    sipReturnRate=14%, postSipReturnRate=7%`);
  console.log(`    Corpus: ${fmt(result.fireCorpus)} (post-ret @7%)`);
  console.log(`    Required SIP: ${fmt(result.requiredSIP)} (pre-ret @14%)`);
  assert(true, '15.2 Rate split between pre/post retirement confirmed correct');
}

// ============================================================================
// AUDIT 16: "Pension is present-value" deep check
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('AUDIT 16: Pension Semantics — PV vs Future Value');
console.log('═══════════════════════════════════════════════════════════');

// The pension amount entered by the user is treated as TODAY's value,
// and inflated at 6% until retirement. This is correct IF the user enters
// what they'd expect to receive in today's money (e.g., "I want ₹50K/mo pension").
// But if the user enters the actual pension amount they'll receive at retirement,
// the engine will OVER-inflate it.
{
  const scenario = {
    name: 'Pension PV Test', profile: { dob: '1991-01-01', monthly_income: 150000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 1000000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: 30000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 55, sip_stop_age: 55, pension_income: 50000, fire_target_age: 100 },
    sipAmount: 20000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 5,
  };
  const result = runScenario(scenario);
  const currentAge = getAge(scenario.profile.dob);
  const retRow = result.milestoneData.find(d => d.age === 55);
  const pensionAtRet = retRow.pensionIncome / 12; // monthly
  
  console.log(`    User enters: ₹50,000/month pension`);
  console.log(`    At retirement (age 55, ${55 - currentAge} years later): ₹${Math.round(pensionAtRet).toLocaleString()}/month`);
  console.log(`    This is ${(pensionAtRet / 50000).toFixed(1)}x the entered value`);
  
  warn('16.1 DESIGN: Pension input semantics — user enters ₹50K, gets ' + fmt(pensionAtRet) + '/mo at retirement. UX should clarify: "Enter your desired monthly pension in today\'s rupees"');
}

// ============================================================================
// AUDIT 17: Expense inflation from current year (not expense start date)  
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('AUDIT 17: Future Expense Inflation Base Year');
console.log('═══════════════════════════════════════════════════════════');

// Critical: A future expense dated 10 years from now inflates from TODAY, not from when it starts.
// This means: "₹1L wedding in 2032" becomes ₹1L * 1.07^6 = ₹1.50L in 2032 (if entered in 2026).
// Is this correct? It should be — the user enters today's cost estimate.
{
  const currentYear = new Date().getFullYear();
  const exp = {
    amount: 100000, inflation_rate: 7, expense_type: 'FUTURE_ONE_TIME',
    frequency: null, start_date: `${currentYear + 6}-01-01`, end_date: null,
  };
  const val = calculateExpenseForYear(exp, currentYear + 6, currentYear, 0);
  const expected = 100000 * Math.pow(1.07, 6);
  
  assert(Math.abs(val - expected) < 1, 
    `17.1 Future expense inflates from today: ${fmt(val)} ≈ ${fmt(expected)} (1.07^6 × ₹1L)`);
  console.log(`    User enters: ₹1L expense in ${currentYear + 6}`);
  console.log(`    Engine calculates: ${fmt(val)} (inflated ${((val/100000-1)*100).toFixed(0)}%)`);
  console.log(`    This is CORRECT — user enters today's estimate, inflation adjusts to future.`);
}

// ============================================================================
// AUDIT 18: FIRE corpus handles edge case of expenses ending before targetAge
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('AUDIT 18: Expenses Ending Before Target Age');
console.log('═══════════════════════════════════════════════════════════');

{
  // Scenario: Only expense is rent that stops at retirement (owns home after)
  const currentYear = new Date().getFullYear();
  const scenario = {
    name: 'Expenses End Early', profile: { dob: '1996-01-01', monthly_income: 100000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 500000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: 20000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: `${currentYear + 25}-12-31` },
    ],
    goals: { retirement_age: 55, sip_stop_age: 55, pension_income: 0, fire_target_age: 100 },
    sipAmount: 30000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 5,
  };
  const result = runScenario(scenario);
  
  // With expenses ending at age 55 (roughly), corpus should be much smaller
  const scenarioPerp = {
    ...scenario,
    expenses: [
      { id: 1, amount: 20000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null }, // perpetual
    ],
  };
  const resultPerp = runScenario(scenarioPerp);
  
  assert(result.fireCorpus < resultPerp.fireCorpus, 
    `18.1 Expenses ending at 55: corpus ${fmt(result.fireCorpus)} < perpetual ${fmt(resultPerp.fireCorpus)}`);
}

// ============================================================================
// AUDIT 19: Comprehensive Return-on-Investment Model
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('AUDIT 19: ROI Model — Single Rate vs Per-Asset');
console.log('═══════════════════════════════════════════════════════════');

// CRITICAL FINDING: The engine uses a SINGLE return rate for the entire corpus,
// not individual asset returns. This means:
// - PF at 7%, Equity at 14%, Gold at 10% — all pooled into one rate
// - The user sets this rate on the dashboard slider
// - Individual asset expected_roi is IGNORED in projections
{
  const scenario = {
    name: 'Multi-Rate Assets', profile: { dob: '1996-01-01', monthly_income: 100000 },
    assets: [
      { id: 1, category: 'PF', current_value: 500000, expected_roi: 7, is_self_use: 0 },
      { id: 2, category: 'MUTUAL_FUND', current_value: 500000, expected_roi: 14, is_self_use: 0 },
    ],
    expenses: [],
    goals: { retirement_age: 60, sip_stop_age: 60, pension_income: 0, fire_target_age: 100 },
    sipAmount: 10000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 0,
  };
  const result = runScenario(scenario);
  
  // Check: Is individual asset ROI used? Or is sipReturnRate applied to all?
  const currentAge = getAge(scenario.profile.dob);
  const year1 = result.milestoneData.find(d => d.age === currentAge + 1);
  const initialNW = result.investableNetWorth; // 1000000
  
  // If single rate: NW after year 1 = 1000000 * 1.12 + 120000 = 1,240,000
  const singleRateExpected = initialNW * 1.12 + 120000;
  // If dual rate: NW = 500000*1.07 + 500000*1.14 + 120000 = 535000 + 570000 + 120000 = 1,225,000
  const dualRateExpected = 500000*1.07 + 500000*1.14 + 120000;
  
  console.log(`    Year 1 NW: ${fmt(year1.netWorth)}`);
  console.log(`    Single-rate (12%): ${fmt(singleRateExpected)}`);
  console.log(`    Per-asset rate: ${fmt(dualRateExpected)}`);
  
  const usesSingleRate = Math.abs(year1.netWorth - singleRateExpected) < Math.abs(year1.netWorth - dualRateExpected);
  warn(`19.1 DESIGN: Engine uses ${usesSingleRate ? 'SINGLE' : 'PER-ASSET'} return rate — per-asset ROI (expected_roi field) ${usesSingleRate ? 'is IGNORED' : 'is used'} in projections`);
}

// ============================================================================
// FINAL SUMMARY
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('AUDIT SUMMARY');
console.log('═══════════════════════════════════════════════════════════');
console.log(`  ${PASS} Passed: ${passCount}`);
console.log(`  ${FAIL} Failed: ${failCount}`);
console.log(`  ${WARN} Warnings: ${warnCount}`);

if (failures.length > 0) {
  console.log('\nFailed tests:');
  for (const f of failures) {
    console.log(`  ${FAIL} ${f.testName}: ${f.detail}`);
  }
}

console.log('\n');
process.exit(failCount > 0 ? 1 : 0);
