import { constant } from "@voidhash/lib/lang";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";

import { safeRegister } from "../../utils/js-loading/js-file-loading";
import { relativePathPrefixFromDepth } from "../../utils/source-code";
import {
  FailedToDetectPackageManagerError,
  FailedToLoadPackageJsonError,
  FailedToLoadVoidhashConfigError,
  InvalidPackageJsonError,
  InvalidVoidhashConfigError,
  NoPackageManagerFoundError,
  PackageJsonNotFoundError,
  VoidhashConfigNotFoundError,
} from "../errors/source-code";
import { PackageJson } from "../schema/package-json";
import { VoidhashConfig } from "../schema/voidhash-config";
import * as P from "effect/Predicate";
import * as Option from "effect/Option";

/** Decodes the raw `package.json` text into the validated manifest. */
const PackageJsonJson = Schema.fromJsonString(PackageJson);

const make = Effect.fn("make")(function* effect() {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  // ===================================
  // Langauge
  // ===================================

  /**
   * Detects the source code language of the project.
   * @returns The source code language.
   */
  const detectSrcLanguage = () =>
    Effect.fn("detectSrcLanguage")(function* detectSrcLanguage() {
      // Check if tsconfig.json exists
      const tsconfigPath = path.resolve("./tsconfig.json");
      const tsconfigExists = yield* fs.exists(tsconfigPath);
      if (tsconfigExists) {
        return "ts";
      }
      return "js";
    })();

  // ===================================
  // Monorepo
  // ===================================

  /**
   * Detects the root path of the monorepo.
   * @param maxDepth - The maximum depth to check for a monorepo root.
   * @returns The root path of the monorepo.
   */
  const detectMonorepoRootPath = (maxDepth = 10) =>
    Effect.fn("detectMonorepoRootPath")(function* detectMonorepoRootPath() {
      const checkIsMonorepoRoot = (depth: number) =>
        Effect.fn("checkIsMonorepoRoot")(function* checkIsMonorepoRoot() {
          const pathPrefix = relativePathPrefixFromDepth(depth);

          // Check for monorepo indicators
          const isPnpmWorkspace = yield* fs.exists(path.resolve(pathPrefix, "pnpm-workspace.yaml"));
          const isYarnWorkspaces = yield* fs.exists(
            path.resolve(pathPrefix, "yarn.workspaces.json"),
          );
          const isTurboRoot = yield* fs.exists(path.resolve(pathPrefix, "turbo.json"));

          // Check for package.json with workspaces field
          const packageJsonPath = path.resolve(pathPrefix, "package.json");
          const packageJsonExists = yield* fs.exists(packageJsonPath);
          let hasWorkspacesField = false;

          if (packageJsonExists) {
            const packageJson = yield* loadPackageJson(pathPrefix);
            hasWorkspacesField =
              (packageJson.workspaces !== undefined && Array.isArray(packageJson.workspaces)) ||
              (packageJson.workspaces !== undefined && P.isObject(packageJson.workspaces));
          }

          return isPnpmWorkspace || isYarnWorkspaces || isTurboRoot || hasWorkspacesField;
        })();

      const findMonorepoRoot = (depth: number): Effect.Effect<Option.Option<string>, unknown> =>
        depth > maxDepth
          ? Effect.succeed(Option.none())
          : checkIsMonorepoRoot(depth).pipe(
              Effect.flatMap((isMonorepoRoot) =>
                isMonorepoRoot
                  ? Effect.succeed(Option.some(path.resolve(relativePathPrefixFromDepth(depth))))
                  : findMonorepoRoot(depth + 1),
              ),
            );

      return yield* findMonorepoRoot(0);
    })();

  // ===================================
  // Package JSON
  // ===================================

  /**
   * Loads the package.json file from the given base path.
   * @param basePath - The base path to load the package.json file from.
   * @returns The package.json file.
   */
  const loadPackageJson = (basePath = "./") =>
    Effect.fn("loadPackageJson")(function* loadPackageJson() {
      const packageJsonPath = path.resolve(basePath, "package.json");
      const packageJsonExists = yield* fs.exists(packageJsonPath);
      if (!packageJsonExists) {
        return yield* Effect.fail(
          new PackageJsonNotFoundError({
            message: "Package JSON not found in this directory.",
          }),
        );
      }

      const packageJson = yield* fs.readFileString(packageJsonPath);
      return yield* Schema.decodeUnknownEffect(PackageJsonJson)(packageJson).pipe(
        Effect.catchTag("SchemaError", (e) =>
          Effect.fail(
            new InvalidPackageJsonError({
              cause: e,
              message: "Invalid package JSON",
            }),
          ),
        ),
      );
    })().pipe(
      Effect.catchTag("PlatformError", (e) =>
        Effect.fail(
          new FailedToLoadPackageJsonError({
            cause: e,
            message: "Failed to load package JSON",
          }),
        ),
      ),
    );

  // ===================================
  // Package Manager
  // ===================================

  /**
   * Detects the package manager of the project.
   * @param pathPrefix - The path prefix to check for the package manager.
   * @returns The package manager.
   */
  const detectPackageManager = (pathPrefix = "./") =>
    Effect.fn("detectPackageManager")(function* detectPackageManager() {
      // npm
      const packageLockPath = path.resolve(pathPrefix, "package-lock.json");
      const packageLockExists = yield* fs.exists(packageLockPath);
      if (packageLockExists) {
        return "npm";
      }

      // yarn
      const yarnLockPath = path.resolve(pathPrefix, "yarn.lock");
      const yarnLockExists = yield* fs.exists(yarnLockPath);
      if (yarnLockExists) {
        return "yarn";
      }

      // pnpm
      const pnpmLockPath = path.resolve(pathPrefix, "pnpm-lock.yaml");
      const pnpmLockExists = yield* fs.exists(pnpmLockPath);
      if (pnpmLockExists) {
        return "pnpm";
      }

      // bun
      const bunLockPath = path.resolve(pathPrefix, "bun.lockb");
      const bunLockExists = yield* fs.exists(bunLockPath);
      if (bunLockExists) {
        return "bun";
      }

      return yield* Effect.fail(
        new NoPackageManagerFoundError({
          message: "No package manager found in this directory.",
        }),
      );
    })().pipe(
      Effect.catchTag("PlatformError", (e) =>
        Effect.fail(
          new FailedToDetectPackageManagerError({
            cause: e,
            message: "Failed to detect package manager",
          }),
        ),
      ),
    );

  // ===================================
  // Source Directory
  // ===================================

  /**
   * Determines the source directory path for the project.
   *
   * Checks if a './src' directory exists in the current working directory.
   * If it exists, returns the absolute path to './src'.
   * Otherwise, returns the absolute path to the current directory ('./').
   *
   * @returns {Effect.Effect<string, never, FileSystem | Path>} An Effect that yields the resolved source directory path.
   */
  const retrieveSrcDir = () =>
    Effect.fn("retrieveSrcDir")(function* retrieveSrcDir() {
      const srcDir = path.resolve("./src");
      const srcDirExists = yield* fs.exists(srcDir);
      if (srcDirExists) {
        return srcDir;
      }
      return path.resolve("./");
    })();

  // ===================================
  // Voidhash Config
  // ===================================

  const loadVoidhashConfig = () =>
    Effect.fn("loadVoidhashConfig")(function* loadVoidhashConfig() {
      const possibleVoidhashConfigPaths = [
        path.resolve("./voidhash.config.ts"),
        path.resolve("./voidhash.config.js"),
        path.resolve("./voidhash.config.cjs"),
        path.resolve("./voidhash.config.mjs"),
      ];

      const existingPaths = yield* Effect.all(
        possibleVoidhashConfigPaths.map((path) =>
          Effect.fn("existingPaths")(function* existingPaths() {
            const exists = yield* fs.exists(path);
            return { exists, path };
          })(),
        ),
        {
          concurrency: "unbounded",
        },
      );

      const existingPath = existingPaths.find((path) => path.exists)?.path;
      if (!existingPath) {
        return yield* Effect.fail(
          new VoidhashConfigNotFoundError({
            message: "Voidhash config not found",
          }),
        );
      }

      const absolutePath = path.resolve(existingPath);
      const { unregister } = yield* safeRegister();
      // oxlint-disable-next-line effect/noDynamicImports -- loads the user's `voidhash.config` from a path only known at runtime; a static import cannot name a caller-supplied absolute path.
      const required = require(absolutePath);
      unregister();
      const content = required.default ?? required;
      return yield* Schema.decodeUnknownEffect(VoidhashConfig)(content);
    })().pipe(
      Effect.catchTags({
        FailedToLoadJsFileError: (e) =>
          Effect.fail(
            new FailedToLoadVoidhashConfigError({
              cause: e,
              message: "There has been an error while trying to load the voidhash config.",
            }),
          ),
        PlatformError: (e) =>
          Effect.fail(
            new FailedToLoadVoidhashConfigError({
              cause: e,
              message: "Failed to load voidhash config",
            }),
          ),
        SchemaError: () =>
          Effect.fail(
            new InvalidVoidhashConfigError({
              message:
                "Could not parse voidhash config. Please check your voidhash.config.(ts|js|cjs|mjs) file is valid.",
            }),
          ),
      }),
    );

  const deleteVoidhashConfig = () =>
    Effect.fn("deleteVoidhashConfig")(function* deleteVoidhashConfig() {
      const voidhashConfigPath = path.resolve("./voidhash.config.ts");
      yield* fs.remove(voidhashConfigPath);
    })();

  return constant({
    deleteVoidhashConfig,
    detectMonorepoRootPath,
    detectPackageManager,
    detectSrcLanguage,
    loadPackageJson,
    loadVoidhashConfig,
    retrieveSrcDir,
  });
})();

type SourceCodeShape = Effect.Success<typeof make>;

export class SourceCode extends Context.Service<SourceCode, SourceCodeShape>()(
  "voidhash-cli/SourceCode",
) {
  static Default = Layer.effect(SourceCode, make);
}
