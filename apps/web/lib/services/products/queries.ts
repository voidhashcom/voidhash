import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { z } from "zod";
import { products } from "@voidhash/db";
import { eq } from "drizzle-orm";
import {
	getProductPerksByProductIdQuery,
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

			const products = await getProductsQuery(
				authenticatedContext,
				input.projectId
			);
			return products;
		}).invoke
);

export const getProductById = cache(
	createServiceFunction()
		.input(z.object({ id: z.string() }))
		.function(async ({ input, ctx }) => {
			const authenticatedContext = await authenticateContext(ctx);
			const productResult = await ctx.db.query.products.findFirst({
				where: eq(products.id, input.id),
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
		}).invoke
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
				authenticatedContext,
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
		}).invoke
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
				authenticatedContext,
				input.productId
			);

			return providerProducts;
		}).invoke
);

export const getProductPerksByProductId = cache(
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

			const productPerks = await getProductPerksByProductIdQuery(
				authenticatedContext,
				input.productId
			);

			return productPerks;
		}).invoke
);
