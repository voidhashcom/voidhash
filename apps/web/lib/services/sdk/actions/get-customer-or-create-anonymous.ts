import {
	createServiceFunction,
	authenticateContext,
	ServiceContext,
} from "@/lib/service-function";
import { customers, type Customer, type InsertCustomer } from "@voidhash/db";
import {
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashForbiddenError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib/constants";
import { Result, err, ok } from "neverthrow";
import { getCustomerWithParentByAppUserIdQuery } from "../raw-queries";
import { isAnonymousId } from "../utils";
import { generateId } from "@/lib/id/generate";

type GetOrCreateAnonymousCustomerError =
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashForbiddenError
	| VoidhashUnauthorizedError;

export const sdkGetCustomerOrCreateAnonymous = createServiceFunction().function(
	async ({
		ctx,
	}): Promise<Result<Customer, GetOrCreateAnonymousCustomerError>> => {
		const authenticatedContext = await authenticateContext(ctx);

		if (authenticatedContext.isErr()) {
			return err(authenticatedContext.error);
		}

		const appUserId = authenticatedContext.value.session?.customer?.appUserId;

		if (!appUserId) {
			return err({
				code: "UNAUTHORIZED",
				message: "App user ID not found",
			});
		}

		const projectId = authenticatedContext.value.session?.projects[0]?.id;
		if (!projectId) {
			return err({
				code: "INTERNAL_SERVER_ERROR",
				message: "Project ID not found after authentication",
				originalError: new Error("Project ID not found after authentication"),
			});
		}

		const customer = await getCustomerWithParentByAppUserIdQuery(
			authenticatedContext.value,
			appUserId
		);

		if (customer.isErr()) {
			// When not found, we should check if the id is anonymous. If it is, we should create a new customer.
			if (customer.error.code === "NOT_FOUND" && isAnonymousId(appUserId)) {
				return createAnonymousCustomer(authenticatedContext.value, {
					projectId,
					appUserId: appUserId,
					origin: "ios", // TODO: Make this dynamic
				});
			}

			return err(customer.error);
		}

		// Return parent, if it exists
		if (customer.value.parentCustomer) {
			return ok(customer.value.parentCustomer);
		}

		return ok(customer.value);
	}
);

async function createAnonymousCustomer(
	ctx: ServiceContext,
	input: {
		projectId: string;
		appUserId: string;
		origin: "ios" | "android";
	}
): Promise<Result<Customer, VoidhashInternalServerError>> {
	try {
		const newCustomer = {
			id: generateId("customer"),
			type: "anonymous",
			parentCustomerId: null,
			projectId: input.projectId,
			appUserId: input.appUserId,
			origin: input.origin,
		} satisfies InsertCustomer;

		await ctx.db.insert(customers).values(newCustomer);

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
