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
import { NextjsErrorResponse, runServerEffect } from "../effect/runtimes/nextjs";
import { Effect, pipe, Schema } from "effect";
import { PerkService } from "../services/perks/perk.service";
import { PaywallLocationService } from "../services/paywall-locations/paywall-location.service";
import { ApiKeyService } from "../services/api-keys/api-key.service";
import { CustomerService } from "../services/customers/customer.service";
import { DevCheckoutService } from "../payment-providers/dev-checkout/dev-checkout.service";
import { confirmDevCheckoutPurchaseInputSchema } from "../payment-providers/dev-checkout/actions/confirm-purchase";
import { cancelDevCheckoutPurchaseInputSchema } from "../payment-providers/dev-checkout/actions/cancel-purchase";
// Api keys
export const createSecretKeyAction = actionClient
	.inputSchema(Schema.standardSchemaV1(createSecretKeyInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				ApiKeyService,
				Effect.flatMap((apiKeyService) =>
					apiKeyService.createSecretKey(parsedInput)
				),
				Effect.catchTags({
					ApiKeyNotFoundError: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "NOT_FOUND",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error;
		}

		return res.value;
	});

export const rotateSecretKeyAction = actionClient
	.inputSchema(Schema.standardSchemaV1(rotateSecretKeyInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				ApiKeyService,
				Effect.flatMap((apiKeyService) =>
					apiKeyService.rotateSecretKey(parsedInput)
				),
				Effect.catchTags({
					ApiKeyNotFoundError: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "NOT_FOUND",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error;
		}

		return res.value;
	});

export const deleteSecretKeyAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deleteSecretKeyInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				ApiKeyService,
				Effect.flatMap((apiKeyService) =>
					apiKeyService.deleteSecretKey(parsedInput)
				),
				Effect.catchTags({
					ApiKeyNotFoundError: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "NOT_FOUND",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error;
		}

		return res.value;
	});

// Organization
export const createOrganizationAction = actionClient
	.inputSchema(Schema.standardSchemaV1(createOrganizationInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				createOrganization(parsedInput),
				Effect.catchTags({
					FailedToCreateOrganizationError: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "INTERNAL_SERVER_ERROR",
								message: error.message,
							})
						),
					UserSessionNotFoundError: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "INTERNAL_SERVER_ERROR",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error;
		}

		return res.value;
	});

export const updateOrganizationAction = actionClient
	.inputSchema(Schema.standardSchemaV1(updateOrganizationInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				updateOrganization(parsedInput),
				Effect.catchTags({
					OrganizationNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "NOT_FOUND",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error;
		}

		return res.value;
	});

export const deleteOrganizationAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deleteOrganizationInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				deleteOrganization(parsedInput),
			)
		);

		if (res.isErr()) {
			throw res.error;
		}

		return res.value;
	});

// Project
export const createProjectAction = actionClient
	.inputSchema(Schema.standardSchemaV1(createProjectInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				createProject(parsedInput),
			)
		);

		if (res.isErr()) {
			throw res.error;
		}

		return res.value;
	});

export const updateProjectAction = actionClient
	.inputSchema(Schema.standardSchemaV1(updateProjectInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				updateProject(parsedInput),
				Effect.catchTags({
					ProjectNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "NOT_FOUND",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error;
		}

		return res.value;
	});

export const deleteProjectAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deleteProjectInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				deleteProject(parsedInput),
				Effect.catchTags({
					ProjectNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "NOT_FOUND",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error;
		}

		return res.value;
	});

// Environment
export const switchEnvironmentAction = actionClient
	.inputSchema(Schema.standardSchemaV1(switchEnvironmentInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				EnvironmentService,
				Effect.flatMap((environmentService) =>
					environmentService.switchEnvironment(parsedInput)
				),
				Effect.catchTags({
					ProjectNotFoundError: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "NOT_FOUND",
								message: error.message,
							})
						),
					OrganizationNotFoundError: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "NOT_FOUND",
								message: error.message,
							})
						),
					OrganizationWithoutSlugError: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "INTERNAL_SERVER_ERROR",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error
		}

		return res.value;
	});

// Payment providers
export const createPaymentProviderConfigurationAction = actionClient
	.inputSchema(Schema.standardSchemaV1(createPaymentProviderConfigurationInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				createPaymentProviderConfiguration(parsedInput),	
				Effect.catchTags({
					PaymentProviderNotFoundError: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "NOT_FOUND",
								message: error.message,
							})
						),
					PaymentProviderAlreadyExistsError: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error
		}

		return res.value;
	});

export const updatePaymentProviderConfigurationAction = actionClient
	.inputSchema(Schema.standardSchemaV1(updatePaymentProviderConfigurationInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				updatePaymentProviderConfiguration(parsedInput),
				Effect.catchTags({
					PaymentProviderConfigurationNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "NOT_FOUND",
								message: error.message,
							})
						),
					PaymentProviderNotFoundError: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "NOT_FOUND",
								message: error.message,
							})
						),
					ValidationError: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),
					PaymentProviderKeyUnavailableError: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error
		}

		return res.value;
	});

export const deletePaymentProviderConfigurationAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deletePaymentProviderConfigurationInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				deletePaymentProviderConfiguration(parsedInput),
				Effect.catchTags({
					PaymentProviderConfigurationNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "NOT_FOUND",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error
		}

		return res.value;
	});

// Products
export const createProductAction = actionClient
	.inputSchema(Schema.standardSchemaV1(createProductInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				createProduct(parsedInput),
				Effect.catchTags({
					PaymentProviderConfigurationNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "INTERNAL_SERVER_ERROR",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error
		}

		return res.value;
	});

export const updateProductAction = actionClient
	.inputSchema(Schema.standardSchemaV1(updateProductInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				updateProduct(parsedInput),
				Effect.catchTags({
					ProductNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "NOT_FOUND",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error
		}

		return res.value;
	});

export const deleteProductAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deleteProductInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				deleteProduct(parsedInput),
				Effect.catchTags({
					ProductNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "NOT_FOUND",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error
		}

		return res.value;
	});

// Product perks
export const createProductPerkAction = actionClient
	.inputSchema(Schema.standardSchemaV1(createProductPerkInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				createProductPerk(parsedInput),
				Effect.catchTags({
					ProductNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),
					PerkNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),
				})

			)
		);

		if (res.isErr()) {
			throw res.error
		}

		return res.value;
	});

export const deleteProductPerkAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deleteProductPerkInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				deleteProductPerk(parsedInput),
				Effect.catchTags({
					ProductNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error
		}

		return res.value;
	});

// Payment provider products
export const createPaymentProviderProductAction = actionClient
	.inputSchema(Schema.standardSchemaV1(createPaymentProviderProductInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				createPaymentProviderProduct(parsedInput),
				Effect.catchTags({
					ProductNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),
					PaymentProviderConfigurationNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),
					PaymentProviderNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),
					InvalidConfiguration: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error
		}

		return res.value;
	});

export const updatePaymentProviderProductAction = actionClient
	.inputSchema(Schema.standardSchemaV1(updatePaymentProviderProductInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				updatePaymentProviderProduct(parsedInput),
				Effect.catchTags({
					ProductNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),
					PaymentProviderConfigurationNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),
					PaymentProviderNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),
					ProviderProductNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),
					InvalidConfiguration: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error
		}

		return res.value;
	});

export const setActivePaymentProviderProductAction = actionClient
	.inputSchema(Schema.standardSchemaV1(setActivePaymentProviderProductInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				setActivePaymentProviderProduct(parsedInput),
				Effect.catchTags({
					ProductNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),
					PaymentProviderConfigurationNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),
					PaymentProviderNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error
		}

		return res.value;
	});

export const deletePaymentProviderProductAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deletePaymentProviderProductInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				deletePaymentProviderProduct(parsedInput),
				Effect.catchTags({
					ProductNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error
		}

		return res.value;
	});

// Customers
export const createCustomerAction = actionClient
	.inputSchema(
		Schema.standardSchemaV1(createCustomerInputSchema.omit("origin"))
	)
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				CustomerService,
				Effect.flatMap((customerService) =>
					customerService.createCustomer({
						...parsedInput,
						origin: "dashboard",
					})
				),
			)
		);

		if (res.isErr()) {
			throw res.error
		}

		return res.value;
	});

// Paywalls
export const createPaywallAction = actionClient
	.inputSchema(Schema.standardSchemaV1(createPaywallInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				createPaywall(parsedInput),
			)
		);

		if (res.isErr()) {
			throw res.error
		}

		return res.value;
	});

export const updatePaywallAction = actionClient
	.inputSchema(Schema.standardSchemaV1(updatePaywallInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				updatePaywall(parsedInput),
				Effect.catchTags({
					PaywallNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "NOT_FOUND",
								message: error.message,
							})
						),
					ProductNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),
					PaymentProviderConfigurationNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error
		}

		return res.value;
	});

export const deletePaywallAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deletePaywallInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				deletePaywall(parsedInput),
				Effect.catchTags({
					PaywallNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "NOT_FOUND",
								message: error.message,
							})
						),
					PaywallInUseError: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error
		}

		return res.value;
	});

// Paywall locations
export const createPaywallLocationAction = actionClient
	.inputSchema(Schema.standardSchemaV1(createPaywallLocationInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				PaywallLocationService,
				Effect.flatMap((paywallLocationService) =>
					paywallLocationService.createPaywallLocation(parsedInput)
				),
				Effect.catchTags({
					SlugAlreadyExistsError: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),
					DefaultPaywallNotFoundError: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "NOT_FOUND",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error
		}

		return res.value;
	});

export const deletePaywallLocationAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deletePaywallLocationInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				PaywallLocationService,
				Effect.flatMap((paywallLocationService) =>
					paywallLocationService.deletePaywallLocation({
						paywallLocationId: parsedInput.paywallLocationId,
					})
				),
				Effect.catchTags({
					PaywallLocationNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "NOT_FOUND",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error
		}

		return res.value;
	});
// Perks
export const createPerkAction = actionClient
	.inputSchema(Schema.standardSchemaV1(createPerkInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				PerkService,
				Effect.flatMap((perkService) => perkService.createPerk(parsedInput)),
				Effect.catchTags({
					SlugAlreadyExistsError: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error
		}

		return res.value;
	});

export const deletePerkAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deletePerkInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				PerkService,
				Effect.flatMap((perkService) =>
					perkService.deletePerk({ perkId: parsedInput.perkId })
				),
				Effect.catchTags({
					PerkNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "NOT_FOUND",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error
		}

		return res.value;
	});

// Dev checkout
export const confirmDevCheckoutPurchaseAction = actionClient
	.inputSchema(Schema.standardSchemaV1(confirmDevCheckoutPurchaseInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				DevCheckoutService,
				Effect.flatMap((devCheckoutService) =>
					devCheckoutService.confirmPurchase(parsedInput)
				),
				Effect.catchTags({
					CheckoutSessionNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "NOT_FOUND",
								message: error.message,
							})
						),
					CheckoutSessionWasAlreadyCancelled: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),

				})
			)
		);

		if (res.isErr()) {
			throw res.error
		}

		return res.value;
	});

export const cancelDevCheckoutPurchaseAction = actionClient
	.inputSchema(Schema.standardSchemaV1(cancelDevCheckoutPurchaseInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				DevCheckoutService,
				Effect.flatMap((devCheckoutService) =>
					devCheckoutService.cancelPurchase(parsedInput)
				),
				Effect.catchTags({
					CheckoutSessionNotFound: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "NOT_FOUND",
								message: error.message,
							})
						),
					CheckoutSessionWasAlreadyConfirmed: (error) =>
						Effect.fail(
							new NextjsErrorResponse({
								code: "BAD_REQUEST",
								message: error.message,
							})
						),
				})
			)
		);

		if (res.isErr()) {
			throw res.error
		}

		return res.value;
	});
