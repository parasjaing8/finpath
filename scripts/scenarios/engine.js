/**
 * Shared FIRE calculation engine for scenario testing
 * Replicates logic from engine/calculator.ts
 */

const FREQUENCIES = [
  { key: 'MONTHLY', multiplier: 12 },
  { key: 'QUARTERLY', multiplier: 4 },
  { key: 'HALF_YEARLY', multiplier: 2 },
  { key: 'YEARLY', multiplier: 1 },
];
const PENSION_INFLATION_RATE = 0.06;

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

function fmt(amount) {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

function runScenario(scenario) {
  const { name, profile, assets, expenses, goals, sipAmount, sipReturnRate, postSipReturnRate, stepUpRate } = scenario;
  const NOW = new Date();
  const CURRENT_YEAR = NOW.getFullYear();
  const CURRENT_MONTH = NOW.getMonth();
  const currentAge = getAge(profile.dob);

  // Net worth
  let investableNetWorth = 0;
  let totalNetWorth = 0;
  for (const a of assets) {
    totalNetWorth += a.current_value;
    if (a.category !== 'REAL_ESTATE' || !a.is_self_use) {
      investableNetWorth += a.current_value;
    }
  }

  const retAge = goals.retirement_age;
  const sipStopAge = goals.sip_stop_age;
  const discountRate = postSipReturnRate / 100;
  const pensionPV = goals.pension_income || 0;

  // FIRE corpus via Safe Withdrawal Rate (SWR)
  // corpus = first-year total withdrawal at retirement / (SWR / 100)
  const withdrawalRate = goals.withdrawal_rate || 5;

  let fireCorpus = 0;
  if (expenses.length > 0 || pensionPV > 0) {
    const retirementYear = CURRENT_YEAR + (retAge - currentAge);
    const yearsToRetirement = retAge - currentAge;

    let firstYearExpenses = 0;
    for (const exp of expenses) {
      firstYearExpenses += calculateExpenseForYear(exp, retirementYear, CURRENT_YEAR, CURRENT_MONTH);
    }

    const firstYearPension = pensionPV * 12 * Math.pow(1 + PENSION_INFLATION_RATE, yearsToRetirement);
    const firstYearWithdrawal = firstYearExpenses + firstYearPension;
    fireCorpus = Math.ceil(firstYearWithdrawal / (withdrawalRate / 100));
  }

  // PV of all expenses
  let totalPV = 0;
  for (let age = currentAge; age <= 100; age++) {
    const year = CURRENT_YEAR + (age - currentAge);
    const yearsFromNow = age - currentAge;
    let annualExpenses = 0;
    for (const exp of expenses) {
      annualExpenses += calculateExpenseForYear(exp, year, CURRENT_YEAR, CURRENT_MONTH);
    }
    totalPV += annualExpenses / Math.pow(1 + discountRate, yearsFromNow);
  }

  // Net worth projection
  let netWorth = investableNetWorth;
  let fireAchievedAge = -1;
  const milestoneData = [];
  const issues = [];
  let negativeNWFired = false;

  for (let age = currentAge; age <= 100; age++) {
    const year = CURRENT_YEAR + (age - currentAge);
    const yearsFromStart = age - currentAge;

    let annualSIP = 0;
    if (age <= sipStopAge) {
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

    // Vesting income (RSU/ESOP)
    let vestingIncome = 0;
    for (const a of assets) {
      if (a.category !== 'ESOP_RSU') continue;
      if (!a.is_recurring || !a.recurring_amount || !a.next_vesting_date) continue;
      const vestStart = new Date(a.next_vesting_date).getFullYear();
      if (year < vestStart) continue;
      if (a.vesting_end_date) {
        const vestEnd = new Date(a.vesting_end_date).getFullYear();
        if (year > vestEnd) continue;
      }
      const freq = a.recurring_frequency;
      const found = FREQUENCIES.find(f => f.key === freq);
      const timesPerYear = found ? found.multiplier : 12;
      vestingIncome += a.recurring_amount * timesPerYear;
    }

    const returnRate = age <= sipStopAge ? sipReturnRate : postSipReturnRate;
    const returnOnInvestments = Math.max(0, netWorth) * (returnRate / 100);
    // Pension is withdrawal FROM corpus, not income
    const totalWithdrawal = age >= retAge ? (plannedExpenses + pensionIncome) : 0;
    netWorth = netWorth + returnOnInvestments + annualSIP + vestingIncome - totalWithdrawal;

    if (fireAchievedAge < 0 && netWorth >= fireCorpus && fireCorpus > 0) {
      fireAchievedAge = age;
    }

    milestoneData.push({ age, year, netWorth, annualSIP, plannedExpenses, pensionIncome });

    // Issue detection
    if (netWorth < -1000000 && age > retAge && !negativeNWFired) {
      negativeNWFired = true;
      issues.push({ type: 'NEGATIVE_NW', age, year, netWorth, message: `Net worth went to ${fmt(netWorth)} — money ran out!` });
    }
    if (plannedExpenses > 50000000 && age <= 80) {
      issues.push({ type: 'HIGH_EXPENSES', age, year, amount: plannedExpenses, message: `Annual expenses = ${fmt(plannedExpenses)} — seems unrealistically high` });
    }
  }

  // Check: SIP at retirement age
  const sipAtRetirement = sipAmount * 12 * Math.pow(1 + stepUpRate / 100, retAge - currentAge);
  if (sipAtRetirement / 12 > profile.monthly_income * 5) {
    issues.push({ type: 'SIP_TOO_HIGH', age: retAge, message: `SIP at retirement = ${fmt(sipAtRetirement/12)}/month — exceeds 5x current salary. Step-up ${stepUpRate}% may be unrealistic.` });
  }

  // Check: expenses at age 80 and 100 — threshold scaled by horizon length
  for (const checkAge of [80, 100]) {
    const m = milestoneData.find(d => d.age === checkAge);
    const base = milestoneData.find(d => d.age === currentAge);
    if (m && m.plannedExpenses > 0 && base && base.plannedExpenses > 0) {
      const expRatio = m.plannedExpenses / base.plannedExpenses;
      // Allow up to 2× natural 7% compounding before flagging
      const years = checkAge - currentAge;
      const threshold = Math.max(50, Math.pow(1.07, years) * 2);
      if (expRatio > threshold) {
        issues.push({ type: 'INFLATION_EXPLOSION', age: checkAge, message: `Expenses at ${checkAge} are ${expRatio.toFixed(0)}x current expenses — check inflation rates` });
      }
    }
  }

  // Check: FIRE corpus = 0 (unrealistic)
  if (fireCorpus <= 0) {
    issues.push({ type: 'ZERO_CORPUS', message: `FIRE corpus is ₹0 or negative — pension may fully cover all expenses (unrealistic?)` });
  }

  // Check: net worth at age 100 vs expenses at 100
  const nw100 = milestoneData.find(d => d.age === 100);
  const exp100 = nw100 ? nw100.plannedExpenses : 0;
  if (nw100 && nw100.netWorth < exp100 * 5 && nw100.netWorth > 0) {
    issues.push({ type: 'TIGHT_AT_100', message: `Net worth at 100 (${fmt(nw100.netWorth)}) barely covers 5 years of expenses (${fmt(exp100)}/yr)` });
  }

  // Check: post-retirement NW ever goes negative
  const postRetNeg = milestoneData.filter(d => d.age >= retAge && d.netWorth < 0);
  if (postRetNeg.length > 0) {
    const firstNeg = postRetNeg[0];
    issues.push({ type: 'CORPUS_DEPLETED', age: firstNeg.age, message: `Corpus depleted at age ${firstNeg.age} (year ${firstNeg.year}) — runs out of money` });
  }

  // Check: pre-retirement expensive years — use step-up-adjusted income
  const preRetMilestones = milestoneData.filter(d => d.age < retAge);
  for (const m of preRetMilestones) {
    const yearsFromStart = m.age - currentAge;
    const grownAnnualIncome = profile.monthly_income * 12 * Math.pow(1 + stepUpRate / 100, yearsFromStart);
    if (m.plannedExpenses > grownAnnualIncome * 1.5) {
      issues.push({ type: 'EXPENSE_EXCEEDS_INCOME', age: m.age, year: m.year, message: `Year ${m.year} (age ${m.age}): expenses ${fmt(m.plannedExpenses)} exceed 1.5x annual income ${fmt(grownAnnualIncome)}` });
    }
  }

  // Required SIP (binary search)
  let requiredSIP = 0;
  if (fireCorpus > 0) {
  let low = 0, high = 5000000;
  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    let nw = investableNetWorth;
    for (let age = currentAge; age <= retAge; age++) {
      const yearsFromStart = age - currentAge;
      let sip = 0;
      if (age <= sipStopAge) sip = mid * 12 * Math.pow(1 + stepUpRate / 100, yearsFromStart);
      const rr = age <= sipStopAge ? sipReturnRate : postSipReturnRate;
      const ret = Math.max(0, nw) * (rr / 100);
      nw = nw + ret + sip;
    }
    if (Math.abs(nw - fireCorpus) < 100) break;
    if (nw < fireCorpus) low = mid; else high = mid;
  }
  requiredSIP = Math.ceil((low + high) / 2);
  }

  // Bug #3: warn when required SIP exceeds or heavily burdens salary
  if (requiredSIP > profile.monthly_income) {
    issues.push({ type: 'SIP_EXCEEDS_SALARY', message: `Required SIP ${fmt(requiredSIP)}/month exceeds monthly salary ${fmt(profile.monthly_income)} — FIRE target not achievable on current income; consider a later retirement age or higher income` });
  } else if (requiredSIP > profile.monthly_income * 0.6) {
    issues.push({ type: 'HIGH_SIP_BURDEN', message: `Required SIP ${fmt(requiredSIP)}/month is ${Math.round(requiredSIP / profile.monthly_income * 100)}% of salary — high burden; consider extending retirement age` });
  }

  return {
    name,
    profile: { ...profile, currentAge },
    investableNetWorth,
    totalNetWorth,
    fireCorpus,
    fireAchievedAge,
    totalPV,
    requiredSIP,
    isOnTrack: sipAmount >= requiredSIP,
    sipAmount,
    sipReturnRate,
    postSipReturnRate,
    stepUpRate,
    pensionIncome: pensionPV,
    retirementAge: retAge,
    milestoneData,
    issues,
    expenseCount: expenses.length,
    assetCount: assets.length,
  };
}

module.exports = { runScenario, calculateExpenseForYear, fmt, getAge };
