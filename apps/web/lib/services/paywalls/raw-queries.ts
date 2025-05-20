import {
	paywalls,
	paywallProducts,
	Paywall,
	PaywallProduct,
} from "@voidhash/db";
import { asc, eq } from "drizzle-orm";
import { ServiceContext } from "@/lib/service-function";
import { err, ok, Result, ResultAsync } from "neverthrow";
import {
	fromUnknownThrow,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
} from "@voidhash/lib/constants";

export const getPaywallsQuery = async (
	ctx: ServiceContext,
	projectId: string
): Promise<Result<Paywall[], VoidhashInternalServerError>> => {
	const findPaywalls = ResultAsync.fromThrowable(
		ctx.db.query.paywalls.findMany,
		(e) => fromUnknownThrow(e)
	);

	const paywallList = await findPaywalls({
		where: eq(paywalls.projectId, projectId),
	});

	if (paywallList.isErr()) {
		return err(paywallList.error);
	}

	return ok(paywallList.value ?? []);
};

export const getPaywallByIdQuery = async (
	ctx: ServiceContext,
	id: string
): Promise<
	Result<Paywall, VoidhashInternalServerError | VoidhashNotFoundError>
> => {
	const findPaywall = ResultAsync.fromThrowable(
		ctx.db.query.paywalls.findFirst,
		(e) => fromUnknownThrow(e)
	);

	const paywall = await findPaywall({
		where: eq(paywalls.id, id),
	});

	if (paywall.isErr()) {
		return err(paywall.error);
	}

	if (!paywall.value) {
		return err({
			code: "NOT_FOUND",
			message: "Paywall not found",
			resource: "paywall",
			payload: {
				id,
			},
		});
	}

	return ok(paywall.value);
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
			// TODO: Temporary order by createdAt until we have a better way to order the products
			orderBy: [asc(paywallProducts.createdAt)],
		}),
		(e) => fromUnknownThrow(e)
	);
	if (paywallProductsResult.isErr()) {
		return err(paywallProductsResult.error);
	}
	return ok(paywallProductsResult.value ?? []);
};
