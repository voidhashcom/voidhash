import { createServiceFunction } from "@/lib/service-function";
import {
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib/constants";
import { err } from "neverthrow";
import { getPaywallWithProductsByLocationSlugQuery } from "../raw-queries";
import { z } from "zod";
import { hasEnvironment, isAuthenticated } from "@/lib/middlewares";
import { PaywallProduct } from "@voidhash/db";
import { asfn } from "@/lib/neverthrow";

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
		webCheckoutPaymentProviderConfigurationProductId: string | null;
	}[];
};

export const sdkGetPaywallByLocation = createServiceFunction()
	.input(
		z.object({
			locationSlug: z.string(),
			nativePaymentProviderId: z.string().optional(),
		})
	)
	.use(isAuthenticated)
	.use(hasEnvironment)
	.function(
		asfn<GetPaywallByLocationError>()((assert) => async ({ input, ctx }) => {
			const appUserId = ctx.session?.customer?.appUserId;
			if (!appUserId) {
				assert(
					err({
						code: "UNAUTHORIZED",
						message: "App user ID not found",
					})
				);
			}

			const projectId = ctx.session?.projects[0]?.id;
			if (!projectId) {
				assert(
					err({
						code: "INTERNAL_SERVER_ERROR",
						message: "Project ID not found after authentication",
						originalError: new Error(
							"Project ID not found after authentication"
						),
					})
				);
			}

			const paywall = assert(
				await getPaywallWithProductsByLocationSlugQuery(
					ctx,
					input.locationSlug,
					ctx.session.environment
				)
			);

			const environment = ctx.session.environment;

			const paywallProducts = paywall.paywallProducts.map((paywallProduct) => {
				const product = paywallProduct.product;

				const nativePurchaseAvailable = input.nativePaymentProviderId
					? checkNativePurchaseAvailability({
							environment,
							paywallProduct,
						})
					: false;

				const webCheckoutAvailable = checkWebCheckoutAvailability({
					environment,
					paywallProduct,
				});

				return {
					paywallProductId: paywallProduct.id,
					productId: product.id,
					displayName: paywallProduct.displayName,
					price: 100, // TODO: Get real price
					nativePurchaseAvailable,
					webCheckoutAvailable,
					webCheckoutPaymentProviderConfigurationProductId: webCheckoutAvailable
						? paywallProduct.webCheckoutPaymentProviderConfigurationProductId
						: null,
				};
			});

			const response: PaywallResponse = {
				paywallId: paywall.id,
				paywallProducts,
			};

			return response;
		})
	);

const checkNativePurchaseAvailability = (options: {
	environment: string;
	paywallProduct: PaywallProduct;
}) => {
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
