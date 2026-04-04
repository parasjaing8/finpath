import { Asset, Expense, Goals, Profile } from '../db/queries';
import { FREQUENCIES } from '../constants/categories';

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
): number {
  const yearsFromNow = targetYear - currentYear;
  if (yearsFromNow < 0) return 0;

  const inflationRate = expense.inflation_rate / 100;

  if (expense.expense_type === 'CURRENT_RECURRING') {
    const multiplier = getFrequencyMultiplier(expense.frequency);
    return expense.amount * Math.pow(1 + inflationRate, yearsFromNow) * multiplier;
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
    const startYear = new Date(expense.start_date).getFullYear();
    const endYear = expense.end_date ? new Date(expense.end_date).getFullYear() : 9999;
    if (targetYear >= startYear && targetYear <= endYear) {
      const multiplier = getFrequencyMultiplier(expense.frequency);
      return expense.amount * Math.pow(1 + inflationRate, yearsFromNow) * multiplier;
    }
    return 0;
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

    const freq = asset.recurring_frequency;
    const timesPerYear = getFrequencyMultiplier(freq);
    total += asset.recurring_amount * timesPerYear;
  }
  return total;
}

export function calculateProjections(input: CalculationInput): CalculationOutput {
  const { profile, assets, expenses, goals, sipAmount, sipReturnRate, postSipReturnRate, stepUpRate } = input;
  const currentAge = getAge(profile.dob);
  const currentYear = new Date().getFullYear();
  const { retirement_age: retirementAge, sip_stop_age: sipStopAge } = goals;

  // Calculate initial net worth from all assets
  let initialNetWorth = 0;
  let investableNetWorth = 0;
  for (const asset of assets) {
    initialNetWorth += asset.current_value;
    if (asset.category !== 'REAL_ESTATE' || !asset.is_self_use) {
      investableNetWorth += asset.current_value;
    }
  }

  // Separate income streams from expenses
  const pureExpenses = expenses.filter(e => !e.is_income);
  const incomeStreams = expenses.filter(e => e.is_income);

  // Calculate FIRE corpus = present value of all expenses from retirement age to 100
  let fireCorpus = 0;
  const discountRate = 0.06;
  for (let age = retirementAge; age <= 100; age++) {
    const year = currentYear + (age - currentAge);
    let annualExpenses = 0;
    for (const exp of pureExpenses) {
      annualExpenses += calculateExpenseForYear(exp, year, currentYear);
    }
    let annualIncome = 0;
    for (const inc of incomeStreams) {
      annualIncome += calculateExpenseForYear(inc, year, currentYear);
    }
    const netExpense = Math.max(0, annualExpenses - annualIncome);
    const yearsFromNow = age - currentAge;
    fireCorpus += netExpense / Math.pow(1 + discountRate, yearsFromNow);
  }

  // Calculate present value of ALL lifetime expenses (for expenses page banner)
  let presentValueOfExpenses = 0;
  for (let age = currentAge; age <= 100; age++) {
    const year = currentYear + (age - currentAge);
    let annualExpenses = 0;
    for (const exp of pureExpenses) {
      annualExpenses += calculateExpenseForYear(exp, year, currentYear);
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
      plannedExpenses += calculateExpenseForYear(exp, year, currentYear);
    }

    // Pension/Income this year
    let pensionIncome = 0;
    for (const inc of incomeStreams) {
      pensionIncome += calculateExpenseForYear(inc, year, currentYear);
    }

    // Vesting income
    const vestingIncome = calculateVestingForYear(assets, year);

    // Net worth calculation
    const returnRate = age <= sipStopAge ? sipReturnRate : postSipReturnRate;
    const totalNetExpenses = plannedExpenses - pensionIncome;
    netWorth = netWorth * (1 + returnRate / 100) + annualSIP + vestingIncome - totalNetExpenses;

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
    investableNetWorth, assets, pureExpenses, incomeStreams,
    currentAge, currentYear, retirementAge, sipStopAge,
    sipReturnRate, postSipReturnRate, stepUpRate, fireCorpus
  );

  const timeToFire = fireAchievedAge >= 0 ? fireAchievedAge - currentAge : -1;

  return {
    fireCorpus,
    requiredMonthlySIP,
    timeToFire,
    fireAchievedAge,
    isOnTrack: sipAmount >= requiredMonthlySIP,
    projections,
    presentValueOfExpenses,
  };
}

function calculateRequiredSIP(
  initialNetWorth: number,
  assets: Asset[],
  expenses: Expense[],
  incomeStreams: Expense[],
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
  let high = 500000;
  const tolerance = 100;

  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    const nw = simulateNetWorthAtRetirement(
      initialNetWorth, assets, expenses, incomeStreams,
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
  expenses: Expense[],
  incomeStreams: Expense[],
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

    let plannedExpenses = 0;
    for (const exp of expenses) {
      plannedExpenses += calculateExpenseForYear(exp, year, currentYear);
    }

    let pensionIncome = 0;
    for (const inc of incomeStreams) {
      pensionIncome += calculateExpenseForYear(inc, year, currentYear);
    }

    const vestingIncome = calculateVestingForYear(assets, year);
    const returnRate = age <= sipStopAge ? sipReturnRate : postSipReturnRate;
    netWorth = netWorth * (1 + returnRate / 100) + annualSIP + vestingIncome - (plannedExpenses - pensionIncome);
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
