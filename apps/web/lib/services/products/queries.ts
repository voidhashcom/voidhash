import { createServiceFunction } from "@/lib/service-function";
import { z } from "zod";
import { product, db } from "@voidhash/db";
import { eq } from "drizzle-orm";

export const getProductsInputSchema = z.object({
	projectId: z.string(),
});

export const getProducts = createServiceFunction()
	.input(getProductsInputSchema)
	.function(async ({ input }) => {
		return db
			.select()
			.from(product)
			.where(eq(product.projectId, input.projectId));
	});
