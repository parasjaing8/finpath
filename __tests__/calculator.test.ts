import { formatCurrency, calculatePresentValueOfExpenses, calculateProjections } from '../engine/calculator';
import type { Profile, Expense, Asset, Goals } from './__mocks__/queries';

// ---------------------------------------------------------------------------
// Helpers to build minimal fixture objects
// ---------------------------------------------------------------------------

const TODAY_YEAR = new Date().getFullYear();

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 1,
    name: 'Test User',
    dob: `${TODAY_YEAR - 30}-01-01`, // 30 years old
    monthly_income: 100000,
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
    retirement_age: 45,
    sip_stop_age: 45,
    pension_income: 0,
    ...overrides,
  };
}

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 1,
    profile_id: 1,
    name: 'Rent',
    amount: 30000,
    currency: 'INR',
    category: 'RENT',
    expense_type: 'CURRENT_RECURRING',
    frequency: 'MONTHLY',
    inflation_rate: 6,
    start_date: null,
    end_date: null,
    ...overrides,
  };
}

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 1,
    profile_id: 1,
    category: 'MUTUAL_FUND',
    name: 'Nifty 50 Index',
    current_value: 1000000,
    currency: 'INR',
    expected_roi: 12,
    is_recurring: 0,
    recurring_amount: null,
    recurring_frequency: null,
    next_vesting_date: null,
    is_self_use: 0,
    gold_silver_unit: null,
    gold_silver_quantity: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------

describe('formatCurrency – INR formatting', () => {
  it('formats crores correctly', () => {
    expect(formatCurrency(10000000)).toBe('₹1.00 Cr');
    expect(formatCurrency(25000000)).toBe('₹2.50 Cr');
  });

  it('formats lakhs correctly', () => {
    expect(formatCurrency(500000)).toBe('₹5.00 L');
    expect(formatCurrency(1500000)).toBe('₹15.00 L');
  });

  it('formats thousands correctly', () => {
    expect(formatCurrency(50000)).toBe('₹50.0K');
    expect(formatCurrency(1000)).toBe('₹1.0K');
  });

  it('formats sub-thousand amounts', () => {
    expect(formatCurrency(999)).toBe('₹999');
    expect(formatCurrency(0)).toBe('₹0');
  });

  it('handles negative amounts', () => {
    expect(formatCurrency(-10000000)).toBe('-₹1.00 Cr');
    expect(formatCurrency(-500000)).toBe('-₹5.00 L');
    expect(formatCurrency(-999)).toBe('-₹999');
  });

  it('formats USD amounts', () => {
    const result = formatCurrency(500000, 'USD');
    expect(result).toContain('$');
    expect(result).toContain('500');
  });
});

// ---------------------------------------------------------------------------
// calculatePresentValueOfExpenses
// ---------------------------------------------------------------------------

describe('calculatePresentValueOfExpenses', () => {
  it('returns 0 for empty expenses', () => {
    const pv = calculatePresentValueOfExpenses(makeProfile(), [], 0.06);
    expect(pv).toBe(0);
  });

  it('returns a positive PV for a recurring expense', () => {
    const expenses = [makeExpense({ amount: 10000, inflation_rate: 0, frequency: 'MONTHLY' })];
    const pv = calculatePresentValueOfExpenses(makeProfile(), expenses, 0.06);
    expect(pv).toBeGreaterThan(0);
  });

  it('higher discount rate produces lower PV', () => {
    const expenses = [makeExpense({ amount: 10000, inflation_rate: 0, frequency: 'MONTHLY' })];
    const pvLow = calculatePresentValueOfExpenses(makeProfile(), expenses, 0.03);
    const pvHigh = calculatePresentValueOfExpenses(makeProfile(), expenses, 0.10);
    expect(pvLow).toBeGreaterThan(pvHigh);
  });

  it('zero expense amount produces zero PV', () => {
    const expenses = [makeExpense({ amount: 0 })];
    const pv = calculatePresentValueOfExpenses(makeProfile(), expenses, 0.06);
    expect(pv).toBe(0);
  });

  it('future one-time expense only counts in its target year', () => {
    const targetYear = TODAY_YEAR + 5;
    const expenses = [
      makeExpense({
        expense_type: 'FUTURE_ONE_TIME',
        start_date: `${targetYear}-06-01`,
        frequency: null,
        amount: 100000,
        inflation_rate: 0,
      }),
    ];
    const pv = calculatePresentValueOfExpenses(makeProfile(), expenses, 0.06);
    // PV should be ~100000 / (1.06^5)
    const expected = 100000 / Math.pow(1.06, 5);
    expect(pv).toBeCloseTo(expected, -2); // within ₹100
  });

  it('future recurring expense only counts within date range', () => {
    const startYear = TODAY_YEAR + 2;
    const endYear = TODAY_YEAR + 4;
    const expInRange = makeExpense({
      expense_type: 'FUTURE_RECURRING',
      start_date: `${startYear}-01-01`,
      end_date: `${endYear}-12-31`,
      frequency: 'YEARLY',
      amount: 50000,
      inflation_rate: 0,
    });
    const pv = calculatePresentValueOfExpenses(makeProfile(), [expInRange], 0.06);
    // 3 yearly payments at years +2, +3, +4 — all discounted
    const expected =
      50000 / Math.pow(1.06, 2) +
      50000 / Math.pow(1.06, 3) +
      50000 / Math.pow(1.06, 4);
    expect(pv).toBeCloseTo(expected, -2);
  });
});

// ---------------------------------------------------------------------------
// calculateProjections
// ---------------------------------------------------------------------------

describe('calculateProjections', () => {
  const baseInput = {
    profile: makeProfile(),
    assets: [makeAsset()],
    expenses: [makeExpense({ amount: 10000, inflation_rate: 6 })],
    goals: makeGoals({ retirement_age: 45, sip_stop_age: 45 }),
    sipAmount: 50000,
    sipReturnRate: 12,
    postSipReturnRate: 8,
    stepUpRate: 5,
  };

  it('returns all required output fields', () => {
    const out = calculateProjections(baseInput);
    expect(out).toHaveProperty('fireCorpus');
    expect(out).toHaveProperty('requiredMonthlySIP');
    expect(out).toHaveProperty('timeToFire');
    expect(out).toHaveProperty('fireAchievedAge');
    expect(out).toHaveProperty('isOnTrack');
    expect(out).toHaveProperty('projections');
    expect(out).toHaveProperty('presentValueOfExpenses');
  });

  it('projections array covers from current age to 100', () => {
    const out = calculateProjections(baseInput);
    expect(out.projections.length).toBe(100 - 30 + 1); // age 30 to 100 inclusive
  });

  it('fireCorpus is positive when expenses exist', () => {
    const out = calculateProjections(baseInput);
    expect(out.fireCorpus).toBeGreaterThan(0);
  });

  it('presentValueOfExpenses is positive when expenses exist', () => {
    const out = calculateProjections(baseInput);
    expect(out.presentValueOfExpenses).toBeGreaterThan(0);
  });

  it('isOnTrack is true when SIP exceeds required SIP', () => {
    // Use an extremely high SIP to guarantee on-track
    const highSip = { ...baseInput, sipAmount: 5000000 };
    const out = calculateProjections(highSip);
    expect(out.isOnTrack).toBe(true);
  });

  it('isOnTrack is false when SIP is 0 and expenses are non-zero', () => {
    const noSip = { ...baseInput, sipAmount: 0 };
    const out = calculateProjections(noSip);
    expect(out.isOnTrack).toBe(false);
  });

  it('fireCorpus is 0 when there are no expenses', () => {
    const noExpenses = { ...baseInput, expenses: [] };
    const out = calculateProjections(noExpenses);
    expect(out.fireCorpus).toBe(0);
    expect(out.requiredMonthlySIP).toBe(0);
  });

  it('self-use real estate is excluded from investable net worth', () => {
    // Add a 10M self-use property on top of the 1M investable asset
    const inputWithSelfUse = {
      ...baseInput,
      assets: [
        makeAsset({ current_value: 1000000 }),
        makeAsset({ id: 2, category: 'REAL_ESTATE', is_self_use: 1, current_value: 10000000 }),
      ],
    };
    const outWithout = calculateProjections(baseInput);
    const outWith = calculateProjections(inputWithSelfUse);
    // Self-use property shouldn't change the FIRE corpus (expense side unchanged)
    expect(outWith.fireCorpus).toBeCloseTo(outWithout.fireCorpus, -3);
    // But it would affect net worth trajectory — first year net worth will be same
    // because self-use is excluded from investable
    expect(outWith.projections[0].netWorthEOY).toBeCloseTo(
      outWithout.projections[0].netWorthEOY, -3,
    );
  });

  it('pension income reduces required SIP', () => {
    const withPension = {
      ...baseInput,
      goals: makeGoals({ retirement_age: 45, sip_stop_age: 45, pension_income: 50000 }),
    };
    const outNoPension = calculateProjections(baseInput);
    const outWithPension = calculateProjections(withPension);
    expect(outWithPension.requiredMonthlySIP).toBeLessThan(outNoPension.requiredMonthlySIP);
    expect(outWithPension.fireCorpus).toBeLessThan(outNoPension.fireCorpus);
  });

  it('SIP stops being contributed after sipStopAge', () => {
    const out = calculateProjections(baseInput);
    const sipStopAge = baseInput.goals.sip_stop_age;
    const postStopRow = out.projections.find(p => p.age === sipStopAge + 1);
    expect(postStopRow?.annualSIP).toBe(0);
  });

  it('annualSIP grows each year due to step-up', () => {
    const out = calculateProjections(baseInput);
    const age30 = out.projections.find(p => p.age === 30)!;
    const age35 = out.projections.find(p => p.age === 35)!;
    expect(age35.annualSIP).toBeGreaterThan(age30.annualSIP);
  });
});
