import { db } from "@voidhash/db";
import { paymentProviders } from "../../config";
import { and, eq } from "drizzle-orm";
import { projectPaymentProviderConfiguration } from "@voidhash/db/schema";

export async function saveConfiguration(
	providerId: (typeof paymentProviders)[number]["id"],
	projectId: string,
	enabled: boolean,
	configuration: object
) {
	const provider = paymentProviders.find((p) => p.id === providerId);
	if (!provider) {
		throw new Error(`Provider ${providerId} not found`);
	}

	const existingConfiguration =
		await db.query.projectPaymentProviderConfiguration.findFirst({
			where: and(
				eq(projectPaymentProviderConfiguration.providerId, providerId),
				eq(projectPaymentProviderConfiguration.projectId, projectId)
			),
		});

	if (enabled) {
		const configurationSchema = provider.configurationSchema;
		const parsedConfiguration = configurationSchema.parse(configuration);

		if (existingConfiguration) {
			await db
				.update(projectPaymentProviderConfiguration)
				.set({
					configuration: parsedConfiguration,
					enabled,
				})
				.where(
					and(
						eq(projectPaymentProviderConfiguration.providerId, providerId),
						eq(projectPaymentProviderConfiguration.projectId, projectId)
					)
				);
		} else {
			await db.insert(projectPaymentProviderConfiguration).values({
				providerId,
				projectId,
				enabled,
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
					eq(projectPaymentProviderConfiguration.providerId, providerId),
					eq(projectPaymentProviderConfiguration.projectId, projectId)
				)
			);
	}
}
