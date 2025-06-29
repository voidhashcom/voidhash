// import {
// 	products,
// 	paymentProviderConfigurationProducts,
// 	productPerks,
// 	Product,
// 	PaymentProviderConfigurationProduct,
// 	ProductPerk,
// 	paymentProviderConfigurations,
// } from "@voidhash/db";
// import { and, eq, asc } from "drizzle-orm";
// import { ServiceContext } from "@/lib/service-function";
// import { err, ok, Result, ResultAsync } from "neverthrow";
// import {
// 	Environment,
// 	fromUnknownThrow,
// 	VoidhashInternalServerError,
// 	VoidhashNotFoundError,
// } from "@voidhash/lib/constants";

// export const getProductsQuery = async (
// 	ctx: ServiceContext,
// 	projectId: string,
// 	environment: Environment
// ): Promise<Result<Product[], VoidhashInternalServerError>> => {
// 	const res = await ResultAsync.fromPromise(
// 		ctx.db.query.products.findMany({
// 			where: and(
// 				eq(products.projectId, projectId),
// 				eq(products.environment, environment)
// 			),
// 		}),
// 		(e) => fromUnknownThrow(e)
// 	);
// 	if (res.isErr()) {
// 		return err(res.error);
// 	}
// 	return ok(res.value);
// };

// export const getProductByIdQuery = async (
// 	ctx: ServiceContext,
// 	id: string
// ): Promise<
// 	Result<Product, VoidhashInternalServerError | VoidhashNotFoundError>
// > => {
// 	const product = await ResultAsync.fromPromise(
// 		ctx.db.query.products.findFirst({
// 			where: eq(products.id, id),
// 		}),
// 		(e) => fromUnknownThrow(e)
// 	);
// 	if (product.isErr()) {
// 		return err(product.error);
// 	}

// 	if (!product.value) {
// 		return err({
// 			code: "NOT_FOUND",
// 			message: "Product not found",
// 			resource: "product",
// 			payload: {
// 				id,
// 			},
// 		});
// 	}

// 	return ok(product.value);
// };

// export const getProviderProductByIdQuery = async (
// 	ctx: ServiceContext,
// 	providerProductId: string
// ): Promise<
// 	Result<
// 		PaymentProviderConfigurationProduct,
// 		VoidhashInternalServerError | VoidhashNotFoundError
// 	>
// > => {
// 	const res = await ResultAsync.fromPromise(
// 		ctx.db.query.paymentProviderConfigurationProducts.findFirst({
// 			where: eq(paymentProviderConfigurationProducts.id, providerProductId),
// 		}),
// 		(e) => fromUnknownThrow(e)
// 	);
// 	if (res.isErr()) {
// 		return err(res.error);
// 	}

// 	if (!res.value) {
// 		return err({
// 			code: "NOT_FOUND",
// 			message: "Provider product not found",
// 			resource: "PaymentProviderConfigurationProduct",
// 			payload: {
// 				id: providerProductId,
// 			},
// 		});
// 	}

// 	return ok(res.value);
// };

// export const getProviderProductByPrimaryKeyQuery = async (
// 	ctx: ServiceContext,
// 	paymentProviderConfigurationId: string,
// 	productProviderKey: string,
// 	environment: Environment
// ): Promise<
// 	Result<
// 		PaymentProviderConfigurationProduct & {
// 			projectId: string;
// 			providerId: string;
// 		},
// 		VoidhashInternalServerError | VoidhashNotFoundError
// 	>
// > => {
// 	const providerProductsResult = await ResultAsync.fromPromise(
// 		ctx.db
// 			.select()
// 			.from(paymentProviderConfigurationProducts)
// 			.innerJoin(
// 				paymentProviderConfigurations,
// 				eq(
// 					paymentProviderConfigurationProducts.paymentProviderConfigurationId,
// 					paymentProviderConfigurations.id
// 				)
// 			)
// 			.where(
// 				and(
// 					eq(
// 						paymentProviderConfigurationProducts.paymentProviderConfigurationId,
// 						paymentProviderConfigurationId
// 					),
// 					eq(
// 						paymentProviderConfigurationProducts.providerProductKey,
// 						productProviderKey
// 					),
// 					eq(paymentProviderConfigurationProducts.environment, environment)
// 				)
// 			),
// 		(e) => fromUnknownThrow(e)
// 	);

// 	if (providerProductsResult.isErr()) {
// 		return err(providerProductsResult.error);
// 	}

// 	const paymentProviderConfigurationProduct = providerProductsResult.value[0];

// 	if (!paymentProviderConfigurationProduct) {
// 		return err({
// 			code: "NOT_FOUND",
// 			message: "Provider product not found",
// 			resource: "PaymentProviderConfigurationProduct",
// 			payload: {
// 				paymentProviderConfigurationId,
// 				productProviderKey,
// 			},
// 		});
// 	}
// 	return ok({
// 		...paymentProviderConfigurationProduct.payment_provider_configuration_product,
// 		projectId:
// 			paymentProviderConfigurationProduct.payment_provider_configuration
// 				.projectId,
// 		providerId:
// 			paymentProviderConfigurationProduct.payment_provider_configuration
// 				.providerId,
// 	});
// };

// export const getProviderProductsByProductIdQuery = async (
// 	ctx: ServiceContext,
// 	productId: string
// ): Promise<
// 	Result<PaymentProviderConfigurationProduct[], VoidhashInternalServerError>
// > => {
// 	const res = await ResultAsync.fromPromise(
// 		ctx.db.query.paymentProviderConfigurationProducts.findMany({
// 			where: eq(paymentProviderConfigurationProducts.productId, productId),
// 			orderBy: [asc(paymentProviderConfigurationProducts.createdAt)],
// 		}),
// 		(e) => fromUnknownThrow(e)
// 	);
// 	if (res.isErr()) {
// 		return err(res.error);
// 	}
// 	return ok(res.value);
// };

// export const getProductPerksByProductIdQuery = async (
// 	ctx: ServiceContext,
// 	productId: string
// ): Promise<Result<ProductPerk[], VoidhashInternalServerError>> => {
// 	const res = await ResultAsync.fromPromise(
// 		ctx.db.query.productPerks.findMany({
// 			where: eq(productPerks.productId, productId),
// 			orderBy: [asc(productPerks.createdAt)],
// 		}),
// 		(e) => fromUnknownThrow(e)
// 	);
// 	if (res.isErr()) {
// 		return err(res.error);
// 	}
// 	return ok(res.value);
// };
