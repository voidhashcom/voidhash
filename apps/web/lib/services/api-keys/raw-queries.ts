import "server-only";

import { db, apiKeys } from "@voidhash/db";
import { eq } from "drizzle-orm";

export const getApiKeyByIdQuery = async (id: string) => {
	return db.query.apiKeys.findFirst({
		where: eq(apiKeys.id, id),
	});
};

export const getApiKeysQuery = async (projectId: string) => {
	return db.query.apiKeys.findMany({
		where: eq(apiKeys.projectId, projectId),
	});
};
