import { AuthSession } from "@/lib/effect/auth";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { Data, Effect, pipe, Schema } from "effect";
import { generateId } from "@/lib/id/generate";
import { ProductRepository } from "../product.repository";
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

export class InvalidConfigurationError extends Data.TaggedError(
	"InvalidConfigurationError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const createPaymentProviderProductInputSchema = Schema.Struct({
	productId: Schema.String,
	paymentProviderConfigurationId: Schema.String,
	configuration: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
});

type CreatePaymentProviderProductInput = Schema.Schema.Type<
	typeof createPaymentProviderProductInputSchema
>;

export const createPaymentProviderProduct = (
	inputUnsafe: CreatePaymentProviderProductInput
) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const productRepository = yield* ProductRepository;
			const environment = yield* Environment;
			const db = yield* Db;
			const input = Schema.decodeUnknownSync(
				createPaymentProviderProductInputSchema
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
				`User ${session?.user?.id} is not authorized to create payment provider products for project ${product.projectId}`
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

			// Validate configuration
			const parsedConfiguration = yield* Effect.try({
				try: () => provider.getProductConfigurationSchema().parse(input.configuration),
				catch: (error) =>
					new InvalidConfigurationError({
						message: `Invalid configuration for provider ${providerConfiguration.providerId}: ${error}`,
						cause: error,
					}),
			});

			return yield* db.transaction((tx) => TransactionContext.provide(tx)(Effect.gen(function* () {
			// Deactivate other provider products for this product
			yield* productRepository.deactivateOtherProviderProducts({
				productId: product.id,
				paymentProviderConfigurationId: input.paymentProviderConfigurationId,
			});

			// Create new provider product
			const newProviderProduct = {
				id: generateId("paymentProviderProduct"),
				productId: product.id,
				paymentProviderConfigurationId: providerConfiguration.id,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				providerProductKey: provider.createProductKey(parsedConfiguration as any),
				environment,
				configuration: parsedConfiguration,
				isActive: true,
			};

			yield* productRepository.createPaymentProviderProduct(newProviderProduct);
			yield* Effect.log(
				`Created payment provider product ${newProviderProduct.id} for product ${product.id}`
			);
	
			return yield* Effect.succeed(newProviderProduct);
		})))

		}),
		Environment.withEnvironment(),
		AuthSession.withAuthSession()
	);
