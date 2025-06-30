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
import { EnvironmentService, switchEnvironmentInputSchema } from "@/lib/services/environments/environment.service";
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
// import {
// 	confirmDevCheckoutPurchase,
// 	confirmDevCheckoutPurchaseInputSchema,
// } from "../payment-providers/dev-checkout/actions/confirm-purchase";
// import {
// 	cancelDevCheckoutPurchase,
// 	cancelDevCheckoutPurchaseInputSchema,
// } from "../payment-providers/dev-checkout/actions/cancel-purchase";
import {
	deletePaymentProviderConfiguration,
	deletePaymentProviderConfigurationInputSchema,
} from "../services/payment-providers/actions/delete-payment-provider-configuration";
import { NextjsRuntime, toNeverthrow } from "../effect/runtimes/nextjs";
import { Effect, pipe, Schema } from "effect";
import { PerkService } from "../services/perks/perk.service";
import { PaywallLocationService } from "../services/paywall-locations/paywall-location.service";
import { ApiKeyService } from "../services/api-keys/api-key.service";
import { CustomerService } from "../services/customers/customer.service";
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
	.inputSchema(Schema.standardSchemaV1(createOrganizationInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				createOrganization(parsedInput),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const updateOrganizationAction = actionClient
	.inputSchema(Schema.standardSchemaV1(updateOrganizationInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				updateOrganization(parsedInput),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const deleteOrganizationAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deleteOrganizationInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				deleteOrganization(parsedInput),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

// Project
export const createProjectAction = actionClient
	.inputSchema(Schema.standardSchemaV1(createProjectInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				createProject(parsedInput),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const updateProjectAction = actionClient
	.inputSchema(Schema.standardSchemaV1(updateProjectInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				updateProject(parsedInput),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const deleteProjectAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deleteProjectInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				deleteProject(parsedInput),
				toNeverthrow
			)
		);

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
	.inputSchema(Schema.standardSchemaV1(createPaymentProviderConfigurationInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				createPaymentProviderConfiguration(parsedInput),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const updatePaymentProviderConfigurationAction = actionClient
	.inputSchema(Schema.standardSchemaV1(updatePaymentProviderConfigurationInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				updatePaymentProviderConfiguration(parsedInput),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const deletePaymentProviderConfigurationAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deletePaymentProviderConfigurationInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				deletePaymentProviderConfiguration(parsedInput),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

// Products
export const createProductAction = actionClient
	.inputSchema(Schema.standardSchemaV1(createProductInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				createProduct(parsedInput),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const updateProductAction = actionClient
	.inputSchema(Schema.standardSchemaV1(updateProductInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				updateProduct(parsedInput),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const deleteProductAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deleteProductInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				deleteProduct(parsedInput),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

// Product perks
export const createProductPerkAction = actionClient
	.inputSchema(Schema.standardSchemaV1(createProductPerkInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				createProductPerk(parsedInput),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const deleteProductPerkAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deleteProductPerkInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				deleteProductPerk(parsedInput),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

// Payment provider products
export const createPaymentProviderProductAction = actionClient
	.inputSchema(Schema.standardSchemaV1(createPaymentProviderProductInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				createPaymentProviderProduct(parsedInput),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const updatePaymentProviderProductAction = actionClient
	.inputSchema(Schema.standardSchemaV1(updatePaymentProviderProductInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				updatePaymentProviderProduct(parsedInput),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const setActivePaymentProviderProductAction = actionClient
	.inputSchema(Schema.standardSchemaV1(setActivePaymentProviderProductInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				setActivePaymentProviderProduct(parsedInput),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const deletePaymentProviderProductAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deletePaymentProviderProductInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				deletePaymentProviderProduct(parsedInput),
				toNeverthrow
			)
		);

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
	.inputSchema(Schema.standardSchemaV1(createPaywallInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				createPaywall(parsedInput),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const updatePaywallAction = actionClient
	.inputSchema(Schema.standardSchemaV1(updatePaywallInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				updatePaywall(parsedInput),
				toNeverthrow
			)
		);

		if (res.isErr()) {
			throw toVoidhashHTTPError(res.error);
		}

		return res.value;
	});

export const deletePaywallAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deletePaywallInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await NextjsRuntime.runPromise(
			pipe(
				deletePaywall(parsedInput),
				toNeverthrow
			)
		);

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
// export const confirmDevCheckoutPurchaseAction = actionClient
// 	.inputSchema(confirmDevCheckoutPurchaseInputSchema)
// 	.action(async ({ parsedInput, ctx }) => {
// 		const res = await confirmDevCheckoutPurchase.invoke({
// 			ctx: ctx.serviceContext,
// 			input: parsedInput,
// 		});

// 		if (res.isErr()) {
// 			throw toVoidhashHTTPError(res.error);
// 		}

// 		return res.value;
// 	});

// export const cancelDevCheckoutPurchaseAction = actionClient
// 	.inputSchema(cancelDevCheckoutPurchaseInputSchema)
// 	.action(async ({ parsedInput, ctx }) => {
// 		const res = await cancelDevCheckoutPurchase.invoke({
// 			ctx: ctx.serviceContext,
// 			input: parsedInput,
// 		});

// 		if (res.isErr()) {
// 			throw toVoidhashHTTPError(res.error);
// 		}

// 		return res.value;
// 	});
