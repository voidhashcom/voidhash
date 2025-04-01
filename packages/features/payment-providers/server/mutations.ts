import { createServerFn } from "@tanstack/react-start";
import { savePaymentProviderConfigurationSchema } from "./schema";
import { saveConfiguration } from "./actions/save-configuration";
import { authMiddleware } from "../../lib/middlewares/auth-middleware";
export const savePaymentProviderConfigurationMutation = createServerFn({
	method: "POST",
})
	.middleware([authMiddleware])
	.validator((input) => savePaymentProviderConfigurationSchema.parse(input))
	.handler(async ({ data }) => {
		// TODO: Add auth
		const { providerId, projectId, enabled, configuration } = data;
		console.log("savePaymentProviderConfigurationMutation");
		console.log({ providerId, projectId, enabled, configuration });
		await saveConfiguration(providerId, projectId, enabled, configuration);
	});
