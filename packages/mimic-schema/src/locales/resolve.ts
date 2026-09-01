import * as Str from "effect/String";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
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
  return Arr.prepend(
    Arr.flatMap(config.locales, (entry) => {
      const value = entryValue(entry);
      if (value !== undefined && Str.isNonEmpty(value.tag)) {
        return [value.tag];
      }
      return [];
    }),
    config.defaultLocale,
  );
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
export function resolveLocale(preferred: readonly string[], config: LocalizationConfig): string {
  const enabled = enabledLocaleTags(config);
  const matches = Arr.flatMap(preferred, (raw) => {
    const want = raw.toLowerCase();
    const exact = Arr.findFirst(enabled, (tag) => tag.toLowerCase() === want);
    const prefix = Arr.findFirst(enabled, (tag) => tag.toLowerCase() === languageSubtag(want));
    return Arr.fromOption(Option.orElse(exact, () => prefix));
  });
  return Option.getOrElse(Arr.head(matches), () => config.defaultLocale);
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
  locale: Option.Option<string>,
  defaultLocale: string,
): string {
  const base = data.text;
  const entries = data.localized;
  if (
    Option.isNone(locale) ||
    locale.value === defaultLocale ||
    entries === undefined ||
    Arr.isReadonlyArrayEmpty(entries)
  ) {
    return base;
  }
  const want = locale.value.toLowerCase();
  const lang = languageSubtag(want);
  const matches = Arr.reduce(
    entries,
    { exact: Option.none<string>(), prefix: Option.none<string>() },
    (matches, entry) => {
      const value = entryValue(entry);
      if (value === undefined) {
        return matches;
      }
      const override = value.overrides?.text;
      if (override === undefined || override === "") {
        return matches;
      }
      const entryLocale = value.locale.toLowerCase();
      if (entryLocale === want && Option.isNone(matches.exact)) {
        return { ...matches, exact: Option.some(override) };
      }
      if (entryLocale === lang && Option.isNone(matches.prefix)) {
        return { ...matches, prefix: Option.some(override) };
      }
      return matches;
    },
  );
  return Option.getOrElse(
    Option.orElse(matches.exact, () => matches.prefix),
    () => base,
  );
}

/**
 * Resolves the effective background image for a view/screen node in a locale.
 * Whole-value replacement (`url` + `resizeMode` travel together). Same fallback
 * walk as {@link resolveText}; an entry that omits `backgroundImage` falls back
 * to the base `style.backgroundImage`.
 */
export function resolveBackgroundImage(
  data: LocalizableImageData,
  locale: Option.Option<string>,
  defaultLocale: string,
): BackgroundImageSnapshot {
  const base = data.style.backgroundImage;
  const entries = data.localized;
  if (
    Option.isNone(locale) ||
    locale.value === defaultLocale ||
    entries === undefined ||
    Arr.isReadonlyArrayEmpty(entries)
  ) {
    return base;
  }
  const want = locale.value.toLowerCase();
  const lang = languageSubtag(want);
  const matches = Arr.reduce(
    entries,
    {
      exact: Option.none<BackgroundImageSnapshot>(),
      prefix: Option.none<BackgroundImageSnapshot>(),
    },
    (matches, entry) => {
      const value = entryValue(entry);
      if (value === undefined) {
        return matches;
      }
      const override = value.overrides?.backgroundImage;
      if (override === undefined) {
        return matches;
      }
      const entryLocale = value.locale.toLowerCase();
      if (entryLocale === want && Option.isNone(matches.exact)) {
        return { ...matches, exact: Option.some(override) };
      }
      if (entryLocale === lang && Option.isNone(matches.prefix)) {
        return { ...matches, prefix: Option.some(override) };
      }
      return matches;
    },
  );
  return Option.getOrElse(
    Option.orElse(matches.exact, () => matches.prefix),
    () => base,
  );
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
  locale: Option.Option<string>,
  defaultLocale: string,
): ComponentPropBindingSnapshot {
  const binding = propEntry.value;
  const entries = propEntry.localizedValues;
  if (
    binding.type !== "literal" ||
    Option.isNone(locale) ||
    locale.value === defaultLocale ||
    entries === undefined ||
    Arr.isReadonlyArrayEmpty(entries)
  ) {
    return binding;
  }
  const want = locale.value.toLowerCase();
  const lang = languageSubtag(want);
  const matches = Arr.reduce(
    entries,
    {
      exact: Option.none<ComponentPropValueSnapshot>(),
      prefix: Option.none<ComponentPropValueSnapshot>(),
    },
    (matches, entry) => {
      const value = entryValue(entry);
      if (value === undefined) {
        return matches;
      }
      const entryLocale = value.locale.toLowerCase();
      if (entryLocale === want && Option.isNone(matches.exact)) {
        return { ...matches, exact: Option.some(value.value) };
      }
      if (entryLocale === lang && Option.isNone(matches.prefix)) {
        return { ...matches, prefix: Option.some(value.value) };
      }
      return matches;
    },
  );
  return Option.match(
    Option.orElse(matches.exact, () => matches.prefix),
    {
      onNone: () => binding,
      onSome: (value) => ({ type: "literal", value }),
    },
  );
}
