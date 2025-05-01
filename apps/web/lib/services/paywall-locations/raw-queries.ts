import { paywallLocations } from "@voidhash/db";
import { eq } from "drizzle-orm";
import { ServiceContext } from "@/lib/service-function";

export const getPaywallLocationsQuery = async (
	ctx: ServiceContext,
	projectId: string
) => {
	const paywallLocationList = await ctx.db
		.select()
		.from(paywallLocations)
		.where(eq(paywallLocations.projectId, projectId));
	return paywallLocationList;
};

export const getPaywallLocationByIdQuery = async (
	ctx: ServiceContext,
	id: string
) => {
	return ctx.db.query.paywallLocations.findFirst({
		where: eq(paywallLocations.id, id),
	});
};
