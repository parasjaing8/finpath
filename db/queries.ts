import { getDatabase } from './schema';
import * as SecureStore from 'expo-secure-store';

// SecureStore key for a profile's PIN hash
const biometricKey = (profileId: number) => `finpath_biometric_${profileId}`;
const pinKey = (profileId: number) => `finpath_pin_${profileId}`;

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
  expected_roi: number | null;
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

export type FireType = 'lean' | 'moderate' | 'fat' | 'custom';

export interface Goals {
  id: number;
  profile_id: number;
  retirement_age: number;
  sip_stop_age: number;
  pension_income: number | null;
  fire_type: FireType;
  fire_target_age: number;
  inflation_rate: number;
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

/** Auth-only: fetches the PIN hash for a profile from SecureStore.
 *  Falls back to the SQLite column for profiles created before the
 *  secure-store migration, and migrates them on first successful read.
 *  Never store the result in shared state.
 */
export async function getProfilePin(id: number): Promise<string | null> {
  // Primary: hardware-backed SecureStore
  const stored = await SecureStore.getItemAsync(pinKey(id));
  if (stored !== null) return stored;

  // Fallback: legacy SQLite pin column (pre-migration installs)
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ pin: string | null }>(
    'SELECT pin FROM profiles WHERE id = ?',
    [id]
  );
  if (row?.pin) {
    // Migrate: move to SecureStore, then null the SQLite column
    await SecureStore.setItemAsync(pinKey(id), row.pin);
    await db.runAsync('UPDATE profiles SET pin = NULL WHERE id = ?', [id]);
    return row.pin;
  }
  return null;
}

/** Saves a new PIN hash to SecureStore (replaces any previous value). */
export async function saveProfilePin(profileId: number, hashedPin: string): Promise<void> {
  await SecureStore.setItemAsync(pinKey(profileId), hashedPin);
}

/** Removes the PIN from SecureStore — call when deleting a profile. */
export async function deleteProfilePin(profileId: number): Promise<void> {
  await SecureStore.deleteItemAsync(pinKey(profileId));
}

/** Returns true if biometric login is enabled for this profile. */
export async function getBiometricEnabled(profileId: number): Promise<boolean> {
  const val = await SecureStore.getItemAsync(biometricKey(profileId));
  return val === '1';
}

/** Enables or disables biometric login for this profile. */
export async function setBiometricEnabled(profileId: number, enabled: boolean): Promise<void> {
  if (enabled) {
    await SecureStore.setItemAsync(biometricKey(profileId), '1');
  } else {
    await SecureStore.deleteItemAsync(biometricKey(profileId));
  }
}

/** Permanently deletes a profile and all its associated data (assets, expenses, goals).
 *  Also removes the PIN from SecureStore.
 */
export async function updateProfile(id: number, monthly_income: number, currency: string, dob?: string, name?: string): Promise<void> {
  const db = await getDatabase();
  if (name && dob) {
    await db.runAsync('UPDATE profiles SET monthly_income = ?, currency = ?, dob = ?, name = ? WHERE id = ?', [monthly_income, currency, dob, name, id]);
  } else if (name) {
    await db.runAsync('UPDATE profiles SET monthly_income = ?, currency = ?, name = ? WHERE id = ?', [monthly_income, currency, name, id]);
  } else if (dob) {
    await db.runAsync('UPDATE profiles SET monthly_income = ?, currency = ?, dob = ? WHERE id = ?', [monthly_income, currency, dob, id]);
  } else {
    await db.runAsync('UPDATE profiles SET monthly_income = ?, currency = ? WHERE id = ?', [monthly_income, currency, id]);
  }
}

export async function deleteProfile(profileId: number): Promise<void> {
  await deleteProfilePin(profileId);
  await setBiometricEnabled(profileId, false);
  const db = await getDatabase();
  await db.runAsync('DELETE FROM profiles WHERE id = ?', [profileId]);
}

export async function createProfile(
  name: string,
  dob: string,
  monthly_income: number,
  currency: string,
  pin: string
): Promise<number> {
  const db = await getDatabase();
  // PIN is stored in SecureStore only — not in the SQLite DB
  const result = await db.runAsync(
    'INSERT INTO profiles (name, dob, monthly_income, currency) VALUES (?, ?, ?, ?)',
    [name, dob, monthly_income, currency]
  );
  const profileId = result.lastInsertRowId;
  try {
    await saveProfilePin(profileId, pin);
  } catch (e) {
    await db.runAsync("DELETE FROM profiles WHERE id = ?", [profileId]);
    throw e;
  }
  return profileId;
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
     is_recurring, recurring_amount, recurring_frequency, next_vesting_date, vesting_end_date,
     is_self_use, gold_silver_unit, gold_silver_quantity)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      asset.profile_id, asset.category, asset.name, asset.current_value, asset.currency,
      asset.expected_roi, asset.is_recurring, asset.recurring_amount, asset.recurring_frequency,
      asset.next_vesting_date, asset.vesting_end_date, asset.is_self_use,
      asset.gold_silver_unit, asset.gold_silver_quantity,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateAsset(asset: Asset): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE assets SET category = ?, name = ?, current_value = ?, currency = ?, expected_roi = ?,
     is_recurring = ?, recurring_amount = ?, recurring_frequency = ?, next_vesting_date = ?,
     vesting_end_date = ?, is_self_use = ?, gold_silver_unit = ?, gold_silver_quantity = ?
     WHERE id = ?`,
    [
      asset.category, asset.name, asset.current_value, asset.currency, asset.expected_roi,
      asset.is_recurring, asset.recurring_amount, asset.recurring_frequency, asset.next_vesting_date,
      asset.vesting_end_date, asset.is_self_use, asset.gold_silver_unit, asset.gold_silver_quantity,
      asset.id,
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
  pensionIncome?: number,
  fireType: FireType = 'moderate',
  fireTargetAge: number = 100,
  inflationRate: number = 6.0,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO goals (profile_id, retirement_age, sip_stop_age, pension_income, fire_type, fire_target_age, inflation_rate)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(profile_id) DO UPDATE SET
     retirement_age = excluded.retirement_age,
     sip_stop_age = excluded.sip_stop_age,
     pension_income = excluded.pension_income,
     fire_type = excluded.fire_type,
     fire_target_age = excluded.fire_target_age,
     inflation_rate = excluded.inflation_rate`,
    [profileId, retirementAge, sipStopAge, pensionIncome ?? 0, fireType, fireTargetAge, inflationRate]
  );
}
