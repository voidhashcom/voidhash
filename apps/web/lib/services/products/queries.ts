import {
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
import { hasEnvironment, isAuthenticated } from "@/lib/middlewares";

export const getProductsInputSchema = z.object({
	projectId: z.string(),
});

type GetProductsError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError;

export type GetProductsResult = Product[];
export const getProducts = cache(
	createServiceFunction()
		.input(getProductsInputSchema)
		.use(isAuthenticated)
		.use(hasEnvironment)
		.function(
			async ({
				input,
				ctx,
			}): Promise<Result<GetProductsResult, GetProductsError>> => {
				if (!hasProjectPermission(ctx, input.projectId, "project:all")) {
					return err({
						code: "FORBIDDEN",
						message: "No permission to access products.",
					});
				}

				const productsResult = await getProductsQuery(
					ctx,
					input.projectId,
					ctx.session.environment
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
		.use(isAuthenticated)
		.function(
			async ({ input, ctx }): Promise<Result<Product, GetProductByIdError>> => {
				const productResult = await getProductByIdQuery(ctx, input.id);

				if (productResult.isErr()) {
					return err(productResult.error);
				}

				if (
					!hasProjectPermission(
						ctx,
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
		.use(isAuthenticated)
		.use(hasEnvironment)
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
				if (!hasProjectPermission(ctx, input.projectId, "project:all")) {
					return err({
						code: "FORBIDDEN",
						message: "No permission to access provider product.",
					});
				}

				const providerProductResult = await getProviderProductByPrimaryKeyQuery(
					ctx,
					input.projectId,
					input.providerId,
					input.productProviderKey,
					ctx.session.environment
				);

				if (providerProductResult.isErr()) {
					return err(providerProductResult.error);
				}

				const productResult = await getProductByIdQuery(
					ctx,
					providerProductResult.value.productId
				);

				if (productResult.isErr()) {
					return err(productResult.error);
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
		.use(isAuthenticated)
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
				const productResult = await getProductByIdQuery(ctx, input.productId);

				if (productResult.isErr()) {
					return err(productResult.error);
				}

				if (
					!hasProjectPermission(
						ctx,
						productResult.value.projectId,
						"project:all"
					)
				) {
					return err({
						code: "FORBIDDEN",
						message: "No permission to access provider products.",
					});
				}

				const providerProductsResult =
					await getProviderProductsByProductIdQuery(ctx, input.productId);

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
		.use(isAuthenticated)
		.function(
			async ({
				input,
				ctx,
			}): Promise<Result<ProductPerk[], GetProductPerksByProductIdError>> => {
				const productResult = await getProductByIdQuery(ctx, input.productId);

				if (productResult.isErr()) {
					return err(productResult.error);
				}

				if (
					!hasProjectPermission(
						ctx,
						productResult.value.projectId,
						"project:all"
					)
				) {
					return err({
						code: "FORBIDDEN",
						message: "No permission to access product perks.",
					});
				}

				const productPerksResult = await getProductPerksByProductIdQuery(
					ctx,
					input.productId
				);

				if (productPerksResult.isErr()) {
					return err(productPerksResult.error);
				}

				return ok(productPerksResult.value);
			}
		).invoke
);
