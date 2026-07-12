import { Context, type Effect, Schema } from "effect";

/**
 * Catch-all error for {@link PublicFileStore} operations. Adapters wrap any
 * storage-backend failure (R2 SDK errors, network failures) into this single
 * tag so service catch boundaries stay small.
 */
export class PublicFileStoreError extends Schema.TaggedErrorClass<PublicFileStoreError>(
  "PublicFileStoreError",
)("PublicFileStoreError", {
  cause: Schema.String,
  message: Schema.String,
}) {}

export interface PublicFileObject {
  readonly body: Uint8Array;
  readonly contentType: string | null;
}

export interface PublicFileStoreShape {
  /**
   * Public origin (this worker's base URL) under which stored objects are
   * served at `GET /files/<key>`. Carried on the port — not a separate config
   * service — so URL builders stay colocated with the store that knows where it
   * is served from.
   */
  readonly publicBaseUrl: string;

  /** Absolute public URL for a stored object key: `${publicBaseUrl}/files/${key}`. */
  readonly publicUrl: (key: string) => string;

  /** Writes raw bytes at `key`, overwriting any existing object (idempotent). */
  readonly putObject: (input: {
    readonly key: string;
    readonly body: Uint8Array;
    readonly contentType: string | undefined;
  }) => Effect.Effect<void, PublicFileStoreError>;

  /** Reads the object at `key`; `null` when it does not exist. */
  readonly getObject: (key: string) => Effect.Effect<PublicFileObject | null, PublicFileStoreError>;

  /** Deletes the object at `key`; a no-op when it does not exist. */
  readonly deleteObject: (key: string) => Effect.Effect<void, PublicFileStoreError>;
}

/**
 * Provider-agnostic port for the object store holding public assets (avatars
 * today under `avatars/<entity>/<id>/<sha256>.<ext>`, room for more). The live
 * adapter (R2) is wired by the application root — core code only touches the
 * tag, keeping storage SDK dependencies out of `packages/core` and the store
 * trivially fakeable in tests with an in-memory map.
 */
export class PublicFileStore extends Context.Service<PublicFileStore, PublicFileStoreShape>()(
  "infrastructure/PublicFileStore",
) {}
