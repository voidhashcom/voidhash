import { projectPaymentProviderConfiguration } from "@voidhash/db";
import { and, eq } from "drizzle-orm";
import { ServiceContext } from "@/lib/service-function";

export const getPaymentProviderConfigurationsQuery = async (
	ctx: ServiceContext,
	projectId: string
) => {
	return await ctx.db
		.select()
		.from(projectPaymentProviderConfiguration)
		.where(eq(projectPaymentProviderConfiguration.projectId, projectId));
};

export const getExistingPaymentProviderConfigurationByIdQuery = async (
	ctx: ServiceContext,
	projectId: string,
	providerId: string
) => {
	return await ctx.db.query.projectPaymentProviderConfiguration.findFirst({
		where: and(
			eq(projectPaymentProviderConfiguration.projectId, projectId),
			eq(projectPaymentProviderConfiguration.providerId, providerId)
		),
	});
};
