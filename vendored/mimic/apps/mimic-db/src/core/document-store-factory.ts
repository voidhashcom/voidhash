import * as Context from "effect/Context";
import * as Layer from "effect/Layer";

import { makeMemoryDocumentStore } from "./memory-store.ts";
import type { DocumentStoreApi } from "./store.ts";

/** Selects the document persistence adapter for one entity address. */
export interface DocumentStoreFactoryShape {
  readonly make: (collectionId: string, documentId: string) => DocumentStoreApi;
}

/** Runtime-selected document persistence factory used by the portable host. */
export class DocumentStoreFactory extends Context.Service<
  DocumentStoreFactory,
  DocumentStoreFactoryShape
>()("@voidhash/mimic-db/DocumentStoreFactory") {}

/** In-memory document stores for tests and ephemeral standalone development. */
export const MemoryDocumentStoreFactoryLive: Layer.Layer<DocumentStoreFactory> = Layer.succeed(
  DocumentStoreFactory,
  DocumentStoreFactory.of({ make: () => makeMemoryDocumentStore() }),
);
