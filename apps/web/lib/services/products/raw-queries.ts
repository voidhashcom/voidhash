import {
	products,
	productProviderConfigurations,
	productPerks,
} from "@voidhash/db";
import { and, eq, asc } from "drizzle-orm";
import { ServiceContext } from "@/lib/service-function";

export const getProductsQuery = async (
	ctx: ServiceContext,
	projectId: string
) => {
	const productList = await ctx.db
		.select()
		.from(products)
		.where(eq(products.projectId, projectId));
	return productList;
};

export const getProductByIdQuery = async (ctx: ServiceContext, id: string) => {
	return ctx.db.select().from(products).where(eq(products.id, id));
};

export const getProviderProductByIdQuery = async (
	ctx: ServiceContext,
	providerProductId: string
) => {
	const providerProductsResult = await ctx.db
		.select()
		.from(productProviderConfigurations)
		.where(eq(productProviderConfigurations.id, providerProductId));

	if (providerProductsResult.length === 0) {
		return null;
	}

	return providerProductsResult[0];
};

export const getProviderProductByPrimaryKeyQuery = async (
	ctx: ServiceContext,
	projectId: string,
	providerId: string,
	productProviderKey: string
) => {
	const providerProductsResult = await ctx.db
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
				eq(productProviderConfigurations.providerProductKey, productProviderKey)
			)
		);

	if (providerProductsResult.length === 0) {
		return null;
	}

	return providerProductsResult[0]?.product_provider_configuration;
};

export const getProviderProductsByProductIdQuery = async (
	ctx: ServiceContext,
	productId: string
) => {
	return ctx.db
		.select()
		.from(productProviderConfigurations)
		.where(eq(productProviderConfigurations.productId, productId))
		.orderBy(asc(productProviderConfigurations.createdAt));
};

export const getProductPerksByProductIdQuery = async (
	ctx: ServiceContext,
	productId: string
) => {
	return ctx.db
		.select()
		.from(productPerks)
		.where(eq(productPerks.productId, productId))
		.orderBy(asc(productPerks.createdAt));
};
