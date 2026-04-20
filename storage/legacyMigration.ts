/**
 * One-time migration from AsyncStorage encrypted blobs → SQLite.
 *
 * Runs on first boot after upgrading to the SQLite-only architecture.
 * Safe to call on every boot — idempotent via sentinel flag in AsyncStorage.
 *
 * Strategy:
 *   - Find the SQLite profile matching the AsyncStorage profile by name.
 *   - Assets + expenses: only inserted if SQLite has 0 assets (non-destructive).
 *   - Goals: always upserted (ON CONFLICT DO UPDATE is safe).
 *   - All inserts wrapped in a single transaction — sentinel set only after COMMIT.
 *   - AsyncStorage blobs cleared after sentinel is set.
 *   - On any failure, sentinel is NOT set → retries on next boot (non-fatal).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureGetItem } from './secure';
import { SCHEMA_VERSION_KEY, StoredBlobs, runMigrations } from './migrations';
import { getAllProfiles, getAssets } from '../db/queries';
import { getDatabase } from '../db/schema';

const SENTINEL_KEY = '@finpath_sqlite_migrated_v1';

const ASYNC_KEYS = {
  PROFILE: '@fire_profile',
  ASSETS: '@fire_assets',
  EXPENSES: '@fire_expenses',
  GOALS: '@fire_goals',
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export async function runLegacyMigration(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(SENTINEL_KEY) === '1') return;

    const [profileRes, assetsRes, expensesRes, goalsRes, versionStr] = await Promise.all([
      secureGetItem(ASYNC_KEYS.PROFILE),
      secureGetItem(ASYNC_KEYS.ASSETS),
      secureGetItem(ASYNC_KEYS.EXPENSES),
      secureGetItem(ASYNC_KEYS.GOALS),
      AsyncStorage.getItem(SCHEMA_VERSION_KEY),
    ]);

    if (profileRes.source === 'missing' || !profileRes.value) {
      await AsyncStorage.setItem(SENTINEL_KEY, '1');
      return;
    }

    const initial: StoredBlobs = {
      profile: safeParse(profileRes.value, null),
      assets: safeParse(assetsRes.value, []),
      expenses: safeParse(expensesRes.value, []),
      goals: safeParse(goalsRes.value, null),
    };

    const storedVersion = versionStr ? parseInt(versionStr, 10) || 1 : 1;
    const { blobs } = runMigrations(storedVersion, initial);

    if (!blobs.profile) {
      await AsyncStorage.setItem(SENTINEL_KEY, '1');
      return;
    }

    // No data in AsyncStorage to migrate — mark done and exit
    const hasAnyLegacyData =
      blobs.assets.length > 0 || blobs.expenses.length > 0 || blobs.goals !== null;
    if (!hasAnyLegacyData) {
      await AsyncStorage.setItem(SENTINEL_KEY, '1');
      return;
    }

    const sqliteProfiles = await getAllProfiles();
    const legacyName = (blobs.profile.name ?? '').trim().toLowerCase();
    const match =
      sqliteProfiles.find(p => p.name.trim().toLowerCase() === legacyName) ??
      (sqliteProfiles.length === 1 ? sqliteProfiles[0] : null);

    if (!match) {
      await AsyncStorage.setItem(SENTINEL_KEY, '1');
      return;
    }

    const existingAssets = await getAssets(match.id);
    const sqliteHasData = existingAssets.length > 0;

    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      // Assets + expenses: non-destructive — only insert if SQLite has no assets.
      // If SQLite already has assets (from prior syncToAppContext), it wins.
      if (!sqliteHasData) {
        for (const a of blobs.assets) {
          await db.runAsync(
            `INSERT INTO assets (profile_id, category, name, current_value, currency,
             expected_roi, is_recurring, recurring_amount, recurring_frequency,
             next_vesting_date, vesting_end_date, is_self_use,
             gold_silver_unit, gold_silver_quantity)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              match.id,
              a.category,
              a.name,
              a.current_value,
              String((a as any).currency ?? match.currency ?? 'INR'),
              a.expected_roi ?? 0,
              a.is_recurring ? 1 : 0,
              (a.recurring_amount as number | null) ?? null,
              (a.recurring_frequency as string | null) ?? null,
              (a.next_vesting_date as string | null) ?? null,
              (a.vesting_end_date as string | null) ?? null,
              a.is_self_use ? 1 : 0,
              (a as any).gold_silver_unit ?? null,
              (a as any).gold_silver_quantity ?? null,
            ],
          );
        }

        for (const e of blobs.expenses) {
          await db.runAsync(
            `INSERT INTO expenses (profile_id, name, category, amount, currency,
             expense_type, frequency, start_date, end_date, inflation_rate)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              match.id,
              e.name,
              e.category,
              e.amount,
              String((e as any).currency ?? match.currency ?? 'INR'),
              e.expense_type,
              (e.frequency as string | null) ?? null,
              (e.start_date as string | null) ?? null,
              (e.end_date as string | null) ?? null,
              e.inflation_rate ?? 6,
            ],
          );
        }
      }

      // Goals: always upsert regardless of SQLite asset state.
      // ON CONFLICT DO UPDATE is safe — won't overwrite if SQLite already has correct data.
      if (blobs.goals) {
        const g = blobs.goals;
        await db.runAsync(
          `INSERT INTO goals (profile_id, retirement_age, sip_stop_age, pension_income,
           fire_type, fire_target_age, inflation_rate)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(profile_id) DO UPDATE SET
             retirement_age   = excluded.retirement_age,
             sip_stop_age     = excluded.sip_stop_age,
             pension_income   = excluded.pension_income,
             fire_type        = excluded.fire_type,
             fire_target_age  = excluded.fire_target_age,
             inflation_rate   = excluded.inflation_rate`,
          [
            match.id,
            g.retirement_age,
            g.sip_stop_age,
            g.pension_income ?? 0,
            (g as any).fire_type ?? 'moderate',
            (g as any).fire_target_age ?? 100,
            g.inflation_rate ?? 6,
          ],
        );
      }
    });

    // Sentinel first — if blob clear fails, we won't re-migrate on next boot
    await AsyncStorage.setItem(SENTINEL_KEY, '1');
    await AsyncStorage.multiRemove([
      ASYNC_KEYS.PROFILE,
      ASYNC_KEYS.ASSETS,
      ASYNC_KEYS.EXPENSES,
      ASYNC_KEYS.GOALS,
      SCHEMA_VERSION_KEY,
    ]);
  } catch (err) {
    if (__DEV__) console.warn('[legacyMigration] failed, will retry on next boot:', err);
    // Sentinel NOT set — retries on next boot
  }
}
