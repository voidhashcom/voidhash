import { Command, Flag } from "effect/unstable/cli";
import { Console, Effect, Path, Schedule } from "effect";

import { resolveTypesOutput } from "../../domain/schema/voidhash-config";
import { Auth } from "../../domain/services/auth";
import { Codegen } from "../../domain/services/codegen";
import { SchemaService } from "../../domain/services/schema";
import { SourceCode } from "../../domain/services/source-code";
import { userError } from "../../utils/error-formatter";

/**
 * `voidhash-cli types generate [--watch]`
 *
 * Fetches the schema from the server and emits `voidhash.gen.d.ts` (path
 * configurable via `voidhash.config.ts#typesOutput`). With `--watch`, polls
 * `GET /schema/version` every `pollIntervalMs` (default 5s) and regenerates
 * on hash change.
 */
export const typesGenerateCommand = Command.make(
  "generate",
  {
    pollIntervalMs: Flag.integer("poll-interval-ms").pipe(
      Flag.withDescription(
        "Polling interval for --watch mode, in milliseconds"
      ),
      Flag.withDefault(5000)
    ),
    watch: Flag.boolean("watch").pipe(
      Flag.withDescription(
        "Watch the server schema and regenerate types when it changes"
      ),
      Flag.withDefault(false)
    ),
  },
  ({ pollIntervalMs, watch }) =>
    Effect.gen(function* typesGenerateCommand() {
      const auth = yield* Auth;
      const sourceCode = yield* SourceCode;
      const schemaService = yield* SchemaService;
      const codegen = yield* Codegen;
      const pathService = yield* Path.Path;

      yield* auth.getSignedInSession.pipe(
        Effect.catchTag("NoSignedInUserError", () =>
          Effect.fail(
            userError(
              "You must be logged in to generate types. Run 'voidhash-cli auth login' first."
            )
          )
        )
      );

      const config = yield* sourceCode.loadVoidhashConfig().pipe(
        Effect.catchTag("VoidhashConfigNotFoundError", () =>
          Effect.fail(
            userError(
              "voidhash.config.ts not found. Run 'voidhash-cli init' to create one."
            )
          )
        )
      );

      const typesOutput = resolveTypesOutput(config);
      const outPath = pathService.resolve(typesOutput);

      const regenerate = Effect.gen(function* regenerate() {
        yield* Console.log("Fetching remote schema...");
        const { schema, version } = yield* schemaService
          .fetchRemoteSchema()
          .pipe(
            Effect.catchTag("RemoteSchemaFetchError", (e) =>
              Effect.fail(
                userError(`Failed to fetch remote schema: ${String(e.cause)}`)
              )
            )
          );

        yield* codegen.generateTypesDeclarationFile(outPath, schema, version);

        yield* Console.log(
          `✓ Types written to ${typesOutput} (version ${version.slice(
            0,
            19
          )}...)`
        );
        return version;
      });

      const initialVersion = yield* regenerate;

      if (!watch) {
        return;
      }

      yield* Console.log(
        `\nWatching for schema changes (poll every ${pollIntervalMs}ms). Press Ctrl+C to stop.`
      );

      // Keep the last known version in a closure-shared ref so the poll loop
      // can compare and skip work when the schema hasn't changed.
      let lastVersion = initialVersion;

      const pollOnce = Effect.gen(function* pollOnce() {
        const latest = yield* schemaService.fetchSchemaVersion().pipe(
          Effect.catch((e) =>
            Effect.logWarning(
              `[voidhash-cli types --watch] Skipping poll due to error: ${String(e)}`
            ).pipe(Effect.as(null))
          )
        );

        if (latest === null || latest === lastVersion) {
          return;
        }

        yield* Console.log("Schema changed on server — regenerating types...");
        const next = yield* regenerate.pipe(
          Effect.catch((e) =>
            Effect.logWarning(
              `[voidhash-cli types --watch] Regeneration failed: ${String(e)}`
            ).pipe(Effect.as(null))
          )
        );
        if (next !== null) {
          lastVersion = next;
        }
      });

      yield* Effect.repeat(
        pollOnce,
        Schedule.spaced(`${pollIntervalMs} millis`)
      );
    })
).pipe(
  Command.withDescription(
    "Generate the voidhash.gen.d.ts declaration file from the server schema."
  )
);
