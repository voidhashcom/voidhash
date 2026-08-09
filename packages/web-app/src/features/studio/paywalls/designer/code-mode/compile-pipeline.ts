import type {
  ComponentManifest,
  PreviewTree,
} from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import { causeMessage } from "@voidhash/lib/lang";
import { Duration, Effect, Result } from "effect";
import wasmURL from "esbuild-wasm/esbuild.wasm?url";

import type { CompileDiagnostic } from "../state/designer-store-state";
import { SandboxHost } from "./sandbox-host";

export type PipelineResult =
  | {
      ok: true;
      manifest: ComponentManifest;
      previewTrees: Record<string, PreviewTree>;
      /** Whether the definition declared a custom editor panel. */
      hasPanel: boolean;
      /**
       * The compiled author CJS module — retained ONLY when `hasPanel` is true,
       * so the panel sandbox can evaluate it. `undefined` otherwise (never ship
       * or retain code for a component without a panel).
       */
      code?: string;
    }
  | { ok: false; diagnostics: CompileDiagnostic[] };

/**
 * esbuild-wasm may only be initialized once per thread, so the module + init
 * promise are module-scoped and shared across pipeline instances. Lazily
 * imported on first compile (keeps the ~1MB out of the base designer bundle).
 * Default `worker: true` runs the wasm in esbuild's own worker — the main
 * thread stays responsive without us wrapping it in a second worker (nested
 * workers were the source of hangs).
 */
const ESBUILD_INIT_TIMEOUT_MS = 15000;

type EsbuildModule = typeof import("esbuild-wasm");
let esbuildReady: Promise<EsbuildModule> | null = null;

const initEsbuild = Effect.gen(function* () {
  const mod = yield* Effect.promise(() => import("esbuild-wasm"));
  // Bound init: a wasm/worker load that never settles must surface as an
  // error, not hang the compile forever ("stuck compiling").
  yield* Effect.promise(() => mod.initialize({ wasmURL })).pipe(
    Effect.timeoutOrElse({
      duration: Duration.millis(ESBUILD_INIT_TIMEOUT_MS),
      orElse: () => Effect.fail(new Error("esbuild-wasm init timed out")),
    }),
  );
  return mod;
}).pipe(
  // Allow a later retry if init failed (e.g. transient asset load).
  Effect.onError(() =>
    Effect.sync(() => {
      esbuildReady = null;
    }),
  ),
);

function ensureEsbuild(): Promise<EsbuildModule> {
  esbuildReady ??= Effect.runPromise(initEsbuild);
  return esbuildReady;
}

/**
 * Compiles a component's source (esbuild-wasm transform) and renders it in the
 * sandbox to a validated artifact. Errors at either stage return diagnostics —
 * neither stage can hang (transform is promise-based; the sandbox has ready +
 * render timeouts).
 */
export class CompilePipeline {
  private readonly host = new SandboxHost();

  async compile(source: string): Promise<PipelineResult> {
    const compiled = await Effect.runPromise(
      Effect.gen(function* () {
        const esbuild = yield* Effect.tryPromise({
          try: () => ensureEsbuild(),
          catch: (error) => error,
        });
        // CJS so the sandbox can run it via `new Function` with a `require` shim
        // returning the SDK global — no ES-module loading inside the iframe.
        const result = yield* Effect.tryPromise({
          try: () =>
            esbuild.transform(source, {
              format: "cjs",
              jsx: "automatic",
              jsxImportSource: "@voidhash/paywalls",
              loader: "tsx",
              target: "es2022",
            }),
          catch: (error) => error,
        });
        return result.code;
      }).pipe(Effect.result),
    );
    if (Result.isFailure(compiled)) {
      return { diagnostics: toCompileDiagnostics(compiled.failure), ok: false };
    }
    const code = compiled.success;

    // The whole render is wrapped so `compile()` ALWAYS resolves — a rejection
    // here (rather than a returned outcome) would strand the caller on
    // "compiling" forever.
    const renderResult = await Effect.runPromise(
      Effect.tryPromise({
        try: () => this.host.render(code),
        catch: (error) => causeMessage(error),
      }).pipe(Effect.result),
    );
    if (Result.isFailure(renderResult)) {
      console.warn("[paywall-compile] render threw:", renderResult.failure);
      return { diagnostics: [{ message: renderResult.failure, phase: "runtime" }], ok: false };
    }
    const rendered = renderResult.success;
    if (!rendered.ok) {
      console.warn("[paywall-compile] render failed:", rendered.error);
      return { diagnostics: [{ message: rendered.error, phase: "runtime" }], ok: false };
    }
    return {
      // Retain the compiled module only for panel-bearing components — the
      // panel sandbox evaluates it; a panel-less component never needs it.
      code: rendered.hasPanel ? code : undefined,
      hasPanel: rendered.hasPanel,
      manifest: rendered.manifest,
      ok: true,
      previewTrees: rendered.previewTrees,
    };
  }

  destroy(): void {
    this.host.destroy();
  }
}

function toCompileDiagnostics(error: unknown): CompileDiagnostic[] {
  const maybe = error as {
    errors?: Array<{ text: string; location?: { line: number; column: number } | null }>;
  };
  if (Array.isArray(maybe?.errors) && maybe.errors.length > 0) {
    return maybe.errors.map((message) => ({
      column: message.location?.column,
      line: message.location?.line,
      message: message.text,
      phase: "compile",
    }));
  }
  return [{ message: error instanceof Error ? error.message : String(error), phase: "compile" }];
}
