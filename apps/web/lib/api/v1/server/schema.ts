import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { createProductInputSchema } from "@/lib/services/products/actions/create-product";
import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";

extendZodWithOpenApi(z);

// Customer
export const createCustomerBodySchema = z
	.object({
		appUserId: z.string(),
		name: z.string().optional(),
		email: z.string().email().optional(),
	})
	.openapi({
		ref: "CreateCustomerBody",
	});

export const customerResponseSchema = z
	.object({
		customerId: z.string(),
		name: z.string().nullable(),
		email: z.string().nullable(),
		appUserId: z.string().nullable(),
		origin: z.enum(["dashboard", "ios", "android", "stripe", "api"]),
	})
	.openapi({
		ref: "Customer",
	});

// Product
export const createProductBodySchema = createProductInputSchema
	.pick({
		name: true,
	})
	.openapi({
		ref: "CreateProductBody",
	});

export const productResponseSchema = z
	.object({
		productId: z.string(),
		name: z.string(),
	})
	.openapi({
		ref: "Product",
	});

export const getProductByIdParamsSchema = z.object({
	productId: z.string(),
});

export const updateProductBodySchema = z
	.object({
		name: z.string(),
	})
	.openapi({
		ref: "UpdateProductBody",
	});

export const updateProductParamsSchema = z.object({
	productId: z.string(),
});

export const deleteProductParamsSchema = z.object({
	productId: z.string(),
});

const productProviderConfigurationSchema = z
	.discriminatedUnion("providerId", [
		...paymentProviders.map((p) =>
			z.object({
				providerId: z.literal(p.id),
				configuration: p.products.productConfigurationSchema,
			})
		),
	] as unknown as [
		z.ZodDiscriminatedUnionOption<"providerId">,
		...z.ZodDiscriminatedUnionOption<"providerId">[],
	])
	.openapi({
		ref: "ProductProviderConfiguration",
	});

export const attachProviderProductParamsSchema = z.object({
	productId: z.string(),
});

export const attachProviderProductBodySchema =
	productProviderConfigurationSchema.openapi({
		ref: "AttachProviderProductBody",
	});

export const providerProductResponseSchema = z
	.object({
		providerProductKey: z.string(),
		providerConfiguration: productProviderConfigurationSchema,
	})
	.openapi({
		ref: "ProviderProduct",
	});

export const getProviderProductsParamsSchema = z.object({
	productId: z.string(),
});

export const updateProviderProductParamsSchema = z.object({
	productId: z.string(),
	providerId: z.string(),
	providerProductKey: z.string(),
});

export const updateProviderProductBodySchema = z
	.object({
		configuration: productProviderConfigurationSchema,
	})
	.openapi({
		ref: "UpdateProviderProductBody",
	});

export const deleteProviderProductParamsSchema = z.object({
	productId: z.string(),
	providerId: z.string(),
	providerProductKey: z.string(),
});

// Paywall
export const createPaywallBodySchema = z
	.object({
		name: z.string(),
	})
	.openapi({
		ref: "CreatePaywallBody",
	});

export const paywallResponseSchema = z
	.object({
		paywallId: z.string(),
		name: z.string(),
	})
	.openapi({
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
	.openapi({
		ref: "AttachProductToPaywallBody",
	});

export const paywallProductResponseSchema = z
	.object({
		paywallId: z.string(),
		productId: z.string(),
		productName: z.string().nullable(),
	})
	.openapi({
		ref: "PaywallProduct",
	});

export const getPaywallProductsParamsSchema = z.object({
	paywallId: z.string(),
});

export const deletePaywallProductParamsSchema = z.object({
	paywallId: z.string(),
	productId: z.string(),
});
