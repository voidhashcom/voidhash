import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

/**
 * Canonicalizes a BCP-47 locale tag via `Intl.getCanonicalLocales`, normalizing
 * casing and structure (e.g. `pt-br` → `pt-BR`). Returns `null` for input the
 * platform rejects as a structurally invalid tag (a thrown `RangeError`).
 */
export const canonicalizeLocaleTag = (tag: string): Option.Option<string> =>
  Result.try(() => Intl.getCanonicalLocales(tag)).pipe(Result.getSuccess, Option.flatMap(Arr.head));

/**
 * The primary language subtag of a locale tag (`de-AT` → `de`). Used for
 * language-prefix fallback matching; does not validate or canonicalize.
 */
export function languageSubtag(tag: string): string {
  const separator = tag.indexOf("-");
  if (separator === -1) {
    return tag;
  }
  return tag.slice(0, separator);
}
