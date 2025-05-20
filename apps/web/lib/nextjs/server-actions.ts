"use server";

import { actionClient } from "@/lib/safe-action";
import {
	createOrganizationInputSchema,
	createOrganization,
} from "../services/organizations/actions/create-organization";
import {
	deleteOrganizationInputSchema,
	deleteOrganization,
} from "../services/organizations/actions/delete-organization";
import {
	updateOrganizationInputSchema,
	updateOrganization,
} from "../services/organizations/actions/update-organization";
import {
	createProject,
	createProjectInputSchema,
} from "../services/projects/actions/create-project";
import {
	deleteProject,
	deleteProjectInputSchema,
} from "../services/projects/actions/delete-project";
import {
	updateProject,
	updateProjectInputSchema,
} from "@/lib/services/projects/actions/update-project";
import {
	rotateSecretKey,
	rotateSecretKeyInputSchema,
} from "@/lib/services/api-keys/rotate-secret-key";
import {
	createSecretKey,
	createSecretKeyInputSchema,
} from "../services/api-keys/create-secret-key";
import {
	deleteSecretKey,
	deleteSecretKeyInputSchema,
} from "../services/api-keys/delete-secret-key";
import {
	switchEnvironment,
	switchEnvironmentInputSchema,
} from "@/lib/services/environments/actions/switch-environment";
import {
	createProduct,
	createProductInputSchema,
} from "@/lib/services/products/actions/create-product";
import { savePaymentProviderConfigurationInputSchema } from "../services/payment-providers/actions/save-payment-provider-configuration";
import { savePaymentProviderConfiguration } from "../services/payment-providers/actions/save-payment-provider-configuration";
import {
	createPaymentProviderProductInputSchema,
	createPaymentProviderProduct,
} from "../services/products/actions/create-payment-provider-product";
import {
	updatePaymentProviderProductInputSchema,
	updatePaymentProviderProduct,
} from "../services/products/actions/update-payment-provider-product";
import {
	deletePaymentProviderProductInputSchema,
	deletePaymentProviderProduct,
} from "../services/products/actions/delete-payment-provider-product";
import {
	updateProduct,
	updateProductInputSchema,
} from "../services/products/actions/update-product";
import {
	deleteProductInputSchema,
	deleteProduct,
} from "../services/products/actions/delete-product";
import {
	createCustomer,
	createCustomerInputSchema,
} from "../services/customers/actions/create-customer";
import {
	setActivePaymentProviderProductInputSchema,
	setActivePaymentProviderProduct,
} from "../services/products/actions/set-active-payment-provider-product";
import {
	deletePaywall,
	deletePaywallInputSchema,
} from "../services/paywalls/actions/delete-paywall";
import {
	createPaywall,
	createPaywallInputSchema,
} from "../services/paywalls/actions/create-paywall";
import {
	deletePaywallProduct,
	deletePaywallProductInputSchema,
} from "../services/paywalls/actions/delete-paywall-product";
import {
	createPaywallProduct,
	createPaywallProductInputSchema,
} from "../services/paywalls/actions/create-paywall-product";
import {
	deletePerk,
	deletePerkInputSchema,
} from "../services/perks/actions/delete-perk";
import {
	createPerk,
	createPerkInputSchema,
} from "../services/perks/actions/create-perk";
import {
	createPaywallLocationInputSchema,
	createPaywallLocation,
} from "../services/paywall-locations/actions/create-paywall-location";
import {
	deletePaywallLocationInputSchema,
	deletePaywallLocation,
} from "../services/paywall-locations/actions/delete-paywall-location";
import {
	createProductPerk,
	createProductPerkInputSchema,
} from "../services/products/actions/create-product-perk";
import {
	deleteProductPerk,
	deleteProductPerkInputSchema,
} from "../services/products/actions/delete-product-perk";

// Api keys
export const createSecretKeyAction = actionClient
	.schema(createSecretKeyInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await createSecretKey.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

export const rotateSecretKeyAction = actionClient
	.schema(rotateSecretKeyInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await rotateSecretKey.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

export const deleteSecretKeyAction = actionClient
	.schema(deleteSecretKeyInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await deleteSecretKey.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

// Organization
export const createOrganizationAction = actionClient
	.schema(createOrganizationInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await createOrganization.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

export const updateOrganizationAction = actionClient
	.schema(updateOrganizationInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await updateOrganization.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

export const deleteOrganizationAction = actionClient
	.schema(deleteOrganizationInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await deleteOrganization.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

// Project
export const createProjectAction = actionClient
	.schema(createProjectInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await createProject.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

export const updateProjectAction = actionClient
	.schema(updateProjectInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await updateProject.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

export const deleteProjectAction = actionClient
	.schema(deleteProjectInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await deleteProject.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

// Environment
export const switchEnvironmentAction = actionClient
	.schema(switchEnvironmentInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await switchEnvironment.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

// Payment providers
export const savePaymentProviderConfigurationAction = actionClient
	.schema(savePaymentProviderConfigurationInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await savePaymentProviderConfiguration.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

// Products
export const createProductAction = actionClient
	.schema(createProductInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await createProduct.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

export const updateProductAction = actionClient
	.schema(updateProductInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await updateProduct.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

export const deleteProductAction = actionClient
	.schema(deleteProductInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await deleteProduct.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

// Product perks
export const createProductPerkAction = actionClient
	.schema(createProductPerkInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await createProductPerk.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

export const deleteProductPerkAction = actionClient
	.schema(deleteProductPerkInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await deleteProductPerk.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

// Payment provider products
export const createPaymentProviderProductAction = actionClient
	.schema(createPaymentProviderProductInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await createPaymentProviderProduct.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

export const updatePaymentProviderProductAction = actionClient
	.schema(updatePaymentProviderProductInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await updatePaymentProviderProduct.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

export const setActivePaymentProviderProductAction = actionClient
	.schema(setActivePaymentProviderProductInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await setActivePaymentProviderProduct.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

export const deletePaymentProviderProductAction = actionClient
	.schema(deletePaymentProviderProductInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await deletePaymentProviderProduct.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

// Customers
export const createCustomerAction = actionClient
	.schema(createCustomerInputSchema.omit({ origin: true }))
	.action(async ({ parsedInput, ctx }) => {
		return await createCustomer.invoke({
			ctx: ctx.serviceContext,
			input: {
				...parsedInput,
				origin: "dashboard",
			},
		});
	});

// Paywalls
export const createPaywallAction = actionClient
	.schema(createPaywallInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await createPaywall.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

export const deletePaywallAction = actionClient
	.schema(deletePaywallInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await deletePaywall.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

// Paywall products
export const createPaywallProductAction = actionClient
	.schema(createPaywallProductInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await createPaywallProduct.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

export const deletePaywallProductAction = actionClient
	.schema(deletePaywallProductInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await deletePaywallProduct.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

// Paywall locations
export const createPaywallLocationAction = actionClient
	.schema(createPaywallLocationInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await createPaywallLocation.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

export const deletePaywallLocationAction = actionClient
	.schema(deletePaywallLocationInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await deletePaywallLocation.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});
// Perks
export const createPerkAction = actionClient
	.schema(createPerkInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await createPerk.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

export const deletePerkAction = actionClient
	.schema(deletePerkInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await deletePerk.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});
