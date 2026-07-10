/**
 * The exact author-facing surface Monaco type-checks component source against.
 *
 * It re-exports the `@voidhash/paywalls` `.` entry (everything a component may
 * import) so `build.ts` can bundle a single self-contained `.d.ts` from it and
 * post-process that into the `declare module "@voidhash/paywalls"` ambient
 * `sandboxDts` string Monaco loads. Keeping this a thin re-export means the
 * editor types are generated from the real API and never drift by hand.
 *
 * This module is never imported at runtime — it exists only as a dts entry.
 */
export * from "../index";
