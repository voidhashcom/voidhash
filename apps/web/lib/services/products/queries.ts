import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { z } from "zod";
import { product, db } from "@voidhash/db";
import { eq } from "drizzle-orm";
import {
	getProductsQuery,
	getProviderProductByPrimaryKeyQuery,
	getProviderProductsByProductIdQuery,
} from "./raw-queries";
import { cache } from "react";

export const getProductsInputSchema = z.object({
	projectId: z.string(),
});

export const getProducts = cache(
	createServiceFunction()
		.input(getProductsInputSchema)
		.function(async ({ input, ctx }) => {
			const authenticatedContext = await authenticateContext(ctx);
			if (!hasProjectPermission(authenticatedContext, input.projectId, "")) {
				return [];
			}

			const products = await getProductsQuery(input.projectId);
			return products;
		})
);

export const getProductById = cache(
	createServiceFunction()
		.input(z.object({ id: z.string() }))
		.function(async ({ input, ctx }) => {
			const authenticatedContext = await authenticateContext(ctx);
			const productResult = await db.query.product.findFirst({
				where: eq(product.id, input.id),
			});

			if (!productResult) {
				return null;
			}

			if (
				!hasProjectPermission(authenticatedContext, productResult.projectId, "")
			) {
				return null;
			}

			return productResult;
		})
);

export const getProviderProductByPrimaryKey = cache(
	createServiceFunction()
		.input(
			z.object({
				projectId: z.string(),
				providerId: z.string(),
				productProviderKey: z.string(),
			})
		)
		.function(async ({ input, ctx }) => {
			const authenticatedContext = await authenticateContext(ctx);
			const providerProduct = await getProviderProductByPrimaryKeyQuery(
				input.projectId,
				input.providerId,
				input.productProviderKey
			);

			if (!providerProduct) {
				return null;
			}

			// Auth check
			const product = await getProductById({
				ctx: authenticatedContext,
				input: { id: providerProduct.productId },
			});

			if (!product) {
				return null;
			}

			if (!hasProjectPermission(authenticatedContext, product.projectId, "")) {
				return null;
			}

			return providerProduct;
		})
);

export const getProviderProductsByProductId = cache(
	createServiceFunction()
		.input(z.object({ productId: z.string() }))
		.function(async ({ input, ctx }) => {
			const authenticatedContext = await authenticateContext(ctx);
			const product = await getProductById({
				ctx: authenticatedContext,
				input: { id: input.productId },
			});

			if (!product) {
				return [];
			}

			if (!hasProjectPermission(authenticatedContext, product.projectId, "")) {
				return [];
			}

			const providerProducts = await getProviderProductsByProductIdQuery(
				input.productId
			);

			return providerProducts;
		})
);
