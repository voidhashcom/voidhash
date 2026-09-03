import {
  PurchaseActionContext as PurchaseActionContextSchema,
  PurchaseLifecycleStateMachine,
  PurchaseProcessor,
  PurchaseRefundStateMachine,
  PurchaseStateMachine,
  PurchaseStateStore,
  PurchaseSubscriptionMutationMachine,
  PurchaseTransferStateMachine,
  PurchaseWebhookDispatcher,
  type PurchaseStateStoreShape,
} from "@voidhash/core-v2";
export {
  PurchaseProcessingProductNotMappedError,
  PurchaseProcessingServiceError,
  purchaseProcessingResultKind,
} from "@voidhash/core-v2";
import { PerkGrantService } from "@voidhash/core/services/perkGrants/PerkGrantService";
import { WebhookDispatchService } from "@voidhash/core/services/webhookDispatch/WebhookDispatchService";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { DbPurchaseStateRepositoryLive } from "./DbPurchaseStateRepositoryLive.ts";
import {
  DbPurchaseUnitOfWorkLive,
  PurchaseIdGeneratorLive,
  PurchaseWebhookDispatcherLive,
} from "./DbPurchaseTransactionPortsLive.ts";

export type PurchaseActionContext = typeof PurchaseActionContextSchema.Type;

const PurchaseTransactionPortsLive = Layer.mergeAll(
  DbPurchaseStateRepositoryLive,
  DbPurchaseUnitOfWorkLive,
  PurchaseIdGeneratorLive,
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

/**
 * Compatibility service for callers that still resolve the former backend
 * state engine. Requires `Db`, `PerkGrantService`, `WebhookDispatchService`
 * (the webhook outbox, staged inside the purchase transaction) and
 * `PurchaseWebhookDispatcher` (post-commit dispatch of the staged rows).
 */
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

/** Live webhook outbox and post-commit dispatcher for purchase processing. */
export const PurchaseWebhooksLive = Layer.merge(
  WebhookDispatchService.layer,
  PurchaseWebhookDispatcherLive.pipe(Layer.provide(WebhookDispatchService.layer)),
);

/**
 * Test composition for the webhook seam: delivery rows are still staged in
 * the purchase transaction, but nothing is ever dispatched to the delivery
 * workflow.
 */
export const PurchaseWebhooksTestLive = Layer.merge(
  WebhookDispatchService.layer,
  PurchaseWebhookDispatcher.noop,
);

const DbPurchaseProcessingLive = PurchaseProcessingService.layer.pipe(
  Layer.provide(PerkGrantService.layer),
  Layer.provide(PurchaseWebhooksLive),
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
          Layer.provide(PurchaseWebhooksTestLive),
        ),
      ),
    ),
  ),
);
