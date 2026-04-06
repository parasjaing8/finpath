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
}

export interface CalculationOutput {
  fireCorpus: number;
  requiredMonthlySIP: number;
  timeToFire: number;
  fireAchievedAge: number;
  isOnTrack: boolean;
  projections: YearProjection[];
  presentValueOfExpenses: number;
  /** Net worth used for FIRE projections — excludes self-use real estate. */
  investableNetWorth: number;
  /** Total net worth across all assets including self-use real estate. */
  totalNetWorth: number;
  /**
   * Warning when required SIP exceeds or heavily burdens monthly income.
   * null when there is no concern.
   */
  sipBurdenWarning: string | null;
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
 * Calculate the FIRE corpus using the Safe Withdrawal Rate (SWR) approach.
 * corpus = first-year total withdrawal at retirement / (SWR / 100).
 * All FIRE types target age 100; the SWR determines corpus size.
 */
function calculateFireCorpus(
  expenses: Expense[],
  pensionMonthly: number,
  currentAge: number,
  retirementAge: number,
  currentYear: number,
  currentMonth: number,
  _returnRate: number,
  withdrawalRate: number = 5,
): number {
  if (expenses.length === 0 && pensionMonthly === 0) return 0;
  if (withdrawalRate <= 0) return 0;

  // Compute first-year withdrawal at retirement
  const retirementYear = currentYear + (retirementAge - currentAge);
  const yearsToRetirement = retirementAge - currentAge;

  let firstYearExpenses = 0;
  for (const exp of expenses) {
    firstYearExpenses += calculateExpenseForYear(exp, retirementYear, currentYear, currentMonth);
  }

  const firstYearPension = pensionMonthly * 12 * Math.pow(1 + PENSION_INFLATION_RATE, yearsToRetirement);
  const firstYearWithdrawal = firstYearExpenses + firstYearPension;

  return Math.ceil(firstYearWithdrawal / (withdrawalRate / 100));
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

  const pureExpenses = expenses;
  const monthlyPensionPV = goals.pension_income ?? 0;
  const discountRate = postSipReturnRate / 100;

  // Calculate FIRE corpus using Safe Withdrawal Rate (SWR).
  // corpus = first-year withdrawal at retirement / (SWR / 100).
  // Pension is a desired withdrawal FROM corpus, not external income.
  const fireCorpus = calculateFireCorpus(
    pureExpenses, monthlyPensionPV,
    currentAge, retirementAge, currentYear, currentMonth, postSipReturnRate, withdrawalRate,
  );

  // Calculate present value of ALL lifetime expenses (for expenses page banner)
  let presentValueOfExpenses = 0;
  for (let age = currentAge; age <= 100; age++) {
    const year = currentYear + (age - currentAge);
    let annualExpenses = 0;
    for (const exp of pureExpenses) {
      annualExpenses += calculateExpenseForYear(exp, year, currentYear, currentMonth);
    }
    const yearsFromNow = age - currentAge;
    presentValueOfExpenses += annualExpenses / Math.pow(1 + discountRate, yearsFromNow);
  }

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

    // Expenses this year
    let plannedExpenses = 0;
    for (const exp of pureExpenses) {
      plannedExpenses += calculateExpenseForYear(exp, year, currentYear, currentMonth);
    }

    // Pension = desired monthly withdrawal from corpus, inflation-adjusted
    let pensionIncome = 0;
    if (age >= retirementAge && monthlyPensionPV > 0) {
      pensionIncome = monthlyPensionPV * 12 * Math.pow(1 + PENSION_INFLATION_RATE, yearsFromStart);
    }

    // Vesting income
    const vestingIncome = calculateVestingForYear(assets, year);

    // Net worth calculation
    const returnRate = age <= sipStopAge ? sipReturnRate : postSipReturnRate;
    // Post-retirement: withdraw both expenses AND pension from corpus
    const totalNetExpenses = plannedExpenses + pensionIncome;
    const returnOnInvestments = Math.max(0, netWorth) * (returnRate / 100);
    // Pre-retirement: salary covers expenses; SIP already nets them out
    const expenseWithdrawal = age >= retirementAge ? totalNetExpenses : 0;
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
    });
  }

  // Calculate required monthly SIP using binary search
  const requiredMonthlySIP = calculateRequiredSIP(
    investableNetWorth, assets,
    currentAge, currentYear, retirementAge, sipStopAge,
    sipReturnRate, postSipReturnRate, stepUpRate, fireCorpus
  );

  const timeToFire = fireAchievedAge >= 0 ? fireAchievedAge - currentAge : -1;

  let sipBurdenWarning: string | null = null;
  const monthlyIncome = profile.monthly_income;
  if (monthlyIncome > 0) {
    if (requiredMonthlySIP > monthlyIncome) {
      sipBurdenWarning = `Required SIP (₹${Math.round(requiredMonthlySIP / 1000)}K/mo) exceeds your monthly income (₹${Math.round(monthlyIncome / 1000)}K/mo). FIRE target is not achievable on your current income. Consider a later retirement age or increasing your income.`;
    } else if (requiredMonthlySIP > monthlyIncome * 0.6) {
      sipBurdenWarning = `Required SIP (₹${Math.round(requiredMonthlySIP / 1000)}K/mo) is ${Math.round(requiredMonthlySIP / monthlyIncome * 100)}% of your salary — a high burden. Consider extending your retirement age.`;
    } else {
      // Check combined SIP + current monthly expenses against income
      let monthlyExpenses = 0;
      for (const e of expenses) {
        if (e.expense_type !== 'CURRENT_RECURRING') continue;
        monthlyExpenses += e.amount * getFrequencyMultiplier(e.frequency ?? null) / 12;
      }
      const combined = requiredMonthlySIP + monthlyExpenses;
      if (monthlyExpenses > 0 && combined > monthlyIncome) {
        sipBurdenWarning = `Required SIP (₹${Math.round(requiredMonthlySIP / 1000)}K/mo) + current expenses (₹${Math.round(monthlyExpenses / 1000)}K/mo) = ₹${Math.round(combined / 1000)}K/mo, which exceeds your income (₹${Math.round(monthlyIncome / 1000)}K/mo). You may need to reduce expenses or extend your retirement age.`;
      } else if (monthlyExpenses > 0 && combined > monthlyIncome * 0.9) {
        sipBurdenWarning = `SIP + expenses leave less than 10% of your income (₹${Math.round(monthlyIncome / 1000)}K/mo) as buffer. Consider reviewing your targets.`;
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
    investableNetWorth,
    totalNetWorth: initialNetWorth,
    sipBurdenWarning,
  };
}

export function calculatePresentValueOfExpenses(
  profile: Profile,
  expenses: Expense[],
  discountRate: number = DEFAULT_DISCOUNT_RATE,
): number {
  const currentAge = getAge(profile.dob);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  let pv = 0;
  for (let age = currentAge; age <= 100; age++) {
    const year = currentYear + (age - currentAge);
    let annualExpenses = 0;
    for (const exp of expenses) {
      annualExpenses += calculateExpenseForYear(exp, year, currentYear, currentMonth);
    }
    pv += annualExpenses / Math.pow(1 + discountRate, age - currentAge);
  }
  return pv;
}

function calculateRequiredSIP(
  initialNetWorth: number,
  assets: Asset[],
  currentAge: number,
  currentYear: number,
  retirementAge: number,
  sipStopAge: number,
  sipReturnRate: number,
  postSipReturnRate: number,
  stepUpRate: number,
  fireCorpus: number,
): number {
  if (fireCorpus <= 0) return 0;

  let low = 0;
  let high = 5000000; // ₹50L/month cap
  const tolerance = 100;

  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    const nw = simulateNetWorthAtRetirement(
      initialNetWorth, assets,
      currentAge, currentYear, retirementAge, sipStopAge,
      sipReturnRate, postSipReturnRate, stepUpRate, mid
    );

    if (Math.abs(nw - fireCorpus) < tolerance) {
      return Math.ceil(mid);
    }
    if (nw < fireCorpus) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return Math.ceil((low + high) / 2);
}

function simulateNetWorthAtRetirement(
  initialNetWorth: number,
  assets: Asset[],
  currentAge: number,
  currentYear: number,
  retirementAge: number,
  sipStopAge: number,
  sipReturnRate: number,
  postSipReturnRate: number,
  stepUpRate: number,
  monthlySIP: number,
): number {
  let netWorth = initialNetWorth;

  for (let age = currentAge; age <= retirementAge; age++) {
    const year = currentYear + (age - currentAge);
    const yearsFromStart = age - currentAge;

    let annualSIP = 0;
    if (age <= sipStopAge) {
      annualSIP = monthlySIP * 12 * Math.pow(1 + stepUpRate / 100, yearsFromStart);
    }

    // Pre-retirement: salary covers expenses; SIP = savings after expenses
    const vestingIncome = calculateVestingForYear(assets, year);
    const returnRate = age <= sipStopAge ? sipReturnRate : postSipReturnRate;
    const returnOnInvestments = Math.max(0, netWorth) * (returnRate / 100);
    netWorth = netWorth + returnOnInvestments + annualSIP + vestingIncome;
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
