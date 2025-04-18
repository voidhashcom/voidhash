import { z } from "zod";
import { PaymentProvider } from "../types";

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
	defaultConfiguration: {
		issuerId: "",
		bundleId: "",
		keyId: "",
		privateKey: "",
	},
} satisfies PaymentProvider;
