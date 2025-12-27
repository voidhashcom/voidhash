/**
 * Mimic WebSocket route for paywall editing
 *
 * Provides real-time collaborative editing for paywalls with
 * short-lived token authentication via PaywallService.
 */
import {
  MimicAuthService,
  MimicServer
} from '@voidhash/mimic-effect';
import { PaywallService } from '@voidhash/core/services';
import { Db } from '@voidhash/db/effect';
import { Effect, Layer } from 'effect';

// Custom auth layer - validates tokens via PaywallService
const PaywallMimicAuthLayer = MimicAuthService.layerEffect(
  Effect.gen(function* () {
    const paywallService = yield* PaywallService;
    return MimicAuthService.makeEffect((token: string) =>
      paywallService
        .validateEditToken(token)
        .pipe(
          Effect.map((result) => {
            if (!result) {
              return { success: false as const, error: 'Invalid or expired token' };
            }
            return {
              success: true as const,
              userId: result.userId
            };
          }),
          Effect.catchAll(() =>
            Effect.succeed({ success: false as const, error: 'Token validation failed' })
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
export const MimicPaywallRouteLayer = MimicServer.layerHttpLayerRouter({
  basePath: '/mimic/paywall',
  schema: {} as any, // Placeholder - will be replaced with actual schema
  authLayer: PaywallMimicAuthLayer.pipe(
    Layer.provide(PaywallService.Default),
    Layer.provide(Db.Default)
  )
});
