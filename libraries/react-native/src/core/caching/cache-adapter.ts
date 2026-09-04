import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";
import * as Schema from "effect/Schema";

/** The underlying store could not answer a read. Treated as a miss by every caller. */
export class CacheReadFailed extends Schema.TaggedErrorClass<CacheReadFailed>()("CacheReadFailed", {
  cause: Schema.Unknown,
  key: Schema.String,
  message: Schema.String,
}) {}

/** The underlying store rejected a write or delete. The value stays in memory. */
export class CacheWriteFailed extends Schema.TaggedErrorClass<CacheWriteFailed>()(
  "CacheWriteFailed",
  { cause: Schema.Unknown, key: Schema.String, message: Schema.String },
) {}

/**
 * Raw key/value store the SDK persists to. A fault in the store is a typed
 * failure, never a defect: device storage can be full, locked or corrupt, and
 * none of that is allowed to take the SDK down.
 */
export class CacheAdapter extends Context.Service<
  CacheAdapter,
  {
    readonly get: (key: string) => Effect.Effect<Option.Option<string>, CacheReadFailed>;
    readonly set: (key: string, value: string) => Effect.Effect<void, CacheWriteFailed>;
    readonly delete: (key: string) => Effect.Effect<void, CacheWriteFailed>;
  }
>()("rn-voidhash/CacheAdapter") {}
