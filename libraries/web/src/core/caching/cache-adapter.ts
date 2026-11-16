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
    /**
     * How much of the device's storage `key` takes, in UTF-16 code units, the
     * unit browsers count their quota in: `0` when the device holds nothing
     * for it. Reads the backing store without keeping the value.
     */
    readonly storedLength: (key: string) => Effect.Effect<number>;
    /**
     * Takes `key` off the device and keeps its value in memory for the page,
     * where reads still find it.
     */
    readonly holdInMemory: (key: string) => Effect.Effect<void>;
    /**
     * Writes the values kept only in memory to the device, where it now may
     * hold them. With `preferStored`, a value already on the device wins over
     * the one in memory, which is replaced by it: another tab stored it first.
     */
    readonly persistHeld: (options: { readonly preferStored: boolean }) => Effect.Effect<void>;
  }
>()("web-voidhash/CacheAdapter") {}
