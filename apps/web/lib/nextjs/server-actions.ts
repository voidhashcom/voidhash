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
import { toVoidhashHTTPError } from "@voidhash/lib/constants";
import {
	updatePaywall,
	updatePaywallInputSchema,
} from "../services/paywalls/actions/update-paywall";
import {
	confirmDevCheckoutPurchase,
	confirmDevCheckoutPurchaseInputSchema,
} from "../payment-providers/dev-checkout/actions/confirm-purchase";
import {
	cancelDevCheckoutPurchase,
	cancelDevCheckoutPurchaseInputSchema,
} from "../payment-providers/dev-checkout/actions/cancel-purchase";

// Api keys
export const createSecretKeyAction = actionClient
	.schema(createSecretKeyInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await createSecretKey.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const rotateSecretKeyAction = actionClient
	.schema(rotateSecretKeyInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await rotateSecretKey.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const deleteSecretKeyAction = actionClient
	.schema(deleteSecretKeyInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await deleteSecretKey.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

// Organization
export const createOrganizationAction = actionClient
	.schema(createOrganizationInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await createOrganization.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const updateOrganizationAction = actionClient
	.schema(updateOrganizationInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await updateOrganization.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const deleteOrganizationAction = actionClient
	.schema(deleteOrganizationInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await deleteOrganization.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

// Project
export const createProjectAction = actionClient
	.schema(createProjectInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await createProject.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const updateProjectAction = actionClient
	.schema(updateProjectInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await updateProject.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const deleteProjectAction = actionClient
	.schema(deleteProjectInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await deleteProject.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

// Environment
export const switchEnvironmentAction = actionClient
	.schema(switchEnvironmentInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await switchEnvironment.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

// Payment providers
export const savePaymentProviderConfigurationAction = actionClient
	.schema(savePaymentProviderConfigurationInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await savePaymentProviderConfiguration.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

// Products
export const createProductAction = actionClient
	.schema(createProductInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await createProduct.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const updateProductAction = actionClient
	.schema(updateProductInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await updateProduct.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const deleteProductAction = actionClient
	.schema(deleteProductInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await deleteProduct.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

// Product perks
export const createProductPerkAction = actionClient
	.schema(createProductPerkInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await createProductPerk.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const deleteProductPerkAction = actionClient
	.schema(deleteProductPerkInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await deleteProductPerk.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

// Payment provider products
export const createPaymentProviderProductAction = actionClient
	.schema(createPaymentProviderProductInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await createPaymentProviderProduct.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const updatePaymentProviderProductAction = actionClient
	.schema(updatePaymentProviderProductInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await updatePaymentProviderProduct.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const setActivePaymentProviderProductAction = actionClient
	.schema(setActivePaymentProviderProductInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await setActivePaymentProviderProduct.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const deletePaymentProviderProductAction = actionClient
	.schema(deletePaymentProviderProductInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await deletePaymentProviderProduct.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

// Customers
export const createCustomerAction = actionClient
	.schema(createCustomerInputSchema.omit({ origin: true }))
	.action(async ({ parsedInput, ctx }) => {
		const res = await createCustomer.invoke({
			ctx: ctx.serviceContext,
			input: {
				...parsedInput,
				origin: "dashboard",
			},
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

// Paywalls
export const createPaywallAction = actionClient
	.schema(createPaywallInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await createPaywall.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const updatePaywallAction = actionClient
	.schema(updatePaywallInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await updatePaywall.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const deletePaywallAction = actionClient
	.schema(deletePaywallInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await deletePaywall.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

// Paywall locations
export const createPaywallLocationAction = actionClient
	.schema(createPaywallLocationInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await createPaywallLocation.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const deletePaywallLocationAction = actionClient
	.schema(deletePaywallLocationInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await deletePaywallLocation.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});
// Perks
export const createPerkAction = actionClient
	.schema(createPerkInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await createPerk.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const deletePerkAction = actionClient
	.schema(deletePerkInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await deletePerk.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

// Dev checkout
export const confirmDevCheckoutPurchaseAction = actionClient
	.schema(confirmDevCheckoutPurchaseInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await confirmDevCheckoutPurchase.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const cancelDevCheckoutPurchaseAction = actionClient
	.schema(cancelDevCheckoutPurchaseInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await cancelDevCheckoutPurchase.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});
