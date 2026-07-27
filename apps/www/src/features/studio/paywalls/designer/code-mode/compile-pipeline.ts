import type {
  ComponentManifest,
  PreviewTree,
} from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
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
function ensureEsbuild(): Promise<EsbuildModule> {
  if (esbuildReady === null) {
    esbuildReady = (async () => {
      const mod = await import("esbuild-wasm");
      // Bound init: a wasm/worker load that never settles must surface as an
      // error, not hang the compile forever ("stuck compiling").
      await Promise.race([
        mod.initialize({ wasmURL }),
        new Promise<never>((_resolve, reject) =>
          setTimeout(() => reject(new Error("esbuild-wasm init timed out")), ESBUILD_INIT_TIMEOUT_MS),
        ),
      ]);
      return mod;
    })().catch((error: unknown) => {
      // Allow a later retry if init failed (e.g. transient asset load).
      esbuildReady = null;
      throw error;
    });
  }
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
    let code: string;
    try {
      const esbuild = await ensureEsbuild();
      // CJS so the sandbox can run it via `new Function` with a `require` shim
      // returning the SDK global — no ES-module loading inside the iframe.
      const result = await esbuild.transform(source, {
        format: "cjs",
        jsx: "automatic",
        jsxImportSource: "@voidhash/paywalls",
        loader: "tsx",
        target: "es2022",
      });
      code = result.code;
    } catch (error) {
      return { diagnostics: toCompileDiagnostics(error), ok: false };
    }

    // The whole render is wrapped so `compile()` ALWAYS resolves — a rejection
    // here (rather than a returned outcome) would strand the caller on
    // "compiling" forever.
    try {
      const rendered = await this.host.render(code);
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[paywall-compile] render threw:", message);
      return { diagnostics: [{ message, phase: "runtime" }], ok: false };
    }
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
