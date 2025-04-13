import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db, customer } from "@voidhash/db";
import { eq } from "drizzle-orm";
import { getCustomersSchema } from "./schema";

export const customersRouter = createTRPCRouter({
	getCustomers: protectedProcedure
		.input(getCustomersSchema)
		.query(async ({ ctx, input }) => {
			const customers = await db
				.select()
				.from(customer)
				.where(eq(customer.projectId, input.projectId));

			return customers;
		}),
});
