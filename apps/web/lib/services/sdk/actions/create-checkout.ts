import { AuthSession } from "@/lib/effect/auth";
import { Environment } from "@/lib/effect/environment";
import { Data, Effect, pipe, Schema } from "effect";
import { generateId } from "@/lib/id/generate";
import { ProductRepository } from "../../products/product-repository";
import { PaymentProviderRepository } from "../../payment-providers/payment-provider-repository";
import { devCheckoutPaymentProviderId } from "@/lib/payment-providers/dev-checkout/dev-checkout";
import { isAnonymousId } from "../utils";
import { NotFoundError, UnauthenticatedError } from "@/lib/effect/errors";
import { CHECKOUT_DOMAIN } from "@voidhash/lib";
import { Db, TransactionContext } from "@/lib/effect/db";
import { CustomerRepository } from "../../customers/customer-repository";
import { CheckoutSessionRepository } from "../../checkout-session/checkout-session-repository";
import { createAnonymousCustomer } from "../create-anonymous-customer";

export class PaymentProviderConfigurationNotFound extends Data.TaggedError(
	"PaymentProviderConfigurationNotFound"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class ProductNotFound extends Data.TaggedError("ProductNotFound")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const createCheckoutInputSchema = Schema.Struct({
	paymentProviderConfigurationProductId: Schema.String.pipe(Schema.minLength(1)),
	successCallbackUrl: Schema.String.pipe(Schema.minLength(1)),
	errorCallbackUrl: Schema.String.pipe(Schema.minLength(1)),
});

type CreateCheckoutInput = Schema.Schema.Type<typeof createCheckoutInputSchema>;

type CreateCheckoutResponse = {
	checkoutSessionId: string;
	checkoutUrl: string;
};

export const createCheckout = (inputUnsafe: CreateCheckoutInput) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const environment = yield* Environment;
			const productRepository = yield* ProductRepository;
			const customerRepository = yield* CustomerRepository;
			const checkoutSessionRepository = yield* CheckoutSessionRepository;
			const paymentProviderRepository = yield* PaymentProviderRepository;
			const db = yield* Db;

			const input = Schema.decodeUnknownSync(createCheckoutInputSchema)(
				inputUnsafe
			);

			const appUserId = session?.customer?.appUserId;
			if (!appUserId) {
				return yield* Effect.fail(
					new UnauthenticatedError({
						message: "App user ID not found",
					})
				);
			}

			const projectId = session?.projects[0]?.id;
			if (!projectId) {
				return yield* Effect.fail(
					new NotFoundError({
						message: "Project not found",
					})
				);
			}

			// Get payment provider configuration product
			const paymentProviderConfigurationProduct = yield* productRepository.getProviderProductById(
				input.paymentProviderConfigurationProductId
			);
			if (!paymentProviderConfigurationProduct) {
				return yield* Effect.fail(
					new ProductNotFound({
						message: "Payment provider configuration product not found",
					})
				);
			}

			// Get dev checkout payment provider configuration
			const devCheckoutConfiguration = yield* paymentProviderRepository.getExistingPaymentProviderConfigurationByProviderId({
				projectId,
				providerId: devCheckoutPaymentProviderId,
			});
			if (!devCheckoutConfiguration) {
				return yield* Effect.fail(
					new PaymentProviderConfigurationNotFound({
						message: "Dev checkout payment provider configuration not found",
					})
				);
			}

			const result = yield* db.transaction((tx) =>
				TransactionContext.provide(tx)(Effect.gen(function* () {
					// Get or create customer
					let customer = yield* customerRepository.getCustomerByAppUserId({
						projectId,
						appUserId,
						environment,
					});

					if (!customer && isAnonymousId(appUserId)) {
						const newCustomer = yield* createAnonymousCustomer({
							projectId,
							appUserId,
							origin: "ios", // TODO: Make this dynamic
							environment,
						});
						customer = newCustomer;
					}

					if (!customer) {
						return yield* Effect.fail(
							new NotFoundError({
								message: "Customer not found",
							})
						);
					}

					// Create checkout session
					const sessionId = generateId("checkoutSession");
					const sessionData = {
						id: sessionId,
						customerId: customer.id,
						paymentProviderConfigurationProductId: paymentProviderConfigurationProduct.id,
						successCallbackUrl: input.successCallbackUrl,
						errorCallbackUrl: input.errorCallbackUrl,
						createdAt: new Date(),
						updatedAt: new Date(),
					};

					yield* checkoutSessionRepository.createCheckoutSession(sessionData);

					return yield* Effect.succeed({
						checkoutSessionId: sessionId,
						checkoutUrl: `${CHECKOUT_DOMAIN}/dev-checkout/${sessionId}`,
					} satisfies CreateCheckoutResponse);
				}))
			);

			yield* Effect.log(
				`Created checkout session ${result.checkoutSessionId} for customer ${appUserId}`
			);

			return result;
		}),
		Environment.withEnvironment({
			projectId: inputUnsafe.paymentProviderConfigurationProductId, // TODO: Get from product
		}),
		AuthSession.withAuthSession()
	);
