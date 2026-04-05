import { getDatabase } from './schema';

// ========== Types ==========

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

export interface Goals {
  id: number;
  profile_id: number;
  retirement_age: number;
  sip_stop_age: number;
  pension_income: number | null;
}

// ========== Profile Queries ==========

export async function getAllProfiles(): Promise<Profile[]> {
  const db = await getDatabase();
  return db.getAllAsync<Profile>(
    'SELECT id, name, dob, monthly_income, currency, failed_attempts, lockout_until, created_at FROM profiles ORDER BY created_at DESC'
  );
}

export async function getProfile(id: number): Promise<Profile | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Profile>(
    'SELECT id, name, dob, monthly_income, currency, failed_attempts, lockout_until, created_at FROM profiles WHERE id = ?',
    [id]
  );
}

/** Auth-only: fetches the PIN hash for a profile. Never store the result in shared state. */
export async function getProfilePin(id: number): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ pin: string | null }>(
    'SELECT pin FROM profiles WHERE id = ?',
    [id]
  );
  return row?.pin ?? null;
}

export async function createProfile(
  name: string,
  dob: string,
  monthly_income: number,
  currency: string,
  pin: string
): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO profiles (name, dob, monthly_income, currency, pin) VALUES (?, ?, ?, ?, ?)',
    [name, dob, monthly_income, currency, pin]
  );
  return result.lastInsertRowId;
}

export async function recordFailedAttempt(id: number): Promise<{ attempts: number; lockoutUntil: number }> {
  const db = await getDatabase();
  const profile = await db.getFirstAsync<{ failed_attempts: number }>(
    'SELECT failed_attempts FROM profiles WHERE id = ?', [id]
  );
  const attempts = (profile?.failed_attempts ?? 0) + 1;
  // Lockout durations: 5 attempts → 30s, 8 → 5min, 11+ → 30min
  let lockoutSeconds = 0;
  if (attempts >= 11) lockoutSeconds = 1800;
  else if (attempts >= 8) lockoutSeconds = 300;
  else if (attempts >= 5) lockoutSeconds = 30;
  const lockoutUntil = lockoutSeconds > 0 ? Date.now() + lockoutSeconds * 1000 : 0;
  await db.runAsync(
    'UPDATE profiles SET failed_attempts = ?, lockout_until = ? WHERE id = ?',
    [attempts, lockoutUntil, id]
  );
  return { attempts, lockoutUntil };
}

export async function resetFailedAttempts(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE profiles SET failed_attempts = 0, lockout_until = 0 WHERE id = ?', [id]);
}

// ========== Asset Queries ==========

export async function getAssets(profileId: number): Promise<Asset[]> {
  const db = await getDatabase();
  return db.getAllAsync<Asset>('SELECT * FROM assets WHERE profile_id = ? ORDER BY category, name', [profileId]);
}

export async function createAsset(asset: Omit<Asset, 'id'>): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO assets (profile_id, category, name, current_value, currency, expected_roi,
     is_recurring, recurring_amount, recurring_frequency, next_vesting_date, is_self_use,
     gold_silver_unit, gold_silver_quantity)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      asset.profile_id, asset.category, asset.name, asset.current_value, asset.currency,
      asset.expected_roi, asset.is_recurring, asset.recurring_amount, asset.recurring_frequency,
      asset.next_vesting_date, asset.is_self_use, asset.gold_silver_unit, asset.gold_silver_quantity,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateAsset(asset: Asset): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE assets SET category = ?, name = ?, current_value = ?, currency = ?, expected_roi = ?,
     is_recurring = ?, recurring_amount = ?, recurring_frequency = ?, next_vesting_date = ?,
     is_self_use = ?, gold_silver_unit = ?, gold_silver_quantity = ?
     WHERE id = ?`,
    [
      asset.category, asset.name, asset.current_value, asset.currency, asset.expected_roi,
      asset.is_recurring, asset.recurring_amount, asset.recurring_frequency, asset.next_vesting_date,
      asset.is_self_use, asset.gold_silver_unit, asset.gold_silver_quantity, asset.id,
    ]
  );
}

export async function deleteAsset(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM assets WHERE id = ?', [id]);
}

export async function getTotalNetWorth(profileId: number): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(current_value), 0) as total FROM assets WHERE profile_id = ?',
    [profileId]
  );
  return result?.total ?? 0;
}

// ========== Expense Queries ==========

export async function getExpenses(profileId: number): Promise<Expense[]> {
  const db = await getDatabase();
  return db.getAllAsync<Expense>(
    'SELECT * FROM expenses WHERE profile_id = ? ORDER BY expense_type, category, name',
    [profileId]
  );
}

export async function createExpense(expense: Omit<Expense, 'id'>): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO expenses (profile_id, name, category, amount, currency, expense_type,
     frequency, start_date, end_date, inflation_rate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      expense.profile_id, expense.name, expense.category, expense.amount, expense.currency,
      expense.expense_type, expense.frequency, expense.start_date, expense.end_date,
      expense.inflation_rate,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateExpense(expense: Expense): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE expenses SET name = ?, category = ?, amount = ?, currency = ?, expense_type = ?,
     frequency = ?, start_date = ?, end_date = ?, inflation_rate = ?
     WHERE id = ?`,
    [
      expense.name, expense.category, expense.amount, expense.currency, expense.expense_type,
      expense.frequency, expense.start_date, expense.end_date, expense.inflation_rate,
      expense.id,
    ]
  );
}

export async function deleteExpense(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
}

// ========== Goals Queries ==========

export async function getGoals(profileId: number): Promise<Goals | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Goals>('SELECT * FROM goals WHERE profile_id = ?', [profileId]);
}

export async function saveGoals(
  profileId: number,
  retirementAge: number,
  sipStopAge: number,
  pensionIncome?: number
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO goals (profile_id, retirement_age, sip_stop_age, pension_income)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(profile_id) DO UPDATE SET
     retirement_age = excluded.retirement_age,
     sip_stop_age = excluded.sip_stop_age,
     pension_income = excluded.pension_income`,
    [profileId, retirementAge, sipStopAge, pensionIncome ?? 0]
  );
}
