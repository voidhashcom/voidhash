import { db, paywall } from "@voidhash/db";
import { eq } from "drizzle-orm";

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
