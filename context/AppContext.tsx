import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Profile, Asset, Expense, Goals } from '../engine/types';
import { secureGetItem, SecureReadResult, secureSetItem } from '../storage/secure';
import {
  CURRENT_SCHEMA_VERSION,
  SCHEMA_VERSION_KEY,
  StoredBlobs,
  runMigrations,
} from '../storage/migrations';

const STORAGE_KEYS = {
  PROFILE: '@fire_profile',
  ASSETS: '@fire_assets',
  EXPENSES: '@fire_expenses',
  GOALS: '@fire_goals',
  ONBOARDED: '@fire_onboarded',
};

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
  /** True once the user has completed the onboarding flow at least once. */
  onboarded: boolean;
  setProfile: (p: Profile) => Promise<void>;
  setAssets: (a: Asset[]) => Promise<void>;
  setExpenses: (e: Expense[]) => Promise<void>;
  setGoals: (g: Goals) => Promise<void>;
  addAsset: (a: Asset) => Promise<void>;
  updateAsset: (a: Asset) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  addExpense: (e: Expense) => Promise<void>;
  updateExpense: (e: Expense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  exportAll: () => ExportPayload;
  importAll: (payload: ExportPayload) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

const DEFAULT_PROFILE: Profile = {
  id: '1',
  name: 'My Profile',
  dob: '1995-01-01',
  currency: 'INR',
  monthly_income: 150000,
};

const DEFAULT_GOALS: Goals = {
  retirement_age: 50,
  sip_stop_age: 50,
  pension_income: 100000,
  inflation_rate: 6,
  fire_type: 'moderate',
  fire_target_age: 100,
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [assets, setAssetsState] = useState<Asset[]>([]);
  const [expenses, setExpensesState] = useState<Expense[]>([]);
  const [goals, setGoalsState] = useState<Goals | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [onboarded, setOnboarded] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  /**
   * Load all persisted blobs through the encrypted storage layer, applying
   * any pending schema migrations and re-saving the upgraded shape so future
   * loads are fast and stay encrypted at rest.
   */
  async function loadData() {
    try {
      const [profileRes, assetsRes, expensesRes, goalsRes, versionStr, onboardedStr] = await Promise.all([
        secureGetItem(STORAGE_KEYS.PROFILE),
        secureGetItem(STORAGE_KEYS.ASSETS),
        secureGetItem(STORAGE_KEYS.EXPENSES),
        secureGetItem(STORAGE_KEYS.GOALS),
        AsyncStorage.getItem(SCHEMA_VERSION_KEY),
        AsyncStorage.getItem(STORAGE_KEYS.ONBOARDED),
      ]);

      const all: SecureReadResult[] = [profileRes, assetsRes, expensesRes, goalsRes];
      const anyExisting = all.some(r => r.source !== 'missing');
      const anyLegacyPlaintext = all.some(r => r.source === 'legacy-plaintext');

      const initial: StoredBlobs = {
        profile: safeParse<Profile | null>(profileRes.value, null),
        assets: safeParse<Asset[]>(assetsRes.value, []),
        expenses: safeParse<Expense[]>(expensesRes.value, []),
        goals: safeParse<Goals | null>(goalsRes.value, null),
      };

      // Treat a missing version key as v1 (the original unversioned schema).
      const storedVersion = versionStr ? parseInt(versionStr, 10) || 1 : 1;

      let migration;
      let migrationFailed = false;
      try {
        migration = runMigrations(storedVersion, initial);
      } catch (err) {
        // If migration throws we keep the raw data in memory so the user can
        // still see/export it, but we DO NOT bump the schema version on disk
        // and we MUST NOT rewrite the blobs (writing them encrypted at the new
        // version would mask the failure on the next launch).
        // eslint-disable-next-line no-console
        console.error('[storage] migration failed; loading raw data without rewrite.', err);
        migration = { blobs: initial, didMigrate: false, wasDowngrade: false };
        migrationFailed = true;
      }
      const migrated = migration.blobs;

      // True first-launch detection: no stored data AND no onboarded flag.
      // We DO NOT seed DEFAULT_PROFILE here — index.tsx will redirect to the
      // onboarding screen instead so the user picks their own values.
      const isFirstLaunch = !anyExisting && onboardedStr !== '1';

      const nextProfile = migrated.profile;
      const nextAssets = anyExisting ? migrated.assets : [];
      const nextExpenses = anyExisting ? migrated.expenses : [];
      const nextGoals = migrated.goals ?? (isFirstLaunch ? null : DEFAULT_GOALS);

      setProfileState(nextProfile);
      setAssetsState(nextAssets);
      setExpensesState(nextExpenses);
      setGoalsState(nextGoals);
      setOnboarded(!isFirstLaunch && nextProfile !== null);

      // Rewrite only when something actually changed AND the data is in a
      // known-good state: legacy plaintext present, a migration step ran, or
      // the schema-version stamp is stale. Skip rewrite on a downgrade (data
      // written by a newer build) or on migration failure (would mask the
      // problem and stamp the new version over unmigrated data).
      const versionStale = storedVersion !== CURRENT_SCHEMA_VERSION;
      const needsRewrite =
        !migrationFailed
        && !migration.wasDowngrade
        && (anyLegacyPlaintext || migration.didMigrate || versionStale);

      if (needsRewrite) {
        await Promise.all([
          secureSetItem(STORAGE_KEYS.PROFILE, JSON.stringify(nextProfile)),
          secureSetItem(STORAGE_KEYS.ASSETS, JSON.stringify(nextAssets)),
          secureSetItem(STORAGE_KEYS.EXPENSES, JSON.stringify(nextExpenses)),
          secureSetItem(STORAGE_KEYS.GOALS, JSON.stringify(nextGoals)),
          AsyncStorage.setItem(SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA_VERSION)),
        ]);
      }
    } catch {
      // On a hard storage failure, leave everything null so the user is sent
      // through onboarding rather than handed bogus defaults silently.
      setProfileState(null);
      setAssetsState([]);
      setExpensesState([]);
      setGoalsState(null);
      setOnboarded(false);
    } finally {
      setIsLoaded(true);
    }
  }

  const setProfile = useCallback(async (p: Profile) => {
    setProfileState(p);
    await secureSetItem(STORAGE_KEYS.PROFILE, JSON.stringify(p));
  }, []);

  const setAssets = useCallback(async (a: Asset[]) => {
    setAssetsState(a);
    await secureSetItem(STORAGE_KEYS.ASSETS, JSON.stringify(a));
  }, []);

  const setExpenses = useCallback(async (e: Expense[]) => {
    setExpensesState(e);
    await secureSetItem(STORAGE_KEYS.EXPENSES, JSON.stringify(e));
  }, []);

  const setGoals = useCallback(async (g: Goals) => {
    setGoalsState(g);
    await secureSetItem(STORAGE_KEYS.GOALS, JSON.stringify(g));
  }, []);

  // Functional updates: read-modify-write through the latest state via the
  // updater function, then persist using the resolved next value.
  const mutateAssets = useCallback(async (updater: (prev: Asset[]) => Asset[]) => {
    let nextValue: Asset[] = [];
    setAssetsState(prev => {
      nextValue = updater(prev);
      return nextValue;
    });
    await secureSetItem(STORAGE_KEYS.ASSETS, JSON.stringify(nextValue));
  }, []);

  const mutateExpenses = useCallback(async (updater: (prev: Expense[]) => Expense[]) => {
    let nextValue: Expense[] = [];
    setExpensesState(prev => {
      nextValue = updater(prev);
      return nextValue;
    });
    await secureSetItem(STORAGE_KEYS.EXPENSES, JSON.stringify(nextValue));
  }, []);

  const addAsset = useCallback((a: Asset) => mutateAssets(prev => [...prev, a]), [mutateAssets]);
  const updateAsset = useCallback((a: Asset) => mutateAssets(prev => prev.map(x => x.id === a.id ? a : x)), [mutateAssets]);
  const deleteAsset = useCallback((id: string) => mutateAssets(prev => prev.filter(x => x.id !== id)), [mutateAssets]);

  const addExpense = useCallback((e: Expense) => mutateExpenses(prev => [...prev, e]), [mutateExpenses]);
  const updateExpense = useCallback((e: Expense) => mutateExpenses(prev => prev.map(x => x.id === e.id ? e : x)), [mutateExpenses]);
  const deleteExpense = useCallback((id: string) => mutateExpenses(prev => prev.filter(x => x.id !== id)), [mutateExpenses]);

  const exportAll = useCallback((): ExportPayload => ({
    version: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profile,
    assets,
    expenses,
    goals,
  }), [profile, assets, expenses, goals]);

  const importAll = useCallback(async (payload: ExportPayload) => {
    if (!payload || typeof payload !== 'object' || typeof payload.version !== 'number') {
      throw new Error('Unsupported or invalid backup format.');
    }
    if (payload.version > CURRENT_SCHEMA_VERSION) {
      throw new Error(
        `Backup is from a newer app version (v${payload.version}). Please update the app to import it.`,
      );
    }
    const nextProfile = payload.profile ?? DEFAULT_PROFILE;
    const nextAssets = Array.isArray(payload.assets) ? payload.assets : [];
    const nextExpenses = Array.isArray(payload.expenses) ? payload.expenses : [];
    const nextGoals = payload.goals ?? DEFAULT_GOALS;

    // Run imports through the migration pipeline so older backup files keep
    // working even after the schema moves forward.
    const { blobs: migrated } = runMigrations(payload.version, {
      profile: nextProfile,
      assets: nextAssets,
      expenses: nextExpenses,
      goals: nextGoals,
    });

    const finalProfile = migrated.profile ?? DEFAULT_PROFILE;
    const finalGoals = migrated.goals ?? DEFAULT_GOALS;

    setProfileState(finalProfile);
    setAssetsState(migrated.assets);
    setExpensesState(migrated.expenses);
    setGoalsState(finalGoals);
    setOnboarded(true);
    await Promise.all([
      secureSetItem(STORAGE_KEYS.PROFILE, JSON.stringify(finalProfile)),
      secureSetItem(STORAGE_KEYS.ASSETS, JSON.stringify(migrated.assets)),
      secureSetItem(STORAGE_KEYS.EXPENSES, JSON.stringify(migrated.expenses)),
      secureSetItem(STORAGE_KEYS.GOALS, JSON.stringify(finalGoals)),
      AsyncStorage.setItem(SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA_VERSION)),
      AsyncStorage.setItem(STORAGE_KEYS.ONBOARDED, '1'),
    ]);
  }, []);

  return (
    <AppContext.Provider value={{
      profile, assets, expenses, goals, isLoaded, onboarded,
      setProfile, setAssets, setExpenses, setGoals,
      addAsset, updateAsset, deleteAsset,
      addExpense, updateExpense, deleteExpense,
      exportAll, importAll,
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
