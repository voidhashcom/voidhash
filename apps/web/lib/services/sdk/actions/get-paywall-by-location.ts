import { createServiceFunction } from "@/lib/service-function";
import {
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib/constants";
import { Result, err, ok } from "neverthrow";
import { getPaywallWithProductsByLocationSlugQuery } from "../raw-queries";
import { z } from "zod";
import { isAuthenticated } from "@/lib/middlewares";

type GetPaywallByLocationError =
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashUnauthorizedError;

type PaywallResponse = {
	id: string;
	paywallProducts: {
		productId: string;
		displayName: string;
		price: number | null;
	}[];
};

export const sdkGetPaywallByLocation = createServiceFunction()
	.input(
		z.object({
			locationSlug: z.string(),
		})
	)
	.use(isAuthenticated)
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<PaywallResponse, GetPaywallByLocationError>> => {
			const appUserId = ctx.session?.customer?.appUserId;

			if (!appUserId) {
				return err({
					code: "UNAUTHORIZED",
					message: "App user ID not found",
				});
			}

			const projectId = ctx.session?.projects[0]?.id;
			if (!projectId) {
				return err({
					code: "INTERNAL_SERVER_ERROR",
					message: "Project ID not found after authentication",
					originalError: new Error("Project ID not found after authentication"),
				});
			}

			const paywall = await getPaywallWithProductsByLocationSlugQuery(
				ctx,
				input.locationSlug
			);
			if (paywall.isErr()) {
				return err(paywall.error);
			}

			const response: PaywallResponse = {
				id: paywall.value.id,
				paywallProducts: paywall.value.paywallProducts.map(
					(paywallProduct) => ({
						productId: paywallProduct.product.id,
						displayName: paywallProduct.displayName,
						price: null,
					})
				),
			};

			return ok(response);
		}
	);
