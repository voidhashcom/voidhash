import { AuthSession } from "@/lib/effect/auth";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { Data, Effect, pipe, Schema } from "effect";
import { ProductRepository } from "../product.repository";

export class ProductNotFound extends Data.TaggedError("ProductNotFound")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const updateProductInputSchema = Schema.Struct({
	productId: Schema.String,
	name: Schema.String.pipe(Schema.minLength(3), Schema.maxLength(32)),
});

type UpdateProductInput = Schema.Schema.Type<typeof updateProductInputSchema>;

export const updateProduct = (inputUnsafe: UpdateProductInput) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const productRepository = yield* ProductRepository;
			const input = Schema.decodeUnknownSync(updateProductInputSchema)(
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
				`User ${session?.user?.id} is not authorized to update product ${input.productId} for project ${existingProduct.projectId}`
			);

			yield* productRepository.updateProduct({
				id: input.productId,
				name: input.name,
			});

			yield* Effect.log(
				`Updated product ${input.productId} for project ${existingProduct.projectId}`
			);

			return yield* Effect.succeed(undefined);
		}),
		AuthSession.withAuthSession()
	);
