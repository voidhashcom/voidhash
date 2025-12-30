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
	Effect.gen(function* () {
		const paywallService = yield* PaywallService;
		return MimicAuthService.makeEffect((token: string) =>
			paywallService.validateEditToken(token).pipe(
				Effect.map((result) => {
					console.log("token", token);
					console.log("result", result);
					if (!result) {
						return {
							success: false as const,
							error: "Invalid or expired token",
						};
					}
					return {
						success: true as const,
						userId: result.userId,
					};
				}),
				Effect.catchAll(() =>
					Effect.succeed({
						success: false as const,
						error: "Token validation failed",
					}),
				),
			),
		);
	}),
);

/**
 * Mimic Paywall route layer
 *
 * Handles WebSocket connections at /mimic/paywall/:documentId
 * with short-lived token authentication.
 */
export const MimicPaywallRouteLayer = MimicServer.layerHttpLayerRouter(
	Effect.gen(function* () {
		const paywallService = yield* PaywallService;
		return {
			basePath: "/mimic/paywall-designer",
			schema: PaywallDesignerDocument,
			presence: PresenceSchema,
			authLayer: PaywallMimicAuthLayer.pipe(
				Layer.provide(PaywallService.Default),
				Layer.provide(Db.Default),
			),
			initial: (ctx: MimicConfig.InitialContext) =>
				// biome-ignore lint/correctness/useYield: We don't need to yield here
				Effect.gen(function* () {
					// TODO: Get paywall from database. We need to add support for errors in mimic
					// const paywall = yield* paywallService
					// 	.getPaywallById(ctx.documentId)
					// 	.pipe(Effect.catchAll());
					return {
						type: "root" as const,
						name: "Untitled Paywall",
						children: [
							{
								type: "screen" as const,
								name: "root",
								style: {
									x: 0,
									y: 0,
									width: 390,
									height: 844,
									backgroundColor: "#ffffff",
								},
								children: [],
							},
						],
					};
				}),
		};
	}),
);
