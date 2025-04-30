import { paymentProviders } from "@/lib/payment-providers/payment-providers";

export const createPaymentProviderKey = <TKey, TConfiguration>(
	configuration: TConfiguration,
	paymentProviderId: TKey
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
