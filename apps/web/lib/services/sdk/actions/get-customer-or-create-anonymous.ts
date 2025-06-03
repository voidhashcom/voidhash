import { createServiceFunction, ServiceContext } from "@/lib/service-function";
import { customers, type Customer, type InsertCustomer } from "@voidhash/db";
import {
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashForbiddenError,
	VoidhashUnauthorizedError,
	Environment,
} from "@voidhash/lib/constants";
import { Result, err, ok } from "neverthrow";
import { getCustomerWithParentByAppUserIdQuery } from "../raw-queries";
import { isAnonymousId } from "../utils";
import { generateId } from "@/lib/id/generate";
import { hasEnvironment, isAuthenticated } from "@/lib/middlewares";

type GetOrCreateAnonymousCustomerError =
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashForbiddenError
	| VoidhashUnauthorizedError;

export const sdkGetCustomerOrCreateAnonymous = createServiceFunction()
	.use(isAuthenticated)
	.use(hasEnvironment)
	.function(
		async ({
			ctx,
		}): Promise<Result<Customer, GetOrCreateAnonymousCustomerError>> => {
			const appUserId = ctx.session?.customer?.appUserId;

			if (!appUserId) {
				return err({
					code: "UNAUTHORIZED",
					message: "App user ID not found",
				});
			}

			const projectId = ctx.session?.projects[0]?.id;
			if (!projectId) {
				return err({
					code: "INTERNAL_SERVER_ERROR",
					message: "Project ID not found after authentication",
					originalError: new Error("Project ID not found after authentication"),
				});
			}

			const customer = await getCustomerWithParentByAppUserIdQuery(
				ctx,
				appUserId,
				ctx.session.environment
			);

			if (customer.isErr()) {
				// When not found, we should check if the id is anonymous. If it is, we should create a new customer.
				if (customer.error.code === "NOT_FOUND" && isAnonymousId(appUserId)) {
					return createAnonymousCustomer(ctx, {
						projectId,
						appUserId: appUserId,
						origin: "ios", // TODO: Make this dynamic
						environment: ctx.session.environment,
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
		environment: Environment;
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
			environment: input.environment,
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
