import { Data, Effect } from 'effect';
import { Db, TransactionContext } from '@/lib/effect/db';
import { checkProjectPermission } from '@/lib/effect/permissions';
import { generateId } from '@/lib/id/generate';
import { AuthSession } from '@/lib/services/auth.service';
import { Environment } from '@/lib/services/environment.service';
import { PaywallRepository } from '../repositories/paywall.repository';

export class PaywallNotFoundError extends Data.TaggedError(
  'PaywallNotFoundError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class PaywallInUseError extends Data.TaggedError('PaywallInUseError')<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class ProductNotFound extends Data.TaggedError('ProductNotFound')<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class PaymentProviderConfigurationNotFound extends Data.TaggedError(
  'PaymentProviderConfigurationNotFound'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class PaywallService extends Effect.Service<PaywallService>()(
  'PaywallService',
  {
    dependencies: [PaywallRepository.Default],
    effect: Effect.gen(function* () {
      const paywallRepository = yield* PaywallRepository;
      return {
        createPaywall: (input: { projectId: string; name: string }) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const environment = yield* Environment;
            const paywallRepository = yield* PaywallRepository;

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              input.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to create paywalls for project ${input.projectId}`
            );

            const newPaywall = {
              id: generateId('paywall'),
              projectId: input.projectId,
              name: input.name,
              environment
            };

            yield* paywallRepository.createPaywall(newPaywall);
            yield* Effect.log(
              `Created paywall ${newPaywall.id} for project ${input.projectId}`
            );

            return yield* Effect.succeed({
              id: newPaywall.id
            });
          }),

        getPaywalls: (projectId: string) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const environment = yield* Environment;

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to access paywalls for project ${projectId}`
            );

            return yield* paywallRepository.getPaywalls({
              projectId,
              environment
            });
          }),

        getPaywallById: (id: string) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const paywall = yield* paywallRepository.getPaywallById(id);
            if (!paywall) {
              return yield* Effect.fail(
                new PaywallNotFoundError({
                  message: `Paywall ${id} not found`
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              paywall.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to access paywall ${id} for project ${paywall.projectId}`
            );

            return paywall;
          }),
        getPaywallProducts: (paywallId: string) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;

            // First get the paywall to check permissions
            const paywall = yield* paywallRepository.getPaywallById(paywallId);
            if (!paywall) {
              return yield* Effect.fail(
                new PaywallNotFoundError({
                  message: `Paywall ${paywallId} not found`
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              paywall.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to access paywall products for paywall ${paywallId} in project ${paywall.projectId}`
            );

            return yield* paywallRepository.getPaywallProducts(paywallId);
          }),

        updatePaywall: (input: {
          paywallId: string;
          name?: string | null;
          paywallProducts: {
            productId: string;
            displayName: string;
            enableNativePurchase: boolean;
            enableWebCheckout: boolean;
            webCheckoutPaymentProviderConfigurationProductId: string | null;
            order: number;
          }[];
        }) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const paywallRepository = yield* PaywallRepository;
            const db = yield* Db;

            // First check if paywall exists
            const paywall = yield* paywallRepository.getPaywallById(
              input.paywallId
            );
            if (!paywall) {
              return yield* Effect.fail(
                new PaywallNotFoundError({
                  message: `Paywall ${input.paywallId} not found`
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              paywall.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to update paywall ${input.paywallId} for project ${paywall.projectId}`
            );

            // Use transaction to update paywall and products
            yield* db.transaction((tx) =>
              TransactionContext.provide(tx)(
                Effect.gen(function* () {
                  // Update paywall name if provided
                  if (input.name) {
                    yield* paywallRepository.updatePaywall({
                      id: paywall.id,
                      name: input.name
                    });
                  }

                  // Update paywall products if provided
                  if (input.paywallProducts) {
                    // Delete existing paywall products
                    yield* paywallRepository.deletePaywallProducts(paywall.id);

                    // Get products with configurations
                    const productIds = input.paywallProducts.map(
                      (p) => p.productId
                    );
                    const productsFromDb =
                      yield* paywallRepository.getProductsWithConfigurations(
                        productIds
                      );

                    // Validate products and insert new paywall products
                    const sortedProducts = [...input.paywallProducts].sort(
                      (a, b) => a.order - b.order
                    );
                    for (const product of sortedProducts) {
                      const existingProduct = productsFromDb.find(
                        (p) => p.id === product.productId
                      );

                      if (!existingProduct) {
                        return yield* Effect.fail(
                          new ProductNotFound({
                            message: `Product with id ${product.productId} not found`
                          })
                        );
                      }

                      const webCheckoutPaymentProviderConfigurationProduct =
                        existingProduct.paymentProviderConfigurationProducts.find(
                          (p) =>
                            p.id ===
                            product.webCheckoutPaymentProviderConfigurationProductId
                        );

                      if (
                        product.enableWebCheckout &&
                        !webCheckoutPaymentProviderConfigurationProduct
                      ) {
                        return yield* Effect.fail(
                          new PaymentProviderConfigurationNotFound({
                            message:
                              'Web checkout payment provider product configuration does not exist'
                          })
                        );
                      }

                      yield* paywallRepository.createPaywallProduct({
                        id: generateId('paywallProduct'),
                        displayName: product.displayName,
                        order: product.order,
                        paywallId: paywall.id,
                        productId: existingProduct.id,
                        enableNativePurchase: product.enableNativePurchase,
                        enableWebCheckout: product.enableWebCheckout,
                        webCheckoutPaymentProviderConfigurationProductId:
                          product.webCheckoutPaymentProviderConfigurationProductId
                      });
                    }
                  }
                })
              )
            );

            yield* Effect.log(`Updated paywall ${input.paywallId}`);

            return yield* Effect.succeed(undefined);
          }),

        deletePaywall: (input: { paywallId: string }) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const paywallRepository = yield* PaywallRepository;
            const db = yield* Db;

            // First check if paywall exists
            const paywall = yield* paywallRepository.getPaywallById(
              input.paywallId
            );
            if (!paywall) {
              return yield* Effect.fail(
                new PaywallNotFoundError({
                  message: `Paywall ${input.paywallId} not found`
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              paywall.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to delete paywall ${input.paywallId} for project ${paywall.projectId}`
            );

            // Check if paywall is being used by any paywall locations
            const paywallLocationsUsingPaywall =
              yield* paywallRepository.getPaywallLocationsUsingPaywall(
                input.paywallId
              );
            if (paywallLocationsUsingPaywall.length > 0) {
              return yield* Effect.fail(
                new PaywallInUseError({
                  message:
                    'You cannot delete this paywall, because some paywall locations are still using it. Please update the paywall locations to use a different paywall first, or delete the paywall locations.'
                })
              );
            }

            // Use transaction to delete paywall products and paywall
            yield* db.transaction((tx) =>
              TransactionContext.provide(tx)(
                Effect.gen(function* () {
                  // Delete paywall products first
                  yield* paywallRepository.deletePaywallProducts(
                    input.paywallId
                  );
                  // Then delete the paywall
                  yield* paywallRepository.deletePaywall(input.paywallId);
                })
              )
            );

            yield* Effect.log(`Deleted paywall ${input.paywallId}`);

            return yield* Effect.succeed(undefined);
          })
      };
    })
  }
) {}
