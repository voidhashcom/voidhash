/**
 * Mimic WebSocket route for paywall editing
 *
 * Provides real-time collaborative editing for paywalls with
 * short-lived token authentication via PaywallService.
 */

import { PaywallService } from "@voidhash/core/services";
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

// Custom auth layer - validates tokens via PaywallService
const PaywallMimicAuthLayer = MimicAuthService.layerEffect(
  Effect.gen(function* PaywallMimicAuthLayer() {
    const paywallService = yield* PaywallService;
    return MimicAuthService.makeEffect((token: string) =>
      paywallService.validateEditToken(token).pipe(
        Effect.map((result) => {
          console.log("token", token);
          console.log("result", result);
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
        }),
        Effect.catchAll(() =>
          Effect.succeed({
            error: "Token validation failed",
            success: false as const,
          })
        )
      )
    );
  })
);

/**
 * Mimic Paywall route layer
 *
 * Handles WebSocket connections at /mimic/paywall/:documentId
 * with short-lived token authentication.
 */
export const MimicPaywallRouteLayer = MimicServer.layerHttpLayerRouter(
  Effect.gen(function* MimicPaywallRouteLayer() {
    const paywallService = yield* PaywallService;
    return {
      authLayer: PaywallMimicAuthLayer.pipe(
        Layer.provide(PaywallService.Default),
        Layer.provide(Db.Default)
      ),
      basePath: "/mimic/paywall-designer",
      initial: (ctx: MimicConfig.InitialContext) =>
        // biome-ignore lint/correctness/useYield: We don't need to yield here
        Effect.gen(function* initial() {
          // TODO: Get paywall from database. We need to add support for errors in mimic
          // const paywall = yield* paywallService
          // 	.getPaywallById(ctx.documentId)
          // 	.pipe(Effect.catchAll());
          return {
            children: [
              {
                children: [],
                name: "root",
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
        }),
      presence: PresenceSchema,
      schema: PaywallDesignerDocument,
    };
  })
);
