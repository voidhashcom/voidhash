import {
  type ComponentCompileDiagnostic,
  ComponentCompilerError,
  type ComponentCompilerShape,
  type CompileCheckResult,
  type CompileExtractResult,
} from "@voidhash/core/services/paywallWorkspace/ComponentCompiler";
import { causeMessage } from "@voidhash/lib/lang";
import { Data, Effect } from "effect";
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
  readonly describeComponent: (typeof import("@voidhash/paywalls/sandbox"))["describeComponent"];
  readonly defaultHostData: (typeof import("@voidhash/paywalls/sandbox"))["defaultHostData"];
  readonly renderComponentToTree: (typeof import("@voidhash/paywalls/sandbox"))["renderComponentToTree"];
}

type ComponentDefinitionInput = Parameters<SandboxSurface["describeComponent"]>[0];

/**
 * A broken toolchain: esbuild could not be loaded or the transform itself blew
 * up. `thrown` keeps the original value so esbuild's structured diagnostics can
 * still be read off it.
 */
class CompilerToolchainError extends Data.TaggedError("CompilerToolchainError")<{
  readonly message: string;
  readonly thrown: unknown;
}> {}

/** A failure raised by the user's component while it is evaluated or rendered. */
class ComponentEvaluationError extends Data.TaggedError("ComponentEvaluationError")<{
  readonly message: string;
}> {}

const toToolchainError = (thrown: unknown): CompilerToolchainError =>
  new CompilerToolchainError({ message: causeMessage(thrown), thrown });

const toEvaluationError = (thrown: unknown): ComponentEvaluationError =>
  new ComponentEvaluationError({ message: causeMessage(thrown) });

const isEsbuildFailure = (error: unknown): error is EsbuildFailure => {
  if (typeof error !== "object" || error === null) return false;
  return "errors" in error;
};

const isComponentDefinition = (value: unknown): value is ComponentDefinitionInput => {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object" && typeof value !== "function") return false;
  if (!("render" in value)) return false;
  return typeof value.render === "function";
};

const toCompileDiagnostics = (error: unknown): ComponentCompileDiagnostic[] => {
  if (!isEsbuildFailure(error)) return [];
  const errors = error.errors;
  if (!Array.isArray(errors) || errors.length === 0) return [];
  return errors.map((message) => ({
    column: message.location?.column,
    line: message.location?.line,
    message: message.text,
    phase: "compile",
  }));
};

const compileErrorResult = (
  diagnostics: ReadonlyArray<ComponentCompileDiagnostic>,
): CompileExtractResult => ({ diagnostics, phase: "compile", status: "error" });

const runtimeErrorResult = (message: string): CompileExtractResult => ({
  diagnostics: [{ message }],
  phase: "runtime",
  status: "error",
});

/** Lazily loads esbuild so the toolchain is only pulled in when a compile runs. */
const importEsbuildModule = () => import("esbuild");

/** Lazily loads the paywall sandbox surface used to evaluate compiled components. */
const importSandboxModule = () => import("@voidhash/paywalls/sandbox");

const loadEsbuild = Effect.tryPromise({
  try: importEsbuildModule,
  catch: toToolchainError,
});

const loadSandbox = Effect.tryPromise({
  try: importSandboxModule,
  catch: toToolchainError,
});

const nodeTransform = (source: string): Effect.Effect<string, CompilerToolchainError> =>
  Effect.gen(function* () {
    const esbuild = yield* loadEsbuild;
    const result = yield* Effect.tryPromise({
      try: () =>
        esbuild.transform(source, {
          format: "cjs",
          jsx: "automatic",
          jsxImportSource: "@voidhash/paywalls",
          loader: "tsx",
          target: "es2022",
        }),
      catch: toToolchainError,
    });
    return result.code;
  });

/**
 * The vm `require` hook is a synchronous V8 callback, so a missing module has to
 * leave as a thrown value. Running an already-failed Effect keeps the tagged
 * error model without a bare `throw` statement.
 */
const makeRequireShim =
  (sandbox: SandboxSurface) =>
  (specifier: string): unknown => {
    const module = sandbox.modules[specifier];
    if (module === undefined) {
      return Effect.runSync(
        Effect.fail(
          new ComponentEvaluationError({ message: `Cannot find module '${specifier}'` }),
        ),
      );
    }
    return module;
  };

const evaluateModule = (
  compiledCode: string,
  sandbox: SandboxSurface,
): Effect.Effect<Record<string, unknown>, ComponentEvaluationError> =>
  Effect.try({
    try: () => {
      const moduleObject: { exports: Record<string, unknown> } = { exports: {} };
      const context = createContext(
        {
          exports: moduleObject.exports,
          module: moduleObject,
          require: makeRequireShim(sandbox),
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
      return moduleObject.exports;
    },
    catch: toEvaluationError,
  });

const evaluateAndExtractManifest = (compiledCode: string, sandbox: SandboxSurface) =>
  Effect.gen(function* () {
    const moduleExports = yield* evaluateModule(compiledCode, sandbox);
    const definition = moduleExports.default ?? moduleExports.definition;
    if (!isComponentDefinition(definition)) {
      return yield* Effect.fail(
        new ComponentEvaluationError({
          message: "Component must export a default defineComponent({ ... })",
        }),
      );
    }
    const described = yield* Effect.try({
      try: () => sandbox.describeComponent(definition),
      catch: toEvaluationError,
    });
    return { definition, manifest: described.manifest };
  });

const renderPreviews = (
  compiledCode: string,
  sandbox: SandboxSurface,
): Effect.Effect<CompileExtractResult, ComponentEvaluationError> =>
  Effect.gen(function* () {
    const { definition, manifest } = yield* evaluateAndExtractManifest(compiledCode, sandbox);
    const previewTrees: Record<string, unknown> = {};
    let states: ReadonlyArray<string> = ["default"];
    if (manifest.previewStates.length > 0) states = manifest.previewStates;
    for (const state of states) {
      const fixture = definition.previews?.[state] ?? {};
      previewTrees[state] = yield* Effect.tryPromise({
        try: () =>
          sandbox.renderComponentToTree(definition, {
            state,
            props: fixture.props,
            hostData: { ...sandbox.defaultHostData(), ...fixture.data },
          }),
        catch: toEvaluationError,
      });
    }
    const ready: CompileExtractResult = { manifest, previewTrees, status: "ready" };
    return ready;
  });

const compileAndExtract = (
  source: string,
): Effect.Effect<CompileExtractResult, CompilerToolchainError> =>
  Effect.gen(function* () {
    const compiled = yield* nodeTransform(source).pipe(
      Effect.catch((error) =>
        Effect.gen(function* () {
          const diagnostics = toCompileDiagnostics(error.thrown);
          if (diagnostics.length === 0) return yield* Effect.fail(error);
          const failure: string | CompileExtractResult = compileErrorResult(diagnostics);
          return failure;
        }),
      ),
    );
    if (typeof compiled !== "string") return compiled;

    const sandbox = yield* loadSandbox;
    return yield* renderPreviews(compiled, sandbox).pipe(
      Effect.catch((error) => Effect.succeed(runtimeErrorResult(error.message))),
    );
  });

/** Native compiler used exclusively inside the isolated self-host sidecar. */
/** Builds the self-hosted compiler that validates source and renders preview trees. */
export const makeNodeComponentCompiler = (): ComponentCompilerShape => ({
  compileCheck: (source) =>
    nodeTransform(source).pipe(
      Effect.map((): CompileCheckResult => ({ status: "ready" })),
      Effect.catch((error) =>
        Effect.gen(function* () {
          const diagnostics = toCompileDiagnostics(error.thrown);
          if (diagnostics.length === 0) return yield* Effect.fail(error);
          const failure: CompileCheckResult = { diagnostics, status: "error" };
          return failure;
        }),
      ),
      Effect.mapError(
        (error) =>
          new ComponentCompilerError({ message: `esbuild transform failed: ${error.message}` }),
      ),
    ),
  compileAndExtract: (source) =>
    compileAndExtract(source).pipe(
      Effect.mapError(
        (error) =>
          new ComponentCompilerError({ message: `component extraction failed: ${error.message}` }),
      ),
    ),
});
