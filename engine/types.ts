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
  SAVINGS: 6,
  OTHERS: 8,
};

export interface Profile {
  id: string | number;
  name: string;
  dob: string;
  currency: string;
  monthly_income: number;
}

export interface Asset {
  id: string | number;
  name: string;
  category: string;
  current_value: number;
  expected_roi: number;
  currency?: string;
  is_self_use?: boolean | number;
  is_recurring?: boolean | number;
  recurring_amount?: number | null;
  recurring_frequency?: string | null;
  next_vesting_date?: string | null;
  vesting_end_date?: string | null;
}

export interface Expense {
  id: string | number;
  name: string;
  category: string;
  expense_type: string;
  amount: number;
  frequency?: string | null;
  inflation_rate: number;
  start_date?: string | null;
  end_date?: string | null;
}

export interface Goals {
  retirement_age: number;
  sip_stop_age: number;
  pension_income?: number | null;
  inflation_rate?: number | null;
  fire_type?: string;
  fire_target_age?: number;
}
