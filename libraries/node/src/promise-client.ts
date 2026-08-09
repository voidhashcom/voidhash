import { Effect } from "effect";

import {
  createVoidhashSdk as createVoidhashEffectSdk,
  type VoidhashNodeEffectClient,
} from "./effect-client";
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

const isEffectMethod = (
  value: unknown,
): value is (...parameters: Array<unknown>) => Effect.Effect<unknown> =>
  typeof value === "function";

const isNestedNamespace = (value: unknown): value is object =>
  typeof value === "object" && value !== null;

/**
 * Recursively mirrors an Effect client, replacing every Effect-returning method
 * with a Promise-returning one. The returned shape is described by
 * {@link RuntimePromisifyClient}, which the untyped runtime walk below cannot
 * express, so the public signature is declared as an overload.
 */
function promisifyClient<TClient extends object>(client: TClient): RuntimePromisifyClient<TClient>;
function promisifyClient(client: object): unknown {
  const entries = Object.entries(client).map(([key, value]): [string, unknown] => {
    if (isEffectMethod(value)) {
      return [
        key,
        (...args: Array<unknown>) => Effect.runPromise(Reflect.apply(value, client, args)),
      ];
    }

    if (isNestedNamespace(value)) {
      return [key, promisifyClient(value)];
    }

    return [key, value];
  });

  return Object.fromEntries(entries);
}

export type VoidhashNodeClient = RuntimePromisifyClient<VoidhashNodeEffectClient>;

export const createVoidhashSdk = (options: VoidhashNodeClientOptions): VoidhashNodeClient =>
  promisifyClient(createVoidhashEffectSdk(options));

export type { VoidhashNodeEffectClient };
