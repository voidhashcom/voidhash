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
import { rotateSecretKeyInputSchema } from "@/lib/services/api-keys/actions/rotate-secret-key";
import { createSecretKeyInputSchema } from "@/lib/services/api-keys/actions/create-secret-key";
import { deleteSecretKeyInputSchema } from "@/lib/services/api-keys/actions/delete-secret-key";
import { EnvironmentService, switchEnvironmentInputSchema } from "@/lib/services/environments/environment-service";
import {
	createProduct,
	createProductInputSchema,
} from "@/lib/services/products/actions/create-product";
import {
	createPaymentProviderConfiguration,
	createPaymentProviderConfigurationInputSchema,
} from "../services/payment-providers/actions/create-payment-provider-configuration";
import { updatePaymentProviderConfigurationInputSchema } from "../services/payment-providers/actions/update-payment-provider-configuration";
import { updatePaymentProviderConfiguration } from "../services/payment-providers/actions/update-payment-provider-configuration";
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
import { createCustomerInputSchema } from "../services/customers/actions/create-customer";
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
import { deletePerkInputSchema } from "../services/perks/actions/delete-perk";
import { createPerkInputSchema } from "../services/perks/actions/create-perk";
import { createPaywallLocationInputSchema } from "../services/paywall-locations/actions/create-paywall-location";
import { deletePaywallLocationInputSchema } from "../services/paywall-locations/actions/delete-paywall-location";
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
import {
	deletePaymentProviderConfiguration,
	deletePaymentProviderConfigurationInputSchema,
} from "../services/payment-providers/actions/delete-payment-provider-configuration";
import { NextjsRuntime, toNeverthrow } from "../effect/runtimes/nextjs";
import { Effect, pipe, Schema } from "effect";
import { PerkService } from "../services/perks/perk-service";
import { PaywallLocationService } from "../services/paywall-locations/paywall-location-service";
import { ApiKeyService } from "../services/api-keys/api-key-service";
import { CustomerService } from "../services/customers/customer-service";

// Api keys
export const createSecretKeyAction = actionClient
	.inputSchema(Schema.standardSchemaV1(createSecretKeyInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				ApiKeyService,
				Effect.flatMap((apiKeyService) =>
					apiKeyService.createSecretKey(parsedInput)
				),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const rotateSecretKeyAction = actionClient
	.inputSchema(Schema.standardSchemaV1(rotateSecretKeyInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				ApiKeyService,
				Effect.flatMap((apiKeyService) =>
					apiKeyService.rotateSecretKey(parsedInput)
				),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const deleteSecretKeyAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deleteSecretKeyInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				ApiKeyService,
				Effect.flatMap((apiKeyService) =>
					apiKeyService.deleteSecretKey(parsedInput)
				),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

// Organization
export const createOrganizationAction = actionClient
	.inputSchema(createOrganizationInputSchema)
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
	.inputSchema(updateOrganizationInputSchema)
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
	.inputSchema(deleteOrganizationInputSchema)
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
	.inputSchema(createProjectInputSchema)
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
	.inputSchema(updateProjectInputSchema)
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
	.inputSchema(deleteProjectInputSchema)
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
	.inputSchema(Schema.standardSchemaV1(switchEnvironmentInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				EnvironmentService,
				Effect.flatMap((environmentService) =>
					environmentService.switchEnvironment(parsedInput)
				),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

// Payment providers
export const createPaymentProviderConfigurationAction = actionClient
	.inputSchema(createPaymentProviderConfigurationInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await createPaymentProviderConfiguration.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const updatePaymentProviderConfigurationAction = actionClient
	.inputSchema(updatePaymentProviderConfigurationInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await updatePaymentProviderConfiguration.invoke({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const deletePaymentProviderConfigurationAction = actionClient
	.inputSchema(deletePaymentProviderConfigurationInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		const res = await deletePaymentProviderConfiguration.invoke({
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
	.inputSchema(createProductInputSchema)
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
	.inputSchema(updateProductInputSchema)
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
	.inputSchema(deleteProductInputSchema)
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
	.inputSchema(createProductPerkInputSchema)
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
	.inputSchema(deleteProductPerkInputSchema)
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
	.inputSchema(createPaymentProviderProductInputSchema)
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
	.inputSchema(updatePaymentProviderProductInputSchema)
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
	.inputSchema(setActivePaymentProviderProductInputSchema)
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
	.inputSchema(deletePaymentProviderProductInputSchema)
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
	.inputSchema(
		Schema.standardSchemaV1(createCustomerInputSchema.omit("origin"))
	)
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				CustomerService,
				Effect.flatMap((customerService) =>
					customerService.createCustomer({
						...parsedInput,
						origin: "dashboard",
					})
				),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

// Paywalls
export const createPaywallAction = actionClient
	.inputSchema(createPaywallInputSchema)
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
	.inputSchema(updatePaywallInputSchema)
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
	.inputSchema(deletePaywallInputSchema)
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
	.inputSchema(Schema.standardSchemaV1(createPaywallLocationInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				PaywallLocationService,
				Effect.flatMap((paywallLocationService) =>
					paywallLocationService.createPaywallLocation(parsedInput)
				),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const deletePaywallLocationAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deletePaywallLocationInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				PaywallLocationService,
				Effect.flatMap((paywallLocationService) =>
					paywallLocationService.deletePaywallLocation({
						paywallLocationId: parsedInput.paywallLocationId,
					})
				),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});
// Perks
export const createPerkAction = actionClient
	.inputSchema(Schema.standardSchemaV1(createPerkInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				PerkService,
				Effect.flatMap((perkService) => perkService.createPerk(parsedInput)),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const deletePerkAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deletePerkInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				PerkService,
				Effect.flatMap((perkService) =>
					perkService.deletePerk({ perkId: parsedInput.perkId })
				),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

// Dev checkout
export const confirmDevCheckoutPurchaseAction = actionClient
	.inputSchema(confirmDevCheckoutPurchaseInputSchema)
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
	.inputSchema(cancelDevCheckoutPurchaseInputSchema)
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
