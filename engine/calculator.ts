import { Asset, Expense, Goals, Profile } from '../db/queries';
import { FREQUENCIES } from '../constants/categories';

/** Inflation rate applied to pension income year-over-year (6%). */
export const PENSION_INFLATION_RATE = 0.06;

/** Discount rate used for PV / FIRE corpus calculations (6%). */
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
  /**
   * Combined outflow for chart visualisation.
   * Pre-retirement  = plannedExpenses (salary-funded lifestyle costs).
   * Post-retirement = pensionIncome + plannedExpenses (actual corpus drain).
   * One-time future expenses (house, wedding) create visible spikes.
   */
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
  /** PV of FUTURE one-time/recurring expenses that fall after retirement (corpus-funded). */
  postRetirementExpensesPV: number;
  /** Net worth used for FIRE projections — excludes self-use real estate. */
  investableNetWorth: number;
  /** Total net worth across all assets including self-use real estate. */
  totalNetWorth: number;
  /**
   * Warning when required SIP exceeds or heavily burdens monthly income.
   * null when there is no concern.
   */
  sipBurdenWarning: string | null;
  /** Projected net worth at retirement age (from projections loop). */
  netWorthAtRetirement: number;
  /** Projected net worth at age 100 — negative means corpus depleted before 100. */
  netWorthAtAge100: number;
}

function getAge(dob: string, onDate: Date = new Date()): number {
  const birth = new Date(dob);
  let age = onDate.getFullYear() - birth.getFullYear();
  const m = onDate.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && onDate.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function getFrequencyMultiplier(freq: string | null): number {
  if (!freq) return 12; // default monthly
  const found = FREQUENCIES.find(f => f.key === freq);
  return found ? found.multiplier : 12;
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
    const multiplier = getFrequencyMultiplier(expense.frequency);
    const endDate = expense.end_date ? new Date(expense.end_date) : null;
    const endYear = endDate ? endDate.getFullYear() : Infinity;
    if (targetYear > endYear) return 0;

    // Determine effective month range for this year
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

function calculateVestingForYear(assets: Asset[], targetYear: number): number {
  let total = 0;
  for (const asset of assets) {
    if (asset.category !== 'ESOP_RSU') continue;
    if (!asset.is_recurring || !asset.recurring_amount || !asset.next_vesting_date) continue;

    const vestingStart = new Date(asset.next_vesting_date);
    const vestingStartYear = vestingStart.getFullYear();
    if (targetYear < vestingStartYear) continue;

    if (asset.vesting_end_date) {
      const vestingEndYear = new Date(asset.vesting_end_date).getFullYear();
      if (targetYear > vestingEndYear) continue;
    }

    const freq = asset.recurring_frequency;
    const timesPerYear = getFrequencyMultiplier(freq);
    total += asset.recurring_amount * timesPerYear;
  }
  return total;
}

/** Safe Withdrawal Rates (%) for each FIRE type. */
export const FIRE_WITHDRAWAL_RATES: Record<string, number> = {
  fat: 3,
  moderate: 5,
  slim: 7,
};

/**
 * Calculate the FIRE corpus:
 *   Base  = pension / SWR  (sustains ongoing monthly withdrawals)
 *   Extra = PV of all FUTURE one-time/recurring expenses that fall at or after retirement
 *           (e.g. house purchase at 55, kid's college fees 52-56 post early-retirement)
 * CURRENT_RECURRING expenses are salary-funded and stop at retirement — excluded here.
 */
function calculateFireCorpus(
  pensionMonthly: number,
  yearsToRetirement: number,
  withdrawalRate: number,
  postRetirementExpensesPV: number,
): number {
  const pensionCorpus = (() => {
    if (pensionMonthly <= 0 || withdrawalRate <= 0) return 0;
    const firstYearWithdrawal = pensionMonthly * 12 * Math.pow(1 + PENSION_INFLATION_RATE, yearsToRetirement);
    return Math.ceil(firstYearWithdrawal / (withdrawalRate / 100));
  })();
  return pensionCorpus + postRetirementExpensesPV;
}

export function calculateProjections(input: CalculationInput): CalculationOutput {
  const { profile, assets, expenses, goals, sipAmount, sipReturnRate, postSipReturnRate, stepUpRate } = input;
  const currentAge = getAge(profile.dob);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const { retirement_age: retirementAge, sip_stop_age: sipStopAge } = goals;
  const withdrawalRate = goals.withdrawal_rate ?? 5;

  // Calculate initial net worth from all assets
  let initialNetWorth = 0;
  let investableNetWorth = 0;
  for (const asset of assets) {
    initialNetWorth += asset.current_value;
    if (asset.category !== 'REAL_ESTATE' || !asset.is_self_use) {
      investableNetWorth += asset.current_value;
    }
  }

  const monthlyPensionPV = goals.pension_income ?? 0;
  const discountRate = (goals.inflation_rate ?? (DEFAULT_DISCOUNT_RATE * 100)) / 100;

  // Split expenses by funding source:
  // - CURRENT_RECURRING: salary-funded, stop at retirement
  // - FUTURE (one-time or recurring): corpus-funded if they fall at/after retirement
  const currentExpenses = expenses.filter(e => e.expense_type === 'CURRENT_RECURRING');
  const futureExpenses  = expenses.filter(e => e.expense_type !== 'CURRENT_RECURRING');

  // PV of pre-retirement expenses (what salary must fund — for expenses banner)
  const retirementYear = currentYear + (retirementAge - currentAge);
  let presentValueOfExpenses = 0;
  for (let age = currentAge; age < retirementAge; age++) {
    const year = currentYear + (age - currentAge);
    let annualAmt = 0;
    for (const exp of currentExpenses) {
      annualAmt += calculateExpenseForYear(exp, year, currentYear, currentMonth);
    }
    // Include pre-retirement future expenses (salary-funded before retirement)
    for (const exp of futureExpenses) {
      annualAmt += calculateExpenseForYear(exp, year, currentYear, currentMonth);
    }
    const yearsFromNow = age - currentAge;
    presentValueOfExpenses += annualAmt / Math.pow(1 + discountRate, yearsFromNow);
  }

  // PV of post-retirement FUTURE expenses — these come from corpus
  // (e.g. house at 55 after retiring at 50, kid's college fees spanning retirement)
  let postRetirementExpensesPV = 0;
  for (let age = retirementAge; age <= 100; age++) {
    const year = currentYear + (age - currentAge);
    let annualAmt = 0;
    for (const exp of futureExpenses) {
      annualAmt += calculateExpenseForYear(exp, year, currentYear, currentMonth);
    }
    const yearsFromNow = age - currentAge;
    postRetirementExpensesPV += annualAmt / Math.pow(1 + discountRate, yearsFromNow);
  }

  // FIRE corpus = pension/SWR base + PV of corpus-funded post-retirement future expenses
  const fireCorpus = calculateFireCorpus(
    monthlyPensionPV,
    retirementAge - currentAge,
    withdrawalRate,
    postRetirementExpensesPV,
  );

  // Year-by-year projection
  const projections: YearProjection[] = [];
  let netWorth = investableNetWorth;
  let fireAchieved = false;
  let fireAchievedAge = -1;

  for (let age = currentAge; age <= 100; age++) {
    const year = currentYear + (age - currentAge);
    const yearsFromStart = age - currentAge;

    // Annual SIP
    let annualSIP = 0;
    if (age <= sipStopAge) {
      annualSIP = sipAmount * 12 * Math.pow(1 + stepUpRate / 100, yearsFromStart);
    }

    // Pre-retirement: current lifestyle expenses shown for planning (salary-funded)
    // Future expenses (one-time/recurring) shown pre-retirement too — salary-funded
    // Post-retirement: future expenses (house, college, etc.) drawn from corpus
    let plannedExpenses = 0;
    if (age < retirementAge) {
      for (const exp of currentExpenses) {
        plannedExpenses += calculateExpenseForYear(exp, year, currentYear, currentMonth);
      }
      for (const exp of futureExpenses) {
        plannedExpenses += calculateExpenseForYear(exp, year, currentYear, currentMonth);
      }
    } else {
      // Post-retirement: only future expenses drawn from corpus (current expenses stopped)
      for (const exp of futureExpenses) {
        plannedExpenses += calculateExpenseForYear(exp, year, currentYear, currentMonth);
      }
    }

    // Post-retirement: pension drawn from corpus each year (inflation-adjusted)
    let pensionIncome = 0;
    if (age >= retirementAge && monthlyPensionPV > 0) {
      pensionIncome = monthlyPensionPV * 12 * Math.pow(1 + PENSION_INFLATION_RATE, yearsFromStart);
    }

    // Vesting income
    const vestingIncome = calculateVestingForYear(assets, year);

    // Net worth calculation
    const returnRate = age <= sipStopAge ? sipReturnRate : postSipReturnRate;
    // Post-retirement corpus funds pension + any future expenses that year
    const totalNetExpenses = age >= retirementAge ? (pensionIncome + plannedExpenses) : 0;
    const returnOnInvestments = Math.max(0, netWorth) * (returnRate / 100);
    const expenseWithdrawal = totalNetExpenses;
    netWorth = netWorth + returnOnInvestments + annualSIP + vestingIncome - expenseWithdrawal;

    // Check FIRE
    const isFireThisYear = !fireAchieved && netWorth >= fireCorpus && fireCorpus > 0;
    if (isFireThisYear) {
      fireAchieved = true;
      fireAchievedAge = age;
    }

    projections.push({
      year,
      age,
      annualSIP,
      plannedExpenses,
      pensionIncome,
      totalNetExpenses,
      netWorthEOY: netWorth,
      vestingIncome,
      isFireAchieved: fireAchieved,
      totalOutflow: age >= retirementAge ? (pensionIncome + plannedExpenses) : plannedExpenses,
    });
  }

  // Extract snapshot values from projections
  const netWorthAtRetirement = projections.find(p => p.age === retirementAge)?.netWorthEOY ?? 0;
  const netWorthAtAge100 = projections[projections.length - 1]?.netWorthEOY ?? 0;

  // Calculate required monthly SIP using binary search targeting corpus survival to fire_target_age
  const fireTargetAge = goals.fire_target_age ?? 100;
  const requiredMonthlySIP = calculateRequiredSIP(
    investableNetWorth, assets, expenses,
    currentAge, currentYear, currentMonth, retirementAge, sipStopAge,
    sipReturnRate, postSipReturnRate, stepUpRate,
    monthlyPensionPV, fireTargetAge,
  );

  const timeToFire = fireAchievedAge >= 0 ? fireAchievedAge - currentAge : -1;

  let sipBurdenWarning: string | null = null;
  const monthlyIncome = profile.monthly_income;
  const cur = profile.currency;
  if (monthlyIncome > 0) {
    if (requiredMonthlySIP > monthlyIncome) {
      sipBurdenWarning = `Required SIP (${formatCurrency(requiredMonthlySIP, cur)}/mo) exceeds your monthly income (${formatCurrency(monthlyIncome, cur)}/mo). FIRE target is not achievable on your current income. Consider a later retirement age or increasing your income.`;
    } else if (requiredMonthlySIP > monthlyIncome * 0.6) {
      sipBurdenWarning = `Required SIP (${formatCurrency(requiredMonthlySIP, cur)}/mo) is ${Math.round(requiredMonthlySIP / monthlyIncome * 100)}% of your salary — a high burden. Consider extending your retirement age.`;
    } else {
      // Check combined SIP + current monthly expenses against income
      let monthlyExpenses = 0;
      for (const e of expenses) {
        if (e.expense_type !== 'CURRENT_RECURRING') continue;
        monthlyExpenses += e.amount * getFrequencyMultiplier(e.frequency ?? null) / 12;
      }
      const combined = requiredMonthlySIP + monthlyExpenses;
      if (monthlyExpenses > 0 && combined > monthlyIncome) {
        sipBurdenWarning = `Required SIP (${formatCurrency(requiredMonthlySIP, cur)}/mo) + current expenses (${formatCurrency(monthlyExpenses, cur)}/mo) = ${formatCurrency(combined, cur)}/mo, which exceeds your income (${formatCurrency(monthlyIncome, cur)}/mo). You may need to reduce expenses or extend your retirement age.`;
      } else if (monthlyExpenses > 0 && combined > monthlyIncome * 0.9) {
        sipBurdenWarning = `SIP + expenses leave less than 10% of your income (${formatCurrency(monthlyIncome, cur)}/mo) as buffer. Consider reviewing your targets.`;
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
  };
}

export function calculatePresentValueOfExpenses(
  profile: Profile,
  expenses: Expense[],
  retirementAge: number = 60,
  discountRate: number = DEFAULT_DISCOUNT_RATE,
): number {
  const currentAge = getAge(profile.dob);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  let pv = 0;
  // Expenses are pre-retirement only
  for (let age = currentAge; age < retirementAge; age++) {
    const year = currentYear + (age - currentAge);
    let annualExpenses = 0;
    for (const exp of expenses) {
      annualExpenses += calculateExpenseForYear(exp, year, currentYear, currentMonth);
    }
    pv += annualExpenses / Math.pow(1 + discountRate, age - currentAge);
  }
  return pv;
}

/**
 * Binary search for the monthly SIP that keeps corpus ≥ 0 at fireTargetAge.
 * Runs the full pre + post retirement lifecycle — the only honest way to size SIP.
 */
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
): number {
  // If corpus already survives to target age with zero SIP, no SIP needed
  const withNoSip = simulateCorpusAtAge(
    initialNetWorth, assets, expenses,
    currentAge, currentYear, currentMonth, retirementAge, sipStopAge,
    sipReturnRate, postSipReturnRate, stepUpRate, 0, monthlyPension, fireTargetAge,
  );
  if (withNoSip >= 0) return 0;

  let low = 0;
  let high = 5000000; // ₹50L/month cap
  const tolerance = 1000; // within ₹1K corpus at target age is close enough

  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    const corpus = simulateCorpusAtAge(
      initialNetWorth, assets, expenses,
      currentAge, currentYear, currentMonth, retirementAge, sipStopAge,
      sipReturnRate, postSipReturnRate, stepUpRate, mid, monthlyPension, fireTargetAge,
    );

    if (Math.abs(corpus) < tolerance) return Math.ceil(mid);
    if (corpus < 0) low = mid;
    else high = mid;
  }

  return Math.ceil((low + high) / 2);
}

/**
 * Simulate the full lifecycle corpus (pre + post retirement) at a given target age.
 * Pre-retirement: SIP + returns + vesting (expenses salary-funded, not deducted).
 * Post-retirement: returns − pension withdrawal − future expense dips.
 * Returns the corpus value at targetAge (negative = depleted).
 */
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
): number {
  const futureExpenses = expenses.filter(e => e.expense_type !== 'CURRENT_RECURRING');
  let netWorth = initialNetWorth;

  for (let age = currentAge; age <= targetAge; age++) {
    const year = currentYear + (age - currentAge);
    const yearsFromStart = age - currentAge;

    // SIP contribution (stops at sipStopAge)
    let annualSIP = 0;
    if (age <= sipStopAge) {
      annualSIP = monthlySIP * 12 * Math.pow(1 + stepUpRate / 100, yearsFromStart);
    }

    const vestingIncome = calculateVestingForYear(assets, year);
    const returnRate = age <= sipStopAge ? sipReturnRate : postSipReturnRate;
    const returnOnInvestments = Math.max(0, netWorth) * (returnRate / 100);

    // Post-retirement: deduct pension + future expense dips from corpus
    let withdrawal = 0;
    if (age >= retirementAge) {
      if (monthlyPension > 0) {
        withdrawal += monthlyPension * 12 * Math.pow(1 + PENSION_INFLATION_RATE, yearsFromStart);
      }
      for (const exp of futureExpenses) {
        withdrawal += calculateExpenseForYear(exp, year, currentYear, currentMonth);
      }
    }

    netWorth = netWorth + returnOnInvestments + annualSIP + vestingIncome - withdrawal;
  }

  return netWorth;
}

export function formatCurrency(amount: number, currency: string = 'INR'): string {
  if (currency === 'INR') {
    const abs = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
    if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
    if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}K`;
    return `${sign}₹${abs.toFixed(0)}`;
  }
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function formatCurrencyFull(amount: number, currency: string = 'INR'): string {
  if (currency === 'INR') {
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
