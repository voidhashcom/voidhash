import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import {
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib";
import { z } from "zod";
import { Customer, customers, InsertCustomer } from "@voidhash/db";
import { generateId } from "@/lib/id/generate";
import { err, ok, Result } from "neverthrow";

export const createCustomerInputSchema = z.object({
	projectId: z.string(),
	appUserId: z.string(),
	name: z.string().optional(),
	email: z.string().email().optional(),
	origin: z.enum(["dashboard", "ios", "android", "stripe", "api"]),
});

type CreateCustomerError =
	| VoidhashUnauthorizedError
	| VoidhashInternalServerError
	| VoidhashForbiddenError;

export const createCustomer = createServiceFunction()
	.input(createCustomerInputSchema)
	.function(
		async ({ input, ctx }): Promise<Result<Customer, CreateCustomerError>> => {
			const authenticatedContext = await authenticateContext(ctx);

			if (authenticatedContext.isErr()) {
				return err(authenticatedContext.error);
			}

			if (
				!hasProjectPermission(
					authenticatedContext.value,
					input.projectId,
					"project:all"
				)
			) {
				return err({
					code: "FORBIDDEN",
					message: "You are not authorized to create customers",
					resource: "customer",
					payload: { projectId: input.projectId },
				});
			}

			const newCustomer = {
				id: generateId("customer"),
				projectId: input.projectId,
				appUserId: input.appUserId,
				type: "identified",
				name: input.name ?? null,
				email: input.email ?? null,
				parentCustomerId: null,
				origin: input.origin,
			} satisfies InsertCustomer;

			try {
				await ctx.db.insert(customers).values(newCustomer);
				return ok({
					...newCustomer,
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
	);
