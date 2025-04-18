import { createServiceFunction } from "@/lib/service-function";
import { z } from "zod";
import { product, db } from "@voidhash/db";
import { eq } from "drizzle-orm";
import { getProjectById } from "../projects/queries";
import { NotFoundError } from "@voidhash/lib/constants";
import { getProductsQuery } from "./raw-queries";

export const getProductsInputSchema = z.object({
	projectId: z.string(),
});

export const getProducts = createServiceFunction()
	.input(getProductsInputSchema)
	.function(async ({ input, ctx }) => {
		// Get project due to permissions
		const projectPromise = getProjectById({
			ctx,
			input: { id: input.projectId },
		});

		const productsPromise = getProductsQuery(input.projectId);

		const [project, products] = await Promise.all([
			projectPromise,
			productsPromise,
		]);

		if (!project) {
			throw new NotFoundError("Project not found");
		}

		return products;
	});

export const getProductById = createServiceFunction()
	.input(z.object({ id: z.string() }))
	.function(async ({ input, ctx }) => {
		const productResult = await db.query.product.findFirst({
			where: eq(product.id, input.id),
		});

		if (!productResult) {
			throw new NotFoundError("Product not found");
		}

		const project = await getProjectById({
			ctx,
			input: { id: productResult.projectId },
		});

		if (!project) {
			throw new NotFoundError("Project not found");
		}

		return productResult;
	});
