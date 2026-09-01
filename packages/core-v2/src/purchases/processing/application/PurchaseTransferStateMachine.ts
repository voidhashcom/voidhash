import { PurchaseType } from "@voidhash/lib";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Option from "effect/Option";

import {
  EntitlementSync,
  PurchaseIdGenerator,
  PurchaseLedgerWriteStore,
  PurchaseStateRepository,
  PurchaseUnitOfWork,
  type PurchaseLedgerWriteStoreShape,
  PurchasePortError,
  type PurchaseStateRepositoryShape,
} from "../../application/ports.ts";
import {
  PurchaseProcessingServiceError,
  type PurchaseProcessingError,
} from "../../application/ports/PurchaseStateStore.ts";
import type { RevenueEvent } from "../../contract/RevenueEvents.ts";
import type {
  TransferPurchaseInput,
  TransferSubscriptionInput,
} from "../../domain/PurchaseAction.ts";
import { PurchaseProcessingResult } from "../../domain/PurchaseProcessing.ts";
import {
  describePurchaseErrorCause,
  purchaseProcessingResultSpanAttributes,
  transferSpanAttributes,
} from "../domain/PurchaseProcessingHelpers.ts";
import {
  toPurchaseTransferredAnalyticsInputs,
  toSubscriptionTransferredAnalyticsInputs,
  type RevenueAnalyticsMapperContext,
} from "../domain/RevenueEventMapper.ts";

export interface PurchaseTransferStateMachineShape {
  readonly transferSubscription: (
    input: typeof TransferSubscriptionInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly transferPurchase: (
    input: typeof TransferPurchaseInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
}

const makePurchaseTransferStateMachine = Effect.fn("makePurchaseTransferStateMachine")(
  function* () {
  const ids = yield* PurchaseIdGenerator;
  const unitOfWork = yield* PurchaseUnitOfWork;

  const mapErrors = <A, E extends PurchaseProcessingError | PurchasePortError>(
    effect: Effect.Effect<A, E>,
  ) =>
    effect.pipe(
      Effect.mapError((error): PurchaseProcessingError => {
        if (error instanceof PurchasePortError) {
          return new PurchaseProcessingServiceError({ cause: describePurchaseErrorCause(error) });
        }
        return error;
      }),
    );

  const revenueContext = (
    repository: PurchaseStateRepositoryShape,
    input: {
      readonly idempotencyKey: string;
      readonly organizationId: string;
      readonly paymentProviderConfigurationId: string;
      readonly paymentProviderConfigurationProductId: string;
      readonly personId: string;
      readonly projectId: string;
    },
  ) =>
    Effect.gen(function* () {
      const mapping = yield* repository.resolveConfigurationProduct(
        input.paymentProviderConfigurationProductId,
      );
      if (
        mapping === undefined ||
        mapping.productProjectId !== input.projectId ||
        mapping.paymentProviderConfigurationId !== input.paymentProviderConfigurationId
      ) {
        return yield* new PurchaseProcessingServiceError({
          cause: `Revenue product mapping ${input.paymentProviderConfigurationProductId} is missing or outside project ${input.projectId}`,
        });
      }
      const [token, distinctId] = yield* Effect.all(
        [
          repository.findPublicApiToken(input.projectId),
          repository.resolveDistinctId(input.personId),
        ],
        { concurrency: 1 },
      );
      return {
        distinctId,
        idempotencyKey: input.idempotencyKey,
        organizationId: input.organizationId,
        productId: mapping.productId,
        projectId: input.projectId,
        providerProductKey: mapping.providerProductKey,
        token: token ?? `vh_server_revenue_${input.projectId}`,
      } satisfies RevenueAnalyticsMapperContext;
    });

  const reserveAndStage = (
    repository: PurchaseStateRepositoryShape,
    ledger: PurchaseLedgerWriteStoreShape,
    input: {
      readonly buildEvents: (context: RevenueAnalyticsMapperContext) => ReadonlyArray<RevenueEvent>;
      readonly buildResult: (eventIds: ReadonlyArray<string>) => PurchaseProcessingResult;
      readonly idempotencyKey: string;
      readonly organizationId: string;
      readonly paymentProviderConfigurationId: string;
      readonly paymentProviderConfigurationProductId: string;
      readonly personId: string;
      readonly projectId: string;
      readonly providerEventType: string;
      readonly providerId: string;
      readonly source: string;
    },
  ) =>
    Effect.gen(function* () {
      const claim = yield* ledger.reserve({
        id: ids.generate("purchaseLedger"),
        idempotencyKey: input.idempotencyKey,
        organizationId: input.organizationId,
        personId: input.personId,
        projectId: input.projectId,
        providerEventType: input.providerEventType,
        providerId: input.providerId,
        rawProviderPayload: null,
        source: input.source,
      });
      return yield* Match.value(claim).pipe(
        Match.when({ _tag: "duplicate" }, ({ result }) => Effect.succeed(result)),
        Match.when({ _tag: "reserved" }, ({ reservation }) =>
          Effect.gen(function* () {
            const mapperContext = yield* revenueContext(repository, input);
            const events = input.buildEvents(mapperContext);
            const result = input.buildResult(events.map((event) => event.eventId));
            yield* Effect.annotateCurrentSpan({
              ...purchaseProcessingResultSpanAttributes(result),
              "voidhash.analytics.event_count": events.length,
            });
            yield* ledger.stageEvents({ events, reservation, result });
            return result;
          }),
        ),
        Match.exhaustive,
      );
    });

  const transferSubscription = (input: typeof TransferSubscriptionInput.Type) =>
    mapErrors(
      Effect.gen(function* () {
        yield* Effect.annotateCurrentSpan(transferSpanAttributes(input));
        return yield* unitOfWork.transact(
          Effect.gen(function* () {
            const repository = yield* PurchaseStateRepository;
            const ledger = yield* PurchaseLedgerWriteStore;
            const entitlements = yield* EntitlementSync;
            const subscription = yield* repository.lockSubscriptionForUpdate(input.subscriptionId);
            if (subscription === undefined) {
              return yield* new PurchaseProcessingServiceError({
                cause: `transferSubscription: subscription ${input.subscriptionId} not found`,
              });
            }
            if (subscription.personId === input.toPersonId) {
              return new PurchaseProcessingResult({
                analyticsEventIds: [],
                changedGrantIds: [],
                idempotent: true,
                personId: input.toPersonId,
                purchaseId: Option.none(),
                subscriptionId: Option.some(subscription.id),
                transactionId: Option.none(),
              });
            }
            if (subscription.personId !== input.fromPersonId) {
              return yield* new PurchaseProcessingServiceError({
                cause: `transferSubscription: subscription ${subscription.id} is owned by ${subscription.personId}, expected ${input.fromPersonId}`,
              });
            }
            const keptResult = new PurchaseProcessingResult({
              analyticsEventIds: [],
              changedGrantIds: [],
              idempotent: false,
              personId: input.fromPersonId,
              purchaseId: Option.none(),
              subscriptionId: Option.some(subscription.id),
              transactionId: Option.none(),
            });
            if (input.transferMode === "keep_with_previous_owner") return keptResult;
            if (
              input.transferMode === "transfer_if_no_active_on_target" &&
              (yield* repository.countActiveSubscriptions(input.toPersonId)) > 0
            ) {
              return keptResult;
            }
            const updated = yield* repository.updateSubscriptionIfFresher({
              id: subscription.id,
              occurredAt: input.occurredAt,
              personId: input.toPersonId,
            });
            if (updated.affectedRows === 0) {
              yield* Effect.logInfo(
                `transferSubscription: stale event; watermark guard rejected ownership update (subscriptionId=${subscription.id}, occurredAt=${input.occurredAt.toISOString()})`,
              );
              return keptResult;
            }
            const [fromGrants, toGrants, fromDistinctId, toDistinctId] = yield* Effect.all(
              [
                entitlements.syncUnlockedPerks(input.fromPersonId),
                entitlements.syncUnlockedPerks(input.toPersonId),
                repository.resolveDistinctId(input.fromPersonId),
                repository.resolveDistinctId(input.toPersonId),
              ],
              { concurrency: 1 },
            );
            yield* Effect.annotateCurrentSpan({
              "voidhash.person.from_distinct_id": fromDistinctId,
              "voidhash.person.to_distinct_id": toDistinctId,
              "voidhash.subscription.id": subscription.id,
            });
            const idempotencyKey = `subscription_transfer:${subscription.id}:${input.fromPersonId}->${input.toPersonId}:${input.occurredAt.toISOString()}`;
            return yield* reserveAndStage(repository, ledger, {
              buildEvents: (mapperContext) =>
                toSubscriptionTransferredAnalyticsInputs(
                  {
                    fromDistinctId,
                    fromPersonId: input.fromPersonId,
                    occurredAt: input.occurredAt,
                    paymentProviderConfigurationId: input.paymentProviderConfigurationId,
                    providerId: input.providerId,
                    source: input.source,
                    subscription: {
                      id: subscription.id,
                      paymentProviderConfigurationProductId:
                        subscription.paymentProviderConfigurationProductId,
                      providerEnvironment: subscription.providerEnvironment,
                      storeSubscriptionId: subscription.storeSubscriptionId,
                    },
                    toDistinctId,
                    toPersonId: input.toPersonId,
                    transferMode: input.transferMode,
                    triggerReason: input.triggerReason,
                  },
                  mapperContext,
                ),
              buildResult: (analyticsEventIds) =>
                new PurchaseProcessingResult({
                  analyticsEventIds,
                  changedGrantIds: [...fromGrants, ...toGrants],
                  idempotent: false,
                  personId: input.toPersonId,
                  purchaseId: Option.none(),
                  subscriptionId: Option.some(subscription.id),
                  transactionId: Option.none(),
                }),
              idempotencyKey,
              organizationId: input.organizationId,
              paymentProviderConfigurationId: input.paymentProviderConfigurationId,
              paymentProviderConfigurationProductId:
                subscription.paymentProviderConfigurationProductId,
              personId: input.toPersonId,
              projectId: input.projectId,
              providerEventType: "subscription.transferred",
              providerId: input.providerId,
              source: input.source,
            });
          }),
        );
      }),
    );

  const transferPurchase = (input: typeof TransferPurchaseInput.Type) =>
    mapErrors(
      Effect.gen(function* () {
        yield* Effect.annotateCurrentSpan(transferSpanAttributes(input));
        return yield* unitOfWork.transact(
          Effect.gen(function* () {
            const repository = yield* PurchaseStateRepository;
            const ledger = yield* PurchaseLedgerWriteStore;
            const entitlements = yield* EntitlementSync;
            const purchase = yield* repository.lockPurchaseForUpdate(input.purchaseId);
            if (purchase === undefined) {
              return yield* new PurchaseProcessingServiceError({
                cause: `transferPurchase: purchase ${input.purchaseId} not found`,
              });
            }
            if (purchase.personId === input.toPersonId) {
              return new PurchaseProcessingResult({
                analyticsEventIds: [],
                changedGrantIds: [],
                idempotent: true,
                personId: input.toPersonId,
                purchaseId: Option.some(purchase.id),
                subscriptionId: Option.none(),
                transactionId: Option.none(),
              });
            }
            if (purchase.personId !== input.fromPersonId) {
              return yield* new PurchaseProcessingServiceError({
                cause: `transferPurchase: purchase ${purchase.id} is owned by ${purchase.personId}, expected ${input.fromPersonId}`,
              });
            }
            const keptResult = new PurchaseProcessingResult({
              analyticsEventIds: [],
              changedGrantIds: [],
              idempotent: false,
              personId: input.fromPersonId,
              purchaseId: Option.some(purchase.id),
              subscriptionId: Option.none(),
              transactionId: Option.none(),
            });
            if (purchase.type !== PurchaseType.OneTime) {
              yield* Effect.logInfo(
                `transferPurchase: purchase ${purchase.id} is not a non-consumable one-time purchase (type=${purchase.type}); skipping transfer`,
              );
              return keptResult;
            }
            if (purchase.refundedAt !== null || purchase.revokedAt !== null) {
              yield* Effect.logInfo(
                `transferPurchase: purchase ${purchase.id} is not active; skipping transfer`,
              );
              return keptResult;
            }
            if (input.transferMode === "keep_with_previous_owner") {
              return keptResult;
            }
            if (
              input.transferMode === "transfer_if_no_active_on_target" &&
              (yield* repository.countActivePurchases(input.toPersonId)) > 0
            ) {
              return keptResult;
            }
            const updated = yield* repository.updatePurchaseIfFresher({
              id: purchase.id,
              occurredAt: input.occurredAt,
              personId: input.toPersonId,
            });
            if (updated.affectedRows === 0) {
              yield* Effect.logInfo(
                `transferPurchase: stale event; watermark guard rejected ownership update (purchaseId=${purchase.id}, occurredAt=${input.occurredAt.toISOString()})`,
              );
              return keptResult;
            }
            const [fromGrants, toGrants, fromDistinctId, toDistinctId] = yield* Effect.all(
              [
                entitlements.syncUnlockedPerks(input.fromPersonId),
                entitlements.syncUnlockedPerks(input.toPersonId),
                repository.resolveDistinctId(input.fromPersonId),
                repository.resolveDistinctId(input.toPersonId),
              ],
              { concurrency: 1 },
            );
            yield* Effect.annotateCurrentSpan({
              "voidhash.person.from_distinct_id": fromDistinctId,
              "voidhash.person.to_distinct_id": toDistinctId,
              "voidhash.purchase.id": purchase.id,
            });
            const idempotencyKey = `purchase_transfer:${purchase.id}:${input.fromPersonId}->${input.toPersonId}:${input.occurredAt.toISOString()}`;
            return yield* reserveAndStage(repository, ledger, {
              buildEvents: (mapperContext) =>
                toPurchaseTransferredAnalyticsInputs(
                  {
                    fromDistinctId,
                    fromPersonId: input.fromPersonId,
                    occurredAt: input.occurredAt,
                    paymentProviderConfigurationId: input.paymentProviderConfigurationId,
                    providerId: input.providerId,
                    purchase: {
                      id: purchase.id,
                      paymentProviderConfigurationProductId:
                        purchase.paymentProviderConfigurationProductId,
                      providerEnvironment: purchase.providerEnvironment,
                      providerKey: purchase.providerKey,
                    },
                    source: input.source,
                    toDistinctId,
                    toPersonId: input.toPersonId,
                    transferMode: input.transferMode,
                    triggerReason: input.triggerReason,
                  },
                  mapperContext,
                ),
              buildResult: (analyticsEventIds) =>
                new PurchaseProcessingResult({
                  analyticsEventIds,
                  changedGrantIds: [...fromGrants, ...toGrants],
                  idempotent: false,
                  personId: input.toPersonId,
                  purchaseId: Option.some(purchase.id),
                  subscriptionId: Option.none(),
                  transactionId: Option.none(),
                }),
              idempotencyKey,
              organizationId: input.organizationId,
              paymentProviderConfigurationId: input.paymentProviderConfigurationId,
              paymentProviderConfigurationProductId: purchase.paymentProviderConfigurationProductId,
              personId: input.toPersonId,
              projectId: input.projectId,
              providerEventType: "purchase.transferred",
              providerId: input.providerId,
              source: input.source,
            });
          }),
        );
      }),
    );

  return { transferPurchase, transferSubscription } satisfies PurchaseTransferStateMachineShape;
  },
)();

/** Core state-machine slice for ownership transfers. */
export class PurchaseTransferStateMachine extends Context.Service<
  PurchaseTransferStateMachine,
  PurchaseTransferStateMachineShape
>()("@voidhash/core-v2/purchases/PurchaseTransferStateMachine", {
  make: makePurchaseTransferStateMachine,
}) {
  static readonly layer = Layer.effect(PurchaseTransferStateMachine)(
    PurchaseTransferStateMachine.make,
  );
}
