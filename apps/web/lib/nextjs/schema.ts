import { Schema } from "effect";
import { CustomerOrigin } from "@voidhash/db";
import { ID_BLACKLIST } from "@voidhash/lib/constants/id-blacklist";
import { ANONYMOUS_USER_ID_PREFIX } from "../core/sdk/constants";

// Api Keys
export const createSecretKeyInputSchema = Schema.Struct({
	projectId: Schema.String,
	name: Schema.String.pipe(Schema.minLength(3), Schema.maxLength(32)),
});

export const deleteSecretKeyInputSchema = Schema.Struct({
	secretKeyId: Schema.String,
});

export const rotateSecretKeyInputSchema = Schema.Struct({
	secretKeyId: Schema.String,
});

// Customers
export const createCustomerInputSchema = Schema.Struct({
	projectId: Schema.String,
	appUserId: Schema.String,
	name: Schema.NullishOr(
		Schema.String.pipe(Schema.minLength(3), Schema.maxLength(32))
	),
	email: Schema.NullishOr(Schema.String),
	origin: Schema.Union(
		Schema.Literal(CustomerOrigin.Dashboard),
		Schema.Literal(CustomerOrigin.IOS),
		Schema.Literal(CustomerOrigin.Android),
		Schema.Literal(CustomerOrigin.Stripe),
		Schema.Literal(CustomerOrigin.API)
	),
});

// Organizations
export const createOrganizationInputSchema = Schema.Struct({
	name: Schema.String.pipe(Schema.minLength(3), Schema.maxLength(32)),
});

export const updateOrganizationInputSchema = Schema.Struct({
	organizationId: Schema.String,
	name: Schema.String,
});

export const deleteOrganizationInputSchema = Schema.Struct({
	organizationId: Schema.String,
});

// Payment Providers
export const createPaymentProviderConfigurationInputSchema = Schema.Struct({
	projectId: Schema.String,
	providerId: Schema.String,
});

export const updatePaymentProviderConfigurationInputSchema = Schema.Struct({
	id: Schema.String,
	enabled: Schema.Boolean,
	name: Schema.optional(
		Schema.String.pipe(Schema.minLength(1), Schema.maxLength(255))
	),
	configuration: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
});

export const deletePaymentProviderConfigurationInputSchema = Schema.Struct({
	paymentProviderConfigurationId: Schema.String,
});

// Paywall locations
export const createPaywallLocationInputSchema = Schema.Struct({
	projectId: Schema.String,
	name: Schema.String.pipe(Schema.minLength(3), Schema.maxLength(32)),
	slug: Schema.String.pipe(
		Schema.minLength(3),
		Schema.maxLength(32),
		Schema.pattern(/^[a-z0-9_-]+$/)
	),
	defaultPaywallId: Schema.String,
});

export const deletePaywallLocationInputSchema = Schema.Struct({
	paywallLocationId: Schema.String,
});

// Paywalls
export const createPaywallInputSchema = Schema.Struct({
	projectId: Schema.String,
	name: Schema.String.pipe(Schema.minLength(3), Schema.maxLength(32)),
});

export const updatePaywallInputSchema = Schema.Struct({
	paywallId: Schema.String,
	name: Schema.optional(Schema.String.pipe(Schema.minLength(3))),
	paywallProducts: 
		Schema.Array(
			Schema.Struct({
				productId: Schema.String.pipe(Schema.minLength(1)),
				displayName: Schema.String.pipe(Schema.minLength(2)),
				enableNativePurchase: Schema.Boolean,
				enableWebCheckout: Schema.Boolean,
				webCheckoutPaymentProviderConfigurationProductId: Schema.NullOr(
					Schema.String
				),
				order: Schema.Number,
			})
		)
});

export const deletePaywallInputSchema = Schema.Struct({
	paywallId: Schema.String,
});

// Perks
export const createPerkInputSchema = Schema.Struct({
	projectId: Schema.String,
	name: Schema.String.pipe(Schema.minLength(3), Schema.maxLength(32)),
	slug: Schema.String.pipe(
		Schema.minLength(3),
		Schema.maxLength(32),
		Schema.pattern(/^[a-z0-9_-]+$/)
	),
});

export const deletePerkInputSchema = Schema.Struct({
	perkId: Schema.String,
});

// Products
export const createProductInputSchema = Schema.Struct({
	projectId: Schema.String,
	name: Schema.String.pipe(Schema.minLength(3), Schema.maxLength(32)),
});

export const updateProductInputSchema = Schema.Struct({
	productId: Schema.String,
	name: Schema.String.pipe(Schema.minLength(3), Schema.maxLength(32)),
});

export const deleteProductInputSchema = Schema.Struct({
	productId: Schema.String,
});

// Product Perks
export const createProductPerkInputSchema = Schema.Struct({
	productId: Schema.String,
	perkId: Schema.String,
});

export const deleteProductPerkInputSchema = Schema.Struct({
	productId: Schema.String,
	perkId: Schema.String,
});

// Payment Provider Configuration Products
export const createPaymentProviderProductInputSchema = Schema.Struct({
	productId: Schema.String,
	paymentProviderConfigurationId: Schema.String,
	configuration: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
});

export const updatePaymentProviderProductInputSchema = Schema.Struct({
	productId: Schema.String,
	providerProductKey: Schema.String,
	paymentProviderConfigurationId: Schema.String,
	configuration: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
});

export const setActivePaymentProviderProductInputSchema = Schema.Struct({
	productId: Schema.String,
	providerProductKey: Schema.String,
	paymentProviderConfigurationId: Schema.String,
});

export const deletePaymentProviderProductInputSchema = Schema.Struct({
	productId: Schema.String,
	paymentProviderConfigurationId: Schema.String,
	providerProductKey: Schema.String,
});

// Projects
export const createProjectInputSchema = Schema.Struct({
	name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(32)),
	organizationId: Schema.String,
});

export const updateProjectInputSchema = Schema.Struct({
	id: Schema.String,
	name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(32)),
});

export const deleteProjectInputSchema = Schema.Struct({
	id: Schema.String,
});

// SDK
export const createCheckoutInputSchema = Schema.Struct({
	paymentProviderConfigurationProductId: Schema.String.pipe(
		Schema.minLength(1)
	),
	successCallbackUrl: Schema.String.pipe(Schema.minLength(1)),
	errorCallbackUrl: Schema.String.pipe(Schema.minLength(1)),
});

export const getPaywallByLocationInputSchema = Schema.Struct({
	locationSlug: Schema.String,
	nativePaymentProviderId: Schema.optional(Schema.String),
});

export const identifyCustomerInputSchema = Schema.Struct({
	appUserId: Schema.String.pipe(
		Schema.minLength(5),
		Schema.filter(
			(id) =>
				!ID_BLACKLIST.includes(id) &&
				!id.includes("/") &&
				!id.startsWith(ANONYMOUS_USER_ID_PREFIX),
			{ message: () => "Invalid app user ID" }
		)
	),
	name: Schema.optional(Schema.String),
	email: Schema.optional(
		Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
	),
});