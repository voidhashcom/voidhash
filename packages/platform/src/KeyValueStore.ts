import type { Effect, Option, Schema } from "effect";
import { Context, Schema as EffectSchema } from "effect";

import type { PlatformRuntime } from "./PlatformRuntime.ts";

/** Stable failure raised by a platform key-value operation. */
export class KeyValueStoreError extends EffectSchema.TaggedErrorClass<KeyValueStoreError>(
  "KeyValueStoreError",
)("KeyValueStoreError", {
  cause: EffectSchema.String,
  namespace: EffectSchema.String,
  operation: EffectSchema.String,
}) {}

/** Optional expiry applied when a key-value entry is written. */
export interface KeyValuePutOptions {
  readonly ttlMillis?: number;
}

/** A typed key-value entry used by atomic bulk writes. */
export interface KeyValueEntry<A> {
  readonly key: string;
  readonly value: A;
}

/** Provider-neutral typed key-value runtime. */
export interface KeyValueStoreShape {
  /** Reads and schema-decodes one unexpired value. */
  readonly get: <A, I>(
    namespace: string,
    key: string,
    schema: Schema.Codec<A, I>,
  ) => Effect.Effect<Option.Option<A>, KeyValueStoreError, PlatformRuntime>;
  /** Schema-encodes and writes one value. */
  readonly put: <A, I>(
    namespace: string,
    key: string,
    value: A,
    schema: Schema.Codec<A, I>,
    options?: KeyValuePutOptions,
  ) => Effect.Effect<void, KeyValueStoreError, PlatformRuntime>;
  /** Atomically schema-encodes and writes a value batch. */
  readonly putMany: <A, I>(
    namespace: string,
    entries: ReadonlyArray<KeyValueEntry<A>>,
    schema: Schema.Codec<A, I>,
    options?: KeyValuePutOptions,
  ) => Effect.Effect<void, KeyValueStoreError, PlatformRuntime>;
  /** Returns the subset of keys that currently have unexpired values. */
  readonly existingKeys: (
    namespace: string,
    keys: ReadonlyArray<string>,
  ) => Effect.Effect<ReadonlySet<string>, KeyValueStoreError, PlatformRuntime>;
  /** Deletes one key. */
  readonly delete: (
    namespace: string,
    key: string,
  ) => Effect.Effect<void, KeyValueStoreError, PlatformRuntime>;
  /** Atomically deletes a key batch. */
  readonly deleteMany: (
    namespace: string,
    keys: ReadonlyArray<string>,
  ) => Effect.Effect<void, KeyValueStoreError, PlatformRuntime>;
  /** Atomically increments an integer counter and returns its new value. */
  readonly increment: (
    namespace: string,
    key: string,
    options?: KeyValuePutOptions,
  ) => Effect.Effect<number, KeyValueStoreError, PlatformRuntime>;
  /** Deletes a bounded batch of expired entries and returns the deleted count. */
  readonly pruneExpired: (
    limit: number,
  ) => Effect.Effect<number, KeyValueStoreError, PlatformRuntime>;
}

/** Provider-neutral key-value runtime used by application composition roots. */
export class KeyValueStore extends Context.Service<KeyValueStore, KeyValueStoreShape>()(
  "@voidhash/platform/KeyValueStore",
) {}
