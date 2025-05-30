import {
	createServiceFunction,
	authenticateContext,
} from "@/lib/service-function";
import {
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib/constants";
import { Result, err, ok } from "neverthrow";
import { getPaywallWithProductsByLocationSlugQuery } from "../raw-queries";
import { z } from "zod";

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
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<PaywallResponse, GetPaywallByLocationError>> => {
			const authenticatedContext = await authenticateContext(ctx);

			if (authenticatedContext.isErr()) {
				return err(authenticatedContext.error);
			}

			const appUserId = authenticatedContext.value.session?.customer?.appUserId;

			if (!appUserId) {
				return err({
					code: "UNAUTHORIZED",
					message: "App user ID not found",
				});
			}

			const projectId = authenticatedContext.value.session?.projects[0]?.id;
			if (!projectId) {
				return err({
					code: "INTERNAL_SERVER_ERROR",
					message: "Project ID not found after authentication",
					originalError: new Error("Project ID not found after authentication"),
				});
			}

			const paywall = await getPaywallWithProductsByLocationSlugQuery(
				authenticatedContext.value,
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
