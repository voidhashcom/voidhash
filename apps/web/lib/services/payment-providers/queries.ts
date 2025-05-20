import {
	authenticateContext,
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
						message: "You are not authorized to access this project",
					});
				}
				return await getPaymentProviderConfigurationsQuery(
					authenticatedContext.value,
					input.projectId
				);
			}
		).invoke
);
