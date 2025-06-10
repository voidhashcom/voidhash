import {
	products,
	productProviderConfigurations,
	productPerks,
	Product,
	ProductProviderConfiguration,
	ProductPerk,
	projectPaymentProviderConfigurations,
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
	paymentProviderConfigurationId: string,
	productProviderKey: string,
	environment: Environment
): Promise<
	Result<
		ProductProviderConfiguration & {
			projectId: string;
			providerId: string;
		},
		VoidhashInternalServerError | VoidhashNotFoundError
	>
> => {
	const providerProductsResult = await ResultAsync.fromPromise(
		ctx.db
			.select()
			.from(productProviderConfigurations)
			.innerJoin(
				projectPaymentProviderConfigurations,
				eq(
					productProviderConfigurations.providerConfigurationId,
					projectPaymentProviderConfigurations.id
				)
			)
			.where(
				and(
					eq(
						productProviderConfigurations.providerConfigurationId,
						paymentProviderConfigurationId
					),
					eq(
						productProviderConfigurations.providerProductKey,
						productProviderKey
					),
					eq(productProviderConfigurations.environment, environment)
				)
			),
		(e) => fromUnknownThrow(e)
	);

	if (providerProductsResult.isErr()) {
		return err(providerProductsResult.error);
	}

	const productProviderConfiguration = providerProductsResult.value[0];

	if (!productProviderConfiguration) {
		return err({
			code: "NOT_FOUND",
			message: "Provider product not found",
			resource: "productProviderConfiguration",
			payload: {
				paymentProviderConfigurationId,
				productProviderKey,
			},
		});
	}
	return ok({
		...productProviderConfiguration.product_provider_configuration,
		projectId:
			productProviderConfiguration.project_payment_provider_configuration
				.projectId,
		providerId:
			productProviderConfiguration.project_payment_provider_configuration
				.providerId,
	});
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
