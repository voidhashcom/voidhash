import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { z } from "zod";
import {
	Product,
	ProductPerk,
	ProductProviderConfiguration,
} from "@voidhash/db";
import {
	getProductPerksByProductIdQuery,
	getProductsQuery,
	getProductByIdQuery,
	getProviderProductByPrimaryKeyQuery,
	getProviderProductsByProductIdQuery,
} from "./raw-queries";
import { cache } from "react";
import { err, ok, Result } from "neverthrow";
import {
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
	VoidhashBadRequestError,
} from "@voidhash/lib/constants";

export const getProductsInputSchema = z.object({
	projectId: z.string(),
});

type GetProductsError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError;

export const getProducts = cache(
	createServiceFunction()
		.input(getProductsInputSchema)
		.function(
			async ({ input, ctx }): Promise<Result<Product[], GetProductsError>> => {
				const authenticatedContext = await authenticateContext(ctx);
				if (authenticatedContext.isErr()) {
					return err(authenticatedContext.error);
				}

				if (
					!hasProjectPermission(
						authenticatedContext.value,
						input.projectId,
						"project:all"
					)
				) {
					return err({
						code: "FORBIDDEN",
						message: "No permission to access products.",
					});
				}

				const productsResult = await getProductsQuery(
					authenticatedContext.value,
					input.projectId
				);

				if (productsResult.isErr()) {
					return err(productsResult.error);
				}

				return ok(productsResult.value);
			}
		).invoke
);

type GetProductByIdError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError;

export const getProductById = cache(
	createServiceFunction()
		.input(z.object({ id: z.string() }))
		.function(
			async ({ input, ctx }): Promise<Result<Product, GetProductByIdError>> => {
				const authenticatedContext = await authenticateContext(ctx);
				if (authenticatedContext.isErr()) {
					return err(authenticatedContext.error);
				}

				const productResult = await getProductByIdQuery(
					authenticatedContext.value,
					input.id
				);

				if (productResult.isErr()) {
					return err(productResult.error);
				}

				if (!productResult.value) {
					return err({
						code: "NOT_FOUND",
						message: "Product not found.",
						resource: "product",
						payload: { id: input.id },
					});
				}

				if (
					!hasProjectPermission(
						authenticatedContext.value,
						productResult.value.projectId,
						"project:all"
					)
				) {
					return err({
						code: "FORBIDDEN",
						message: "No permission to access product.",
					});
				}

				return ok(productResult.value);
			}
		).invoke
);

type GetProviderProductByPrimaryKeyError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashBadRequestError;

export const getProviderProductByPrimaryKey = cache(
	createServiceFunction()
		.input(
			z.object({
				projectId: z.string(),
				providerId: z.string(),
				productProviderKey: z.string(),
			})
		)
		.function(
			async ({
				input,
				ctx,
			}): Promise<
				Result<
					ProductProviderConfiguration,
					GetProviderProductByPrimaryKeyError
				>
			> => {
				const authenticatedContext = await authenticateContext(ctx);
				if (authenticatedContext.isErr()) {
					return err(authenticatedContext.error);
				}
				const providerProductResult = await getProviderProductByPrimaryKeyQuery(
					authenticatedContext.value,
					input.projectId,
					input.providerId,
					input.productProviderKey
				);

				if (providerProductResult.isErr()) {
					return err(providerProductResult.error);
				}

				if (!providerProductResult.value) {
					return err({
						code: "NOT_FOUND",
						message: "Provider product not found.",
						resource: "productProviderConfiguration",
						payload: { ...input },
					});
				}

				// Auth check
				const productResult = await getProductById({
					ctx: authenticatedContext.value,
					input: { id: providerProductResult.value.productId },
				});

				if (productResult.isErr()) {
					return err(productResult.error); // Propagate other errors
				}

				return ok(providerProductResult.value);
			}
		).invoke
);

type GetProviderProductsByProductIdError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashBadRequestError;

export const getProviderProductsByProductId = cache(
	createServiceFunction()
		.input(z.object({ productId: z.string() }))
		.function(
			async ({
				input,
				ctx,
			}): Promise<
				Result<
					ProductProviderConfiguration[],
					GetProviderProductsByProductIdError
				>
			> => {
				const authenticatedContext = await authenticateContext(ctx);
				if (authenticatedContext.isErr()) {
					return err(authenticatedContext.error);
				}

				// Auth check
				const productResult = await getProductById({
					ctx: authenticatedContext.value,
					input: { id: input.productId },
				});

				if (productResult.isErr()) {
					return err(productResult.error);
				}
				// Permission check already handled by getProductById

				const providerProductsResult =
					await getProviderProductsByProductIdQuery(
						authenticatedContext.value,
						input.productId
					);

				if (providerProductsResult.isErr()) {
					return err(providerProductsResult.error);
				}

				return ok(providerProductsResult.value);
			}
		).invoke
);

type GetProductPerksByProductIdError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashBadRequestError;

export const getProductPerksByProductId = cache(
	createServiceFunction()
		.input(z.object({ productId: z.string() }))
		.function(
			async ({
				input,
				ctx,
			}): Promise<Result<ProductPerk[], GetProductPerksByProductIdError>> => {
				const authenticatedContext = await authenticateContext(ctx);
				if (authenticatedContext.isErr()) {
					return err(authenticatedContext.error);
				}

				// Auth check
				const productResult = await getProductById({
					ctx: authenticatedContext.value,
					input: { id: input.productId },
				});

				if (productResult.isErr()) {
					return err(productResult.error);
				}

				const productPerksResult = await getProductPerksByProductIdQuery(
					authenticatedContext.value,
					input.productId
				);

				if (productPerksResult.isErr()) {
					return err(productPerksResult.error);
				}

				return ok(productPerksResult.value);
			}
		).invoke
);
