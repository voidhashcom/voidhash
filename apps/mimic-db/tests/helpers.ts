import { Effect } from "effect";
import type { Value } from "@voidhash/mimic-core";
import type { MigrationRegistry } from "@voidhash/mimic-server/migrate";

import type { HostService } from "../src/app/hostService.ts";
import { getConfig } from "../src/config.ts";
import { makeControlEngine, type ControlEngineApi } from "../src/core/control-engine.ts";
import {
  DocumentStoreFactory,
  MemoryDocumentStoreFactoryLive,
} from "../src/core/document-store-factory.ts";
import { LocalHostServiceDefault, makeLocalHostService } from "../src/core/local-host-service.ts";
import { makeMemoryDurableEntityHost } from "../src/core/local-entity-host.ts";
import { makeMemoryControlStore } from "../src/core/memory-store.ts";
import { EmptyMigrationRegistry, ensureMigrationRegistry } from "../src/core/migration-registry.ts";

/**
 * Run a program that depends on `HostServiceTag` against a fresh in-memory
 * backend. Compose the whole flow into a single program so control + document
 * state persists across the steps.
 */
export const runHost = <A, E>(program: Effect.Effect<A, E, any>): Promise<A> =>
  Effect.runPromise(program.pipe(Effect.provide(LocalHostServiceDefault)) as Effect.Effect<A, E>);

/**
 * Run `program` against a fresh in-memory host, giving it BOTH the host service
 * and the underlying control engine. The direct control-engine handle lets a
 * test reach past the host RPC surface to reproduce corrupt states — e.g.
 * registering a document index row with no backing document engine — that no
 * legitimate host call produces.
 */
export const runHostWithControl = <A, E>(
  program: (deps: {
    readonly host: HostService;
    readonly control: ControlEngineApi;
  }) => Effect.Effect<A, E, any>,
): Promise<A> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const control = makeControlEngine(makeMemoryControlStore());
      const config = getConfig();
      const documentStores = yield* DocumentStoreFactory;
      yield* control.ensureRootUser(config.rootUsername, config.rootPassword);
      const host = makeLocalHostService({
        control,
        entities: makeMemoryDurableEntityHost(),
        migrations: EmptyMigrationRegistry,
        documentStores,
        config,
      });
      return yield* program({ control, host });
    }).pipe(Effect.provide(MemoryDocumentStoreFactoryLive)) as Effect.Effect<A, E>,
  );

/** Runs a program against an in-memory host configured with deployed migrations. */
export const runHostWithRegistry = <A, E>(
  migrations: MigrationRegistry,
  program: (host: HostService) => Effect.Effect<A, E, any>,
): Promise<A> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const store = makeMemoryControlStore();
      const control = makeControlEngine(store, migrations);
      const config = getConfig();
      const documentStores = yield* DocumentStoreFactory;
      yield* ensureMigrationRegistry(store, migrations);
      yield* control.ensureRootUser(config.rootUsername, config.rootPassword);
      const host = makeLocalHostService({
        control,
        entities: makeMemoryDurableEntityHost(),
        migrations,
        documentStores,
        config,
      });
      return yield* program(host);
    }).pipe(Effect.provide(MemoryDocumentStoreFactoryLive)) as Effect.Effect<A, E>,
  );

/** A minimal mimic-core object schema with a single string field. */
export const titleSchema = {
  kind: "object" as const,
  fields: { title: { kind: "string" as const, default: { kind: "string" as const, value: "" } } },
};

/** v2 of {@link titleSchema}: adds a defaulted `count` number field. */
export const titleCountSchema = {
  kind: "object" as const,
  fields: {
    title: { kind: "string" as const, default: { kind: "string" as const, value: "" } },
    count: { kind: "number" as const, default: { kind: "number" as const, value: 0 } },
  },
};

export const objectValue = (fields: Record<string, Value>) => ({
  kind: "object" as const,
  fields,
});
export const stringValue = (value: string) => ({ kind: "string" as const, value });
export const numberValue = (value: number) => ({ kind: "number" as const, value });
