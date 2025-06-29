import { AuthSession } from "@/lib/effect/auth";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { Data, Effect, pipe, Schema } from "effect";
import { ProductRepository } from "../product-repository";

export class ProductNotFound extends Data.TaggedError("ProductNotFound")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const deletePaymentProviderProductInputSchema = Schema.Struct({
	productId: Schema.String,
	paymentProviderConfigurationId: Schema.String,
	providerProductKey: Schema.String,
});

type DeletePaymentProviderProductInput = Schema.Schema.Type<
	typeof deletePaymentProviderProductInputSchema
>;

export const deletePaymentProviderProduct = (
	inputUnsafe: DeletePaymentProviderProductInput
) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const productRepository = yield* ProductRepository;
			const input = Schema.decodeUnknownSync(
				deletePaymentProviderProductInputSchema
			)(inputUnsafe);

			// Get the product to check authorization
			const product = yield* productRepository.getProductById(input.productId);
			if (!product) {
				return yield* Effect.fail(
					new ProductNotFound({
						message: `Product ${input.productId} not found`,
					})
				);
			}

			// SECURITY: Authorization check
			yield* checkProjectPermission(
				product.projectId,
				"project:all",
				`User ${session?.user?.id} is not authorized to delete payment provider products for project ${product.projectId}`
			);

			yield* productRepository.deletePaymentProviderProduct({
				productId: input.productId,
				paymentProviderConfigurationId: input.paymentProviderConfigurationId,
				providerProductKey: input.providerProductKey,
			});

			yield* Effect.log(
				`Deleted payment provider product for product ${input.productId}`
			);

			return yield* Effect.succeed(undefined);
		}),
		AuthSession.withAuthSession()
	);
