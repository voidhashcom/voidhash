import {
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { cache } from "react";
import {
	getPaymentProviderConfigurationByIdQuery,
	getPaymentProviderConfigurationsQuery,
} from "./raw-queries";
import { z } from "zod";
import { err, ok, Result } from "neverthrow";
import { PaymentProviderConfiguration } from "@voidhash/db";
import {
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
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
					PaymentProviderConfiguration[],
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

type GetPaymentProviderConfigurationByIdError =
	| VoidhashInternalServerError
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashNotFoundError;

export const getPaymentProviderConfigurationById = cache(
	createServiceFunction()
		.input(z.object({ id: z.string() }))
		.use(isAuthenticated)
		.function(
			async ({
				ctx,
				input,
			}): Promise<
				Result<
					PaymentProviderConfiguration,
					GetPaymentProviderConfigurationByIdError
				>
			> => {
				const configuration = await getPaymentProviderConfigurationByIdQuery(
					ctx,
					input.id
				);
				if (configuration.isErr()) {
					return err(configuration.error);
				}

				if (
					!hasProjectPermission(
						ctx,
						configuration.value.projectId,
						"project:all"
					)
				) {
					return err({
						code: "FORBIDDEN",
						message: "You are not authorized to access this project",
					});
				}

				return ok(configuration.value);
			}
		).invoke
);
