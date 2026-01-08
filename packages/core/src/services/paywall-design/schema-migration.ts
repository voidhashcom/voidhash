/**
 * Schema migration for paywall design states.
 *
 * Handles versioning and migration of stored document state to support
 * backwards compatibility as the schema evolves.
 */

import { Effect } from "effect";

import { SchemaMigrationError } from "./errors";

/** Current schema version - increment when making breaking changes */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Versioned state wrapper stored in MySQL
 */
export interface VersionedState {
  readonly schemaVersion: number;
  readonly state: unknown;
}

/**
 * Type for migration functions
 */
type MigrationFn = (state: unknown) => unknown;

/**
 * Registry of migrations.
 * Key is the target version (migrating FROM previous version TO this version).
 *
 * Example:
 * - migrations[2] migrates from v1 -> v2
 * - migrations[3] migrates from v2 -> v3
 */
const migrations: Record<number, MigrationFn> = {
  // Migration from v0 (unversioned/legacy) to v1
  // Currently a no-op since v1 is the initial version
  // 1: (state) => state,

  // Future migrations:
  // 2: (state) => {
  //   // Example: Add new required field with default value
  //   const s = state as { name: string; children: unknown[] };
  //   return { ...s, newField: "default" };
  // },
};

/**
 * Check if a state needs migration
 */
export const needsMigration = (schemaVersion: number): boolean => {
  return schemaVersion < CURRENT_SCHEMA_VERSION;
};

/**
 * Migrate state from any version to current version.
 *
 * @param rawState - The raw state from storage (may be versioned or legacy)
 * @returns The migrated state at CURRENT_SCHEMA_VERSION
 */
export const migrateState = (
  rawState: unknown
): Effect.Effect<unknown, SchemaMigrationError> => {
  return Effect.gen(function* () {
    // Handle null/undefined early
    if (rawState === null || rawState === undefined) {
      return rawState;
    }

    // Handle legacy unversioned state (treat as v0)
    const versioned = rawState as Partial<VersionedState>;
    let currentVersion = versioned.schemaVersion ?? 0;

    // Extract the actual state (legacy states don't have wrapper)
    let state: unknown =
      versioned.state !== undefined ? versioned.state : rawState;

    // Apply migrations in sequence until we reach current version
    while (currentVersion < CURRENT_SCHEMA_VERSION) {
      const targetVersion = currentVersion + 1;
      const migration = migrations[targetVersion];

      if (migration) {
        try {
          state = migration(state);
        } catch (error) {
          return yield* Effect.fail(
            new SchemaMigrationError({
              cause: error,
              fromVersion: currentVersion,
              toVersion: targetVersion,
            })
          );
        }
      }

      currentVersion = targetVersion;
    }

    return state;
  });
};

/**
 * Migrate state synchronously (for use in non-Effect contexts)
 *
 * @throws SchemaMigrationError if migration fails
 */
export const migrateStateSync = (rawState: unknown): unknown => {
  // Handle null/undefined early
  if (rawState === null || rawState === undefined) {
    return rawState;
  }

  const versioned = rawState as Partial<VersionedState>;
  let currentVersion = versioned.schemaVersion ?? 0;
  let state: unknown =
    versioned.state !== undefined ? versioned.state : rawState;

  while (currentVersion < CURRENT_SCHEMA_VERSION) {
    const targetVersion = currentVersion + 1;
    const migration = migrations[targetVersion];

    if (migration) {
      state = migration(state);
    }

    currentVersion = targetVersion;
  }

  return state;
};

/**
 * Wrap state with version information for storage
 */
export const wrapWithVersion = (state: unknown): VersionedState => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  state,
});

/**
 * Extract schema version from stored state
 */
export const getSchemaVersion = (rawState: unknown): number => {
  if (rawState === null || rawState === undefined) {
    return 0;
  }
  const versioned = rawState as Partial<VersionedState>;
  return versioned.schemaVersion ?? 0;
};
