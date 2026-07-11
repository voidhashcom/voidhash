/**
 * Canonicalizes a BCP-47 locale tag via `Intl.getCanonicalLocales`, normalizing
 * casing and structure (e.g. `pt-br` → `pt-BR`). Returns `null` for input the
 * platform rejects as a structurally invalid tag (a thrown `RangeError`).
 */
export function canonicalizeLocaleTag(tag: string): string | null {
  try {
    const [canonical] = Intl.getCanonicalLocales(tag);
    return canonical ?? null;
  } catch {
    return null;
  }
}

/**
 * The primary language subtag of a locale tag (`de-AT` → `de`). Used for
 * language-prefix fallback matching; does not validate or canonicalize.
 */
export function languageSubtag(tag: string): string {
  const separator = tag.indexOf("-");
  return separator === -1 ? tag : tag.slice(0, separator);
}
