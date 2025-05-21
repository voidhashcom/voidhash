import "server-only";

import { ApiKey, apiKeys } from "@voidhash/db";
import { asc, desc, eq } from "drizzle-orm";
import { ServiceContext } from "@/lib/service-function";
import {
	fromUnknownThrow,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
} from "@voidhash/lib/constants";
import { err, ok, Result, ResultAsync } from "neverthrow";

export const getApiKeyByIdQuery = async (
	ctx: ServiceContext,
	id: string
): Promise<
	Result<ApiKey, VoidhashInternalServerError | VoidhashNotFoundError>
> => {
	const res = await ResultAsync.fromPromise(
		ctx.db.query.apiKeys.findFirst({
			where: eq(apiKeys.id, id),
		}),
		(e) => fromUnknownThrow(e)
	);
	if (res.isErr()) {
		return err(res.error);
	}

	if (!res.value) {
		return err({
			code: "NOT_FOUND",
			message: "API key not found",
			resource: "api_key",
			payload: {
				id,
			},
		} satisfies VoidhashNotFoundError);
	}
	return ok(res.value);
};

export const getApiKeysQuery = async (
	ctx: ServiceContext,
	projectId: string
): Promise<Result<ApiKey[], VoidhashInternalServerError>> => {
	return await ResultAsync.fromPromise(
		ctx.db.query.apiKeys.findMany({
			where: eq(apiKeys.projectId, projectId),
			orderBy: [desc(apiKeys.isPublic), asc(apiKeys.createdAt)],
		}),
		(e) => fromUnknownThrow(e)
	);
};
