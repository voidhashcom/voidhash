import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Str from "effect/String";
/**
 * Returns the first argument that contains a non-empty string, skipping
 * `None` and empty strings. Returns `None` when none qualify. Useful for
 * coalescing optional profile fields (e.g. picking an email/name from several
 * candidate sources in priority order).
 */
export const firstDefinedString = (
  ...values: ReadonlyArray<Option.Option<string>>
): Option.Option<string> =>
  Arr.findFirst(values, Option.exists(Str.isNonEmpty)).pipe(Option.flatten);
