import {
  type ComponentCompileDiagnostic,
  ComponentCompilerError,
  type ComponentCompilerShape,
  type CompileCheckResult,
  type CompileExtractResult,
} from "@voidhash/core/services/paywallWorkspace/ComponentCompiler";
import { Effect } from "effect";
import { createContext, Script } from "node:vm";

const manifestEvaluationTimeoutMs = 500;

interface EsbuildFailure {
  readonly errors?: ReadonlyArray<{
    readonly text: string;
    readonly location?: { readonly line: number; readonly column: number } | null;
  }>;
}

interface SandboxSurface {
  readonly modules: Readonly<Record<string, unknown>>;
  readonly describeComponent: typeof import("@voidhash/paywalls/sandbox")["describeComponent"];
}

const toCompileDiagnostics = (error: unknown): ComponentCompileDiagnostic[] => {
  if (typeof error !== "object" || error === null || !("errors" in error)) return [];
  const errors = (error as EsbuildFailure).errors;
  if (!Array.isArray(errors) || errors.length === 0) return [];
  return errors.map((message) => ({
    column: message.location?.column,
    line: message.location?.line,
    message: message.text,
    phase: "compile",
  }));
};

const nodeTransform = async (source: string): Promise<string> => {
  const esbuild = await import("esbuild");
  const result = await esbuild.transform(source, {
    format: "cjs",
    jsx: "automatic",
    jsxImportSource: "@voidhash/paywalls",
    loader: "tsx",
    target: "es2022",
  });
  return result.code;
};

const evaluateAndExtractManifest = (
  compiledCode: string,
  sandbox: SandboxSurface,
): unknown => {
  const requireShim = (specifier: string): unknown => {
    const module = sandbox.modules[specifier];
    if (module === undefined) throw new Error(`Cannot find module '${specifier}'`);
    return module;
  };
  const moduleObject: { exports: Record<string, unknown> } = { exports: {} };
  const context = createContext(
    {
      exports: moduleObject.exports,
      module: moduleObject,
      require: requireShim,
    },
    {
      codeGeneration: { strings: false, wasm: false },
      microtaskMode: "afterEvaluate",
      name: "voidhash-component-manifest",
    },
  );
  new Script(compiledCode, { filename: "component.cjs" }).runInContext(context, {
    timeout: manifestEvaluationTimeoutMs,
  });
  const definition = moduleObject.exports.default ?? moduleObject.exports.definition;
  if (
    definition === undefined ||
    definition === null ||
    typeof (definition as { render?: unknown }).render !== "function"
  ) {
    throw new Error("Component must export a default defineComponent({ ... })");
  }
  return sandbox.describeComponent(
    definition as Parameters<SandboxSurface["describeComponent"]>[0],
  ).manifest;
};

const compileAndExtract = async (source: string): Promise<CompileExtractResult> => {
  let compiledCode: string;
  try {
    compiledCode = await nodeTransform(source);
  } catch (error) {
    const diagnostics = toCompileDiagnostics(error);
    if (diagnostics.length === 0) throw error;
    return { diagnostics, phase: "compile", status: "error" };
  }

  const sandbox = await import("@voidhash/paywalls/sandbox");
  try {
    return {
      manifest: evaluateAndExtractManifest(compiledCode, sandbox),
      status: "ready",
    };
  } catch (error) {
    return {
      diagnostics: [{ message: error instanceof Error ? error.message : String(error) }],
      phase: "runtime",
      status: "error",
    };
  }
};

/** Native compiler used exclusively inside the isolated self-host sidecar. */
export const makeNodeComponentCompiler = (): ComponentCompilerShape => ({
  compileCheck: (source) =>
    Effect.tryPromise(async (): Promise<CompileCheckResult> => {
      try {
        await nodeTransform(source);
        return { status: "ready" };
      } catch (error) {
        const diagnostics = toCompileDiagnostics(error);
        if (diagnostics.length === 0) throw error;
        return { diagnostics, status: "error" };
      }
    }).pipe(
      Effect.mapError((error) => new ComponentCompilerError({
        message: `esbuild transform failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      })),
    ),
  compileAndExtract: (source) =>
    Effect.tryPromise(() => compileAndExtract(source)).pipe(
      Effect.mapError((error) => new ComponentCompilerError({
        message: `component extraction failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      })),
    ),
});
