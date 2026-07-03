/**
 * The author-facing surface Monaco type-checks editor-panel authoring against.
 *
 * Mirrors `sandbox/monaco-surface.ts`: a thin re-export of the
 * `@voidhash/paywalls/panel` entry so `build.ts` can bundle ONE self-contained
 * `.d.ts` and post-process it into a `declare module "@voidhash/paywalls/panel"`
 * ambient block. Never imported at runtime — a dts entry only.
 */
export * from "./index";
