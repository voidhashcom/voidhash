import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

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
 * - `unavailable` — this runtime has no usable compiler or its isolated compiler
 *   transport is unavailable. Callers treat this as "diagnostics could not be
 *   computed here", distinct from "compiled clean".
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
 * - `ready` — the source compiled, a manifest was extracted, and every declared
 *   preview state was rendered. `manifest` is the raw (unvalidated)
 *   `ComponentManifest` object; `previewTrees` contains the renderer-ready tree
 *   for each preview state.
 * - `error` — the pass failed; `phase` discriminates *where*: `"compile"` is a
 *   syntax/TS transform failure (identical to {@link CompileCheckResult}'s
 *   `error`), `"runtime"` is any throw during evaluation/extraction of the user
 *   code (module-scope exceptions, a missing default export, an
 *   `extractComponentManifest` assertion). `diagnostics` carries the mapped
 *   messages. User-code exceptions are ALWAYS captured here — they never escape
 *   onto the error channel.
 * - `unavailable` — this runtime has no usable compiler or compiler transport.
 */
export type CompileExtractResult =
  | {
      readonly status: "ready";
      readonly manifest: unknown;
      readonly previewTrees: Readonly<Record<string, unknown>>;
    }
  | {
      readonly status: "error";
      readonly phase: "compile" | "runtime";
      readonly diagnostics: ReadonlyArray<ComponentCompileDiagnostic>;
    }
  | { readonly status: "unavailable" };

/**
 * Provider-agnostic port for headless component compilation. It supports a
 * transform-only diagnostic pass and a full pass that evaluates the compiled
 * definition, extracts its manifest, and renders its preview states.
 *
 * Adapters (wired by the application root, keeping the toolchain out of
 * `packages/core`):
 * - a **native-esbuild** adapter for Node and self-hosted runtimes;
 * - a container-backed adapter for the deployed worker;
 * - an **unavailable** adapter for runtimes without either toolchain.
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
   * {@link CompileExtractResult}: `ready` with the raw manifest and rendered
   * preview trees on success, `error` with a `phase` (`"compile"` vs
   * `"runtime"`) on failure, or `unavailable` when this runtime has no compiler.
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
