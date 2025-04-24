import { customer, db } from "@voidhash/db";
import { eq } from "drizzle-orm";

export const getCustomersQuery = async (projectId: string) => {
	const customers = db
		.select()
		.from(customer)
		.where(eq(customer.projectId, projectId));
	return customers;
};

export const getCustomerByAppUserIdQuery = async (appUserId: string) => {
	const res = await db
		.select()
		.from(customer)
		.where(eq(customer.appUserId, appUserId));

	return res[0];
};
