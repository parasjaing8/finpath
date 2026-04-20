/**
 * calculator.test.ts
 *
 * Unit tests for engine/calculator.ts — the core FIRE / SIP projection engine.
 *
 * Scenarios are modelled on real Indian salaried professional profiles:
 *   A  28yo software engineer, Rs 1.5L/month, Rs 5L saved, retiring at 60
 *   B  35yo mid-career professional, Rs 3L/month, Rs 50L corpus, retiring at 55
 *   C  40yo "already wealthy" with Rs 20 Cr corpus — needs zero SIP
 *   D  45yo late starter, Rs 10L corpus, Rs 2L/month pension — corpus fails
 *   E  30yo with ESOP vesting (₹1L quarterly RSUs for 4 years)
 *   F  Coast FIRE: 32yo stops SIP at 45, retires at 55
 *   G  Future one-time expense (house purchase 2 yrs after retirement)
 *   H  Fat FIRE vs Moderate FIRE corpus comparison
 *   I  SIP burden warning scenarios
 */

import {
  calculateProjections,
  calculatePresentValueOfExpenses,
  formatCurrency,
  formatCurrencyFull,
  CalculationInput,
  FIRE_TARGET_AGES,
  DEFAULT_DISCOUNT_RATE,
} from '../engine/calculator';
import type { Profile, Asset, Expense, Goals } from '../db/queries';

// ── Test helpers ──────────────────────────────────────────────────────────────

/**
 * Returns a YYYY-MM-DD DOB that produces getAge(dob) === targetAge at test runtime.
 * Uses the same month/day as today so the birthday has already passed this year.
 */
function makeDob(targetAge: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - targetAge);
  return d.toISOString().split('T')[0];
}

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 1,
    name: 'Test User',
    dob: makeDob(30),
    monthly_income: 150_000,
    currency: 'INR',
    failed_attempts: 0,
    lockout_until: 0,
    created_at: '2024-01-01',
    ...overrides,
  };
}

function makeGoals(overrides: Partial<Goals> = {}): Goals {
  return {
    id: 1,
    profile_id: 1,
    retirement_age: 60,
    sip_stop_age: 60,
    pension_income: 50_000,
    fire_type: 'moderate',
    fire_target_age: 100,
    inflation_rate: 6,
    ...overrides,
  };
}

function makeMFAsset(currentValue: number, id = 1): Asset {
  return {
    id,
    profile_id: 1,
    category: 'MUTUAL_FUND',
    name: 'Nifty 50 Index',
    current_value: currentValue,
    currency: 'INR',
    expected_roi: null,        // null → falls back to DEFAULT_GROWTH_RATES (12%)
    is_recurring: 0,
    recurring_amount: null,
    recurring_frequency: null,
    next_vesting_date: null,
    vesting_end_date: null,
    is_self_use: 0,
    gold_silver_unit: null,
    gold_silver_quantity: null,
  };
}

function makeSavingsAsset(currentValue: number): Asset {
  return { ...makeMFAsset(currentValue, 2), category: 'SAVINGS', name: 'FD/Savings' };
}

function makeSelfUseRealEstate(currentValue: number): Asset {
  return {
    ...makeMFAsset(currentValue, 3),
    category: 'REAL_ESTATE',
    name: 'Primary Home',
    is_self_use: 1,
  };
}

function makeEsopAsset(params: {
  currentValue: number;
  recurringAmount: number;
  frequency: string;
  vestingStartYearsFromNow: number;
  vestingEndYearsFromNow: number;
}): Asset {
  const now = new Date();
  const start = new Date(now);
  start.setFullYear(now.getFullYear() + params.vestingStartYearsFromNow);
  const end = new Date(now);
  end.setFullYear(now.getFullYear() + params.vestingEndYearsFromNow);
  return {
    id: 10,
    profile_id: 1,
    category: 'ESOP_RSU',
    name: 'Company RSUs',
    current_value: params.currentValue,
    currency: 'INR',
    expected_roi: null,
    is_recurring: 1,
    recurring_amount: params.recurringAmount,
    recurring_frequency: params.frequency,
    next_vesting_date: start.toISOString().split('T')[0],
    vesting_end_date: end.toISOString().split('T')[0],
    is_self_use: 0,
    gold_silver_unit: null,
    gold_silver_quantity: null,
  };
}

function makeCurrentExpense(amount: number, inflationRate = 6, endYearsFromNow = 30): Expense {
  const retYear = new Date().getFullYear() + endYearsFromNow;
  return {
    id: 1,
    profile_id: 1,
    name: 'Rent',
    category: 'RENT',
    amount,
    currency: 'INR',
    expense_type: 'CURRENT_RECURRING',
    frequency: 'MONTHLY',
    start_date: null,
    end_date: `${retYear}-12-31`,
    inflation_rate: inflationRate,
  };
}

function makeFutureOneTimeExpense(amount: number, yearsFromNow: number, inflationRate = 6): Expense {
  const yr = new Date().getFullYear() + yearsFromNow;
  return {
    id: 2,
    profile_id: 1,
    name: 'House Purchase',
    category: 'OTHERS',
    amount,
    currency: 'INR',
    expense_type: 'FUTURE_ONE_TIME',
    frequency: null,
    start_date: `${yr}-06-01`,
    end_date: null,
    inflation_rate: inflationRate,
  };
}

function makeFutureRecurringExpense(amount: number, startYearsFromNow: number, endYearsFromNow: number): Expense {
  const now = new Date().getFullYear();
  return {
    id: 3,
    profile_id: 1,
    name: 'College Fees',
    category: 'EDUCATION',
    amount,
    currency: 'INR',
    expense_type: 'FUTURE_RECURRING',
    frequency: 'YEARLY',
    start_date: `${now + startYearsFromNow}-06-01`,
    end_date: `${now + endYearsFromNow}-05-31`,
    inflation_rate: 10,
  };
}

/** Baseline input: 30yo, Rs 5L MF, retire at 60, SIP Rs 20K at 12%, moderate FIRE. */
function baseInput(overrides: Partial<CalculationInput> = {}): CalculationInput {
  return {
    profile: makeProfile(),
    assets: [makeMFAsset(500_000)],
    expenses: [],
    goals: makeGoals(),
    sipAmount: 20_000,
    sipReturnRate: 12,
    postSipReturnRate: 8,
    stepUpRate: 5,
    ...overrides,
  };
}

// ── 1. formatCurrency ─────────────────────────────────────────────────────────

describe('formatCurrency — INR display formatting', () => {
  test('sub-₹1K values show full rupees with no suffix', () => {
    expect(formatCurrency(0)).toBe('₹0');
    expect(formatCurrency(500)).toBe('₹500');
    expect(formatCurrency(999)).toBe('₹999');
  });

  test('₹1K–₹99K range uses K suffix with one decimal', () => {
    expect(formatCurrency(1_000)).toBe('₹1.0K');
    expect(formatCurrency(25_000)).toBe('₹25.0K');
    expect(formatCurrency(99_000)).toBe('₹99.0K');
  });

  test('₹1L–₹99L range uses L suffix with two decimals', () => {
    expect(formatCurrency(100_000)).toBe('₹1.00 L');
    expect(formatCurrency(250_000)).toBe('₹2.50 L');
    expect(formatCurrency(9_900_000 - 1)).toContain(' L');
  });

  test('≥₹1 Cr uses Cr suffix with two decimals', () => {
    expect(formatCurrency(10_000_000)).toBe('₹1.00 Cr');
    expect(formatCurrency(25_000_000)).toBe('₹2.50 Cr');
    expect(formatCurrency(100_000_000)).toBe('₹10.00 Cr');
  });

  test('negative corpus shown with leading minus sign', () => {
    expect(formatCurrency(-250_000)).toBe('-₹2.50 L');
    expect(formatCurrency(-10_000_000)).toBe('-₹1.00 Cr');
  });

  test('USD mode delegates to toLocaleString without INR suffixes', () => {
    expect(formatCurrency(1_000, 'USD')).toBe('$1,000');
    expect(formatCurrency(1_000_000, 'USD')).toBe('$1,000,000');
  });
});

describe('formatCurrencyFull — full INR display without abbreviation', () => {
  test('shows full number with locale formatting', () => {
    // en-IN adds commas at Indian breakpoints
    const result = formatCurrencyFull(1_000_000);
    expect(result).toContain('₹');
    expect(result).toContain('10');   // 10,00,000 or 1,000,000 depending on locale
  });

  test('USD mode returns dollar sign', () => {
    expect(formatCurrencyFull(50_000, 'USD')).toContain('$');
  });
});

// ── 2. Projection structure ───────────────────────────────────────────────────

describe('calculateProjections — output structure', () => {
  test('projections span from currentAge to 100 inclusive', () => {
    const out = calculateProjections(baseInput());
    const currentAge = 30; // makeDob(30)
    expect(out.projections.length).toBe(100 - currentAge + 1); // 71 entries
    expect(out.projections[0].age).toBe(currentAge);
    expect(out.projections[out.projections.length - 1].age).toBe(100);
  });

  test('years in projections are consecutive integers', () => {
    const out = calculateProjections(baseInput());
    for (let i = 1; i < out.projections.length; i++) {
      expect(out.projections[i].year).toBe(out.projections[i - 1].year + 1);
      expect(out.projections[i].age).toBe(out.projections[i - 1].age + 1);
    }
  });

  test('annualSIP is positive pre-retirement and zero after sipStopAge', () => {
    const goals = makeGoals({ retirement_age: 60, sip_stop_age: 60 });
    const out = calculateProjections(baseInput({ goals }));
    const preRetirement = out.projections.filter(p => p.age < 60);
    const postSipStop = out.projections.filter(p => p.age > 60);
    preRetirement.forEach(p => expect(p.annualSIP).toBeGreaterThan(0));
    postSipStop.forEach(p => expect(p.annualSIP).toBe(0));
  });

  test('pensionIncome is zero pre-retirement and positive post-retirement', () => {
    const out = calculateProjections(baseInput());
    const preRetirement = out.projections.filter(p => p.age < 60);
    const postRetirement = out.projections.filter(p => p.age >= 60);
    preRetirement.forEach(p => expect(p.pensionIncome).toBe(0));
    postRetirement.forEach(p => expect(p.pensionIncome).toBeGreaterThan(0));
  });
});

// ── 3. Self-use real estate excluded from investable corpus ───────────────────

describe('investableNetWorth — self-use real estate exclusion', () => {
  test('self-use home excluded from investable corpus but counted in total net worth', () => {
    const home = makeSelfUseRealEstate(5_000_000);  // Rs 50L self-use flat
    const mf   = makeMFAsset(1_000_000);            // Rs 10L MF
    const out = calculateProjections(baseInput({ assets: [home, mf] }));
    // totalNetWorth includes home; investableNetWorth excludes it
    expect(out.totalNetWorth).toBe(6_000_000);
    expect(out.investableNetWorth).toBe(1_000_000);
  });

  test('investable corpus increases when self-use property is excluded', () => {
    const homeOnly = calculateProjections(baseInput({ assets: [makeSelfUseRealEstate(10_000_000)] }));
    const mfOnly   = calculateProjections(baseInput({ assets: [makeMFAsset(10_000_000)] }));
    // Same total value but self-use home contributes nothing to FIRE growth
    expect(mfOnly.investableNetWorth).toBeGreaterThan(homeOnly.investableNetWorth);
  });
});

// ── 4. Blended growth rate ────────────────────────────────────────────────────

describe('blended growth rate — asset category mix', () => {
  test('all-savings asset mix (7% default) grows slower than all-equity (12%)', () => {
    // Same starting corpus, same SIP — savings-heavy portfolio has lower netWorthAtRetirement
    const equityOut  = calculateProjections(baseInput({ assets: [makeMFAsset(1_000_000)] }));
    const savingsOut = calculateProjections(baseInput({ assets: [makeSavingsAsset(1_000_000)] }));
    expect(equityOut.netWorthAtRetirement).toBeGreaterThan(savingsOut.netWorthAtRetirement);
  });

  test('higher blended rate reduces requiredMonthlySIP', () => {
    const equityOut  = calculateProjections(baseInput({ assets: [makeMFAsset(2_000_000)] }));
    const savingsOut = calculateProjections(baseInput({ assets: [makeSavingsAsset(2_000_000)] }));
    expect(equityOut.requiredMonthlySIP).toBeLessThanOrEqual(savingsOut.requiredMonthlySIP);
  });
});

// ── 5. FIRE corpus calculation ────────────────────────────────────────────────

describe('fireCorpus — FIRE target at retirement', () => {
  test('fireCorpus is 0 when pension is 0 and no future expenses exist', () => {
    const out = calculateProjections(baseInput({ goals: makeGoals({ pension_income: 0 }) }));
    expect(out.fireCorpus).toBe(0);
  });

  test('larger monthly pension requires proportionally larger FIRE corpus', () => {
    const low  = calculateProjections(baseInput({ goals: makeGoals({ pension_income: 50_000 }) }));
    const high = calculateProjections(baseInput({ goals: makeGoals({ pension_income: 150_000 }) }));
    expect(high.fireCorpus).toBeGreaterThan(low.fireCorpus);
  });

  test('Fat FIRE corpus is larger than Moderate for the same pension target', () => {
    const fatGoals = makeGoals({ fire_type: 'fat', fire_target_age: FIRE_TARGET_AGES.fat });
    const modGoals = makeGoals({ fire_type: 'moderate', fire_target_age: FIRE_TARGET_AGES.moderate });
    const fat = calculateProjections(baseInput({ goals: fatGoals }));
    const mod = calculateProjections(baseInput({ goals: modGoals }));
    expect(fat.fireCorpus).toBeGreaterThan(mod.fireCorpus);
  });

  test('higher user inflation rate inflates future pension obligations and grows fireCorpus', () => {
    const low  = calculateProjections(baseInput({ goals: makeGoals({ inflation_rate: 4 }) }));
    const high = calculateProjections(baseInput({ goals: makeGoals({ inflation_rate: 9 }) }));
    expect(high.fireCorpus).toBeGreaterThan(low.fireCorpus);
  });

  test('post-retirement one-time expense adds to fireCorpus via postRetirementExpensesPV', () => {
    // House purchase 2 years after retirement (at age 62 for 30yo retiring at 60)
    const houseExpense = makeFutureOneTimeExpense(5_000_000, 32); // 32 yrs from now = age 62
    const without = calculateProjections(baseInput({ expenses: [] }));
    const with_   = calculateProjections(baseInput({ expenses: [houseExpense] }));
    expect(with_.postRetirementExpensesPV).toBeGreaterThan(0);
    expect(with_.fireCorpus).toBeGreaterThan(without.fireCorpus);
  });

  test('pre-retirement future expense does NOT appear in postRetirementExpensesPV', () => {
    // Car purchase 5 years from now (age 35, well before retirement at 60)
    const carExpense = makeFutureOneTimeExpense(1_000_000, 5);
    const out = calculateProjections(baseInput({ expenses: [carExpense] }));
    // Falls pre-retirement → corpus-funded withdrawal, but NOT added to postRetirementExpensesPV
    // (postRetirementExpensesPV is only for expenses that fall AT or AFTER retirement)
    expect(out.postRetirementExpensesPV).toBe(0);
  });
});

// ── 6. requiredMonthlySIP — lifecycle binary search ──────────────────────────

describe('requiredMonthlySIP — lifecycle binary search', () => {
  test('Scenario C: already wealthy (Rs 20 Cr, Rs 2L pension) → zero SIP needed', () => {
    // 30yo with Rs 20 Cr in MFs growing at 12% for 30 years far exceeds any FIRE corpus.
    const out = calculateProjections(baseInput({
      profile: makeProfile({ dob: makeDob(30) }),
      assets:  [makeMFAsset(200_000_000)],   // Rs 20 Cr
      goals:   makeGoals({ pension_income: 200_000 }),
      sipAmount: 0,
    }));
    expect(out.requiredMonthlySIP).toBe(0);
    expect(out.isOnTrack).toBe(true);
  });

  test('Scenario A: 28yo fresh starter (Rs 5L corpus) needs a realistic positive SIP', () => {
    // Baseline: 28yo, Rs 5L MF, Rs 50K/month pension target, moderate FIRE, retire at 60
    const out = calculateProjections(baseInput({
      profile: makeProfile({ dob: makeDob(28), monthly_income: 150_000 }),
      assets: [makeMFAsset(500_000)],
      goals: makeGoals({ retirement_age: 60, pension_income: 50_000 }),
      sipAmount: 0,
    }));
    // Binary search should find SIP in the ₹10K–₹40K range for this profile
    expect(out.requiredMonthlySIP).toBeGreaterThan(5_000);
    expect(out.requiredMonthlySIP).toBeLessThan(60_000);
  });

  test('Scenario B: 35yo mid-career (Rs 50L corpus) needs lower SIP than fresh starter', () => {
    const fresh = calculateProjections(baseInput({
      profile: makeProfile({ dob: makeDob(28) }),
      assets: [makeMFAsset(500_000)],
      goals: makeGoals({ retirement_age: 60, pension_income: 80_000 }),
      sipAmount: 0,
    }));
    const midCareer = calculateProjections(baseInput({
      profile: makeProfile({ dob: makeDob(35) }),
      assets: [makeMFAsset(5_000_000)],
      goals: makeGoals({ retirement_age: 60, pension_income: 80_000 }),
      sipAmount: 0,
    }));
    expect(midCareer.requiredMonthlySIP).toBeLessThan(fresh.requiredMonthlySIP);
  });

  test('larger existing corpus reduces requiredMonthlySIP', () => {
    const small = calculateProjections(baseInput({ assets: [makeMFAsset(500_000)],   sipAmount: 0 }));
    const large = calculateProjections(baseInput({ assets: [makeMFAsset(10_000_000)], sipAmount: 0 }));
    expect(large.requiredMonthlySIP).toBeLessThan(small.requiredMonthlySIP);
  });

  test('isOnTrack = true when actual SIP ≥ requiredMonthlySIP', () => {
    const out = calculateProjections(baseInput({ sipAmount: 200_000 })); // very high SIP
    expect(out.isOnTrack).toBe(true);
  });

  test('isOnTrack = false when actual SIP < requiredMonthlySIP', () => {
    const out = calculateProjections(baseInput({ sipAmount: 0, assets: [makeMFAsset(100)] }));
    expect(out.requiredMonthlySIP).toBeGreaterThan(0);
    expect(out.isOnTrack).toBe(false);
  });
});

// ── 7. Net worth growth and failure age ──────────────────────────────────────

describe('netWorth growth and failureAge detection', () => {
  test('net worth grows monotonically pre-retirement with positive SIP + returns', () => {
    const out = calculateProjections(baseInput({ sipAmount: 30_000 }));
    const preRetirement = out.projections.filter(p => p.age < 60);
    for (let i = 1; i < preRetirement.length; i++) {
      expect(preRetirement[i].netWorthEOY).toBeGreaterThan(preRetirement[i - 1].netWorthEOY);
    }
  });

  test('Scenario D: 45yo with tiny corpus (Rs 10L) and Rs 2L/month pension fails post-retirement', () => {
    // At retirement (age 60), corpus ≈ Rs 10L * 1.12^15 ≈ Rs 55L
    // Annual pension inflation-adjusted at retirement ≈ Rs 4.8 Cr — corpus depletes year 1
    const out = calculateProjections(baseInput({
      profile: makeProfile({ dob: makeDob(45) }),
      assets:  [makeMFAsset(100_000)],   // Rs 1L only
      goals:   makeGoals({ pension_income: 200_000, retirement_age: 60, sip_stop_age: 60 }),
      sipAmount: 0,
    }));
    expect(out.failureAge).toBeGreaterThan(0);
    expect(out.failureAge).toBeLessThan(100);
  });

  test('adequate corpus with reasonable pension survives to 100 (failureAge = -1)', () => {
    const out = calculateProjections(baseInput({
      profile: makeProfile({ dob: makeDob(30) }),
      assets:  [makeMFAsset(200_000_000)],  // Rs 20 Cr
      goals:   makeGoals({ pension_income: 100_000 }),
      sipAmount: 0,
    }));
    expect(out.failureAge).toBe(-1);
    expect(out.netWorthAtAge100).toBeGreaterThan(0);
  });

  test('netWorthAtRetirement is taken from projections at retirement age', () => {
    const out = calculateProjections(baseInput());
    const retirementProjection = out.projections.find(p => p.age === 60);
    expect(out.netWorthAtRetirement).toBe(retirementProjection?.netWorthEOY);
  });
});

// ── 8. Coast FIRE — sipStopAge < retirementAge ───────────────────────────────

describe('Coast FIRE — SIP stops before retirement', () => {
  test('Scenario F: 32yo stops SIP at 45, retires at 55 — no SIP contributions after 45', () => {
    const coastInput = baseInput({
      profile: makeProfile({ dob: makeDob(32) }),
      goals: makeGoals({ sip_stop_age: 45, retirement_age: 55 }),
      sipAmount: 25_000,
    });
    const out = calculateProjections(coastInput);
    const postSipStop = out.projections.filter(p => p.age > 45 && p.age < 55);
    postSipStop.forEach(p => expect(p.annualSIP).toBe(0));
  });

  test('Coast phase (45–55) net worth still grows via investment returns', () => {
    const out = calculateProjections(baseInput({
      profile: makeProfile({ dob: makeDob(32) }),
      goals: makeGoals({ sip_stop_age: 45, retirement_age: 55 }),
      sipAmount: 30_000,
    }));
    const age45nw = out.projections.find(p => p.age === 45)?.netWorthEOY ?? 0;
    const age55nw = out.projections.find(p => p.age === 55)?.netWorthEOY ?? 0;
    // Even without new SIP, corpus grows from compound returns during coast
    expect(age55nw).toBeGreaterThan(age45nw);
  });
});

// ── 9. ESOP vesting income ────────────────────────────────────────────────────

describe('ESOP / RSU vesting income', () => {
  test('Scenario E: quarterly RSU vesting shows vestingIncome in eligible years', () => {
    // Rs 1L per quarter (Rs 4L/year) for 4 years starting now
    const esop = makeEsopAsset({
      currentValue: 2_000_000,
      recurringAmount: 100_000,
      frequency: 'QUARTERLY',
      vestingStartYearsFromNow: 0,
      vestingEndYearsFromNow: 4,
    });
    const out = calculateProjections(baseInput({ assets: [makeMFAsset(500_000), esop] }));
    // For years within the vesting window, vestingIncome should be Rs 4L/yr (4 * 1L)
    const vestingYears = out.projections.filter(p => p.vestingIncome > 0);
    expect(vestingYears.length).toBeGreaterThan(0);
    vestingYears.forEach(p => expect(p.vestingIncome).toBeCloseTo(400_000, -3)); // ~Rs 4L
  });

  test('ESOP vesting income reduces requiredMonthlySIP compared to no vesting', () => {
    const esop = makeEsopAsset({
      currentValue: 0,
      recurringAmount: 200_000,
      frequency: 'QUARTERLY',
      vestingStartYearsFromNow: 0,
      vestingEndYearsFromNow: 5,
    });
    const noEsop  = calculateProjections(baseInput({ sipAmount: 0 }));
    const withEsop = calculateProjections(baseInput({ assets: [makeMFAsset(500_000), esop], sipAmount: 0 }));
    expect(withEsop.requiredMonthlySIP).toBeLessThan(noEsop.requiredMonthlySIP);
  });

  test('ESOP vesting stops contributing after vesting_end_date', () => {
    const esop = makeEsopAsset({
      currentValue: 1_000_000,
      recurringAmount: 50_000,
      frequency: 'MONTHLY',
      vestingStartYearsFromNow: 1,
      vestingEndYearsFromNow: 3,
    });
    const out = calculateProjections(baseInput({ assets: [makeMFAsset(500_000), esop] }));
    // After vesting end (3 years from now = age 33), vestingIncome should be 0
    const postVesting = out.projections.filter(p => p.age > 33);
    postVesting.forEach(p => expect(p.vestingIncome).toBe(0));
  });
});

// ── 10. Expenses — PV calculations ───────────────────────────────────────────

describe('expense present value and projection', () => {
  test('CURRENT_RECURRING expense appears in presentValueOfExpenses', () => {
    const rent = makeCurrentExpense(30_000, 6, 30); // Rs 30K/month rent
    const out = calculateProjections(baseInput({ expenses: [rent] }));
    expect(out.presentValueOfExpenses).toBeGreaterThan(0);
  });

  test('future recurring expense (college fees) within post-retirement window adds to postRetirementExpensesPV', () => {
    // College fees from age 62–66 (post-retirement at 60)
    const college = makeFutureRecurringExpense(200_000, 32, 36);
    const out = calculateProjections(baseInput({ expenses: [college] }));
    expect(out.postRetirementExpensesPV).toBeGreaterThan(0);
  });

  test('calculatePresentValueOfExpenses matches discounted sum of annual amounts', () => {
    // Single flat expense: Rs 10K/month, 0% inflation, running until retirementAge (30yo → 40yo = 10 yrs).
    // Year 0 is prorated: calculateExpenseForYear uses remaining calendar months from currentMonth.
    // Years 1–9 are full 12-month years.
    const flatExpense: Expense = {
      id: 1,
      profile_id: 1,
      name: 'Fixed EMI',
      category: 'EMI',
      amount: 10_000,
      currency: 'INR',
      expense_type: 'CURRENT_RECURRING',
      frequency: 'MONTHLY',
      start_date: null,
      end_date: `${new Date().getFullYear() + 10}-12-31`,
      inflation_rate: 0,
    };
    const profile = makeProfile({ dob: makeDob(30) });
    // Mirror the engine's proration: year 0 = remaining months this calendar year
    const currentMonthIdx = new Date().getMonth(); // 0 = Jan
    const year0Months     = 12 - currentMonthIdx;
    const year0Annual     = 10_000 * 12 * (year0Months / 12); // prorated
    let expectedPV = year0Annual; // discounted at i=0 → divide by 1
    for (let i = 1; i < 10; i++) {
      expectedPV += 120_000 / Math.pow(1.06, i);
    }
    const result = calculatePresentValueOfExpenses(profile, [flatExpense], 40, 0.06);
    expect(result).toBeCloseTo(expectedPV, 0);
  });

  test('higher inflation on expense increases presentValueOfExpenses', () => {
    const lowInflation  = makeCurrentExpense(30_000, 4);
    const highInflation = makeCurrentExpense(30_000, 9);
    const low  = calculateProjections(baseInput({ expenses: [lowInflation] }));
    const high = calculateProjections(baseInput({ expenses: [highInflation] }));
    expect(high.presentValueOfExpenses).toBeGreaterThan(low.presentValueOfExpenses);
  });
});

// ── 11. FIRE achieved age ─────────────────────────────────────────────────────

describe('fireAchievedAge — when net worth crosses fireCorpus', () => {
  test('very high SIP leads to fireAchievedAge at or before retirementAge', () => {
    const out = calculateProjections(baseInput({
      profile: makeProfile({ dob: makeDob(30) }),
      assets: [makeMFAsset(5_000_000)],
      goals: makeGoals({ pension_income: 30_000, retirement_age: 60 }),
      sipAmount: 100_000,
    }));
    expect(out.fireAchievedAge).toBeGreaterThan(0);
    expect(out.fireAchievedAge).toBeLessThanOrEqual(60);
  });

  test('zero SIP, zero assets, zero pension → fireAchievedAge = -1 (never)', () => {
    const out = calculateProjections(baseInput({
      assets: [],
      goals: makeGoals({ pension_income: 100_000 }),
      sipAmount: 0,
    }));
    // No corpus accumulation → net worth stays 0 → never crosses fireCorpus
    expect(out.fireAchievedAge).toBe(-1);
  });

  test('projections carry isFireAchieved = true from fireAchievedAge onwards', () => {
    const out = calculateProjections(baseInput({
      assets: [makeMFAsset(5_000_000)],
      goals: makeGoals({ pension_income: 20_000 }),
      sipAmount: 80_000,
    }));
    if (out.fireAchievedAge > 0) {
      const postFire = out.projections.filter(p => p.age >= out.fireAchievedAge);
      postFire.forEach(p => expect(p.isFireAchieved).toBe(true));
      const preFire = out.projections.filter(p => p.age < out.fireAchievedAge);
      preFire.forEach(p => expect(p.isFireAchieved).toBe(false));
    }
  });
});

// ── 12. SIP burden warnings ───────────────────────────────────────────────────

describe('sipBurdenWarning — income adequacy checks', () => {
  test('no warning when income is high relative to required SIP', () => {
    // Rs 20 Cr corpus person — requiredSIP = 0, income Rs 5L → no warning
    const out = calculateProjections(baseInput({
      profile: makeProfile({ monthly_income: 500_000 }),
      assets: [makeMFAsset(200_000_000)],
    }));
    expect(out.sipBurdenWarning).toBeNull();
  });

  test('warning fires when required SIP exceeds monthly income', () => {
    // 25yo, no assets, Rs 5L/month pension, retire at 30 (5 years) — mathematically impossible
    const out = calculateProjections(baseInput({
      profile: makeProfile({ dob: makeDob(25), monthly_income: 30_000 }),
      assets: [],
      goals: makeGoals({ retirement_age: 30, pension_income: 500_000, fire_target_age: 100 }),
      sipAmount: 0,
    }));
    expect(out.sipBurdenWarning).not.toBeNull();
    expect(out.sipBurdenWarning).toContain('exceeds your monthly income');
  });

  test('combined SIP + expenses warning fires when total exceeds income', () => {
    // Rs 80K income, rent Rs 40K/month, moderate SIP requirement
    const rent = makeCurrentExpense(40_000, 6, 25);
    const out = calculateProjections(baseInput({
      profile: makeProfile({ dob: makeDob(30), monthly_income: 80_000 }),
      assets: [makeMFAsset(200_000)],
      expenses: [rent],
      goals: makeGoals({ pension_income: 60_000, retirement_age: 55 }),
      sipAmount: 0,
    }));
    // requiredMonthlySIP + rent (40K/mo) may exceed 80K income → warning expected
    if (out.requiredMonthlySIP + 40_000 > 80_000 && out.requiredMonthlySIP <= 80_000) {
      expect(out.sipBurdenWarning).not.toBeNull();
    }
  });

  test('sipBurdenWarning is null when monthly_income is 0 (no income set)', () => {
    // income check is guarded by `if (monthlyIncome > 0)` in code
    const out = calculateProjections(baseInput({
      profile: makeProfile({ monthly_income: 0 }),
    }));
    expect(out.sipBurdenWarning).toBeNull();
  });
});

// ── 13. Slim / Moderate / Fat FIRE ordering ──────────────────────────────────

describe('FIRE type ordering — lean < moderate < fat corpus', () => {
  test('fireCorpus follows fat > moderate > lean ordering for same pension', () => {
    const lean = calculateProjections(baseInput({
      goals: makeGoals({ fire_type: 'lean',     fire_target_age: FIRE_TARGET_AGES.lean }),
    }));
    const moderate = calculateProjections(baseInput({
      goals: makeGoals({ fire_type: 'moderate', fire_target_age: FIRE_TARGET_AGES.moderate }),
    }));
    const fat = calculateProjections(baseInput({
      goals: makeGoals({ fire_type: 'fat',      fire_target_age: FIRE_TARGET_AGES.fat }),
    }));
    expect(fat.fireCorpus).toBeGreaterThan(moderate.fireCorpus);
    expect(moderate.fireCorpus).toBeGreaterThan(lean.fireCorpus);
  });

  test('lean FIRE requires lower monthly SIP than fat FIRE for same profile', () => {
    const lean = calculateProjections(baseInput({
      goals: makeGoals({ fire_type: 'lean',     fire_target_age: FIRE_TARGET_AGES.lean }),
      sipAmount: 0,
    }));
    const fat = calculateProjections(baseInput({
      goals: makeGoals({ fire_type: 'fat',      fire_target_age: FIRE_TARGET_AGES.fat }),
      sipAmount: 0,
    }));
    expect(lean.requiredMonthlySIP).toBeLessThanOrEqual(fat.requiredMonthlySIP);
  });
});

// ── 14. Step-up rate impact ───────────────────────────────────────────────────

describe('SIP step-up rate', () => {
  test('higher step-up rate reduces requiredMonthlySIP for same target', () => {
    const noStepUp   = calculateProjections(baseInput({ stepUpRate: 0,  sipAmount: 0 }));
    const withStepUp = calculateProjections(baseInput({ stepUpRate: 10, sipAmount: 0 }));
    expect(withStepUp.requiredMonthlySIP).toBeLessThan(noStepUp.requiredMonthlySIP);
  });

  test('SIP with 10% step-up has higher annualSIP at age 50 than age 30', () => {
    const out = calculateProjections(baseInput({ stepUpRate: 10, sipAmount: 15_000 }));
    const age30 = out.projections.find(p => p.age === 30)?.annualSIP ?? 0;
    const age50 = out.projections.find(p => p.age === 50)?.annualSIP ?? 0;
    expect(age50).toBeGreaterThan(age30);
  });
});

// ── 15. FUTURE_ONE_TIME pre-retirement corpus deduction (fix for audit101 bug) ─

describe('FUTURE_ONE_TIME pre-retirement — corpus deduction behaviour', () => {
  test('net worth dips in the year of a large pre-retirement one-time purchase', () => {
    // 30yo, large house purchase 5 years from now (age 35, pre-retirement at 60)
    // With a ₹50L purchase corpus should fall relative to the prior year
    const house = makeFutureOneTimeExpense(5_000_000, 5); // ₹50L house, 5 yrs out
    const out = calculateProjections(baseInput({
      assets: [makeMFAsset(10_000_000)], // ₹1 Cr — enough to absorb the dip
      expenses: [house],
      sipAmount: 30_000,
    }));
    const purchaseYear = out.projections.find(p => p.age === 35);
    const priorYear    = out.projections.find(p => p.age === 34);
    expect(purchaseYear).toBeDefined();
    expect(priorYear).toBeDefined();
    // Net worth in purchase year must be less than prior year (dip visible)
    expect(purchaseYear!.netWorthEOY).toBeLessThan(priorYear!.netWorthEOY);
  });

  test('totalNetExpenses equals the one-time cost in the purchase year (pre-retirement)', () => {
    // ₹10L car, 3 yrs out, 0% inflation so inflated amount == original amount
    const car = makeFutureOneTimeExpense(1_000_000, 3, 0);
    const out = calculateProjections(baseInput({ expenses: [car], sipAmount: 20_000 }));
    const purchaseYear = out.projections.find(p => p.age === 33);
    expect(purchaseYear).toBeDefined();
    // totalNetExpenses should equal the one-time cost (not 0 as the old buggy code had)
    expect(purchaseYear!.totalNetExpenses).toBeCloseTo(1_000_000, -2);
  });

  test('totalNetExpenses = 0 in pre-retirement years with only CURRENT_RECURRING expenses', () => {
    const rent = makeCurrentExpense(30_000); // CURRENT_RECURRING only — salary-funded
    const out = calculateProjections(baseInput({ expenses: [rent] }));
    const preRetirement = out.projections.filter(p => p.age < 60);
    preRetirement.forEach(p => expect(p.totalNetExpenses).toBe(0));
  });

  test('FUTURE expenses (one-time and recurring) NOT included in salary-funded presentValueOfExpenses', () => {
    // presentValueOfExpenses is the "what salary must cover" number on the expenses banner
    // FUTURE_ONE_TIME and FUTURE_RECURRING are both corpus-funded — must NOT appear here
    const house   = makeFutureOneTimeExpense(10_000_000, 10);          // ₹1 Cr house
    const college = makeFutureRecurringExpense(500_000, 5, 9);          // ₹5L/yr school fees
    const withBoth    = calculateProjections(baseInput({ expenses: [house, college] }));
    const withoutAny  = calculateProjections(baseInput({ expenses: [] }));
    // Neither future expense should appear in the salary-funded PV
    expect(withBoth.presentValueOfExpenses).toBeCloseTo(withoutAny.presentValueOfExpenses, 0);
  });

  test('pre-retirement FUTURE_ONE_TIME increases requiredMonthlySIP', () => {
    // A large corpus withdrawal mid-accumulation forces a higher SIP to compensate
    const bigHouse = makeFutureOneTimeExpense(20_000_000, 15); // ₹2 Cr house, 15 yrs out
    const without = calculateProjections(baseInput({ sipAmount: 0 }));
    const with_   = calculateProjections(baseInput({ expenses: [bigHouse], sipAmount: 0 }));
    expect(with_.requiredMonthlySIP).toBeGreaterThan(without.requiredMonthlySIP);
  });

  test('calculatePresentValueOfExpenses excludes FUTURE_ONE_TIME and FUTURE_RECURRING', () => {
    // Standalone function used by the expenses screen banner — only CURRENT_RECURRING included
    const profile = makeProfile({ dob: makeDob(30) });
    const rent    = makeCurrentExpense(30_000, 6, 30);
    const house   = makeFutureOneTimeExpense(5_000_000, 5);
    const college = makeFutureRecurringExpense(300_000, 3, 7);
    const pvAll      = calculatePresentValueOfExpenses(profile, [rent, house, college], 60);
    const pvRentOnly = calculatePresentValueOfExpenses(profile, [rent],                 60);
    // Future expenses must NOT inflate the "salary must cover" banner number
    expect(pvAll).toBeCloseTo(pvRentOnly, 0);
  });

  test('FUTURE_RECURRING pre-retirement causes corpus dip when it starts', () => {
    // School fees ₹3L/year starting 5 years from now (age 35, pre-retirement at 60)
    // Verify: totalNetExpenses > 0 in fee year AND net worth lower than without fees
    const fees = makeFutureRecurringExpense(300_000, 5, 9); // ₹3L/yr, ages 35-39
    const withFees    = calculateProjections(baseInput({ assets: [makeMFAsset(5_000_000)], expenses: [fees], sipAmount: 20_000 }));
    const withoutFees = calculateProjections(baseInput({ assets: [makeMFAsset(5_000_000)], expenses: [],     sipAmount: 20_000 }));
    const feeYear    = withFees.projections.find(p => p.age === 35)!;
    const noFeeYear  = withoutFees.projections.find(p => p.age === 35)!;
    // Corpus is deducted → totalNetExpenses reflects the fee
    expect(feeYear.totalNetExpenses).toBeGreaterThan(0);
    // Net worth with fees must be lower than without fees in the same year
    expect(feeYear.netWorthEOY).toBeLessThan(noFeeYear.netWorthEOY);
  });

  test('FUTURE_RECURRING pre-retirement increases requiredMonthlySIP', () => {
    // Annual school fees starting 8 years from now force a higher SIP to compensate
    const fees = makeFutureRecurringExpense(500_000, 8, 12); // ₹5L/yr for 4 years
    const without = calculateProjections(baseInput({ sipAmount: 0 }));
    const with_   = calculateProjections(baseInput({ expenses: [fees], sipAmount: 0 }));
    expect(with_.requiredMonthlySIP).toBeGreaterThan(without.requiredMonthlySIP);
  });

  test('existingBucket overflow spills into sipBucket — no artificial jump next year', () => {
    // Scenario: house costs more than existingBucket holds.
    // Overflow must come from sipBucket so net worth is consistent year-over-year.
    // 30yo, ₹40L existing assets (9% blended), ₹20K/month SIP, retire at 60.
    // House ₹2 Cr at year+5 (age 35) — existingBucket only ~₹62L after 5 yrs growth → overflow.
    const house = makeFutureOneTimeExpense(20_000_000, 5, 0); // ₹2 Cr, 0% inflation
    const out = calculateProjections(baseInput({
      assets:   [makeMFAsset(4_000_000)],
      expenses: [house],
      sipAmount: 20_000,
    }));
    const yr35 = out.projections.find(p => p.age === 35)!;
    const yr36 = out.projections.find(p => p.age === 36)!;
    const yr34 = out.projections.find(p => p.age === 34)!;

    // 1. Net worth in purchase year must be less than prior year (dip confirmed)
    expect(yr35.netWorthEOY).toBeLessThan(yr34.netWorthEOY);

    // 2. Year after purchase: gap vs no-house scenario must be close to house cost
    //    Before fix this gap was ~zero (debt forgiven). After fix the full cost is absorbed.
    const withoutHouse = calculateProjections(baseInput({ assets: [makeMFAsset(4_000_000)], expenses: [], sipAmount: 20_000 }));
    const yr36_without = withoutHouse.projections.find(p => p.age === 36)!;
    const gap = yr36_without.netWorthEOY - yr36.netWorthEOY;
    expect(gap).toBeGreaterThan(8_000_000); // ~₹80L — non-zero proves no debt forgiveness

    // 3. totalNetExpenses reflects the full one-time cost in purchase year
    expect(yr35.totalNetExpenses).toBeCloseTo(20_000_000, -4);
  });
});