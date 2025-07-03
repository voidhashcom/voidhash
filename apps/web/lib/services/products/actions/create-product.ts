import { AuthSession } from "@/lib/effect/auth";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { Data, Effect, pipe, Schema } from "effect";
import { generateId } from "@/lib/id/generate";
import { ProductRepository } from "../product.repository";
import { Environment } from "@/lib/effect/environment";
import { Db, TransactionContext } from "@/lib/effect/db";
import { Environment as EnvironmentEnum } from "@voidhash/lib/index";

import {
	devCheckout,
	devCheckoutPaymentProviderId,
} from "@/lib/payment-providers/dev-checkout/dev-checkout";

export class PaymentProviderConfigurationNotFoundError extends Data.TaggedError(
	"PaymentProviderConfigurationNotFound"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const createProductInputSchema = Schema.Struct({
	projectId: Schema.String,
	name: Schema.String.pipe(Schema.minLength(3), Schema.maxLength(32)),
});

type CreateProductInput = Schema.Schema.Type<typeof createProductInputSchema>;

export const createProduct = (inputUnsafe: CreateProductInput) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const productRepository = yield* ProductRepository;
			const environment = yield* Environment;
			const db = yield* Db;
			const input = Schema.decodeUnknownSync(createProductInputSchema)(
				inputUnsafe
			);

			// SECURITY: Authorization check
			yield* checkProjectPermission(
				input.projectId,
				"project:all",
				`User ${session?.user?.id} is not authorized to create products for project ${input.projectId}`
			);

			const productId = generateId("product");
			const newProduct = {
				id: productId,
				projectId: input.projectId,
				name: input.name,
				environment,
			};

			yield* db.transaction((tx) =>
				TransactionContext.provide(tx)(
					Effect.gen(function* () {
						// Create the product
						yield* productRepository.createProduct(newProduct);

						// For testing environment, create dev checkout configuration
						if (environment === EnvironmentEnum.Testing) {
							const devCheckoutConfig = yield* tx(async (dbTx) => {
								return await dbTx.query.paymentProviderConfigurations.findFirst(
									{
										where: (configs, { eq, and }) =>
											and(
												eq(configs.projectId, input.projectId),
												eq(configs.providerId, devCheckoutPaymentProviderId)
											),
									}
								);
							});

							if (!devCheckoutConfig) {
								return yield* Effect.fail(
									new PaymentProviderConfigurationNotFoundError({
										message: "Dev Checkout configuration not found",
									})
								);
							}

							yield* productRepository.createPaymentProviderProduct({
								id: generateId("paymentProviderProduct"),
								productId: productId,
								paymentProviderConfigurationId: devCheckoutConfig.id,
								providerProductKey: devCheckout.createProductKey({
									productId: productId,
								}),
								configuration: {
									productId: productId,
								},
								environment,
								isActive: true,
							});
						}
					})
				)
			);

			yield* Effect.log(
				`Created product ${productId} for project ${input.projectId}`
			);

			return yield* Effect.succeed({ id: productId });
		}),
		Environment.withEnvironment({
			projectId: inputUnsafe.projectId,
		}),
		AuthSession.withAuthSession()
	);
