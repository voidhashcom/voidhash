import { createServiceFunction } from "@/lib/service-function";
import { z } from "zod";
import { db, projectPaymentProviderConfiguration } from "@voidhash/db";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { and, eq } from "drizzle-orm";
import { NotFoundError } from "@voidhash/lib/constants";
import { getProjectById } from "../projects/queries";
import { getExistingPaymentProviderConfigurationByIdQuery } from "./raw-queries";

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
		const project = await getProjectById({
			ctx,
			input: { id: input.projectId },
		});
		if (!project) {
			throw new NotFoundError("Project not found");
		}
		const provider = paymentProviders.find((p) => p.id === input.providerId);
		if (!provider) {
			throw new Error(`Provider ${input.providerId} not found`);
		}

		const existingConfiguration =
			await getExistingPaymentProviderConfigurationByIdQuery(
				input.projectId,
				input.providerId
			);

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
							eq(projectPaymentProviderConfiguration.projectId, input.projectId)
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
