import {
	products,
	productProviderConfigurations,
	productPerks,
	Product,
	ProductProviderConfiguration,
	ProductPerk,
} from "@voidhash/db";
import { and, eq, asc } from "drizzle-orm";
import { ServiceContext } from "@/lib/service-function";
import { err, ok, Result, ResultAsync } from "neverthrow";
import {
	Environment,
	fromUnknownThrow,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
} from "@voidhash/lib/constants";

export const getProductsQuery = async (
	ctx: ServiceContext,
	projectId: string,
	environment: Environment
): Promise<Result<Product[], VoidhashInternalServerError>> => {
	const res = await ResultAsync.fromPromise(
		ctx.db.query.products.findMany({
			where: and(
				eq(products.projectId, projectId),
				eq(products.environment, environment)
			),
		}),
		(e) => fromUnknownThrow(e)
	);
	if (res.isErr()) {
		return err(res.error);
	}
	return ok(res.value);
};

export const getProductByIdQuery = async (
	ctx: ServiceContext,
	id: string
): Promise<
	Result<Product, VoidhashInternalServerError | VoidhashNotFoundError>
> => {
	const product = await ResultAsync.fromPromise(
		ctx.db.query.products.findFirst({
			where: eq(products.id, id),
		}),
		(e) => fromUnknownThrow(e)
	);
	if (product.isErr()) {
		return err(product.error);
	}

	if (!product.value) {
		return err({
			code: "NOT_FOUND",
			message: "Product not found",
			resource: "product",
			payload: {
				id,
			},
		});
	}

	return ok(product.value);
};

export const getProviderProductByIdQuery = async (
	ctx: ServiceContext,
	providerProductId: string
): Promise<
	Result<
		ProductProviderConfiguration,
		VoidhashInternalServerError | VoidhashNotFoundError
	>
> => {
	const res = await ResultAsync.fromPromise(
		ctx.db.query.productProviderConfigurations.findFirst({
			where: eq(productProviderConfigurations.id, providerProductId),
		}),
		(e) => fromUnknownThrow(e)
	);
	if (res.isErr()) {
		return err(res.error);
	}

	if (!res.value) {
		return err({
			code: "NOT_FOUND",
			message: "Provider product not found",
			resource: "productProviderConfiguration",
			payload: {
				id: providerProductId,
			},
		});
	}

	return ok(res.value);
};

export const getProviderProductByPrimaryKeyQuery = async (
	ctx: ServiceContext,
	projectId: string,
	providerId: string,
	productProviderKey: string
): Promise<
	Result<
		ProductProviderConfiguration,
		VoidhashInternalServerError | VoidhashNotFoundError
	>
> => {
	const providerProductsResult = await ResultAsync.fromPromise(
		ctx.db
			.select()
			.from(productProviderConfigurations)
			.leftJoin(
				products,
				eq(productProviderConfigurations.productId, products.id)
			)
			.where(
				and(
					eq(products.projectId, projectId),
					eq(productProviderConfigurations.providerId, providerId),
					eq(
						productProviderConfigurations.providerProductKey,
						productProviderKey
					)
				)
			),
		(e) => fromUnknownThrow(e)
	);

	if (providerProductsResult.isErr()) {
		return err(providerProductsResult.error);
	}

	const productProviderConfiguration =
		providerProductsResult.value[0]?.product_provider_configuration;

	if (!productProviderConfiguration) {
		return err({
			code: "NOT_FOUND",
			message: "Provider product not found",
			resource: "productProviderConfiguration",
			payload: {
				projectId,
				providerId,
				productProviderKey,
			},
		});
	}
	return ok(productProviderConfiguration);
};

export const getProviderProductsByProductIdQuery = async (
	ctx: ServiceContext,
	productId: string
): Promise<
	Result<ProductProviderConfiguration[], VoidhashInternalServerError>
> => {
	const res = await ResultAsync.fromPromise(
		ctx.db.query.productProviderConfigurations.findMany({
			where: eq(productProviderConfigurations.productId, productId),
			orderBy: [asc(productProviderConfigurations.createdAt)],
		}),
		(e) => fromUnknownThrow(e)
	);
	if (res.isErr()) {
		return err(res.error);
	}
	return ok(res.value);
};

export const getProductPerksByProductIdQuery = async (
	ctx: ServiceContext,
	productId: string
): Promise<Result<ProductPerk[], VoidhashInternalServerError>> => {
	const res = await ResultAsync.fromPromise(
		ctx.db.query.productPerks.findMany({
			where: eq(productPerks.productId, productId),
			orderBy: [asc(productPerks.createdAt)],
		}),
		(e) => fromUnknownThrow(e)
	);
	if (res.isErr()) {
		return err(res.error);
	}
	return ok(res.value);
};
