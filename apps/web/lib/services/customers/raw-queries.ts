import { customer } from "@voidhash/db";
import { eq } from "drizzle-orm";
import { ServiceContext } from "@/lib/service-function";

export const getCustomersQuery = async (
	ctx: ServiceContext,
	projectId: string
) => {
	const customers = ctx.db
		.select()
		.from(customer)
		.where(eq(customer.projectId, projectId));
	return customers;
};

export const getCustomerByAppUserIdQuery = async (
	ctx: ServiceContext,
	appUserId: string
) => {
	const res = await ctx.db
		.select()
		.from(customer)
		.where(eq(customer.appUserId, appUserId));

	return res[0];
};
