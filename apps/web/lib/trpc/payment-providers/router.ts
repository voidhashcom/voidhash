import { db, projectPaymentProviderConfiguration } from "@voidhash/db";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
	getPaymentProvidersConfigurationsSchema,
	savePaymentProviderConfigurationSchema,
} from "./schema";
import { and, eq } from "drizzle-orm";
import { paymentProviders } from "@voidhash/lib";

export const paymentProvidersRouter = createTRPCRouter({
	paymentProvidersConfigurations: protectedProcedure
		.input(getPaymentProvidersConfigurationsSchema)
		.query(async ({ ctx, input }) => {
			const paymentProviderConfigurations = await db
				.select()
				.from(projectPaymentProviderConfiguration)
				.where(
					eq(projectPaymentProviderConfiguration.projectId, input.projectId)
				);

			return paymentProviderConfigurations;
		}),

	savePaymentProviderConfiguration: protectedProcedure
		.input(savePaymentProviderConfigurationSchema)
		.mutation(async ({ ctx, input }) => {
			const provider = paymentProviders.find((p) => p.id === input.providerId);
			if (!provider) {
				throw new Error(`Provider ${input.providerId} not found`);
			}

			const existingConfiguration =
				await db.query.projectPaymentProviderConfiguration.findFirst({
					where: and(
						eq(
							projectPaymentProviderConfiguration.providerId,
							input.providerId
						),
						eq(projectPaymentProviderConfiguration.projectId, input.projectId)
					),
				});

			if (input.enabled) {
				const configurationSchema = provider.configurationSchema;
				const parsedConfiguration = configurationSchema.parse(
					input.configuration
				);

				if (existingConfiguration) {
					await db
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
								eq(
									projectPaymentProviderConfiguration.projectId,
									input.projectId
								)
							)
						);
				} else {
					await db.insert(projectPaymentProviderConfiguration).values({
						providerId: input.providerId,
						projectId: input.projectId,
						enabled: input.enabled,
						configuration: parsedConfiguration,
					});
				}
			} else {
				await db
					.update(projectPaymentProviderConfiguration)
					.set({
						enabled: false,
						configuration: null,
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
		}),
});
