import { ServiceContext } from "@/lib/service-function";
import { Customer, customers } from "@voidhash/db";
import {
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	fromUnknownThrow,
} from "@voidhash/lib/constants";
import { eq } from "drizzle-orm";
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
