/**
 * The deploy typecheck gate: before anything is bundled, the discovered
 * `.voidhash` sources are typechecked with the TypeScript compiler API using
 * the project's own `tsconfig.json`, and the build fails listing diagnostics.
 */
import { constant } from "@voidhash/lib/lang";
import { Data, Effect, Path } from "effect";
import ts from "typescript";

export class PaywallTypecheckError extends Data.TaggedError("PaywallTypecheckError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Asset extensions the build's esbuild loaders accept in paywall/component
 * sources. The typecheck gate injects matching ambient module declarations so
 * `import hero from "./hero.png"` typechecks, and the bundler emits/inlines
 * the file.
 */
export const PAYWALL_ASSET_EXTENSIONS = constant([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "ttf",
  "otf",
  "woff",
  "woff2",
]);

/** Ambient `declare module "*.png" { … }` block per supported asset extension. */
const ASSET_MODULE_DECLARATIONS = PAYWALL_ASSET_EXTENSIONS.map(
  (ext) => `declare module "*.${ext}" {\n  const url: string;\n  export default url;\n}\n`,
).join("\n");

/**
 * Virtual file name (resolved under the project root) for the injected asset
 * declarations. Never written to disk — served from memory by the gate's
 * compiler host.
 */
const ASSET_DECLARATIONS_FILE_NAME = "__voidhash-asset-modules__.d.ts";

/** Options used when the project has no `tsconfig.json` to inherit from. */
const FALLBACK_OPTIONS: ts.CompilerOptions = {
  jsx: ts.JsxEmit.ReactJSX,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  target: ts.ScriptTarget.ES2022,
};

const formatHost: ts.FormatDiagnosticsHost = {
  getCanonicalFileName: (fileName) => fileName,
  // oxlint-disable-next-line typescript/unbound-method -- ts.sys is the TypeScript compiler's own host singleton: its members are standalone functions that never read `this`, and the compiler API contract is to hand them over by reference.
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getNewLine: () => ts.sys.newLine,
};

/** Message for an unknown failure raised by the TypeScript compiler API. */
const typecheckFailureMessage = (cause: unknown): string => {
  if (cause instanceof Error) return cause.message;
  return "Failed to typecheck .voidhash sources.";
};

/** Runs a synchronous TypeScript compiler API call as a typed failure. */
const attempt = <A>(thunk: () => A): Effect.Effect<A, PaywallTypecheckError> =>
  Effect.try({
    try: thunk,
    catch: (cause) =>
      new PaywallTypecheckError({ cause, message: typecheckFailureMessage(cause) }),
  });

const loadCompilerOptions = (
  path: Path.Path,
  projectRoot: string,
): Effect.Effect<
  { options: ts.CompilerOptions; configPath: string | undefined },
  PaywallTypecheckError
> =>
  Effect.gen(function* loadCompilerOptions() {
    const configPath = yield* attempt(() =>
      // oxlint-disable-next-line typescript/unbound-method -- ts.findConfigFile takes ts.sys.fileExists as a callback; the ts.sys members are `this`-free functions on the compiler's host singleton and are meant to be passed by reference.
      ts.findConfigFile(projectRoot, ts.sys.fileExists, "tsconfig.json"),
    );
    if (!configPath) {
      return { configPath: undefined, options: { ...FALLBACK_OPTIONS } };
    }

    // oxlint-disable-next-line typescript/unbound-method -- ts.readConfigFile takes ts.sys.readFile as a callback; the ts.sys members are `this`-free functions on the compiler's host singleton and are meant to be passed by reference.
    const read = yield* attempt(() => ts.readConfigFile(configPath, ts.sys.readFile));
    if (read.error) {
      return yield* new PaywallTypecheckError({
        message: ts.formatDiagnostics([read.error], formatHost),
      });
    }
    const parsed = yield* attempt(() =>
      ts.parseJsonConfigFileContent(
        read.config,
        ts.sys,
        path.dirname(configPath),
        undefined,
        configPath,
      ),
    );
    // "no inputs were found" (18003) is irrelevant — we supply our own roots.
    const configErrors = parsed.errors.filter((e) => e.code !== 18_003);
    if (configErrors.length > 0) {
      return yield* new PaywallTypecheckError({
        message: ts.formatDiagnostics(configErrors, formatHost),
      });
    }
    return { configPath, options: parsed.options };
  });

/**
 * Wraps a compiler host so the in-memory asset declaration file exists at
 * `assetDeclPath` without ever touching disk.
 */
const withAssetDeclarations = (host: ts.CompilerHost, assetDeclPath: string): ts.CompilerHost => {
  const getSourceFile = host.getSourceFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const readFile = host.readFile.bind(host);
  return {
    ...host,
    fileExists: (fileName) => fileName === assetDeclPath || fileExists(fileName),
    getSourceFile: (fileName, languageVersionOrOptions, ...rest) => {
      if (fileName === assetDeclPath) {
        return ts.createSourceFile(
          fileName,
          ASSET_MODULE_DECLARATIONS,
          languageVersionOrOptions,
          true,
        );
      }
      return getSourceFile(fileName, languageVersionOrOptions, ...rest);
    },
    readFile: (fileName) => {
      if (fileName === assetDeclPath) return ASSET_MODULE_DECLARATIONS;
      return readFile(fileName);
    },
  };
};

/**
 * Typechecks the given `.voidhash` source files with the project's
 * `tsconfig.json` (falling back to strict react-jsx defaults when the project
 * has none). An in-memory ambient declaration file covering the
 * esbuild-supported asset extensions ({@link PAYWALL_ASSET_EXTENSIONS}) is
 * injected so asset imports typecheck as string default exports. Fails with a
 * {@link PaywallTypecheckError} listing every error-severity diagnostic.
 */
export const typecheckPaywallSources = (options: {
  readonly projectRoot: string;
  readonly files: ReadonlyArray<string>;
}): Effect.Effect<void, PaywallTypecheckError, Path.Path> =>
  Effect.gen(function* typecheckPaywallSources() {
    const path = yield* Path.Path;
    const { options: compilerOptions } = yield* loadCompilerOptions(path, options.projectRoot);

    const finalOptions: ts.CompilerOptions = {
      ...compilerOptions,
      // The gate only checks — never emit, and never stumble over
      // third-party declaration files.
      incremental: false,
      jsx: compilerOptions.jsx ?? ts.JsxEmit.ReactJSX,
      noEmit: true,
      skipLibCheck: true,
    };

    const assetDeclPath = path.join(options.projectRoot, ASSET_DECLARATIONS_FILE_NAME);
    const diagnostics = yield* attempt(() => {
      const program = ts.createProgram({
        host: withAssetDeclarations(ts.createCompilerHost(finalOptions), assetDeclPath),
        options: finalOptions,
        rootNames: [...options.files, assetDeclPath],
      });
      return ts
        .getPreEmitDiagnostics(program)
        .filter((d) => d.category === ts.DiagnosticCategory.Error);
    });

    if (diagnostics.length > 0) {
      return yield* new PaywallTypecheckError({
        message:
          `TypeScript found ${diagnostics.length} error(s) in .voidhash sources:\n\n` +
          ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost),
      });
    }
  });
