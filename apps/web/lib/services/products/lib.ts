import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { VoidhashBadRequestError } from "@voidhash/lib/constants";
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
): Result<string, VoidhashBadRequestError> => {
	const paymentProvider = paymentProviders.find(
		(p) => p.id === paymentProviderId
	);
	if (!paymentProvider) {
		return err({
			code: "BAD_REQUEST",
			message: "Payment provider not found",
		});
	}
	return ok(
		paymentProvider.products.keyProperties
			.map((key) => configuration[key])
			.join(":")
	);
};
