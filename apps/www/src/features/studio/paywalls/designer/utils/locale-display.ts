/**
 * A small curated set of common BCP 47 language tags offered as one-click adds
 * (the action-bar switcher and Translation mode's locale rail share it); typing
 * an arbitrary tag is always available via the input.
 */
export const COMMON_LOCALES: readonly string[] = [
  "en",
  "es",
  "de",
  "fr",
  "pt",
  "pt-BR",
  "it",
  "nl",
  "ja",
  "ko",
  "zh",
  "zh-Hans",
  "ru",
  "ar",
  "hi",
  "tr",
  "pl",
  "sv",
];

/** Human-readable label for a locale tag, falling back to the raw tag. */
export function localeLabel(tag: string): string {
  try {
    return new Intl.DisplayNames([tag], { type: "language" }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}
