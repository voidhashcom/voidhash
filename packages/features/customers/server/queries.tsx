import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "../../lib/middlewares/auth-middleware";
import { getCustomersSchema } from "./schema";
import { getCustomers } from "./actions/get-customers";

export const getCustomersQuery = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator((input) => getCustomersSchema.parse(input))
	.handler(async ({ data, context }) => {
		const { projectId } = data;
		const customers = await getCustomers({
			projectId,
		});
		return customers;
	});
