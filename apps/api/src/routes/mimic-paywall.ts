/**
 * Mimic WebSocket route for paywall editing
 *
 * Provides real-time collaborative editing for paywalls with:
 * - Short-lived token authentication via PaywallService
 * - Cluster-based document management for horizontal scaling
 * - 2-tier persistence: Redis (WAL) + MySQL (snapshots)
 */

import { RedisMimicHotStorageFromEnv } from "@voidhash/core/services/mimic";
import { PaywallMimicColdStorageLive } from "@voidhash/core/services/paywall-design";
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
              gt(paywallEditTokens.expiresAt, new Date())
            ),
          })
      )
    )(token)
    .pipe(
      Effect.map((record) =>
        record ? { paywallId: record.paywallId, userId: record.userId } : null
      ),
      Effect.catchAll(() => Effect.succeed(null))
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
                new AuthenticationError({ reason: "Invalid or expired token" })
              );
            }
            return Effect.succeed({
              permission: "write" as const,
              userId: result.userId,
            });
          })
        ),
    };
  }).pipe(Effect.provide(Db.Default))
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
 * Storage layers - ColdStorage (MySQL) + HotStorage (Redis WAL)
 */
const StorageLayers = Layer.mergeAll(
  PaywallMimicColdStorageLive,
  RedisMimicHotStorageFromEnv
).pipe(Layer.provide(Db.Default));

/**
 * Engine layer using MimicClusterServerEngine
 * Each document becomes a cluster Entity with automatic sharding
 */
const MimicPaywallEngine = MimicClusterServerEngine.make({
  initial: (_ctx: InitialContext) => Effect.succeed(defaultInitialState),
  presence: PresenceSchema,
  schema: PaywallDesignerDocument,
  shardGroup: "mimic-paywall-documents",
});

/**
 * WebSocket route layer
 * Handles connections at /mimic/paywall-designer/doc/:documentId
 */
const MimicPaywallRoute = MimicServer.layerHttpLayerRouter({
  path: "/mimic/paywall-designer",
});

/**
 * Mimic Paywall route layer - requires Sharding from cluster infrastructure
 *
 * Data flow:
 * 1. On connect: Load state from MySQL snapshot + replay Redis WAL
 * 2. On edit: Append to Redis WAL, periodic snapshots to MySQL
 * 3. On disconnect: Entity may be garbage collected after idle timeout
 */
export const MimicPaywallRouteLayer = MimicPaywallRoute.pipe(
  Layer.provide(MimicPaywallEngine),
  Layer.provide(StorageLayers),
  Layer.provide(PaywallMimicAuthLayer)
);
