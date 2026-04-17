/**
 * Schema migrations for persisted storage.
 *
 * Contract:
 *   - Migration steps are pure (no I/O), idempotent, and defensive.
 *   - `runMigrations` throws if a step is missing for a required gap or if a
 *     step itself throws. Callers MUST NOT bump `SCHEMA_VERSION_KEY` on
 *     failure — that would mark broken data as up-to-date and prevent retry.
 *
 * Adding a new migration:
 *   1. Bump `CURRENT_SCHEMA_VERSION`.
 *   2. Register the step under its source version in `STEPS`.
 *   3. Make sure the step tolerates missing/extra fields.
 */

import { Asset, Expense, Goals, Profile, FrequencyInput } from '../engine/types';

export const CURRENT_SCHEMA_VERSION = 2;
export const SCHEMA_VERSION_KEY = '@fire_schema_version';

export interface StoredBlobs {
  profile: Profile | null;
  assets: Asset[];
  expenses: Expense[];
  goals: Goals | null;
}

type MigrationStep = (blobs: StoredBlobs) => StoredBlobs;

/**
 * v1 → v2: Normalize legacy frequency aliases (`'ANNUAL'`, `'YEARLY'`) to the
 * canonical `'ANNUALLY'`.
 */
const migrateV1toV2: MigrationStep = (blobs) => {
  const FREQ_ALIAS: Partial<Record<FrequencyInput, FrequencyInput>> = {
    ANNUAL: 'ANNUALLY',
    YEARLY: 'ANNUALLY',
  };
  const normExpenses = (blobs.expenses ?? []).map((e): Expense => {
    if (!e || typeof e !== 'object') return e;
    const f = e.frequency as FrequencyInput | undefined;
    if (f && FREQ_ALIAS[f]) return { ...e, frequency: FREQ_ALIAS[f] as Expense['frequency'] };
    return e;
  });
  const normAssets = (blobs.assets ?? []).map((a): Asset => {
    if (!a || typeof a !== 'object') return a;
    const f = a.recurring_frequency as FrequencyInput | undefined;
    if (f && FREQ_ALIAS[f]) return { ...a, recurring_frequency: FREQ_ALIAS[f] as Asset['recurring_frequency'] };
    return a;
  });
  return { ...blobs, assets: normAssets, expenses: normExpenses };
};

const STEPS: Record<number, MigrationStep> = {
  // From version N → N+1.
  1: migrateV1toV2,
};

/**
 * Apply every migration step from `fromVersion` up to `CURRENT_SCHEMA_VERSION`.
 * Throws if a required step is missing or if a step itself throws — the caller
 * must catch and decide how to surface the failure (and MUST NOT bump the
 * stored schema version when this throws).
 *
 * `fromVersion` greater than `CURRENT_SCHEMA_VERSION` (e.g. data written by a
 * newer build, then opened by an older one after a downgrade) is returned
 * unchanged so the user can still see something rather than crash; the caller
 * should detect this via the `wasDowngrade` field and skip the rewrite.
 */
export interface MigrationResult {
  blobs: StoredBlobs;
  /** True when persisted version was newer than this build's CURRENT. */
  wasDowngrade: boolean;
  /** True when at least one step ran. */
  didMigrate: boolean;
}

export function runMigrations(fromVersion: number, blobs: StoredBlobs): MigrationResult {
  const from = Number.isFinite(fromVersion) && fromVersion >= 1 ? Math.floor(fromVersion) : 1;
  if (from > CURRENT_SCHEMA_VERSION) {
    return { blobs, wasDowngrade: true, didMigrate: false };
  }
  if (from === CURRENT_SCHEMA_VERSION) {
    return { blobs, wasDowngrade: false, didMigrate: false };
  }
  let current = blobs;
  for (let v = from; v < CURRENT_SCHEMA_VERSION; v++) {
    const step = STEPS[v];
    if (!step) {
      throw new Error(`Missing migration step for v${v} → v${v + 1}`);
    }
    current = step(current);
  }
  return { blobs: current, wasDowngrade: false, didMigrate: true };
}
