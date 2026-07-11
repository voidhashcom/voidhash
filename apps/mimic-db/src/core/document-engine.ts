import {
  applyBatch,
  cloneValue,
  parseSchema,
  type Command,
  type SchemaObject,
  type Value,
} from "@voidhash/mimic-core";
import { MigrationFailedError, NotFoundError } from "@voidhash/mimic-server/rpc";
import { reconcileMigrationValue } from "@voidhash/mimic-server/migrate";
import { Effect, Result } from "effect";

import { sanitizeValueForSchema } from "../document/schema.ts";
import type { SubmitTransactionResponse, TransactionEnvelope } from "../document/transaction.ts";
import type { MigrationExecutorApi } from "./migration-executor.ts";
import type { CollectionContext, SchemaProviderApi } from "./schema-provider.ts";
import type { DocumentStoreApi } from "./store.ts";

export interface DocumentEngineDeps {
  readonly store: DocumentStoreApi;
  readonly executor: MigrationExecutorApi;
  readonly schema: SchemaProviderApi;
  readonly snapshotEveryCommands: number;
}

export interface LoadedDocument {
  readonly value: Value;
  readonly version: number;
  readonly currentSeq: number;
  readonly snapshotSeq: number;
  readonly schemaVersion: number;
  readonly collectionId: string;
}

export interface DocumentEngineApi {
  readonly create: (
    collectionId: string,
    value: Value,
    schemaVersion: number,
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
 * per-document `DocumentStore`, the `MigrationExecutor`, and a `SchemaProvider`
 * (which reads collection schema chains from the control plane). The same
 * factory is used in-process for dev/test via `makeMemoryDocumentStore`.
 */
export const makeDocumentEngine = (deps: DocumentEngineDeps): DocumentEngineApi => {
  const { store, executor, schema, snapshotEveryCommands } = deps;

  const create: DocumentEngineApi["create"] = (collectionId, value, schemaVersion) =>
    store.initialize(collectionId, value, schemaVersion);

  /**
   * Advance `value` from `fromVersion` up to the collection's latest schema by
   * applying each intervening version's migration — bundled data migration if
   * present, otherwise a schema reconcile against the previous version.
   */
  const migrateUp = (
    value: Value,
    fromVersion: number,
    ctx: CollectionContext,
  ): Effect.Effect<Value, MigrationFailedError> =>
    Effect.gen(function* () {
      let current = value;
      for (let version = fromVersion + 1; version <= ctx.schemaVersion; version++) {
        const target = ctx.versions.find((entry) => entry.version === version);
        if (!target) {
          return yield* Effect.fail(
            migrationFailed(`Missing schema version ${version} for collection ${ctx.collectionId}`),
          );
        }
        if (target.dataMigrationSource) {
          // The bundle reconciles old→new and runs the user migration itself.
          current = yield* executor.run(target.dataMigrationSource, current);
        } else {
          const previous = ctx.versions.find((entry) => entry.version === version - 1);
          const result = reconcileMigrationValue({
            oldSchema: parseSchema(previous?.schemaJson ?? target.schemaJson),
            newSchema: parseSchema(target.schemaJson),
            value: current,
          });
          if (!result.ok || result.value === undefined) {
            return yield* Effect.fail(
              migrationFailed(
                result.ok ? "Migration produced an empty value" : result.error.message,
              ),
            );
          }
          current = result.value;
        }
        current = yield* sanitize(target.schemaJson, current);
      }
      return current;
    });

  const sanitize = (
    schemaJson: SchemaObject,
    value: Value,
  ): Effect.Effect<Value, MigrationFailedError> =>
    Effect.try({
      try: () => sanitizeValueForSchema(schemaJson, value),
      catch: (error) => migrationFailed(error instanceof Error ? error.message : String(error)),
    });

  const load: DocumentEngineApi["load"] = () =>
    Effect.gen(function* () {
      const meta = yield* store.readMeta();
      if (!meta || meta.deletedAt !== null) {
        return yield* Effect.fail(notFound("Document not found"));
      }
      const snapshot = yield* store.loadLatestSnapshot();
      if (!snapshot) {
        return yield* Effect.fail(notFound("Document not found"));
      }
      let value = cloneValue(snapshot.value);
      const commands = yield* store.listCommandsAfter(snapshot.seq);
      if (commands.length > 0) {
        value = applyBatch(
          value,
          commands.map((row) => row.command),
        );
      }
      let schemaVersion = meta.schemaVersion;
      let snapshotSeq = meta.snapshotSeq;

      const ctx = yield* schema.getCollectionContext(meta.collectionId);
      if (ctx && schemaVersion < ctx.schemaVersion) {
        // Lazy migration: bring the document onto the latest schema on load,
        // then durably snapshot the result so the work is done once.
        value = yield* migrateUp(value, schemaVersion, ctx);
        schemaVersion = ctx.schemaVersion;
        yield* store.writeSnapshot(meta.currentSeq, value, schemaVersion);
        yield* store.setMeta({ schemaVersion, snapshotSeq: meta.currentSeq });
        snapshotSeq = meta.currentSeq;
      }

      return {
        value,
        version: meta.currentSeq + 1,
        currentSeq: meta.currentSeq,
        snapshotSeq,
        schemaVersion,
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
      const schemaJson = ctx?.schemaJson;
      const commands = envelope.commands as readonly Command[];

      const applied = yield* Effect.result(
        Effect.try({
          try: () => {
            const next = applyBatch(loaded.value, commands);
            return schemaJson ? sanitizeValueForSchema(schemaJson, next) : next;
          },
          catch: (error) => (error instanceof Error ? error : new Error(String(error))),
        }),
      );

      if (Result.isFailure(applied)) {
        return {
          accepted: false,
          version: loaded.version,
          transactionId,
          reason: applied.failure.message,
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
      if (meta) yield* store.setMeta({ deletedAt: Date.now() });
    });

  return { create, load, submit, remove };
};
