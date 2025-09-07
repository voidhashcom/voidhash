import type { JWSTransactionDecodedPayload } from '@apple/app-store-server-library';
import type { PaymentProviderConfiguration } from '@voidhash/db';
import {
  type EnvironmentValue,
  parseISO4217CurrencyCode
} from '@voidhash/lib/constants';
import { Data, Effect } from 'effect';
import type z from 'zod';
import { PaymentProviderConfigurationRepository } from '@/lib/repositories/payment-provider.repository';
import { PaymentProviderConfigurationProductRepository } from '@/lib/repositories/payment-provider-configuration-product.repository';
import { AuthSession } from '@/lib/services/auth.service';
import { Environment } from '@/lib/services/environment.service';
import { appStore } from '../app-store';
import { AppStoreServerAPIService } from './app-store-server-api.service';

export class AppStoreNotEnabledForThisBundleIdError extends Data.TaggedError(
  'AppStoreNotEnabledForThisBundleIdError'
)<{
  readonly message: string;
}> {}

export class AppStoreServerAPIError extends Data.TaggedError(
  'AppStoreServerAPIError'
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class AppStoreTransactionDoesNotContainProductIdError extends Data.TaggedError(
  'AppStoreTransactionDoesNotContainProductIdError'
)<{
  readonly message: string;
}> {}

export class PaymentProviderConfigurationProductNotFound extends Data.TaggedError(
  'PaymentProviderConfigurationProductNotFound'
)<{
  readonly message: string;
}> {}

export class AppStoreTransactionValidationFailed extends Data.TaggedError(
  'AppStoreTransactionDoesNotContainCustomerIdError'
)<{
  readonly message: string;
}> {}

export class AppStoreService extends Effect.Service<AppStoreService>()(
  'AppStoreService',
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      return {
        validateTransaction: (input: {
          transactionId: string;
          bundleId: string;
          environment: EnvironmentValue;
        }) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const environment = yield* Environment;
            const appStoreServerAPIService = yield* AppStoreServerAPIService;
            // const db = yield* Db;
            // const appStoreTransactionRepository =
            // 	yield* AppStoreTransactionRepository;
            const paymentProviderConfigurationRepository =
              yield* PaymentProviderConfigurationRepository;
            const paymentProviderConfigurationProductRepository =
              yield* PaymentProviderConfigurationProductRepository;

            Effect.logDebug('Validating transaction', {
              transactionId: input.transactionId,
              bundleId: input.bundleId,
              environment: input.environment
            });

            const projectId = session.projects[0]?.id;
            if (!projectId) {
              return yield* Effect.dieMessage(
                'Project ID does not exist in the session'
              );
            }

            const paymentProviderConfigurations =
              yield* paymentProviderConfigurationRepository.getPaymentProviderConfigurations(
                projectId
              );

            // Load configuration
            const appStorePaymentProviderConfiguration =
              yield* getActiveAppStorePaymentProviderConfiguration(
                paymentProviderConfigurations,
                input.bundleId
              );

            const appStoreServerAPISdk =
              yield* appStoreServerAPIService.initializeSdk(
                appStorePaymentProviderConfiguration.configuration
              );

            // Get transaction info from App Store Server API
            const transactionInfoResult = yield* appStoreServerAPISdk
              .getTransactionInfo(input.transactionId)
              .pipe(
                Effect.catchTags({
                  // TODO: Handle other errors - mostly to notify the user about incorrect configuration
                }),
                Effect.catchAll((error) =>
                  Effect.gen(function* () {
                    return yield* Effect.fail(
                      new AppStoreServerAPIError({
                        message: 'Failed to validate transaction',
                        cause: error
                      })
                    );
                  })
                )
              );

            const decodedTransaction = yield* appStoreServerAPISdk
              .decodeTransaction(transactionInfoResult)
              .pipe(Effect.flatMap(ensureEncodedTransactionHasRequiredFields));

            const paymentProviderConfigurationProduct =
              yield* paymentProviderConfigurationProductRepository.getProviderProductByPrimaryKey(
                {
                  paymentProviderConfigurationId:
                    appStorePaymentProviderConfiguration.id,
                  providerProductKey: decodedTransaction.productId,
                  environment
                }
              );

            if (!paymentProviderConfigurationProduct) {
              return yield* Effect.fail(
                new PaymentProviderConfigurationProductNotFound({
                  message: 'Payment provider configuration product not found. '
                })
              );
            }

            // const customerId = decodedTransaction.appAccountToken;
            // const currency = decodedTransaction.currency;
            // const transactionId = decodedTransaction.transactionId;

            return yield* Effect.succeed({
              success: true
            });

            // return yield* db.transaction((tx) =>
            // 	TransactionContext.provide(tx)(
            // 		Effect.gen(function* () {
            // 			const existingAppStoreTransaction =
            // 				yield* appStoreTransactionRepository.getAppStoreTransactionByTransactionId(
            // 					transactionId,
            // 				);

            // 			if (existingAppStoreTransaction) {
            // 				// TODO: Update the transaction
            // 				return;
            // 			}

            // 			const newAppStoreTransaction =
            // 				appStoreTransactionRepository.createAppStoreTransaction({
            // 					id: generateId("appStoreTransaction"),

            // 				});
            // 		}),
            // 	),
            // );
          })
      };
    })
  }
) {}

/**
 * Finds the active App Store payment provider configuration by bundle ID
 * @param paymentProviderConfigurations - The payment provider configurations to search through
 * @param bundleId - The bundle ID to search for
 * @returns The active App Store payment provider configuration if found, otherwise undefined
 */
const getActiveAppStorePaymentProviderConfiguration = (
  paymentProviderConfigurations: PaymentProviderConfiguration[],
  bundleId: string
) =>
  Effect.gen(function* () {
    const paymentProviderConfiguration = paymentProviderConfigurations.find(
      (paymentProviderConfiguration) =>
        paymentProviderConfiguration.paymentProviderKey ===
          appStore.createGlobalKey({
            bundleId
          }) && paymentProviderConfiguration.enabled
    );

    if (!paymentProviderConfiguration) {
      return yield* Effect.fail(
        new AppStoreNotEnabledForThisBundleIdError({
          message: 'App Store is not enabled for this bundle ID'
        })
      );
    }

    return {
      ...paymentProviderConfiguration,
      configuration: paymentProviderConfiguration.configuration as z.infer<
        ReturnType<typeof appStore.getGlobalConfigurationSchema>
      >
    };
  });

const ensureEncodedTransactionHasRequiredFields = (
  decodedTransaction: JWSTransactionDecodedPayload
) =>
  Effect.gen(function* () {
    const productId = decodedTransaction.productId;
    const appAccountToken = decodedTransaction.appAccountToken;
    const currency = decodedTransaction.currency;
    const transactionId = decodedTransaction.transactionId;

    if (!transactionId) {
      return yield* Effect.fail(
        new AppStoreTransactionValidationFailed({
          message: 'Transaction does not contain transaction ID'
        })
      );
    }

    if (!productId) {
      return yield* Effect.fail(
        new AppStoreTransactionValidationFailed({
          message: 'Transaction does not contain product ID'
        })
      );
    }

    if (!appAccountToken) {
      return yield* Effect.fail(
        new AppStoreTransactionValidationFailed({
          message: 'Transaction does not contain customer ID'
        })
      );
    }

    if (!currency) {
      return yield* Effect.fail(
        new AppStoreTransactionValidationFailed({
          message: 'Transaction does not contain currency'
        })
      );
    }

    const currencyStrict = yield* parseISO4217CurrencyCode(currency);

    return yield* Effect.succeed({
      ...decodedTransaction,
      currency: currencyStrict,
      customerId: appAccountToken,
      productId
    });
  });

// const mapDecodedTransactionToAppStoreTransactionInsert = (transaction: JWSTransactionDecodedPayload) => {
// 	return {
// 		transactionId: transaction.transactionId,
// 		currency: transaction.currency,
// 		environment: fromEnvironment(
// 			transaction.environment,
// 		),
// 		expireDate: transaction.expiresDate
// 			? new Date(transaction.expiresDate)
// 			: null,
// 		inAppOwnershipType: fromOwnershipType(
// 			transaction.inAppOwnershipType,
// 		),
// 		isUpgraded: transaction.isUpgraded,
// 		offerDiscountType: transaction.offerDiscountType
// 			? fromOfferDiscountType(
// 					transaction.offerDiscountType,
// 				)
// 			: null,
// 		offerIdentifier: transaction.offerIdentifier,
// 		offerPeriod: transaction.offerPeriod,
// 		offerType: transaction.offerType
// 			? fromOfferType(transaction.offerType)
// 			: null,
// 		originalPurchaseDate: new Date(
// 			transaction.originalPurchaseDate,
// 		),
// 		originalTransactionId:
// 			transaction.originalTransactionId,
// 		price: transaction.price,
// 		productId: transaction.productId,
// 		purchaseDate: new Date(transaction.purchaseDate),
// 		quantity: transaction.quantity,
// 		revocationDate: transaction.revocationDate
// 			? new Date(transaction.revocationDate)
// 			: null,
// 		revocationReason: transaction.revocationReason
// 			? fromRevocationReason(
// 					transaction.revocationReason,
// 				)
// 			: null,
// 		storefront: transaction.storefront,
// 		storefrontId: transaction.storefrontId,
// 		subscriptionGroupIdentifier:
// 			transaction.subscriptionGroupIdentifier,
// 		transactionReason: transaction.transactionReason
// 			? fromTransactionReason(
// 					transaction.transactionReason,
// 				)
// 			: null,
// 		type: fromTransactionType(transaction.type),
// 		webOrderLineItemId: transaction.webOrderLineItemId,
// 	}
// }
