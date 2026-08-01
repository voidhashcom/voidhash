import { NodeRuntime } from "@effect/platform-node";
import { runAppDatabaseMigrations } from "@voidhash/db/migrations";
import { Effect, Layer } from "effect";

import { migrateSelfhostClickhouse } from "./backend/Clickhouse.ts";
import {
  getSelfhostClickhouseConfig,
  getSelfhostMigrationDatabaseConfig,
  validateSelfhostSecurityConfig,
} from "./config.ts";
import { getMimicNodeConfig } from "./mimic/config.ts";
import { makeMimicNodeHostLive } from "./mimic/MimicNode.ts";

NodeRuntime.runMain(
  Effect.scoped(
    Effect.gen(function* () {
      validateSelfhostSecurityConfig();
      const connection = getSelfhostMigrationDatabaseConfig();
      const result = yield* runAppDatabaseMigrations(connection);
      yield* Layer.build(makeMimicNodeHostLive(getMimicNodeConfig(connection)));
      yield* migrateSelfhostClickhouse(getSelfhostClickhouseConfig());
      yield* Effect.logInfo("Self-host database migrations are ready", {
        applied: result.applied.length,
        skipped: result.skipped,
      });
    }),
  ) as never,
);
