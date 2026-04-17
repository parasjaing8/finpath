/**
 * Canonical payment-frequency identifiers. Anything stored in `Asset.recurring_frequency`
 * or `Expense.frequency` MUST use one of these literals. The legacy string aliases
 * `ANNUAL` and `YEARLY` are accepted on read for backward-compatibility with older
 * persisted data, but new writes should always use `ANNUALLY`.
 */
export type Frequency =
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'ANNUALLY'
  | 'ONE_TIME';

/** All accepted strings on read (canonical + legacy aliases). */
export type FrequencyInput = Frequency | 'ANNUAL' | 'YEARLY';

/** Number of payments per year — drives projection math. */
export const FREQUENCY_TO_PAYMENTS_PER_YEAR: Record<FrequencyInput, number> = {
  MONTHLY: 12,
  QUARTERLY: 4,
  ANNUALLY: 1,
  ANNUAL: 1,
  YEARLY: 1,
  ONE_TIME: 1,
};

/** Months per single payment — drives "monthly equivalent" UI summaries. */
export const FREQUENCY_TO_MONTHS_PER_PAYMENT: Record<FrequencyInput, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  ANNUALLY: 12,
  ANNUAL: 12,
  YEARLY: 12,
  ONE_TIME: 12,
};

export const FREQUENCIES: { key: Frequency; multiplier: number; label: string }[] = [
  { key: 'MONTHLY', multiplier: 12, label: 'Monthly' },
  { key: 'QUARTERLY', multiplier: 4, label: 'Quarterly' },
  { key: 'ANNUALLY', multiplier: 1, label: 'Annually' },
  { key: 'ONE_TIME', multiplier: 1, label: 'One-time' },
];

export function getFrequencyMonthsPerPayment(freq: string | null | undefined): number {
  if (!freq) return 1;
  return FREQUENCY_TO_MONTHS_PER_PAYMENT[freq as FrequencyInput] ?? 1;
}

export const DEFAULT_GROWTH_RATES: Record<string, number> = {
  EQUITY: 12,
  MUTUAL_FUND: 11,
  DEBT: 7,
  GOLD: 8,
  REAL_ESTATE: 8,
  FIXED_DEPOSIT: 7,
  PPF: 7.1,
  EPF: 8.15,
  ESOP_RSU: 12,
  CRYPTO: 15,
  CASH: 3.5,
  OTHERS: 8,
};

export interface Profile {
  id: string;
  name: string;
  dob: string;
  currency: string;
  monthly_income: number;
}

export interface Asset {
  id: string;
  name: string;
  category: string;
  current_value: number;
  expected_roi: number;
  is_self_use?: boolean;
  is_recurring?: boolean;
  recurring_amount?: number;
  recurring_frequency?: string;
  next_vesting_date?: string;
  vesting_end_date?: string;
}

export interface Expense {
  id: string;
  name: string;
  category: string;
  expense_type: 'CURRENT_RECURRING' | 'FUTURE_ONE_TIME' | 'FUTURE_RECURRING';
  amount: number;
  frequency?: string;
  inflation_rate: number;
  start_date?: string;
  end_date?: string;
}

export interface Goals {
  retirement_age: number;
  sip_stop_age: number;
  pension_income?: number;
  inflation_rate?: number;
  fire_type?: string;
  fire_target_age?: number;
  withdrawal_rate?: number;
}
