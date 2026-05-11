import { Command } from "effect/unstable/cli";
import { Console, Effect, Path } from "effect";

import { SchemaCheckFailedError } from "../../domain/errors/schema";
import { resolveTypesOutput } from "../../domain/schema/voidhash-config";
import { Auth } from "../../domain/services/auth";
import { Codegen } from "../../domain/services/codegen";
import { SchemaService } from "../../domain/services/schema";
import { SourceCode } from "../../domain/services/source-code";
import { userError } from "../../utils/error-formatter";

/**
 * `voidhash types check`
 *
 * CI gate. Compares the `@voidhash:version` header inside the local
 * `voidhash.gen.d.ts` against the server's current schema version. Exits
 * non-zero with a clear message when they diverge, so a stale commit can't
 * pass PR CI.
 */
export const typesCheckCommand = Command.make(
  "check",
  {},
  () =>
    Effect.gen(function* typesCheckCommand() {
      const auth = yield* Auth;
      const sourceCode = yield* SourceCode;
      const schemaService = yield* SchemaService;
      const codegen = yield* Codegen;
      const pathService = yield* Path.Path;

      yield* auth.getSignedInSession.pipe(
        Effect.catchTag("NoSignedInUserError", () =>
          Effect.fail(
            userError(
              "You must be logged in to check types. Run 'voidhash auth login' first."
            )
          )
        )
      );

      const config = yield* sourceCode.loadVoidhashConfig().pipe(
        Effect.catchTag("VoidhashConfigNotFoundError", () =>
          Effect.fail(
            userError(
              "voidhash.config.ts not found. Run 'voidhash init' to create one."
            )
          )
        )
      );

      const typesOutput = resolveTypesOutput(config);
      const outPath = pathService.resolve(typesOutput);

      const localVersion = yield* codegen.readDeclarationVersion(outPath).pipe(
        Effect.catch(() =>
          Effect.fail(
            userError(
              `Could not read generated types at ${typesOutput}. Run 'voidhash types generate' first.`
            )
          )
        )
      );

      if (localVersion === null) {
        return yield* Effect.fail(
          userError(
            `${typesOutput} is missing the @voidhash:version header. Re-run 'voidhash types generate' to regenerate.`
          )
        );
      }

      const remoteVersion = yield* schemaService.fetchSchemaVersion().pipe(
        Effect.catchTag("RemoteSchemaFetchError", (e) =>
          Effect.fail(
            userError(
              `Failed to fetch remote schema version: ${String(e.cause)}`
            )
          )
        )
      );

      if (localVersion === remoteVersion) {
        yield* Console.log(
          `✓ Types are up to date (version ${localVersion.slice(0, 19)}...)`
        );
        return;
      }

      yield* Console.log("✗ Types are stale.");
      yield* Console.log(`  Local:  ${localVersion}`);
      yield* Console.log(`  Server: ${remoteVersion}`);
      yield* Console.log(
        "\nRun 'voidhash types generate' to refresh, then commit the updated declaration file."
      );

      return yield* Effect.fail(
        new SchemaCheckFailedError({
          message: `Local types version ${localVersion} does not match server version ${remoteVersion}`,
        })
      );
    })
).pipe(
  Command.withDescription(
    "Check whether the locally generated types are in sync with the server schema."
  )
);
