import { AuthSession } from "@/lib/effect/auth";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { Data, Effect, pipe, Schema } from "effect";
import { ProductRepository } from "../product-repository";
import { Environment } from "@/lib/effect/environment";
import { Db, TransactionContext } from "@/lib/effect/db";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";

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

export class PaymentProviderNotFound extends Data.TaggedError(
	"PaymentProviderNotFound"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const setActivePaymentProviderProductInputSchema = Schema.Struct({
	productId: Schema.String,
	providerProductKey: Schema.String,
	paymentProviderConfigurationId: Schema.String,
});

type SetActivePaymentProviderProductInput = Schema.Schema.Type<
	typeof setActivePaymentProviderProductInputSchema
>;

export const setActivePaymentProviderProduct = (
	inputUnsafe: SetActivePaymentProviderProductInput
) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const productRepository = yield* ProductRepository;
			const db = yield* Db;
			const input = Schema.decodeUnknownSync(
				setActivePaymentProviderProductInputSchema
			)(inputUnsafe);

			// Get product and provider configuration in parallel
			const [product, providerConfiguration] = yield* Effect.all([
				productRepository.getProductById(input.productId),
				db.use(async (dbInstance) => {
					return await dbInstance.query.paymentProviderConfigurations.findFirst({
						where: (configs, { eq }) =>
							eq(configs.id, input.paymentProviderConfigurationId),
					});
				}),
			]);

			if (!product) {
				return yield* Effect.fail(
					new ProductNotFound({
						message: `Product ${input.productId} not found`,
					})
				);
			}

			if (!providerConfiguration) {
				return yield* Effect.fail(
					new PaymentProviderConfigurationNotFound({
						message: `Payment provider configuration ${input.paymentProviderConfigurationId} not found`,
					})
				);
			}

			// SECURITY: Authorization checks
			yield* checkProjectPermission(
				product.projectId,
				"project:all",
				`User ${session?.user?.id} is not authorized to update payment provider products for project ${product.projectId}`
			);

			yield* checkProjectPermission(
				providerConfiguration.projectId,
				"project:all",
				`User ${session?.user?.id} is not authorized to access payment provider configuration for project ${providerConfiguration.projectId}`
			);

			// Find the payment provider
			const provider = paymentProviders.find(
				(p) => p.getId() === providerConfiguration.providerId
			);
			if (!provider) {
				return yield* Effect.fail(
					new PaymentProviderNotFound({
						message: `Payment provider ${providerConfiguration.providerId} not found`,
					})
				);
			}

			return yield* db.transaction((tx) =>
				TransactionContext.provide(tx)(Effect.gen(function* () {
					// Deactivate other provider products for this product/configuration
					yield* productRepository.deactivateOtherProviderProducts({
						productId: input.productId,
						paymentProviderConfigurationId: input.paymentProviderConfigurationId,
						excludeProviderProductKey: input.providerProductKey,
					});

					// Activate the selected provider product
					yield* productRepository.setActivePaymentProviderProduct({
						productId: input.productId,
						paymentProviderConfigurationId: input.paymentProviderConfigurationId,
						providerProductKey: input.providerProductKey,
					});

					yield* Effect.log(
						`Set active payment provider product ${input.providerProductKey} for product ${input.productId}`
					);

					return yield* Effect.succeed(undefined);
				}))
			);
		}),
		Environment.withEnvironment(),
		AuthSession.withAuthSession()
	);
