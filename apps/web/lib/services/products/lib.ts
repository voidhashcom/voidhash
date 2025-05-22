import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { VoidhashInternalServerError } from "@voidhash/lib/constants";
import { err, ok, Result } from "neverthrow";
import { z } from "zod";

export const createPaymentProviderKey = <
	TKey extends (typeof paymentProviders)[number]["id"],
	TConfiguration extends z.infer<
		(typeof paymentProviders)[number]["products"]["productConfigurationSchema"]
	>,
>(
	paymentProviderId: TKey,
	configuration: TConfiguration
): Result<string, VoidhashInternalServerError> => {
	const paymentProvider = paymentProviders.find(
		(p) => p.id === paymentProviderId
	);
	if (!paymentProvider) {
		return err({
			code: "INTERNAL_SERVER_ERROR",
			message: "Payment provider not found",
			originalError: new Error("Payment provider not found"),
		});
	}
	return ok(
		paymentProvider.products.keyProperties
			.map((key) => configuration[key])
			.join(":")
	);
};
