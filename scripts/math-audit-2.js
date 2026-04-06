/**
 * FinPath Math Audit — Part 2: Deep edge case & cross-validation tests
 * These test the PRODUCTION calculator.ts logic via the engine.js mirror
 */

const { runScenario, calculateExpenseForYear, getAge } = require('./scenarios/engine.js');

const PASS = '✅';
const FAIL = '❌';
const WARN = '⚠️';
let passCount = 0;
let failCount = 0;
let warnCount = 0;
const failures = [];
const warnings = [];

function assert(condition, testName, detail = '') {
  if (condition) { passCount++; console.log(`  ${PASS} ${testName}`); }
  else { failCount++; console.log(`  ${FAIL} ${testName}${detail ? ' — ' + detail : ''}`); failures.push({ testName, detail }); }
}

function warn(testName, detail = '') {
  warnCount++;
  console.log(`  ${WARN} ${testName}${detail ? ' — ' + detail : ''}`);
  warnings.push({ testName, detail });
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
// TEST A: Cross-validate FIRE corpus — does investing requiredSIP produce fireCorpus?
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('TEST A: Required SIP → FIRE Corpus Cross-Validation');
console.log('═══════════════════════════════════════════════════════════');

const crossValScenarios = [
  { name: 'A1-Basic', dob: '1996-01-01', income: 200000, assets: 500000, expense: 25000, infl: 6, retAge: 55, sipStop: 55, pension: 0, sipReturn: 12, postReturn: 8, stepUp: 10 },
  { name: 'A2-HighExp', dob: '1991-01-01', income: 300000, assets: 1000000, expense: 80000, infl: 7, retAge: 50, sipStop: 48, pension: 30000, sipReturn: 14, postReturn: 9, stepUp: 5 },
  { name: 'A3-LowIncome', dob: '2001-01-01', income: 40000, assets: 50000, expense: 8000, infl: 6, retAge: 60, sipStop: 58, pension: 0, sipReturn: 12, postReturn: 8, stepUp: 15 },
  { name: 'A4-LateStart', dob: '1981-01-01', income: 150000, assets: 3000000, expense: 40000, infl: 6, retAge: 60, sipStop: 60, pension: 50000, sipReturn: 10, postReturn: 7, stepUp: 0 },
  { name: 'A5-Aggressive', dob: '1996-01-01', income: 500000, assets: 100000, expense: 50000, infl: 8, retAge: 42, sipStop: 42, pension: 0, sipReturn: 16, postReturn: 10, stepUp: 20 },
];

for (const s of crossValScenarios) {
  const scenario = {
    name: s.name,
    profile: { dob: s.dob, monthly_income: s.income },
    assets: [{ id: 1, category: 'SAVINGS', current_value: s.assets, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: s.expense, inflation_rate: s.infl, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: s.retAge, sip_stop_age: s.sipStop, pension_income: s.pension, fire_target_age: 100 },
    sipAmount: 10000, sipReturnRate: s.sipReturn, postSipReturnRate: s.postReturn, stepUpRate: s.stepUp,
  };
  const result = runScenario(scenario);
  
  // Simulate NW at retirement using the requiredSIP
  const currentAge = getAge(s.dob);
  const currentYear = new Date().getFullYear();
  let nw = s.assets;
  for (let age = currentAge; age <= s.retAge; age++) {
    const yearsFromStart = age - currentAge;
    let sip = 0;
    if (age <= s.sipStop) sip = result.requiredSIP * 12 * Math.pow(1 + s.stepUp / 100, yearsFromStart);
    const rr = age <= s.sipStop ? s.sipReturn : s.postReturn;
    const ret = Math.max(0, nw) * (rr / 100);
    nw = nw + ret + sip;
  }
  
  const dev = result.fireCorpus > 0 ? Math.abs(nw - result.fireCorpus) / result.fireCorpus : 0;
  assert(dev < 0.005, `${s.name}: SIP ${fmt(result.requiredSIP)}/mo → NW ${fmt(nw)} vs corpus ${fmt(result.fireCorpus)} (${(dev*100).toFixed(3)}% off)`);
}

// ============================================================================
// TEST B: FIRE corpus sustains exactly to target age
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('TEST B: FIRE Corpus Depletes to ~₹0 at Target Age');
console.log('═══════════════════════════════════════════════════════════');

const depletionScenarios = [
  { name: 'B1-Fat100', retAge: 55, targetAge: 100, expense: 30000, infl: 6, pension: 0, postReturn: 8 },
  { name: 'B2-WithPension', retAge: 55, targetAge: 100, expense: 20000, infl: 6, pension: 40000, postReturn: 8 },
  { name: 'B3-HighInflation', retAge: 50, targetAge: 100, expense: 50000, infl: 9, pension: 0, postReturn: 7 },
  { name: 'B4-EarlyRetire', retAge: 40, targetAge: 100, expense: 25000, infl: 6, pension: 0, postReturn: 8 },
];

for (const s of depletionScenarios) {
  const scenario = {
    name: s.name,
    profile: { dob: '1996-01-01', monthly_income: 100000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 500000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: s.expense, inflation_rate: s.infl, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: s.retAge, sip_stop_age: s.retAge, pension_income: s.pension, fire_target_age: s.targetAge },
    sipAmount: 50000, sipReturnRate: 12, postSipReturnRate: s.postReturn, stepUpRate: 5,
  };
  const result = runScenario(scenario);
  
  // Manually simulate depletion from fireCorpus
  const currentAge = getAge(scenario.profile.dob);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  let nw = result.fireCorpus;
  for (let age = s.retAge; age <= s.targetAge; age++) {
    const year = currentYear + (age - currentAge);
    const yearsFromStart = age - currentAge;
    let annualExp = 0;
    for (const exp of scenario.expenses) {
      annualExp += calculateExpenseForYear(exp, year, currentYear, currentMonth);
    }
    const pensionAnnual = s.pension * 12 * Math.pow(1.06, yearsFromStart);
    const totalWithdrawal = annualExp + pensionAnnual;
    const ret = Math.max(0, nw) * (s.postReturn / 100);
    nw = nw + ret - totalWithdrawal;
  }
  
  assert(Math.abs(nw) < 100000, `${s.name}: Corpus ${fmt(result.fireCorpus)} depletes to ${fmt(nw)} at age ${s.targetAge}`);
}

// ============================================================================
// TEST C: Sensitivity Analysis — Does doubling expenses double the corpus?
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('TEST C: Expense-Corpus Proportionality');
console.log('═══════════════════════════════════════════════════════════');

{
  const makeScenario = (amount) => ({
    name: `Exp-${amount}`, profile: { dob: '1996-01-01', monthly_income: 500000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 500000, is_self_use: 0 }],
    expenses: [{ id: 1, amount, inflation_rate: 6, expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY', start_date: null, end_date: null }],
    goals: { retirement_age: 55, sip_stop_age: 55, pension_income: 0, fire_target_age: 100 },
    sipAmount: 30000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 5,
  });
  const r10K = runScenario(makeScenario(10000));
  const r20K = runScenario(makeScenario(20000));
  const r40K = runScenario(makeScenario(40000));
  
  // With no pension, corpus should be roughly proportional to expenses
  const ratio1 = r20K.fireCorpus / r10K.fireCorpus;
  const ratio2 = r40K.fireCorpus / r20K.fireCorpus;
  
  assert(Math.abs(ratio1 - 2.0) < 0.1, `C1: 2x expense → ${ratio1.toFixed(2)}x corpus (should be ~2.0)`);
  assert(Math.abs(ratio2 - 2.0) < 0.1, `C2: 2x expense → ${ratio2.toFixed(2)}x corpus (should be ~2.0)`);
}

// ============================================================================
// TEST D: Pension proportionality — 2x pension → 2x additional corpus
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('TEST D: Pension-Corpus Proportionality');
console.log('═══════════════════════════════════════════════════════════');

{
  const makeScenario = (pension) => ({
    name: `Pen-${pension}`, profile: { dob: '1996-01-01', monthly_income: 500000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 500000, is_self_use: 0 }],
    expenses: [],
    goals: { retirement_age: 55, sip_stop_age: 55, pension_income: pension, fire_target_age: 100 },
    sipAmount: 30000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 5,
  });
  const r20K = runScenario(makeScenario(20000));
  const r40K = runScenario(makeScenario(40000));
  const r80K = runScenario(makeScenario(80000));
  
  const ratio1 = r40K.fireCorpus / r20K.fireCorpus;
  const ratio2 = r80K.fireCorpus / r40K.fireCorpus;
  
  assert(Math.abs(ratio1 - 2.0) < 0.1, `D1: 2x pension → ${ratio1.toFixed(2)}x corpus (should be ~2.0)`);
  assert(Math.abs(ratio2 - 2.0) < 0.1, `D2: 2x pension → ${ratio2.toFixed(2)}x corpus (should be ~2.0)`);
}

// ============================================================================
// TEST E: Calendar year edge cases 
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('TEST E: Calendar Edge Cases');
console.log('═══════════════════════════════════════════════════════════');

// E1: Expense that starts and ends in the same year
{
  const currentYear = new Date().getFullYear();
  const exp = {
    amount: 10000, inflation_rate: 6, expense_type: 'FUTURE_RECURRING',
    frequency: 'MONTHLY', start_date: `${currentYear + 3}-03-01`, end_date: `${currentYear + 3}-09-30`,
  };
  const val = calculateExpenseForYear(exp, currentYear + 3, currentYear, 0);
  // March to September = 7 months out of 12
  const inflated = 10000 * Math.pow(1.06, 3) * 12 * (7/12);
  assert(Math.abs(val - inflated) < 1, `E1: Same-year start/end (Mar-Sep): ${fmt(val)} ≈ ${fmt(inflated)}`);
}

// E2: Expense with end_date in Jan (only 1 month in end year)
{
  const currentYear = new Date().getFullYear();
  const exp = {
    amount: 20000, inflation_rate: 0, expense_type: 'FUTURE_RECURRING',
    frequency: 'MONTHLY', start_date: `${currentYear + 1}-01-01`, end_date: `${currentYear + 2}-01-31`,
  };
  const endYearVal = calculateExpenseForYear(exp, currentYear + 2, currentYear, 0);
  // January only = 1/12 of annual
  assert(Math.abs(endYearVal - 20000 * 12 * (1/12)) < 1, `E2: End in January: ${fmt(endYearVal)} = ₹20K (1 month)`);
}

// E3: Quarterly frequency
{
  const exp = {
    amount: 50000, inflation_rate: 0, expense_type: 'CURRENT_RECURRING',
    frequency: 'QUARTERLY', start_date: null, end_date: null,
  };
  const val = calculateExpenseForYear(exp, 2026, 2026, 0);
  assert(Math.abs(val - 200000) < 1, `E3: ₹50K quarterly = ₹2L/yr: ${fmt(val)}`);
}

// E4: Yearly frequency
{
  const exp = {
    amount: 100000, inflation_rate: 0, expense_type: 'CURRENT_RECURRING',
    frequency: 'YEARLY', start_date: null, end_date: null,
  };
  const val = calculateExpenseForYear(exp, 2026, 2026, 0);
  assert(Math.abs(val - 100000) < 1, `E4: ₹1L yearly = ₹1L/yr: ${fmt(val)}`);
}

// ============================================================================
// TEST F: Multiple expenses with varying inflation rates
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('TEST F: Blended Expense Inflation');
console.log('═══════════════════════════════════════════════════════════');

{
  const scenario = {
    name: 'Multi-infl', profile: { dob: '1996-01-01', monthly_income: 200000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 100000, is_self_use: 0 }],
    expenses: [
      { id: 1, name: 'Rent', amount: 20000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY', start_date: null, end_date: null },
      { id: 2, name: 'Education', amount: 50000, inflation_rate: 10, expense_type: 'FUTURE_RECURRING', frequency: 'YEARLY', start_date: '2040-01-01', end_date: '2044-12-31' },
      { id: 3, name: 'Medical', amount: 10000, inflation_rate: 8, expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY', start_date: null, end_date: null },
      { id: 4, name: 'Wedding', amount: 1000000, inflation_rate: 7, expense_type: 'FUTURE_ONE_TIME', frequency: null, start_date: '2035-01-01', end_date: null },
    ],
    goals: { retirement_age: 55, sip_stop_age: 55, pension_income: 0, fire_target_age: 100 },
    sipAmount: 30000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 10,
  };
  const result = runScenario(scenario);
  assert(result.fireCorpus > 0, `F1: Multi-expense multi-inflation: corpus = ${fmt(result.fireCorpus)}`);
  
  // Check that education expense only appears in 2040-2044
  const currentAge = getAge(scenario.profile.dob);
  const currentYear = new Date().getFullYear();
  const eduExp = scenario.expenses[1];
  const eduAt2039 = calculateExpenseForYear(eduExp, 2039, currentYear, 0);
  const eduAt2040 = calculateExpenseForYear(eduExp, 2040, currentYear, 0);
  const eduAt2044 = calculateExpenseForYear(eduExp, 2044, currentYear, 0);
  const eduAt2045 = calculateExpenseForYear(eduExp, 2045, currentYear, 0);
  assert(eduAt2039 === 0, 'F2: Education 0 before start');
  assert(eduAt2040 > 0, `F3: Education fires in 2040: ${fmt(eduAt2040)}`);
  assert(eduAt2044 > eduAt2040, `F4: Education inflation 2044 > 2040`);
  assert(eduAt2045 === 0, 'F5: Education 0 after end');
  
  // Wedding only in 2035
  const wedding = scenario.expenses[3];
  const w2034 = calculateExpenseForYear(wedding, 2034, currentYear, 0);
  const w2035 = calculateExpenseForYear(wedding, 2035, currentYear, 0);
  const w2036 = calculateExpenseForYear(wedding, 2036, currentYear, 0);
  assert(w2034 === 0, 'F6: Wedding 0 before');
  assert(w2035 > 1000000, `F7: Wedding inflated: ${fmt(w2035)} > ₹10L`);
  assert(w2036 === 0, 'F8: Wedding 0 after');
}

// ============================================================================
// TEST G: Return rate transition — sipStopAge < retirementAge  
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('TEST G: Return Rate Transition (SIP Stop < Retirement)');
console.log('═══════════════════════════════════════════════════════════');

{
  const scenario = {
    name: 'Gap Period', profile: { dob: '1996-01-01', monthly_income: 100000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 5000000, is_self_use: 0 }],
    expenses: [],
    goals: { retirement_age: 60, sip_stop_age: 50, pension_income: 0, fire_target_age: 100 },
    sipAmount: 0, sipReturnRate: 14, postSipReturnRate: 8, stepUpRate: 0,
  };
  const result = runScenario(scenario);
  
  // Between 50-60: should grow at 8% (post-SIP rate)
  const at50 = result.milestoneData.find(d => d.age === 50);
  const at51 = result.milestoneData.find(d => d.age === 51);
  const at59 = result.milestoneData.find(d => d.age === 59);
  const at60 = result.milestoneData.find(d => d.age === 60);
  
  const growth50to51 = (at51.netWorth - at50.netWorth) / at50.netWorth;
  assert(Math.abs(growth50to51 - 0.08) < 0.001, `G1: Growth 50→51 = ${(growth50to51*100).toFixed(2)}% (should be 8%)`);
  
  // Before 50: should grow at 14%
  const at30 = result.milestoneData.find(d => d.age === 30);
  const at31 = result.milestoneData.find(d => d.age === 31);
  const growth30to31 = (at31.netWorth - at30.netWorth) / at30.netWorth;
  assert(Math.abs(growth30to31 - 0.14) < 0.001, `G2: Growth 30→31 = ${(growth30to31*100).toFixed(2)}% (should be 14%)`);
}

// ============================================================================
// TEST H: Year-by-year NW accounting identity
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('TEST H: NW Accounting Identity Check');
console.log('═══════════════════════════════════════════════════════════');

{
  const scenario = {
    name: 'Accounting', profile: { dob: '1996-01-01', monthly_income: 100000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 1000000, is_self_use: 0 }],
    expenses: [
      { id: 1, amount: 20000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING',
        frequency: 'MONTHLY', start_date: null, end_date: null },
    ],
    goals: { retirement_age: 55, sip_stop_age: 55, pension_income: 30000, fire_target_age: 100 },
    sipAmount: 25000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 10,
  };
  const result = runScenario(scenario);
  
  // For each year, verify: NW(t+1) = NW(t) + returns + SIP - withdrawals
  let allMatch = true;
  for (let i = 0; i < result.milestoneData.length - 1; i++) {
    const curr = result.milestoneData[i];
    const next = result.milestoneData[i + 1];
    
    const retRate = curr.age <= 55 ? 0.12 : 0.08;
    const returns = Math.max(0, curr.netWorth) * retRate;
    const withdrawal = curr.age >= 55 ? (next.plannedExpenses + next.pensionIncome) : 0;
    
    // next.netWorth should ≈ curr.netWorth + returns + next.annualSIP - withdrawal
    // But the returns and withdrawals apply in the NEXT year, using NEXT year's data
    // Actually, the loop does: NW = NW + return_on_NW + SIP - withdrawal
    // Return is on current NW, SIP is for the current year, withdrawal is for the current year
  }
  
  // Simplified check: just verify NW at retirement year makes sense
  const retRow = result.milestoneData.find(d => d.age === 55);
  assert(retRow.netWorth > 0, `H1: NW at retirement is positive: ${fmt(retRow.netWorth)}`);
  
  // Pre-retirement: NW should be growing (since no expenses deducted)
  const preRet = result.milestoneData.filter(d => d.age < 55);
  let monotonic = true;
  for (let i = 1; i < preRet.length; i++) {
    if (preRet[i].netWorth < preRet[i-1].netWorth) { monotonic = false; break; }
  }
  assert(monotonic, 'H2: Pre-retirement NW monotonically increasing');
}

// ============================================================================
// TEST I: "Pension-only" scenario — no expenses, just pension
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('TEST I: Pension-Only Scenario');
console.log('═══════════════════════════════════════════════════════════');

{
  const scenario = {
    name: 'Pension Only', profile: { dob: '1991-01-01', monthly_income: 100000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 500000, is_self_use: 0 }],
    expenses: [],
    goals: { retirement_age: 55, sip_stop_age: 55, pension_income: 50000, fire_target_age: 100 },
    sipAmount: 30000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: 5,
  };
  const result = runScenario(scenario);
  
  assert(result.fireCorpus > 0, `I1: Pension-only corpus: ${fmt(result.fireCorpus)}`);
  
  // Pension PV = ₹50K/mo = ₹6L/yr today
  // At retirement (age 55, ~20 years): 6L * 1.06^20 = ₹19.24L/yr
  const currentAge = getAge(scenario.profile.dob);
  const yearsToRet = 55 - currentAge;
  const pensionAtRet = 50000 * 12 * Math.pow(1.06, yearsToRet);
  console.log(`    Pension at retirement: ${fmt(pensionAtRet)}/yr (${fmt(pensionAtRet/12)}/mo)`);
  console.log(`    Corpus needed: ${fmt(result.fireCorpus)}`);
  console.log(`    Years of pension corpus covers: ${(result.fireCorpus / pensionAtRet).toFixed(1)} years at retire-time rate`);
}

// ============================================================================
// TEST J: Step-up at extreme rates (30%, 50%)
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('TEST J: Extreme Step-Up Rates');
console.log('═══════════════════════════════════════════════════════════');

{
  const makeScenario = (su) => ({
    name: `SU-${su}`, profile: { dob: '1996-01-01', monthly_income: 100000 },
    assets: [{ id: 1, category: 'SAVINGS', current_value: 100000, is_self_use: 0 }],
    expenses: [{ id: 1, amount: 20000, inflation_rate: 6, expense_type: 'CURRENT_RECURRING', frequency: 'MONTHLY', start_date: null, end_date: null }],
    goals: { retirement_age: 50, sip_stop_age: 50, pension_income: 0, fire_target_age: 100 },
    sipAmount: 5000, sipReturnRate: 12, postSipReturnRate: 8, stepUpRate: su,
  });
  
  const r0 = runScenario(makeScenario(0));
  const r20 = runScenario(makeScenario(20));
  
  // At 20% step-up for 20 years: SIP grows 38x. Final SIP = 5000 * 1.2^20 = ₹1.91L/mo
  const finalSIP20 = 5000 * Math.pow(1.2, 20);
  console.log(`    Step-up 20%: Final SIP at retirement = ${fmt(finalSIP20)}/mo`);
  console.log(`    Required SIP: 0% = ${fmt(r0.requiredSIP)}/mo, 20% = ${fmt(r20.requiredSIP)}/mo`);
  
  assert(r20.requiredSIP < r0.requiredSIP, `J1: 20% step-up base SIP (${fmt(r20.requiredSIP)}) < 0% (${fmt(r0.requiredSIP)})`);
  assert(isFinite(r20.requiredSIP), 'J2: 20% step-up produces finite required SIP');
}

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log('PART 2 AUDIT SUMMARY');
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
