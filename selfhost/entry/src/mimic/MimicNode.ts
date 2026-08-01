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
import { DurableEntityHost } from "@voidhash/platform/DurableEntity";
import {
  NodeDurableEntityControl,
  type PgDurableEntityConfig,
  PgDurableEntityHostLive,
} from "@voidhash/platform-node/DurableEntity";
import { Effect, Layer } from "effect";

import { PgControlStoreLive } from "./PgControlStore.ts";

/** Database-backed configuration for the standalone mimic Node composition. */
export interface MimicNodeConfig {
  readonly database: PgDurableEntityConfig;
  readonly documents: PgDocumentConfig;
}

/**
 * Builds the persistent single-node mimic host. Control state, document logs,
 * snapshots, entity KV, and alarms all survive process restarts in Postgres.
 */
export const makeMimicNodeHostLive = (
  config: MimicNodeConfig,
): Layer.Layer<HostServiceTag | DurableEntityHost | NodeDurableEntityControl> => {
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

  const entities = PgDurableEntityHostLive(config.database);
  const host = LocalHostServiceLive.pipe(
    Layer.provide(PgControlStoreLive(config.database)),
    Layer.provide(entities),
    Layer.provide(documentStores),
    Layer.provide(Layer.succeed(MigrationRegistryService, PaywallMigrationRegistry)),
  );
  return Layer.merge(host, entities);
};
