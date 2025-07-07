import { Data, Effect } from "effect";
import { Environment } from "@/lib/services/environment.service";
import { AuthSession } from "@/lib/services/auth.service";
import { Db, TransactionContext } from "@/lib/effect/db";
import { NotFoundError, UnauthorizedError } from "@/lib/effect/errors";
import { devCheckoutPaymentProviderId } from "@/lib/payment-providers/dev-checkout/dev-checkout";
import {
	Customer,
	CustomerOrigin,
	CustomerType,
	InsertCustomer,
	PaywallProduct,
} from "@voidhash/db";
import { CHECKOUT_DOMAIN } from "@voidhash/lib/constants";
import { CheckoutSessionRepository } from "../repositories/checkout-session.repository";
import { CustomerRepository } from "../repositories/customer.repository";
import { PaymentProviderRepository } from "../repositories/payment-provider.repository";
import { isAnonymousId } from "../core/sdk/utils";
import { generateId } from "@/lib/id/generate";
import { PaymentProviderConfigurationProductRepository } from "../repositories/payment-provider-configuration-product.repository";
import { PaywallRepository } from "../repositories/paywall.repository";
import {
	EnvironmentValue,
	Environment as EnvironmentEnum,
} from "@voidhash/lib/index";
import { CustomerService } from "./customer.service";

export class PaymentProviderConfigurationNotFound extends Data.TaggedError(
	"PaymentProviderConfigurationNotFound"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class ProductNotFound extends Data.TaggedError("ProductNotFound")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class PaywallNotFound extends Data.TaggedError("PaywallNotFound")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class CustomerConflictError extends Data.TaggedError(
	"CustomerConflict"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class CustomerCreationError extends Data.TaggedError(
	"CustomerCreation"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

type CreateCheckoutResponse = {
	checkoutSessionId: string;
	checkoutUrl: string;
};

type PaywallResponse = {
	paywallId: string;
	paywallProducts: {
		paywallProductId: string;
		productId: string;
		price: number;
		displayName: string;
		nativePurchaseAvailable: boolean;
		webCheckoutAvailable: boolean;
		webCheckoutPaymentProviderConfigurationProductId: string | null;
	}[];
};

export class SdkService extends Effect.Service<SdkService>()("SdkService", {
	dependencies: [],
	effect: Effect.gen(function* () {
		const checkNativePurchaseAvailability = (options: {
			environment: EnvironmentValue;
			paywallProduct: PaywallProduct;
		}) => {
			return options.paywallProduct.enableNativePurchase;
		};

		const checkWebCheckoutAvailability = (options: {
			environment: EnvironmentValue;
			paywallProduct: PaywallProduct;
		}) => {
			if (options.environment === EnvironmentEnum.Testing) {
				return true;
			}

			return options.paywallProduct.enableWebCheckout;
		};

		return {
			createCheckout: (input: {
				paymentProviderConfigurationProductId: string;
				successCallbackUrl: string;
				errorCallbackUrl: string;
			}) =>
				Effect.gen(function* () {
					const session = yield* AuthSession;
					const environment = yield* Environment;
					const paymentProviderConfigurationProductRepository =
						yield* PaymentProviderConfigurationProductRepository;
					const customerRepository = yield* CustomerRepository;
					const checkoutSessionRepository = yield* CheckoutSessionRepository;
					const paymentProviderRepository = yield* PaymentProviderRepository;
					const customerService = yield* CustomerService;
					const db = yield* Db;

					const appUserId = session?.customer?.appUserId;
					if (!appUserId) {
						return yield* Effect.fail(
							new UnauthorizedError({
								message: "App user ID not found",
							})
						);
					}

					const projectId = session?.projects[0]?.id;
					if (!projectId) {
						return yield* Effect.fail(
							new NotFoundError({
								message: "Project not found",
							})
						);
					}

					// Get payment provider configuration product
					const paymentProviderConfigurationProduct =
						yield* paymentProviderConfigurationProductRepository.getProviderProductById(
							input.paymentProviderConfigurationProductId
						);
					if (!paymentProviderConfigurationProduct) {
						return yield* Effect.fail(
							new ProductNotFound({
								message: "Payment provider configuration product not found",
							})
						);
					}

					// Get dev checkout payment provider configuration
					const devCheckoutConfiguration =
						yield* paymentProviderRepository.getExistingPaymentProviderConfigurationByProviderId(
							{
								projectId,
								providerId: devCheckoutPaymentProviderId,
							}
						);
					if (!devCheckoutConfiguration) {
						return yield* Effect.fail(
							new PaymentProviderConfigurationNotFound({
								message:
									"Dev checkout payment provider configuration not found",
							})
						);
					}

					const result = yield* db.transaction((tx) =>
						TransactionContext.provide(tx)(
							Effect.gen(function* () {
								// Get or create customer
								let customer = yield* customerRepository.getCustomerByAppUserId(
									{
										projectId,
										appUserId,
										environment,
									}
								);

								if (!customer && isAnonymousId(appUserId)) {
									const newCustomer =
										yield* customerService.createAnonymousCustomer({
											projectId,
											appUserId,
											origin: CustomerOrigin.IOS, // TODO: Make this dynamic
											environment,
										});
									customer = newCustomer;
								}

								if (!customer) {
									return yield* Effect.fail(
										new NotFoundError({
											message: "Customer not found",
										})
									);
								}

								// Create checkout session
								const sessionId = generateId("checkoutSession");
								const sessionData = {
									id: sessionId,
									customerId: customer.id,
									paymentProviderConfigurationProductId:
										paymentProviderConfigurationProduct.id,
									successCallbackUrl: input.successCallbackUrl,
									errorCallbackUrl: input.errorCallbackUrl,
									createdAt: new Date(),
									updatedAt: new Date(),
								};

								yield* checkoutSessionRepository.createCheckoutSession(
									sessionData
								);

								return yield* Effect.succeed({
									checkoutSessionId: sessionId,
									checkoutUrl: `${CHECKOUT_DOMAIN}/dev-checkout/${sessionId}`,
								} satisfies CreateCheckoutResponse);
							})
						)
					);

					yield* Effect.log(
						`Created checkout session ${result.checkoutSessionId} for customer ${appUserId}`
					);

					return result;
				}),

			getPaywallByLocation: (input: {
				locationSlug: string;
				nativePaymentProviderId?: string | null;
			}) =>
				Effect.gen(function* () {
					const session = yield* AuthSession;
					const environment = yield* Environment;
					const paywallRepository = yield* PaywallRepository;

					const appUserId = session?.customer?.appUserId;
					if (!appUserId) {
						return yield* Effect.fail(
							new UnauthorizedError({
								message: "App user ID not found",
							})
						);
					}

					const projectId = session?.projects[0]?.id;
					if (!projectId) {
						return yield* Effect.fail(
							new NotFoundError({
								message: "Project ID not found after authentication",
							})
						);
					}

					// Get paywall with products by location slug
					const paywallLocation =
						yield* paywallRepository.getPaywallWithProductsByLocationSlug({
							locationSlug: input.locationSlug,
							environment,
						});

					if (!paywallLocation?.defaultPaywall) {
						return yield* Effect.fail(
							new PaywallNotFound({
								message: "Paywall not found",
							})
						);
					}

					const paywall = paywallLocation.defaultPaywall;

					const paywallProducts = paywall.paywallProducts.map(
						(paywallProduct) => {
							const product = paywallProduct.product;

							const nativePurchaseAvailable = input.nativePaymentProviderId
								? checkNativePurchaseAvailability({
										environment,
										paywallProduct,
									})
								: false;

							const webCheckoutAvailable = checkWebCheckoutAvailability({
								environment,
								paywallProduct,
							});

							return {
								paywallProductId: paywallProduct.id,
								productId: product.id,
								displayName: paywallProduct.displayName,
								price: 100, // TODO: Get real price
								nativePurchaseAvailable,
								webCheckoutAvailable,
								webCheckoutPaymentProviderConfigurationProductId:
									webCheckoutAvailable
										? paywallProduct.webCheckoutPaymentProviderConfigurationProductId
										: null,
							};
						}
					);

					const response: PaywallResponse = {
						paywallId: paywall.id,
						paywallProducts,
					};

					yield* Effect.log(
						`Retrieved paywall ${paywall.id} for location ${input.locationSlug}`
					);

					return yield* Effect.succeed(response);
				}),

			identifyCustomer: (input: {
				appUserId: string;
				name: string | null;
				email: string | null;
			}) =>
				Effect.gen(function* () {
					const session = yield* AuthSession;
					const environment = yield* Environment;
					const customerRepository = yield* CustomerRepository;
					const customerService = yield* CustomerService;
					const db = yield* Db;

					const projectId = session?.projects[0]?.id;
					if (!projectId) {
						return yield* Effect.fail(
							new UnauthorizedError({
								message: "Project ID not found after authentication",
							})
						);
					}

					const result = yield* db.transaction((tx) =>
						TransactionContext.provide(tx)(
							Effect.gen(function* () {
								const currentAppUserId = session?.customer?.appUserId;

								// Get current customer if exists
								let currentCustomer: Customer | undefined;
								if (currentAppUserId) {
									currentCustomer =
										yield* customerRepository.getCustomerByAppUserId({
											appUserId: currentAppUserId,
											environment,
											projectId,
										});
								}

								// Get identifying as customer if exists
								let identifyingAsCustomer =
									yield* customerRepository.getCustomerByAppUserId({
										appUserId: input.appUserId,
										environment,
										projectId,
									});

								let identifyingAsCustomerId = identifyingAsCustomer?.id ?? null;

								// Can't identify already identified anonymous customer.
								if (
									currentCustomer &&
									currentCustomer.type === CustomerType.Anonymous &&
									currentCustomer.parentCustomerId
								) {
									const parentCustomer =
										yield* customerRepository.getCustomerById(
											currentCustomer.parentCustomerId
										);
									if (!parentCustomer)
										return yield* Effect.die(
											new Error(
												"parentCustomer is null event though it should exist"
											)
										);

									if (parentCustomer.appUserId !== input.appUserId) {
										return yield* Effect.fail(
											new CustomerConflictError({
												message: "Anonymous customer is already identified",
											})
										);
									}

									return parentCustomer;
								}

								// If identifying as customer doesn't exist, create a new one
								if (!identifyingAsCustomer) {
									const newCustomer = {
										id: generateId("customer"),
										projectId,
										appUserId: input.appUserId,
										parentCustomerId: null,
										name: input.name ?? null,
										email: input.email ?? null,
										origin: CustomerOrigin.IOS, // TODO: Make this dynamic
										environment,
										type: CustomerType.Identified,
									} satisfies InsertCustomer;

									yield* customerRepository.createCustomer(newCustomer);
									identifyingAsCustomerId = newCustomer.id;

									identifyingAsCustomer = {
										...newCustomer,
										archivedAt: null,
										createdAt: new Date(),
										updatedAt: new Date(),
										parentCustomerId: null,
									};
								}

								if (!identifyingAsCustomerId) {
									return yield* Effect.fail(
										new CustomerCreationError({
											message: "Failed to identify customer",
										})
									);
								}

								// Merge customers if current customer is anonymous
								if (
									currentCustomer &&
									currentCustomer.type === CustomerType.Anonymous
								) {
									yield* customerService.mergeCustomers(
										currentCustomer.id,
										identifyingAsCustomerId
									);
								}

								// Get updated identified customer
								const updatedCustomer =
									yield* customerRepository.getCustomerByAppUserId({
										appUserId: input.appUserId,
										environment,
										projectId,
									});

								if (!updatedCustomer) {
									return yield* Effect.fail(
										new CustomerCreationError({
											message: "Failed to get customer after identification",
										})
									);
								}

								return updatedCustomer;
							})
						)
					);

					yield* Effect.log(
						`Identified customer ${result.id} for app user ${input.appUserId}`
					);

					return result;
				}),

			getCustomerOrCreateAnonymous: () =>
				Effect.gen(function* () {
					const session = yield* AuthSession;
					const environment = yield* Environment;
					const customerRepository = yield* CustomerRepository;
					const customerService = yield* CustomerService;
					const db = yield* Db;

					const appUserId = session?.customer?.appUserId;
					if (!appUserId) {
						return yield* Effect.fail(
							new UnauthorizedError({
								message: "App user ID not found",
							})
						);
					}

					const projectId = session?.projects[0]?.id;
					if (!projectId) {
						return yield* Effect.fail(
							new NotFoundError({
								message: "Project ID not found after authentication",
							})
						);
					}

					const result = yield* db.transaction((tx) =>
						TransactionContext.provide(tx)(
							Effect.gen(function* () {
								// Try to get existing customer
								const customer =
									yield* customerRepository.getCustomerByAppUserId({
										appUserId,
										environment,
										projectId,
									});

								if (customer) {
									// Return parent if it exists, otherwise return the customer itself
									if (customer.parentCustomerId) {
										const parentCustomer =
											yield* customerRepository.getCustomerById(
												customer.parentCustomerId
											);
										return parentCustomer;
									}
									return customer;
								}

								// Customer not found, check if we should create anonymous customer
								if (isAnonymousId(appUserId)) {
									const newCustomer =
										yield* customerService.createAnonymousCustomer({
											projectId,
											appUserId,
											origin: CustomerOrigin.IOS, // TODO: Make this dynamic
											environment,
										});
									return newCustomer;
								}

								// Customer not found and not anonymous ID
								return yield* Effect.fail(
									new NotFoundError({
										message: "Customer not found",
									})
								);
							})
						)
					);

					return result;
				}),
		};
	}),
}) {}
