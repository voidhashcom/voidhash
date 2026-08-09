import { entryValue } from "./entry.ts";
import { languageSubtag } from "./locale-tag.ts";
import type {
  BackgroundImageSnapshot,
  ComponentPropBindingSnapshot,
  ComponentPropValueSnapshot,
  LocalizableComponentProp,
  LocalizableImageData,
  LocalizableTextData,
  LocalizationConfig,
} from "./types.ts";

/** The enabled locale tags for a config: the implicit default plus the extras. */
function enabledLocaleTags(config: LocalizationConfig): string[] {
  const tags = [config.defaultLocale];
  for (const entry of config.locales) {
    const value = entryValue<{ tag: string } | undefined>(entry);
    if (value !== undefined && value.tag.length > 0) {
      tags.push(value.tag);
    }
  }
  return tags;
}

/**
 * Picks the best enabled locale for an ordered list of preferred tags
 * (e.g. `navigator.languages`). Each preferred tag is tried in order: first an
 * exact match against an enabled tag, then a language-prefix match (the
 * preferred tag's language subtag matching an enabled tag exactly, so `de-AT`
 * resolves to enabled `de` — never the reverse). Falls back to
 * `config.defaultLocale` when nothing matches. Matching is case-insensitive; the
 * enabled tag is returned in its stored casing.
 */
export function resolveLocale(
  preferred: readonly string[],
  config: LocalizationConfig,
): string {
  const enabled = enabledLocaleTags(config);
  const enabledLower = enabled.map((tag) => tag.toLowerCase());
  for (const raw of preferred) {
    const want = raw.toLowerCase();
    const exact = enabledLower.indexOf(want);
    if (exact !== -1) {
      return enabled[exact]!;
    }
    const prefix = enabledLower.indexOf(languageSubtag(want));
    if (prefix !== -1) {
      return enabled[prefix]!;
    }
  }
  return config.defaultLocale;
}

/**
 * Resolves the effective text for a node in a locale. Returns the base `text`
 * when `locale` is nullish or the default locale, or when no localized entry
 * carries a non-empty `text` override. Otherwise walks `localized` in array
 * order: an exact-locale override wins over a language-prefix override, and the
 * first match in each tier wins (CRDT arrays can transiently hold duplicates).
 * An absent or empty-string override falls back to base.
 */
export function resolveText(
  data: LocalizableTextData,
  locale: string | null | undefined,
  defaultLocale: string,
): string {
  const base = data.text;
  const entries = data.localized;
  if (locale == null || locale === defaultLocale || entries === undefined || entries.length === 0) {
    return base;
  }
  const want = locale.toLowerCase();
  const lang = languageSubtag(want);
  let prefixMatch: string | undefined;
  for (const entry of entries) {
    const value = entryValue(entry);
    if (value === undefined) {
      continue;
    }
    const override = value.overrides?.text;
    if (override === undefined || override === "") {
      continue;
    }
    const entryLocale = value.locale.toLowerCase();
    if (entryLocale === want) {
      return override;
    }
    if (prefixMatch === undefined && entryLocale === lang) {
      prefixMatch = override;
    }
  }
  return prefixMatch ?? base;
}

/**
 * Resolves the effective background image for a view/screen node in a locale.
 * Whole-value replacement (`url` + `resizeMode` travel together). Same fallback
 * walk as {@link resolveText}; an entry that omits `backgroundImage` falls back
 * to the base `style.backgroundImage`.
 */
export function resolveBackgroundImage(
  data: LocalizableImageData,
  locale: string | null | undefined,
  defaultLocale: string,
): BackgroundImageSnapshot {
  const base = data.style.backgroundImage;
  const entries = data.localized;
  if (locale == null || locale === defaultLocale || entries === undefined || entries.length === 0) {
    return base;
  }
  const want = locale.toLowerCase();
  const lang = languageSubtag(want);
  let prefixMatch: BackgroundImageSnapshot | undefined;
  for (const entry of entries) {
    const value = entryValue(entry);
    if (value === undefined) {
      continue;
    }
    const override = value.overrides?.backgroundImage;
    if (override === undefined) {
      continue;
    }
    const entryLocale = value.locale.toLowerCase();
    if (entryLocale === want) {
      return override;
    }
    if (prefixMatch === undefined && entryLocale === lang) {
      prefixMatch = override;
    }
  }
  return prefixMatch ?? base;
}

/**
 * Resolves the effective binding for a component prop in a locale. Variable-
 * reference bindings are returned untouched (localization applies to literals
 * only). For a literal binding, walks `localizedValues` with the same fallback
 * rules as {@link resolveText} and returns a literal binding carrying the
 * resolved value, or the base binding when no override applies.
 */
export function resolveComponentPropValue(
  propEntry: LocalizableComponentProp,
  locale: string | null | undefined,
  defaultLocale: string,
): ComponentPropBindingSnapshot {
  const binding = propEntry.value;
  const entries = propEntry.localizedValues;
  if (
    binding.type !== "literal" ||
    locale == null ||
    locale === defaultLocale ||
    entries === undefined ||
    entries.length === 0
  ) {
    return binding;
  }
  const want = locale.toLowerCase();
  const lang = languageSubtag(want);
  let prefixMatch: ComponentPropValueSnapshot | undefined;
  for (const entry of entries) {
    const value = entryValue(entry);
    if (value === undefined) {
      continue;
    }
    const entryLocale = value.locale.toLowerCase();
    if (entryLocale === want) {
      return { type: "literal", value: value.value };
    }
    if (prefixMatch === undefined && entryLocale === lang) {
      prefixMatch = value.value;
    }
  }
  if (prefixMatch === undefined) {
    return binding;
  }
  return { type: "literal", value: prefixMatch };
}
