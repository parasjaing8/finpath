import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Profile, Asset, Expense, Goals } from '../engine/types';
import { CURRENT_SCHEMA_VERSION, runMigrations } from '../storage/migrations';
import {
  createAsset as dbCreateAsset,
  updateAsset as dbUpdateAsset,
  deleteAsset as dbDeleteAsset,
  createExpense as dbCreateExpense,
  updateExpense as dbUpdateExpense,
  deleteExpense as dbDeleteExpense,
  getAllProfiles as dbGetAllProfiles,
  deleteProfile as dbDeleteProfile,
  saveGoals as dbSaveGoals,
  getAssets as dbGetAssets,
  getExpenses as dbGetExpenses,
  getGoals as dbGetGoals,
  getProfile as dbGetProfile,
} from '../db/queries';
import type { Profile as DBProfile } from '../db/queries';

// Cleared on deleteAllData so the legacy migration re-gates on next fresh install.
const LEGACY_MIGRATION_SENTINEL = '@finpath_sqlite_migrated_v1';

export interface ExportPayload {
  /**
   * Schema version that produced this backup. Older backups can still be
   * imported — they're routed through `runMigrations` on the way in. New
   * exports always stamp the current schema version.
   */
  version: number;
  exportedAt: string;
  profile: Profile | null;
  assets: Asset[];
  expenses: Expense[];
  goals: Goals | null;
}

interface AppContextType {
  profile: Profile | null;
  assets: Asset[];
  expenses: Expense[];
  goals: Goals | null;
  isLoaded: boolean;
  /** Load all data for a profile from SQLite into in-memory state. */
  loadProfile: (profileId: number) => Promise<void>;
  /** In-memory update only — profile row is persisted by callers via db/queries directly. */
  setProfile: (p: Profile) => void;
  /** In-memory update only — used by login.tsx syncToAppContext until Batch 3. */
  setAssets: (a: Asset[]) => void;
  /** In-memory update only — used by login.tsx syncToAppContext until Batch 3. */
  setExpenses: (e: Expense[]) => void;
  /** Persists to SQLite and updates in-memory state. */
  setGoals: (g: Goals) => Promise<void>;
  addAsset: (a: Asset) => Promise<void>;
  updateAsset: (a: Asset) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  addExpense: (e: Expense) => Promise<void>;
  updateExpense: (e: Expense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  exportAll: () => ExportPayload;
  importAll: (payload: ExportPayload, sqliteProfileId?: number) => Promise<void>;
  logout: () => void;
  deleteAllData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

const DEFAULT_GOALS: Goals = {
  retirement_age: 50,
  sip_stop_age: 50,
  pension_income: 100000,
  inflation_rate: 6,
  fire_type: 'moderate',
  fire_target_age: 100,
};

function dbProfileToEngine(p: DBProfile): Profile {
  return {
    id: String(p.id),
    name: p.name,
    dob: p.dob,
    currency: p.currency,
    monthly_income: p.monthly_income,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [assets, setAssetsState] = useState<Asset[]>([]);
  const [expenses, setExpensesState] = useState<Expense[]>([]);
  const [goals, setGoalsState] = useState<Goals | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Refs mirror state so mutation helpers can compute next values synchronously.
  const assetsRef = React.useRef<Asset[]>([]);
  const expensesRef = React.useRef<Expense[]>([]);
  // profileRef used in setGoals to avoid stale closure over profile state.
  const profileRef = React.useRef<Profile | null>(null);

  useEffect(() => {
    // Data loading now happens in loadProfile() after successful login.
    // This just unblocks rendering for screens that gate on isLoaded.
    setIsLoaded(true);
  }, []);

  /**
   * Load all data for a profile from SQLite into in-memory state.
   * Called by login.tsx after successful authentication (Batch 3).
   * Also available for use in syncToAppContext until login.tsx is updated.
   */
  const loadProfile = useCallback(async (profileId: number) => {
    const [dbProf, sqlAssets, sqlExpenses, sqlGoals] = await Promise.all([
      dbGetProfile(profileId),
      dbGetAssets(profileId),
      dbGetExpenses(profileId),
      dbGetGoals(profileId),
    ]);

    if (!dbProf) throw new Error(`Profile ${profileId} not found in SQLite`);

    const engineProfile = dbProfileToEngine(dbProf);

    const engineAssets: Asset[] = sqlAssets.map(a => ({
      id: String(a.id),
      name: a.name,
      category: a.category,
      current_value: a.current_value,
      expected_roi: a.expected_roi,
      is_self_use: !!a.is_self_use,
      is_recurring: !!a.is_recurring,
      recurring_amount: a.recurring_amount ?? undefined,
      recurring_frequency: a.recurring_frequency ?? undefined,
      next_vesting_date: a.next_vesting_date ?? undefined,
      vesting_end_date: a.vesting_end_date ?? undefined,
    }));

    const engineExpenses: Expense[] = sqlExpenses.map(e => ({
      id: String(e.id),
      name: e.name,
      category: e.category,
      expense_type: e.expense_type as Expense['expense_type'],
      amount: e.amount,
      frequency: e.frequency ?? undefined,
      inflation_rate: e.inflation_rate,
      start_date: e.start_date ?? undefined,
      end_date: e.end_date ?? undefined,
    }));

    const engineGoals: Goals | null = sqlGoals
      ? {
          retirement_age: sqlGoals.retirement_age,
          sip_stop_age: sqlGoals.sip_stop_age,
          pension_income: sqlGoals.pension_income ?? undefined,
          fire_type: sqlGoals.fire_type,
          fire_target_age: sqlGoals.fire_target_age,
          withdrawal_rate: sqlGoals.withdrawal_rate,
          inflation_rate: sqlGoals.inflation_rate,
        }
      : null;

    profileRef.current = engineProfile;
    assetsRef.current = engineAssets;
    expensesRef.current = engineExpenses;
    setProfileState(engineProfile);
    setAssetsState(engineAssets);
    setExpensesState(engineExpenses);
    setGoalsState(engineGoals);
    setIsLoaded(true);
  }, []);

  /** In-memory only — callers persist profile changes via db/queries directly. */
  const setProfile = useCallback((p: Profile) => {
    profileRef.current = p;
    setProfileState(p);
  }, []);

  /** In-memory only — keeps login.tsx syncToAppContext working until Batch 3. */
  const setAssets = useCallback((a: Asset[]) => {
    assetsRef.current = a;
    setAssetsState(a);
  }, []);

  /** In-memory only — keeps login.tsx syncToAppContext working until Batch 3. */
  const setExpenses = useCallback((e: Expense[]) => {
    expensesRef.current = e;
    setExpensesState(e);
  }, []);

  /** Persists to SQLite then updates in-memory state. */
  const setGoals = useCallback(async (g: Goals) => {
    const pid = profileRef.current ? parseInt(String(profileRef.current.id), 10) : NaN;
    if (!isNaN(pid)) {
      await dbSaveGoals(
        pid,
        g.retirement_age,
        g.sip_stop_age,
        g.pension_income ?? undefined,
        (g as any).fire_type ?? 'moderate',
        (g as any).fire_target_age ?? 100,
        (g as any).withdrawal_rate ?? 5,
        g.inflation_rate ?? 6,
      );
    }
    setGoalsState(g);
  }, []);

  // Functional state updaters — use refs so the next value is computed
  // synchronously before React re-renders.
  const mutateAssets = useCallback((updater: (prev: Asset[]) => Asset[]) => {
    const next = updater(assetsRef.current);
    assetsRef.current = next;
    setAssetsState(next);
  }, []);

  const mutateExpenses = useCallback((updater: (prev: Expense[]) => Expense[]) => {
    const next = updater(expensesRef.current);
    expensesRef.current = next;
    setExpensesState(next);
  }, []);

  const addAsset = useCallback(async (a: Asset) => {
    const profileId = profile ? parseInt(String(profile.id), 10) : NaN;
    if (isNaN(profileId)) return;
    try {
      const sqliteId = await dbCreateAsset({
        profile_id: profileId,
        category: a.category,
        name: a.name,
        current_value: a.current_value,
        currency: String((a as any).currency ?? profile?.currency ?? 'INR'),
        expected_roi: a.expected_roi ?? 0,
        is_recurring: a.is_recurring ? 1 : 0,
        recurring_amount: (a.recurring_amount as number | null) ?? null,
        recurring_frequency: (a.recurring_frequency as string | null) ?? null,
        next_vesting_date: (a.next_vesting_date as string | null) ?? null,
        vesting_end_date: (a.vesting_end_date as string | null) ?? null,
        is_self_use: a.is_self_use ? 1 : 0,
        gold_silver_unit: (a as any).gold_silver_unit ?? null,
        gold_silver_quantity: (a as any).gold_silver_quantity ?? null,
      });
      // Only update in-memory state after SQLite succeeds, using the canonical numeric ID.
      mutateAssets(prev => [...prev, { ...a, id: String(sqliteId) }]);
    } catch (e) {
      if (__DEV__) console.warn('[addAsset] SQLite write failed', e);
      // No in-memory fallback — prevents orphaned assets with alphanumeric IDs.
    }
  }, [mutateAssets, profile]);

  const updateAsset = useCallback(async (a: Asset) => {
    const numId = parseInt(String(a.id), 10);
    if (isNaN(numId)) return;
    try {
      await dbUpdateAsset({
        id: numId,
        profile_id: profile ? parseInt(String(profile.id), 10) : 0,
        category: a.category,
        name: a.name,
        current_value: a.current_value,
        currency: String((a as any).currency ?? profile?.currency ?? 'INR'),
        expected_roi: a.expected_roi ?? 0,
        is_recurring: a.is_recurring ? 1 : 0,
        recurring_amount: (a.recurring_amount as number | null) ?? null,
        recurring_frequency: (a.recurring_frequency as string | null) ?? null,
        next_vesting_date: (a.next_vesting_date as string | null) ?? null,
        vesting_end_date: (a.vesting_end_date as string | null) ?? null,
        is_self_use: a.is_self_use ? 1 : 0,
        gold_silver_unit: (a as any).gold_silver_unit ?? null,
        gold_silver_quantity: (a as any).gold_silver_quantity ?? null,
      });
      mutateAssets(prev => prev.map(x => x.id === a.id ? a : x));
    } catch (e) {
      if (__DEV__) console.warn('[updateAsset] SQLite write failed', e);
    }
  }, [mutateAssets, profile]);

  const deleteAsset = useCallback(async (id: string) => {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return;
    try {
      await dbDeleteAsset(numId);
      mutateAssets(prev => prev.filter(x => x.id !== id));
    } catch (e) {
      if (__DEV__) console.warn('[deleteAsset] SQLite delete failed', e);
    }
  }, [mutateAssets]);

  const addExpense = useCallback(async (e: Expense) => {
    const profileId = profile ? parseInt(String(profile.id), 10) : NaN;
    if (isNaN(profileId)) return;
    try {
      const sqliteId = await dbCreateExpense({
        profile_id: profileId,
        name: e.name,
        category: e.category,
        amount: e.amount,
        currency: String((e as any).currency ?? profile?.currency ?? 'INR'),
        expense_type: e.expense_type,
        frequency: (e.frequency as string | null) ?? null,
        start_date: (e.start_date as string | null) ?? null,
        end_date: (e.end_date as string | null) ?? null,
        inflation_rate: e.inflation_rate ?? 6,
      });
      mutateExpenses(prev => [...prev, { ...e, id: String(sqliteId) }]);
    } catch (e2) {
      if (__DEV__) console.warn('[addExpense] SQLite write failed', e2);
    }
  }, [mutateExpenses, profile]);

  const updateExpense = useCallback(async (e: Expense) => {
    const numId = parseInt(String(e.id), 10);
    if (isNaN(numId)) return;
    try {
      await dbUpdateExpense({
        id: numId,
        profile_id: profile ? parseInt(String(profile.id), 10) : 0,
        name: e.name,
        category: e.category,
        amount: e.amount,
        currency: String((e as any).currency ?? profile?.currency ?? 'INR'),
        expense_type: e.expense_type,
        frequency: (e.frequency as string | null) ?? null,
        start_date: (e.start_date as string | null) ?? null,
        end_date: (e.end_date as string | null) ?? null,
        inflation_rate: e.inflation_rate ?? 6,
      });
      mutateExpenses(prev => prev.map(x => x.id === e.id ? e : x));
    } catch (e2) {
      if (__DEV__) console.warn('[updateExpense] SQLite write failed', e2);
    }
  }, [mutateExpenses, profile]);

  const deleteExpense = useCallback(async (id: string) => {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return;
    try {
      await dbDeleteExpense(numId);
      mutateExpenses(prev => prev.filter(x => x.id !== id));
    } catch (e) {
      if (__DEV__) console.warn('[deleteExpense] SQLite delete failed', e);
    }
  }, [mutateExpenses]);

  const logout = useCallback(() => {
    profileRef.current = null;
    assetsRef.current = [];
    expensesRef.current = [];
    setProfileState(null);
    setAssetsState([]);
    setExpensesState([]);
    setGoalsState(null);
    // Keep storage intact so the user can log back in.
  }, []);

  const deleteAllData = useCallback(async () => {
    // SQLite CASCADE handles assets, expenses, goals rows automatically.
    try {
      const profiles = await dbGetAllProfiles();
      await Promise.all(profiles.map(p => dbDeleteProfile(p.id)));
    } catch (e) {
      if (__DEV__) console.warn('[deleteAllData] SQLite wipe failed', e);
    }
    // Clear legacy migration sentinel so it re-gates on next fresh install.
    await AsyncStorage.removeItem(LEGACY_MIGRATION_SENTINEL);
    profileRef.current = null;
    assetsRef.current = [];
    expensesRef.current = [];
    setProfileState(null);
    setAssetsState([]);
    setExpensesState([]);
    setGoalsState(null);
  }, []);

  const exportAll = useCallback((): ExportPayload => ({
    version: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profile,
    assets,
    expenses,
    goals,
  }), [profile, assets, expenses, goals]);

  const importAll = useCallback(async (payload: ExportPayload, sqliteProfileId?: number) => {
    if (!payload || typeof payload !== 'object' || typeof payload.version !== 'number') {
      throw new Error('Unsupported or invalid backup format.');
    }
    if (payload.version > CURRENT_SCHEMA_VERSION) {
      throw new Error(
        `Backup is from a newer app version (v${payload.version}). Please update the app to import it.`,
      );
    }
    if (sqliteProfileId == null) {
      throw new Error('Cannot import: no profile loaded. Log in first.');
    }

    const DEFAULT_PROFILE: Profile = {
      id: String(sqliteProfileId),
      name: 'My Profile',
      dob: '1995-01-01',
      currency: 'INR',
      monthly_income: 150000,
    };

    const nextProfile = payload.profile ?? DEFAULT_PROFILE;
    const nextAssets = Array.isArray(payload.assets) ? payload.assets : [];
    const nextExpenses = Array.isArray(payload.expenses) ? payload.expenses : [];
    const nextGoals = payload.goals ?? DEFAULT_GOALS;

    // Run the backup through the migration pipeline so older files stay importable.
    const { blobs: migrated } = runMigrations(payload.version, {
      profile: nextProfile,
      assets: nextAssets,
      expenses: nextExpenses,
      goals: nextGoals,
    });

    const finalProfile = migrated.profile ?? DEFAULT_PROFILE;
    const finalGoals = migrated.goals ?? DEFAULT_GOALS;

    // Write assets to SQLite, capturing the new canonical IDs.
    const assetPromises = migrated.assets.map(async (a) => {
      const sqlId = await dbCreateAsset({
        profile_id: sqliteProfileId,
        category: a.category,
        name: a.name,
        current_value: a.current_value,
        currency: String((a as any).currency ?? 'INR'),
        expected_roi: a.expected_roi ?? 0,
        is_recurring: a.is_recurring ? 1 : 0,
        recurring_amount: (a.recurring_amount as number | null) ?? null,
        recurring_frequency: (a.recurring_frequency as string | null) ?? null,
        next_vesting_date: (a.next_vesting_date as string | null) ?? null,
        vesting_end_date: (a.vesting_end_date as string | null) ?? null,
        is_self_use: a.is_self_use ? 1 : 0,
        gold_silver_unit: (a as any).gold_silver_unit ?? null,
        gold_silver_quantity: (a as any).gold_silver_quantity ?? null,
      });
      return { ...a, id: String(sqlId) };
    });
    const finalAssets = await Promise.all(assetPromises);

    const expensePromises = migrated.expenses.map(async (e) => {
      const sqlId = await dbCreateExpense({
        profile_id: sqliteProfileId,
        name: e.name,
        category: e.category,
        amount: e.amount,
        currency: String((e as any).currency ?? 'INR'),
        expense_type: e.expense_type,
        frequency: (e.frequency as string | null) ?? null,
        start_date: (e.start_date as string | null) ?? null,
        end_date: (e.end_date as string | null) ?? null,
        inflation_rate: e.inflation_rate ?? 6,
      });
      return { ...e, id: String(sqlId) };
    });
    const finalExpenses = await Promise.all(expensePromises);

    if (finalGoals) {
      await dbSaveGoals(
        sqliteProfileId,
        finalGoals.retirement_age,
        finalGoals.sip_stop_age,
        finalGoals.pension_income ?? undefined,
        (finalGoals as any).fire_type ?? 'moderate',
        (finalGoals as any).fire_target_age ?? 100,
        (finalGoals as any).withdrawal_rate ?? 5,
        finalGoals.inflation_rate ?? 6,
      );
    }

    profileRef.current = finalProfile;
    assetsRef.current = finalAssets;
    expensesRef.current = finalExpenses;
    setProfileState(finalProfile);
    setAssetsState(finalAssets);
    setExpensesState(finalExpenses);
    setGoalsState(finalGoals);
  }, []);

  return (
    <AppContext.Provider value={{
      profile, assets, expenses, goals, isLoaded,
      loadProfile,
      setProfile, setAssets, setExpenses, setGoals,
      addAsset, updateAsset, deleteAsset,
      addExpense, updateExpense, deleteExpense,
      exportAll, importAll,
      logout, deleteAllData,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
