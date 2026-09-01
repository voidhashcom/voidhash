import * as P from "effect/Predicate";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as EffectRuntime from "effect/Effect";
import * as Option from "effect/Option";
import * as paywalls from "@voidhash/paywalls";
import * as paywallsJsxRuntime from "@voidhash/paywalls/jsx-runtime";
import { extractComponentManifest } from "@voidhash/paywalls";
import { causeMessage, constant } from "@voidhash/lib/lang";
import type {
  BuildCapabilities,
  BuildDiagnosticInput,
  CompileOutcome,
  ExtractOutcome,
} from "./types.ts";

/** Options for the Node build capabilities. */
export interface NodeCapabilityOptions {
  /** Enable the e2e typecheck stage (default `true` for the Node capability). */
  readonly typecheck?: BuildCapabilities["typecheck"];
  /** An optional manifest cache. */
  readonly manifestCache?: BuildCapabilities["manifestCache"];
}

/**
 * The canonical esbuild transform settings, verified against the existing
 * `ComponentCompilerNode` pipeline: TSX loader, automatic JSX with the paywall
 * import source, CJS output, ES2022 target.
 */
const TRANSFORM_OPTIONS = constant({
  format: "cjs",
  jsx: "automatic",
  jsxImportSource: "@voidhash/paywalls",
  loader: "tsx",
  target: "es2022",
});

/** The modules the CJS `require` shim resolves during manifest extraction. */
const REQUIRE_MODULES: Readonly<Record<string, unknown>> = {
  "@voidhash/paywalls": paywalls,
  "@voidhash/paywalls/jsx-runtime": paywallsJsxRuntime,
  // esbuild's `jsx: automatic` emits `require("@voidhash/paywalls/jsx-runtime")`
  // for production and `.../jsx-dev-runtime` for dev; alias the dev entry too.
  "@voidhash/paywalls/jsx-dev-runtime": paywallsJsxRuntime,
};

/** The `errors` array esbuild attaches to a transform failure, when present. */
function esbuildErrors(cause: unknown): readonly unknown[] {
  if (!P.isObject(cause) || cause === null || !("errors" in cause)) return [];
  const { errors } = cause;
  if (!Array.isArray(errors)) return [];
  return errors;
}

/** The `text` of an esbuild message, falling back to its stringification. */
function esbuildText(message: unknown): string {
  if (P.isObject(message) && message !== null && "text" in message) {
    const { text } = message;
    if (P.isString(text)) return text;
  }
  return String(message);
}

/**
 * The 1-based position of an esbuild message, when it carries one (esbuild
 * columns are 0-based).
 */
function esbuildPosition(message: unknown): { line?: number; column?: number } {
  if (!P.isObject(message) || message === null || !("location" in message)) return {};
  const { location } = message;
  if (!P.isObject(location) || location === null) return {};
  const position: { line?: number; column?: number } = {};
  if ("line" in location && P.isNumber(location.line)) position.line = location.line;
  if ("column" in location && P.isNumber(location.column)) {
    position.column = location.column + 1;
  }
  return position;
}

/** Lower an esbuild transform failure to compile diagnostics. */
function compileFailure(cause: unknown): CompileOutcome {
  const errors = esbuildErrors(cause);
  return Arr.match(errors, {
    onNonEmpty: (messages) => ({
      diagnostics: messages.map(
        (message): BuildDiagnosticInput => ({
          message: esbuildText(message),
          ...esbuildPosition(message),
        }),
      ),
    }),
    onEmpty: () => ({ diagnostics: [{ message: causeMessage(cause) }] }),
  });
}

/**
 * The Node `compile` capability: an esbuild `transform` of the component's TSX
 * source to CJS. A transform error surfaces as compile diagnostics (esbuild's
 * message text with 1-based line/column when available).
 */
function nodeCompile(source: string): Promise<CompileOutcome> {
  return EffectRuntime.runPromise(
    Effect.gen(function* () {
      const esbuild = yield* Effect.tryPromise(() => import("esbuild"));
      return yield* Effect.tryPromise({
        try: () => esbuild.transform(source, TRANSFORM_OPTIONS),
        catch: (cause) => cause,
      }).pipe(
        Effect.match({
          onSuccess: (result): CompileOutcome => ({ code: result.code }),
          onFailure: compileFailure,
        }),
      );
    }),
  );
}

/** The `require` shim bound to the workspace SDK packages. */
function requireShim(specifier: string): unknown {
  const mod = REQUIRE_MODULES[specifier];
  if (mod === undefined) {
    // The CJS contract is to raise on an unresolvable specifier; the raised
    // defect is caught below and surfaced as an extraction diagnostic.
    return EffectRuntime.runSync(Effect.die(new TypeError(`Cannot find module '${specifier}'`)));
  }
  return mod;
}

/** True for a value carrying a `render` property (of any type). */
function hasRender(value: object): value is { readonly render: unknown } {
  return "render" in value;
}

/** True when an evaluated default export looks like a component definition. */
function isDefinitionExport(
  value: unknown,
): value is Parameters<typeof extractComponentManifest>[0] {
  if (!P.isObject(value) && !P.isFunction(value)) return false;
  if (value === null) return false;
  if (!hasRender(value)) return false;
  return P.isFunction(value.render);
}

/**
 * The Node `extractManifest` capability: evaluates the compiled CJS via
 * `new Function("require","module","exports", code)` with a require shim bound to
 * the workspace `@voidhash/paywalls` package (and its JSX runtimes), then runs
 * `extractComponentManifest` on the default export. Mirrors the existing Node
 * adapter's evaluation shape WITHOUT importing stacks.
 *
 * A raised failure / missing default export / non-definition export surfaces as
 * an extraction diagnostic (the build attributes it to the `runtime` phase).
 */
function nodeExtractManifest(compiledCode: string): Promise<ExtractOutcome> {
  return EffectRuntime.runPromise(
    Effect.gen(function* () {
      const moduleObj: { exports: Record<string, unknown> } = { exports: {} };

      const evaluationFailure = yield* Effect.try({
        try: () => {
          // eslint-disable-next-line no-new-func -- controlled evaluation of already
          // compiled, typechecked component code; the require shim is the only ambient.
          // oxlint-disable-next-line typescript/no-implied-eval -- same reason as the eslint directive above and the jsdoc on `nodeExtractManifest`: this evaluation shape IS the Node extractManifest capability, and any raised failure is captured as a `runtime`-phase diagnostic.
          const factory = new Function("require", "module", "exports", compiledCode);
          factory(requireShim, moduleObj, moduleObj.exports);
        },
        catch: (cause) => cause,
      }).pipe(
        Effect.match({
          onSuccess: () => Option.none<ExtractOutcome>(),
          onFailure: (cause) => Option.some<ExtractOutcome>({
            diagnostics: [{ message: causeMessage(cause) }],
          }),
        }),
      );
      if (Option.isSome(evaluationFailure)) return evaluationFailure.value;

      const definition = moduleObj.exports.default;
      if (!isDefinitionExport(definition)) {
        return {
          diagnostics: [
            { message: "Component must export a default defineComponent({ ... })" },
          ],
        };
      }

      return yield* Effect.try({
        try: () => extractComponentManifest(definition),
        catch: (cause) => cause,
      }).pipe(
        Effect.match({
          onSuccess: (manifest): ExtractOutcome => ({ manifest }),
          onFailure: (cause): ExtractOutcome => ({
            diagnostics: [{ message: causeMessage(cause) }],
          }),
        }),
      );
    }),
  );
}

/**
 * Assemble the full Node {@link BuildCapabilities}: native esbuild compile, CJS
 * evaluate + `extractComponentManifest`, typecheck on by default, plus an
 * optional manifest cache. Intended for Node-side callers and this package's
 * tests; browser/worker hosts wire their own sandboxed equivalents.
 */
export function makeNodeCapabilities(
  options: NodeCapabilityOptions = {},
): BuildCapabilities {
  const capabilities: BuildCapabilities = {
    compile: nodeCompile,
    extractManifest: nodeExtractManifest,
    typecheck: options.typecheck ?? true,
  };
  if (options.manifestCache) {
    return { ...capabilities, manifestCache: options.manifestCache };
  }
  return capabilities;
}
