import { ServiceContext } from "@/lib/service-function";
import { Purchase, purchases } from "@voidhash/db";
import {
	fromUnknownThrow,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
} from "@voidhash/lib/constants";
import { eq, count } from "drizzle-orm";
import { Result, ResultAsync, err, ok } from "neverthrow";

export type GetPurchasesQueryResult = {
	purchases: Purchase[];
	total: number;
};

export const getPurchasesQuery = async (
	ctx: ServiceContext,
	customerId?: string
): Promise<Result<GetPurchasesQueryResult, VoidhashInternalServerError>> => {
	const purchaseListQuery = ResultAsync.fromPromise(
		ctx.db.query.purchases.findMany({
			where: customerId ? eq(purchases.customerId, customerId) : undefined,
			limit: 10,
		}),
		(e) => fromUnknownThrow(e)
	);

	const purchaseCountQuery = ResultAsync.fromPromise(
		ctx.db
			// @ts-expect-error should be ok
			.select({
				count: count(purchases.id),
			})
			.from(purchases)
			.where(customerId ? eq(purchases.customerId, customerId) : undefined),
		(e) => fromUnknownThrow(e)
	);

	const [purchaseList, purchaseCount] = await Promise.all([
		purchaseListQuery,
		purchaseCountQuery,
	]);

	if (purchaseList.isErr()) {
		return err(purchaseList.error);
	}

	if (purchaseCount.isErr()) {
		return err(purchaseCount.error);
	}

	return ok({
		purchases: purchaseList.value ?? [],
		// @ts-expect-error should be ok
		total: (purchaseCount.value[0]?.count ?? 0) as number,
	});
};

export const getPurchaseByProviderKeyQuery = async (
	ctx: ServiceContext,
	providerKey: string
): Promise<
	Result<Purchase, VoidhashInternalServerError | VoidhashNotFoundError>
> => {
	const res = await ResultAsync.fromPromise(
		ctx.db.query.purchases.findFirst({
			where: eq(purchases.providerKey, providerKey),
		}),
		(e) => fromUnknownThrow(e)
	);
	if (res.isErr()) {
		return err(res.error);
	}

	if (!res.value) {
		return err({
			code: "NOT_FOUND",
			message: "Purchase not found",
			resource: "purchase",
			payload: {
				providerKey,
			},
		});
	}

	return ok(res.value);
};

export const getPurchaseByIdQuery = async (
	ctx: ServiceContext,
	id: string
): Promise<
	Result<Purchase, VoidhashInternalServerError | VoidhashNotFoundError>
> => {
	const res = await ResultAsync.fromPromise(
		ctx.db.query.purchases.findFirst({
			where: eq(purchases.id, id),
		}),
		(e) => fromUnknownThrow(e)
	);
	if (res.isErr()) {
		return err(res.error);
	}

	if (!res.value) {
		return err({
			code: "NOT_FOUND",
			message: "Purchase not found",
			resource: "purchase",
			payload: {
				id,
			},
		});
	}

	return ok(res.value);
};
