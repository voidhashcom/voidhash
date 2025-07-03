import { AuthSession } from "@/lib/effect/auth";
import { Environment } from "@/lib/effect/environment";
import { Data, Effect, pipe, Schema } from "effect";
import { NotFoundError, UnauthorizedError } from "@/lib/effect/errors";
import { PaywallProduct } from "@voidhash/db";
import { PaywallRepository } from "../../paywalls/paywall.repository";
import {
	EnvironmentValue,
	Environment as EnvironmentEnum,
} from "@voidhash/lib/index";

export class PaywallNotFound extends Data.TaggedError("PaywallNotFound")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const getPaywallByLocationInputSchema = Schema.Struct({
	locationSlug: Schema.String,
	nativePaymentProviderId: Schema.optional(Schema.String),
});

type GetPaywallByLocationInput = Schema.Schema.Type<
	typeof getPaywallByLocationInputSchema
>;

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

export const getPaywallByLocation = (inputUnsafe: GetPaywallByLocationInput) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const environment = yield* Environment;
			const paywallRepository = yield* PaywallRepository;

			const input = Schema.decodeUnknownSync(getPaywallByLocationInputSchema)(
				inputUnsafe
			);

			const appUserId = session?.customer?.appUserId;
			if (!appUserId) {
				return yield* Effect.fail(
					new UnauthorizedError({
						message: "App user ID not found",
					})
				);
			}

			const projectId = session?.projects[0]?.id;
			if (!projectId) {
				return yield* Effect.fail(
					new NotFoundError({
						message: "Project ID not found after authentication",
					})
				);
			}

			// Get paywall with products by location slug
			const paywallLocation =
				yield* paywallRepository.getPaywallWithProductsByLocationSlug({
					locationSlug: input.locationSlug,
					environment,
				});

			if (!paywallLocation?.defaultPaywall) {
				return yield* Effect.fail(
					new PaywallNotFound({
						message: "Paywall not found",
					})
				);
			}

			const paywall = paywallLocation.defaultPaywall;

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

			yield* Effect.log(
				`Retrieved paywall ${paywall.id} for location ${input.locationSlug}`
			);

			return yield* Effect.succeed(response);
		}),
		Environment.withEnvironment(),
		AuthSession.withAuthSession()
	);

const checkNativePurchaseAvailability = (options: {
	environment: EnvironmentValue;
	paywallProduct: PaywallProduct;
}) => {
	return options.paywallProduct.enableNativePurchase;
};

const checkWebCheckoutAvailability = (options: {
	environment: EnvironmentValue;
	paywallProduct: PaywallProduct;
}) => {
	if (options.environment === EnvironmentEnum.Testing) {
		return true;
	}

	return options.paywallProduct.enableWebCheckout;
};
