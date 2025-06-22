import {
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { z } from "zod";
import { paymentProviderConfigurations, Transaction } from "@voidhash/db";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import {
	fromUnknownThrow,
	VoidhashBadRequestError,
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib";
import { getExistingPaymentProviderConfigurationByIdQuery } from "../raw-queries";
import { generateId } from "@/lib/id/generate";
import { err, ok, Result } from "neverthrow";
import { isAuthenticated } from "@/lib/middlewares";
import { safeTryPromise } from "@/lib/neverthrow";

export const createPaymentProviderConfigurationInputSchema = z.object({
	providerId: z.enum(
		paymentProviders.map((p) => p.getId()) as [string, ...string[]]
	),
	projectId: z.string(),
});

type CreatePaymentProviderConfigurationError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashBadRequestError;

export const createPaymentProviderConfiguration = createServiceFunction()
	.input(createPaymentProviderConfigurationInputSchema)
	.use(isAuthenticated)
	.function(
		async ({
			input,
			ctx,
		}): Promise<
			Result<{ id: string }, CreatePaymentProviderConfigurationError>
		> => {
			if (!hasProjectPermission(ctx, input.projectId, "project:all")) {
				return err({
					code: "FORBIDDEN",
					message:
						"You are not authorized to save this payment provider configuration",
				});
			}

			const provider = paymentProviders.find(
				(p) => p.getId() === input.providerId
			);
			if (!provider) {
				return err({
					code: "NOT_FOUND",
					message: `Provider ${input.providerId} not found`,
					resource: "payment_provider",
					payload: {
						providerId: input.providerId,
					},
				});
			}

			const canHaveMultipleConfigurations = provider.getType() === "native";

			const res = await safeTryPromise(
				async () => {
					return await ctx.db.transaction(async (tx: Transaction) => {
						if (!canHaveMultipleConfigurations) {
							const existingConfiguration =
								await getExistingPaymentProviderConfigurationByIdQuery(
									{
										...ctx,
										tx,
									},
									input.projectId,
									input.providerId
								);

							if (existingConfiguration.isOk()) {
								return err({
									code: "BAD_REQUEST",
									message: `Provider ${input.providerId} can only have one configuration`,
								} satisfies VoidhashBadRequestError);
							}
						}

						const id = generateId("paymentProviderConfiguration");

						await ctx.db.insert(paymentProviderConfigurations).values({
							id: id,
							configuration: provider.getDefaultGlobalConfiguration(),
							enabled: provider.getIsConfigurable() ? false : true,
							name: provider.getTitle(),
							providerId: input.providerId,
							projectId: input.projectId,
							paymentProviderKey: "empty",
						});

						return ok({ id: id });
					});
				},
				(error) => {
					return fromUnknownThrow(error);
				}
			);

			return res;
		}
	);
