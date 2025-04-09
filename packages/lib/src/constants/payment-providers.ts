import { z } from "zod";

export type PaymentProvider = {
	id: "app-store";
	title: string;
	configurationSchema: z.ZodSchema;
};

export const appStore = {
	id: "app-store",
	title: "Apple App Store",
	configurationSchema: z.object({
		issuerId: z.string().min(1, {
			message: "Issuer ID is required",
		}),
		bundleId: z.string().min(1, {
			message: "Bundle ID is required",
		}),
		keyId: z.string().min(1, {
			message: "Key ID is required",
		}),
		privateKey: z.string().min(1, {
			message: "Private key is required",
		}),
	}),
} satisfies PaymentProvider;

export const paymentProviders = [appStore] as const;
