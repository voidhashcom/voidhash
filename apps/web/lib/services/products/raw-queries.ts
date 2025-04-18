import { db, product, productProviderConfiguration } from "@voidhash/db";
import { and, eq, asc } from "drizzle-orm";

export const getProductsQuery = async (projectId: string) => {
	const products = db
		.select()
		.from(product)
		.where(eq(product.projectId, projectId));
	return products;
};

export const getProductByIdQuery = async (id: string) => {
	return db.select().from(product).where(eq(product.id, id));
};

export const getProviderProductByPrimaryKeyQuery = async (
	projectId: string,
	providerId: string,
	productProviderKey: string
) => {
	const providerProductsResult = await db
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
	productId: string
) => {
	return db
		.select()
		.from(productProviderConfiguration)
		.where(eq(productProviderConfiguration.productId, productId))
		.orderBy(asc(productProviderConfiguration.createdAt));
};
