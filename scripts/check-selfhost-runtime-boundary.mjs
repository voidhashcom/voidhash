import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Data, Effect, FileSystem, Option, Path, Schema, Stdio } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const forbiddenPackages = new Set([
  "alchemy",
  "cloudflare",
  "miniflare",
  "workerd",
  "wrangler",
  "@distilled.cloud/cloudflare",
  "@distilled.cloud/cloudflare-rolldown-plugin",
  "@distilled.cloud/cloudflare-runtime",
  "@distilled.cloud/cloudflare-vite-plugin",
]);

// Types-only packages carry no runtime cloud coupling. `@cloudflare/workers-types`
// reaches the prod tree as an optional peer of better-auth's kysely adapter and
// contains nothing but declaration files.
const allowedTypeOnlyPackages = new Set(["@cloudflare/workers-types"]);

class MissingDeploymentError extends Data.TaggedError("MissingDeploymentError") {}

class ForbiddenPackagesError extends Data.TaggedError("ForbiddenPackagesError") {}

class DeploymentInstallError extends Data.TaggedError("DeploymentInstallError") {}

const PackageManifest = Schema.Struct({
  name: Schema.optional(Schema.String),
  version: Schema.optional(Schema.String),
});

const decodeManifest = Schema.decodeUnknownEffect(Schema.fromJsonString(PackageManifest));

const isForbidden = (name) =>
  !allowedTypeOnlyPackages.has(name) &&
  (forbiddenPackages.has(name) || name.startsWith("@cloudflare/"));

const manifestVersion = (manifest) => {
  if (manifest.version === undefined) return "unknown";
  return manifest.version;
};

/**
 * Reports whether `candidate` resolves to a directory, treating unreadable
 * entries (for example dangling symlinks) as non-directories.
 */
const isDirectory = (candidate) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const info = yield* fs.stat(candidate);
    return info.type === "Directory";
  }).pipe(Effect.orElseSucceed(() => false));

const readPackage = (packageDirectory, installed) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const manifestPath = path.join(packageDirectory, "package.json");
    if (!(yield* fs.exists(manifestPath))) return;
    const contents = yield* fs.readFileString(manifestPath, "utf8");
    // A manifest we cannot decode carries no usable identity, so it is skipped
    // exactly like one without a `name`.
    const manifest = yield* Effect.option(decodeManifest(contents));
    if (Option.isNone(manifest)) return;
    if (manifest.value.name === undefined) return;
    const realPath = yield* fs.realPath(packageDirectory);
    installed.set(realPath, {
      name: manifest.value.name,
      version: manifestVersion(manifest.value),
    });
  });

const scanPackageDirectory = (nodeModulesDirectory, installed) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    if (!(yield* fs.exists(nodeModulesDirectory))) return;
    for (const entryName of yield* fs.readDirectory(nodeModulesDirectory)) {
      if (entryName.startsWith(".")) continue;
      const entryPath = path.join(nodeModulesDirectory, entryName);
      if (entryName.startsWith("@")) {
        if (!(yield* isDirectory(entryPath))) continue;
        for (const scopedEntry of yield* fs.readDirectory(entryPath)) {
          yield* readPackage(path.join(entryPath, scopedEntry), installed);
        }
        continue;
      }
      yield* readPackage(entryPath, installed);
    }
  });

const inspectDeployment = (deploymentRoot) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const nodeModulesDirectory = path.join(deploymentRoot, "node_modules");
    const virtualStoreDirectory = path.join(nodeModulesDirectory, ".pnpm");
    if (!(yield* fs.exists(virtualStoreDirectory))) {
      return yield* new MissingDeploymentError({
        message: `No pnpm deployment found at ${deploymentRoot}`,
      });
    }

    const installed = new Map();
    yield* scanPackageDirectory(nodeModulesDirectory, installed);
    for (const entryName of yield* fs.readDirectory(virtualStoreDirectory)) {
      if (entryName === "node_modules") continue;
      const entryPath = path.join(virtualStoreDirectory, entryName);
      if (!(yield* isDirectory(entryPath))) continue;
      yield* scanPackageDirectory(path.join(entryPath, "node_modules"), installed);
    }

    const forbidden = [...installed.values()]
      .filter((pkg) => isForbidden(pkg.name))
      .sort((left, right) => left.name.localeCompare(right.name));
    if (forbidden.length > 0) {
      return yield* new ForbiddenPackagesError({
        message: `Self-host deployment contains cloud-only packages:\n${forbidden
          .map((pkg) => `- ${pkg.name}@${pkg.version}`)
          .join("\n")}`,
      });
    }
    yield* Console.log(
      `Self-host runtime boundary OK — ${installed.size} installed packages checked.`,
    );
  });

const deployAndInspect = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const deploymentRoot = yield* fs.makeTempDirectoryScoped({
    prefix: "voidhash-selfhost-boundary-",
  });
  const exitCode = yield* spawner.exitCode(
    ChildProcess.make(
      "corepack",
      [
        "pnpm@11.1.3",
        "--config.ignore-scripts=true",
        "--config.node-linker=isolated",
        "--config.block-exotic-subdeps=false",
        "--filter",
        "@voidhash/backend-app",
        "deploy",
        "--prod",
        "--legacy",
        deploymentRoot,
      ],
      { stdin: "inherit", stdout: "inherit", stderr: "inherit" },
    ),
  );
  if (exitCode !== 0) {
    return yield* new DeploymentInstallError({
      message: `pnpm deploy failed with exit code ${exitCode}`,
    });
  }
  yield* inspectDeployment(deploymentRoot);
});

const main = Effect.gen(function* () {
  const path = yield* Path.Path;
  const stdio = yield* Stdio.Stdio;
  const [requestedDeployment] = yield* stdio.args;
  if (requestedDeployment) {
    return yield* inspectDeployment(path.resolve(requestedDeployment));
  }
  yield* deployAndInspect;
});

NodeRuntime.runMain(main.pipe(Effect.scoped, Effect.provide(NodeServices.layer)));
