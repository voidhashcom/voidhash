import { db, paywall, paywallProduct } from "@voidhash/db";
import { asc, eq } from "drizzle-orm";

export const getPaywallsQuery = async (projectId: string) => {
	const paywalls = db
		.select()
		.from(paywall)
		.where(eq(paywall.projectId, projectId));
	return paywalls;
};

export const getPaywallByIdQuery = async (id: string) => {
	return db.query.paywall.findFirst({
		where: eq(paywall.id, id),
	});
};

export const getPaywallProductsQuery = async (paywallId: string) => {
	return db.query.paywallProduct.findMany({
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
