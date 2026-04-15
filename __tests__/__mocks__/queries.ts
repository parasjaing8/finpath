/**
 * __tests__/__mocks__/queries.ts
 *
 * Type-only mock for db/queries.ts.
 * calculator.ts only imports TypeScript interfaces (erased at runtime) from this module.
 * No SQLite or SecureStore runtime code is needed.
 */

export interface Profile {
  id: number;
  name: string;
  dob: string;
  monthly_income: number;
  currency: string;
  failed_attempts: number;
  lockout_until: number;
  created_at: string;
}

export interface Asset {
  id: number;
  profile_id: number;
  category: string;
  name: string;
  current_value: number;
  currency: string;
  expected_roi: number;
  is_recurring: number;
  recurring_amount: number | null;
  recurring_frequency: string | null;
  next_vesting_date: string | null;
  vesting_end_date: string | null;
  is_self_use: number;
  gold_silver_unit: string | null;
  gold_silver_quantity: number | null;
}

export interface Expense {
  id: number;
  profile_id: number;
  name: string;
  category: string;
  amount: number;
  currency: string;
  expense_type: string;
  frequency: string | null;
  start_date: string | null;
  end_date: string | null;
  inflation_rate: number;
}

export type FireType = 'slim' | 'moderate' | 'fat' | 'custom';

export interface Goals {
  id: number;
  profile_id: number;
  retirement_age: number;
  sip_stop_age: number;
  pension_income: number | null;
  fire_type: FireType;
  fire_target_age: number;
  withdrawal_rate: number;
  inflation_rate: number;
}
