import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";

export class CacheAdapter extends Context.Service<
  CacheAdapter,
  {
    readonly get: (key: string) => Effect.Effect<Option.Option<string>>;
    readonly set: (key: string, value: string) => Effect.Effect<void>;
    readonly delete: (key: string) => Effect.Effect<void>;
    readonly keys: () => Effect.Effect<ReadonlyArray<string>>;
  }
>()("web-voidhash/CacheAdapter") {}
