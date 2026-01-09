/**
 * MySQL Snapshot Store
 *
 * Provides canonical storage for paywall design states in MySQL.
 * Handles persistence with optimistic locking for concurrency control.
 */

import {
	and,
	eq,
	paywallDesignStates,
	sql,
	type InferSelectModel,
} from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import { Context, Effect, Layer, Option } from "effect";

import { MySqlSnapshotError, VersionConflictError } from "./errors";

/**
 * Design state record from MySQL
 */
export type DesignStateRecord = InferSelectModel<typeof paywallDesignStates>;

/**
 * Input for saving design state
 */
export interface SaveDesignStateInput {
	readonly paywallId: string;
	readonly state: unknown;
	readonly schemaVersion: number;
	readonly expectedVersion: number;
	readonly redisCheckpoint: string;
}

/**
 * Result of save operation
 */
export interface SaveDesignStateResult {
	readonly success: boolean;
	readonly newVersion: number;
}

/**
 * MySQL Snapshot Store service interface
 */
export interface MySqlSnapshotStore {
	/**
	 * Load design state from MySQL
	 */
	readonly load: (
		paywallId: string,
	) => Effect.Effect<Option.Option<DesignStateRecord>, MySqlSnapshotError>;

	/**
	 * Save design state with optimistic locking (upsert)
	 */
	readonly save: (
		input: SaveDesignStateInput,
	) => Effect.Effect<
		SaveDesignStateResult,
		MySqlSnapshotError | VersionConflictError
	>;

	/**
	 * Soft delete design state
	 */
	readonly softDelete: (
		paywallId: string,
	) => Effect.Effect<void, MySqlSnapshotError>;

	/**
	 * Restore soft-deleted design state
	 */
	readonly restore: (
		paywallId: string,
	) => Effect.Effect<void, MySqlSnapshotError>;
}

/**
 * Context tag for MySqlSnapshotStore
 */
export class MySqlSnapshotStoreTag extends Context.Tag(
	"PaywallDesign/MySqlSnapshotStore",
)<MySqlSnapshotStoreTag, MySqlSnapshotStore>() {}

/**
 * Create MySqlSnapshotStore implementation
 */
const makeMySqlSnapshotStore = Effect.gen(function* () {
	const db = yield* Db;

	const loadQuery = db.makeQuery((execute, paywallId: string) =>
		execute(async (client) => {
			const result = await client.query.paywallDesignStates.findFirst({
				where: eq(paywallDesignStates.paywallId, paywallId),
			});
			return result ?? null;
		}),
	);

	const upsertQuery = db.makeQuery(
		(execute, input: SaveDesignStateInput & { isInsert: boolean }) =>
			execute(async (client) => {
				if (input.isInsert) {
					// Insert new record
					await client.insert(paywallDesignStates).values({
						paywallId: input.paywallId,
						redisCheckpoint: input.redisCheckpoint,
						schemaVersion: input.schemaVersion,
						state: input.state,
						version: 1,
					});
					return { affectedRows: 1, newVersion: 1 };
				}
				// Update existing record with optimistic locking via WHERE clause
				// This is the authoritative check - prevents race conditions
				const result = await client
					.update(paywallDesignStates)
					.set({
						deletedAt: null, // Clear soft delete if restoring
						redisCheckpoint: input.redisCheckpoint,
						schemaVersion: input.schemaVersion,
						state: input.state,
						version: sql`${paywallDesignStates.version} + 1`,
					})
					.where(
						and(
							eq(paywallDesignStates.paywallId, input.paywallId),
							eq(paywallDesignStates.version, input.expectedVersion),
						),
					);

				// MySQL returns affectedRows in the result array
				const affectedRows = Array.isArray(result)
					? (result[0] as { affectedRows?: number })?.affectedRows ?? 0
					: (result as unknown as { affectedRows?: number })?.affectedRows ?? 0;
				return {
					affectedRows,
					newVersion: input.expectedVersion + 1,
				};
			}),
	);

	const softDeleteQuery = db.makeQuery((execute, paywallId: string) =>
		execute(async (client) => {
			await client
				.update(paywallDesignStates)
				.set({ deletedAt: sql`CURRENT_TIMESTAMP` })
				.where(eq(paywallDesignStates.paywallId, paywallId));
		}),
	);

	const restoreQuery = db.makeQuery((execute, paywallId: string) =>
		execute(async (client) => {
			await client
				.update(paywallDesignStates)
				.set({ deletedAt: null })
				.where(eq(paywallDesignStates.paywallId, paywallId));
		}),
	);

	const store: MySqlSnapshotStore = {
		load: (paywallId: string) =>
			loadQuery(paywallId).pipe(
				Effect.map((result) =>
					result && !result.deletedAt ? Option.some(result) : Option.none(),
				),
				Effect.catchAll((error) =>
					Effect.fail(
						new MySqlSnapshotError({
							cause: error,
							operation: "load",
							paywallId,
						}),
					),
				),
			),

		save: (input: SaveDesignStateInput) =>
			Effect.gen(function* () {
				// Check if record exists (fast-path optimization)
				const existing = yield* loadQuery(input.paywallId).pipe(
					Effect.catchAll(() => Effect.succeed(null)),
				);

				const isInsert = !existing;

				// Fast-path version check (avoids unnecessary DB round-trip)
				// The authoritative check is in the SQL WHERE clause
				if (
					!isInsert &&
					existing &&
					existing.version !== input.expectedVersion
				) {
					return yield* Effect.fail(
						new VersionConflictError({
							actualVersion: existing.version,
							expectedVersion: input.expectedVersion,
							paywallId: input.paywallId,
						}),
					);
				}

				const result = yield* upsertQuery({ ...input, isInsert }).pipe(
					Effect.catchAll((error) =>
						Effect.fail(
							new MySqlSnapshotError({
								cause: error,
								operation: "save",
								paywallId: input.paywallId,
							}),
						),
					),
				);

				// Check if update succeeded (handles race condition)
				// If affectedRows is 0 on update, version changed between load and update
				if (!isInsert && result.affectedRows === 0) {
					// Re-fetch to get actual version for error message
					const current = yield* loadQuery(input.paywallId).pipe(
						Effect.catchAll(() => Effect.succeed(null)),
					);
					return yield* Effect.fail(
						new VersionConflictError({
							actualVersion: current?.version ?? -1,
							expectedVersion: input.expectedVersion,
							paywallId: input.paywallId,
						}),
					);
				}

				return { newVersion: result.newVersion, success: true };
			}),

		softDelete: (paywallId: string) =>
			softDeleteQuery(paywallId).pipe(
				Effect.catchAll((error) =>
					Effect.fail(
						new MySqlSnapshotError({
							cause: error,
							operation: "delete",
							paywallId,
						}),
					),
				),
			),

		restore: (paywallId: string) =>
			restoreQuery(paywallId).pipe(
				Effect.catchAll((error) =>
					Effect.fail(
						new MySqlSnapshotError({
							cause: error,
							operation: "save",
							paywallId,
						}),
					),
				),
			),
	};

	return store;
});

/**
 * Layer for MySqlSnapshotStore
 */
export const layer: Layer.Layer<MySqlSnapshotStoreTag, never, Db> =
	Layer.effect(MySqlSnapshotStoreTag, makeMySqlSnapshotStore);

/**
 * Default layer with Db dependency
 */
export const Default: Layer.Layer<MySqlSnapshotStoreTag, never, Db> = layer;
