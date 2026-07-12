import * as paywalls from "@voidhash/paywalls";
import * as paywallsJsxRuntime from "@voidhash/paywalls/jsx-runtime";
import { extractComponentManifest } from "@voidhash/paywalls";
import type {
  BuildCapabilities,
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
const TRANSFORM_OPTIONS = {
  format: "cjs",
  jsx: "automatic",
  jsxImportSource: "@voidhash/paywalls",
  loader: "tsx",
  target: "es2022",
} as const;

/** The modules the CJS `require` shim resolves during manifest extraction. */
const REQUIRE_MODULES: Readonly<Record<string, unknown>> = {
  "@voidhash/paywalls": paywalls,
  "@voidhash/paywalls/jsx-runtime": paywallsJsxRuntime,
  // esbuild's `jsx: automatic` emits `require("@voidhash/paywalls/jsx-runtime")`
  // for production and `.../jsx-dev-runtime` for dev; alias the dev entry too.
  "@voidhash/paywalls/jsx-dev-runtime": paywallsJsxRuntime,
};

/**
 * The Node `compile` capability: an esbuild `transform` of the component's TSX
 * source to CJS. A transform error surfaces as compile diagnostics (esbuild's
 * message text with 1-based line/column when available).
 */
async function nodeCompile(source: string): Promise<CompileOutcome> {
  const esbuild = await import("esbuild");
  try {
    const result = await esbuild.transform(source, TRANSFORM_OPTIONS);
    return { code: result.code };
  } catch (err) {
    const errors = (err as { errors?: readonly unknown[] }).errors;
    if (Array.isArray(errors) && errors.length > 0) {
      return {
        diagnostics: errors.map((e) => {
          const message = (e as { text?: string }).text ?? String(e);
          const location = (e as { location?: { line?: number; column?: number } }).location;
          return {
            message,
            ...(location?.line !== undefined ? { line: location.line } : {}),
            // esbuild columns are 0-based; convert to 1-based.
            ...(location?.column !== undefined ? { column: location.column + 1 } : {}),
          };
        }),
      };
    }
    return { diagnostics: [{ message: err instanceof Error ? err.message : String(err) }] };
  }
}

/**
 * The Node `extractManifest` capability: evaluates the compiled CJS via
 * `new Function("require","module","exports", code)` with a require shim bound to
 * the workspace `@voidhash/paywalls` package (and its JSX runtimes), then runs
 * `extractComponentManifest` on the default export. Mirrors the existing Node
 * adapter's evaluation shape WITHOUT importing stacks.
 *
 * A throw / missing default export / non-definition export surfaces as an
 * extraction diagnostic (the build attributes it to the `runtime` phase).
 */
async function nodeExtractManifest(compiledCode: string): Promise<ExtractOutcome> {
  const requireShim = (specifier: string): unknown => {
    const mod = REQUIRE_MODULES[specifier];
    if (mod === undefined) {
      throw new Error(`Cannot find module '${specifier}'`);
    }
    return mod;
  };

  const moduleObj: { exports: Record<string, unknown> } = { exports: {} };
  try {
    // eslint-disable-next-line no-new-func -- controlled evaluation of already
    // compiled, typechecked component code; the require shim is the only ambient.
    const factory = new Function("require", "module", "exports", compiledCode);
    factory(requireShim, moduleObj, moduleObj.exports);
  } catch (err) {
    return { diagnostics: [{ message: err instanceof Error ? err.message : String(err) }] };
  }

  const definition = moduleObj.exports.default;
  if (
    definition === undefined ||
    definition === null ||
    typeof (definition as { render?: unknown }).render !== "function"
  ) {
    return {
      diagnostics: [
        { message: "Component must export a default defineComponent({ ... })" },
      ],
    };
  }

  try {
    const manifest = extractComponentManifest(
      definition as Parameters<typeof extractComponentManifest>[0],
    );
    return { manifest };
  } catch (err) {
    return { diagnostics: [{ message: err instanceof Error ? err.message : String(err) }] };
  }
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
  return {
    compile: nodeCompile,
    extractManifest: nodeExtractManifest,
    typecheck: options.typecheck ?? true,
    ...(options.manifestCache ? { manifestCache: options.manifestCache } : {}),
  };
}
