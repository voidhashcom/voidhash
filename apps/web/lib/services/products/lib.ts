import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { z } from "zod";

export const createPaymentProviderKey = <
	TKey extends (typeof paymentProviders)[number]["id"],
	TConfiguration extends z.infer<
		(typeof paymentProviders)[number]["products"]["productConfigurationSchema"]
	>,
>(
	paymentProviderId: TKey,
	configuration: TConfiguration
) => {
	const paymentProvider = paymentProviders.find(
		(p) => p.id === paymentProviderId
	);
	if (!paymentProvider) {
		throw new Error("Payment provider not found");
	}
	return paymentProvider.products.keyProperties
		.map((key) => configuration[key])
		.join(":");
};
