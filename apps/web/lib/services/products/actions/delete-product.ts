import { AuthSession } from "@/lib/effect/auth";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { Data, Effect, pipe, Schema } from "effect";
import { ProductRepository } from "../product-repository";

export class ProductNotFound extends Data.TaggedError("ProductNotFound")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const deleteProductInputSchema = Schema.Struct({
	productId: Schema.String,
});

type DeleteProductInput = Schema.Schema.Type<typeof deleteProductInputSchema>;

export const deleteProduct = (inputUnsafe: DeleteProductInput) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const productRepository = yield* ProductRepository;
			const input = Schema.decodeUnknownSync(deleteProductInputSchema)(
				inputUnsafe
			);

			// Get the product to check authorization
			const existingProduct = yield* productRepository.getProductById(input.productId);
			if (!existingProduct) {
				return yield* Effect.fail(
					new ProductNotFound({
						message: `Product ${input.productId} not found`,
					})
				);
			}

			// SECURITY: Authorization check
			yield* checkProjectPermission(
				existingProduct.projectId,
				"project:all",
				`User ${session?.user?.id} is not authorized to delete product ${input.productId} for project ${existingProduct.projectId}`
			);

			yield* productRepository.deleteProduct(input.productId);

			yield* Effect.log(
				`Deleted product ${input.productId} for project ${existingProduct.projectId}`
			);

			return yield* Effect.succeed(undefined);
		}),
		AuthSession.withAuthSession()
	);
