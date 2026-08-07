/**
 * The deploy build pipeline: scans `.voidhash/paywalls` and
 * `.voidhash/components`, typechecks them, compiles every paywall into a
 * WebView-ready HTML/JS bundle and every component into its §2 manifest, §3
 * preview trees and runtime bundle, and assembles the content-addressed
 * schemaVersion-2 deploy manifest (contract: docs/specs/paywall-deploy-contract.md).
 */
import { createHash } from "node:crypto";

import { causeMessage } from "@voidhash/lib/lang";
import {
  Data,
  DateTime,
  Effect,
  FileSystem,
  Path,
  type PlatformError,
  Schema,
  SchemaGetter,
  SchemaTransformation,
} from "effect";
import * as esbuild from "esbuild";

import {
  DEPLOY_MANIFEST_VERSION,
  DEPLOY_SLUG_REGEX,
  type DeployArtifact,
  type DeployAsset,
  type DeployComponent,
  type DeployComponentPreview,
  type DeployFile,
  type DeployManifest,
  DeployManifestSchema,
  type DeployPaywall,
  type DeployVariables,
} from "../schema/paywall-deploy";
import { closedImportsPlugin } from "./paywall-closed-imports";
import { PAYWALL_ASSET_EXTENSIONS, typecheckPaywallSources } from "./paywall-typecheck";

export class PaywallBuildError extends Data.TaggedError("PaywallBuildError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/** Directory (relative to the project root) where build output is written. */
export const BUILD_DIR = ".voidhash/.build";

const SOURCE_EXTENSIONS = [".tsx", ".jsx", ".ts", ".js"];

/** Separator of the POSIX paths the manifest records. */
const POSIX_SEP = "/";

/**
 * Binary asset types paywall bundles may import; emitted as files. Derived
 * from the typecheck gate's extension list so the two can never drift.
 */
const PAYWALL_ASSET_LOADERS: Record<string, esbuild.Loader> = Object.fromEntries(
  PAYWALL_ASSET_EXTENSIONS.map((ext) => [`.${ext}`, "file"]),
);

/**
 * Component runtime bundles must stay a single file (the manifest has no
 * per-component asset list), so binary imports are inlined as data URLs.
 */
const COMPONENT_ASSET_LOADERS: Record<string, esbuild.Loader> = Object.fromEntries(
  Object.keys(PAYWALL_ASSET_LOADERS).map((ext) => [ext, "dataurl"]),
);

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const textEncoder = new TextEncoder();

/** JSON text codec used wherever the build embeds JSON in generated source. */
const JsonText = Schema.UnknownFromJsonString;

/**
 * JSON text codec for on-disk build artifacts. `space: 2` keeps the emitted
 * `manifest.json` / preview trees human-readable, as they were before.
 */
const PrettyJsonText = Schema.String.pipe(
  Schema.decodeTo(
    Schema.Unknown,
    new SchemaTransformation.Transformation<unknown, string>(
      SchemaGetter.parseJson(),
      SchemaGetter.stringifyJson({ space: 2 }),
    ),
  ),
);

/** Serializes a value to JSON text, failing instead of throwing. */
const toJsonText = (subject: string, value: unknown): Effect.Effect<string, PaywallBuildError> =>
  Schema.encodeEffect(JsonText)(value).pipe(
    Effect.mapError(
      (cause) =>
        new PaywallBuildError({ cause, message: `Failed to serialize ${subject}: ${cause.message}` }),
    ),
  );

/** Serializes a value to the JSON bytes written as a build artifact. */
const toJsonBytes = (subject: string, value: unknown): Effect.Effect<Uint8Array, PaywallBuildError> =>
  Schema.encodeEffect(PrettyJsonText)(value).pipe(
    Effect.mapError(
      (cause) =>
        new PaywallBuildError({ cause, message: `Failed to serialize ${subject}: ${cause.message}` }),
    ),
    Effect.map((json) => textEncoder.encode(`${json}\n`)),
  );

/** Lowercase hex SHA-256 of a string or byte payload. */
export const sha256Hex = (data: Uint8Array | string): string =>
  createHash("sha256").update(data).digest("hex");

/**
 * Contract §1.2 paywall content hash:
 * `sha256(sha256(html) + ":" + sha256(js) + ":" + sortedAssetHashes.join(":"))`.
 */
export const computePaywallContentHash = (input: {
  readonly htmlSha256: string;
  readonly jsSha256: string;
  readonly assetSha256s: ReadonlyArray<string>;
}): string =>
  sha256Hex(`${input.htmlSha256}:${input.jsSha256}:${[...input.assetSha256s].sort().join(":")}`);

/**
 * Contract §1.2 component content hash:
 * `sha256(sha256(manifest) + ":" + sha256(runtime) + ":" + (sha256(panel) | "")
 * + ":" + sortedPreviewHashes.join(":"))`.
 */
export const computeComponentContentHash = (input: {
  readonly manifestSha256: string;
  readonly runtimeSha256: string;
  readonly panelSha256?: string | null;
  readonly previewSha256s: ReadonlyArray<string>;
}): string =>
  sha256Hex(
    `${input.manifestSha256}:${input.runtimeSha256}:${
      input.panelSha256 ?? ""
    }:${[...input.previewSha256s].sort().join(":")}`,
  );

const contentTypeFor = (path: Path.Path, file: string): string =>
  CONTENT_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";

/** Normalizes an absolute path to a project-root-relative POSIX path. */
const toRelPosix = (path: Path.Path, projectRoot: string, abs: string): string =>
  path.relative(projectRoot, abs).split(path.sep).join(POSIX_SEP);

// Discovery (isSourceFile / idFromFile / listFilesRecursive) is mirrored by
// Studio's virtual-paywalls plugin
// (apps/studio/src/server/virtual-paywalls-plugin.ts) — keep both in sync.
const isSourceFile = (name: string): boolean =>
  SOURCE_EXTENSIONS.some((ext) => name.endsWith(ext)) && !name.endsWith(".d.ts");

const idFromFile = (path: Path.Path, file: string): string =>
  path.basename(file).replace(/\.(tsx|jsx|ts|js)$/, "");

/** Recursively lists files under a directory (absolute paths). */
const listFilesRecursive: (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  dir: string,
) => Effect.Effect<Array<string>, PlatformError.PlatformError> = (fs, path, dir) =>
  Effect.gen(function* listDirectory() {
    const exists = yield* fs.exists(dir);
    if (!exists) return [];
    const out: Array<string> = [];
    for (const entry of yield* fs.readDirectory(dir)) {
      const full = path.join(dir, entry);
      const info = yield* fs.stat(full);
      if (info.type === "Directory") {
        out.push(...(yield* listFilesRecursive(fs, path, full)));
        continue;
      }
      out.push(full);
    }
    return out;
  });

const listSourceFiles = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  dir: string,
): Effect.Effect<Array<string>, PaywallBuildError> =>
  listFilesRecursive(fs, path, dir).pipe(
    Effect.map((files) => files.filter((f) => isSourceFile(path.basename(f)))),
    Effect.mapError((cause) => new PaywallBuildError({ cause, message: `Failed to scan ${dir}` })),
  );

/** Turns an esbuild failure into a readable, file-located error message. */
const describeEsbuildFailure = (cause: unknown): string | undefined => {
  if (typeof cause !== "object" || cause === null || !("errors" in cause)) {
    return;
  }
  const errors = cause.errors;
  if (!Array.isArray(errors)) {
    return;
  }
  return errors
    .map((error: esbuild.Message) => {
      if (error.location) {
        return `  ${error.location.file}:${error.location.line}:${error.location.column}: ${error.text}`;
      }
      return `  ${error.text}`;
    })
    .join("\n");
};

const bundleFailure = (subject: string) => (cause: unknown) => {
  const details = describeEsbuildFailure(cause);
  if (details) {
    return new PaywallBuildError({ cause, message: `Failed to bundle ${subject}:\n${details}` });
  }
  return new PaywallBuildError({ cause, message: `Failed to bundle ${subject}` });
};

// ── Untyped module reading ───────────────────────────────────────────────────
//
// Paywall/component modules are user code loaded at runtime, so every property
// read off them goes through these guards rather than a type assertion.

const readProperty = (value: unknown, key: string): unknown => {
  if (typeof value !== "object" || value === null) return undefined;
  if (!(key in value)) return undefined;
  return Reflect.get(value, key);
};

const entriesOf = (value: unknown): Array<[string, unknown]> => {
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value);
};

const recordOf = (value: unknown): Record<string, unknown> => Object.fromEntries(entriesOf(value));

const readOptionalString = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  return undefined;
};

const readNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value === "string" && value.length > 0) return value;
  return undefined;
};

const readStringArray = (value: unknown): Array<string> => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
};

const readArray = (value: unknown): ReadonlyArray<unknown> => {
  if (Array.isArray(value)) return value;
  return [];
};

/** `": <message>"` for an `Error` cause, a bare `"."` otherwise. */
const manifestFailureSuffix = (cause: unknown): string => {
  if (cause instanceof Error) return `: ${cause.message}`;
  return ".";
};

// ── User-project library access ──────────────────────────────────────────────
//
// `@voidhash/paywalls` (and React) are intentionally NOT dependencies of the
// CLI: modules are resolved from the *user's* project so the paywall module,
// the tree renderer and React are all one instance.

interface UserPaywallsLib {
  readonly extractComponentManifest: (
    definition: ComponentDefinitionLike,
  ) => { readonly id: string } & Record<string, unknown>;
}

interface UserTreeLib {
  readonly renderToNodeTree: (
    element: unknown,
    options?: {
      readonly config?: {
        readonly products?: ReadonlyArray<unknown>;
        readonly variables?: Record<string, unknown>;
        readonly platform?: unknown;
        readonly safeAreaInsets?: unknown;
        readonly dimensions?: unknown;
      };
      readonly state?: string;
    },
  ) => Promise<unknown>;
}

interface UserReactLib {
  readonly createElement: (type: unknown, props: Record<string, unknown> | null) => unknown;
}

type ComponentDefinitionLike = Record<string, unknown> & {
  readonly id: string;
  readonly title?: string;
  readonly description?: string;
  readonly previews: Record<string, unknown>;
  readonly panel?: unknown;
  readonly component: unknown;
  readonly __voidhash: { readonly kind: string };
};

const requireFromProject = <T>(
  projectRoot: string,
  specifier: string,
): Effect.Effect<T, PaywallBuildError> =>
  Effect.try({
    try: () => {
      const loaded: T = require(require.resolve(specifier, { paths: [projectRoot] }));
      return loaded;
    },
    catch: (cause) =>
      new PaywallBuildError({
        cause,
        message:
          `Failed to load "${specifier}" from the project. ` +
          `Make sure "@voidhash/paywalls" is installed in your project.`,
      }),
  });

/**
 * Registers an esbuild `require` hook with the `tsx` loader so paywall and
 * component modules (which contain JSX) can be loaded for metadata extraction
 * and preview rendering. The shared `safeRegister` helper uses the `ts`
 * loader, which rejects JSX — hence a dedicated hook here.
 */
const loadEsbuildRegister = () => import("esbuild-register/dist/node");

const registerTsxLoader = (): Effect.Effect<{ unregister: () => void }, PaywallBuildError> =>
  Effect.tryPromise({
    try: () =>
      loadEsbuildRegister().then(({ register }) => register({ format: "cjs", loader: "tsx" })),
    catch: (cause) =>
      new PaywallBuildError({
        cause,
        message: "Failed to initialize the TypeScript/JSX loader.",
      }),
  });

const loadModuleDefault = (file: string): Effect.Effect<unknown, PaywallBuildError> =>
  Effect.try({
    try: () => {
      delete require.cache[require.resolve(file)];
      const mod: { default?: unknown } = require(file);
      return mod?.default ?? mod;
    },
    catch: (cause) =>
      new PaywallBuildError({
        cause,
        message: `Failed to load ${file}: ${causeMessage(cause)}`,
      }),
  });

const isScalar = (value: unknown): value is string | number | boolean =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

interface PaywallModuleMeta {
  readonly title: string;
  readonly description?: string;
  readonly products: ReadonlyArray<string>;
  readonly variables: DeployVariables;
}

/** Reads the `__voidhash` metadata off a paywall module's default export. */
const loadPaywallMeta = (
  path: Path.Path,
  file: string,
): Effect.Effect<PaywallModuleMeta, PaywallBuildError> =>
  loadModuleDefault(file).pipe(
    Effect.flatMap((def) => {
      const meta = readProperty(def, "__voidhash");
      if (meta === undefined || readProperty(meta, "kind") !== "paywall") {
        return Effect.fail(
          new PaywallBuildError({
            message: `${file} must default-export createPaywall({ … }) from "@voidhash/paywalls".`,
          }),
        );
      }
      const title = readNonEmptyString(readProperty(meta, "title")) ?? idFromFile(path, file);
      const description = readOptionalString(readProperty(meta, "description"));
      const products = readStringArray(readProperty(meta, "products"));
      const variables: Record<string, string | number | boolean> = {};
      for (const [key, value] of entriesOf(readProperty(meta, "variables"))) {
        if (!isScalar(value)) {
          return Effect.fail(
            new PaywallBuildError({
              message:
                `Variable "${key}" of paywall ${path.basename(file)} must be a ` +
                "string, number or boolean (contract §1.1).",
            }),
          );
        }
        variables[key] = value;
      }
      return Effect.succeed<PaywallModuleMeta>({
        description,
        products,
        title,
        variables,
      });
    }),
  );

/** Loads a component module's default export and validates its shape. */
const loadComponentDefinition = (
  path: Path.Path,
  file: string,
): Effect.Effect<ComponentDefinitionLike, PaywallBuildError> =>
  loadModuleDefault(file).pipe(
    Effect.flatMap((def) => {
      const kind = readProperty(readProperty(def, "__voidhash"), "kind");
      const component = readProperty(def, "component");
      const id = readProperty(def, "id");
      if (kind !== "component" || typeof component !== "function" || typeof id !== "string") {
        return Effect.fail(
          new PaywallBuildError({
            message: `${file} must default-export defineComponent({ … }) from "@voidhash/paywalls".`,
          }),
        );
      }
      const expectedId = idFromFile(path, file);
      if (id !== expectedId) {
        return Effect.fail(
          new PaywallBuildError({
            message:
              `Component id "${id}" does not match its file name ` +
              `"${expectedId}" (${path.basename(file)}). Rename the file or the id.`,
          }),
        );
      }
      // The whole default export is handed to `extractComponentManifest`, so
      // every own property is carried over, not just the ones read here.
      return Effect.succeed<ComponentDefinitionLike>({
        ...recordOf(def),
        __voidhash: { kind },
        component,
        description: readOptionalString(readProperty(def, "description")),
        id,
        panel: readProperty(def, "panel"),
        previews: recordOf(readProperty(def, "previews")),
        title: readOptionalString(readProperty(def, "title")),
      });
    }),
  );

// ── Output writing ───────────────────────────────────────────────────────────

const writeFile = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  absPath: string,
  bytes: Uint8Array,
): Effect.Effect<void, PaywallBuildError> =>
  fs.makeDirectory(path.dirname(absPath), { recursive: true }).pipe(
    Effect.andThen(() => fs.writeFile(absPath, bytes)),
    Effect.mapError((cause) => new PaywallBuildError({ cause, message: `Failed to write ${absPath}` })),
  );

/** Writes `bytes` to `absPath` and returns its manifest artifact entry. */
const writeArtifact = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  projectRoot: string,
  absPath: string,
  bytes: Uint8Array,
): Effect.Effect<DeployArtifact, PaywallBuildError> =>
  writeFile(fs, path, absPath, bytes).pipe(
    Effect.map(() => ({
      bytes: bytes.byteLength,
      contentType: contentTypeFor(path, absPath),
      path: toRelPosix(path, projectRoot, absPath),
      sha256: sha256Hex(bytes),
    })),
  );

const readDeployFile = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  projectRoot: string,
  absPath: string,
): Effect.Effect<DeployFile, PaywallBuildError> =>
  fs.readFile(absPath).pipe(
    Effect.map((bytes) => ({
      bytes: bytes.byteLength,
      path: toRelPosix(path, projectRoot, absPath),
      sha256: sha256Hex(bytes),
    })),
    Effect.mapError((cause) => new PaywallBuildError({ cause, message: `Failed to read ${absPath}` })),
  );

// ── Paywall bundling ─────────────────────────────────────────────────────────

/** The WebView HTML shell that boots a compiled paywall bundle. */
const htmlShell = (jsFileName: string): string =>
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
    />
    <title>Voidhash Paywall</title>
    <style>
      :root {
        --voidhash-safe-area-top: env(safe-area-inset-top, 0px);
        --voidhash-safe-area-right: env(safe-area-inset-right, 0px);
        --voidhash-safe-area-bottom: env(safe-area-inset-bottom, 0px);
        --voidhash-safe-area-left: env(safe-area-inset-left, 0px);
      }
      html, body, #root { height: 100%; margin: 0; }
      body { overscroll-behavior: none; -webkit-user-select: none; user-select: none; }
    </style>
    <script>
      // The native host overwrites this (when it can inject before-load
      // scripts) with real products/variables before the bundle runs. The
      // default keeps an isolated open of the page from crashing; late
      // configuration arrives via the bridge's "configure" message.
      window.__VOIDHASH_PAYWALL__ = window.__VOIDHASH_PAYWALL__ || { products: [], variables: {} };
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script src="./${jsFileName}"></script>
  </body>
</html>
`;

/** The in-memory entry esbuild bundles for a paywall. */
const paywallEntryContents = (paywallModuleSpecifier: string): string =>
  `import paywall from ${paywallModuleSpecifier};
import { mountPaywall } from "@voidhash/paywalls/dom";
const root = document.getElementById("root");
if (root) mountPaywall(paywall, root);
`;

interface BuiltPaywallArtifacts {
  readonly htmlBytes: Uint8Array;
  readonly jsBytes: Uint8Array;
  readonly jsFileName: string;
  readonly assets: ReadonlyArray<{ relName: string; bytes: Uint8Array }>;
}

/** The `assets/…` name an emitted esbuild output file keeps in the bundle. */
const assetRelName = (rel: string): string => {
  const idx = rel.indexOf(`${POSIX_SEP}assets${POSIX_SEP}`);
  if (idx >= 0) return rel.slice(idx + 1);
  return rel.slice(rel.lastIndexOf(POSIX_SEP) + 1);
};

/** Bundles a single paywall to HTML + JS (+ assets) in memory via esbuild. */
const bundlePaywall = (
  path: Path.Path,
  projectRoot: string,
  voidhashDir: string,
  paywallAbsPath: string,
): Effect.Effect<BuiltPaywallArtifacts, PaywallBuildError> =>
  Effect.gen(function* bundlePaywall() {
    const subject = `paywall ${path.basename(paywallAbsPath)}`;
    const specifier = yield* toJsonText("the paywall entry point", paywallAbsPath);

    const result = yield* Effect.tryPromise({
      try: () =>
        esbuild.build({
          assetNames: "assets/[name]-[hash]",
          bundle: true,
          define: { "process.env.NODE_ENV": '"production"' },
          format: "iife",
          jsx: "automatic",
          jsxImportSource: "react",
          loader: PAYWALL_ASSET_LOADERS,
          logLevel: "silent",
          minify: true,
          outdir: "out",
          platform: "browser",
          plugins: [closedImportsPlugin(voidhashDir)],
          publicPath: ".",
          stdin: {
            contents: paywallEntryContents(specifier),
            loader: "tsx",
            resolveDir: projectRoot,
            sourcefile: "voidhash-entry.tsx",
          },
          target: ["es2019", "safari13"],
          write: false,
        }),
      catch: bundleFailure(subject),
    });

    let jsBytes: Uint8Array | undefined;
    const assets: Array<{ relName: string; bytes: Uint8Array }> = [];

    for (const file of result.outputFiles) {
      const rel = file.path.split(path.sep).join(POSIX_SEP);
      if (rel.endsWith(".js")) {
        jsBytes = file.contents;
        continue;
      }
      // Asset emitted under out/assets/… — keep the assets/… suffix.
      assets.push({ bytes: file.contents, relName: assetRelName(rel) });
    }

    if (!jsBytes) {
      return yield* new PaywallBuildError({
        message: `Failed to bundle ${subject}: esbuild produced no JavaScript output`,
      });
    }

    const jsFileName = "bundle.js";
    return {
      assets,
      htmlBytes: textEncoder.encode(htmlShell(jsFileName)),
      jsBytes,
      jsFileName,
    };
  });

// ── Component bundling ───────────────────────────────────────────────────────

/** Modules a component runtime bundle leaves to the consumer (Studio). */
const COMPONENT_RUNTIME_EXTERNALS = [
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "@voidhash/paywalls",
  "@voidhash/paywalls/*",
];

const componentBuildOptions = (voidhashDir: string): esbuild.BuildOptions => ({
  bundle: true,
  define: { "process.env.NODE_ENV": '"production"' },
  external: [...COMPONENT_RUNTIME_EXTERNALS],
  format: "esm",
  jsx: "automatic",
  jsxImportSource: "react",
  loader: COMPONENT_ASSET_LOADERS,
  logLevel: "silent",
  minify: true,
  platform: "browser",
  plugins: [closedImportsPlugin(voidhashDir)],
  target: ["es2020"],
  write: false,
});

/**
 * The exact module specifiers the studio panel sandbox's `require` shim
 * resolves (`@voidhash/paywalls/sandbox`'s `modules` map). A panel bundle MUST
 * leave every one of these external so the shim satisfies it at evaluation
 * time; a bundled copy would ship a second React/SDK instance and break hooks.
 * Kept an explicit list (not the runtime's `@voidhash/paywalls/*` glob) so it
 * mirrors the shim's keys one-for-one.
 */
export const PANEL_SANDBOX_EXTERNALS = [
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "@voidhash/paywalls",
  "@voidhash/paywalls/panel",
  "@voidhash/paywalls/jsx-runtime",
  "@voidhash/paywalls/jsx-dev-runtime",
];

/**
 * esbuild settings for the panel bundle. It mirrors the studio's BROWSER
 * compile pipeline (`code-mode/compile-pipeline.ts`) exactly so the emitted
 * module is byte-compatible with what the panel sandbox evaluates:
 *
 * - `format: "cjs"` — the sandbox runs it via `new Function("require",
 *   "module", "exports", code)` and reads `module.exports.default`, so ES
 *   module syntax cannot be used.
 * - `jsxImportSource: "@voidhash/paywalls"` — JSX compiles to
 *   `require("@voidhash/paywalls/jsx-runtime")`, which the shim resolves to the
 *   sandbox's single shared React (matching the browser transform).
 * - externals = {@link PANEL_SANDBOX_EXTERNALS}, the shim's module keys.
 */
const panelBuildOptions = (voidhashDir: string): esbuild.BuildOptions => ({
  bundle: true,
  define: { "process.env.NODE_ENV": '"production"' },
  external: [...PANEL_SANDBOX_EXTERNALS],
  format: "cjs",
  jsx: "automatic",
  jsxImportSource: "@voidhash/paywalls",
  loader: COMPONENT_ASSET_LOADERS,
  logLevel: "silent",
  minify: true,
  platform: "browser",
  plugins: [closedImportsPlugin(voidhashDir)],
  target: ["es2020"],
  write: false,
});

/**
 * Whether a component definition declares a custom editor panel — decided the
 * SAME way the studio's browser pipeline does (`@voidhash/paywalls`'s
 * `definitionHasPanel`): a live `panel` FUNCTION, not merely a present key.
 * Only a `hasPanel` component emits/uploads the `panel.js` artifact.
 */
export const definitionHasPanel = (definition: { readonly panel?: unknown }): boolean =>
  typeof definition.panel === "function";

const firstJsOutput = (result: esbuild.BuildResult): Uint8Array | undefined =>
  (result.outputFiles ?? []).find((f) => f.path.endsWith(".js"))?.contents;

/** Runs an esbuild bundle and returns its single JavaScript output. */
const bundleSingleJs = (
  subject: string,
  options: esbuild.BuildOptions,
): Effect.Effect<Uint8Array, PaywallBuildError> =>
  Effect.gen(function* bundleSingleJs() {
    const result = yield* Effect.tryPromise({
      try: () => esbuild.build(options),
      catch: bundleFailure(subject),
    });
    const bytes = firstJsOutput(result);
    if (bytes === undefined) {
      return yield* new PaywallBuildError({
        message: `Failed to bundle ${subject}: esbuild produced no JavaScript output`,
      });
    }
    return bytes;
  });

/** Bundles a component module to a single ESM `runtime.js`. */
const bundleComponentRuntime = (
  path: Path.Path,
  voidhashDir: string,
  componentAbsPath: string,
): Effect.Effect<Uint8Array, PaywallBuildError> =>
  bundleSingleJs(`component ${path.basename(componentAbsPath)}`, {
    ...componentBuildOptions(voidhashDir),
    entryPoints: [componentAbsPath],
    outdir: "out",
  });

/**
 * Bundles a component's custom editor panel: the WHOLE definition module as a
 * single CJS module whose `default` export is the `defineComponent({ … })`
 * definition — identical in shape to what the studio's browser compile
 * pipeline produces. The panel sandbox evaluates this module, reads the
 * definition off `module.exports.default`, and drives `definition.panel` live;
 * it needs the full definition (props + panel + render), not the panel tree
 * alone. Uses {@link panelBuildOptions} (CJS, `@voidhash/paywalls` JSX, shim
 * externals) so the byte output matches the sandbox's require shim exactly.
 */
const bundleComponentPanel = (
  path: Path.Path,
  voidhashDir: string,
  componentAbsPath: string,
): Effect.Effect<Uint8Array, PaywallBuildError> =>
  bundleSingleJs(`panel of component ${path.basename(componentAbsPath)}`, {
    ...panelBuildOptions(voidhashDir),
    entryPoints: [componentAbsPath],
    outdir: "out",
  });

// ── Preview tree inspection ──────────────────────────────────────────────────

/** The one placeholder reason that is NOT a render error (§3). */
const LEGITIMATE_NULL_REASON = "render returned null";

/**
 * Collects the reasons of placeholder nodes a §3 preview tree contains that
 * were produced by render ERRORS — a thrown render (`"render threw: …"`), an
 * unsupported element type, … Placeholders carrying the legitimate
 * `"render returned null"` reason are not errors and are skipped.
 */
export const collectRenderErrorPlaceholderReasons = (tree: unknown): string[] => {
  const reasons: string[] = [];
  const visit = (node: unknown): void => {
    if (typeof node !== "object" || node === null) {
      return;
    }
    if ("root" in node) {
      visit(node.root);
    }
    if (
      "type" in node &&
      node.type === "placeholder" &&
      "reason" in node &&
      typeof node.reason === "string" &&
      node.reason !== LEGITIMATE_NULL_REASON
    ) {
      reasons.push(node.reason);
    }
    if ("children" in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        visit(child);
      }
    }
  };
  visit(tree);
  return reasons;
};

// ── Validation helpers ───────────────────────────────────────────────────────

const validateIds = (
  path: Path.Path,
  kind: "paywall" | "component",
  files: ReadonlyArray<string>,
): Effect.Effect<void, PaywallBuildError> =>
  Effect.gen(function* validateIds() {
    const seen = new Map<string, string>();
    for (const file of files) {
      const id = idFromFile(path, file);
      if (!DEPLOY_SLUG_REGEX.test(id)) {
        return yield* Effect.fail(
          new PaywallBuildError({
            message:
              `Invalid ${kind} id "${id}" (${path.basename(file)}). Ids derive ` +
              `from file names and must match ${DEPLOY_SLUG_REGEX}.`,
          }),
        );
      }
      const existing = seen.get(id);
      if (existing !== undefined) {
        return yield* Effect.fail(
          new PaywallBuildError({
            message: `Duplicate ${kind} id "${id}" (${existing} and ${file}).`,
          }),
        );
      }
      seen.set(id, file);
    }
  });

// ── Public API ───────────────────────────────────────────────────────────────

export interface BuildPaywallsOptions {
  readonly projectRoot: string;
  readonly team: string;
  readonly project: string;
  readonly cliVersion: string;
  readonly runtimeVersion: string;
  /** Non-fatal warning callback (e.g. `Console.log`). */
  readonly onWarn?: (message: string) => Effect.Effect<void>;
}

export interface BuildPaywallsResult {
  readonly manifest: DeployManifest;
  /** Absolute path to the build output directory. */
  readonly outDir: string;
  /** Absolute path to the written manifest.json. */
  readonly manifestPath: string;
}

/**
 * Compiles every paywall and component in `.voidhash` into deployable
 * artifacts and writes the content-addressed schemaVersion-2
 * {@link DeployManifest} — the exact payload `voidhash-cli deploy` uploads.
 * Output lands in {@link BUILD_DIR}:
 *
 * - `paywalls/<id>/` — `index.html`, `bundle.js`, `assets/…`
 * - `components/<id>/` — `manifest.json`, `previews/<state>.json`,
 *   `runtime.js` and (when declared) `panel.js`
 * - `manifest.json` — the assembled deploy manifest
 *
 * The build runs a TypeScript gate over all discovered sources first, and
 * every bundle enforces the closed-import rules (only `@voidhash/paywalls`,
 * React's runtime entries and relative imports within `.voidhash`).
 */
export const buildPaywalls = ({
  projectRoot,
  team,
  project,
  cliVersion,
  runtimeVersion,
  onWarn,
}: BuildPaywallsOptions): Effect.Effect<
  BuildPaywallsResult,
  PaywallBuildError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* buildPaywalls() {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const warn = (message: string): Effect.Effect<void> => {
      if (onWarn) return onWarn(message);
      return Effect.void;
    };
    const voidhashDir = path.join(projectRoot, ".voidhash");
    const paywallsDir = path.join(voidhashDir, "paywalls");
    const componentsDir = path.join(voidhashDir, "components");
    const outDir = path.join(projectRoot, BUILD_DIR);

    const paywallFiles = yield* listSourceFiles(fs, path, paywallsDir);
    const componentFiles = yield* listSourceFiles(fs, path, componentsDir);

    if (paywallFiles.length === 0 && componentFiles.length === 0) {
      return yield* Effect.fail(
        new PaywallBuildError({
          message: `No paywalls or components found in ${voidhashDir}.`,
        }),
      );
    }

    yield* validateIds(path, "paywall", paywallFiles);
    yield* validateIds(path, "component", componentFiles);

    // Typecheck gate: fail fast, before any bundling.
    yield* typecheckPaywallSources({
      files: [...paywallFiles, ...componentFiles],
      projectRoot,
    }).pipe(
      Effect.catchTag("PaywallTypecheckError", (e) =>
        Effect.fail(new PaywallBuildError({ cause: e.cause, message: e.message })),
      ),
    );

    // Clear any previous build so removed paywalls/components don't linger.
    yield* fs
      .remove(outDir, { force: true, recursive: true })
      .pipe(
        Effect.mapError(
          (cause) => new PaywallBuildError({ cause, message: "Failed to clean build dir" }),
        ),
      );

    // Register esbuild so we can `require` paywall/component modules (JSX) to
    // read metadata and render preview trees.
    const { unregister } = yield* registerTsxLoader();

    // ── Paywalls ─────────────────────────────────────────────────────────────

    const assetIndex = new Map<string, DeployAsset>();
    const paywalls: DeployPaywall[] = [];

    for (const file of paywallFiles) {
      const id = idFromFile(path, file);
      const meta = yield* loadPaywallMeta(path, file);
      const built = yield* bundlePaywall(path, projectRoot, voidhashDir, file);

      const paywallOutDir = path.join(outDir, "paywalls", id);
      const html = yield* writeArtifact(
        fs,
        path,
        projectRoot,
        path.join(paywallOutDir, "index.html"),
        built.htmlBytes,
      );
      const js = yield* writeArtifact(
        fs,
        path,
        projectRoot,
        path.join(paywallOutDir, built.jsFileName),
        built.jsBytes,
      );

      const referencedAssets: string[] = [];
      for (const asset of built.assets) {
        const deployAsset = yield* writeArtifact(
          fs,
          path,
          projectRoot,
          path.join(paywallOutDir, asset.relName),
          asset.bytes,
        );
        assetIndex.set(deployAsset.path, deployAsset);
        referencedAssets.push(deployAsset.path);
      }
      referencedAssets.sort();

      const source = yield* readDeployFile(fs, path, projectRoot, file);

      paywalls.push({
        artifacts: { html, js },
        assets: referencedAssets,
        contentHash: computePaywallContentHash({
          assetSha256s: referencedAssets.map((assetPath) => assetIndex.get(assetPath)?.sha256 ?? ""),
          htmlSha256: html.sha256,
          jsSha256: js.sha256,
        }),
        description: meta.description,
        id,
        products: meta.products,
        source,
        title: meta.title,
        variables: meta.variables,
      });
    }

    // ── Components ───────────────────────────────────────────────────────────

    const components: DeployComponent[] = [];

    if (componentFiles.length > 0) {
      const paywallsLib = yield* requireFromProject<UserPaywallsLib>(
        projectRoot,
        "@voidhash/paywalls",
      );
      const treeLib = yield* requireFromProject<UserTreeLib>(
        projectRoot,
        "@voidhash/paywalls/tree",
      );
      const react = yield* requireFromProject<UserReactLib>(projectRoot, "react");

      for (const file of componentFiles) {
        const id = idFromFile(path, file);
        const definition = yield* loadComponentDefinition(path, file);
        const componentOutDir = path.join(outDir, "components", id);

        // §2 component manifest.
        const manifestJson = yield* Effect.try({
          try: () => paywallsLib.extractComponentManifest(definition),
          catch: (cause) =>
            new PaywallBuildError({
              cause,
              message:
                `Failed to extract the manifest of component "${id}"` +
                manifestFailureSuffix(cause),
            }),
        });
        const manifest = yield* writeArtifact(
          fs,
          path,
          projectRoot,
          path.join(componentOutDir, "manifest.json"),
          yield* toJsonBytes(`the manifest of component "${id}"`, manifestJson),
        );

        // §3 preview trees — one per declared state, always including
        // "default" (rendered with prop defaults when not declared).
        const previewStates: Record<string, unknown> = {
          default: definition.previews.default ?? {},
          ...definition.previews,
        };
        const previews: DeployComponentPreview[] = [];
        for (const [state, preview] of Object.entries(previewStates)) {
          const data = readProperty(preview, "data");
          const tree = yield* Effect.tryPromise({
            try: () =>
              treeLib.renderToNodeTree(
                react.createElement(definition.component, recordOf(readProperty(preview, "props"))),
                {
                  config: {
                    products: readArray(readProperty(data, "products")),
                    variables: recordOf(readProperty(data, "variables")),
                    platform: readProperty(data, "platform"),
                    safeAreaInsets: readProperty(data, "safeAreaInsets"),
                    dimensions: readProperty(data, "dimensions"),
                  },
                  state,
                },
              ),
            catch: (cause) =>
              new PaywallBuildError({
                cause,
                message: `Failed to render preview "${state}" of component "${id}".`,
              }),
          });
          // A placeholder produced by a render error (thrown render,
          // unsupported element) still yields a valid tree — surface it so
          // authors don't ship broken previews silently.
          for (const reason of collectRenderErrorPlaceholderReasons(tree)) {
            yield* warn(
              `Component "${id}" preview "${state}" contains a render-error ` +
                `placeholder: ${reason}`,
            );
          }

          const previewFile = yield* writeArtifact(
            fs,
            path,
            projectRoot,
            path.join(componentOutDir, "previews", `${state}.json`),
            yield* toJsonBytes(`preview "${state}" of component "${id}"`, tree),
          );
          previews.push({ file: previewFile, state });
        }

        // Runtime bundle (and panel bundle, when declared).
        const runtimeBytes = yield* bundleComponentRuntime(path, voidhashDir, file);
        const runtime = yield* writeArtifact(
          fs,
          path,
          projectRoot,
          path.join(componentOutDir, "runtime.js"),
          runtimeBytes,
        );

        // Emit + upload the panel.js artifact ONLY for a component with a live
        // `panel` function (the same `hasPanel` test the browser pipeline uses),
        // per the reserved `artifacts.panel` contract field.
        let panel: DeployArtifact | null = null;
        if (definitionHasPanel(definition)) {
          const panelBytes = yield* bundleComponentPanel(path, voidhashDir, file);
          panel = yield* writeArtifact(
            fs,
            path,
            projectRoot,
            path.join(componentOutDir, "panel.js"),
            panelBytes,
          );
        }

        const source = yield* readDeployFile(fs, path, projectRoot, file);

        components.push({
          artifacts: { panel, runtime },
          contentHash: computeComponentContentHash({
            manifestSha256: manifest.sha256,
            panelSha256: panel?.sha256 ?? null,
            previewSha256s: previews.map((p) => p.file.sha256),
            runtimeSha256: runtime.sha256,
          }),
          id,
          manifest,
          previews,
          source,
          title: definition.title,
        });
      }
    }

    yield* Effect.sync(() => unregister());

    // ── Manifest ─────────────────────────────────────────────────────────────

    let configFile: string | undefined;
    for (const ext of ["ts", "js", "cjs", "mjs"]) {
      const candidate = path.join(projectRoot, `voidhash.config.${ext}`);
      const exists = yield* fs
        .exists(candidate)
        .pipe(
          Effect.mapError(
            (cause) =>
              new PaywallBuildError({ cause, message: `Failed to look for ${candidate}` }),
          ),
        );
      if (exists) {
        configFile = candidate;
        break;
      }
    }
    if (!configFile) {
      return yield* Effect.fail(
        new PaywallBuildError({
          message: "voidhash.config.* not found. Run 'voidhash-cli init' first.",
        }),
      );
    }
    const config = yield* readDeployFile(fs, path, projectRoot, configFile);

    const now = yield* DateTime.nowAsDate;

    const manifest: DeployManifest = {
      assets: [...assetIndex.values()].sort((a, b) => a.path.localeCompare(b.path)),
      cliVersion,
      components,
      config,
      createdAt: now.toISOString(),
      paywalls,
      project,
      runtimeVersion,
      schemaVersion: DEPLOY_MANIFEST_VERSION,
      team,
    };

    // Self-check against the contract schema before writing — a manifest the
    // server would reject should never leave the build.
    yield* Schema.decodeUnknownEffect(DeployManifestSchema)(manifest).pipe(
      Effect.mapError(
        (cause) =>
          new PaywallBuildError({
            cause,
            message: `The build produced an invalid deploy manifest: ${cause.message}`,
          }),
      ),
    );

    const manifestPath = path.join(outDir, "manifest.json");
    yield* writeFile(
      fs,
      path,
      manifestPath,
      yield* toJsonBytes("the deploy manifest", manifest),
    );

    return { manifest, manifestPath, outDir };
  });
