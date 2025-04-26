import "server-only";

import { apiKeys } from "@voidhash/db";
import { asc, desc, eq } from "drizzle-orm";
import { ServiceContext } from "@/lib/service-function";

export const getApiKeyByIdQuery = async (ctx: ServiceContext, id: string) => {
	return ctx.db.query.apiKeys.findFirst({
		where: eq(apiKeys.id, id),
	});
};

export const getApiKeysQuery = async (
	ctx: ServiceContext,
	projectId: string
) => {
	return ctx.db.query.apiKeys.findMany({
		where: eq(apiKeys.projectId, projectId),
		orderBy: [desc(apiKeys.isPublic), asc(apiKeys.createdAt)],
	});
};
