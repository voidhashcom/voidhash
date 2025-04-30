import { paywalls, paywallProducts } from "@voidhash/db";
import { asc, eq } from "drizzle-orm";
import { ServiceContext } from "@/lib/service-function";

export const getPaywallsQuery = async (
	ctx: ServiceContext,
	projectId: string
) => {
	const paywallList = await ctx.db
		.select()
		.from(paywalls)
		.where(eq(paywalls.projectId, projectId));
	return paywallList;
};

export const getPaywallByIdQuery = async (ctx: ServiceContext, id: string) => {
	return ctx.db.query.paywalls.findFirst({
		where: eq(paywalls.id, id),
	});
};

export const getPaywallProductsQuery = async (
	ctx: ServiceContext,
	paywallId: string
) => {
	return await ctx.db.query.paywallProducts.findMany({
		where: eq(paywallProducts.paywallId, paywallId),
		with: {
			product: {
				columns: {
					name: true,
				},
			},
		},
		// TODO: Temporary order by createdAt until we have a better way to order the products
		orderBy: [asc(paywallProducts.createdAt)],
	});
};
