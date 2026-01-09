/**
 * Mimic WebSocket route for paywall editing
 *
 * Provides real-time collaborative editing for paywalls with:
 * - Short-lived token authentication via PaywallService
 * - Cluster-based document management for horizontal scaling
 * - 2-tier persistence: Redis (WAL) + MySQL (snapshots)
 */

import { and, eq, gt, paywallEditTokens } from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import {
	AuthenticationError,
	type InitialContext,
	MimicAuthService,
	MimicClusterServerEngine,
	MimicServer,
} from "@voidhash/mimic-effect";
import {
	PaywallDesignerDocument,
	PresenceSchema,
} from "@voidhash/mimic-schema";
import { Effect, Layer } from "effect";

/**
 * Validate edit token directly (without going through PaywallService)
 * This avoids the AuthSession dependency since token validation is for anonymous WebSocket connections.
 */
const validateEditToken = (db: Db, token: string) =>
	db
		.makeQuery((execute, t: string) =>
			execute(
				async (client) =>
					await client.query.paywallEditTokens.findFirst({
						where: and(
							eq(paywallEditTokens.token, t),
							gt(paywallEditTokens.expiresAt, new Date()),
						),
					}),
			),
		)(token)
		.pipe(
			Effect.map((record) =>
				record ? { paywallId: record.paywallId, userId: record.userId } : null,
			),
			Effect.catchAll(() => Effect.succeed(null)),
		);

/**
 * Auth layer - validates tokens directly against DB
 */
const PaywallMimicAuthLayer = MimicAuthService.make(
	Effect.gen(function* PaywallMimicAuthLayer() {
		const db = yield* Db;
		return {
			authenticate: (token: string, _documentId: string) =>
				validateEditToken(db, token).pipe(
					Effect.flatMap((result) => {
						if (!result) {
							return Effect.fail(
								new AuthenticationError({ reason: "Invalid or expired token" }),
							);
						}
						return Effect.succeed({
							permission: "write" as const,
							userId: result.userId,
						});
					}),
				),
		};
	}),
);

/**
 * Default initial state for new paywall documents.
 * Returns a basic screen structure when no persisted state exists.
 */
const defaultInitialState = {
	children: [
		{
			children: [],
			name: "Screen",
			style: {
				backgroundColor: "#ffffff",
				height: 844,
				width: 390,
				x: 0,
				y: 0,
			},
			type: "screen" as const,
		},
	],
	name: "Untitled Paywall",
	type: "root" as const,
};

/**
 * WebSocket route layer
 * Handles connections at /mimic/paywall-designer/doc/:documentId
 */
export const MimicPaywallRoute = MimicServer.layerHttpLayerRouter({
	path: "/mimic/paywall-designer",
}).pipe(Layer.provide(PaywallMimicAuthLayer));

/**
 * Engine layer using MimicClusterServerEngine
 * Each document becomes a cluster Entity with automatic sharding
 */
export const MimicPaywallEngine = MimicClusterServerEngine.make({
	initial: (_ctx: InitialContext) => Effect.succeed(defaultInitialState),
	presence: PresenceSchema,
	schema: PaywallDesignerDocument,
	shardGroup: "mimic-paywall-documents",
}).pipe(Layer.provide(PaywallMimicAuthLayer));
