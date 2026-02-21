import { Command, HelpDoc, Options, Prompt, ValidationError } from "@effect/cli";
import { Path } from "@effect/platform";
import { Console, Effect } from "effect";

import { Auth } from "../../domain/services/auth";
import { Codegen } from "../../domain/services/codegen";
import { SchemaService } from "../../domain/services/schema";
import { SourceCode } from "../../domain/services/source-code";
import { debugOption } from "../shared-options";

export const schemaPullCommand = Command.make(
  "pull",
  {
    debug: debugOption,
    force: Options.boolean("force").pipe(
      Options.withDescription("Skip confirmation prompt"),
      Options.withDefault(false)
    ),
  },
  ({ force }) =>
    Effect.gen(function* schemaPullCommand() {
      const auth = yield* Auth;
      const sourceCode = yield* SourceCode;
      const schemaService = yield* SchemaService;
      const codegen = yield* Codegen;
      const pathService = yield* Path.Path;

      // Authenticate
      yield* auth.getSignedInSession.pipe(
        Effect.catchTag("NoSignedInUserError", () =>
          Effect.fail(
            ValidationError.invalidValue(
              HelpDoc.p(
                "You must be logged in to pull schema. Run 'voidhash auth login' first."
              )
            )
          )
        )
      );

      // Load voidhash.config
      const config = yield* sourceCode.loadVoidhashConfig().pipe(
        Effect.catchTag("VoidhashConfigNotFoundError", () =>
          Effect.fail(
            ValidationError.invalidValue(
              HelpDoc.p(
                "voidhash.config.ts not found. Run 'voidhash init' to create one."
              )
            )
          )
        )
      );

      // Fetch remote schema
      yield* Console.log("Fetching remote schema...");
      const remoteSchema = yield* schemaService.fetchRemoteSchema().pipe(
        Effect.catchTag("RemoteSchemaFetchError", (e) =>
          Effect.fail(
            ValidationError.invalidValue(
              HelpDoc.p(`Failed to fetch remote schema: ${String(e.cause)}`)
            )
          )
        )
      );

      // Display summary
      yield* Console.log(`\nRemote schema contains:`);
      yield* Console.log(`  ${remoteSchema.locations.size} paywall locations`);
      yield* Console.log(`  ${remoteSchema.perks.size} perks`);
      yield* Console.log(`  ${remoteSchema.products.size} products`);
      yield* Console.log(
        `  Providers: ${[...remoteSchema.enabledProviders].join(", ") || "none"}`
      );

      if (
        remoteSchema.locations.size === 0 &&
        remoteSchema.perks.size === 0 &&
        remoteSchema.products.size === 0
      ) {
        yield* Console.log(
          "\nRemote schema is empty. Nothing to pull."
        );
        return;
      }

      // Confirm unless --force
      if (!force) {
        const confirmed = yield* Prompt.run(
          Prompt.confirm({
            message: `This will overwrite ${config.schema}. Continue?`,
          })
        );
        if (!confirmed) {
          yield* Console.log("Pull cancelled.");
          return;
        }
      }

      // Generate schema file
      const schemaPath = pathService.resolve(config.schema);
      yield* codegen.generateSchemaFile(schemaPath, remoteSchema);

      yield* Console.log(`\n\u2713 Schema pulled to ${config.schema}`);
    })
).pipe(Command.withDescription("Pull the Voidhash schema from the server."));
