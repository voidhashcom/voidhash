import {
	paywalls,
	paywallProducts,
	Paywall,
	PaywallProduct,
} from "@voidhash/db";
import { and, asc, eq } from "drizzle-orm";
import { ServiceContext } from "@/lib/service-function";
import { err, ok, Result, ResultAsync } from "neverthrow";
import {
	Environment,
	fromUnknownThrow,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
} from "@voidhash/lib/constants";

export const getPaywallsQuery = async (
	ctx: ServiceContext,
	projectId: string,
	environment: Environment
): Promise<Result<Paywall[], VoidhashInternalServerError>> => {
	const res = await ResultAsync.fromPromise(
		ctx.db.query.paywalls.findMany({
			where: and(
				eq(paywalls.projectId, projectId),
				eq(paywalls.environment, environment)
			),
		}),
		(e) => fromUnknownThrow(e)
	);

	if (res.isErr()) {
		return err(res.error);
	}

	return ok(res.value ?? []);
};

export const getPaywallByIdQuery = async (
	ctx: ServiceContext,
	id: string
): Promise<
	Result<Paywall, VoidhashInternalServerError | VoidhashNotFoundError>
> => {
	const res = await ResultAsync.fromPromise(
		ctx.db.query.paywalls.findFirst({
			where: eq(paywalls.id, id),
		}),
		(e) => fromUnknownThrow(e)
	);

	if (res.isErr()) {
		return err(res.error);
	}

	if (!res.value) {
		return err({
			code: "NOT_FOUND",
			message: "Paywall not found",
			resource: "paywall",
			payload: {
				id,
			},
		});
	}

	return ok(res.value);
};

export const getPaywallProductsQuery = async (
	ctx: ServiceContext,
	paywallId: string
): Promise<
	Result<
		(PaywallProduct & {
			product: {
				name: string;
			};
		})[],
		VoidhashInternalServerError
	>
> => {
	const paywallProductsResult = await ResultAsync.fromPromise(
		ctx.db.query.paywallProducts.findMany({
			where: eq(paywallProducts.paywallId, paywallId),
			with: {
				product: {
					columns: {
						name: true,
					},
				},
			},
			orderBy: [asc(paywallProducts.order)],
		}),
		(e) => fromUnknownThrow(e)
	);
	if (paywallProductsResult.isErr()) {
		return err(paywallProductsResult.error);
	}
	return ok(paywallProductsResult.value ?? []);
};
