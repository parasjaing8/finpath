import {
  Asset,
  Expense,
  Goals,
  Profile,
  FrequencyInput,
  FREQUENCY_TO_PAYMENTS_PER_YEAR,
  DEFAULT_GROWTH_RATES,
} from './types';

export const PENSION_INFLATION_RATE = 0.06;
export const DEFAULT_DISCOUNT_RATE = 0.06;

export interface CalculationInput {
  profile: Profile;
  assets: Asset[];
  expenses: Expense[];
  goals: Goals;
  sipAmount: number;
  sipReturnRate: number;
  postSipReturnRate: number;
  stepUpRate: number;
}

export interface YearProjection {
  year: number;
  age: number;
  annualSIP: number;
  plannedExpenses: number;
  pensionIncome: number;
  totalNetExpenses: number;
  netWorthEOY: number;
  vestingIncome: number;
  isFireAchieved: boolean;
  totalOutflow: number;
}

export interface CalculationOutput {
  fireCorpus: number;
  requiredMonthlySIP: number;
  timeToFire: number;
  fireAchievedAge: number;
  isOnTrack: boolean;
  projections: YearProjection[];
  presentValueOfExpenses: number;
  postRetirementExpensesPV: number;
  investableNetWorth: number;
  totalNetWorth: number;
  sipBurdenWarning: string | null;
  netWorthAtRetirement: number;
  netWorthAtAge100: number;
  failureAge: number;
}

/**
 * Compute integer age from a YYYY-MM-DD date of birth.
 * The single source of truth — UI screens import this from here rather than
 * duplicating their own date arithmetic.
 */
export function getAge(dob: string, onDate: Date = new Date()): number {
  const birth = new Date(dob);
  let age = onDate.getFullYear() - birth.getFullYear();
  const m = onDate.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && onDate.getDate() < birth.getDate())) age--;
  return age;
}

function getFrequencyMultiplier(freq: string | null): number {
  // Map-based lookup that accepts both canonical (`MONTHLY`/`ANNUALLY`) and
  // legacy aliases (`ANNUAL`/`YEARLY`) for backward-compat with persisted data.
  // Returns payments-per-year. Defaults to 12 (monthly) when missing/unknown.
  if (!freq) return 12;
  const m = FREQUENCY_TO_PAYMENTS_PER_YEAR[freq as FrequencyInput];
  return typeof m === 'number' ? m : 12;
}

function calculateExpenseForYear(
  expense: Expense,
  targetYear: number,
  currentYear: number,
  currentMonth: number = 0,
): number {
  const yearsFromNow = targetYear - currentYear;
  if (yearsFromNow < 0) return 0;
  const inflationRate = expense.inflation_rate / 100;

  if (expense.expense_type === 'CURRENT_RECURRING') {
    const multiplier = getFrequencyMultiplier(expense.frequency ?? null);
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
    const startDate = new Date(expense.start_date);
    const startYear = startDate.getFullYear();
    if (targetYear === startYear) {
      const startMonth = startDate.getMonth();
      const fractionalYears = yearsFromNow + (startMonth - currentMonth) / 12;
      return expense.amount * Math.pow(1 + inflationRate, Math.max(0, fractionalYears));
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
    const multiplier = getFrequencyMultiplier(expense.frequency ?? null);
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

function calculateVestingForYear(assets: Asset[], targetYear: number): number {
  let total = 0;
  for (const asset of assets) {
    if (asset.category !== 'ESOP_RSU') continue;
    if (!asset.is_recurring || !asset.recurring_amount || !asset.next_vesting_date) continue;
    const vestingStart = new Date(asset.next_vesting_date);
    const vestingStartYear = vestingStart.getFullYear();
    if (targetYear < vestingStartYear) continue;
    const vestingEnd = asset.vesting_end_date ? new Date(asset.vesting_end_date) : null;
    const vestingEndYear = vestingEnd ? vestingEnd.getFullYear() : null;
    if (vestingEndYear != null && targetYear > vestingEndYear) continue;
    const timesPerYear = getFrequencyMultiplier(asset.recurring_frequency ?? null);

    // Apply a month fraction in the start year and end year so partial years
    // don't get a full year of vesting income.
    const firstMonth = targetYear === vestingStartYear ? vestingStart.getMonth() : 0;
    const lastMonth = vestingEnd && targetYear === vestingEndYear ? vestingEnd.getMonth() : 11;
    const months = Math.max(0, lastMonth - firstMonth + 1);
    const monthFraction = months / 12;

    total += asset.recurring_amount * timesPerYear * monthFraction;
  }
  return total;
}

function computeBlendedGrowthRate(assets: Asset[], fallbackRate: number): number {
  const investable = assets.filter(a => !(a.category === 'REAL_ESTATE' && a.is_self_use));
  const totalValue = investable.reduce((s, a) => s + a.current_value, 0);
  if (totalValue === 0) return fallbackRate;
  const weighted = investable.reduce((s, a) => {
    // Honor a user-set ROI even when it is exactly 0 (e.g. cash sitting idle).
    // Only fall back to the category default when the value is truly missing
    // or non-finite.
    const userRoi = a.expected_roi;
    const roi = Number.isFinite(userRoi)
      ? userRoi
      : (DEFAULT_GROWTH_RATES[a.category] ?? fallbackRate);
    return s + a.current_value * roi;
  }, 0);
  return weighted / totalValue;
}

function simulatePostRetirementCorpus(
  startCorpus: number,
  retirementAge: number,
  targetAge: number,
  currentAge: number,
  currentYear: number,
  currentMonth: number,
  postSipReturnRate: number,
  inflationRate: number,
  monthlyPension: number,
  expenses: Expense[],
): number {
  const futureExpenses = expenses.filter(e => e.expense_type !== 'CURRENT_RECURRING');
  let corpus = startCorpus;
  for (let age = retirementAge; age <= targetAge; age++) {
    const year = currentYear + (age - currentAge);
    const yearsFromStart = age - currentAge;
    let withdrawal = 0;
    if (monthlyPension > 0)
      withdrawal += monthlyPension * 12 * Math.pow(1 + inflationRate, yearsFromStart);
    for (const exp of futureExpenses)
      withdrawal += calculateExpenseForYear(exp, year, currentYear, currentMonth);
    corpus = corpus * (1 + postSipReturnRate / 100) - withdrawal;
  }
  return corpus;
}

function calculateSimulationFireCorpus(
  expenses: Expense[],
  currentAge: number,
  currentYear: number,
  currentMonth: number,
  retirementAge: number,
  postSipReturnRate: number,
  monthlyPension: number,
  fireTargetAge: number,
  inflationRate: number,
  fireType: string,
): number {
  if (monthlyPension <= 0) return 0;
  const isRich = fireType === 'fat';
  function residual(corpus: number): number {
    const final = simulatePostRetirementCorpus(
      corpus, retirementAge, fireTargetAge,
      currentAge, currentYear, currentMonth,
      postSipReturnRate, inflationRate, monthlyPension, expenses,
    );
    return isRich ? final - corpus : final;
  }
  // Adaptive upper bound: corpus required scales with annual cash need.
  // Cover at least (years × annual need × inflation overshoot) and grow until
  // residual flips sign, so very-high net worth users are covered.
  const yearsInRetirement = Math.max(1, fireTargetAge - retirementAge);
  const annualNeed = Math.max(1, monthlyPension * 12);
  let high = annualNeed * yearsInRetirement * Math.pow(1 + Math.max(inflationRate, 0.02), yearsInRetirement);
  // Ensure the bound actually brackets the root.
  for (let i = 0; i < 8 && residual(high) < 0; i++) high *= 4;
  let low = 0;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    const r = residual(mid);
    if (Math.abs(r) < 10_000) return Math.ceil(mid);
    if (r < 0) low = mid; else high = mid;
  }
  return Math.ceil((low + high) / 2);
}

function simulateCorpusAtAge(
  initialNetWorth: number,
  assets: Asset[],
  expenses: Expense[],
  currentAge: number,
  currentYear: number,
  currentMonth: number,
  retirementAge: number,
  sipStopAge: number,
  sipReturnRate: number,
  postSipReturnRate: number,
  stepUpRate: number,
  monthlySIP: number,
  monthlyPension: number,
  targetAge: number,
  inflationRate: number,
  blendedRate?: number,
): number {
  const futureExpenses = expenses.filter(e => e.expense_type !== 'CURRENT_RECURRING');
  const existingRate = blendedRate ?? sipReturnRate;
  let existingBucket = initialNetWorth;
  let sipBucket = 0;
  let merged = false;

  for (let age = currentAge; age <= targetAge; age++) {
    const year = currentYear + (age - currentAge);
    const yearsFromStart = age - currentAge;
    const monthsThisYear = yearsFromStart === 0 ? (12 - currentMonth) : 12;
    let annualSIP = 0;
    if (age <= sipStopAge) {
      const monthlyContrib = monthlySIP * Math.pow(1 + stepUpRate / 100, yearsFromStart);
      const monthlyRate = Math.pow(1 + sipReturnRate / 100, 1 / 12) - 1;
      annualSIP = monthlyRate > 0
        ? monthlyContrib * (Math.pow(1 + monthlyRate, monthsThisYear) - 1) / monthlyRate
        : monthlyContrib * monthsThisYear;
    }
    const vestingIncome = calculateVestingForYear(assets, year);

    if (age >= retirementAge && !merged) {
      if (age <= sipStopAge) existingBucket += annualSIP;
      existingBucket = existingBucket + sipBucket;
      sipBucket = 0;
      merged = true;
    }

    let withdrawal = 0;
    if (age >= retirementAge) {
      if (monthlyPension > 0)
        withdrawal += monthlyPension * 12 * Math.pow(1 + inflationRate, yearsFromStart);
      for (const exp of futureExpenses)
        withdrawal += calculateExpenseForYear(exp, year, currentYear, currentMonth);
    }

    if (!merged) {
      const er = age <= sipStopAge ? existingRate / 100 : postSipReturnRate / 100;
      const sr = age <= sipStopAge ? sipReturnRate / 100 : postSipReturnRate / 100;
      let preRetFutureCost = 0;
      for (const exp of futureExpenses)
        preRetFutureCost += calculateExpenseForYear(exp, year, currentYear, currentMonth);
      const yearFraction = yearsFromStart === 0 ? monthsThisYear / 12 : 1;
      const erAdj = Math.pow(1 + er, yearFraction) - 1;
      const grownExisting = Math.max(0, existingBucket) * (1 + erAdj) + vestingIncome - preRetFutureCost;
      if (grownExisting < 0) {
        existingBucket = 0;
        sipBucket = Math.max(0, sipBucket) * (1 + sr) + annualSIP + grownExisting;
      } else {
        existingBucket = grownExisting;
        sipBucket = Math.max(0, sipBucket) * (1 + sr) + annualSIP;
      }
    } else {
      existingBucket = Math.max(0, existingBucket) * (1 + postSipReturnRate / 100) + vestingIncome - withdrawal;
    }
  }
  return existingBucket + sipBucket;
}

function calculateRequiredSIP(
  initialNetWorth: number,
  assets: Asset[],
  expenses: Expense[],
  currentAge: number,
  currentYear: number,
  currentMonth: number,
  retirementAge: number,
  sipStopAge: number,
  sipReturnRate: number,
  postSipReturnRate: number,
  stepUpRate: number,
  monthlyPension: number,
  fireTargetAge: number,
  inflationRate: number,
): number {
  const blendedRate = computeBlendedGrowthRate(assets, sipReturnRate);
  const withNoSip = simulateCorpusAtAge(
    initialNetWorth, assets, expenses,
    currentAge, currentYear, currentMonth, retirementAge, sipStopAge,
    sipReturnRate, postSipReturnRate, stepUpRate, 0, monthlyPension, fireTargetAge, inflationRate, blendedRate,
  );
  if (withNoSip >= 0) return 0;

  // Adaptive upper bound for monthly SIP: scale with the magnitude of the
  // shortfall so very-high net-worth shortfalls don't get clipped at a
  // hardcoded ceiling.
  const yearsInvesting = Math.max(1, sipStopAge - currentAge);
  const shortfallProxy = Math.abs(withNoSip);
  // Spread the shortfall across investing months, then add a 4× safety margin
  // before growth helps. Floor at ₹5M/mo so small shortfalls still converge fast.
  let high = Math.max(5_000_000, (shortfallProxy / Math.max(1, yearsInvesting * 12)) * 4);
  // Ensure the bound brackets the root (corpus(high) >= 0).
  for (let i = 0; i < 8; i++) {
    const corpus = simulateCorpusAtAge(
      initialNetWorth, assets, expenses,
      currentAge, currentYear, currentMonth, retirementAge, sipStopAge,
      sipReturnRate, postSipReturnRate, stepUpRate, high, monthlyPension, fireTargetAge, inflationRate, blendedRate,
    );
    if (corpus >= 0) break;
    high *= 4;
  }
  let low = 0;
  const tolerance = 1000;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    const corpus = simulateCorpusAtAge(
      initialNetWorth, assets, expenses,
      currentAge, currentYear, currentMonth, retirementAge, sipStopAge,
      sipReturnRate, postSipReturnRate, stepUpRate, mid, monthlyPension, fireTargetAge, inflationRate, blendedRate,
    );
    if (Math.abs(corpus) < tolerance) return Math.ceil(mid);
    if (corpus < 0) low = mid; else high = mid;
  }
  return Math.ceil((low + high) / 2);
}

export function calculateProjections(input: CalculationInput): CalculationOutput {
  const { profile, assets, expenses, goals, sipAmount, sipReturnRate, postSipReturnRate, stepUpRate } = input;
  const currentAge = getAge(profile.dob);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const { retirement_age: retirementAge, sip_stop_age: sipStopAge } = goals;

  let initialNetWorth = 0;
  let investableNetWorth = 0;
  for (const asset of assets) {
    initialNetWorth += asset.current_value;
    if (asset.category !== 'REAL_ESTATE' || !asset.is_self_use)
      investableNetWorth += asset.current_value;
  }

  const monthlyPensionPV = goals.pension_income ?? 0;
  const discountRate = (goals.inflation_rate ?? (DEFAULT_DISCOUNT_RATE * 100)) / 100;

  const currentExpenses = expenses.filter(e => e.expense_type === 'CURRENT_RECURRING');
  const futureExpenses = expenses.filter(e => e.expense_type !== 'CURRENT_RECURRING');

  let presentValueOfExpenses = 0;
  for (let age = currentAge; age < retirementAge; age++) {
    const year = currentYear + (age - currentAge);
    let annualAmt = 0;
    for (const exp of currentExpenses)
      annualAmt += calculateExpenseForYear(exp, year, currentYear, currentMonth);
    const yearsFromNow = age - currentAge;
    presentValueOfExpenses += annualAmt / Math.pow(1 + discountRate, yearsFromNow);
  }

  let postRetirementExpensesPV = 0;
  for (let age = retirementAge; age <= 100; age++) {
    const year = currentYear + (age - currentAge);
    let annualAmt = 0;
    for (const exp of futureExpenses)
      annualAmt += calculateExpenseForYear(exp, year, currentYear, currentMonth);
    const yearsFromNow = age - currentAge;
    postRetirementExpensesPV += annualAmt / Math.pow(1 + discountRate, yearsFromNow);
  }

  const fireTargetAge = goals.fire_target_age ?? 100;
  const fireCorpus = calculateSimulationFireCorpus(
    expenses, currentAge, currentYear, currentMonth,
    retirementAge, postSipReturnRate, monthlyPensionPV,
    fireTargetAge, discountRate, goals.fire_type ?? 'moderate',
  );

  const blendedExistingRate = computeBlendedGrowthRate(assets, sipReturnRate);

  const projections: YearProjection[] = [];
  let existingBucket = investableNetWorth;
  let sipBucket = 0;
  let retirementMerged = false;
  let fireAchieved = false;
  let fireAchievedAge = -1;
  let failureAge = -1;

  for (let age = currentAge; age <= 100; age++) {
    const year = currentYear + (age - currentAge);
    const yearsFromStart = age - currentAge;
    const monthsThisYear = yearsFromStart === 0 ? (12 - currentMonth) : 12;

    let annualSIP = 0;
    if (age <= sipStopAge) {
      const monthlyContrib = sipAmount * Math.pow(1 + stepUpRate / 100, yearsFromStart);
      const monthlyRate = Math.pow(1 + sipReturnRate / 100, 1 / 12) - 1;
      annualSIP = monthlyRate > 0
        ? monthlyContrib * (Math.pow(1 + monthlyRate, monthsThisYear) - 1) / monthlyRate
        : monthlyContrib * monthsThisYear;
    }

    let plannedExpenses = 0;
    if (age < retirementAge) {
      for (const exp of currentExpenses)
        plannedExpenses += calculateExpenseForYear(exp, year, currentYear, currentMonth);
      for (const exp of futureExpenses)
        plannedExpenses += calculateExpenseForYear(exp, year, currentYear, currentMonth);
    } else {
      for (const exp of futureExpenses)
        plannedExpenses += calculateExpenseForYear(exp, year, currentYear, currentMonth);
    }

    let pensionIncome = 0;
    if (age >= retirementAge && monthlyPensionPV > 0)
      pensionIncome = monthlyPensionPV * 12 * Math.pow(1 + discountRate, yearsFromStart);

    const vestingIncome = calculateVestingForYear(assets, year);

    let preRetFutureCost = 0;
    if (age < retirementAge) {
      for (const exp of futureExpenses)
        preRetFutureCost += calculateExpenseForYear(exp, year, currentYear, currentMonth);
    }
    const totalNetExpenses = age >= retirementAge ? (pensionIncome + plannedExpenses) : preRetFutureCost;

    if (age >= retirementAge && !retirementMerged) {
      if (age <= sipStopAge) existingBucket += annualSIP;
      existingBucket = existingBucket + sipBucket;
      sipBucket = 0;
      retirementMerged = true;
    }

    if (!retirementMerged) {
      const er = age <= sipStopAge ? blendedExistingRate / 100 : postSipReturnRate / 100;
      const sr = age <= sipStopAge ? sipReturnRate / 100 : postSipReturnRate / 100;
      const yearFraction = yearsFromStart === 0 ? monthsThisYear / 12 : 1;
      const erAdj = Math.pow(1 + er, yearFraction) - 1;
      const grownExisting = Math.max(0, existingBucket) * (1 + erAdj) + vestingIncome - preRetFutureCost;
      if (grownExisting < 0) {
        existingBucket = 0;
        sipBucket = Math.max(0, sipBucket) * (1 + sr) + annualSIP + grownExisting;
      } else {
        existingBucket = grownExisting;
        sipBucket = Math.max(0, sipBucket) * (1 + sr) + annualSIP;
      }
    } else {
      const newCorpus = Math.max(0, existingBucket) * (1 + postSipReturnRate / 100) + vestingIncome - totalNetExpenses;
      if (newCorpus < 0 && failureAge === -1) failureAge = age;
      existingBucket = Math.max(0, newCorpus);
    }

    const netWorth = existingBucket + sipBucket;
    const isFireThisYear = !fireAchieved && netWorth >= fireCorpus && fireCorpus > 0;
    if (isFireThisYear) { fireAchieved = true; fireAchievedAge = age; }

    projections.push({
      year, age, annualSIP, plannedExpenses, pensionIncome,
      totalNetExpenses, netWorthEOY: netWorth, vestingIncome,
      isFireAchieved: fireAchieved,
      totalOutflow: age >= retirementAge ? (pensionIncome + plannedExpenses) : plannedExpenses,
    });
  }

  const netWorthAtRetirement = projections.find(p => p.age === retirementAge)?.netWorthEOY ?? 0;
  const netWorthAtAge100 = projections[projections.length - 1]?.netWorthEOY ?? 0;

  const requiredMonthlySIP = calculateRequiredSIP(
    investableNetWorth, assets, expenses,
    currentAge, currentYear, currentMonth, retirementAge, sipStopAge,
    sipReturnRate, postSipReturnRate, stepUpRate,
    monthlyPensionPV, fireTargetAge, discountRate,
  );

  const timeToFire = fireAchievedAge >= 0 ? fireAchievedAge - currentAge : -1;

  let sipBurdenWarning: string | null = null;
  const monthlyIncome = profile.monthly_income;
  const cur = profile.currency;
  if (monthlyIncome > 0) {
    if (requiredMonthlySIP > monthlyIncome) {
      sipBurdenWarning = `Required SIP (${formatCurrency(requiredMonthlySIP, cur)}/mo) exceeds your monthly income (${formatCurrency(monthlyIncome, cur)}/mo). Consider a later retirement age or increasing your income.`;
    } else if (requiredMonthlySIP > monthlyIncome * 0.6) {
      sipBurdenWarning = `Required SIP (${formatCurrency(requiredMonthlySIP, cur)}/mo) is ${Math.round(requiredMonthlySIP / monthlyIncome * 100)}% of your salary — a high burden.`;
    } else {
      let monthlyExpenses = 0;
      for (const e of expenses) {
        if (e.expense_type !== 'CURRENT_RECURRING') continue;
        monthlyExpenses += e.amount * getFrequencyMultiplier(e.frequency ?? null) / 12;
      }
      const combined = requiredMonthlySIP + monthlyExpenses;
      if (monthlyExpenses > 0 && combined > monthlyIncome) {
        sipBurdenWarning = `Required SIP (${formatCurrency(requiredMonthlySIP, cur)}/mo) + current expenses (${formatCurrency(monthlyExpenses, cur)}/mo) = ${formatCurrency(combined, cur)}/mo, which exceeds your income (${formatCurrency(monthlyIncome, cur)}/mo).`;
      } else if (monthlyExpenses > 0 && combined > monthlyIncome * 0.9) {
        sipBurdenWarning = `SIP + expenses leave less than 10% of your income as buffer. Consider reviewing your targets.`;
      }
    }
  }

  return {
    fireCorpus,
    requiredMonthlySIP,
    timeToFire,
    fireAchievedAge,
    isOnTrack: sipAmount >= requiredMonthlySIP,
    projections,
    presentValueOfExpenses,
    postRetirementExpensesPV,
    investableNetWorth,
    totalNetWorth: initialNetWorth,
    sipBurdenWarning,
    netWorthAtRetirement,
    netWorthAtAge100,
    failureAge,
  };
}

interface CurrencyMeta {
  symbol: string;
  locale: string;
  // Optional short-scale labels (e.g. Lakh/Crore for INR).
  shortScale?: { divisor: number; suffix: string }[];
}

const CURRENCY_META: Record<string, CurrencyMeta> = {
  INR: {
    symbol: '₹',
    locale: 'en-IN',
    shortScale: [
      { divisor: 1e7, suffix: ' Cr' },
      { divisor: 1e5, suffix: ' L' },
      { divisor: 1e3, suffix: 'K' },
    ],
  },
  USD: {
    symbol: '$',
    locale: 'en-US',
    shortScale: [
      { divisor: 1e9, suffix: 'B' },
      { divisor: 1e6, suffix: 'M' },
      { divisor: 1e3, suffix: 'K' },
    ],
  },
  EUR: { symbol: '€', locale: 'de-DE', shortScale: [{ divisor: 1e9, suffix: 'B' }, { divisor: 1e6, suffix: 'M' }, { divisor: 1e3, suffix: 'K' }] },
  GBP: { symbol: '£', locale: 'en-GB', shortScale: [{ divisor: 1e9, suffix: 'B' }, { divisor: 1e6, suffix: 'M' }, { divisor: 1e3, suffix: 'K' }] },
  AUD: { symbol: 'A$', locale: 'en-AU', shortScale: [{ divisor: 1e9, suffix: 'B' }, { divisor: 1e6, suffix: 'M' }, { divisor: 1e3, suffix: 'K' }] },
  CAD: { symbol: 'C$', locale: 'en-CA', shortScale: [{ divisor: 1e9, suffix: 'B' }, { divisor: 1e6, suffix: 'M' }, { divisor: 1e3, suffix: 'K' }] },
  SGD: { symbol: 'S$', locale: 'en-SG', shortScale: [{ divisor: 1e9, suffix: 'B' }, { divisor: 1e6, suffix: 'M' }, { divisor: 1e3, suffix: 'K' }] },
  AED: { symbol: 'د.إ', locale: 'ar-AE', shortScale: [{ divisor: 1e9, suffix: 'B' }, { divisor: 1e6, suffix: 'M' }, { divisor: 1e3, suffix: 'K' }] },
};

function getMeta(currency: string): CurrencyMeta {
  return CURRENCY_META[currency.toUpperCase()] ?? { symbol: currency + ' ', locale: 'en-US' };
}

export function formatCurrency(amount: number, currency: string = 'INR'): string {
  if (!Number.isFinite(amount)) return '—';
  const meta = getMeta(currency);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (meta.shortScale) {
    for (const s of meta.shortScale) {
      if (abs >= s.divisor) {
        const v = abs / s.divisor;
        const fixed = v >= 100 ? 0 : v >= 10 ? 1 : 2;
        return `${sign}${meta.symbol}${v.toFixed(fixed)}${s.suffix}`;
      }
    }
  }
  return `${sign}${meta.symbol}${abs.toLocaleString(meta.locale, { maximumFractionDigits: 0 })}`;
}

export function formatCurrencyFull(amount: number, currency: string = 'INR'): string {
  if (!Number.isFinite(amount)) return '—';
  const meta = getMeta(currency);
  return `${meta.symbol}${amount.toLocaleString(meta.locale, { maximumFractionDigits: 0 })}`;
}

export function getCurrencySymbol(currency: string = 'INR'): string {
  return getMeta(currency).symbol;
}
