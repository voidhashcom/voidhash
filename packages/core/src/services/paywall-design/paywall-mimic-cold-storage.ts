/**
 * Paywall Mimic Cold Storage
 *
 * Paywall-specific ColdStorage implementation using Drizzle/MySQL.
 * Stores periodic snapshots of paywall design state.
 */

import {
	ColdStorage,
	ColdStorageError,
	type StoredDocument,
} from "@voidhash/mimic-effect";
import { eq, paywallDesignStates, sql } from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import { Effect } from "effect";

import { CURRENT_SCHEMA_VERSION, migrateStateSync } from "./schema-migration";

export const PaywallMimicColdStorageLive = ColdStorage.make(
	Effect.gen(function* () {
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
			(
				execute,
				params: {
					paywallId: string;
					state: unknown;
					schemaVersion: number;
					version: number;
				},
			) =>
				execute(async (client) => {
					await client
						.insert(paywallDesignStates)
						.values({
							paywallId: params.paywallId,
							redisCheckpoint: `snapshot-${Date.now()}`,
							schemaVersion: params.schemaVersion,
							state: params.state,
							version: params.version,
						})
						.onDuplicateKeyUpdate({
							set: {
								deletedAt: null,
								redisCheckpoint: `snapshot-${Date.now()}`,
								schemaVersion: params.schemaVersion,
								state: params.state,
								updatedAt: sql`CURRENT_TIMESTAMP`,
								version: params.version,
							},
						});
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

		return {
			delete: (documentId: string) =>
				softDeleteQuery(documentId).pipe(
					Effect.asVoid,
					Effect.catchAll((cause) =>
						Effect.fail(
							new ColdStorageError({
								documentId,
								operation: "delete",
								cause,
							}),
						),
					),
				),

			load: (documentId: string) =>
				loadQuery(documentId).pipe(
					Effect.map((record): StoredDocument | undefined =>
						record && !record.deletedAt
							? {
									savedAt: record.updatedAt?.getTime() ?? Date.now(),
									schemaVersion: CURRENT_SCHEMA_VERSION,
									state: migrateStateSync(record.state),
									version: record.version,
								}
							: undefined,
					),
					Effect.catchAll((cause) =>
						Effect.fail(
							new ColdStorageError({
								documentId,
								operation: "load",
								cause,
							}),
						),
					),
				),

			save: (documentId: string, document: StoredDocument) =>
				upsertQuery({
					paywallId: documentId,
					schemaVersion: document.schemaVersion,
					state: document.state,
					version: document.version,
				}).pipe(
					Effect.asVoid,
					Effect.catchAll((cause) =>
						Effect.fail(
							new ColdStorageError({
								documentId,
								operation: "save",
								cause,
							}),
						),
					),
				),
		};
	}),
);
