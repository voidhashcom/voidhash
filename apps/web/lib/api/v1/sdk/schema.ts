import { z } from "zod";

export const sdkGetPaywallByLocationParamsSchema = z.object({
	location: z.string(),
});

export const sdkPaywallResponseSchema = z
	.object({
		paywallId: z.string(),
		name: z.string(),
	})
	.openapi({
		ref: "SdkPaywall",
	});
