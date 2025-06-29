import { AuthSession } from "@/lib/effect/auth";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { Data, Effect, pipe, Schema } from "effect";
import { PaywallRepository } from "../paywall.repository";
import { generateId } from "@/lib/id/generate";
import { Db, TransactionContext } from "@/lib/effect/db";

export class PaywallNotFound extends Data.TaggedError("PaywallNotFound")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class ProductNotFound extends Data.TaggedError("ProductNotFound")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class PaymentProviderConfigurationNotFound extends Data.TaggedError(
	"PaymentProviderConfigurationNotFound"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const updatePaywallInputSchema = Schema.Struct({
	paywallId: Schema.String,
	name: Schema.optional(Schema.String.pipe(Schema.minLength(3))),
	paywallProducts: Schema.optional(
		Schema.Array(
			Schema.Struct({
				productId: Schema.String.pipe(Schema.minLength(1)),
				displayName: Schema.String.pipe(Schema.minLength(2)),
				enableNativePurchase: Schema.Boolean,
				enableWebCheckout: Schema.Boolean,
				webCheckoutPaymentProviderConfigurationProductId: Schema.NullOr(Schema.String),
				order: Schema.Number,
			})
		)
	),
});

type UpdatePaywallInput = Schema.Schema.Type<typeof updatePaywallInputSchema>;

export const updatePaywall = (inputUnsafe: UpdatePaywallInput) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const paywallRepository = yield* PaywallRepository;
			const db = yield* Db;
			const input = Schema.decodeUnknownSync(updatePaywallInputSchema)(
				inputUnsafe
			);

			// First check if paywall exists
			const paywall = yield* paywallRepository.getPaywallById(input.paywallId);
			if (!paywall) {
				return yield* Effect.fail(
					new PaywallNotFound({
						message: `Paywall ${input.paywallId} not found`,
					})
				);
			}

			// SECURITY: Authorization check
			yield* checkProjectPermission(
				paywall.projectId,
				"project:all",
				`User ${session?.user?.id} is not authorized to update paywall ${input.paywallId} for project ${paywall.projectId}`
			);

			// Use transaction to update paywall and products
			yield* db.transaction((tx) => TransactionContext.provide(tx)(
				Effect.gen(function* () {
					// Update paywall name if provided
					if (input.name) {
						yield* paywallRepository.updatePaywall({
							id: paywall.id,
							name: input.name,
						});
					}

					// Update paywall products if provided
					if (input.paywallProducts) {
						// Delete existing paywall products
						yield* paywallRepository.deletePaywallProducts(paywall.id);

						// Get products with configurations
						const productIds = input.paywallProducts.map((p) => p.productId);
						const productsFromDb = yield* paywallRepository.getProductsWithConfigurations(productIds);

						// Validate products and insert new paywall products
						const sortedProducts = [...input.paywallProducts].sort((a, b) => a.order - b.order);
						for (const product of sortedProducts) {
							const existingProduct = productsFromDb.find((p) => p.id === product.productId);

							if (!existingProduct) {
								return yield* Effect.fail(
									new ProductNotFound({
										message: `Product with id ${product.productId} not found`,
									})
								);
							}

							const webCheckoutPaymentProviderConfigurationProduct =
								existingProduct.paymentProviderConfigurationProducts.find(
									(p) => p.id === product.webCheckoutPaymentProviderConfigurationProductId
								);

							if (
								product.enableWebCheckout &&
								!webCheckoutPaymentProviderConfigurationProduct
							) {
								return yield* Effect.fail(
									new PaymentProviderConfigurationNotFound({
										message: "Web checkout payment provider product configuration does not exist",
									})
								);
							}

							yield* paywallRepository.createPaywallProduct({
								id: generateId("paywallProduct"),
								displayName: product.displayName,
								order: product.order,
								paywallId: paywall.id,
								productId: existingProduct.id,
								enableNativePurchase: product.enableNativePurchase,
								enableWebCheckout: product.enableWebCheckout,
								webCheckoutPaymentProviderConfigurationProductId:
									product.webCheckoutPaymentProviderConfigurationProductId,
							});
						}
					}
				}))
			);

			yield* Effect.log(`Updated paywall ${input.paywallId}`);

			return yield* Effect.succeed(undefined);
		}),
		AuthSession.withAuthSession()
	);
