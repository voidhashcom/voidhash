import { db, projectPaymentProviderConfiguration } from "@voidhash/db";
import { eq } from "drizzle-orm";

export async function getPaymentProvidersConfigurations({
	projectId,
}: {
	projectId: string;
}) {
	// TODO: Auth
	const paymentProviderConfigurations = await db
		.select()
		.from(projectPaymentProviderConfiguration)
		.where(eq(projectPaymentProviderConfiguration.projectId, projectId));

	return paymentProviderConfigurations;
}
