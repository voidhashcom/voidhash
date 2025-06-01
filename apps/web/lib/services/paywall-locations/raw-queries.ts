import { PaywallLocation, paywallLocations } from "@voidhash/db";
import { and, eq } from "drizzle-orm";
import { ServiceContext } from "@/lib/service-function";
import { err, ok, Result, ResultAsync } from "neverthrow";
import {
	Environment,
	fromUnknownThrow,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
} from "@voidhash/lib/constants";

export const getPaywallLocationsQuery = async (
	ctx: ServiceContext,
	projectId: string,
	environment: Environment
): Promise<Result<PaywallLocation[], VoidhashInternalServerError>> => {
	const res = await ResultAsync.fromPromise(
		ctx.db.query.paywallLocations.findMany({
			where: and(
				eq(paywallLocations.projectId, projectId),
				eq(paywallLocations.environment, environment)
			),
		}),
		(e) => fromUnknownThrow(e)
	);
	if (res.isErr()) {
		return err(res.error);
	}
	return ok(res.value ?? []);
};

export const getPaywallLocationByIdQuery = async (
	ctx: ServiceContext,
	id: string
): Promise<
	Result<PaywallLocation, VoidhashInternalServerError | VoidhashNotFoundError>
> => {
	const res = await ResultAsync.fromPromise(
		ctx.db.query.paywallLocations.findFirst({
			where: eq(paywallLocations.id, id),
		}),
		(e) => fromUnknownThrow(e)
	);
	if (res.isErr()) {
		return err(res.error);
	}
	if (!res.value) {
		return err({
			code: "NOT_FOUND",
			message: "Paywall location not found",
			resource: "paywall_location",
			payload: {
				id,
			},
		});
	}
	return ok(res.value);
};
