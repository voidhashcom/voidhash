import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { z } from "zod";

// Customer
export const createCustomerBodySchema = z
	.object({
		appUserId: z.string(),
		name: z.string().optional(),
		email: z.string().email().optional(),
	})
	.meta({
		ref: "CreateCustomerBody",
	});

export const customerResponseSchema = z
	.object({
		customerId: z.string(),
		name: z.string().nullable(),
		email: z.string().nullable(),
		appUserId: z.string().nullable(),
		// origin: z.enum(["dashboard", "ios", "android", "stripe", "api"]),
	})
	.meta({
		ref: "Customer",
	});

// Product
export const createProductBodySchema = z
	.object({
		name: z.string(),
	})
	.meta({
		ref: "CreateProductBody",
	});

export const productResponseSchema = z
	.object({
		productId: z.string(),
		name: z.string(),
	})
	.meta({
		ref: "Product",
	});

export const getProductByIdParamsSchema = z.object({
	productId: z.string(),
});

export const updateProductBodySchema = z
	.object({
		name: z.string(),
	})
	.meta({
		ref: "UpdateProductBody",
	});

export const updateProductParamsSchema = z.object({
	productId: z.string(),
});

export const deleteProductParamsSchema = z.object({
	productId: z.string(),
});

const paymentProviderConfigurationProductSchema = z
	.union([
		...paymentProviders.map((p) =>
			z.object({
				providerId: z.literal(p.getId()),
				paymentProviderConfigurationId: z.string(),
				configuration: p.getProductConfigurationSchema(),
			}),
		),
	])
	.meta({
		ref: "PaymentProviderConfigurationProduct",
	});

export const attachProviderProductParamsSchema = z.object({
	productId: z.string(),
});

export const attachProviderProductBodySchema =
	paymentProviderConfigurationProductSchema.meta({
		ref: "AttachProviderProductBody",
	});

export const providerProductResponseSchema = z
	.object({
		providerProductKey: z.string(),
		providerConfiguration: paymentProviderConfigurationProductSchema,
	})
	.meta({
		ref: "ProviderProduct",
	});

export const getProviderProductsParamsSchema = z.object({
	productId: z.string(),
});

export const updateProviderProductParamsSchema = z.object({
	paymentProviderConfigurationProductId: z.string(),
});

export const updateProviderProductBodySchema =
	paymentProviderConfigurationProductSchema.meta({
		ref: "UpdateProviderProductBody",
	});

export const deleteProviderProductParamsSchema = z.object({
	productId: z.string(),
	paymentProviderConfigurationId: z.string(),
	providerProductKey: z.string(),
});

// Paywall
export const createPaywallBodySchema = z
	.object({
		name: z.string(),
	})
	.meta({
		ref: "CreatePaywallBody",
	});

export const paywallResponseSchema = z
	.object({
		paywallId: z.string(),
		name: z.string(),
	})
	.meta({
		ref: "Paywall",
	});

export const getPaywallByIdParamsSchema = z.object({
	paywallId: z.string(),
});

export const deletePaywallParamsSchema = z.object({
	paywallId: z.string(),
});

// Paywall Product
export const attachProductToPaywallParamsSchema = z.object({
	paywallId: z.string(),
});

export const attachProductToPaywallBodySchema = z
	.object({
		productId: z.string(),
	})
	.meta({
		ref: "AttachProductToPaywallBody",
	});

export const paywallProductResponseSchema = z
	.object({
		paywallId: z.string(),
		productId: z.string(),
		productName: z.string().nullable(),
	})
	.meta({
		ref: "PaywallProduct",
	});

export const getPaywallProductsParamsSchema = z.object({
	paywallId: z.string(),
});

export const deletePaywallProductParamsSchema = z.object({
	paywallId: z.string(),
	productId: z.string(),
});

// SDK
export const sdkGetPaywallByLocationParamsSchema = z.object({
	locationSlug: z.string(),
});

export const sdkPaywallResponseSchema = z
	.object({
		paywallId: z.string(),
		paywallProducts: z.array(
			z.object({
				paywallProductId: z.string(),
				productId: z.string(),
				displayName: z.string(),
				price: z.number().nullable(),
				nativePurchaseAvailable: z.boolean(),
				webCheckoutAvailable: z.boolean(),
				webCheckoutPaymentProviderConfigurationProductId: z.string().nullable(),
			}),
		),
	})
	.meta({
		ref: "SdkPaywall",
	});

export const sdkCreateCheckoutBodySchema = z
	.object({
		paymentProviderConfigurationProductId: z.string(),
		successCallbackUrl: z.string().min(1).includes("://"),
		errorCallbackUrl: z.string().min(1).includes("://"),
	})
	.meta({
		ref: "SdkCreateCheckoutBody",
	});

export const sdkCheckoutResponseSchema = z
	.object({
		checkoutSessionId: z.string(),
		checkoutUrl: z.string(),
	})
	.meta({
		ref: "SdkCheckout",
	});

export const sdkCustomerResponseSchema = z
	.object({
		customerId: z.string(),
		name: z.string().nullable(),
		email: z.string().nullable(),
		appUserId: z.string().nullable(),
	})
	.meta({
		ref: "SdkCustomer",
	});

export const sdkIdentifyCustomerBodySchema = z
	.object({
		appUserId: z.string(),
		name: z.string().optional(),
		email: z.string().email().optional(),
	})
	.meta({
		ref: "SdkIdentifyCustomerBody",
	});
