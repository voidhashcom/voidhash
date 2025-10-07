import type { JWSTransactionDecodedPayload } from '@apple/app-store-server-library';
import {
  and,
  eq,
  isNull,
  type PaymentProviderConfiguration,
  paymentProviderConfigurationProducts,
  paymentProviderConfigurations
} from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { parseISO4217CurrencyCode } from '@voidhash/lib/constants';
import {
  AppStoreNotEnabledForFollowingBundleIdError,
  AppStoreServiceError,
  AuthSession,
  PaymentProviderProductServiceError
} from '@voidhash/shared';
import { Effect, pipe, Schema } from 'effect';
import { appStore } from '../payment-providers';
import { AppStoreServerAPIService } from './app-store-server-api-service';
export class AppStoreService extends Effect.Service<AppStoreService>()(
  'AppStoreService',
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      const dbService = yield* Db;

      const _getPaymentProviderConfigurationsByProjectId = dbService.makeQuery(
        (execute, projectId: string) =>
          execute(
            async (db) =>
              await db.query.paymentProviderConfigurations.findMany({
                where: and(
                  eq(paymentProviderConfigurations.projectId, projectId),
                  isNull(paymentProviderConfigurations.deletedAt)
                )
              })
          )
      );

      const _getProviderProductByPrimaryKey = dbService.makeQuery(
        (
          execute,
          {
            paymentProviderConfigurationId,
            providerProductKey
          }: {
            paymentProviderConfigurationId: string;
            providerProductKey: string;
          }
        ) =>
          execute(
            async (db) =>
              await db.query.paymentProviderConfigurationProducts.findFirst({
                where: and(
                  eq(
                    paymentProviderConfigurationProducts.paymentProviderConfigurationId,
                    paymentProviderConfigurationId
                  ),
                  eq(
                    paymentProviderConfigurationProducts.providerProductKey,
                    providerProductKey
                  )
                )
              })
          )
      );

      const validateTransaction = (input: {
        transactionId: string;
        bundleId: string;
      }) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const appStoreServerAPIService = yield* AppStoreServerAPIService;

            Effect.logDebug('Validating transaction', {
              transactionId: input.transactionId,
              bundleId: input.bundleId
            });

            const projectId = session.projects[0]?.id;
            if (!projectId) {
              return yield* Effect.dieMessage(
                'Project ID does not exist in the session'
              );
            }

            const paymentProviderConfigurations =
              yield* _getPaymentProviderConfigurationsByProjectId(projectId);

            // Load configuration
            const appStorePaymentProviderConfiguration =
              yield* getActiveAppStorePaymentProviderConfiguration(
                paymentProviderConfigurations,
                input.bundleId
              );

            const parsedConfiguration = yield* Schema.decodeUnknown(
              appStore.globalConfigurationSchema as Schema.Schema.Any
            )(appStorePaymentProviderConfiguration.configuration);

            const appStoreServerAPISdk =
              yield* appStoreServerAPIService.initializeSdk(
                parsedConfiguration
              );

            // Get transaction info from App Store Server API
            const transactionInfoResult = yield* appStoreServerAPISdk
              .getTransactionInfo(input.transactionId)
              .pipe(
                Effect.catchTags({
                  // TODO: Handle other errors - mostly to notify the user about incorrect configuration
                }),
                Effect.orDie
              );

            const decodedTransaction = yield* appStoreServerAPISdk
              .decodeTransaction(transactionInfoResult)
              .pipe(Effect.flatMap(ensureEncodedTransactionHasRequiredFields));

            const paymentProviderConfigurationProduct =
              yield* _getProviderProductByPrimaryKey({
                paymentProviderConfigurationId:
                  appStorePaymentProviderConfiguration.id,
                providerProductKey: decodedTransaction.productId
              });

            if (!paymentProviderConfigurationProduct) {
              return yield* Effect.fail(
                new PaymentProviderProductServiceError({
                  cause: 'Payment provider configuration product not found. '
                })
              );
            }

            // const customerId = decodedTransaction.appAccountToken;
            // const currency = decodedTransaction.currency;
            // const transactionId = decodedTransaction.transactionId;

            return {
              success: true
            };

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
          }),
          Effect.catchTags({
            AppStoreGeneralError: (error) =>
              new AppStoreServiceError({
                cause: String(error.cause)
              }),
            AppStoreSignedTransactionInfoNotFoundError: (error) =>
              new AppStoreServiceError({
                cause: String(error.cause)
              }),
            AppStoreVerificationException: (error) =>
              new AppStoreServiceError({
                cause: String(error.cause)
              }),
            DatabaseError: (error) =>
              new AppStoreServiceError({
                cause: String(error.cause)
              }),
            InvalidISO4217CurrencyCodeError: (error) =>
              new AppStoreServiceError({
                cause: String(error.cause)
              }),
            ParseError: (error) =>
              new AppStoreServiceError({
                cause: String(error.cause)
              }),
            PaymentProviderProductServiceError: (error) =>
              new AppStoreServiceError({
                cause: String(error.cause)
              })
          })
        );
      return {
        validateTransaction
      } as const;
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
        new AppStoreNotEnabledForFollowingBundleIdError({
          bundleId
        })
      );
    }

    return {
      ...paymentProviderConfiguration,
      configuration: paymentProviderConfiguration.configuration
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
        new AppStoreServiceError({
          cause: 'Transaction does not contain transaction ID'
        })
      );
    }

    if (!productId) {
      return yield* Effect.fail(
        new AppStoreServiceError({
          cause: 'Transaction does not contain product ID'
        })
      );
    }

    if (!appAccountToken) {
      return yield* Effect.fail(
        new AppStoreServiceError({
          cause: 'Transaction does not contain customer ID (appAccountToken)'
        })
      );
    }

    if (!currency) {
      return yield* Effect.fail(
        new AppStoreServiceError({
          cause: 'Transaction does not contain currency'
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
