import * as Arr from "effect/Array";
import {
  applyBatch,
  cloneValue,
  parseSchema,
  type SchemaObject,
  type Value,
} from "@voidhash/mimic-core";
import { MigrationFailedError, NotFoundError } from "@voidhash/mimic-server/rpc";
import {
  reconcileMigrationValue,
  runDirectMigration,
  type MigrationRegistry,
} from "@voidhash/mimic-server/migrate";
import { causeMessage } from "@voidhash/lib/lang";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import { sanitizeValueForSchema } from "../document/schema.ts";
import type { SubmitTransactionResponse, TransactionEnvelope } from "../document/transaction.ts";
import type { CollectionContext, SchemaProviderApi } from "./schema-provider.ts";
import type { DocumentStoreApi } from "./store.ts";

export interface DocumentEngineDeps {
  readonly store: DocumentStoreApi;
  readonly migrations: MigrationRegistry;
  readonly schema: SchemaProviderApi;
  readonly snapshotEveryCommands: number;
}

export interface LoadedDocument {
  readonly value: Value;
  readonly version: number;
  readonly currentSeq: number;
  readonly snapshotSeq: number;
  readonly schemaVersion: number;
  readonly migrationVersion: Option.Option<number>;
  readonly collectionId: string;
}

export interface DocumentEngineApi {
  readonly create: (
    collectionId: string,
    value: Value,
    schemaVersion: number,
    migrationVersion: Option.Option<number>,
  ) => Effect.Effect<void>;
  readonly load: () => Effect.Effect<LoadedDocument, NotFoundError | MigrationFailedError>;
  readonly submit: (
    envelope: TransactionEnvelope,
  ) => Effect.Effect<SubmitTransactionResponse, NotFoundError>;
  readonly remove: () => Effect.Effect<void>;
}

const notFound = (message: string): NotFoundError =>
  new NotFoundError({ code: "not_found", message });

const migrationFailed = (message: string): MigrationFailedError =>
  new MigrationFailedError({ code: "migration_failed", message });

/**
 * The logic that runs inside a single document entity. Constructed over a
 * per-document `DocumentStore`, a deployed migration registry, and a
 * `SchemaProvider`. The same factory is used in-process for tests.
 */
export const makeDocumentEngine = (deps: DocumentEngineDeps): DocumentEngineApi => {
  const { store, migrations, schema, snapshotEveryCommands } = deps;

  const create: DocumentEngineApi["create"] = (
    collectionId,
    value,
    schemaVersion,
    migrationVersion,
  ) => store.initialize(collectionId, value, schemaVersion, migrationVersion);

  /**
   * Advance `value` from `fromVersion` up to the collection's latest schema by
   * reconciling each persisted source-free schema version. Stored executable
   * migration source is rejected and never evaluated.
   */
  const migrateUp = (
    value: Value,
    fromVersion: number,
    ctx: CollectionContext,
  ): Effect.Effect<Value, MigrationFailedError> =>
    Effect.reduce(
      Arr.range(fromVersion + 1, ctx.schemaVersion),
      () => value,
      (current, version) =>
        Effect.gen(function* () {
          const target = ctx.versions.find((entry) => entry.version === version);
          if (!target) {
            return yield* Effect.fail(
              migrationFailed(
                `Missing schema version ${version} for collection ${ctx.collectionId}`,
              ),
            );
          }
          if (Option.isSome(target.dataMigrationSource)) {
            return yield* Effect.fail(
              migrationFailed(
                `Legacy schema version ${version} requires executable source, which is no longer supported`,
              ),
            );
          }
          const previous = ctx.versions.find((entry) => entry.version === version - 1);
          const result = reconcileMigrationValue({
            oldSchema: parseSchema(previous?.schemaJson ?? target.schemaJson),
            newSchema: parseSchema(target.schemaJson),
            value: current,
          });
          if (!result.ok) {
            return yield* Effect.fail(migrationFailed(result.error.message));
          }
          if (Option.isNone(result.value)) {
            return yield* Effect.fail(migrationFailed("Migration produced an empty value"));
          }
          return yield* sanitize(target.schemaJson, result.value.value);
        }),
    );

  const sanitize = (
    schemaJson: SchemaObject,
    value: Value,
  ): Effect.Effect<Value, MigrationFailedError> =>
    Effect.try({
      try: () => sanitizeValueForSchema(schemaJson, value),
      catch: (error) => migrationFailed(causeMessage(error)),
    });

  const load: DocumentEngineApi["load"] = () =>
    Effect.gen(function* () {
      const metaOption = yield* store.readMeta();
      if (Option.isNone(metaOption) || Option.isSome(metaOption.value.deletedAt)) {
        return yield* Effect.fail(notFound("Document not found"));
      }
      const meta = metaOption.value;
      const snapshotOption = yield* store.loadLatestSnapshot();
      if (Option.isNone(snapshotOption)) {
        return yield* Effect.fail(notFound("Document not found"));
      }
      const snapshot = snapshotOption.value;
      let value = cloneValue(snapshot.value);
      const commands = yield* store.listCommandsAfter(snapshot.seq);
      if (Arr.isReadonlyArrayNonEmpty(commands)) {
        value = applyBatch(
          value,
          commands.map((row) => row.command),
        );
      }
      let schemaVersion = meta.schemaVersion;
      let migrationVersion = meta.migrationVersion;
      let snapshotSeq = meta.snapshotSeq;
      let changed = false;

      const ctx = yield* schema.getCollectionContext(meta.collectionId);
      if (Option.isSome(ctx) && schemaVersion < ctx.value.schemaVersion) {
        value = yield* migrateUp(value, schemaVersion, ctx.value);
        schemaVersion = ctx.value.schemaVersion;
        changed = true;
      }

      if (Option.isSome(ctx)) {
        const definition = migrations.find(ctx.value.databaseName, ctx.value.collectionName);
        if (Option.isSome(definition)) {
          const currentMigrationVersion = Option.getOrElse(migrationVersion, () => 0);
          const latestMigrationVersion = definition.value.migrations.length;
          if (currentMigrationVersion > latestMigrationVersion) {
            return yield* Effect.fail(
              migrationFailed(
                `Document migration version ${currentMigrationVersion} is newer than deployed version ${latestMigrationVersion}`,
              ),
            );
          }
          value = yield* Effect.reduce(
            definition.value.migrations.slice(currentMigrationVersion),
            () => value,
            (current, migration) =>
              Effect.try({
                try: () => runDirectMigration(migration, current),
                catch: (error) => migrationFailed(causeMessage(error)),
              }).pipe(
                Effect.tap(() =>
                  Effect.sync(() => {
                    migrationVersion = Option.some(migration.version);
                    changed = true;
                  }),
                ),
              ),
          );
          if (Option.isNone(migrationVersion)) {
            migrationVersion = Option.some(0);
            changed = true;
          }
        }
      }

      if (changed) {
        yield* store.commitMigration(meta.currentSeq, value, schemaVersion, migrationVersion);
        snapshotSeq = meta.currentSeq;
      }

      return {
        value,
        version: meta.currentSeq + 1,
        currentSeq: meta.currentSeq,
        snapshotSeq,
        schemaVersion,
        migrationVersion,
        collectionId: meta.collectionId,
      };
    });

  const submit: DocumentEngineApi["submit"] = (envelope) =>
    Effect.gen(function* () {
      const loaded = yield* load().pipe(
        Effect.catchTag("MigrationFailedError", (error) =>
          Effect.fail(notFound(`Document migration failed: ${error.message}`)),
        ),
      );

      const transactionId = envelope.id;
      if (envelope.baseVersion !== loaded.version) {
        return {
          accepted: false,
          version: loaded.version,
          transactionId,
          reason: `Version conflict: expected ${loaded.version}, received ${envelope.baseVersion}`,
        };
      }

      const ctx = yield* deps.schema.getCollectionContext(loaded.collectionId);
      const schemaJson = Option.map(ctx, (context) => context.schemaJson);
      const commands = envelope.commands;

      const applied = yield* Effect.result(
        Effect.try({
          try: () => {
            const next = applyBatch(loaded.value, commands);
            if (Option.isNone(schemaJson)) return next;
            return sanitizeValueForSchema(schemaJson.value, next);
          },
          catch: causeMessage,
        }),
      );

      if (Result.isFailure(applied)) {
        return {
          accepted: false,
          version: loaded.version,
          transactionId,
          reason: applied.failure,
        };
      }

      const nextValue = applied.success;
      yield* store.appendCommands(loaded.currentSeq, commands, transactionId);
      const newSeq = loaded.currentSeq + commands.length;
      yield* store.setMeta({ currentSeq: newSeq });

      if (newSeq - loaded.snapshotSeq >= snapshotEveryCommands) {
        yield* store.writeSnapshot(newSeq, nextValue, loaded.schemaVersion);
        yield* store.setMeta({ snapshotSeq: newSeq });
      }

      return { accepted: true, version: newSeq + 1, transactionId };
    });

  const remove: DocumentEngineApi["remove"] = () =>
    Effect.gen(function* () {
      const meta = yield* store.readMeta();
      if (Option.isSome(meta)) {
        const deletedAt = yield* Clock.currentTimeMillis;
        yield* store.setMeta({ deletedAt: Option.some(deletedAt) });
      }
    });

  return { create, load, submit, remove };
};
