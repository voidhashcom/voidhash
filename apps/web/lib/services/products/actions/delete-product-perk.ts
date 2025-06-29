import { AuthSession } from "@/lib/effect/auth";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { Data, Effect, pipe, Schema } from "effect";
import { ProductRepository } from "../product-repository";

export class ProductNotFound extends Data.TaggedError("ProductNotFound")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const deleteProductPerkInputSchema = Schema.Struct({
	productId: Schema.String,
	perkId: Schema.String,
});

type DeleteProductPerkInput = Schema.Schema.Type<
	typeof deleteProductPerkInputSchema
>;

export const deleteProductPerk = (inputUnsafe: DeleteProductPerkInput) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const productRepository = yield* ProductRepository;
			const input = Schema.decodeUnknownSync(deleteProductPerkInputSchema)(
				inputUnsafe
			);

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
				`User ${session?.user?.id} is not authorized to delete product perks for product ${input.productId}`
			);

			yield* productRepository.deleteProductPerk({
				productId: input.productId,
				perkId: input.perkId,
			});

			yield* Effect.log(
				`Deleted product perk ${input.perkId} from product ${input.productId}`
			);

			return yield* Effect.succeed(undefined);

			// TODO: Think about deleting already granted perks.
		}),
		AuthSession.withAuthSession()
	);
