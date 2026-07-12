import { Console, Effect, Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { parseSchema, serializeSchema, type SchemaObject } from "@voidhash/mimic-core";
import { analyzeMigration } from "@voidhash/mimic-server/migrate";
import { MimicSDK } from "@voidhash/mimic-server/effect";
import * as readline from "node:readline";

import { ConfigLoader } from "../../services/ConfigLoader.js";
import type {
  CompiledMigrationChange,
  CompiledMigrationFile,
  CompiledUpdateMigrationChange,
} from "../../services/MigrationLoader.js";
import { MigrationBundler } from "../../services/MigrationBundler.js";
import { MigrationLoader } from "../../services/MigrationLoader.js";

const confirm = (message: string): Effect.Effect<boolean> =>
  Effect.callback<boolean>((resume) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close();
      resume(Effect.succeed(answer.trim().toLowerCase() === "y"));
    });
  });

const schemasEqual = (left: SchemaObject | undefined, right: SchemaObject | undefined): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const assertValidVersionSequence = (
  migrations: readonly CompiledMigrationFile[],
): Effect.Effect<void, Error> =>
  Effect.sync(() => {
    let expected = 1;
    for (const migration of migrations) {
      if (migration.version !== expected) {
        throw new Error(
          `Expected migration version ${expected}, found ${migration.version} in "${migration.filePath}".`,
        );
      }
      expected += 1;
    }
  });

const canUseCustomMigration = (change: CompiledUpdateMigrationChange): boolean =>
  change.dataMigrationSource !== undefined;

const validateLocalMigrations = (
  migrations: readonly CompiledMigrationFile[],
): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    yield* assertValidVersionSequence(migrations);

    const state = new Map<
      string,
      { readonly schema: SchemaObject; readonly parsedSchema: ReturnType<typeof parseSchema> }
    >();

    for (const migration of migrations) {
      for (const change of migration.changes) {
        if (change.type === "create") {
          if (state.has(change.collection)) {
            return yield* Effect.fail(
              new Error(
                `Migration ${migration.version} tries to create collection "${change.collection}" twice.`,
              ),
            );
          }
          const schema = serializeSchema(parseSchema(change.schema));
          state.set(change.collection, {
            schema,
            parsedSchema: parseSchema(schema),
          });
          continue;
        }

        const current = state.get(change.collection);
        if (!current) {
          return yield* Effect.fail(
            new Error(
              `Migration ${migration.version} updates unknown collection "${change.collection}".`,
            ),
          );
        }

        const normalizedNext = serializeSchema(parseSchema(change.schema));
        const normalizedOld = change.oldSchema
          ? serializeSchema(parseSchema(change.oldSchema))
          : undefined;

        if (normalizedOld !== undefined && !schemasEqual(normalizedOld, current.schema)) {
          return yield* Effect.fail(
            new Error(
              `Migration ${migration.version} declared an old schema for "${change.collection}" that does not match the previous migration state.`,
            ),
          );
        }

        const issues = analyzeMigration({
          oldSchema: current.parsedSchema,
          newSchema: parseSchema(normalizedNext),
        });
        if (issues.length > 0 && !canUseCustomMigration(change)) {
          const issue = issues[0]!;
          return yield* Effect.fail(
            new Error(
              `Migration ${migration.version} has an incompatible schema change for "${change.collection}" at ${issue.path}: ${issue.message}`,
            ),
          );
        }

        state.set(change.collection, {
          schema: normalizedNext,
          parsedSchema: parseSchema(normalizedNext),
        });
      }
    }
  });

const assertRemotePrefix = (
  localMigrations: readonly CompiledMigrationFile[],
  appliedMigrations: ReadonlyArray<{
    readonly version: number;
    readonly name: string;
    readonly checksum: string;
  }>,
): Effect.Effect<number, Error> =>
  Effect.sync(() => {
    if (appliedMigrations.length > localMigrations.length) {
      throw new Error(
        "The server has more applied migrations than exist locally. Refusing to continue.",
      );
    }

    for (const [index, applied] of appliedMigrations.entries()) {
      const local = localMigrations[index];
      if (!local || local.version !== applied.version) {
        throw new Error(`Local migrations diverge from the server at version ${applied.version}.`);
      }
      if (local.checksum !== applied.checksum) {
        throw new Error(`Checksum mismatch for migration ${applied.version} (${local.filePath}).`);
      }
    }

    return appliedMigrations[appliedMigrations.length - 1]?.version ?? 0;
  });

const formatChange = (change: CompiledMigrationChange): string =>
  change.type === "create"
    ? change.skipIfExists === true
      ? `create collection "${change.collection}" if missing`
      : `create collection "${change.collection}"`
    : `update collection "${change.collection}"`;

export const migrateCommand = Command.make(
  "migrate",
  {
    dryRun: Flag.boolean("dry-run").pipe(
      Flag.withDescription("Plan-only: show what would be done without contacting the server"),
      Flag.withDefault(false),
    ),
    dryRunData: Flag.boolean("dry-run-data").pipe(
      Flag.withDescription(
        "Run the migration on a sample of documents without persisting changes (uses --sample-limit / --sample-percent)",
      ),
      Flag.withDefault(false),
    ),
    sampleLimit: Flag.integer("sample-limit").pipe(
      Flag.withDescription("Cap the number of documents per collection in --dry-run-data"),
      Flag.optional,
    ),
    samplePercent: Flag.integer("sample-percent").pipe(
      Flag.withDescription(
        "Sample percentage [0..100] of documents per collection in --dry-run-data",
      ),
      Flag.optional,
    ),
    rerun: Flag.boolean("rerun").pipe(
      Flag.withDescription("Re-run a previous migration (only retries failed/pending docs)"),
      Flag.withDefault(false),
    ),
    replace: Flag.boolean("replace").pipe(
      Flag.withDescription(
        "Install a fixed version of a previously-applied migration with a new checksum",
      ),
      Flag.withDefault(false),
    ),
    redoSucceeded: Flag.boolean("redo-succeeded").pipe(
      Flag.withDescription(
        "With --replace, also re-process docs that already succeeded under the old version",
      ),
      Flag.withDefault(false),
    ),
    version: Flag.integer("version").pipe(
      Flag.withDescription(
        "Target a specific migration version (required with --rerun / --replace / --dry-run-data)",
      ),
      Flag.optional,
    ),
    batchSize: Flag.integer("batch-size").pipe(
      Flag.withDescription("Documents migrated in parallel per batch"),
      Flag.optional,
    ),
    yes: Flag.boolean("yes").pipe(
      Flag.withAlias("y"),
      Flag.withDescription("Skip confirmation prompt"),
      Flag.withDefault(false),
    ),
  },
  ({
    dryRun,
    dryRunData,
    sampleLimit,
    samplePercent,
    rerun,
    replace,
    redoSucceeded,
    version,
    batchSize,
    yes,
  }) =>
    Effect.gen(function* () {
      const configLoader = yield* ConfigLoader;
      const migrationLoader = yield* MigrationLoader;
      const config = yield* configLoader.load();
      const localMigrations = yield* migrationLoader.load();

      yield* validateLocalMigrations(localMigrations);
      yield* Console.log(`Connecting to ${config.url}...`);

      const client = new MimicSDK({
        url: config.url,
        username: config.username,
        password: config.password,
      });

      const databases = yield* client.listDatabases();
      let database = databases.find((entry) => entry.name === config.database);

      if (!database && localMigrations.length > 0 && !rerun && !replace) {
        yield* Console.log(`Database "${config.database}" not found.`);
        if (!yes) {
          const createDb = yield* confirm(`Create database "${config.database}"?`);
          if (!createDb) {
            yield* Console.log("Aborted.");
            return;
          }
        }

        database = yield* client.createDatabase({
          name: config.database,
          description: "",
        });
        yield* Console.log(`Database "${config.database}" created.`);
      }

      if (!database) {
        yield* Console.log("No migrations to apply.");
        return;
      }

      const db = client.database(database.id, database.name, database.description);

      // Single-version targeted modes (rerun / replace / dry-run-data with a
      // specific version) execute against just that migration and bypass the
      // "pending migrations" loop entirely.
      const versionValue = Option.getOrUndefined(version);
      const sampleLimitValue = Option.getOrUndefined(sampleLimit);
      const samplePercentValue = Option.getOrUndefined(samplePercent);
      const batchSizeValue = Option.getOrUndefined(batchSize);
      const targetedMode = rerun || replace || (dryRunData && versionValue !== undefined);
      if (targetedMode) {
        if (versionValue === undefined) {
          yield* Console.log("--version is required with --rerun, --replace, or --dry-run-data.");
          return;
        }
        const local = localMigrations.find((entry) => entry.version === versionValue);
        if (!local) {
          yield* Console.log(`Migration version ${versionValue} not found locally.`);
          return;
        }
        const dryRunPayload = dryRunData
          ? {
              limit: sampleLimitValue,
              samplePercent: samplePercentValue,
            }
          : undefined;
        const mode = replace ? "replace" : rerun ? "rerun" : "apply";
        yield* Console.log(
          `\n${mode.toUpperCase()} migration ${String(versionValue).padStart(5, "0")}_${local.name}${dryRunData ? " (dry-run)" : ""}`,
        );
        if (!yes && !dryRunData) {
          const confirmed = yield* confirm(`Proceed with ${mode}?`);
          if (!confirmed) {
            yield* Console.log("Aborted.");
            return;
          }
        }
        const report = yield* db.applyMigration({
          version: local.version,
          name: local.name,
          checksum: local.checksum,
          changes: local.changes,
          mode,
          dryRun: dryRunPayload,
          batchSize: batchSizeValue,
          redoSucceededOnReplace: redoSucceeded,
        });
        yield* Console.log(
          `\n  → ${report.state} (succeeded=${report.succeeded} failed=${report.failed} skipped=${report.skipped})`,
        );
        if (report.failed > 0) {
          for (const entry of report.perDocument) {
            if (entry.status === "failed") {
              yield* Console.log(
                `    ✗ ${entry.documentId} ${entry.errorCode ?? ""}: ${entry.errorMessage ?? ""}`,
              );
            }
          }
        }
        return;
      }

      const appliedMigrations = yield* db.listMigrations();
      const highestAppliedVersion = yield* assertRemotePrefix(localMigrations, appliedMigrations);
      const pendingMigrations = localMigrations.filter(
        (migration) => migration.version > highestAppliedVersion,
      );

      if (pendingMigrations.length === 0) {
        yield* Console.log("No migrations to apply.");
        return;
      }

      yield* Console.log("\nPlan:");
      for (const migration of pendingMigrations) {
        yield* Console.log(`  ~ ${String(migration.version).padStart(5, "0")}_${migration.name}`);
        for (const change of migration.changes) {
          yield* Console.log(`    - ${formatChange(change)}`);
        }
      }
      yield* Console.log("");

      if (dryRun) {
        yield* Console.log("Dry run complete. No changes applied.");
        return;
      }

      if (!yes) {
        const confirmed = yield* confirm("Apply these migrations?");
        if (!confirmed) {
          yield* Console.log("Aborted.");
          return;
        }
      }

      for (const migration of pendingMigrations) {
        const report = yield* db.applyMigration({
          version: migration.version,
          name: migration.name,
          checksum: migration.checksum,
          changes: migration.changes,
          batchSize: batchSizeValue,
        });
        if (report.state === "succeeded") {
          yield* Console.log(
            `  ~ applied ${String(migration.version).padStart(5, "0")}_${migration.name} (succeeded=${report.succeeded} skipped=${report.skipped})`,
          );
        } else {
          yield* Console.log(
            `  ✗ migration ${String(migration.version).padStart(5, "0")}_${migration.name} failed: ${report.failed}/${report.succeeded + report.failed + report.skipped} document(s) failed.`,
          );
          for (const entry of report.perDocument) {
            if (entry.status === "failed") {
              yield* Console.log(
                `      ✗ ${entry.documentId} ${entry.errorCode ?? ""}: ${entry.errorMessage ?? ""}`,
              );
            }
          }
          yield* Console.log(
            `      Re-run with --rerun --version=${migration.version} once the inputs are fixed.`,
          );
          return;
        }
      }

      yield* Console.log(`\nDone. Applied ${pendingMigrations.length} migration(s).`);
    }).pipe(Effect.provide(MigrationBundler.Default)),
).pipe(Command.withDescription("Apply local migrations to the Mimic server"));
