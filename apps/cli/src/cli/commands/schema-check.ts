import { Command } from "@effect/cli";
import { Console, Effect } from "effect";

import {
  MissingProviderConfigurationError,
  SchemaCheckFailedError,
} from "../../domain/errors/schema";
import { Auth } from "../../domain/services/auth";
import { SchemaService } from "../../domain/services/schema";
import { SourceCode } from "../../domain/services/source-code";
import { userError } from "../../utils/error-formatter";
import { debugOption } from "../shared-options";

export const schemaCheckCommand = Command.make("check", { debug: debugOption }, () =>
  Effect.gen(function* schemaCheckCommand() {
    const auth = yield* Auth;
    const sourceCode = yield* SourceCode;
    const schemaService = yield* SchemaService;

    // Authenticate
    yield* auth.getSignedInSession.pipe(
      Effect.catchTag("NoSignedInUserError", () =>
        Effect.fail(
          userError(
            "You must be logged in to check schema. Run 'voidhash auth login' first."
          )
        )
      )
    );

    // Load voidhash.config
    const config = yield* sourceCode.loadVoidhashConfig().pipe(
      Effect.catchTag("VoidhashConfigNotFoundError", () =>
        Effect.fail(
          userError("voidhash.config.ts not found. Run 'voidhash init' to create one.")
        )
      )
    );

    // Load local schema
    yield* Console.log("Loading local schema...");
    const localSchema = yield* schemaService.loadLocalSchema(config.schema).pipe(
      Effect.catchTag("LocalSchemaNotFoundError", (e) =>
        Effect.fail(userError(`Schema file not found: ${e.path}`))
      ),
      Effect.catchTag("LocalSchemaParseError", (e) =>
        Effect.fail(userError(`Failed to parse schema: ${e.message}`))
      )
    );

    yield* Console.log(`  Found ${localSchema.perks.size} perks`);
    yield* Console.log(`  Found ${localSchema.products.size} products`);
    yield* Console.log(
      `  Providers: ${[...localSchema.enabledProviders].join(", ") || "none"}`
    );

    // Fetch remote schema
    yield* Console.log("\nFetching remote schema...");
    const remoteSchema = yield* schemaService.fetchRemoteSchema().pipe(
      Effect.catchTag("RemoteSchemaFetchError", (e) =>
        Effect.fail(userError(`Failed to fetch remote schema: ${String(e.cause)}`))
      )
    );

    yield* Console.log(`  Found ${remoteSchema.perks.size} perks`);
    yield* Console.log(`  Found ${remoteSchema.products.size} products`);

    // Check provider configurations
    const providerConfigs = yield* schemaService.fetchProviderConfigurations().pipe(
      Effect.catchTag("RemoteSchemaFetchError", (e) =>
        Effect.fail(
          userError(`Failed to fetch provider configurations: ${String(e.cause)}`)
        )
      )
    );

    const missingProviders = schemaService.checkProviderConfigurations(
      localSchema.enabledProviders,
      providerConfigs
    );

    if (missingProviders.length > 0) {
      yield* Console.log("\nMissing payment provider configurations:");
      for (const provider of missingProviders) {
        yield* Console.log(`  - ${provider}`);
      }
      yield* Console.log(
        "\nPlease configure these providers in the dashboard before pushing."
      );
      return yield* Effect.fail(
        new MissingProviderConfigurationError({ providers: missingProviders })
      );
    }

    // Compute diff
    const diff = schemaService.computeDiff(localSchema, remoteSchema);
    const summary = schemaService.summarizeDiff(diff);

    // Check results
    const issues: string[] = [];

    if (diff.perks.toCreate.length > 0) {
      issues.push(`${diff.perks.toCreate.length} perks missing from server`);
      yield* Console.log("\nMissing perks:");
      for (const perk of diff.perks.toCreate) {
        yield* Console.log(`  + ${perk.slug} ("${perk.name}")`);
      }
    }

    if (diff.products.toCreate.length > 0) {
      issues.push(`${diff.products.toCreate.length} products missing from server`);
      yield* Console.log("\nMissing products:");
      for (const product of diff.products.toCreate) {
        yield* Console.log(`  + ${product.slug} ("${product.name}")`);
      }
    }

    if (diff.perks.toUpdate.length > 0) {
      issues.push(`${diff.perks.toUpdate.length} perks need updating`);
      yield* Console.log("\nOutdated perks:");
      for (const { local, remote } of diff.perks.toUpdate) {
        yield* Console.log(`  ~ ${local.slug}: "${remote.name}" -> "${local.name}"`);
      }
    }

    if (diff.products.toUpdate.length > 0) {
      issues.push(`${diff.products.toUpdate.length} products need updating`);
      yield* Console.log("\nOutdated products:");
      for (const { local, remote } of diff.products.toUpdate) {
        yield* Console.log(`  ~ ${local.slug}: "${remote.name}" -> "${local.name}"`);
      }
    }

    if (issues.length === 0) {
      yield* Console.log(
        "\n\u2713 All local schema entities exist on the server and are up to date."
      );
      return;
    }

    yield* Console.log(`\n\u2717 Schema check failed: ${issues.join(", ")}`);
    yield* Console.log("\nRun 'voidhash schema push' to sync these changes.");

    return yield* Effect.fail(
      new SchemaCheckFailedError({
        message: `Schema check failed: ${issues.join(", ")}`,
      })
    );
  }).pipe(
    Effect.catchTags({
      MissingProviderConfigurationError: () => Effect.void,
      SchemaCheckFailedError: () => Effect.void,
    })
  )
).pipe(Command.withDescription("Check that the server contains all local schema entities."));
