import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "../../lib/middlewares/auth-middleware";
import { getPaymentProvidersConfigurations } from "./actions/get-payment-providers-configurations";
import { getPaymentProvidersConfigurationsSchema } from "./schema";
export const getPaymentProvidersConfigurationsQuery = createServerFn({
	method: "GET",
})
	.middleware([authMiddleware])
	.validator((input) => getPaymentProvidersConfigurationsSchema.parse(input))
	.handler(async ({ data }) => {
		const { projectId } = data;
		const paymentProviderConfigurations =
			await getPaymentProvidersConfigurations({
				projectId,
			});
		return paymentProviderConfigurations;
	});
