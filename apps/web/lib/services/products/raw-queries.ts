import { product, productProviderConfiguration } from "@voidhash/db";
import { and, eq, asc } from "drizzle-orm";
import { ServiceContext } from "@/lib/service-function";

export const getProductsQuery = async (
	ctx: ServiceContext,
	projectId: string
) => {
	const products = ctx.db
		.select()
		.from(product)
		.where(eq(product.projectId, projectId));
	return products;
};

export const getProductByIdQuery = async (ctx: ServiceContext, id: string) => {
	return ctx.db.select().from(product).where(eq(product.id, id));
};

export const getProviderProductByPrimaryKeyQuery = async (
	ctx: ServiceContext,
	projectId: string,
	providerId: string,
	productProviderKey: string
) => {
	const providerProductsResult = await ctx.db
		.select()
		.from(productProviderConfiguration)
		.leftJoin(product, eq(productProviderConfiguration.productId, product.id))
		.where(
			and(
				eq(product.projectId, projectId),
				eq(productProviderConfiguration.providerId, providerId),
				eq(productProviderConfiguration.providerProductKey, productProviderKey)
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
		.from(productProviderConfiguration)
		.where(eq(productProviderConfiguration.productId, productId))
		.orderBy(asc(productProviderConfiguration.createdAt));
};
