import { Context, type Effect, Schema } from "effect";

import type { ComponentManifestDiagnostic } from "./ComponentManifestCacheService.ts";

/**
 * Catch-all error for {@link ComponentCompiler} operations. Adapters wrap any
 * *infrastructural* compile failure (a wasm/native toolchain that crashed, an
 * IO failure loading the compiler) into this one tag. It is deliberately NOT
 * used for a component that simply fails to compile — bad user source is an
 * expected outcome carried in the {@link CompileCheckResult} `error` status, not
 * an error-channel failure.
 */
export class ComponentCompilerError extends Schema.TaggedErrorClass<ComponentCompilerError>(
  "ComponentCompilerError",
)("ComponentCompilerError", { message: Schema.String }) {}

/**
 * One compile-phase diagnostic — the same shape the manifest cache and the
 * browser `CompileDiagnostic` use (message + optional phase/line/column). For a
 * {@link ComponentCompiler.compileCheck} result these are always
 * `phase: "compile"` (syntax/TS transform errors); the field is kept so the
 * shape is identical to every other diagnostic surface in the workspace.
 */
export type ComponentCompileDiagnostic = ComponentManifestDiagnostic;

/**
 * Outcome of a compile-phase check ({@link ComponentCompiler.compileCheck}):
 *
 * - `ready` — the source transformed cleanly (no syntax/TS errors). NOTE this is
 *   only the *compile* phase; it does NOT mean a manifest was extracted (that
 *   executes user code and is deferred to the container service, §3.4). A
 *   `ready` compile-check therefore carries no manifest.
 * - `error` — the source failed to transform; `diagnostics` carries the
 *   line/col-mapped compile errors.
 * - `unavailable` — this runtime has no usable compiler (e.g. the deployed
 *   workerd worker, where esbuild-wasm has no wasm binding). Callers treat this
 *   as "diagnostics could not be computed here", distinct from "compiled clean".
 */
export type CompileCheckResult =
  | { readonly status: "ready" }
  | { readonly status: "error"; readonly diagnostics: ReadonlyArray<ComponentCompileDiagnostic> }
  | { readonly status: "unavailable" };

/**
 * Outcome of a compile-AND-extract pass ({@link ComponentCompiler.compileAndExtract}),
 * the full headless equivalent of the browser sandbox pipeline: transform the
 * TSX, evaluate the compiled CJS, then run `extractComponentManifest` over the
 * exported {@link ComponentDefinition}.
 *
 * - `ready` — the source compiled AND a manifest was extracted. `manifest` is
 *   the raw (unvalidated) `ComponentManifest` object; callers validate it
 *   against the core `ComponentManifestSchema` before persisting.
 * - `error` — the pass failed; `phase` discriminates *where*: `"compile"` is a
 *   syntax/TS transform failure (identical to {@link CompileCheckResult}'s
 *   `error`), `"runtime"` is any throw during evaluation/extraction of the user
 *   code (module-scope exceptions, a missing default export, an
 *   `extractComponentManifest` assertion). `diagnostics` carries the mapped
 *   messages. User-code exceptions are ALWAYS captured here — they never escape
 *   onto the error channel.
 * - `unavailable` — this runtime has no compiler (the deployed workerd worker).
 */
export type CompileExtractResult =
  | { readonly status: "ready"; readonly manifest: unknown }
  | {
      readonly status: "error";
      readonly phase: "compile" | "runtime";
      readonly diagnostics: ReadonlyArray<ComponentCompileDiagnostic>;
    }
  | { readonly status: "unavailable" };

/**
 * Provider-agnostic port for the headless component compiler (§3.4 Compile
 * Service, Increment 3). It mirrors the *compile phase* of the browser's
 * `CompilePipeline` — the esbuild `transform` that reports syntax/TS
 * diagnostics — without any user-code execution.
 *
 * **This increment is the compile phase only.** Manifest extraction
 * (`extractComponentManifest`) evaluates untrusted user code and must run inside
 * an isolation boundary (a Cloudflare Container / WFP dispatch — §3.4 item 2, §8
 * open question 2); it is intentionally NOT part of this port yet. The port is
 * shaped so a future `extractManifest(source) → { manifest, diagnostics } |
 * unavailable` method can be added WITHOUT reshaping callers: `compileCheck`
 * already returns a discriminated result with an `unavailable` arm, so an
 * `extractManifest` returning the same three-way outcome slots in beside it.
 *
 * Adapters (wired by the application root, keeping the toolchain out of
 * `packages/core`):
 * - a **native-esbuild** adapter for Node (tests, future CLI/container reuse);
 * - an **unavailable** adapter for the deployed workerd worker, which returns
 *   `{ status: "unavailable" }` so headless diagnostics degrade cleanly until
 *   the container-isolated service lands.
 *
 * The seam is identical to callers regardless of which adapter is wired: a
 * caller never learns whether the compiler ran or was absent beyond the
 * `unavailable` status.
 */
export interface ComponentCompilerShape {
  /**
   * Run the compile phase over a code-component's TSX source, mirroring the
   * browser esbuild `transform` settings (cjs, jsx automatic, jsxImportSource
   * `@voidhash/paywalls`, loader tsx, target es2022). Returns a
   * {@link CompileCheckResult}: `ready` on a clean transform, `error` with
   * line/col-mapped diagnostics on a syntax/TS failure, or `unavailable` when
   * this runtime has no compiler.
   *
   * Never fails on bad *source* — that is the `error` status. The error channel
   * ({@link ComponentCompilerError}) is reserved for a broken toolchain.
   */
  readonly compileCheck: (
    source: string,
  ) => Effect.Effect<CompileCheckResult, ComponentCompilerError>;

  /**
   * Run the full compile + manifest-extract pass over a code-component's TSX
   * source: transform (same settings as {@link compileCheck}), evaluate the
   * compiled CJS through a module shim, locate the exported
   * `ComponentDefinition` and run `extractComponentManifest` over it. Returns a
   * {@link CompileExtractResult}: `ready` with the raw manifest on success,
   * `error` with a `phase` (`"compile"` vs `"runtime"`) on failure, or
   * `unavailable` when this runtime has no compiler.
   *
   * Unlike {@link compileCheck}, this evaluates untrusted user code; every
   * user-code exception (module-scope throw, missing/invalid export, extraction
   * assertion) is captured as a `runtime`-phase `error` and NEVER surfaced on
   * the error channel. The error channel ({@link ComponentCompilerError}) stays
   * reserved for a broken toolchain.
   */
  readonly compileAndExtract: (
    source: string,
  ) => Effect.Effect<CompileExtractResult, ComponentCompilerError>;
}

/**
 * The {@link ComponentCompilerShape} port tag. Core code only touches this tag;
 * the live (unavailable) and Node (native-esbuild) adapters are provided by the
 * application root / test layers.
 */
export class ComponentCompiler extends Context.Service<ComponentCompiler, ComponentCompilerShape>()(
  "ComponentCompiler",
) {}
