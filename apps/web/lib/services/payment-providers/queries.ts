import {
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { cache } from "react";
import { getPaymentProviderConfigurationsQuery } from "./raw-queries";
import { z } from "zod";
import { err, Result } from "neverthrow";
import { ProjectPaymentProviderConfiguration } from "@voidhash/db";
import {
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib/constants";
import { isAuthenticated } from "@/lib/middlewares";

type GetPaymentProviderConfigurationsError =
	| VoidhashInternalServerError
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError;

export const getPaymentProviderConfigurations = cache(
	createServiceFunction()
		.input(
			z.object({
				projectId: z.string(),
			})
		)
		.use(isAuthenticated)
		.function(
			async ({
				ctx,
				input,
			}): Promise<
				Result<
					ProjectPaymentProviderConfiguration[],
					GetPaymentProviderConfigurationsError
				>
			> => {
				if (!hasProjectPermission(ctx, input.projectId, "project:all")) {
					return err({
						code: "FORBIDDEN",
						message: "You are not authorized to access this project",
					});
				}
				return await getPaymentProviderConfigurationsQuery(
					ctx,
					input.projectId
				);
			}
		).invoke
);
