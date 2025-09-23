import { Context, type Effect } from 'effect';

export class CacheAdapter extends Context.Tag('rn-voidhash/CacheAdapter')<
  CacheAdapter,
  {
    readonly get: (key: string) => Effect.Effect<string | null>;
    readonly set: (key: string, value: string) => Effect.Effect<void>;
    readonly delete: (key: string) => Effect.Effect<void>;
  }
>() {}
