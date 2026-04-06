// Minimal type-only mock so ts-jest can resolve db/queries without expo-sqlite.
// The calculator only uses the exported types, not runtime values.

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

export type FireType = 'slim' | 'medium' | 'fat' | 'custom';

export interface Goals {
  id: number;
  profile_id: number;
  retirement_age: number;
  sip_stop_age: number;
  pension_income: number | null;
  fire_type: FireType;
  fire_target_age: number;
}
