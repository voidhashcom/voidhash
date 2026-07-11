import { NodeRuntime } from "@effect/platform-node";
import { runAppDatabaseMigrations } from "@voidhash/db/migrations";
import { Effect, Layer } from "effect";

import { migrateSelfhostClickhouse } from "./backend/Clickhouse.ts";
import { getSelfhostClickhouseConfig, getSelfhostDatabaseConfig } from "./config.ts";
import { getMimicNodeConfig } from "./mimic/config.ts";
import { makeMimicNodeHostLive } from "./mimic/MimicNode.ts";

NodeRuntime.runMain(
  Effect.scoped(
    Effect.gen(function* () {
      const result = yield* runAppDatabaseMigrations(getSelfhostDatabaseConfig());
      yield* Layer.build(makeMimicNodeHostLive(getMimicNodeConfig()));
      yield* migrateSelfhostClickhouse(getSelfhostClickhouseConfig());
      yield* Effect.logInfo("Self-host database migrations are ready", {
        applied: result.applied.length,
        skipped: result.skipped,
      });
    }),
  ) as never,
);
