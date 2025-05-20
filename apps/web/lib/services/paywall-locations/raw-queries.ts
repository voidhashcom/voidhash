import { PaywallLocation, paywallLocations } from "@voidhash/db";
import { eq } from "drizzle-orm";
import { ServiceContext } from "@/lib/service-function";
import { err, ok, Result, ResultAsync } from "neverthrow";
import {
	fromUnknownThrow,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
} from "@voidhash/lib/constants";

export const getPaywallLocationsQuery = async (
	ctx: ServiceContext,
	projectId: string
): Promise<Result<PaywallLocation[], VoidhashInternalServerError>> => {
	const findPaywallLocations = ResultAsync.fromThrowable(
		ctx.db.query.paywallLocations.findMany,
		(e) => fromUnknownThrow(e)
	);
	const paywallLocationList = await findPaywallLocations({
		where: eq(paywallLocations.projectId, projectId),
	});
	if (paywallLocationList.isErr()) {
		return err(paywallLocationList.error);
	}
	return ok(paywallLocationList.value ?? []);
};

export const getPaywallLocationByIdQuery = async (
	ctx: ServiceContext,
	id: string
): Promise<
	Result<PaywallLocation, VoidhashInternalServerError | VoidhashNotFoundError>
> => {
	const findPaywallLocation = ResultAsync.fromThrowable(
		ctx.db.query.paywallLocations.findFirst,
		(e) => fromUnknownThrow(e)
	);
	const paywallLocation = await findPaywallLocation({
		where: eq(paywallLocations.id, id),
	});
	if (paywallLocation.isErr()) {
		return err(paywallLocation.error);
	}
	if (!paywallLocation.value) {
		return err({
			code: "NOT_FOUND",
			message: "Paywall location not found",
			resource: "paywall_location",
			payload: {
				id,
			},
		});
	}
	return ok(paywallLocation.value);
};
