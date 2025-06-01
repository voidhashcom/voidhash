import {
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
import { isAuthenticated } from "@/lib/middlewares";

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
		.use(isAuthenticated)
		.function(
			async ({
				input,
				ctx,
			}): Promise<Result<GetPurchasesQueryResult, GetPurchasesError>> => {
				if (!hasProjectPermission(ctx, input.projectId, "project:all")) {
					return err({
						code: "FORBIDDEN",
						message: "You do not have permission to access this project",
					} satisfies VoidhashForbiddenError);
				}

				return await getPurchasesQuery(ctx, input.customerId);
			}
		).invoke
);
