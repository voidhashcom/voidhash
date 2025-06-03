import { createServiceFunction } from "@/lib/service-function";
import {
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib/constants";
import { Result, err, ok } from "neverthrow";
import { getPaywallWithProductsByLocationSlugQuery } from "../raw-queries";
import { z } from "zod";
import { hasEnvironment, isAuthenticated } from "@/lib/middlewares";
import { PaywallProduct } from "@voidhash/db";

type GetPaywallByLocationError =
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashUnauthorizedError;

type PaywallResponse = {
	paywallId: string;
	paywallProducts: {
		paywallProductId: string;
		productId: string;
		price: number;
		displayName: string;
		nativePurchaseAvailable: boolean;
		webCheckoutAvailable: boolean;
	}[];
};

export const sdkGetPaywallByLocation = createServiceFunction()
	.input(
		z.object({
			locationSlug: z.string(),
		})
	)
	.use(isAuthenticated)
	.use(hasEnvironment)
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
				input.locationSlug,
				ctx.session.environment
			);
			if (paywall.isErr()) {
				return err(paywall.error);
			}

			const environment = ctx.session.environment;

			const paywallProducts = paywall.value.paywallProducts.map(
				(paywallProduct) => {
					const product = paywallProduct.product;

					const nativePurchaseAvailable = checkNativePurchaseAvailability({
						environment,
						paywallProduct,
					});
					const webCheckoutAvailable = checkWebCheckoutAvailability({
						environment,
						paywallProduct,
					});

					console.log(nativePurchaseAvailable, webCheckoutAvailable);

					return {
						paywallProductId: paywallProduct.id,
						productId: product.id,
						displayName: paywallProduct.displayName,
						price: 100, // TODO: Get real price
						nativePurchaseAvailable,
						webCheckoutAvailable,
					};
				}
			);

			const response: PaywallResponse = {
				paywallId: paywall.value.id,
				paywallProducts,
			};

			return ok(response);
		}
	);

const checkNativePurchaseAvailability = (options: {
	environment: string;
	paywallProduct: PaywallProduct;
}) => {
	if (options.environment === "testing") {
		return false;
	}

	return options.paywallProduct.enableNativePurchase;
};

const checkWebCheckoutAvailability = (options: {
	environment: string;
	paywallProduct: PaywallProduct;
}) => {
	if (options.environment === "testing") {
		return true;
	}

	return options.paywallProduct.enableWebCheckout;
};
