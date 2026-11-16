/**
 * Checks for JSON the SDK did not produce in this page: answers from
 * Voidhash and values read back from storage, which another release or a
 * browser extension may have written. Written out rather than declared with
 * Effect's Schema, which would add more to every page than the rest of the
 * SDK's runtime.
 */
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";

/** A JSON object: not `null` and not an array. */
export const isJsonObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  P.isObject(value) && !Array.isArray(value);

/** Parses JSON text; none when it is not JSON. */
export const parseJson = (text: string): Option.Option<unknown> =>
  Result.getSuccess(Result.try({ catch: () => undefined, try: (): unknown => JSON.parse(text) }));

/** An object whose values are all strings. */
export const isStringRecord = (value: unknown): value is Readonly<Record<string, string>> =>
  isJsonObject(value) && Object.values(value).every(P.isString);

/** An object whose values are all booleans. */
export const isBooleanRecord = (value: unknown): value is Readonly<Record<string, boolean>> =>
  isJsonObject(value) && Object.values(value).every(P.isBoolean);

/** An array of strings. */
export const isStringArray = (value: unknown): value is ReadonlyArray<string> =>
  Array.isArray(value) && value.every(P.isString);
