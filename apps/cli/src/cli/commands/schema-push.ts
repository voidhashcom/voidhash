import { Command, Options, Prompt } from "@effect/cli";
import { Console, Effect } from "effect";

import { MissingProviderConfigurationError } from "../../domain/errors/schema";
import { Auth } from "../../domain/services/auth";
import { SchemaService, formatChange } from "../../domain/services/schema";
import { SourceCode } from "../../domain/services/source-code";
import { userError } from "../../utils/error-formatter";
import { debugOption } from "../shared-options";

export const schemaPushCommand = Command.make(
  "push",
  {
    debug: debugOption,
    dryRun: Options.boolean("dry-run").pipe(
      Options.withDescription("Preview changes without applying"),
      Options.withDefault(false)
    ),
    yes: Options.boolean("yes").pipe(
      Options.withAlias("y"),
      Options.withDescription("Auto-approve all changes"),
      Options.withDefault(false)
    ),
  },
  ({ dryRun, yes }) =>
    Effect.gen(function* schemaPushCommand() {
      const auth = yield* Auth;
      const sourceCode = yield* SourceCode;
      const schemaService = yield* SchemaService;

      // Authenticate
      yield* auth.getSignedInSession.pipe(
        Effect.catchTag("NoSignedInUserError", () =>
          Effect.fail(
            userError(
              "You must be logged in to push schema. Run 'voidhash auth login' first."
            )
          )
        )
      );

      // Load voidhash.config
      const config = yield* sourceCode
        .loadVoidhashConfig()
        .pipe(
          Effect.catchTag("VoidhashConfigNotFoundError", () =>
            Effect.fail(
              userError(
                "voidhash.config.ts not found. Run 'voidhash init' to create one."
              )
            )
          )
        );

      // Load local schema
      yield* Console.log("Loading local schema...");
      const localSchema = yield* schemaService
        .loadLocalSchema(config.schema)
        .pipe(
          Effect.catchTag("LocalSchemaNotFoundError", (e) =>
            Effect.fail(userError(`Schema file not found: ${e.path}`))
          ),
          Effect.catchTag("LocalSchemaParseError", (e) =>
            Effect.fail(userError(`Failed to parse schema: ${e.message}`))
          )
        );

      yield* Console.log(`  Found ${localSchema.perks.size} perks`);
      yield* Console.log(`  Found ${localSchema.products.size} products`);

      // Fetch remote schema
      yield* Console.log("\nFetching remote schema...");
      const remoteSchema = yield* schemaService
        .fetchRemoteSchema()
        .pipe(
          Effect.catchTag("RemoteSchemaFetchError", (e) =>
            Effect.fail(
              userError(`Failed to fetch remote schema: ${String(e.cause)}`)
            )
          )
        );

      yield* Console.log(`  Found ${remoteSchema.perks.size} perks`);
      yield* Console.log(`  Found ${remoteSchema.products.size} products`);

      // Check provider configurations FIRST
      const providerConfigs = yield* schemaService
        .fetchProviderConfigurations()
        .pipe(
          Effect.catchTag("RemoteSchemaFetchError", (e) =>
            Effect.fail(
              userError(
                `Failed to fetch provider configurations: ${String(e.cause)}`
              )
            )
          )
        );

      const missingProviders = schemaService.checkProviderConfigurations(
        localSchema.enabledProviders,
        providerConfigs
      );

      if (missingProviders.length > 0) {
        yield* Console.log(
          "\nCannot push: Missing payment provider configurations:"
        );
        for (const provider of missingProviders) {
          yield* Console.log(`  - ${provider}`);
        }
        yield* Console.log(
          "\nPlease configure these providers in the dashboard first."
        );
        return yield* Effect.fail(
          new MissingProviderConfigurationError({ providers: missingProviders })
        );
      }

      // Compute diff
      const diff = schemaService.computeDiff(localSchema, remoteSchema);

      // Build changeset (creates + updates only)
      const changeset = schemaService.buildChangeset(diff);

      if (changeset.changes.length === 0) {
        yield* Console.log(
          "\n\u2713 Schema is already in sync. Nothing to push."
        );
        return;
      }

      // Display changes
      yield* Console.log(`\n${changeset.changes.length} changes to push:\n`);
      for (const change of changeset.changes) {
        yield* Console.log(`  ${formatChange(change)}`);
      }

      if (dryRun) {
        yield* Console.log("\n(Dry run - no changes applied)");
        return;
      }

      // Collect approved changes
      const approvedChanges: (typeof changeset.changes)[number][] = [];

      for (const change of changeset.changes) {
        yield* Console.log(`\n${formatChange(change)}`);

        const approved =
          yes ||
          (yield* Prompt.run(
            Prompt.confirm({ initial: true, message: "Apply this change?" })
          ));

        if (approved) {
          approvedChanges.push(change);
          yield* Console.log("  \u2713 Approved");
        } else {
          yield* Console.log("  \u2298 Skipped");
        }
      }

      const skipped = changeset.changes.length - approvedChanges.length;

      if (approvedChanges.length === 0) {
        yield* Console.log("\nNo changes to apply.");
        return;
      }

      // Deploy all approved changes at once
      yield* Console.log(`\nDeploying ${approvedChanges.length} changes...`);
      const result = yield* schemaService
        .deployChangeset({ changes: approvedChanges })
        .pipe(
          Effect.map(() => true),
          Effect.catchTag("ChangeDeploymentError", (e) =>
            Effect.succeed(false).pipe(
              Effect.tap(() =>
                Console.log(`\u2717 Deployment failed: ${String(e.cause)}`)
              )
            )
          )
        );

      if (result) {
        yield* Console.log(
          `\n\u2713 Push complete: ${approvedChanges.length} applied, ${skipped} skipped`
        );
      } else {
        yield* Console.log(
          `\n\u2717 Push failed: 0 applied, ${skipped} skipped`
        );
      }
    }).pipe(
      Effect.catchTags({
        MissingProviderConfigurationError: () => Effect.void,
      })
    )
).pipe(
  Command.withDescription("Push the local Voidhash schema to the server.")
);
