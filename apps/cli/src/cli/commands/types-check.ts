import { Command } from "effect/cli";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as Option from "effect/Option";

import { SchemaCheckFailedError } from "../../domain/errors/schema";
import { resolveTypesOutput } from "../../domain/schema/voidhash-config";
import { Codegen } from "../../domain/services/codegen";
import { SchemaService } from "../../domain/services/schema";
import { SourceCode } from "../../domain/services/source-code";
import { userError } from "../../utils/error-formatter";
import { projectNamedBy, signedInSession } from "../context";

/**
 * `voidhash-cli types check`
 *
 * CI gate. Compares the `@voidhash:version` header inside the local
 * `voidhash.gen.d.ts` against the server's current schema version. Exits
 * non-zero with a clear message when they diverge, so a stale commit can't
 * pass PR CI.
 */
export const typesCheckCommand = Command.make("check", {}, () =>
  Effect.gen(function* typesCheckCommand() {
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

    const localVersion = yield* codegen
      .readDeclarationVersion(outPath)
      .pipe(
        Effect.catch(() =>
          Effect.fail(
            userError(
              `Could not read generated types at ${typesOutput}. Run 'voidhash-cli types generate' first.`,
            ),
          ),
        ),
      );

    if (Option.isNone(localVersion)) {
      return yield* Effect.fail(
        userError(
          `${typesOutput} is missing the @voidhash:version header. Re-run 'voidhash-cli types generate' to regenerate.`,
        ),
      );
    }
    const localVersionValue = localVersion.value;

    const remoteVersion = yield* schemaService
      .fetchSchemaVersion(project.id)
      .pipe(
        Effect.catchTag("RemoteSchemaFetchError", (e) =>
          Effect.fail(userError(`Failed to fetch remote schema version: ${String(e.cause)}`)),
        ),
      );

    if (localVersionValue === remoteVersion) {
      yield* Console.log(`✓ Types are up to date (version ${localVersionValue.slice(0, 19)}...)`);
      return;
    }

    yield* Console.log("✗ Types are stale.");
    yield* Console.log(`  Local:  ${localVersionValue}`);
    yield* Console.log(`  Server: ${remoteVersion}`);
    yield* Console.log(
      "\nRun 'voidhash-cli types generate' to refresh, then commit the updated declaration file.",
    );

    return yield* Effect.fail(
      new SchemaCheckFailedError({
        message: `Local types version ${localVersionValue} does not match server version ${remoteVersion}`,
      }),
    );
  }),
).pipe(
  Command.withDescription(
    "Check whether the locally generated types are in sync with the server schema.",
  ),
);
