/**
 * Re-exports the `@effect/vitest` testing API but binds it to the
 * `vite-plus/test` runtime so it works under `vp test run`. The upstream
 * package's `it.effect` helpers are built on top of `import * as V from "vitest"`,
 * which loads a separate vitest module instance from the one `vp test` uses;
 * see https://github.com/Effect-TS/effect/issues/6129. `makeMethods` lets us
 * pass a `TestAPI` explicitly so the helpers register tests with the runner
 * `vp test` is actually executing.
 *
 * Once the upstream dual-instance issue is fixed we can drop this shim and
 * `import { describe, expect, it } from "@effect/vitest"` directly.
 */
import { makeMethods } from "@effect/vitest";
import { describe, expect, it as baseIt, test, vi } from "vite-plus/test";

// TestAPI types differ slightly between
// @effect/vitest's vendored vitest and vite-plus/test, but the runtime shape (`it`,
// `it.skip`, `it.only`, `it.each`, etc.) is identical. This one narrow bridge is the
// only place the two nominally-distinct TestAPI types are reconciled.
const toTestApi = (api: any): Parameters<typeof makeMethods>[0] => api;

const it = makeMethods(toTestApi(baseIt));

export { describe, expect, it, test, vi };
