import type { JWSTransactionDecodedPayload } from "@apple/app-store-server-library";
import type { PaymentProviderConfiguration } from "@voidhash/db";
import { parseISO4217CurrencyCode } from "@voidhash/lib/constants";
import {
  AppStoreNotEnabledForFollowingBundleIdError,
  AppStoreServiceError,
} from "@voidhash/shared";
import { Effect } from "effect";

import { appStore } from "../../payment-providers";

/**
 * Finds the active App Store payment provider configuration by bundle ID
 * @param paymentProviderConfigurations - The payment provider configurations to search through
 * @param bundleId - The bundle ID to search for
 * @returns The active App Store payment provider configuration if found, otherwise undefined
 */
export const getActiveAppStorePaymentProviderConfiguration = (
  paymentProviderConfigurations: PaymentProviderConfiguration[],
  bundleId: string
) =>
  Effect.gen(function* getActiveAppStorePaymentProviderConfiguration() {
    const paymentProviderConfiguration = paymentProviderConfigurations.find(
      (paymentProviderConfiguration) =>
        paymentProviderConfiguration.paymentProviderKey ===
          appStore.createGlobalKey({
            bundleId,
          }) && paymentProviderConfiguration.enabled
    );

    if (!paymentProviderConfiguration) {
      return yield* Effect.fail(
        new AppStoreNotEnabledForFollowingBundleIdError({
          bundleId,
        })
      );
    }

    return {
      ...paymentProviderConfiguration,
      configuration: paymentProviderConfiguration.configuration,
    };
  });

export const ensureEncodedTransactionHasRequiredFields = (
  decodedTransaction: JWSTransactionDecodedPayload
) =>
  Effect.gen(function* ensureEncodedTransactionHasRequiredFields() {
    const { productId } = decodedTransaction;
    const { appAccountToken } = decodedTransaction;
    const { currency } = decodedTransaction;
    const { transactionId } = decodedTransaction;

    if (!transactionId) {
      return yield* Effect.fail(
        new AppStoreServiceError({
          cause: "Transaction does not contain transaction ID",
        })
      );
    }

    if (!productId) {
      return yield* Effect.fail(
        new AppStoreServiceError({
          cause: "Transaction does not contain product ID",
        })
      );
    }

    if (!appAccountToken) {
      return yield* Effect.fail(
        new AppStoreServiceError({
          cause: "Transaction does not contain customer ID (appAccountToken)",
        })
      );
    }

    if (!currency) {
      return yield* Effect.fail(
        new AppStoreServiceError({
          cause: "Transaction does not contain currency",
        })
      );
    }

    const currencyStrict = yield* parseISO4217CurrencyCode(currency);

    return yield* Effect.succeed({
      ...decodedTransaction,
      currency: currencyStrict,
      customerId: appAccountToken,
      productId,
    });
  });
