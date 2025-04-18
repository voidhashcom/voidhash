import { createServiceFunction } from "@/lib/service-function";
import { createId, NotFoundError } from "@voidhash/lib";
import { z } from "zod";
import { getProjectById } from "../projects/queries";
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
		const project = await getProjectById({
			ctx,
			input: { id: input.projectId },
		});
		if (!project) {
			throw new NotFoundError("Project not found");
		}

		const newProduct = {
			id: createId(),
			projectId: project.id,
			name: input.name,
		};
		await db.insert(product).values(newProduct);
		ctx.cache.invalidate(`products_${project.id}`);
		return newProduct;
	});
