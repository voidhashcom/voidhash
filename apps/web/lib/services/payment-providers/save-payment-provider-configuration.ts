import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { z } from "zod";
import { projectPaymentProviderConfiguration } from "@voidhash/db";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { and, eq } from "drizzle-orm";
import { VoidhashError } from "@voidhash/lib";
import { getExistingPaymentProviderConfigurationByIdQuery } from "./raw-queries";
import { createId } from "@voidhash/lib/functions";

export const savePaymentProviderConfigurationInputSchema = z.object({
	providerId: z.enum(
		paymentProviders.map((p) => p.id) as [string, ...string[]]
	),
	projectId: z.string(),
	enabled: z.boolean(),
	configuration: z.object({}).passthrough(),
});

export const savePaymentProviderConfiguration = createServiceFunction()
	.input(savePaymentProviderConfigurationInputSchema)
	.function(async ({ input, ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);
		if (!hasProjectPermission(authenticatedContext, input.projectId, "")) {
			throw new VoidhashError({
				code: "UNAUTHORIZED",
				message:
					"You are not authorized to save this payment provider configuration",
			});
		}

		const provider = paymentProviders.find((p) => p.id === input.providerId);
		if (!provider) {
			throw new Error(`Provider ${input.providerId} not found`);
		}

		const existingConfiguration =
			await getExistingPaymentProviderConfigurationByIdQuery(
				authenticatedContext,
				input.projectId,
				input.providerId
			);

		if (input.enabled) {
			const configurationSchema = provider.configuration.configurationSchema;
			const parsedConfiguration = configurationSchema.parse(
				input.configuration
			);

			if (existingConfiguration) {
				await ctx.db
					.update(projectPaymentProviderConfiguration)
					.set({
						configuration: parsedConfiguration,
						enabled: input.enabled,
					})
					.where(
						and(
							eq(
								projectPaymentProviderConfiguration.providerId,
								input.providerId
							),
							eq(projectPaymentProviderConfiguration.projectId, input.projectId)
						)
					);
			} else {
				await ctx.db.insert(projectPaymentProviderConfiguration).values({
					id: createId(),
					providerId: input.providerId,
					projectId: input.projectId,
					enabled: input.enabled,
					configuration: parsedConfiguration,
				});
			}
		} else {
			await ctx.db
				.update(projectPaymentProviderConfiguration)
				.set({
					enabled: false,
				})
				.where(
					and(
						eq(
							projectPaymentProviderConfiguration.providerId,
							input.providerId
						),
						eq(projectPaymentProviderConfiguration.projectId, input.projectId)
					)
				);
		}
	});
