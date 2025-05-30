import { ServiceContext } from "@/lib/service-function";
import {
	Customer,
	customers,
	Paywall,
	paywallLocations,
	PaywallProduct,
	paywallProducts,
	Product,
} from "@voidhash/db";
import {
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	fromUnknownThrow,
} from "@voidhash/lib/constants";
import { asc, eq } from "drizzle-orm";
import { Result, ResultAsync, err, ok } from "neverthrow";

export const getCustomerWithParentByAppUserIdQuery = async (
	ctx: ServiceContext,
	appUserId: string
): Promise<
	Result<
		Customer & { parentCustomer: Customer | null },
		VoidhashInternalServerError | VoidhashNotFoundError
	>
> => {
	const res = await ResultAsync.fromPromise(
		ctx.db.query.customers.findFirst({
			where: eq(customers.appUserId, appUserId),
			with: {
				parentCustomer: true,
			},
		}),
		(e) => fromUnknownThrow(e)
	);

	if (res.isErr()) {
		return err(res.error);
	}
	if (!res.value) {
		return err({
			code: "NOT_FOUND",
			message: "Customer not found",
			resource: "customer",
			payload: {
				appUserId,
			},
		});
	}

	return ok(res.value);
};

export type PaywallWithProducts = {
	id: string;
	products: {
		id: string;
		name: string;
		price?: number;
	}[];
};
export const getPaywallWithProductsByLocationSlugQuery = async (
	ctx: ServiceContext,
	locationSlug: string
): Promise<
	Result<
		Paywall & {
			paywallProducts: (PaywallProduct & {
				product: Product;
			})[];
		},
		VoidhashInternalServerError | VoidhashNotFoundError
	>
> => {
	const res = await ResultAsync.fromPromise(
		ctx.db.query.paywallLocations.findFirst({
			where: eq(paywallLocations.slug, locationSlug),
			with: {
				defaultPaywall: {
					with: {
						paywallProducts: {
							with: {
								product: true,
							},
							orderBy: [asc(paywallProducts.order)],
						},
					},
				},
			},
		}),
		(e) => fromUnknownThrow(e)
	);

	if (res.isErr()) {
		return err(res.error);
	}

	if (!res.value?.defaultPaywall) {
		return err({
			code: "NOT_FOUND",
			message: "Paywall not found",
			resource: "paywall",
			payload: {
				locationSlug,
			},
		});
	}

	return ok(res.value.defaultPaywall);
};
