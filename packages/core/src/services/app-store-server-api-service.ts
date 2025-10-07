import {
  APIException,
  Environment as AppStoreEnvironment,
  AppStoreServerAPIClient,
  SignedDataVerifier,
  type TransactionInfoResponse,
  VerificationException
} from '@apple/app-store-server-library';
import { Data, Effect } from 'effect';
import {
  APPLE_ROOT_CA_G2,
  APPLE_ROOT_CA_G3,
  APPLE_ROOT_CERTIFICATE
} from '../payment-providers/app-store/constants';
import {
  AppStoreRateLimitExceededError,
  AppStoreSignedTransactionInfoNotFoundError,
  AppStoreTransactionNotFoundError,
  AppStoreUnauthorizedError,
  AppStoreVerificationException
} from '../utils/apple-app-store-api';

export type TransactionInfoResult = {
  environment: 'production' | 'sandbox';
  transactionInfo: TransactionInfoResponse;
};

export class AppStoreGeneralError extends Data.TaggedError(
  'AppStoreGeneralError'
)<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class AppStoreServerAPIService extends Effect.Service<AppStoreServerAPIService>()(
  'AppStoreServerAPIService',
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      return {
        initializeSdk: ({
          privateKey,
          keyId,
          issuerId,
          bundleId
        }: {
          privateKey: string;
          keyId: string;
          issuerId: string;
          bundleId: string;
        }) =>
          Effect.gen(function* () {
            const createClient = (environment: 'production' | 'sandbox') =>
              new AppStoreServerAPIClient(
                privateKey,
                keyId,
                issuerId,
                bundleId,
                environment === 'production'
                  ? AppStoreEnvironment.PRODUCTION
                  : AppStoreEnvironment.SANDBOX
              );

            const getTransactionInfoFn = (
              transactionId: string,
              environment: 'production' | 'sandbox'
            ) =>
              Effect.tryPromise({
                try: async () => {
                  Effect.logDebug('Getting transaction info', {
                    transactionId,
                    environment
                  });
                  const client = createClient(environment);
                  const transactionInf =
                    await client.getTransactionInfo(transactionId);
                  return {
                    environment,
                    transactionInfo: transactionInf
                  };
                },
                catch: (cause) => {
                  if (cause instanceof APIException) {
                    if (cause.httpStatusCode === 404) {
                      Effect.logDebug('Transaction not found', {
                        transactionId,
                        environment
                      });
                      return new AppStoreTransactionNotFoundError({
                        transactionId
                      });
                    }

                    if (cause.httpStatusCode === 401) {
                      Effect.logDebug('Unauthorized', {
                        transactionId,
                        environment
                      });
                      return new AppStoreUnauthorizedError({
                        message: 'Unauthorized'
                      });
                    }

                    if (cause.httpStatusCode === 429) {
                      Effect.logDebug('Rate limit exceeded', {
                        transactionId,
                        environment
                      });
                      return new AppStoreRateLimitExceededError({
                        message: 'Rate limit exceeded'
                      });
                    }

                    return new AppStoreGeneralError({
                      message:
                        cause.errorMessage ??
                        'Failed to execute App Store Server API',
                      cause
                    });
                  }

                  return new AppStoreGeneralError({
                    message: 'Failed to execute App Store Server API',
                    cause
                  });
                }
              });

            return {
              /**
               * Gets the transaction info from the App Store Server API
               * @param transactionId - The transaction ID
               * @returns The transaction info
               */
              getTransactionInfo: (transactionId: string) =>
                getTransactionInfoFn(transactionId, 'production').pipe(
                  Effect.catchTag('AppStoreTransactionNotFoundError', () =>
                    getTransactionInfoFn(transactionId, 'sandbox')
                  )
                ),

              /**
               * Decodes the transaction using the App Store Server API
               * @param transactionInfoResult - The transaction info result
               * @returns The decoded transaction
               */
              decodeTransaction: (
                transactionInfoResult: TransactionInfoResult
              ) =>
                Effect.gen(function* () {
                  Effect.logDebug('Decoding transaction');
                  const appleRootCertificate = Buffer.from(
                    APPLE_ROOT_CERTIFICATE,
                    'base64'
                  );
                  const appleRootCertificate2 = Buffer.from(
                    APPLE_ROOT_CA_G2,
                    'base64'
                  );
                  const appleRootCertificate3 = Buffer.from(
                    APPLE_ROOT_CA_G3,
                    'base64'
                  );
                  const certificates = [
                    appleRootCertificate,
                    appleRootCertificate2,
                    appleRootCertificate3
                  ];

                  const verifier = new SignedDataVerifier(
                    certificates,
                    true,
                    transactionInfoResult.environment === 'production'
                      ? AppStoreEnvironment.PRODUCTION
                      : AppStoreEnvironment.SANDBOX,
                    bundleId
                  );

                  const signedTransactionInfo =
                    transactionInfoResult.transactionInfo.signedTransactionInfo;

                  if (!signedTransactionInfo) {
                    Effect.logDebug('Signed transaction info is not found');
                    return yield* Effect.fail(
                      new AppStoreSignedTransactionInfoNotFoundError({
                        message: 'Signed transaction info is not found'
                      })
                    );
                  }

                  return yield* Effect.tryPromise({
                    try: () => {
                      return verifier.verifyAndDecodeTransaction(
                        signedTransactionInfo
                      );
                    },
                    catch: (cause) => {
                      if (cause instanceof VerificationException) {
                        Effect.logDebug('Verification exception', {
                          cause
                        });
                        return new AppStoreVerificationException({
                          message: 'Failed to decode transaction'
                        });
                      }

                      return new AppStoreGeneralError({
                        message: 'Failed to decode transaction',
                        cause
                      });
                    }
                  });
                })
            };
          })
      };
    })
  }
) {}
