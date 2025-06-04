import {
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { z } from "zod";
import { projectPaymentProviderConfigurations } from "@voidhash/db";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { and, eq } from "drizzle-orm";
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

export const savePaymentProviderConfigurationInputSchema = z.object({
	providerId: z.enum(
		paymentProviders.map((p) => p.id) as [string, ...string[]]
	),
	projectId: z.string(),
	enabled: z.boolean(),
	configuration: z.object({}).passthrough(),
});

type SavePaymentProviderConfigurationError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashBadRequestError;

export const savePaymentProviderConfiguration = createServiceFunction()
	.input(savePaymentProviderConfigurationInputSchema)
	.use(isAuthenticated)
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<void, SavePaymentProviderConfigurationError>> => {
			if (!hasProjectPermission(ctx, input.projectId, "project:all")) {
				return err({
					code: "FORBIDDEN",
					message:
						"You are not authorized to save this payment provider configuration",
				});
			}

			const provider = paymentProviders.find((p) => p.id === input.providerId);
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

			if (input.enabled) {
				const configurationSchema = provider.configuration?.configurationSchema;
				if (!configurationSchema) {
					return err({
						code: "BAD_REQUEST",
						message: `Provider ${input.providerId} does not have a configuration`,
					} satisfies VoidhashBadRequestError);
				}
				const parsedConfiguration = configurationSchema.parse(
					input.configuration
				);

				const existingConfiguration =
					await getExistingPaymentProviderConfigurationByIdQuery(
						ctx,
						input.projectId,
						input.providerId
					);

				// Update if exists
				if (existingConfiguration.isOk()) {
					try {
						await ctx.db
							.update(projectPaymentProviderConfigurations)
							.set({
								configuration: parsedConfiguration,
								enabled: input.enabled,
							})
							.where(
								and(
									eq(
										projectPaymentProviderConfigurations.providerId,
										input.providerId
									),
									eq(
										projectPaymentProviderConfigurations.projectId,
										input.projectId
									)
								)
							);
						return ok(undefined);
					} catch (e) {
						return err(fromUnknownThrow(e));
					}
				}

				// Create if not found
				if (existingConfiguration.error.code === "NOT_FOUND") {
					try {
						await ctx.db.insert(projectPaymentProviderConfigurations).values({
							id: generateId("projectPaymentProviderConfiguration"),
							providerId: input.providerId,
							projectId: input.projectId,
							enabled: input.enabled,
							configuration: parsedConfiguration,
						});
						return ok(undefined);
					} catch (e) {
						return err(fromUnknownThrow(e));
					}
				}

				// If any other error, return it
				return err(existingConfiguration.error);
			}

			// Disable if disabled
			try {
				await ctx.db
					.update(projectPaymentProviderConfigurations)
					.set({
						enabled: false,
					})
					.where(
						and(
							eq(
								projectPaymentProviderConfigurations.providerId,
								input.providerId
							),
							eq(
								projectPaymentProviderConfigurations.projectId,
								input.projectId
							)
						)
					);
				return ok(undefined);
			} catch (e) {
				return err(fromUnknownThrow(e));
			}
		}
	);
