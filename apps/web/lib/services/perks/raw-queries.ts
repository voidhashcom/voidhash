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
	const getPerks = ResultAsync.fromThrowable(ctx.db.query.perks.findMany, (e) =>
		fromUnknownThrow(e)
	);
	const perkList = await getPerks({
		where: eq(perks.projectId, projectId),
	});
	return perkList;
};

export const getPerkByIdQuery = async (
	ctx: ServiceContext,
	id: string
): Promise<
	Result<Perk, VoidhashInternalServerError | VoidhashNotFoundError>
> => {
	const getPerk = ResultAsync.fromThrowable(ctx.db.query.perks.findFirst, (e) =>
		fromUnknownThrow(e)
	);
	const perk = await getPerk({
		where: eq(perks.id, id),
	});
	if (perk.isErr()) {
		return err(perk.error);
	}

	if (!perk.value) {
		return err({
			code: "NOT_FOUND",
			message: "Perk not found",
			resource: "perk",
			payload: {
				id,
			},
		});
	}

	return ok(perk.value);
};
