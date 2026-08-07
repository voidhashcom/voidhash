import { NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";

import { runSelfhostMigrations } from "./migrations.ts";

NodeRuntime.runMain(Effect.scoped(runSelfhostMigrations()));
