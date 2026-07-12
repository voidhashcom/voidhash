import type { Effect, Option } from "effect";
import { Context, Schema } from "effect";

import type { PlatformRuntime } from "./PlatformRuntime.ts";

/** Stable failure raised by an object-storage adapter. */
export class ObjectStoreError extends Schema.TaggedErrorClass<ObjectStoreError>("ObjectStoreError")(
  "ObjectStoreError",
  {
    bucketName: Schema.String,
    cause: Schema.String,
    key: Schema.String,
    operation: Schema.String,
  },
) {}

/** Raw bytes and metadata returned for a stored object. */
export interface StoredObject {
  readonly body: Uint8Array;
  readonly contentType: string | null;
  readonly etag: string | null;
  readonly size: number;
}

/** Metadata returned without downloading an object body. */
export interface StoredObjectHead {
  readonly contentType: string | null;
  readonly etag: string | null;
  readonly size: number;
}

/** Input for an idempotent object write. */
export interface PutObjectInput {
  readonly key: string;
  readonly body: Uint8Array;
  readonly contentType?: string;
  readonly cacheControl?: string;
}

/** Provider-neutral object-storage capabilities for one bucket. */
export interface ObjectStoreShape {
  readonly bucketName: string;
  readonly put: (input: PutObjectInput) => Effect.Effect<void, ObjectStoreError, PlatformRuntime>;
  readonly get: (
    key: string,
  ) => Effect.Effect<Option.Option<StoredObject>, ObjectStoreError, PlatformRuntime>;
  readonly head: (
    key: string,
  ) => Effect.Effect<Option.Option<StoredObjectHead>, ObjectStoreError, PlatformRuntime>;
  readonly delete: (key: string) => Effect.Effect<void, ObjectStoreError, PlatformRuntime>;
}

/** Provider-neutral object store for a bucket selected by its live layer. */
export class ObjectStore extends Context.Service<ObjectStore, ObjectStoreShape>()(
  "@voidhash/platform/ObjectStore",
) {}
