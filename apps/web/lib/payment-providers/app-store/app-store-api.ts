import { createPaymentProviderApi } from "@/lib/services/payment-providers/core/payment-provider-api";
import { App } from "@/lib/api/hono/app";
// import { registerAppStoreValidateTransaction } from "./api/app-store_validateTransaction";

export const appStoreApi = createPaymentProviderApi({
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	registerEndpoints: (app: App) => {
		// registerAppStoreValidateTransaction(app);
	},
});
