import { Effect } from "effect";

import {
  createVoidhashSdk as createVoidhashEffectSdk,
  type VoidhashNodeEffectClient,
} from "./effect-client";
import type { FilterSdkGroup } from "./internal/filter-sdk-group";
import type { VoidhashNodeClientOptions } from "./types";

type RuntimePromisifyClient<TClient> = {
  readonly [Key in keyof TClient]: TClient[Key] extends (
    ...args: infer Args
  ) => Effect.Effect<infer Result, infer _Error, infer _Requirements>
    ? (...args: Args) => Promise<Result>
    : TClient[Key] extends object
      ? RuntimePromisifyClient<TClient[Key]>
      : TClient[Key];
};

const promisifyClient = <TClient extends object>(
  client: TClient
): RuntimePromisifyClient<TClient> => {
  const entries = Object.entries(client).map(([key, value]) => {
    if (typeof value === "function") {
      return [
        key,
        (...args: Array<unknown>) =>
          Effect.runPromise(
            Reflect.apply(
              value as (...parameters: Array<unknown>) => Effect.Effect<unknown>,
              client,
              args
            )
          ),
      ];
    }

    if (value && typeof value === "object") {
      return [key, promisifyClient(value)];
    }

    return [key, value];
  });

  return Object.fromEntries(entries) as RuntimePromisifyClient<TClient>;
};

export type VoidhashNodeClient = RuntimePromisifyClient<VoidhashNodeEffectClient>;

export const createVoidhashSdk = (
  options: VoidhashNodeClientOptions
): VoidhashNodeClient =>
  promisifyClient(
    createVoidhashEffectSdk(options)
  ) as unknown as VoidhashNodeClient;

export type { VoidhashNodeEffectClient };
