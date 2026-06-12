import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Console, Effect, Path } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import {
  type BuildPaywallsResult,
  buildPaywalls,
} from "../../domain/services/paywall-build";
import {
  type UploadPaywallDeployResult,
  uploadPaywallDeploy,
} from "../../domain/services/paywall-deploy-upload";
import { SourceCode } from "../../domain/services/source-code";
import { userError } from "../../utils/error-formatter";

const formatBytes = (bytes: number): string =>
  bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;

const reportBuild = ({ manifest, outDir, manifestPath }: BuildPaywallsResult) =>
  Effect.gen(function* reportBuild() {
    yield* Console.log(
      `\nBuilt ${manifest.paywalls.length} paywall(s) and ` +
        `${manifest.components.length} component(s) for ` +
        `${manifest.team}/${manifest.project}:\n`,
    );
    for (const paywall of manifest.paywalls) {
      const size = paywall.artifacts.html.bytes + paywall.artifacts.js.bytes;
      yield* Console.log(
        `  • ${paywall.title} (${paywall.id})\n` +
          `      hash    ${paywall.contentHash.slice(0, 12)}\n` +
          `      bundle  ${formatBytes(size)}` +
          (paywall.assets.length ? `, ${paywall.assets.length} asset(s)` : ""),
      );
    }
    for (const component of manifest.components) {
      yield* Console.log(
        `  • ${component.title ?? component.id} (${component.id}, component)\n` +
          `      hash     ${component.contentHash.slice(0, 12)}\n` +
          `      runtime  ${formatBytes(component.artifacts.runtime.bytes)}, ` +
          `${component.previews.length} preview(s)` +
          (component.artifacts.panel ? ", custom panel" : ""),
      );
    }
    yield* Console.log(`\n  ${manifest.assets.length} asset(s)`);
    yield* Console.log(`  Output:   ${outDir}`);
    yield* Console.log(`  Manifest: ${manifestPath}`);
  });

const reportDeploy = (result: UploadPaywallDeployResult) =>
  Effect.gen(function* reportDeploy() {
    yield* Console.log(
      `\nDeploy ${result.deployId} is ${result.finalize.status} ` +
        `(${result.uploadedCount} blob(s) uploaded, ${result.cachedCount} reused).`,
    );
    if (result.finalize.paywalls.length > 0) {
      yield* Console.log("\nPaywalls:");
      for (const paywall of result.finalize.paywalls) {
        yield* Console.log(
          `  • ${paywall.id}  v${paywall.version}\n      ${paywall.url}`,
        );
      }
    }
    if (result.finalize.components.length > 0) {
      yield* Console.log("\nComponents:");
      for (const component of result.finalize.components) {
        yield* Console.log(`  • ${component.id}  v${component.version}`);
      }
    }
  });

/**
 * `voidhash-cli deploy [--dry-run]`
 *
 * Builds every paywall and component in `.voidhash` into the content-addressed
 * schemaVersion-2 deploy payload, then runs the contract-§4 upload flow:
 * create the deploy from the manifest, upload missing blobs, finalize, and
 * print the released paywall URLs/versions. `--dry-run` stops after the build.
 */
export const deployCommand = Command.make(
  "deploy",
  {
    dryRun: Flag.boolean("dry-run").pipe(
      Flag.withDescription("Build the deploy payload without uploading it"),
      Flag.withDefault(false),
    ),
  },
  ({ dryRun }) =>
    Effect.gen(function* deployCommand() {
      const sourceCode = yield* SourceCode;
      const path = yield* Path.Path;

      const config = yield* sourceCode
        .loadVoidhashConfig()
        .pipe(
          Effect.catchTag("VoidhashConfigNotFoundError", () =>
            Effect.fail(
              userError(
                "voidhash.config.ts not found. Run 'voidhash-cli init' to create one.",
              ),
            ),
          ),
        );

      const projectRoot = path.resolve(".");
      const cliVersion = process.env.VOIDHASH_CLI_VERSION ?? "0.0.0";

      // Best-effort: stamp the @voidhash/paywalls version the bundle was built
      // against, resolved from the user's project. The package's exports map
      // does not expose ./package.json, so walk up from the resolved entry.
      const runtimeVersion = yield* Effect.try({
        try: () => {
          const entry = require.resolve("@voidhash/paywalls", {
            paths: [projectRoot],
          });
          for (
            let dir = dirname(entry);
            dir !== dirname(dir);
            dir = dirname(dir)
          ) {
            const pkgPath = join(dir, "package.json");
            if (existsSync(pkgPath)) {
              const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
                name?: string;
                version?: string;
              };
              if (
                pkg.name === "@voidhash/paywalls" &&
                typeof pkg.version === "string"
              ) {
                return pkg.version;
              }
            }
          }
          throw new Error("@voidhash/paywalls package.json not found");
        },
        catch: (cause) => cause,
      }).pipe(Effect.orElseSucceed(() => "unknown"));

      yield* Console.log("Building paywalls…");

      const result = yield* buildPaywalls({
        cliVersion,
        onWarn: (message) => Console.log(`  Warning: ${message}`),
        project: config.project,
        projectRoot,
        runtimeVersion,
        team: config.team,
      }).pipe(
        Effect.catchTag("PaywallBuildError", (e) =>
          Effect.fail(userError(e.message)).pipe(
            Effect.tapError(() => Effect.logDebug(e.cause)),
          ),
        ),
      );

      yield* reportBuild(result);

      if (dryRun) {
        yield* Console.log("\nDry run — nothing uploaded.");
        return;
      }

      yield* Console.log("\nDeploying…");

      const deployed = yield* uploadPaywallDeploy({
        manifest: result.manifest,
        onProgress: (message) => Console.log(`  ${message}`),
        projectRoot,
      }).pipe(
        Effect.catchTag("PaywallDeployUploadError", (e) =>
          Effect.fail(userError(e.message)).pipe(
            Effect.tapError(() => Effect.logDebug(e.cause)),
          ),
        ),
      );

      yield* reportDeploy(deployed);
    }),
).pipe(Command.withDescription("Build and deploy paywalls to Voidhash."));
