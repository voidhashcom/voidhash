import { generateId } from "@/lib/id/generate";
import { ServiceContext } from "@/lib/service-function";
import { Customer, InsertCustomer, customers } from "@voidhash/db";
import {
	Environment,
	VoidhashInternalServerError,
} from "@voidhash/lib/constants";
import { Result, err, ok } from "neverthrow";

export async function createAnonymousCustomer(
	ctx: ServiceContext,
	input: {
		projectId: string;
		appUserId: string;
		origin: "ios" | "android";
		environment: Environment;
	}
): Promise<Result<Customer, VoidhashInternalServerError>> {
	const tx = ctx.tx ?? ctx.db;
	try {
		const newCustomer = {
			id: generateId("customer"),
			type: "anonymous",
			parentCustomerId: null,
			projectId: input.projectId,
			appUserId: input.appUserId,
			origin: input.origin,
			environment: input.environment,
		} satisfies InsertCustomer;

		await tx.insert(customers).values(newCustomer);

		return ok({
			...newCustomer,
			name: null,
			email: null,
			archivedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
	} catch (error) {
		return err({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to create customer",
			originalError: error,
		});
	}
}
