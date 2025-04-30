import { perks } from "@voidhash/db";
import { eq } from "drizzle-orm";
import { ServiceContext } from "@/lib/service-function";

export const getPerksQuery = async (ctx: ServiceContext, projectId: string) => {
	const perkList = await ctx.db
		.select()
		.from(perks)
		.where(eq(perks.projectId, projectId));
	return perkList;
};

export const getPerkByIdQuery = async (ctx: ServiceContext, id: string) => {
	return ctx.db.query.perks.findFirst({
		where: eq(perks.id, id),
	});
};
