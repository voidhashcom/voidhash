import * as R from "effect/Record";
import * as P from "effect/Predicate";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";

import {
  createVoidhashSdk as createVoidhashEffectSdk,
  type VoidhashNodeEffectClient,
} from "./effect-client";
import type { VoidhashNodeClientOptions } from "./types";

type StringRecord = Readonly<Record<string, unknown>>;

const runtime = ManagedRuntime.make(Layer.empty);

type RuntimePromisifyClient<TClient extends StringRecord> = {
  readonly [Key in keyof TClient]: TClient[Key] extends (
    ...args: infer Args
  ) => Effect.Effect<infer Result, infer _Error, infer _Requirements>
    ? (...args: Args) => Promise<Result>
    : TClient[Key] extends object
      ? RuntimePromisifyClient<TClient[Key] & StringRecord>
      : TClient[Key];
};

const isEffectMethod = (
  value: unknown,
): value is (...parameters: Array<unknown>) => Effect.Effect<unknown> => P.isFunction(value);

const isNestedNamespace = (value: unknown): value is StringRecord =>
  P.isObject(value) && value !== null;

/**
 * Recursively mirrors an Effect client, replacing every Effect-returning method
 * with a Promise-returning one. The returned shape is described by
 * {@link RuntimePromisifyClient}, which the untyped runtime walk below cannot
 * express, so the public signature is declared as an overload.
 */
function promisifyClient<TClient extends StringRecord>(
  client: TClient,
): RuntimePromisifyClient<TClient>;
function promisifyClient<TClient extends StringRecord>(client: TClient): unknown {
  const entries = R.toEntries(client).map(([key, value]): [string, unknown] => {
    if (isEffectMethod(value)) {
      return [key, (...args: Array<unknown>) => runtime.runPromise(value.apply(client, args))];
    }

    if (isNestedNamespace(value)) {
      return [key, promisifyClient(value)];
    }

    return [key, value];
  });

  return R.fromEntries(entries);
}

export type VoidhashNodeClient = RuntimePromisifyClient<VoidhashNodeEffectClient>;

export const createVoidhashSdk = (options: VoidhashNodeClientOptions): VoidhashNodeClient =>
  promisifyClient(createVoidhashEffectSdk(options));

export type { VoidhashNodeEffectClient };
