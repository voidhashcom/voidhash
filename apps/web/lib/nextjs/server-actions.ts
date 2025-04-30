"use server";

import { actionClient } from "@/lib/safe-action";
import {
	createOrganizationInputSchema,
	createOrganization,
} from "../services/organizations/create-organization";
import {
	deleteOrganizationInputSchema,
	deleteOrganization,
} from "../services/organizations/delete-organization";
import {
	updateOrganizationInputSchema,
	updateOrganization,
} from "../services/organizations/update-organization";
import {
	createProject,
	createProjectInputSchema,
} from "../services/projects/create-project";
import {
	deleteProject,
	deleteProjectInputSchema,
} from "../services/projects/delete-project";
import {
	updateProject,
	updateProjectInputSchema,
} from "../services/projects/update-project";
import {
	rotateSecretKey,
	rotateSecretKeyInputSchema,
} from "../services/api-keys/rotate-secret-key";
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
} from "../services/environments/switch-environment";
import {
	createProduct,
	createProductInputSchema,
} from "../services/products/create-product";
import { savePaymentProviderConfigurationInputSchema } from "../services/payment-providers/save-payment-provider-configuration";
import { savePaymentProviderConfiguration } from "../services/payment-providers/save-payment-provider-configuration";
import {
	createPaymentProviderProductInputSchema,
	createPaymentProviderProduct,
} from "../services/products/create-payment-provider-product";
import {
	updatePaymentProviderProductInputSchema,
	updatePaymentProviderProduct,
} from "../services/products/update-payment-provider-product";
import {
	deletePaymentProviderProductInputSchema,
	deletePaymentProviderProduct,
} from "../services/products/delete-payment-provider-product";
import {
	updateProduct,
	updateProductInputSchema,
} from "../services/products/update-product";
import {
	deleteProductInputSchema,
	deleteProduct,
} from "../services/products/delete-product";
import {
	createCustomer,
	createCustomerInputSchema,
} from "../services/customers/create-customer";
import {
	setActivePaymentProviderProductInputSchema,
	setActivePaymentProviderProduct,
} from "../services/products/set-active-payment-provider-product";
import {
	deletePaywall,
	deletePaywallInputSchema,
} from "../services/paywalls/delete-paywall";
import {
	createPaywall,
	createPaywallInputSchema,
} from "../services/paywalls/create-paywall";
import {
	deletePaywallProduct,
	deletePaywallProductInputSchema,
} from "../services/paywalls/delete-paywall-product";
import {
	createPaywallProduct,
	createPaywallProductInputSchema,
} from "../services/paywalls/create-paywall-product";
import {
	deletePerk,
	deletePerkInputSchema,
} from "../services/perks/delete-perk";
import {
	createPerk,
	createPerkInputSchema,
} from "../services/perks/create-perk";

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
