import { ServiceContext } from "@/lib/service-function";
import { customers, eq } from "@voidhash/db";
import { VoidhashInternalServerError } from "@voidhash/lib/constants";
import { ok, Result } from "neverthrow";

export async function mergeCustomers(
	ctx: ServiceContext,
	fromCustomerId: string,
	toCustomerId: string
): Promise<Result<null, VoidhashInternalServerError>> {
	await ctx.db.transaction(async (tx) => {
		// Archive the from customer and reparent
		await tx
			.update(customers)
			.set({
				archivedAt: new Date(),
				parentCustomerId: toCustomerId,
			})
			.where(eq(customers.id, fromCustomerId));

		// TODO: Transfer all the data from the from customer to the to customer
	});
	return ok(null);
}
