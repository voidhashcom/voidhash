import { ServiceContext } from "@/lib/service-function";
import { purchases } from "@voidhash/db";
import { eq, count } from "drizzle-orm";

export const getPurchasesQuery = async (
	ctx: ServiceContext,
	customerId?: string
) => {
	const purchaseListQuery = ctx.db.query.purchases.findMany({
		where: customerId ? eq(purchases.customerId, customerId) : undefined,
		limit: 10,
	});

	const purchaseCountQuery = ctx.db
		// @ts-expect-error should be ok
		.select({
			count: count(purchases.id),
		})
		.from(purchases)
		.where(customerId ? eq(purchases.customerId, customerId) : undefined);

	const [purchaseList, purchaseCount] = await Promise.all([
		purchaseListQuery,
		purchaseCountQuery,
	]);

	return {
		purchases: purchaseList ?? [],
		// @ts-expect-error should be ok
		total: (purchaseCount[0]?.count ?? 0) as number,
	};
};
