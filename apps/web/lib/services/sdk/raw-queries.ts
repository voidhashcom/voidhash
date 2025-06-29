// import { ServiceContext } from "@/lib/service-function";
// import {
// 	Customer,
// 	customers,
// 	Paywall,
// 	paywallLocations,
// 	PaywallProduct,
// 	paywallProducts,
// 	Product,
// } from "@voidhash/db";
// import {
// 	Environment,
// 	VoidhashInternalServerError,
// 	VoidhashNotFoundError,
// 	fromUnknownThrow,
// } from "@voidhash/lib/constants";
// import { and, asc, eq } from "drizzle-orm";
// import { Result, ResultAsync, err, ok } from "neverthrow";

// export const getCustomerWithParentByAppUserIdQuery = async (
// 	ctx: ServiceContext,
// 	appUserId: string,
// 	environment: Environment
// ): Promise<
// 	Result<
// 		Customer & { parentCustomer: Customer | null },
// 		VoidhashInternalServerError | VoidhashNotFoundError
// 	>
// > => {
// 	const tx = ctx.tx ?? ctx.db;
// 	const res = await ResultAsync.fromPromise(
// 		tx.query.customers.findFirst({
// 			where: and(
// 				eq(customers.appUserId, appUserId),
// 				eq(customers.environment, environment)
// 			),
// 			with: {
// 				parentCustomer: true,
// 			},
// 		}),
// 		(e) => fromUnknownThrow(e)
// 	);

// 	if (res.isErr()) {
// 		return err(res.error);
// 	}
// 	if (!res.value) {
// 		return err({
// 			code: "NOT_FOUND",
// 			message: "Customer not found",
// 			resource: "customer",
// 			payload: {
// 				appUserId,
// 			},
// 		});
// 	}

// 	return ok(res.value);
// };

// export type PaywallWithProducts = {
// 	id: string;
// 	products: {
// 		id: string;
// 		name: string;
// 		price?: number;
// 	}[];
// };
// export const getPaywallWithProductsByLocationSlugQuery = async (
// 	ctx: ServiceContext,
// 	locationSlug: string,
// 	environment: Environment
// ): Promise<
// 	Result<
// 		Paywall & {
// 			paywallProducts: (PaywallProduct & {
// 				product: Product;
// 			})[];
// 		},
// 		VoidhashInternalServerError | VoidhashNotFoundError
// 	>
// > => {
// 	const res = await ResultAsync.fromPromise(
// 		ctx.db.query.paywallLocations.findFirst({
// 			where: and(
// 				eq(paywallLocations.slug, locationSlug),
// 				eq(paywallLocations.environment, environment)
// 			),
// 			with: {
// 				defaultPaywall: {
// 					with: {
// 						paywallProducts: {
// 							with: {
// 								product: true,
// 							},
// 							orderBy: [asc(paywallProducts.order)],
// 						},
// 					},
// 				},
// 			},
// 		}),
// 		(e) => fromUnknownThrow(e)
// 	);

// 	if (res.isErr()) {
// 		return err(res.error);
// 	}

// 	if (!res.value?.defaultPaywall) {
// 		return err({
// 			code: "NOT_FOUND",
// 			message: "Paywall not found",
// 			resource: "paywall",
// 			payload: {
// 				locationSlug,
// 			},
// 		});
// 	}

// 	return ok(res.value.defaultPaywall);
// };

// export const getPaywallProductByIdQuery = async (
// 	ctx: ServiceContext,
// 	paywallProductId: string
// ): Promise<
// 	Result<
// 		PaywallProduct & { product: Product },
// 		VoidhashInternalServerError | VoidhashNotFoundError
// 	>
// > => {
// 	const res = await ResultAsync.fromPromise(
// 		ctx.db.query.paywallProducts.findFirst({
// 			where: eq(paywallProducts.id, paywallProductId),
// 			with: {
// 				product: true,
// 			},
// 		}),
// 		(e) => fromUnknownThrow(e)
// 	);

// 	if (res.isErr()) {
// 		return err(res.error);
// 	}

// 	if (!res.value) {
// 		return err({
// 			code: "NOT_FOUND",
// 			message: "Paywall product not found",
// 			resource: "paywallProduct",
// 			payload: {
// 				paywallProductId,
// 			},
// 		});
// 	}

// 	return ok(res.value);
// };
