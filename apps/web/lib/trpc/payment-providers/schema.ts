import { z } from "zod";
import { paymentProviders } from "@voidhash/lib";

export const savePaymentProviderConfigurationSchema = z.object({
	providerId: z.enum(
		paymentProviders.map((p) => p.id) as [string, ...string[]]
	),
	projectId: z.string(),
	enabled: z.boolean(),
	configuration: z.object({}).passthrough(),
});

export const getPaymentProvidersConfigurationsSchema = z.object({
	projectId: z.string(),
});
