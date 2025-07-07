"use server";

import { actionClient } from "@/lib/safe-action";

import {
	NextjsErrorResponse,
	runServerEffect,
} from "../effect/runtimes/nextjs";
import { Effect, pipe, Schema } from "effect";
import { PerkService } from "../services/perk.service";
import { PaywallLocationService } from "../services/paywall-location.service";
import { ApiKeyService } from "../services/api-key.service";
import { CustomerService } from "../services/customer.service";
import { DevCheckoutService } from "../payment-providers/dev-checkout/dev-checkout.service";
import { confirmDevCheckoutPurchaseInputSchema } from "../payment-providers/dev-checkout/actions/confirm-purchase";
import { cancelDevCheckoutPurchaseInputSchema } from "../payment-providers/dev-checkout/actions/cancel-purchase";
import { CustomerOrigin } from "@voidhash/db";
import { EnvironmentService } from "../services/environment.service";
import {
	createSecretKeyInputSchema,
	rotateSecretKeyInputSchema,
	deleteSecretKeyInputSchema,
	createOrganizationInputSchema,
	updateOrganizationInputSchema,
	deleteOrganizationInputSchema,
	createProjectInputSchema,
	updateProjectInputSchema,
	deleteProjectInputSchema,
	createPaymentProviderConfigurationInputSchema,
	updatePaymentProviderConfigurationInputSchema,
	deletePaymentProviderConfigurationInputSchema,
	createProductInputSchema,
	updateProductInputSchema,
	deleteProductInputSchema,
	createProductPerkInputSchema,
	deleteProductPerkInputSchema,
	createPaymentProviderProductInputSchema,
	updatePaymentProviderProductInputSchema,
	setActivePaymentProviderProductInputSchema,
	deletePaymentProviderProductInputSchema,
	createCustomerInputSchema,
	createPaywallInputSchema,
	updatePaywallInputSchema,
	deletePaywallInputSchema,
	createPaywallLocationInputSchema,
	deletePaywallLocationInputSchema,
	createPerkInputSchema,
	deletePerkInputSchema,
	switchEnvironmentInputSchema,
} from "./schema";
import { OrganizationService } from "../services/organization.service";
import { ProjectService } from "../services/project.service";
import { PaymentProviderService } from "../services/payment-provider.service";
import { ProductService } from "../services/product.service";
import { PaywallService } from "../services/paywall.service";
import { AuthService, AuthSession } from "../services/auth.service";
import { Environment } from "../services/environment.service";
// Api keys
export const createSecretKeyAction = actionClient
	.inputSchema(Schema.standardSchemaV1(createSecretKeyInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				Effect.gen(function* () {
					const apiKeyService = yield* ApiKeyService;
					const authService = yield* AuthService;
					const environmentService = yield* EnvironmentService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						Effect.gen(function* () {
							const environment =
								yield* environmentService.getEnvironmentFromCookie({
									projectId: parsedInput.projectId,
								});
							return yield* Environment.provide(environment)(
								apiKeyService.createSecretKey(parsedInput)
							);
						})
					);
				}),
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
				Effect.gen(function* () {
					const apiKeyService = yield* ApiKeyService;
					const authService = yield* AuthService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						apiKeyService.rotateSecretKey(parsedInput)
					);
				}),
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
				Effect.gen(function* () {
					const apiKeyService = yield* ApiKeyService;
					const authService = yield* AuthService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						apiKeyService.deleteSecretKey(parsedInput)
					);
				}),
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
				Effect.gen(function* () {
					const organizationService = yield* OrganizationService;
					const authService = yield* AuthService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						organizationService.createOrganization(parsedInput)
					);
				}),
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
				Effect.gen(function* () {
					const organizationService = yield* OrganizationService;
					const authService = yield* AuthService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						organizationService.updateOrganization(parsedInput)
					);
				}),
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
				Effect.gen(function* () {
					const organizationService = yield* OrganizationService;
					const authService = yield* AuthService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						organizationService.deleteOrganization(parsedInput)
					);
				})
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
				Effect.gen(function* () {
					const projectService = yield* ProjectService;
					const authService = yield* AuthService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						projectService.createProject(parsedInput)
					);
				})
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
				Effect.gen(function* () {
					const projectService = yield* ProjectService;
					const authService = yield* AuthService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						projectService.updateProject(parsedInput)
					);
				}),
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
				Effect.gen(function* () {
					const projectService = yield* ProjectService;
					const authService = yield* AuthService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						projectService.deleteProject(parsedInput)
					);
				}),
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
				Effect.gen(function* () {
					const environmentService = yield* EnvironmentService;
					const authService = yield* AuthService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						environmentService.switchEnvironment(parsedInput)
					);
				}),
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
			throw res.error;
		}

		return res.value;
	});

// Payment providers
export const createPaymentProviderConfigurationAction = actionClient
	.inputSchema(
		Schema.standardSchemaV1(createPaymentProviderConfigurationInputSchema)
	)
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				Effect.gen(function* () {
					const paymentProviderService = yield* PaymentProviderService;
					const authService = yield* AuthService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						paymentProviderService.createPaymentProviderConfiguration(
							parsedInput
						)
					);
				}),
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
			throw res.error;
		}

		return res.value;
	});

export const updatePaymentProviderConfigurationAction = actionClient
	.inputSchema(
		Schema.standardSchemaV1(updatePaymentProviderConfigurationInputSchema)
	)
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				Effect.gen(function* () {
					const paymentProviderService = yield* PaymentProviderService;
					const authService = yield* AuthService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						paymentProviderService.updatePaymentProviderConfiguration(
							parsedInput
						)
					);
				}),
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
			throw res.error;
		}

		return res.value;
	});

export const deletePaymentProviderConfigurationAction = actionClient
	.inputSchema(
		Schema.standardSchemaV1(deletePaymentProviderConfigurationInputSchema)
	)
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				Effect.gen(function* () {
					const paymentProviderService = yield* PaymentProviderService;
					const authService = yield* AuthService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						paymentProviderService.deletePaymentProviderConfiguration(
							parsedInput
						)
					);
				}),
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
			throw res.error;
		}

		return res.value;
	});

// Products
export const createProductAction = actionClient
	.inputSchema(Schema.standardSchemaV1(createProductInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				Effect.gen(function* () {
					const productService = yield* ProductService;
					const authService = yield* AuthService;
					const environmentService = yield* EnvironmentService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						Effect.gen(function* () {
							const environment =
								yield* environmentService.getEnvironmentFromCookie({
									projectId: parsedInput.projectId,
								});
							return yield* Environment.provide(environment)(
								productService.createProduct(parsedInput)
							);
						})
					);
				}),
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
			throw res.error;
		}

		return res.value;
	});

export const updateProductAction = actionClient
	.inputSchema(Schema.standardSchemaV1(updateProductInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				Effect.gen(function* () {
					const productService = yield* ProductService;
					const authService = yield* AuthService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						productService.updateProduct(parsedInput)
					);
				}),
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
			throw res.error;
		}

		return res.value;
	});

export const deleteProductAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deleteProductInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				Effect.gen(function* () {
					const productService = yield* ProductService;
					const authService = yield* AuthService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						productService.deleteProduct(parsedInput)
					);
				}),
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
			throw res.error;
		}

		return res.value;
	});

// Product perks
export const createProductPerkAction = actionClient
	.inputSchema(Schema.standardSchemaV1(createProductPerkInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				Effect.gen(function* () {
					const productService = yield* ProductService;
					const authService = yield* AuthService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						productService.createProductPerk(parsedInput)
					);
				}),
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
			throw res.error;
		}

		return res.value;
	});

export const deleteProductPerkAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deleteProductPerkInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				Effect.gen(function* () {
					const productService = yield* ProductService;
					const authService = yield* AuthService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						productService.deleteProductPerk(parsedInput)
					);
				}),
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
			throw res.error;
		}

		return res.value;
	});

// Payment provider products
export const createPaymentProviderProductAction = actionClient
	.inputSchema(Schema.standardSchemaV1(createPaymentProviderProductInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				Effect.gen(function* () {
					const productService = yield* ProductService;
					const authService = yield* AuthService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						productService.createPaymentProviderProduct(parsedInput)
					);
				}),
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
			throw res.error;
		}

		return res.value;
	});

export const updatePaymentProviderProductAction = actionClient
	.inputSchema(Schema.standardSchemaV1(updatePaymentProviderProductInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				Effect.gen(function* () {
					const productService = yield* ProductService;
					const authService = yield* AuthService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						productService.updatePaymentProviderProduct(parsedInput)
					);
				}),
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
			throw res.error;
		}

		return res.value;
	});

export const setActivePaymentProviderProductAction = actionClient
	.inputSchema(
		Schema.standardSchemaV1(setActivePaymentProviderProductInputSchema)
	)
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				Effect.gen(function* () {
					const productService = yield* ProductService;
					const authService = yield* AuthService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						productService.setActivePaymentProviderProduct(parsedInput)
					);
				}),
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
			throw res.error;
		}

		return res.value;
	});

export const deletePaymentProviderProductAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deletePaymentProviderProductInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				Effect.gen(function* () {
					const productService = yield* ProductService;
					const authService = yield* AuthService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						productService.deletePaymentProviderProduct(parsedInput)
					);
				}),
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
			throw res.error;
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
				Effect.gen(function* () {
					const customerService = yield* CustomerService;
					const authService = yield* AuthService;
					const environmentService = yield* EnvironmentService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						Effect.gen(function* () {
							const environment =
								yield* environmentService.getEnvironmentFromCookie({
									projectId: parsedInput.projectId,
								});
							return yield* Environment.provide(environment)(
								customerService.createCustomer({
									...parsedInput,
									origin: CustomerOrigin.Dashboard,
								})
							);
						})
					);
				})
			)
		);

		if (res.isErr()) {
			throw res.error;
		}

		return res.value;
	});

// Paywalls
export const createPaywallAction = actionClient
	.inputSchema(Schema.standardSchemaV1(createPaywallInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				Effect.gen(function* () {
					const paywallService = yield* PaywallService;
					const authService = yield* AuthService;
					const environmentService = yield* EnvironmentService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						Effect.gen(function* () {
							const environment =
								yield* environmentService.getEnvironmentFromCookie({
									projectId: parsedInput.projectId,
								});
							return yield* Environment.provide(environment)(
								paywallService.createPaywall(parsedInput)
							);
						})
					);
				})
			)
		);

		if (res.isErr()) {
			throw res.error;
		}

		return res.value;
	});

export const updatePaywallAction = actionClient
	.inputSchema(Schema.standardSchemaV1(updatePaywallInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				Effect.gen(function* () {
					const paywallService = yield* PaywallService;
					const authService = yield* AuthService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						paywallService.updatePaywall({
							...parsedInput,
							paywallProducts: [...parsedInput.paywallProducts],
						})
					);
				}),
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
			throw res.error;
		}

		return res.value;
	});

export const deletePaywallAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deletePaywallInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				Effect.gen(function* () {
					const paywallService = yield* PaywallService;
					const authService = yield* AuthService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						paywallService.deletePaywall(parsedInput)
					);
				}),
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
			throw res.error;
		}

		return res.value;
	});

// Paywall locations
export const createPaywallLocationAction = actionClient
	.inputSchema(Schema.standardSchemaV1(createPaywallLocationInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				Effect.gen(function* () {
					const paywallLocationService = yield* PaywallLocationService;
					const authService = yield* AuthService;
					const environmentService = yield* EnvironmentService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						Effect.gen(function* () {
							const environment =
								yield* environmentService.getEnvironmentFromCookie({
									projectId: parsedInput.projectId,
								});
							return yield* Environment.provide(environment)(
								paywallLocationService.createPaywallLocation(parsedInput)
							);
						})
					);
				}),
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
			throw res.error;
		}

		return res.value;
	});

export const deletePaywallLocationAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deletePaywallLocationInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				Effect.gen(function* () {
					const paywallLocationService = yield* PaywallLocationService;
					const authService = yield* AuthService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						paywallLocationService.deletePaywallLocation({
							paywallLocationId: parsedInput.paywallLocationId,
						})
					);
				}),
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
			throw res.error;
		}

		return res.value;
	});
// Perks
export const createPerkAction = actionClient
	.inputSchema(Schema.standardSchemaV1(createPerkInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				Effect.gen(function* () {
					const perkService = yield* PerkService;
					const authService = yield* AuthService;
					const environmentService = yield* EnvironmentService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						Effect.gen(function* () {
							const environment =
								yield* environmentService.getEnvironmentFromCookie({
									projectId: parsedInput.projectId,
								});
							return yield* Environment.provide(environment)(
								perkService.createPerk(parsedInput)
							);
						})
					);
				}),
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
			throw res.error;
		}

		return res.value;
	});

export const deletePerkAction = actionClient
	.inputSchema(Schema.standardSchemaV1(deletePerkInputSchema))
	.action(async ({ parsedInput }) => {
		const res = await runServerEffect(
			pipe(
				Effect.gen(function* () {
					const perkService = yield* PerkService;
					const authService = yield* AuthService;
					const authSession = yield* authService.authenticateWithSession();
					return yield* AuthSession.provide(authSession)(
						perkService.deletePerk({ perkId: parsedInput.perkId })
					);
				}),
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
			throw res.error;
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
			throw res.error;
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
			throw res.error;
		}

		return res.value;
	});
