import {
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { z } from "zod";
import { projectPaymentProviderConfigurations } from "@voidhash/db";
import { eq } from "drizzle-orm";
import {
	fromUnknownThrow,
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib";
import { getPaymentProviderConfigurationByIdQuery } from "../raw-queries";
import { err, ok, Result } from "neverthrow";
import { isAuthenticated } from "@/lib/middlewares";
import { safeTryPromise } from "@/lib/neverthrow";

export const deletePaymentProviderConfigurationInputSchema = z.object({
	paymentProviderConfigurationId: z.string(),
});

type DeletePaymentProviderConfigurationError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError;

export const deletePaymentProviderConfiguration = createServiceFunction()
	.input(deletePaymentProviderConfigurationInputSchema)
	.use(isAuthenticated)
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<void, DeletePaymentProviderConfigurationError>> => {
			const paymentProviderConfigurationResult =
				await getPaymentProviderConfigurationByIdQuery(
					ctx,
					input.paymentProviderConfigurationId
				);

			if (paymentProviderConfigurationResult.isErr()) {
				return err(paymentProviderConfigurationResult.error);
			}

			const paymentProviderConfiguration =
				paymentProviderConfigurationResult.value;

			if (
				!hasProjectPermission(
					ctx,
					paymentProviderConfiguration.projectId,
					"project:all"
				)
			) {
				return err({
					code: "FORBIDDEN",
					message:
						"You are not authorized to save this payment provider configuration",
				});
			}

			return await safeTryPromise({
				try: async () => {
					await ctx.db
						.update(projectPaymentProviderConfigurations)
						.set({
							deletedAt: new Date(),
						})
						.where(
							eq(
								projectPaymentProviderConfigurations.id,
								paymentProviderConfiguration.id
							)
						);

					return ok(undefined);
				},
				catch: (error) => {
					return fromUnknownThrow(error);
				},
			});
		}
	);
