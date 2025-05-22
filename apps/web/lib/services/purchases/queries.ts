import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { cache } from "react";
import { z } from "zod";
import { getPurchasesQuery, GetPurchasesQueryResult } from "./raw-queries";
import { err, Result } from "neverthrow";
import {
	VoidhashBadRequestError,
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib/constants";

export const getPurchasesInputSchema = z.object({
	projectId: z.string(),
	customerId: z.string().optional(),
});

type GetPurchasesError =
	| VoidhashUnauthorizedError
	| VoidhashInternalServerError
	| VoidhashForbiddenError
	| VoidhashBadRequestError;

export const getPurchases = cache(
	createServiceFunction()
		.input(getPurchasesInputSchema)
		.function(
			async ({
				input,
				ctx,
			}): Promise<Result<GetPurchasesQueryResult, GetPurchasesError>> => {
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
						message: "You do not have permission to access this project",
					} satisfies VoidhashForbiddenError);
				}

				return await getPurchasesQuery(
					authenticatedContext.value,
					input.customerId
				);
			}
		).invoke
);
