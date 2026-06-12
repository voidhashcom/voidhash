/**
 * The deploy build pipeline: scans `.voidhash/paywalls` and
 * `.voidhash/components`, typechecks them, compiles every paywall into a
 * WebView-ready HTML/JS bundle and every component into its §2 manifest, §3
 * preview trees and runtime bundle, and assembles the content-addressed
 * schemaVersion-2 deploy manifest (contract: docs/specs/paywall-deploy-contract.md).
 */
import { createHash } from "node:crypto";
import { existsSync, promises as fsp, readdirSync, statSync } from "node:fs";
import {
  basename,
  dirname,
  extname,
  join,
  posix,
  relative,
  sep,
} from "node:path";
import { Data, Effect, Schema } from "effect";
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
import {
  PAYWALL_ASSET_EXTENSIONS,
  typecheckPaywallSources,
} from "./paywall-typecheck";

export class PaywallBuildError extends Data.TaggedError("PaywallBuildError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/** Directory (relative to the project root) where build output is written. */
export const BUILD_DIR = join(".voidhash", ".build");

const SOURCE_EXTENSIONS = [".tsx", ".jsx", ".ts", ".js"];

/**
 * Binary asset types paywall bundles may import; emitted as files. Derived
 * from the typecheck gate's extension list so the two can never drift.
 */
const PAYWALL_ASSET_LOADERS: Record<string, esbuild.Loader> =
  Object.fromEntries(
    PAYWALL_ASSET_EXTENSIONS.map((ext) => [`.${ext}`, "file"]),
  );

/**
 * Component runtime bundles must stay a single file (the manifest has no
 * per-component asset list), so binary imports are inlined as data URLs.
 */
const COMPONENT_ASSET_LOADERS: Record<string, esbuild.Loader> =
  Object.fromEntries(
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
  sha256Hex(
    `${input.htmlSha256}:${input.jsSha256}:${[...input.assetSha256s]
      .sort()
      .join(":")}`,
  );

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

const contentTypeFor = (path: string): string =>
  CONTENT_TYPES[extname(path).toLowerCase()] ?? "application/octet-stream";

/** Normalizes an absolute path to a project-root-relative POSIX path. */
const toRelPosix = (projectRoot: string, abs: string): string =>
  relative(projectRoot, abs).split(sep).join(posix.sep);

// Discovery (isSourceFile / idFromFile / listFilesRecursive) is mirrored by
// Studio's virtual-paywalls plugin
// (apps/studio/src/server/virtual-paywalls-plugin.ts) — keep both in sync.
const isSourceFile = (name: string): boolean =>
  SOURCE_EXTENSIONS.some((ext) => name.endsWith(ext)) &&
  !name.endsWith(".d.ts");

const idFromFile = (file: string): string =>
  basename(file).replace(/\.(tsx|jsx|ts|js)$/, "");

/** Recursively lists files under a directory (absolute paths). */
const listFilesRecursive = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listFilesRecursive(full));
    } else {
      out.push(full);
    }
  }
  return out;
};

const listSourceFiles = (dir: string): string[] =>
  listFilesRecursive(dir).filter((f) => isSourceFile(basename(f)));

/** Turns an esbuild failure into a readable, file-located error message. */
const describeEsbuildFailure = (cause: unknown): string | undefined => {
  if (
    typeof cause === "object" &&
    cause !== null &&
    "errors" in cause &&
    Array.isArray((cause as esbuild.BuildFailure).errors)
  ) {
    return (cause as esbuild.BuildFailure).errors
      .map((error) => {
        const location = error.location
          ? `${error.location.file}:${error.location.line}:${error.location.column}: `
          : "";
        return `  ${location}${error.text}`;
      })
      .join("\n");
  }
  return;
};

const bundleFailure = (subject: string) => (cause: unknown) => {
  const details = describeEsbuildFailure(cause);
  return new PaywallBuildError({
    cause,
    message: details
      ? `Failed to bundle ${subject}:\n${details}`
      : `Failed to bundle ${subject}`,
  });
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
      };
      readonly state?: string;
    },
  ) => Promise<unknown>;
}

interface UserReactLib {
  readonly createElement: (
    type: unknown,
    props: Record<string, unknown> | null,
  ) => unknown;
}

interface ComponentPreviewStateLike {
  readonly props?: Record<string, unknown>;
  readonly data?: {
    readonly products?: ReadonlyArray<unknown>;
    readonly variables?: Record<string, unknown>;
  };
}

interface ComponentDefinitionLike {
  readonly id: string;
  readonly title?: string;
  readonly description?: string;
  readonly previews: Record<string, ComponentPreviewStateLike>;
  readonly panel?: unknown;
  readonly component: unknown;
  readonly __voidhash: { readonly kind: string };
}

const requireFromProject = <T>(
  projectRoot: string,
  specifier: string,
): Effect.Effect<T, PaywallBuildError> =>
  Effect.try({
    try: () =>
      require(require.resolve(specifier, { paths: [projectRoot] })) as T,
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
const registerTsxLoader = (): Effect.Effect<
  { unregister: () => void },
  PaywallBuildError
> =>
  Effect.tryPromise({
    try: async () => {
      const { register } = await import("esbuild-register/dist/node");
      return register({ format: "cjs", loader: "tsx" });
    },
    catch: (cause) =>
      new PaywallBuildError({
        cause,
        message: "Failed to initialize the TypeScript/JSX loader.",
      }),
  });

const loadModuleDefault = (
  file: string,
): Effect.Effect<unknown, PaywallBuildError> =>
  Effect.try({
    try: () => {
      delete require.cache[require.resolve(file)];
      const mod = require(file) as { default?: unknown };
      return mod?.default ?? mod;
    },
    catch: (cause) =>
      new PaywallBuildError({
        cause,
        message: `Failed to load ${file}: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      }),
  });

const isScalar = (value: unknown): value is string | number | boolean =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

interface PaywallModuleMeta {
  readonly title: string;
  readonly description?: string;
  readonly products: ReadonlyArray<string>;
  readonly variables: DeployVariables;
}

/** Reads the `__voidhash` metadata off a paywall module's default export. */
const loadPaywallMeta = (
  file: string,
): Effect.Effect<PaywallModuleMeta, PaywallBuildError> =>
  loadModuleDefault(file).pipe(
    Effect.flatMap((def) => {
      const meta = (
        def as { __voidhash?: Record<string, unknown> } | null | undefined
      )?.__voidhash;
      if (!meta || meta.kind !== "paywall") {
        return Effect.fail(
          new PaywallBuildError({
            message: `${file} must default-export createPaywall({ … }) from "@voidhash/paywalls".`,
          }),
        );
      }
      const title =
        typeof meta.title === "string" && meta.title.length > 0
          ? meta.title
          : idFromFile(file);
      const description =
        typeof meta.description === "string" ? meta.description : undefined;
      const products = Array.isArray(meta.products)
        ? meta.products.filter((p): p is string => typeof p === "string")
        : [];
      const rawVariables =
        typeof meta.variables === "object" && meta.variables !== null
          ? (meta.variables as Record<string, unknown>)
          : {};
      const variables: Record<string, string | number | boolean> = {};
      for (const [key, value] of Object.entries(rawVariables)) {
        if (!isScalar(value)) {
          return Effect.fail(
            new PaywallBuildError({
              message:
                `Variable "${key}" of paywall ${basename(file)} must be a ` +
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
  file: string,
): Effect.Effect<ComponentDefinitionLike, PaywallBuildError> =>
  loadModuleDefault(file).pipe(
    Effect.flatMap((def) => {
      const candidate = def as Partial<ComponentDefinitionLike> | null;
      if (
        !candidate ||
        candidate.__voidhash?.kind !== "component" ||
        typeof candidate.component !== "function" ||
        typeof candidate.id !== "string"
      ) {
        return Effect.fail(
          new PaywallBuildError({
            message: `${file} must default-export defineComponent({ … }) from "@voidhash/paywalls".`,
          }),
        );
      }
      const expectedId = idFromFile(file);
      if (candidate.id !== expectedId) {
        return Effect.fail(
          new PaywallBuildError({
            message:
              `Component id "${candidate.id}" does not match its file name ` +
              `"${expectedId}" (${basename(file)}). Rename the file or the id.`,
          }),
        );
      }
      return Effect.succeed({
        ...candidate,
        previews: candidate.previews ?? {},
      } as ComponentDefinitionLike);
    }),
  );

// ── Output writing ───────────────────────────────────────────────────────────

const writeFile = (
  absPath: string,
  bytes: Uint8Array,
): Effect.Effect<void, PaywallBuildError> =>
  Effect.tryPromise({
    try: async () => {
      await fsp.mkdir(dirname(absPath), { recursive: true });
      await fsp.writeFile(absPath, bytes);
    },
    catch: (cause) =>
      new PaywallBuildError({ cause, message: `Failed to write ${absPath}` }),
  });

/** Writes `bytes` to `absPath` and returns its manifest artifact entry. */
const writeArtifact = (
  projectRoot: string,
  absPath: string,
  bytes: Uint8Array,
): Effect.Effect<DeployArtifact, PaywallBuildError> =>
  writeFile(absPath, bytes).pipe(
    Effect.map(() => ({
      bytes: bytes.byteLength,
      contentType: contentTypeFor(absPath),
      path: toRelPosix(projectRoot, absPath),
      sha256: sha256Hex(bytes),
    })),
  );

const readDeployFile = (
  projectRoot: string,
  absPath: string,
): Effect.Effect<DeployFile, PaywallBuildError> =>
  Effect.tryPromise({
    try: async () => {
      const bytes = await fsp.readFile(absPath);
      return {
        bytes: bytes.byteLength,
        path: toRelPosix(projectRoot, absPath),
        sha256: sha256Hex(bytes),
      };
    },
    catch: (cause) =>
      new PaywallBuildError({ cause, message: `Failed to read ${absPath}` }),
  });

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
const paywallEntryContents = (paywallAbsPath: string): string =>
  `import paywall from ${JSON.stringify(paywallAbsPath)};
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

/** Bundles a single paywall to HTML + JS (+ assets) in memory via esbuild. */
const bundlePaywall = (
  projectRoot: string,
  voidhashDir: string,
  paywallAbsPath: string,
): Effect.Effect<BuiltPaywallArtifacts, PaywallBuildError> =>
  Effect.tryPromise({
    try: async () => {
      const result = await esbuild.build({
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
          contents: paywallEntryContents(paywallAbsPath),
          loader: "tsx",
          resolveDir: projectRoot,
          sourcefile: "voidhash-entry.tsx",
        },
        target: ["es2019", "safari13"],
        write: false,
      });

      let jsBytes: Uint8Array | undefined;
      const assets: Array<{ relName: string; bytes: Uint8Array }> = [];

      for (const file of result.outputFiles) {
        const rel = file.path.split(sep).join(posix.sep);
        if (rel.endsWith(".js")) {
          jsBytes = file.contents;
        } else {
          // Asset emitted under out/assets/… — keep the assets/… suffix.
          const idx = rel.indexOf("/assets/");
          const relName = idx >= 0 ? rel.slice(idx + 1) : posix.basename(rel);
          assets.push({ bytes: file.contents, relName });
        }
      }

      if (!jsBytes) {
        throw new Error("esbuild produced no JavaScript output");
      }

      const jsFileName = "bundle.js";
      return {
        assets,
        htmlBytes: textEncoder.encode(htmlShell(jsFileName)),
        jsBytes,
        jsFileName,
      };
    },
    catch: bundleFailure(`paywall ${basename(paywallAbsPath)}`),
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

const firstJsOutput = (result: esbuild.BuildResult): Uint8Array => {
  const file = (result.outputFiles ?? []).find((f) => f.path.endsWith(".js"));
  if (!file) {
    throw new Error("esbuild produced no JavaScript output");
  }
  return file.contents;
};

/** Bundles a component module to a single ESM `runtime.js`. */
const bundleComponentRuntime = (
  voidhashDir: string,
  componentAbsPath: string,
): Effect.Effect<Uint8Array, PaywallBuildError> =>
  Effect.tryPromise({
    try: async () =>
      firstJsOutput(
        await esbuild.build({
          ...componentBuildOptions(voidhashDir),
          entryPoints: [componentAbsPath],
          outdir: "out",
        }),
      ),
    catch: bundleFailure(`component ${basename(componentAbsPath)}`),
  });

/**
 * Bundles a component's custom editor panel: an ESM module whose default
 * export is the definition's `panel` element tree.
 */
const bundleComponentPanel = (
  voidhashDir: string,
  componentAbsPath: string,
): Effect.Effect<Uint8Array, PaywallBuildError> =>
  Effect.tryPromise({
    try: async () =>
      firstJsOutput(
        await esbuild.build({
          ...componentBuildOptions(voidhashDir),
          outdir: "out",
          stdin: {
            contents: `import definition from ${JSON.stringify(componentAbsPath)};
export default definition.panel;
`,
            loader: "ts",
            resolveDir: dirname(componentAbsPath),
            sourcefile: "voidhash-panel-entry.ts",
          },
        }),
      ),
    catch: bundleFailure(`panel of component ${basename(componentAbsPath)}`),
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
export const collectRenderErrorPlaceholderReasons = (
  tree: unknown,
): string[] => {
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
  kind: "paywall" | "component",
  files: ReadonlyArray<string>,
): Effect.Effect<void, PaywallBuildError> =>
  Effect.gen(function* validateIds() {
    const seen = new Map<string, string>();
    for (const file of files) {
      const id = idFromFile(file);
      if (!DEPLOY_SLUG_REGEX.test(id)) {
        return yield* Effect.fail(
          new PaywallBuildError({
            message:
              `Invalid ${kind} id "${id}" (${basename(file)}). Ids derive ` +
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
  PaywallBuildError
> =>
  Effect.gen(function* buildPaywalls() {
    const warn = (message: string): Effect.Effect<void> =>
      onWarn ? onWarn(message) : Effect.void;
    const voidhashDir = join(projectRoot, ".voidhash");
    const paywallsDir = join(voidhashDir, "paywalls");
    const componentsDir = join(voidhashDir, "components");
    const outDir = join(projectRoot, BUILD_DIR);

    const paywallFiles = listSourceFiles(paywallsDir);
    const componentFiles = listSourceFiles(componentsDir);

    if (paywallFiles.length === 0 && componentFiles.length === 0) {
      return yield* Effect.fail(
        new PaywallBuildError({
          message: `No paywalls or components found in ${voidhashDir}.`,
        }),
      );
    }

    yield* validateIds("paywall", paywallFiles);
    yield* validateIds("component", componentFiles);

    // Typecheck gate: fail fast, before any bundling.
    yield* typecheckPaywallSources({
      files: [...paywallFiles, ...componentFiles],
      projectRoot,
    }).pipe(
      Effect.catchTag("PaywallTypecheckError", (e) =>
        Effect.fail(
          new PaywallBuildError({ cause: e.cause, message: e.message }),
        ),
      ),
    );

    // Clear any previous build so removed paywalls/components don't linger.
    yield* Effect.tryPromise({
      try: () => fsp.rm(outDir, { force: true, recursive: true }),
      catch: (cause) =>
        new PaywallBuildError({ cause, message: "Failed to clean build dir" }),
    });

    // Register esbuild so we can `require` paywall/component modules (JSX) to
    // read metadata and render preview trees.
    const { unregister } = yield* registerTsxLoader();

    // ── Paywalls ─────────────────────────────────────────────────────────────

    const assetIndex = new Map<string, DeployAsset>();
    const paywalls: DeployPaywall[] = [];

    for (const file of paywallFiles) {
      const id = idFromFile(file);
      const meta = yield* loadPaywallMeta(file);
      const built = yield* bundlePaywall(projectRoot, voidhashDir, file);

      const paywallOutDir = join(outDir, "paywalls", id);
      const html = yield* writeArtifact(
        projectRoot,
        join(paywallOutDir, "index.html"),
        built.htmlBytes,
      );
      const js = yield* writeArtifact(
        projectRoot,
        join(paywallOutDir, built.jsFileName),
        built.jsBytes,
      );

      const referencedAssets: string[] = [];
      for (const asset of built.assets) {
        const deployAsset = yield* writeArtifact(
          projectRoot,
          join(paywallOutDir, asset.relName),
          asset.bytes,
        );
        assetIndex.set(deployAsset.path, deployAsset);
        referencedAssets.push(deployAsset.path);
      }
      referencedAssets.sort();

      const source = yield* readDeployFile(projectRoot, file);

      paywalls.push({
        artifacts: { html, js },
        assets: referencedAssets,
        contentHash: computePaywallContentHash({
          assetSha256s: referencedAssets.map(
            (path) => assetIndex.get(path)?.sha256 ?? "",
          ),
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
      const react = yield* requireFromProject<UserReactLib>(
        projectRoot,
        "react",
      );

      for (const file of componentFiles) {
        const id = idFromFile(file);
        const definition = yield* loadComponentDefinition(file);
        const componentOutDir = join(outDir, "components", id);

        // §2 component manifest.
        const manifestJson = yield* Effect.try({
          try: () => paywallsLib.extractComponentManifest(definition),
          catch: (cause) =>
            new PaywallBuildError({
              cause,
              message:
                `Failed to extract the manifest of component "${id}"` +
                (cause instanceof Error ? `: ${cause.message}` : "."),
            }),
        });
        const manifest = yield* writeArtifact(
          projectRoot,
          join(componentOutDir, "manifest.json"),
          textEncoder.encode(`${JSON.stringify(manifestJson, null, 2)}\n`),
        );

        // §3 preview trees — one per declared state, always including
        // "default" (rendered with prop defaults when not declared).
        const previewStates: Record<string, ComponentPreviewStateLike> = {
          default: definition.previews.default ?? {},
          ...definition.previews,
        };
        const previews: DeployComponentPreview[] = [];
        for (const [state, preview] of Object.entries(previewStates)) {
          const tree = yield* Effect.tryPromise({
            try: () =>
              treeLib.renderToNodeTree(
                react.createElement(definition.component, preview.props ?? {}),
                {
                  config: {
                    products: preview.data?.products ?? [],
                    variables: preview.data?.variables ?? {},
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
            projectRoot,
            join(componentOutDir, "previews", `${state}.json`),
            textEncoder.encode(`${JSON.stringify(tree, null, 2)}\n`),
          );
          previews.push({ file: previewFile, state });
        }

        // Runtime bundle (and panel bundle, when declared).
        const runtimeBytes = yield* bundleComponentRuntime(voidhashDir, file);
        const runtime = yield* writeArtifact(
          projectRoot,
          join(componentOutDir, "runtime.js"),
          runtimeBytes,
        );

        let panel: DeployArtifact | null = null;
        if (definition.panel !== undefined && definition.panel !== null) {
          const panelBytes = yield* bundleComponentPanel(voidhashDir, file);
          panel = yield* writeArtifact(
            projectRoot,
            join(componentOutDir, "panel.js"),
            panelBytes,
          );
        }

        const source = yield* readDeployFile(projectRoot, file);

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

    const configFile = ["ts", "js", "cjs", "mjs"]
      .map((ext) => join(projectRoot, `voidhash.config.${ext}`))
      .find((p) => existsSync(p));
    if (!configFile) {
      return yield* Effect.fail(
        new PaywallBuildError({
          message:
            "voidhash.config.* not found. Run 'voidhash-cli init' first.",
        }),
      );
    }
    const config = yield* readDeployFile(projectRoot, configFile);

    const manifest: DeployManifest = {
      assets: [...assetIndex.values()].sort((a, b) =>
        a.path.localeCompare(b.path),
      ),
      cliVersion,
      components,
      config,
      createdAt: new Date().toISOString(),
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

    const manifestPath = join(outDir, "manifest.json");
    yield* writeFile(
      manifestPath,
      textEncoder.encode(`${JSON.stringify(manifest, null, 2)}\n`),
    );

    return { manifest, manifestPath, outDir };
  });
