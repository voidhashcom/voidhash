import {
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import {
	fromUnknownThrow,
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib";
import { z } from "zod";
import { productPerks } from "@voidhash/db";
import { generateId } from "@/lib/id/generate";
import { err, ok, Result } from "neverthrow";
import { getProductByIdQuery } from "../raw-queries";
import { isAuthenticated } from "@/lib/middlewares";
import { NextjsRuntime, toNeverthrow } from "@/lib/effect/runtimes/nextjs";
import { PerkService } from "../../perks/perk-service";
import { Effect, pipe } from "effect";

export const createProductPerkInputSchema = z.object({
	productId: z.string(),
	perkId: z.string(),
});

type CreateProductPerkError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError;

export const createProductPerk = createServiceFunction()
	.input(createProductPerkInputSchema)
	.use(isAuthenticated)
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<{ id: string }, CreateProductPerkError>> => {
			const product = await getProductByIdQuery(ctx, input.productId);

			if (product.isErr()) {
				return err(product.error);
			}

			if (!hasProjectPermission(ctx, product.value.projectId, "project:all")) {
				return err({
					code: "FORBIDDEN",
					message: "You are not authorized to create payment provider products",
				});
			}

			const perk = await NextjsRuntime.runPromise(
				pipe(
					PerkService,
					Effect.flatMap((perkService) =>
						perkService.getPerkById(input.perkId)
					),
					toNeverthrow
				)
			);
			if (perk.isErr()) {
				return err(perk.error);
			}

			const newProductPerk = {
				id: generateId("productPerk"),
				productId: product.value.id,
				perkId: input.perkId,
			} satisfies typeof productPerks.$inferInsert;

			try {
				await ctx.db.insert(productPerks).values(newProductPerk);
				return ok({ id: newProductPerk.id });
			} catch (e) {
				return err(fromUnknownThrow(e));
			}
		}
	);
