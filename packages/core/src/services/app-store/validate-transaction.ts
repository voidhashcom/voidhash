import {
  and,
  eq,
  isNull,
  paymentProviderConfigurationProducts,
  paymentProviderConfigurations,
} from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import {
  AppStoreServiceError,
  AuthSession,
  PaymentProviderProductServiceError,
} from "@voidhash/shared";
import { Effect, Schema } from "effect";

import { appStore } from "../../payment-providers";
import { AppStoreServerAPIService } from "../app-store-server-api";
import {
  ensureEncodedTransactionHasRequiredFields,
  getActiveAppStorePaymentProviderConfiguration,
} from "./utils";

const _getPaymentProviderConfigurationsByProjectId = (db: Db) =>
  db.makeQuery((execute, projectId: string) =>
    execute(
      async (db) =>
        await db.query.paymentProviderConfigurations.findMany({
          where: and(
            eq(paymentProviderConfigurations.projectId, projectId),
            isNull(paymentProviderConfigurations.deletedAt)
          ),
        })
    )
  );

const _getProviderProductByPrimaryKey = (db: Db) =>
  db.makeQuery(
    (
      execute,
      {
        paymentProviderConfigurationId,
        providerProductKey,
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
            ),
          })
      )
  );

export const validateTransaction = Effect.gen(function* validateTransaction() {
  const db = yield* Db;
  return Effect.fn("validateTransaction")(
    function* validateTransaction(input: {
      transactionId: string;
      bundleId: string;
    }) {
      const session = yield* AuthSession;
      const appStoreServerAPIService = yield* AppStoreServerAPIService;

      Effect.logDebug("Validating transaction", {
        bundleId: input.bundleId,
        transactionId: input.transactionId,
      });

      const projectId = session.projects[0]?.id;
      if (!projectId) {
        return yield* Effect.dieMessage(
          "Project ID does not exist in the session"
        );
      }

      const paymentProviderConfigurations =
        yield* _getPaymentProviderConfigurationsByProjectId(db)(projectId);

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
        yield* appStoreServerAPIService.initializeSdk(parsedConfiguration);

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
        yield* _getProviderProductByPrimaryKey(db)({
          paymentProviderConfigurationId:
            appStorePaymentProviderConfiguration.id,
          providerProductKey: decodedTransaction.productId,
        });

      if (!paymentProviderConfigurationProduct) {
        return yield* Effect.fail(
          new PaymentProviderProductServiceError({
            cause: "Payment provider configuration product not found. ",
          })
        );
      }

      // const customerId = decodedTransaction.appAccountToken;
      // const currency = decodedTransaction.currency;
      // const transactionId = decodedTransaction.transactionId;

      return {
        success: true,
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
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          AppStoreGeneralError: (error) =>
            new AppStoreServiceError({
              cause: String(error.cause),
            }),
          AppStoreSignedTransactionInfoNotFoundError: (error) =>
            new AppStoreServiceError({
              cause: String(error.cause),
            }),
          AppStoreVerificationException: (error) =>
            new AppStoreServiceError({
              cause: String(error.cause),
            }),
          DatabaseError: (error) =>
            new AppStoreServiceError({
              cause: String(error.cause),
            }),
          InvalidISO4217CurrencyCodeError: (error) =>
            new AppStoreServiceError({
              cause: String(error.cause),
            }),
          ParseError: (error) =>
            new AppStoreServiceError({
              cause: String(error.cause),
            }),
          PaymentProviderProductServiceError: (error) =>
            new AppStoreServiceError({
              cause: String(error.cause),
            }),
        })
      )
  );
});
