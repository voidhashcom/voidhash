import { customer, db } from "@voidhash/db";
import { eq } from "drizzle-orm";

export const getCustomersQuery = async (projectId: string) => {
	const customers = db
		.select()
		.from(customer)
		.where(eq(customer.projectId, projectId));
	return customers;
};
