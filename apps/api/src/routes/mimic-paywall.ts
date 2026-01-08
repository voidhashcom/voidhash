/**
 * Mimic WebSocket route for paywall editing
 *
 * Provides real-time collaborative editing for paywalls with:
 * - Short-lived token authentication via PaywallService
 * - 3-tier persistence: Redis (safety) -> MySQL (canonical) -> S3 (published)
 * - Debounced saves with max delay guarantee
 */

import { FullStorageLayerFromEnv } from "@voidhash/core/services/paywall-design";
import { and, eq, gt, paywallEditTokens } from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import {
  MimicAuthService,
  type MimicConfig,
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
        record
          ? { paywallId: record.paywallId, userId: record.userId }
          : null
      ),
      Effect.catchAll(() => Effect.succeed(null))
    );

// Custom auth layer - validates tokens directly against DB
// Note: We provide Db.Default here so the layer doesn't require external dependencies
const PaywallMimicAuthLayer = MimicAuthService.layerEffect(
  Effect.gen(function* () {
    const db = yield* Db;
    return MimicAuthService.makeEffect((token: string) =>
      validateEditToken(db, token).pipe(
        Effect.map((result) => {
          if (!result) {
            return {
              error: "Invalid or expired token",
              success: false as const,
            };
          }
          return {
            success: true as const,
            userId: result.userId,
          };
        })
      )
    );
  })
).pipe(Layer.provide(Db.Default));

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
 * Mimic Paywall route layer
 *
 * Handles WebSocket connections at /mimic/paywall-designer/doc/:documentId
 * with short-lived token authentication and persistent storage.
 *
 * Data flow:
 * 1. On connect: Load state from Redis (fast) or MySQL (canonical)
 * 2. On edit: Save immediately to Redis, debounced to MySQL
 * 3. On disconnect: Flush any pending MySQL saves
 */
export const MimicPaywallRouteLayer = MimicServer.layerHttpLayerRouter(
  Effect.succeed({
    // Auth layer validates tokens directly against DB (no AuthSession needed)
    authLayer: PaywallMimicAuthLayer,
    basePath: "/mimic/paywall-designer",

    // Custom storage layer with Redis + MySQL persistence
    // Note: Redis connection errors are converted to defects (crash on startup)
    // because we require Redis to be available for real-time persistence
    storageLayer: FullStorageLayerFromEnv.pipe(
      Layer.provide(Db.Default),
      Layer.orDie
    ),

    // Initial state for new documents
    // The paywall name could be customized by loading from DB, but since auth
    // has already validated access and storage will load persisted state first,
    // we use a simple default here. The name will be updated on first edit.
    initial: (_ctx: MimicConfig.InitialContext) =>
      Effect.succeed(defaultInitialState),

    presence: PresenceSchema,
    schema: PaywallDesignerDocument,
  })
);
