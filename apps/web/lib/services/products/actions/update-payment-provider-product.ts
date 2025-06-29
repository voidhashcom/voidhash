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

export class ProviderProductNotFound extends Data.TaggedError(
	"ProviderProductNotFound"
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

export const updatePaymentProviderProductInputSchema = Schema.Struct({
	productId: Schema.String,
	providerProductKey: Schema.String,
	paymentProviderConfigurationId: Schema.String,
	configuration: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
});

type UpdatePaymentProviderProductInput = Schema.Schema.Type<
	typeof updatePaymentProviderProductInputSchema
>;

export const updatePaymentProviderProduct = (
	inputUnsafe: UpdatePaymentProviderProductInput
) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const productRepository = yield* ProductRepository;
			const environment = yield* Environment;
			const db = yield* Db;
			const input = Schema.decodeUnknownSync(
				updatePaymentProviderProductInputSchema
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

			// Validate configuration
			const parsedConfiguration = yield* Effect.try({
				try: () => provider.getProductConfigurationSchema().parse(input.configuration),
				catch: (error) =>
					new InvalidConfigurationError({
						message: `Invalid configuration for provider ${providerConfiguration.providerId}: ${error}`,
						cause: error,
					}),
			});

			// Get existing provider product
			const providerProduct = yield* productRepository.getProviderProductByPrimaryKey({
				paymentProviderConfigurationId: input.paymentProviderConfigurationId,
				providerProductKey: input.providerProductKey,
				environment,
			});

			if (!providerProduct) {
				return yield* Effect.fail(
					new ProviderProductNotFound({
						message: "Provider product not found",
					})
				);
			}

			const newProviderProductKey = provider.createProductKey(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				parsedConfiguration as any
			);

			return yield* db.transaction((tx) =>
				TransactionContext.provide(tx)(Effect.gen(function* () {
					yield* productRepository.updatePaymentProviderProduct({
						productId: input.productId,
						paymentProviderConfigurationId: input.paymentProviderConfigurationId,
						providerProductKey: input.providerProductKey,
						newProviderProductKey,
						configuration: parsedConfiguration,
					});

					yield* Effect.log(
						`Updated payment provider product for product ${input.productId}`
					);

					return yield* Effect.succeed(undefined);
				}))
			);
		}),
		Environment.withEnvironment(),
		AuthSession.withAuthSession()
	);
