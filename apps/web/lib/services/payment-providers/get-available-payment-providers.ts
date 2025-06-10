import { ServiceContext } from "@/lib/service-function";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import {
	Environment,
	VoidhashInternalServerError,
} from "@voidhash/lib/constants";
import { getPaymentProviderConfigurationsQuery } from "./raw-queries";
import { err, ok, Result } from "neverthrow";
import { PaymentProvider } from "@/lib/services/payment-providers/core/payment-provider";

export async function getAvailablePaymentProviders(
	ctx: ServiceContext,
	projectId,
	environment: Environment
): Promise<
	Result<
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		PaymentProvider<string, any, any>[],
		VoidhashInternalServerError
	>
> {
	const allPaymentProvidersInEnvironment = paymentProviders.filter((provider) =>
		provider.isAvailableInEnvironment(environment)
	);
	const paymentProviderConfigurations =
		await getPaymentProviderConfigurationsQuery(ctx, projectId);

	if (paymentProviderConfigurations.isErr()) {
		return err(paymentProviderConfigurations.error);
	}

	const availablePaymentProviders = allPaymentProvidersInEnvironment.filter(
		(provider) => {
			const configuration = paymentProviderConfigurations.value.find(
				(configuration) => configuration.providerId === provider.getId()
			);

			// Primarily for Dev Checkout
			if (!provider.getIsConfigurable()) {
				return true;
			}

			if (
				!configuration ||
				!configuration.enabled ||
				!configuration.configuration
			) {
				return false;
			}
			return (
				configuration.enabled &&
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				provider.checkIfCorrectlyConfigured(configuration.configuration as any)
			);
		}
	);

	return ok(availablePaymentProviders);
}
