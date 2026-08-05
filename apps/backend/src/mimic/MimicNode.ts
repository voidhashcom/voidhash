import { HostServiceTag } from "@voidhash/mimic-db/app/hostService";
import {
  DocumentStoreFactory,
  type DocumentStoreFactoryShape,
} from "@voidhash/mimic-db/core/document-store-factory";
import { LocalHostServiceLive } from "@voidhash/mimic-db/core/local-host-service";
import { MigrationRegistryService } from "@voidhash/mimic-db/core/migration-registry";
import { PaywallMigrationRegistry } from "@voidhash/mimic-schema";
import {
  ensureDocumentTables,
  makePgDocumentStore,
  type PgDocumentConfig,
} from "@voidhash/mimic-db/core/pg-store";
import type {
  DurableEntityAlarmControl,
  DurableEntityHost,
} from "@voidhash/platform/DurableEntity";
import type { PgPlatformConfig } from "@voidhash/platform-selfhost/Postgres";
import { Effect, Layer } from "effect";

import { PgControlStoreLive } from "./PgControlStore.ts";

/** Database-backed configuration for the standalone mimic Node composition. */
export interface MimicNodeConfig {
  readonly database: PgPlatformConfig;
  readonly documents: PgDocumentConfig;
}

/**
 * Builds the persistent single-node mimic host. Control state, document logs,
 * snapshots, entity values, and alarms all survive process restarts in
 * Postgres.
 *
 * The entity layer is supplied by the caller rather than built here: it carries
 * the process-wide cluster topology, and a second topology in one process would
 * compete with the first for the same shard leases.
 */
export const makeMimicNodeHostLive = (
  config: MimicNodeConfig,
  entities: Layer.Layer<DurableEntityHost | DurableEntityAlarmControl>,
): Layer.Layer<HostServiceTag | DurableEntityHost | DurableEntityAlarmControl> => {
  const documentStores = Layer.effect(
    DocumentStoreFactory,
    ensureDocumentTables(config.documents).pipe(
      Effect.as(
        DocumentStoreFactory.of({
          make: (_collectionId, documentId) => makePgDocumentStore(config.documents, documentId),
        } satisfies DocumentStoreFactoryShape),
      ),
    ),
  );

  const host = LocalHostServiceLive.pipe(
    Layer.provide(PgControlStoreLive(config.database)),
    Layer.provide(entities),
    Layer.provide(documentStores),
    Layer.provide(Layer.succeed(MigrationRegistryService, PaywallMigrationRegistry)),
  );
  return Layer.merge(host, entities);
};
