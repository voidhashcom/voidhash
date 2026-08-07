import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path, type PlatformError, Schema } from "effect";
import type { Plugin, ViteDevServer } from "vite";

// The POSIX `Path` service, resolved once so Vite's synchronous plugin hooks
// (`config`, watcher callbacks) can join paths without running an Effect.
const path = Effect.runSync(Effect.provide(Path.Path, Path.layer));

/** Serializes a value as a JSON literal for the generated virtual module. */
const jsonLiteral = Schema.encodeSync(Schema.UnknownFromJsonString);

/**
 * The id Studio imports to discover the user's paywalls and components. Resolved
 * by {@link voidhashPaywallsPlugin} into a module of eager imports so titles and
 * prop schemas are available synchronously and HMR tracks each source file.
 */
export const VIRTUAL_ID = "virtual:voidhash-paywalls";
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;

const PAYWALLS_DIR = "paywalls";
const COMPONENTS_DIR = "components";
const SOURCE_EXTENSIONS = [".tsx", ".jsx", ".ts", ".js"];

interface SourceEntry {
  /** Stable id derived from the file name (e.g. `onboarding-green`). */
  readonly id: string;
  /** Absolute path to the source file. */
  readonly file: string;
}

// Discovery below MUST stay in sync with the CLI build's logic
// (apps/cli/src/domain/services/paywall-build.ts: `listFilesRecursive`,
// `isSourceFile`, `idFromFile`) so Studio shows exactly what `deploy` ships:
// recursive scan, same source extensions, id = file basename without extension.
const isSourceFile = (name: string): boolean =>
  SOURCE_EXTENSIONS.some((ext) => name.endsWith(ext)) && !name.endsWith(".d.ts");

const idFromFile = (file: string): string => path.basename(file).replace(/\.(tsx|jsx|ts|js)$/, "");

/** Recursively lists files under a directory (absolute paths). */
const listFilesRecursive = (
  dir: string,
): Effect.Effect<Array<string>, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const exists = yield* fs.exists(dir);
    if (!exists) return [];

    const out: Array<string> = [];
    for (const entry of yield* fs.readDirectory(dir)) {
      const full = path.join(dir, entry);
      const info = yield* fs.stat(full);
      if (info.type === "Directory") {
        out.push(...(yield* listFilesRecursive(full)));
      } else {
        out.push(full);
      }
    }
    return out;
  });

/** Lists the source files under a `.voidhash/<dir>` tree, sorted by id. */
const scanDir = (
  voidhashDir: string,
  dir: string,
): Effect.Effect<Array<SourceEntry>, PlatformError.PlatformError, FileSystem.FileSystem> =>
  listFilesRecursive(path.join(voidhashDir, dir)).pipe(
    Effect.map((files) =>
      files
        .filter((file) => isSourceFile(path.basename(file)))
        .map((file) => ({ file, id: idFromFile(file) }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    ),
  );

/**
 * Vite reference to a filesystem-absolute path. Files live in the *user's*
 * project, outside Studio's own root, so they must be addressed via the `/@fs/`
 * convention (and the project root must be added to `server.fs.allow`).
 */
const fsImportSpecifier = (absPath: string): string => `/@fs${absPath}`;

/** Generates the source of the virtual module from the discovered files. */
const generateModule = (
  projectRoot: string,
  paywalls: ReadonlyArray<SourceEntry>,
  components: ReadonlyArray<SourceEntry>,
): string => {
  const lines: string[] = [];
  const paywallRefs: string[] = [];
  const componentRefs: string[] = [];

  paywalls.forEach((entry, i) => {
    lines.push(`import * as __pw${i} from ${jsonLiteral(fsImportSpecifier(entry.file))};`);
    paywallRefs.push(
      `{ id: ${jsonLiteral(entry.id)}, file: ${jsonLiteral(entry.file)}, module: __pw${i} }`,
    );
  });

  components.forEach((entry, i) => {
    lines.push(`import * as __cmp${i} from ${jsonLiteral(fsImportSpecifier(entry.file))};`);
    componentRefs.push(
      `{ id: ${jsonLiteral(entry.id)}, file: ${jsonLiteral(entry.file)}, module: __cmp${i} }`,
    );
  });

  lines.push(`export const projectRoot = ${jsonLiteral(projectRoot)};`);
  lines.push(`export const paywalls = [${paywallRefs.join(", ")}];`);
  lines.push(`export const components = [${componentRefs.join(", ")}];`);
  return lines.join("\n");
};

export interface VoidhashPaywallsPluginOptions {
  /** Absolute path to the user's project root (the folder holding `.voidhash`). */
  projectRoot: string;
}

/**
 * Exposes the user's `.voidhash/paywalls` and `.voidhash/components` to Studio as
 * the `virtual:voidhash-paywalls` module, and keeps the preview live: editing a
 * file triggers HMR through the static-import graph, while adding or removing a
 * file invalidates the virtual module and reloads so the sidebar stays in sync.
 */
export const voidhashPaywallsPlugin = ({ projectRoot }: VoidhashPaywallsPluginOptions): Plugin => {
  const voidhashDir = path.join(projectRoot, ".voidhash");
  let server: ViteDevServer | undefined;

  const invalidate = () => {
    if (!server) return;
    const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
    if (mod) server.moduleGraph.invalidateModule(mod);
    server.ws.send({ type: "full-reload" });
  };

  const isPaywallSource = (file: string): boolean =>
    file.startsWith(path.join(voidhashDir, PAYWALLS_DIR)) ||
    file.startsWith(path.join(voidhashDir, COMPONENTS_DIR));

  return {
    name: "voidhash:paywalls",
    enforce: "pre",

    config: () => ({
      server: { fs: { allow: [projectRoot] } },
    }),

    configureServer(devServer) {
      server = devServer;
      // Watch the .voidhash tree for structural changes (add/remove files).
      devServer.watcher.add(voidhashDir);
      devServer.watcher.on("add", (file) => {
        if (isPaywallSource(file)) invalidate();
      });
      devServer.watcher.on("unlink", (file) => {
        if (isPaywallSource(file)) invalidate();
      });
    },

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID;
      return null;
    },

    load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return null;
      return Effect.runPromise(
        Effect.gen(function* () {
          const paywalls = yield* scanDir(voidhashDir, PAYWALLS_DIR);
          const components = yield* scanDir(voidhashDir, COMPONENTS_DIR);
          return generateModule(projectRoot, paywalls, components);
        }).pipe(Effect.provide(NodeServices.layer), Effect.orDie),
      );
    },
  };
};
