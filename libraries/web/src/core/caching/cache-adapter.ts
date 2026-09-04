import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";

export class CacheAdapter extends Context.Service<
  CacheAdapter,
  {
    /**
     * Reads a key. `options.refresh` bypasses any in-memory layer so a value
     * written by another tab is observed.
     */
    readonly get: (
      key: string,
      options?: { readonly refresh?: boolean },
    ) => Effect.Effect<Option.Option<string>>;
    /**
     * Writes a key. Resolves to `false` when the backing store rejected the
     * write (quota exceeded, private mode); the value is still readable from
     * memory for the lifetime of the page.
     */
    readonly set: (key: string, value: string) => Effect.Effect<boolean>;
    readonly delete: (key: string) => Effect.Effect<void>;
    readonly keys: () => Effect.Effect<ReadonlyArray<string>>;
  }
>()("web-voidhash/CacheAdapter") {}
