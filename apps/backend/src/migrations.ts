import { runAppDatabaseMigrations } from "@voidhash/db/migrations";
import { PgClusterDurableEntityLive } from "@voidhash/platform-selfhost/ClusterDurableEntity";
import { Effect, Layer } from "effect";

import { migrateSelfhostClickhouse } from "./backend/Clickhouse.ts";
import { selfhostPlatformPostgres } from "./backend/PlatformProfile.ts";
import {
  getSelfhostClickhouseConfig,
  getSelfhostMigrationDatabaseConfig,
  getSelfhostPlatformDatabaseConfig,
  validateSelfhostSecurityConfig,
} from "./config.ts";
import { getMimicNodeConfig } from "./mimic/config.ts";
import { makeMimicNodeHostLive } from "./mimic/MimicNode.ts";

/** Extra migration sources a private composition owns alongside the OSS schema. */
export interface SelfhostMigrationOptions {
  /**
   * Directories holding `<timestamp>_<name>/migration.sql` folders, applied
   * after the OSS schema into the same `__alchemy_migrations` ledger.
   */
  readonly additionalDirectories?: ReadonlyArray<URL>;
}

/**
 * Applies every migration the self-host runtime needs: the application schema,
 * the mimic document control tables, and — when analytics is configured — the
 * ClickHouse schema.
 */
export const runSelfhostMigrations = (options: SelfhostMigrationOptions = {}) =>
  Effect.gen(function* () {
    validateSelfhostSecurityConfig();
    const connection = getSelfhostMigrationDatabaseConfig();
    const result = yield* runAppDatabaseMigrations(connection);
    let applied = result.applied.length;
    let skipped = result.skipped;
    for (const directory of options.additionalDirectories ?? []) {
      const extra = yield* runAppDatabaseMigrations(connection, { directory });
      applied += extra.applied.length;
      skipped += extra.skipped;
    }
    // Building the host is what creates the self-managed tables: the mimic
    // control and document tables in the application database, plus the entity
    // value and alarm stores in whichever database holds platform state.
    const mimicConfig = getMimicNodeConfig(connection);
    const platform = selfhostPlatformPostgres(getSelfhostPlatformDatabaseConfig(connection));
    yield* Layer.build(
      makeMimicNodeHostLive(mimicConfig, PgClusterDurableEntityLive(platform)),
    );
    yield* migrateSelfhostClickhouse(getSelfhostClickhouseConfig());
    yield* Effect.logInfo("Self-host database migrations are ready", { applied, skipped });
  });
