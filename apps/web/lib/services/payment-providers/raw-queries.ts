import { db, projectPaymentProviderConfiguration } from "@voidhash/db";
import { eq } from "drizzle-orm";

export const getPaymentProviderConfigurationsQuery = async (
	projectId: string
) => {
	return await db
		.select()
		.from(projectPaymentProviderConfiguration)
		.where(eq(projectPaymentProviderConfiguration.projectId, projectId));
};
