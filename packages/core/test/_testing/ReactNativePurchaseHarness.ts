import type { VoidhashCoreClient } from "@voidhash/generated-clients";
import { Data, Effect } from "effect";

import { CacheManager } from "../../../../libraries/react-native/src/core/caching/cache-manager.ts";
import type { Transaction } from "../../../../libraries/react-native/src/core/entities/transaction.ts";
import { bindReactNativeSdkClient } from "../../../../libraries/react-native/src/core/networking/api-client.ts";
import type { PlatformInfo } from "../../../../libraries/react-native/src/core/platform/platform-provider.ts";
import type {
  RuntimeProductDefinition,
  RuntimeSchema,
} from "../../../../libraries/react-native/src/core/schema/runtime.ts";
import { TransactionService } from "../../../../libraries/react-native/src/core/transactions/transaction-service.ts";
import {
  createEffectTestHarness,
  createInMemoryCacheAdapter,
} from "../../../../libraries/react-native/tests/helpers/effect-test-harness.ts";

export { Transaction } from "../../../../libraries/react-native/src/core/entities/transaction.ts";
export type { RuntimeSchema } from "../../../../libraries/react-native/src/core/schema/runtime.ts";

/** The transport failure {@link makeReactNativePurchaseHarness} injects on demand. */
class SimulatedSdkTransportError extends Data.TaggedError("SimulatedSdkTransportError")<{
  readonly message: string;
}> {}

interface ReactNativePurchaseHarnessOptions {
  readonly client: VoidhashCoreClient;
  readonly distinctId: string;
  readonly onAcknowledge?: (
    transaction: Transaction,
    productType: RuntimeProductDefinition["type"] | undefined,
  ) => Effect.Effect<void, unknown>;
  readonly pendingTransactions?: ReadonlyArray<Transaction>;
  readonly platform: Partial<PlatformInfo>;
  readonly purchaseHistory?: ReadonlyArray<Transaction>;
  readonly syncTransactionShouldFailTimes?: number;
}

/** Runs the real React Native transaction service against a generated HTTP client. */
export const makeReactNativePurchaseHarness = (options: ReactNativePurchaseHarnessOptions) => {
  const acknowledgedTransactions: Transaction[] = [];
  const state = { personRefreshAttempts: 0, syncTransactionAttempts: 0 };
  let remainingSyncFailures = options.syncTransactionShouldFailTimes ?? 0;
  const cache = createInMemoryCacheAdapter();
  const paymentAdapter = {
    acknowledgePurchase: (
      transaction: Transaction,
      productType: RuntimeProductDefinition["type"] | undefined,
    ) =>
      Effect.gen(function* () {
        acknowledgedTransactions.push(transaction);
        if (options.onAcknowledge) {
          yield* options.onAcknowledge(transaction, productType);
        }
      }),
    buyProduct: () => Effect.die("Direct native purchase must not run in restore harness"),
    endConnection: () => Effect.void,
    getPendingTransactions: () => Effect.succeed(options.pendingTransactions ?? []),
    getProducts: () => Effect.succeed([]),
    getPurchaseHistory: () => Effect.succeed(options.purchaseHistory ?? []),
    initConnection: () => Effect.void,
  };
  const boundClient = bindReactNativeSdkClient(options.client);
  const apiClient = {
    ...boundClient,
    sdk: {
      ...boundClient.sdk,
      getPerson: (request: Parameters<typeof boundClient.sdk.getPerson>[0]) => {
        state.personRefreshAttempts += 1;
        return boundClient.sdk.getPerson(request);
      },
      syncTransaction: (request: Parameters<typeof boundClient.sdk.syncTransaction>[0]) => {
        state.syncTransactionAttempts += 1;
        if (remainingSyncFailures > 0) {
          remainingSyncFailures -= 1;
          return Effect.fail(
            new SimulatedSdkTransportError({ message: "Simulated SDK transport failure" }),
          );
        }
        return boundClient.sdk.syncTransaction(request);
      },
    },
  };
  const harness = createEffectTestHarness({
    apiClient,
    cacheAdapter: cache.adapter,
    paymentAdapter,
    platform: options.platform,
    publishableKey: "pk_purchase_integration",
  });

  const initialize = harness.runtime.runPromise(
    Effect.gen(function* () {
      const cacheManager = yield* CacheManager;
      yield* cacheManager.set("distinctId", options.distinctId);
    }),
  );

  return {
    acknowledgedTransactions,
    dispose: () => harness.runtime.dispose(),
    initialize,
    process: (transaction: Transaction, schema: RuntimeSchema) =>
      harness.runtime.runPromise(
        Effect.flatMap(TransactionService, (service) =>
          service.processObservedTransaction(transaction, schema),
        ),
      ),
    restore: (schema: RuntimeSchema) =>
      harness.runtime.runPromise(
        Effect.flatMap(TransactionService, (service) => service.restorePurchases(schema)),
      ),
    state,
  };
};
