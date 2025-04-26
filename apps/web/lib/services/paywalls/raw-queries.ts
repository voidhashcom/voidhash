import { paywall, paywallProduct } from "@voidhash/db";
import { asc, eq } from "drizzle-orm";
import { ServiceContext } from "@/lib/service-function";

export const getPaywallsQuery = async (
	ctx: ServiceContext,
	projectId: string
) => {
	const paywalls = ctx.db
		.select()
		.from(paywall)
		.where(eq(paywall.projectId, projectId));
	return paywalls;
};

export const getPaywallByIdQuery = async (ctx: ServiceContext, id: string) => {
	return ctx.db.query.paywall.findFirst({
		where: eq(paywall.id, id),
	});
};

export const getPaywallProductsQuery = async (
	ctx: ServiceContext,
	paywallId: string
) => {
	return ctx.db.query.paywallProduct.findMany({
		where: eq(paywallProduct.paywallId, paywallId),
		with: {
			product: {
				columns: {
					name: true,
				},
			},
		},
		// TODO: Temporary order by createdAt until we have a better way to order the products
		orderBy: [asc(paywallProduct.createdAt)],
	});
};
