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
	fromUnknownThrow,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
} from "@voidhash/lib/constants";

export const getProductsQuery = async (
	ctx: ServiceContext,
	projectId: string
): Promise<Result<Product[], VoidhashInternalServerError>> => {
	const getProducts = ResultAsync.fromThrowable(
		ctx.db.query.products.findMany,
		(e) => fromUnknownThrow(e)
	);
	const productList = await getProducts({
		where: eq(products.projectId, projectId),
	});
	return productList;
};

export const getProductByIdQuery = async (
	ctx: ServiceContext,
	id: string
): Promise<
	Result<Product, VoidhashInternalServerError | VoidhashNotFoundError>
> => {
	const getProduct = ResultAsync.fromThrowable(
		ctx.db.query.products.findFirst,
		(e) => fromUnknownThrow(e)
	);
	const product = await getProduct({
		where: eq(products.id, id),
	});
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
	const getProviderProducts = ResultAsync.fromThrowable(
		ctx.db.query.productProviderConfigurations.findFirst,
		(e) => fromUnknownThrow(e)
	);
	const providerProductsResult = await getProviderProducts({
		where: eq(productProviderConfigurations.id, providerProductId),
	});
	if (providerProductsResult.isErr()) {
		return err(providerProductsResult.error);
	}

	if (!providerProductsResult.value) {
		return err({
			code: "NOT_FOUND",
			message: "Provider product not found",
			resource: "productProviderConfiguration",
			payload: {
				id: providerProductId,
			},
		});
	}

	return ok(providerProductsResult.value);
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
	const getProviderProducts = ResultAsync.fromThrowable(
		ctx.db.query.productProviderConfigurations.findMany,
		(e) => fromUnknownThrow(e)
	);
	const providerProductsResult = await getProviderProducts({
		where: eq(productProviderConfigurations.productId, productId),
		orderBy: [asc(productProviderConfigurations.createdAt)],
	});
	if (providerProductsResult.isErr()) {
		return err(providerProductsResult.error);
	}
	return ok(providerProductsResult.value);
};

export const getProductPerksByProductIdQuery = async (
	ctx: ServiceContext,
	productId: string
): Promise<Result<ProductPerk[], VoidhashInternalServerError>> => {
	const getProductPerks = ResultAsync.fromThrowable(
		ctx.db.query.productPerks.findMany,
		(e) => fromUnknownThrow(e)
	);
	const productPerksResult = await getProductPerks({
		where: eq(productPerks.productId, productId),
		orderBy: [asc(productPerks.createdAt)],
	});
	if (productPerksResult.isErr()) {
		return err(productPerksResult.error);
	}
	return ok(productPerksResult.value);
};
