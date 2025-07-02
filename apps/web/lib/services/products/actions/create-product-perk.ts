import { AuthSession } from "@/lib/effect/auth";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { Data, Effect, pipe, Schema } from "effect";
import { generateId } from "@/lib/id/generate";
import { ProductRepository } from "../product.repository";
import { PerkRepository } from "../../perks/perk.repository";

export class ProductNotFound extends Data.TaggedError("ProductNotFound")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class PerkNotFound extends Data.TaggedError("PerkNotFound")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const createProductPerkInputSchema = Schema.Struct({
	productId: Schema.String,
	perkId: Schema.String,
});

type CreateProductPerkInput = Schema.Schema.Type<typeof createProductPerkInputSchema>;

export const createProductPerk = (inputUnsafe: CreateProductPerkInput) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const productRepository = yield* ProductRepository;
			const perkRepository = yield* PerkRepository;
			const input = Schema.decodeUnknownSync(createProductPerkInputSchema)(
				inputUnsafe
			);

			// Get product to check authorization
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
				`User ${session?.user?.id} is not authorized to create product perks for project ${product.projectId}`
			);

			// Validate perk exists (this also checks authorization)
			const perk = yield* perkRepository.getPerkById(input.perkId);
			if (!perk) {
				return yield* Effect.fail(
					new PerkNotFound({
						message: `Perk ${input.perkId} not found`,
					})
				);
			}

			// SECURITY: Authorization check
			yield* checkProjectPermission(
				perk.projectId,
				"project:all",
				`User ${session?.user?.id} is not authorized to create product perks in project ${product.projectId}`
			);

			const newProductPerk = {
				id: generateId("productPerk"),
				productId: input.productId,
				perkId: input.perkId,
			};

			yield* productRepository.createProductPerk(newProductPerk);

			yield* Effect.log(
				`Created product perk ${newProductPerk.id} for product ${input.productId}`
			);

			return yield* Effect.succeed({ id: newProductPerk.id });
		}),
		AuthSession.withAuthSession()
	);
