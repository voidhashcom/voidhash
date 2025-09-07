import {
  type Customer,
  CustomerOrigin,
  CustomerType,
  type InsertCustomer,
  type PaywallProduct
} from '@voidhash/db';
import { CHECKOUT_DOMAIN } from '@voidhash/lib/constants';
import {
  Environment as EnvironmentEnum,
  type EnvironmentValue
} from '@voidhash/lib/index';
import { Data, Effect, pipe } from 'effect';
import { Db, TransactionContext } from '@/lib/effect/db';
import { NotFoundError, UnauthorizedError } from '@/lib/effect/errors';
import { Request } from '@/lib/effect/request';
import { generateId } from '@/lib/id/generate';
import { AuthService, AuthSession } from '@/lib/services/auth.service';
import { Environment } from '@/lib/services/environment.service';
import { isAnonymousId } from '../core/sdk/utils';
import { CheckoutSessionRepository } from '../repositories/checkout-session.repository';
import { CustomerRepository } from '../repositories/customer.repository';
import { PaymentProviderConfigurationRepository } from '../repositories/payment-provider.repository';
import { PaymentProviderConfigurationProductRepository } from '../repositories/payment-provider-configuration-product.repository';
import { PaywallRepository } from '../repositories/paywall.repository';
import { PaywallLocationRepository } from '../repositories/paywall-location.repository';
import { CustomerService } from './customer.service';
import { parseSdkHeaders } from './helpers/sdk/load-sdk-headers';

export class PaymentProviderConfigurationNotFound extends Data.TaggedError(
  'PaymentProviderConfigurationNotFound'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class ProductNotFound extends Data.TaggedError('ProductNotFound')<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class PaywallNotFound extends Data.TaggedError('PaywallNotFound')<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class CustomerConflictError extends Data.TaggedError(
  'CustomerConflict'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class CustomerCreationError extends Data.TaggedError(
  'CustomerCreation'
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

type CustomerAttributesParams = {
  name?: string;
  email?: string;
};

export class SdkService extends Effect.Service<SdkService>()('SdkService', {
  dependencies: [],
  effect: Effect.gen(function* () {
    const isNativePurchaseAvailable = (options: {
      environment: EnvironmentValue;
      paywallProduct: PaywallProduct;
    }) => {
      return options.paywallProduct.enableNativePurchase;
    };

    const isWebCheckoutAvailable = (options: {
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
          const customerService = yield* CustomerService;
          const db = yield* Db;

          const appUserId = session?.customer?.appUserId;
          if (!appUserId) {
            return yield* Effect.fail(
              new UnauthorizedError({
                message: 'App user ID not found'
              })
            );
          }

          const projectId = session?.projects[0]?.id;
          if (!projectId) {
            return yield* Effect.fail(
              new NotFoundError({
                message: 'Project not found'
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
                message: 'Payment provider configuration product not found'
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
                    environment
                  }
                );

                if (!customer && isAnonymousId(appUserId)) {
                  const newCustomer = yield* customerService.createCustomer({
                    projectId,
                    appUserId,
                    origin: CustomerOrigin.IOS, // TODO: Make this dynamic
                    environment
                  });
                  customer = newCustomer;
                }

                if (!customer) {
                  return yield* Effect.fail(
                    new NotFoundError({
                      message: 'Customer not found'
                    })
                  );
                }

                // Create checkout session
                const sessionId = generateId('checkoutSession');
                const sessionData = {
                  id: sessionId,
                  customerId: customer.id,
                  paymentProviderConfigurationProductId:
                    paymentProviderConfigurationProduct.id,
                  successCallbackUrl: input.successCallbackUrl,
                  errorCallbackUrl: input.errorCallbackUrl,
                  createdAt: new Date(),
                  updatedAt: new Date()
                };

                yield* checkoutSessionRepository.createCheckoutSession(
                  sessionData
                );

                return yield* Effect.succeed({
                  checkoutSessionId: sessionId,
                  checkoutUrl: `${CHECKOUT_DOMAIN}/dev-checkout/${sessionId}`
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
                message: 'App user ID not found'
              })
            );
          }

          const projectId = session?.projects[0]?.id;
          if (!projectId) {
            return yield* Effect.fail(
              new NotFoundError({
                message: 'Project ID not found after authentication'
              })
            );
          }

          // Get paywall with products by location slug
          const paywallLocation =
            yield* paywallRepository.getPaywallWithProductsByLocationSlug({
              locationSlug: input.locationSlug,
              environment
            });

          if (!paywallLocation?.defaultPaywall) {
            return yield* Effect.fail(
              new PaywallNotFound({
                message: 'Paywall not found'
              })
            );
          }

          const paywall = paywallLocation.defaultPaywall;

          const paywallProducts = paywall.paywallProducts.map(
            (paywallProduct) => {
              const product = paywallProduct.product;

              const nativePurchaseAvailable = input.nativePaymentProviderId
                ? isNativePurchaseAvailable({
                    environment,
                    paywallProduct
                  })
                : false;

              const webCheckoutAvailable = isWebCheckoutAvailable({
                environment,
                paywallProduct
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
                    : null
              };
            }
          );

          const response: PaywallResponse = {
            paywallId: paywall.id,
            paywallProducts
          };

          yield* Effect.log(
            `Retrieved paywall ${paywall.id} for location ${input.locationSlug}`
          );

          return yield* Effect.succeed(response);
        }),

      getConfiguration: () =>
        Effect.gen(function* () {
          const request = yield* Request;
          const environment = yield* Environment;
          const authService = yield* AuthService;
          const paywallRepository = yield* PaywallRepository;
          const paywallLocationRepository = yield* PaywallLocationRepository;
          const paymentProviderRepository =
            yield* PaymentProviderConfigurationRepository;

          const headers = yield* request.getHeaders();
          const sdkHeaders = parseSdkHeaders(headers);
          const projectId = yield* authService.getAuthorizedProjectId();
          // const appUserId = sdkHeaders["X-App-User-Id"];

          const [paywalls, paywallLocations, paymentProviderConfigurations] =
            yield* Effect.all(
              [
                paywallRepository.getPaywallsWithProductsAndPaymentProviderConfigurations(
                  {
                    projectId,
                    environment
                  }
                ),
                paywallLocationRepository.getPaywallLocations({
                  projectId,
                  environment
                }),
                paymentProviderRepository.getPaymentProviderConfigurations(
                  projectId
                )
              ],
              {
                concurrency: 'unbounded'
              }
            );

          const enabledPaymentProviderConfigurations =
            paymentProviderConfigurations.filter(
              (paymentProviderConfiguration) =>
                paymentProviderConfiguration.enabled
            );

          const placements = paywallLocations.map((paywallLocation) => {
            return {
              paywallId: paywallLocation.defaultPaywallId,
              paywallLocationId: paywallLocation.id
            };
          });

          yield* Effect.logDebug(sdkHeaders);

          return {
            paywalls,
            paywallLocations,
            placements,
            paymentProviderConfigurations: enabledPaymentProviderConfigurations
          };
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
                message: 'Project ID not found after authentication'
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
                      projectId
                    });
                }

                // Get identifying as customer if exists
                let identifyingAsCustomer =
                  yield* customerRepository.getCustomerByAppUserId({
                    appUserId: input.appUserId,
                    environment,
                    projectId
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
                  if (!parentCustomer) {
                    return yield* Effect.die(
                      new Error(
                        'parentCustomer is null event though it should exist'
                      )
                    );
                  }

                  if (parentCustomer.appUserId !== input.appUserId) {
                    return yield* Effect.fail(
                      new CustomerConflictError({
                        message: 'Anonymous customer is already identified'
                      })
                    );
                  }

                  return parentCustomer;
                }

                // If identifying as customer doesn't exist, create a new one
                if (!identifyingAsCustomer) {
                  const newCustomer = {
                    id: generateId('customer'),
                    projectId,
                    appUserId: input.appUserId,
                    parentCustomerId: null,
                    name: input.name ?? null,
                    email: input.email ?? null,
                    origin: CustomerOrigin.IOS, // TODO: Make this dynamic
                    environment,
                    type: CustomerType.Identified,
                    additionalAttributes: {}
                  } satisfies InsertCustomer;

                  yield* customerRepository.createCustomer(newCustomer);
                  identifyingAsCustomerId = newCustomer.id;

                  identifyingAsCustomer = {
                    ...newCustomer,
                    archivedAt: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    parentCustomerId: null
                  };
                }

                if (!identifyingAsCustomerId) {
                  return yield* Effect.fail(
                    new CustomerCreationError({
                      message: 'Failed to identify customer'
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
                    projectId
                  });

                if (!updatedCustomer) {
                  return yield* Effect.fail(
                    new CustomerCreationError({
                      message: 'Failed to get customer after identification'
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

      syncCustomerAttributes: (input: CustomerAttributesParams) =>
        Effect.gen(function* () {
          const request = yield* Request;
          const session = yield* AuthSession;
          const environment = yield* Environment;
          const customerRepository = yield* CustomerRepository;
          const customerService = yield* CustomerService;

          const appUserId = session?.customer?.appUserId;
          if (!appUserId) {
            return yield* Effect.fail(
              new UnauthorizedError({
                message: 'App user ID not found'
              })
            );
          }

          const projectId = session?.projects[0]?.id;
          if (!projectId) {
            return yield* Effect.fail(
              new NotFoundError({
                message: 'Project ID not found after authentication'
              })
            );
          }

          // Get or create customer
          const customer = yield* pipe(
            customerRepository.getCustomerByAppUserId({
              appUserId,
              environment,
              projectId
            }),

            Effect.andThen((customer) => {
              if (customer) {
                return Effect.succeed(customer);
              }

              return pipe(
                customerService.createCustomer({
                  projectId,
                  appUserId,
                  origin: CustomerOrigin.IOS, // TODO: Make this dynamic
                  environment
                }),

                // Get customer after creation
                Effect.andThen(() =>
                  customerRepository.getCustomerByAppUserId({
                    appUserId,
                    environment,
                    projectId
                  })
                ),

                // This is required to make the type checker happy
                Effect.andThen((customer) =>
                  customer
                    ? Effect.succeed(customer)
                    : Effect.dieMessage(
                        'Customer not found after syncCustomerData. This should never happen, because we created it before retrieving it.'
                      )
                )
              );
            })
          );

          const headers = yield* request.getHeaders();
          const sdkHeaders = parseSdkHeaders(headers);

          yield* Effect.log(JSON.stringify(sdkHeaders, null, 2));

          yield* customerRepository.updateCustomer({
            id: customer.id,
            name: input.name,
            email: input.email,
            additionalAttributes: {
              ...(customer.additionalAttributes ?? {}),
              platform: sdkHeaders['x-platform'],
              sdk: sdkHeaders['x-sdk'],
              sdkVersion: sdkHeaders['x-sdk-version'],
              platformFlavor: sdkHeaders['x-platform-flavor'],
              platformFlavorVersion: sdkHeaders['x-platform-flavor-version'],
              platformVersion: sdkHeaders['x-platform-version'],
              platformDevice: sdkHeaders['x-platform-device'],
              platformBrand: sdkHeaders['x-platform-brand'],
              preferredLocales: sdkHeaders['x-preferred-locales'],
              clientLocale: sdkHeaders['x-client-locale'],
              clientVersion: sdkHeaders['x-client-version'],
              storefront: sdkHeaders['x-storefront']
            }
          });

          yield* Effect.log(
            `Synced customer data ${JSON.stringify(
              {
                id: customer.id,
                name: input.name,
                email: input.email,
                additionalAttributes: {
                  ...(customer.additionalAttributes ?? {}),
                  platform: sdkHeaders['x-platform'],
                  sdk: sdkHeaders['x-sdk'],
                  sdkVersion: sdkHeaders['x-sdk-version'],
                  platformFlavor: sdkHeaders['x-platform-flavor'],
                  platformFlavorVersion:
                    sdkHeaders['x-platform-flavor-version'],
                  platformVersion: sdkHeaders['x-platform-version'],
                  platformDevice: sdkHeaders['x-platform-device'],
                  platformBrand: sdkHeaders['x-platform-brand'],
                  preferredLocales: sdkHeaders['x-preferred-locales'],
                  clientLocale: sdkHeaders['x-client-locale'],
                  clientVersion: sdkHeaders['x-client-version'],
                  storefront: sdkHeaders['x-storefront']
                }
              },
              null,
              2
            )} for customer ${customer.id} for app user ${appUserId}`
          );

          return customer;
        }),

      getCustomer: () =>
        Effect.gen(function* () {
          const session = yield* AuthSession;
          const environment = yield* Environment;
          const customerRepository = yield* CustomerRepository;
          const db = yield* Db;

          const appUserId = session?.customer?.appUserId;
          if (!appUserId) {
            return yield* Effect.fail(
              new UnauthorizedError({
                message: 'App user ID not found'
              })
            );
          }

          const projectId = session?.projects[0]?.id;
          if (!projectId) {
            return yield* Effect.fail(
              new NotFoundError({
                message: 'Project ID not found after authentication'
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
                    projectId
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

                // Customer not found and not anonymous ID
                return yield* Effect.fail(
                  new NotFoundError({
                    message: 'Customer not found'
                  })
                );
              })
            )
          );

          return result;
        })
    };
  })
}) {}
