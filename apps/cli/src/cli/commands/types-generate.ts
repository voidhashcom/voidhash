import { Command, Flag } from "effect/cli";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";

import { resolveTypesOutput } from "../../domain/schema/voidhash-config";
import { Codegen, typedSdkPackagesOf } from "../../domain/services/codegen";
import { GeneratedFeatureFlag, SchemaService } from "../../domain/services/schema";
import { SourceCode } from "../../domain/services/source-code";
import { userError } from "../../utils/error-formatter";
import { projectNamedBy, signedInSession } from "../context";

/**
 * `voidhash-cli types generate [--watch]`
 *
 * Fetches the schema and the feature flags from the server and emits
 * `voidhash.gen.d.ts` (path configurable via `voidhash.config.ts#typesOutput`)
 * for the Voidhash SDKs the app's `package.json` depends on. With `--watch`,
 * polls `GET /schema/version` every `pollIntervalMs` (default 5s) and the
 * flags every {@link FLAGS_POLL_INTERVAL_MS} at most, and regenerates when
 * either changed.
 */
/**
 * How often `--watch` reads the flags at most. The schema version does not
 * cover them, and reading them costs a request per text flag, so they are
 * read less often than the version.
 */
const FLAGS_POLL_INTERVAL_MS = 30_000;

export const typesGenerateCommand = Command.make(
  "generate",
  {
    pollIntervalMs: Flag.Int("poll-interval-ms").pipe(
      Flag.withDescription("Polling interval for --watch mode, in milliseconds"),
      Flag.withDefault(5000),
    ),
    watch: Flag.Boolean("watch").pipe(
      Flag.withDescription("Watch the server schema and regenerate types when it changes"),
      Flag.withDefault(false),
    ),
  },
  ({ pollIntervalMs, watch }) =>
    Effect.gen(function* typesGenerateCommand() {
      const sourceCode = yield* SourceCode;
      const schemaService = yield* SchemaService;
      const codegen = yield* Codegen;
      const pathService = yield* Path.Path;

      const session = yield* signedInSession;

      const config = yield* sourceCode
        .loadVoidhashConfig()
        .pipe(
          Effect.catchTag("VoidhashConfigNotFoundError", () =>
            Effect.fail(
              userError("voidhash.config.ts not found. Run 'voidhash-cli init' to create one."),
            ),
          ),
        );

      const { project } = yield* projectNamedBy(config, session);
      const typesOutput = resolveTypesOutput(config);
      const outPath = pathService.resolve(typesOutput);

      const packageJson = yield* sourceCode.loadPackageJson().pipe(
        Effect.map(Option.some),
        Effect.catchTag("PackageJsonNotFoundError", () => Effect.succeed(Option.none())),
        Effect.catchTag(["InvalidPackageJsonError", "FailedToLoadPackageJsonError"], (e) =>
          Effect.fail(userError(`Could not read package.json: ${e.message}`)),
        ),
      );
      const packages = typedSdkPackagesOf(packageJson);

      const fetchFlags = schemaService
        .fetchFeatureFlags(project.id)
        .pipe(
          Effect.catchTag("RemoteSchemaFetchError", (e) =>
            Effect.fail(userError(`Failed to fetch feature flags: ${String(e.cause)}`)),
          ),
        );

      /** What the declaration file says about the flags, to notice a change in --watch. */
      const flagsFingerprint = Schema.encodeSync(
        Schema.fromJsonString(Schema.Array(GeneratedFeatureFlag)),
      );

      /** Writes the file; `knownFlags` are flags a poll just read, so they are not read again. */
      const regenerate = Effect.fn("regenerate")(function* regenerate(
        knownFlags: Option.Option<ReadonlyArray<GeneratedFeatureFlag>>,
      ) {
        yield* Console.log("Fetching remote schema...");
        const [{ schema, version }, flags] = yield* Effect.all(
          [
            schemaService
              .fetchRemoteSchema(project.id)
              .pipe(
                Effect.catchTag("RemoteSchemaFetchError", (e) =>
                  Effect.fail(userError(`Failed to fetch remote schema: ${String(e.cause)}`)),
                ),
              ),
            Option.match(knownFlags, { onNone: () => fetchFlags, onSome: Effect.succeed }),
          ],
          { concurrency: 2 },
        );

        yield* codegen.generateTypesDeclarationFile(outPath, schema, version, {
          flags,
          packages,
        });

        yield* Console.log(
          `✓ Types written to ${typesOutput} for ${packages.join(" and ")} (version ${version.slice(0, 19)}..., ${flags.length} flags)`,
        );
        return { flags: flagsFingerprint(flags), version };
      });

      const initial = yield* regenerate(Option.none());

      if (!watch) {
        return;
      }

      yield* Console.log(
        `\nWatching for schema changes (poll every ${pollIntervalMs}ms). Press Ctrl+C to stop.`,
      );

      // Keep the last known schema version and flags in a closure-shared ref
      // so the poll loop can compare and skip work when neither changed. The
      // schema version does not cover flags, so every few polls read them too.
      let last = initial;
      let polls = 0;
      const pollsPerFlagsRead = Math.max(1, Math.ceil(FLAGS_POLL_INTERVAL_MS / pollIntervalMs));

      const pollOnce = Effect.fn("pollOnce")(function* pollOnce() {
        polls += 1;
        const readsFlags = polls % pollsPerFlagsRead === 0;
        const latest = yield* Effect.all(
          [
            schemaService.fetchSchemaVersion(project.id),
            readsFlags ? Effect.map(fetchFlags, Option.some) : Effect.succeed(Option.none()),
          ],
          { concurrency: 2 },
        ).pipe(
          Effect.catch((e) =>
            Effect.logWarning(
              `[voidhash-cli types --watch] Skipping poll due to error: ${String(e)}`,
            ).pipe(Effect.as(null)),
          ),
        );
        if (latest === null) return;

        const [version, flags] = latest;
        const flagsChanged = Option.exists(flags, (read) => flagsFingerprint(read) !== last.flags);
        if (version === last.version && !flagsChanged) return;

        yield* Console.log(
          version === last.version
            ? "Feature flags changed on server — regenerating types..."
            : "Schema changed on server — regenerating types...",
        );
        const next = yield* regenerate(flags).pipe(
          Effect.catch((e) =>
            Effect.logWarning(
              `[voidhash-cli types --watch] Regeneration failed: ${String(e)}`,
            ).pipe(Effect.as(null)),
          ),
        );
        if (next !== null) {
          last = next;
        }
      })();

      yield* Effect.repeat(pollOnce, Schedule.spaced(`${pollIntervalMs} millis`));
    }),
).pipe(
  Command.withDescription(
    "Generate the voidhash.gen.d.ts declaration file from the server schema.",
  ),
);
