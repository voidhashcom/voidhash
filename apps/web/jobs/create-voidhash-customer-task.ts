import { voidhash } from "@/lib/voidhash";
import { task } from "@trigger.dev/sdk/v3";

// Combine different retry strategies
type Payload = {
	organizationId: string;
	email: string;
	name: string;
};
export const createVoidhashCustomerTask = task({
	id: "create-voidhash-customer-task",
	retry: {
		maxAttempts: 3,
		minTimeoutInMs: 1_000,
		maxTimeoutInMs: 30_000,
		factor: 2,
	},
	run: async ({ organizationId, email, name }: Payload) => {
		// If this throws (and isn't caught), the task will be retried
		const customer = await voidhash.customers.create({
			// Customer in voidhash will be linked to the organization
			appUserId: organizationId,
			email,
			name,
		});

		return customer;
	},
});
