import { projectPaymentProviderConfigurations } from "@voidhash/db";
import { and, eq } from "drizzle-orm";
import { ServiceContext } from "@/lib/service-function";

export const getPaymentProviderConfigurationsQuery = async (
	ctx: ServiceContext,
	projectId: string
) => {
	return await ctx.db
		.select()
		.from(projectPaymentProviderConfigurations)
		.where(eq(projectPaymentProviderConfigurations.projectId, projectId));
};

export const getExistingPaymentProviderConfigurationByIdQuery = async (
	ctx: ServiceContext,
	projectId: string,
	providerId: string
) => {
	return await ctx.db.query.projectPaymentProviderConfigurations.findFirst({
		where: and(
			eq(projectPaymentProviderConfigurations.projectId, projectId),
			eq(projectPaymentProviderConfigurations.providerId, providerId)
		),
	});
};
