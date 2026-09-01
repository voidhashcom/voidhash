import { SubscriptionStatus } from "@voidhash/lib";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import type * as Schema from "effect/Schema";

import {
  EntitlementSync,
  PurchaseEventPublisher,
  PurchaseIdGenerator,
  PurchaseLedgerWriteStore,
  PurchaseStateRepository,
  PurchaseUnitOfWork,
  PurchasePortError,
  type PurchaseLedgerReservation,
  type PurchaseLedgerWriteStoreShape,
  type PurchaseStateRepositoryShape,
  type PurchaseTransactionRecord,
} from "../../application/ports.ts";
import {
  PurchaseProcessingProductNotMappedError,
  PurchaseProcessingServiceError,
  type PurchaseProcessingError,
} from "../../application/ports/PurchaseStateStore.ts";
import type { RevenueEvent } from "../../contract/RevenueEvents.ts";
import type {
  CancelSubscriptionInput,
  CompleteOneTimePurchaseInput,
  ExpireSubscriptionInput,
  PurchaseActionContext,
  RenewSubscriptionInput,
  RevokeSubscriptionInput,
  StartSubscriptionInput,
} from "../../domain/PurchaseAction.ts";
import { PurchaseProcessingResult } from "../../domain/PurchaseProcessing.ts";
import {
  describePurchaseErrorCause,
  purchaseActionSpanAttributes,
  purchaseProcessingResultSpanAttributes,
  purchaseTypeFor,
  moneyFromStoredTransaction,
} from "../domain/PurchaseProcessingHelpers.ts";
import {
  toCanceledAnalyticsInputs,
  toExpiredAnalyticsInputs,
  toOneTimePurchaseAnalyticsInputs,
  toRenewedAnalyticsInputs,
  toRevokedAnalyticsInputs,
  toStartedAnalyticsInputs,
  type RevenueAnalyticsMapperContext,
} from "../domain/RevenueEventMapper.ts";
import { subscriptionStatusForInactiveEvent } from "../domain/PurchaseLifecycle.ts";
import {
  toPurchaseCompletedWebhookEvent,
  toSubscriptionCancelledWebhookEvent,
  toSubscriptionCreatedWebhookEvent,
  toSubscriptionExpiredWebhookEvent,
  toSubscriptionRenewedWebhookEvent,
  type WebhookEventMapperContext,
  type WebhookLifecycleEvent,
} from "../domain/WebhookEventMapper.ts";

type Action = typeof PurchaseActionContext.Type;
type WebhookBuilder = (() => WebhookLifecycleEvent) | typeof Schema.Null.Type;

interface ResolvedContext {
  readonly configurationProduct: {
    readonly id: string;
    readonly productId: string;
    readonly productSlug: string | typeof Schema.Null.Type;
    readonly providerProductKey: string;
  };
  readonly distinctId: string;
  readonly personId: string;
}

interface TransactionResult {
  readonly alreadyExisted: boolean;
  readonly id: Option.Option<string>;
}

interface StagedRevenueInput {
  readonly action: Action;
  readonly buildEvents: (context: RevenueAnalyticsMapperContext) => ReadonlyArray<RevenueEvent>;
  readonly buildResult: (eventIds: ReadonlyArray<string>) => PurchaseProcessingResult;
  readonly context: ResolvedContext;
  readonly ledger: PurchaseLedgerWriteStoreShape;
  readonly repository: PurchaseStateRepositoryShape;
  readonly reservation: PurchaseLedgerReservation;
}

export interface PurchaseLifecycleStateMachineShape {
  readonly startSubscription: (
    input: typeof StartSubscriptionInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly renewSubscription: (
    input: typeof RenewSubscriptionInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly cancelSubscription: (
    input: typeof CancelSubscriptionInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly expireSubscription: (
    input: typeof ExpireSubscriptionInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly revokeSubscription: (
    input: typeof RevokeSubscriptionInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly completeOneTimePurchase: (
    input: typeof CompleteOneTimePurchaseInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
}

const emptyResult = (personId: string) =>
  new PurchaseProcessingResult({
    analyticsEventIds: [],
    changedGrantIds: [],
    idempotent: false,
    personId,
    purchaseId: Option.none(),
    subscriptionId: Option.none(),
    transactionId: Option.none(),
  });

const makePurchaseLifecycleStateMachine = Effect.fn("makePurchaseLifecycleStateMachine")(
  function* () {
    const ids = yield* PurchaseIdGenerator;
    const repository = yield* PurchaseStateRepository;
    const unitOfWork = yield* PurchaseUnitOfWork;
    const publisher = yield* PurchaseEventPublisher;

    const resolveContext = (input: Action) =>
      Effect.gen(function* () {
        const configurationProduct = yield* repository.resolveConfigurationProduct(
          input.paymentProviderConfigurationProductId,
        );
        if (
          configurationProduct === undefined ||
          configurationProduct.productProjectId !== input.projectId ||
          configurationProduct.paymentProviderConfigurationId !==
            input.paymentProviderConfigurationId
        ) {
          return yield* new PurchaseProcessingProductNotMappedError({
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            paymentProviderConfigurationProductId: input.paymentProviderConfigurationProductId,
          });
        }
        const person = yield* repository.findPerson(input.personId);
        if (person === undefined || person.projectId !== input.projectId) {
          return yield* new PurchaseProcessingServiceError({
            cause: `Resolved person ${input.personId} not found for project ${input.projectId}`,
          });
        }
        return {
          configurationProduct: {
            id: configurationProduct.id,
            productId: configurationProduct.productId,
            productSlug: configurationProduct.productSlug,
            providerProductKey: configurationProduct.providerProductKey,
          },
          distinctId: person.primaryDistinctId ?? person.id,
          personId: person.id,
        } satisfies ResolvedContext;
      });

    const webhookContext = (context: ResolvedContext): WebhookEventMapperContext => ({
      distinctId: context.distinctId,
      productId: context.configurationProduct.productId,
      productSlug: context.configurationProduct.productSlug,
      providerProductId: context.configurationProduct.providerProductKey,
    });

    const publish = (projectId: string, builders: ReadonlyArray<WebhookBuilder>) =>
      Effect.forEach(
        builders,
        (build) => {
          if (build === null) return Effect.void;
          return Effect.sync(build).pipe(
            Effect.flatMap((event) => publisher.publish({ ...event, projectId })),
            Effect.catchCause((cause) =>
              Effect.logWarning("failed to publish purchase lifecycle event", { cause, projectId }),
            ),
          );
        },
        { discard: true, concurrency: 1 },
      );

    const reserve = (ledger: PurchaseLedgerWriteStoreShape, input: Action) =>
      ledger.reserve({
        id: ids.generate("purchaseLedger"),
        idempotencyKey: input.idempotencyKey,
        organizationId: input.organizationId,
        personId: input.personId,
        projectId: input.projectId,
        providerEventType: input.providerEventType,
        providerId: input.providerId,
        rawProviderPayload: Option.getOrNull(input.rawProviderPayload),
        source: input.source,
      });

    const stageRevenue = (input: StagedRevenueInput) =>
      Effect.gen(function* () {
        const mapping = yield* input.repository.resolveConfigurationProduct(
          input.action.paymentProviderConfigurationProductId,
        );
        if (
          mapping === undefined ||
          mapping.productProjectId !== input.action.projectId ||
          mapping.paymentProviderConfigurationId !== input.action.paymentProviderConfigurationId
        ) {
          return yield* new PurchaseProcessingServiceError({
            cause: `Revenue product mapping ${input.action.paymentProviderConfigurationProductId} is missing or outside project ${input.action.projectId}`,
          });
        }
        const [token, distinctId] = yield* Effect.all(
          [
            input.repository.findPublicApiToken(input.action.projectId),
            input.repository.resolveDistinctId(input.context.personId),
          ],
          { concurrency: 1 },
        );
        const events = input.buildEvents({
          distinctId,
          idempotencyKey: input.action.idempotencyKey,
          organizationId: input.action.organizationId,
          productId: mapping.productId,
          projectId: input.action.projectId,
          providerProductKey: mapping.providerProductKey,
          token: token ?? `vh_server_revenue_${input.action.projectId}`,
        });
        const result = input.buildResult(events.map((event) => event.eventId));
        yield* Effect.annotateCurrentSpan({
          ...purchaseProcessingResultSpanAttributes(result),
          "voidhash.analytics.event_count": events.length,
        });
        yield* input.ledger.stageEvents({
          events,
          reservation: input.reservation,
          result,
        });
        return result;
      });

    const findOrCreateTransaction = (
      txRepository: PurchaseStateRepositoryShape,
      input: {
        readonly action: Action;
        readonly context: ResolvedContext;
        readonly money: Option.Option<
          typeof import("../../domain/PurchaseProcessing.ts").PurchaseProcessingMoney.Type
        >;
      },
    ): Effect.Effect<TransactionResult, import("../../application/ports.ts").PurchasePortError> =>
      Effect.gen(function* () {
        if (Option.isNone(input.action.providerTransactionId)) {
          return { alreadyExisted: false, id: Option.none() };
        }
        const providerTransactionId = input.action.providerTransactionId.value;
        const existing = yield* txRepository.findTransactionByProviderTransactionId({
          paymentProviderConfigurationProductId: input.context.configurationProduct.id,
          storeTransactionId: providerTransactionId,
        });
        if (existing !== undefined) {
          return { alreadyExisted: true, id: Option.some(existing.id) };
        }
        const money = Option.getOrUndefined(input.money);
        const usd = Option.getOrUndefined(Option.flatMap(input.money, (value) => value.usd));
        const inserted = yield* txRepository.insertTransactionIfAbsent({
          amount: money?.grossAmount ?? 0,
          amountUsd: usd?.grossAmount ?? null,
          currency: money?.currency ?? "USD",
          exchangeRate: usd?.exchangeRate ?? null,
          grossAmount: money?.grossAmount ?? 0,
          grossAmountUsd: usd?.grossAmount ?? null,
          id: ids.generate("transaction"),
          lastEventOccurredAt: input.action.occurredAt,
          occurredAt: input.action.occurredAt,
          paymentProviderConfigurationProductId: input.context.configurationProduct.id,
          personId: input.context.personId,
          proceedsAfterTaxAmount: money?.proceedsAfterTaxAmount ?? 0,
          proceedsAfterTaxAmountUsd: usd?.proceedsAfterTaxAmount ?? null,
          proceedsAmount: money?.proceedsAmount ?? 0,
          proceedsAmountUsd: usd?.proceedsAmount ?? null,
          providerEnvironment: input.action.providerEnvironment,
          storeCommissionAmount: money?.storeCommissionAmount ?? 0,
          storeCommissionAmountUsd: usd?.storeCommissionAmount ?? null,
          storeTransactionId: providerTransactionId,
          storefront: Option.getOrNull(Option.flatMap(input.money, (value) => value.storefront)),
          taxAmount: money?.taxAmount ?? 0,
          taxAmountUsd: usd?.taxAmount ?? null,
        });
        return { alreadyExisted: !inserted.inserted, id: Option.some(inserted.row.id) };
      });

    const storeSubscriptionId = (input: Action) =>
      Option.firstSomeOf([input.providerSubscriptionId, input.providerTransactionId]);

    const subscriptionIdentifierError = (input: Action) =>
      new PurchaseProcessingServiceError({
        cause: `Subscription event has no subscription identifier (providerEventType=${input.providerEventType}, providerWebhookNotificationId=${Option.getOrElse(input.providerWebhookNotificationId, () => "—")})`,
      });

    const mapErrors = <
      A,
      E extends PurchaseProcessingError | import("../../application/ports.ts").PurchasePortError,
    >(
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

    const startSubscription = (input: typeof StartSubscriptionInput.Type) =>
      mapErrors(
        Effect.gen(function* () {
          yield* Effect.annotateCurrentSpan(purchaseActionSpanAttributes(input));
          const context = yield* resolveContext(input);
          const subscriptionKey = storeSubscriptionId(input);
          if (Option.isNone(subscriptionKey)) return yield* subscriptionIdentifierError(input);
          const outcome = yield* unitOfWork.transact(
            Effect.gen(function* () {
              const txRepository = yield* PurchaseStateRepository;
              const ledger = yield* PurchaseLedgerWriteStore;
              const entitlements = yield* EntitlementSync;
              const claim = yield* reserve(ledger, input);
              if (P.hasProperty(claim, "result")) return { events: [], result: claim.result };
              const transaction = yield* findOrCreateTransaction(txRepository, {
                action: input,
                context,
                money: input.money,
              });
              const inserted = yield* txRepository.insertSubscriptionIfAbsent({
                billingRetryAt: null,
                isCancelAtPeriodEnd: false,
                canceledAt: null,
                cancellationReason: null,
                expiresAt: Option.getOrNull(input.expiresAt),
                extendedTo: null,
                gracePeriodExpiresAt: null,
                id: ids.generate("subscription"),
                initialTransactionId: Option.getOrElse(
                  Option.firstSomeOf([input.providerSubscriptionId, input.providerTransactionId]),
                  () => subscriptionKey.value,
                ),
                isTrial: input.isTrial,
                lastEventOccurredAt: input.occurredAt,
                latestTransactionId: Option.getOrElse(
                  Option.firstSomeOf([input.providerTransactionId, input.providerSubscriptionId]),
                  () => subscriptionKey.value,
                ),
                paymentProviderConfigurationProductId: context.configurationProduct.id,
                pendingPriceAmount: null,
                pendingPriceCurrency: null,
                pendingPriceEffectiveAt: null,
                pendingProductChangeId: null,
                personId: context.personId,
                providerEnvironment: input.providerEnvironment,
                purchasedAt: input.purchasedAt,
                redeemedOfferAt: null,
                redeemedOfferId: null,
                startsAt: input.startsAt,
                status: SubscriptionStatus.Active,
                storeSubscriptionId: subscriptionKey.value,
              });
              const changedGrantIds = yield* entitlements.syncUnlockedPerks(context.personId);
              const result = yield* stageRevenue({
                action: input,
                buildEvents: (mapperContext) =>
                  toStartedAnalyticsInputs(
                    input,
                    { personId: context.personId, transactionId: transaction.id },
                    mapperContext,
                  ),
                buildResult: (analyticsEventIds) =>
                  new PurchaseProcessingResult({
                    analyticsEventIds,
                    changedGrantIds,
                    idempotent: !inserted.inserted || transaction.alreadyExisted,
                    personId: context.personId,
                    purchaseId: Option.none(),
                    subscriptionId: Option.some(inserted.row.id),
                    transactionId: transaction.id,
                  }),
                context,
                ledger,
                repository: txRepository,
                reservation: claim.reservation,
              });
              let event: WebhookBuilder = null;
              if (inserted.inserted) {
                event = () =>
                  toSubscriptionCreatedWebhookEvent(
                    input,
                    { purchasedAt: input.purchasedAt, subscriptionId: inserted.row.id },
                    webhookContext(context),
                  );
              }
              return { events: [event], result };
            }),
          );
          yield* publish(input.projectId, outcome.events);
          return outcome.result;
        }),
      );

    const renewSubscription = (input: typeof RenewSubscriptionInput.Type) =>
      mapErrors(
        Effect.gen(function* () {
          yield* Effect.annotateCurrentSpan(purchaseActionSpanAttributes(input));
          const context = yield* resolveContext(input);
          const subscriptionKey = storeSubscriptionId(input);
          if (Option.isNone(subscriptionKey)) return yield* subscriptionIdentifierError(input);
          const outcome = yield* unitOfWork.transact(
            Effect.gen(function* () {
              const txRepository = yield* PurchaseStateRepository;
              const ledger = yield* PurchaseLedgerWriteStore;
              const entitlements = yield* EntitlementSync;
              const claim = yield* reserve(ledger, input);
              if (P.hasProperty(claim, "result")) return { events: [], result: claim.result };
              const transaction = yield* findOrCreateTransaction(txRepository, {
                action: input,
                context,
                money: input.money,
              });
              const existing = yield* txRepository.findSubscriptionForRenewal({
                paymentProviderConfigurationProductId: context.configurationProduct.id,
                storeSubscriptionId: subscriptionKey.value,
              });
              let subscriptionId: string;
              let projectionAdvanced: boolean;
              let newlyInserted: boolean;
              if (existing === undefined) {
                const inserted = yield* txRepository.insertSubscriptionIfAbsent({
                  billingRetryAt: null,
                  isCancelAtPeriodEnd: false,
                  canceledAt: null,
                  cancellationReason: null,
                  expiresAt: Option.getOrNull(input.expiresAt),
                  extendedTo: null,
                  gracePeriodExpiresAt: null,
                  id: ids.generate("subscription"),
                  initialTransactionId: Option.getOrElse(
                    Option.firstSomeOf([input.providerSubscriptionId, input.providerTransactionId]),
                    () => subscriptionKey.value,
                  ),
                  isTrial: input.isTrial,
                  lastEventOccurredAt: input.occurredAt,
                  latestTransactionId: Option.getOrElse(
                    Option.firstSomeOf([input.providerTransactionId, input.providerSubscriptionId]),
                    () => subscriptionKey.value,
                  ),
                  paymentProviderConfigurationProductId: context.configurationProduct.id,
                  pendingPriceAmount: null,
                  pendingPriceCurrency: null,
                  pendingPriceEffectiveAt: null,
                  pendingProductChangeId: null,
                  personId: context.personId,
                  providerEnvironment: input.providerEnvironment,
                  purchasedAt: input.renewedAt,
                  redeemedOfferAt: null,
                  redeemedOfferId: null,
                  startsAt: input.startsAt,
                  status: SubscriptionStatus.Active,
                  storeSubscriptionId: subscriptionKey.value,
                });
                subscriptionId = inserted.row.id;
                projectionAdvanced = inserted.inserted;
                newlyInserted = inserted.inserted;
              } else {
                const completesProductChange =
                  existing.pendingProductChangeId === context.configurationProduct.id;
                const productChangePatch: {
                  paymentProviderConfigurationProductId?: string;
                  pendingProductChangeId?: null;
                } = {};
                if (completesProductChange) {
                  productChangePatch.paymentProviderConfigurationProductId =
                    context.configurationProduct.id;
                  productChangePatch.pendingProductChangeId = null;
                }
                const updated = yield* txRepository.updateSubscriptionIfFresher({
                  billingRetryAt: null,
                  isCancelAtPeriodEnd: false,
                  canceledAt: null,
                  expiresAt: Option.getOrNull(input.expiresAt),
                  gracePeriodExpiresAt: null,
                  id: existing.id,
                  isTrial: input.isTrial,
                  latestTransactionId: Option.getOrElse(
                    Option.firstSomeOf([input.providerTransactionId, input.providerSubscriptionId]),
                    () => subscriptionKey.value,
                  ),
                  occurredAt: input.occurredAt,
                  ...productChangePatch,
                  startsAt: input.startsAt,
                  status: SubscriptionStatus.Active,
                });
                if (updated.affectedRows === 0) {
                  yield* Effect.logInfo(
                    `renewSubscription: stale event; watermark guard rejected projection update (subscriptionId=${existing.id}, occurredAt=${input.occurredAt.toISOString()})`,
                  );
                }
                subscriptionId = existing.id;
                projectionAdvanced = updated.affectedRows > 0;
                newlyInserted = false;
              }
              const changedGrantIds = yield* entitlements.syncUnlockedPerks(context.personId);
              const result = yield* stageRevenue({
                action: input,
                buildEvents: (mapperContext) =>
                  toRenewedAnalyticsInputs(
                    input,
                    { personId: context.personId, transactionId: transaction.id },
                    mapperContext,
                  ),
                buildResult: (analyticsEventIds) =>
                  new PurchaseProcessingResult({
                    analyticsEventIds,
                    changedGrantIds,
                    idempotent: transaction.alreadyExisted,
                    personId: context.personId,
                    purchaseId: Option.none(),
                    subscriptionId: Option.some(subscriptionId),
                    transactionId: transaction.id,
                  }),
                context,
                ledger,
                repository: txRepository,
                reservation: claim.reservation,
              });
              const renewalAdvanced = projectionAdvanced && !transaction.alreadyExisted;
              let createdEvent: WebhookBuilder = null;
              if (renewalAdvanced && newlyInserted) {
                createdEvent = () =>
                  toSubscriptionCreatedWebhookEvent(
                    input,
                    { purchasedAt: input.renewedAt, subscriptionId },
                    webhookContext(context),
                  );
              }
              let renewedEvent: WebhookBuilder = null;
              if (renewalAdvanced) {
                renewedEvent = () =>
                  toSubscriptionRenewedWebhookEvent(
                    input,
                    { subscriptionId },
                    webhookContext(context),
                  );
              }
              return { events: [createdEvent, renewedEvent], result };
            }),
          );
          yield* publish(input.projectId, outcome.events);
          return outcome.result;
        }),
      );

    const mutateKnownSubscription = <I extends Action>(input: {
      readonly action: I;
      readonly buildEvents: (
        subscriptionId: string,
        mapperContext: RevenueAnalyticsMapperContext,
      ) => ReadonlyArray<RevenueEvent>;
      readonly buildWebhook: (
        existing: import("../../application/ports.ts").PurchaseSubscriptionRecord,
        updated: boolean,
        context: ResolvedContext,
      ) => WebhookBuilder;
      readonly methodName: "cancelSubscription" | "expireSubscription";
      readonly update: (
        existing: import("../../application/ports.ts").PurchaseSubscriptionRecord,
      ) => Omit<
        import("../../application/ports.ts").PurchaseSubscriptionUpdate,
        "id" | "occurredAt"
      >;
    }) =>
      mapErrors(
        Effect.gen(function* () {
          yield* Effect.annotateCurrentSpan(purchaseActionSpanAttributes(input.action));
          const context = yield* resolveContext(input.action);
          const subscriptionKey = storeSubscriptionId(input.action);
          if (Option.isNone(subscriptionKey)) {
            return yield* subscriptionIdentifierError(input.action);
          }
          const outcome = yield* unitOfWork.transact(
            Effect.gen(function* () {
              const txRepository = yield* PurchaseStateRepository;
              const ledger = yield* PurchaseLedgerWriteStore;
              const entitlements = yield* EntitlementSync;
              const claim = yield* reserve(ledger, input.action);
              if (P.hasProperty(claim, "result")) return { events: [], result: claim.result };
              const existing = yield* txRepository.findSubscriptionByStoreSubscriptionId({
                paymentProviderConfigurationProductId: context.configurationProduct.id,
                storeSubscriptionId: subscriptionKey.value,
              });
              if (existing === undefined) {
                const result = emptyResult(context.personId);
                yield* ledger.finalize({ reservation: claim.reservation, result });
                return { events: [], result };
              }
              const updated = yield* txRepository.updateSubscriptionIfFresher({
                ...input.update(existing),
                id: existing.id,
                occurredAt: input.action.occurredAt,
              });
              if (updated.affectedRows === 0) {
                yield* Effect.logInfo(
                  `${input.methodName}: stale event; watermark guard rejected projection update (subscriptionId=${existing.id}, occurredAt=${input.action.occurredAt.toISOString()})`,
                );
              }
              const changedGrantIds = yield* entitlements.syncUnlockedPerks(context.personId);
              const result = yield* stageRevenue({
                action: input.action,
                buildEvents: (mapperContext) => input.buildEvents(existing.id, mapperContext),
                buildResult: (analyticsEventIds) =>
                  new PurchaseProcessingResult({
                    analyticsEventIds,
                    changedGrantIds,
                    idempotent: false,
                    personId: context.personId,
                    purchaseId: Option.none(),
                    subscriptionId: Option.some(existing.id),
                    transactionId: Option.none(),
                  }),
                context,
                ledger,
                repository: txRepository,
                reservation: claim.reservation,
              });
              return {
                events: [
                  input.buildWebhook(existing, updated.affectedRows > 0, context),
                ] satisfies ReadonlyArray<WebhookBuilder>,
                result,
              };
            }),
          );
          yield* publish(input.action.projectId, outcome.events);
          return outcome.result;
        }),
      );

    const cancelSubscription = (input: typeof CancelSubscriptionInput.Type) =>
      mutateKnownSubscription({
        action: input,
        buildEvents: (subscriptionId, mapperContext) =>
          toCanceledAnalyticsInputs(
            { ...input, cancelAtPeriodEnd: input.isCancelAtPeriodEnd },
            { personId: input.personId, subscriptionId: Option.some(subscriptionId) },
            mapperContext,
          ),
        buildWebhook: (existing, updated, context) => {
          const alreadyCancelled =
            existing.canceledAt?.getTime() === input.canceledAt.getTime() &&
            existing.isCancelAtPeriodEnd === input.isCancelAtPeriodEnd;
          if (!updated || alreadyCancelled) return null;
          let status = existing.status;
          if (!input.isCancelAtPeriodEnd) status = subscriptionStatusForInactiveEvent();
          return () =>
            toSubscriptionCancelledWebhookEvent(
              input,
              { expiresAt: existing.expiresAt, status, subscriptionId: existing.id },
              webhookContext(context),
            );
        },
        methodName: "cancelSubscription",
        update: (existing) => {
          let status = existing.status;
          if (!input.isCancelAtPeriodEnd) status = subscriptionStatusForInactiveEvent();
          return {
            isCancelAtPeriodEnd: input.isCancelAtPeriodEnd,
            canceledAt: input.canceledAt,
            cancellationReason: Option.getOrNull(input.cancellationReason),
            status,
          };
        },
      });

    const expireSubscription = (input: typeof ExpireSubscriptionInput.Type) =>
      mutateKnownSubscription({
        action: input,
        buildEvents: (subscriptionId, mapperContext) =>
          toExpiredAnalyticsInputs(
            input,
            { personId: input.personId, subscriptionId: Option.some(subscriptionId) },
            mapperContext,
          ),
        buildWebhook: (existing, updated, context) => {
          const alreadyExpired =
            existing.status === subscriptionStatusForInactiveEvent() &&
            existing.expiresAt?.getTime() === input.expiredAt.getTime();
          if (!updated || alreadyExpired) return null;
          return () =>
            toSubscriptionExpiredWebhookEvent(
              input,
              { subscriptionId: existing.id },
              webhookContext(context),
            );
        },
        methodName: "expireSubscription",
        update: () => ({
          expiresAt: input.expiredAt,
          status: subscriptionStatusForInactiveEvent(),
        }),
      });

    const revokeSubscription = (input: typeof RevokeSubscriptionInput.Type) =>
      mapErrors(
        Effect.gen(function* () {
          yield* Effect.annotateCurrentSpan(purchaseActionSpanAttributes(input));
          const context = yield* resolveContext(input);
          const subscriptionKey = storeSubscriptionId(input);
          if (Option.isNone(subscriptionKey)) return yield* subscriptionIdentifierError(input);
          return yield* unitOfWork.transact(
            Effect.gen(function* () {
              const txRepository = yield* PurchaseStateRepository;
              const ledger = yield* PurchaseLedgerWriteStore;
              const entitlements = yield* EntitlementSync;
              const claim = yield* reserve(ledger, input);
              if (P.hasProperty(claim, "result")) return claim.result;
              const existing = yield* txRepository.findSubscriptionByStoreSubscriptionId({
                paymentProviderConfigurationProductId: context.configurationProduct.id,
                storeSubscriptionId: subscriptionKey.value,
              });
              if (existing === undefined) {
                const result = emptyResult(context.personId);
                yield* ledger.finalize({ reservation: claim.reservation, result });
                return result;
              }
              const subscriptionUpdate = yield* txRepository.updateSubscriptionIfFresher({
                canceledAt: input.revokedAt,
                cancellationReason: Option.getOrNull(input.revocationReason),
                expiresAt: input.revokedAt,
                id: existing.id,
                occurredAt: input.occurredAt,
                status: subscriptionStatusForInactiveEvent(),
              });
              if (subscriptionUpdate.affectedRows === 0) {
                yield* Effect.logInfo(
                  `revokeSubscription: stale event; watermark guard rejected subscription update (subscriptionId=${existing.id}, occurredAt=${input.occurredAt.toISOString()})`,
                );
              }
              let transaction: PurchaseTransactionRecord | typeof Schema.Undefined.Type;
              if (Option.isSome(input.providerTransactionId)) {
                transaction = yield* txRepository.findTransactionByProviderTransactionId({
                  paymentProviderConfigurationProductId: context.configurationProduct.id,
                  storeTransactionId: input.providerTransactionId.value,
                });
                if (transaction !== undefined) {
                  const transactionUpdate = yield* txRepository.updateTransactionIfFresher({
                    id: transaction.id,
                    occurredAt: input.occurredAt,
                    revocationReason: Option.getOrNull(input.revocationReason),
                    revokedAt: input.revokedAt,
                  });
                  if (transactionUpdate.affectedRows === 0) {
                    yield* Effect.logWarning(
                      `revokeSubscription: transaction watermark rejected (storeTransactionId=${input.providerTransactionId.value}, occurredAt=${input.occurredAt.toISOString()})`,
                    );
                  }
                } else {
                  yield* Effect.logWarning(
                    `revokeSubscription: no prior transaction row (storeTransactionId=${input.providerTransactionId.value}, occurredAt=${input.occurredAt.toISOString()})`,
                  );
                }
              }
              const changedGrantIds = yield* entitlements.syncUnlockedPerks(context.personId);
              let money = Option.none<ReturnType<typeof moneyFromStoredTransaction>>();
              if (transaction !== undefined) {
                money = Option.some(moneyFromStoredTransaction(transaction));
              }
              return yield* stageRevenue({
                action: input,
                buildEvents: (mapperContext) =>
                  toRevokedAnalyticsInputs(
                    {
                      ...input,
                      money,
                    },
                    { personId: context.personId, subscriptionId: Option.some(existing.id) },
                    mapperContext,
                  ),
                buildResult: (analyticsEventIds) =>
                  new PurchaseProcessingResult({
                    analyticsEventIds,
                    changedGrantIds,
                    idempotent: false,
                    personId: context.personId,
                    purchaseId: Option.none(),
                    subscriptionId: Option.some(existing.id),
                    transactionId: Option.none(),
                  }),
                context,
                ledger,
                repository: txRepository,
                reservation: claim.reservation,
              });
            }),
          );
        }),
      );

    const completeOneTimePurchase = (input: typeof CompleteOneTimePurchaseInput.Type) =>
      mapErrors(
        Effect.gen(function* () {
          yield* Effect.annotateCurrentSpan(purchaseActionSpanAttributes(input));
          const context = yield* resolveContext(input);
          const providerKey = Option.firstSomeOf([
            input.providerTransactionId,
            input.providerSubscriptionId,
          ]);
          if (Option.isNone(providerKey)) {
            return yield* new PurchaseProcessingServiceError({
              cause: `One-time purchase event has no provider identifier (providerTransactionId and providerSubscriptionId both absent; providerEventType=${input.providerEventType})`,
            });
          }
          const outcome = yield* unitOfWork.transact(
            Effect.gen(function* () {
              const txRepository = yield* PurchaseStateRepository;
              const ledger = yield* PurchaseLedgerWriteStore;
              const entitlements = yield* EntitlementSync;
              const claim = yield* reserve(ledger, input);
              if (P.hasProperty(claim, "result")) return { events: [], result: claim.result };
              const transaction = yield* findOrCreateTransaction(txRepository, {
                action: input,
                context,
                money: input.money,
              });
              const inserted = yield* txRepository.insertPurchaseIfAbsent({
                id: ids.generate("purchase"),
                lastEventOccurredAt: null,
                paymentProviderConfigurationProductId: context.configurationProduct.id,
                personId: context.personId,
                providerEnvironment: input.providerEnvironment,
                providerKey: providerKey.value,
                refundedAt: null,
                refundReason: null,
                revokedAt: null,
                revocationReason: null,
                type: purchaseTypeFor(input.purchaseType),
              });
              const changedGrantIds = yield* entitlements.syncUnlockedPerks(context.personId);
              const result = yield* stageRevenue({
                action: input,
                buildEvents: (mapperContext) =>
                  toOneTimePurchaseAnalyticsInputs(
                    input,
                    { personId: context.personId, transactionId: transaction.id },
                    mapperContext,
                  ),
                buildResult: (analyticsEventIds) =>
                  new PurchaseProcessingResult({
                    analyticsEventIds,
                    changedGrantIds,
                    idempotent: transaction.alreadyExisted || !inserted.inserted,
                    personId: context.personId,
                    purchaseId: Option.some(inserted.row.id),
                    subscriptionId: Option.none(),
                    transactionId: transaction.id,
                  }),
                context,
                ledger,
                repository: txRepository,
                reservation: claim.reservation,
              });
              let event: WebhookBuilder = null;
              if (inserted.inserted) {
                event = () =>
                  toPurchaseCompletedWebhookEvent(
                    input,
                    { providerKey: providerKey.value, purchaseId: inserted.row.id },
                    webhookContext(context),
                  );
              }
              return { events: [event], result };
            }),
          );
          yield* publish(input.projectId, outcome.events);
          return outcome.result;
        }),
      );

    return {
      cancelSubscription,
      completeOneTimePurchase,
      expireSubscription,
      renewSubscription,
      revokeSubscription,
      startSubscription,
    } satisfies PurchaseLifecycleStateMachineShape;
  },
)();

/** Core state-machine slice for subscription and one-time-purchase lifecycle actions. */
export class PurchaseLifecycleStateMachine extends Context.Service<
  PurchaseLifecycleStateMachine,
  PurchaseLifecycleStateMachineShape
>()("@voidhash/core-v2/purchases/PurchaseLifecycleStateMachine", {
  make: makePurchaseLifecycleStateMachine,
}) {
  static readonly layer = Layer.effect(PurchaseLifecycleStateMachine)(
    PurchaseLifecycleStateMachine.make,
  );
}
