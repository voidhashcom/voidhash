import {
  PurchaseActionContext as PurchaseActionContextSchema,
  PurchaseLifecycleStateMachine,
  PurchaseProcessor,
  PurchaseRefundStateMachine,
  PurchaseStateMachine,
  PurchaseStateStore,
  PurchaseSubscriptionMutationMachine,
  PurchaseTransferStateMachine,
  type PurchaseStateStoreShape,
} from "@voidhash/core-v2";
export {
  PurchaseProcessingProductNotMappedError,
  PurchaseProcessingServiceError,
  purchaseProcessingResultKind,
} from "@voidhash/core-v2";
import { PerkGrantService } from "@voidhash/core/services/perkGrants/PerkGrantService";
import { WebhookDispatchService } from "@voidhash/core/services/webhookDispatch/WebhookDispatchService";
import { WebhookEventPublisher } from "@voidhash/core/services/webhookDispatch/WebhookEventPublisher";
import { Context, Effect, Layer } from "effect";

import { DbPurchaseStateRepositoryLive } from "./DbPurchaseStateRepositoryLive.ts";
import {
  DbPurchaseUnitOfWorkLive,
  PurchaseEventPublisherLive,
  PurchaseIdGeneratorLive,
} from "./DbPurchaseTransactionPortsLive.ts";

export type PurchaseActionContext = typeof PurchaseActionContextSchema.Type;

const PurchaseTransactionPortsLive = Layer.mergeAll(
  DbPurchaseStateRepositoryLive,
  DbPurchaseUnitOfWorkLive,
  PurchaseIdGeneratorLive,
  PurchaseEventPublisherLive,
);

const PurchaseLifecycleStateMachineLive = PurchaseLifecycleStateMachine.layer.pipe(
  Layer.provide(PurchaseTransactionPortsLive),
);

const PurchaseRefundStateMachineLive = PurchaseRefundStateMachine.layer.pipe(
  Layer.provide(PurchaseTransactionPortsLive),
);

const PurchaseSubscriptionMutationMachineLive = PurchaseSubscriptionMutationMachine.layer.pipe(
  Layer.provide(PurchaseTransactionPortsLive),
);

const PurchaseTransferStateMachineLive = PurchaseTransferStateMachine.layer.pipe(
  Layer.provide(PurchaseTransactionPortsLive),
);

const DbPurchaseStateMachineLive = PurchaseStateMachine.layer.pipe(
  Layer.provide(PurchaseLifecycleStateMachineLive),
  Layer.provide(PurchaseRefundStateMachineLive),
  Layer.provide(PurchaseSubscriptionMutationMachineLive),
  Layer.provide(PurchaseTransferStateMachineLive),
);

/** Compatibility service for callers that still resolve the former backend state engine. */
export class PurchaseProcessingService extends Context.Service<
  PurchaseProcessingService,
  PurchaseStateStoreShape
>()("@voidhash/backend/purchases/PurchaseProcessingService") {
  static readonly layer = Layer.effect(
    PurchaseProcessingService,
    Effect.gen(function* () {
      return PurchaseProcessingService.of(yield* PurchaseStateMachine);
    }),
  ).pipe(Layer.provide(DbPurchaseStateMachineLive));
}

/** Thin adapter preserving the existing `PurchaseStateStore` application seam. */
export const DbPurchaseStateStoreAdapterLive = Layer.effect(
  PurchaseStateStore,
  Effect.gen(function* () {
    return PurchaseStateStore.of(yield* PurchaseProcessingService);
  }),
);

const DbPurchaseProcessingLive = PurchaseProcessingService.layer.pipe(
  Layer.provide(PerkGrantService.layer),
  Layer.provide(WebhookEventPublisher.layer.pipe(Layer.provide(WebhookDispatchService.layer))),
);

/** Transactional PostgreSQL purchase state adapter with live webhook publication. */
export const DbPurchaseStateStoreLive = DbPurchaseStateStoreAdapterLive.pipe(
  Layer.provide(DbPurchaseProcessingLive),
);

/** Test composition that isolates outbound webhooks while retaining real state writes. */
export const PurchaseProcessorTestLive = PurchaseProcessor.layer.pipe(
  Layer.provide(
    DbPurchaseStateStoreAdapterLive.pipe(
      Layer.provide(
        PurchaseProcessingService.layer.pipe(
          Layer.provide(PerkGrantService.layer),
          Layer.provide(WebhookEventPublisher.noop),
        ),
      ),
    ),
  ),
);
