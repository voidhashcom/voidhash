import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { createId, UnauthorizedError } from "@voidhash/lib";
import { z } from "zod";
import { product, db } from "@voidhash/db";

export const createProductInputSchema = z.object({
	projectId: z.string(),
	name: z
		.string()
		.min(3, "Name must be at least 3 characters long")
		.max(32, "Name must be less than 32 characters"),
});

export const createProduct = createServiceFunction()
	.input(createProductInputSchema)
	.function(async ({ input, ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);
		if (!hasProjectPermission(authenticatedContext, input.projectId, "")) {
			throw new UnauthorizedError("You are not authorized to create products");
		}

		const newProduct = {
			id: createId(),
			projectId: input.projectId,
			name: input.name,
		};
		await db.insert(product).values(newProduct);

		return newProduct;
	});
