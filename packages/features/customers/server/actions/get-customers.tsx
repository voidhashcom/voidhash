import { db, organization, projects, customer } from "@voidhash/db";
import { eq } from "drizzle-orm";

export async function getCustomers({
	projectId,
}: {
	projectId: string;
}) {
	// TODO: Auth
	const customers = await db
		.select()
		.from(customer)
		.where(eq(customer.projectId, projectId));

	return customers;
}
