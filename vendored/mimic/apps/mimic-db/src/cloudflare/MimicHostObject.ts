import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import type { MigrationRegistry } from "@voidhash/mimic-server/migrate";

import { getConfig } from "../config.ts";
import { makeControlEngine } from "../core/control-engine.ts";
import { ensureMigrationRegistry } from "../core/migration-registry.ts";
import { makeSqlControlStore } from "./SqlControlStore.ts";
import { makeControlStoreRpcServer } from "./ControlStoreRpc.ts";

/**
 * Control-plane Durable Object (single instance, addressed as `"default"`).
 *
 * Holds the entire control plane in SQLite: databases, collections, legacy
 * schema history, users, grants, document tokens, and the document index. It
 * exposes the `ControlStore` primitives directly — the `ControlEngine`
 * business logic runs in the caller (worker or document DO) over this stub.
 * Bootstraps the root user on first access.
 */
export const makeMimicHostObject = (migrations: MigrationRegistry) => {
  class MimicHostObject extends Cloudflare.DurableObject<MimicHostObject>()(
    "MimicHostObject",
    Effect.gen(function* () {
      yield* Effect.void;
      return Effect.gen(function* () {
        const state = yield* Cloudflare.DurableObjectState;
        const store = yield* makeSqlControlStore(state.storage.sql);
        yield* ensureMigrationRegistry(store, migrations);
        const control = makeControlEngine(store, migrations);
        const config = getConfig();
        yield* control.ensureRootUser(config.rootUsername, config.rootPassword);
        return makeControlStoreRpcServer(store);
      });
    }),
  ) {}

  return MimicHostObject;
};
