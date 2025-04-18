import { db, projectPaymentProviderConfiguration } from "@voidhash/db";
import { and, eq } from "drizzle-orm";

export const getPaymentProviderConfigurationsQuery = async (
	projectId: string
) => {
	return await db
		.select()
		.from(projectPaymentProviderConfiguration)
		.where(eq(projectPaymentProviderConfiguration.projectId, projectId));
};

export const getExistingPaymentProviderConfigurationByIdQuery = async (
	projectId: string,
	providerId: string
) => {
	return await db.query.projectPaymentProviderConfiguration.findFirst({
		where: and(
			eq(projectPaymentProviderConfiguration.projectId, projectId),
			eq(projectPaymentProviderConfiguration.providerId, providerId)
		),
	});
};
