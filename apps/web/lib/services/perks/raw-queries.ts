import { Perk, perks } from "@voidhash/db";
import { eq } from "drizzle-orm";
import { ServiceContext } from "@/lib/service-function";
import { err, ok, Result, ResultAsync } from "neverthrow";
import {
	fromUnknownThrow,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
} from "@voidhash/lib/constants";

export const getPerksQuery = async (
	ctx: ServiceContext,
	projectId: string
): Promise<Result<Perk[], VoidhashInternalServerError>> => {
	const res = await ResultAsync.fromPromise(
		ctx.db.query.perks.findMany({
			where: eq(perks.projectId, projectId),
		}),
		(e) => fromUnknownThrow(e)
	);
	if (res.isErr()) {
		return err(res.error);
	}
	return ok(res.value);
};

export const getPerkByIdQuery = async (
	ctx: ServiceContext,
	id: string
): Promise<
	Result<Perk, VoidhashInternalServerError | VoidhashNotFoundError>
> => {
	const res = await ResultAsync.fromPromise(
		ctx.db.query.perks.findFirst({
			where: eq(perks.id, id),
		}),
		(e) => fromUnknownThrow(e)
	);
	if (res.isErr()) {
		return err(res.error);
	}

	if (!res.value) {
		return err({
			code: "NOT_FOUND",
			message: "Perk not found",
			resource: "perk",
			payload: {
				id,
			},
		});
	}

	return ok(res.value);
};
