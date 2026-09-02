export { runFork, runPromise, runPromiseWith, runSync } from "effect/Effect";

import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";

import { unwrapOption } from "./option-boundary.ts";

/** Fails fast when an invariant-protected nullable value is absent. */
export const unsafeDefined = <A>(value: A): NonNullable<A> =>
  unwrapOption(Option.fromNullishOr(value));

export class BackendRuntimeError extends Schema.TaggedErrorClass<BackendRuntimeError>(
  "BackendRuntimeError",
)("BackendRuntimeError", { message: Schema.String }) {}

/** Creates a typed failure for an adapter or invariant boundary. */
export const runtimeError = (message: string): BackendRuntimeError =>
  new BackendRuntimeError({ message });

const JsonValue = Schema.fromJsonString(Schema.Unknown);

/** Decodes JSON text at an explicit schema boundary. */
export const parseJson = (value: unknown): unknown => Schema.decodeUnknownSync(JsonValue)(value);

/** Encodes an unknown value as JSON text at an explicit schema boundary. */
export const stringifyJson = (value: unknown): string => Schema.encodeSync(JsonValue)(value);

/** Builds a UTC epoch timestamp from calendar components. */
export const utcTimestamp = (
  year: number,
  monthIndex: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
): number =>
  DateTime.toEpochMillis(
    DateTime.makeUnsafe({
      day,
      hour,
      millisecond,
      minute,
      month: monthIndex + 1,
      second,
      year,
    }),
  );

/** Narrows a tagged union member without reading its discriminator directly. */
export const hasTag = <A, Tag extends string>(
  value: A,
  tag: Tag,
): value is Extract<A, { readonly _tag: Tag }> =>
  P.isObject(value) && Reflect.get(value, "_tag") === tag;

/** Bridges values supplied by structurally compatible external test and SDK adapters. */
export function assumeType<A>(value: unknown): A;
export function assumeType(value: unknown): unknown {
  return value;
}

/** Recovers a deliberately best-effort adapter with an explicit fallback value. */
export const recoverAll =
  <A2>(fallback: () => A2) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A | A2, never, R> =>
    Effect.matchEffect(effect, {
      onFailure: () => Effect.succeed(fallback()),
      onSuccess: Effect.succeed,
    });

/** Recovers failures and defects from an optional enrichment boundary. */
export const recoverCause =
  <A2>(fallback: () => A2) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A | A2, never, R> =>
    Effect.matchCauseEffect(effect, {
      onFailure: () => Effect.succeed(fallback()),
      onSuccess: Effect.succeed,
    });

/** Native fetch adapter required by external APIs that consume the Fetch interface. */
export const nativeFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
  globalThis["fetch"](input, init);
