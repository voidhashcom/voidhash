import type { JWSTransactionDecodedPayload } from "@voidhash/app-store-server-sdk";
import { Environment } from "@voidhash/app-store-server-sdk";
import type {
  PaymentProviderConfiguration as DbPaymentProviderConfiguration,
  ProviderEnvironmentValue,
} from "@voidhash/db";
import { ProviderEnvironment } from "@voidhash/db";
import { pick } from "@voidhash/lib/lang";
import { Context, Data, Effect, Layer, Option } from "effect";

import { AppStorePaymentProvider } from "./payment-provider.ts";

/** Apple returned transaction info without the signed payload we need to decode. */
export class AppStoreSignedTransactionMissingError extends Data.TaggedError(
  "AppStoreSignedTransactionMissingError",
)<{ readonly message: string }> {}

/** Canonical App Store transaction data accepted by the record engine. */
export interface AppStoreVerifiedTransaction {
  readonly decodedTransaction: JWSTransactionDecodedPayload;
  readonly providerEnvironment: ProviderEnvironmentValue;
}

/** External App Store fetch-and-verification boundary. */
export interface AppStoreTransactionVerifierShape {
  readonly verify: (input: {
    readonly configuration: DbPaymentProviderConfiguration;
    readonly transactionId: string;
  }) => Effect.Effect<AppStoreVerifiedTransaction, unknown>;
}

/** Verifies SDK-submitted transaction ids against canonical App Store state. */
export class AppStoreTransactionVerifier extends Context.Service<
  AppStoreTransactionVerifier,
  AppStoreTransactionVerifierShape
>()("core/AppStoreTransactionVerifier") {
  static readonly layer = Layer.effect(
    AppStoreTransactionVerifier,
    Effect.gen(function* () {
      const provider = yield* AppStorePaymentProvider;

      return AppStoreTransactionVerifier.of({
        verify: (input) =>
          Effect.gen(function* () {
            const sdkContext = yield* provider.buildSdkContextFromConfiguration(
              input.configuration,
            );
            const transactionInfoResult = yield* sdkContext.getTransactionInfo(input.transactionId);
            const signedTransactionInfo = Option.getOrUndefined(
              transactionInfoResult.transactionInfo.signedTransactionInfo,
            );
            if (!signedTransactionInfo) {
              return yield* Effect.fail(
                new AppStoreSignedTransactionMissingError({
                  message: "Signed transaction info is not found",
                }),
              );
            }

            const decodedTransaction = yield* sdkContext.decodeSignedTransaction(
              signedTransactionInfo,
              transactionInfoResult.environment,
            );

            return {
              decodedTransaction,
              providerEnvironment: pick(
                transactionInfoResult.environment === Environment.SANDBOX,
                ProviderEnvironment.Sandbox,
                ProviderEnvironment.Production,
              ),
            };
          }),
      });
    }),
  );
}
