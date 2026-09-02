import { SubscriptionStatus } from "@voidhash/lib";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";

import {
  EntitlementSync,
  PurchaseIdGenerator,
  PurchaseLedgerWriteStore,
  PurchasePortError,
  PurchaseStateRepository,
  PurchaseUnitOfWork,
  type PurchaseLedgerReservation,
  type PurchaseLedgerWriteStoreShape,
  type PurchaseStateRepositoryShape,
  type PurchaseSubscriptionUpdate,
} from "../../application/ports.ts";
import type {
  ChangeRenewalPreferenceInput,
  EnterBillingRetryInput,
  ExtendSubscriptionInput,
  PurchaseActionContext,
  RecordPriceIncreaseInput,
  RedeemOfferInput,
  ResumeAutoRenewInput,
} from "../../domain/PurchaseAction.ts";
import {
  PurchaseProcessingProductNotMappedError,
  PurchaseProcessingServiceError,
  type PurchaseProcessingError,
} from "../../application/ports/PurchaseStateStore.ts";
import { PurchaseProcessingResult } from "../../domain/PurchaseProcessing.ts";
import type { RevenueEvent } from "../../contract/RevenueEvents.ts";
import {
  describePurchaseErrorCause,
  purchaseActionSpanAttributes,
  purchaseProcessingResultSpanAttributes,
} from "../domain/PurchaseProcessingHelpers.ts";
import {
  toAutoRenewResumedAnalyticsInputs,
  toBillingRetryAnalyticsInputs,
  toExtendedAnalyticsInputs,
  toOfferRedeemedAnalyticsInputs,
  toPriceIncreaseAnalyticsInputs,
  toRenewalPreferenceChangeAnalyticsInputs,
  type RevenueAnalyticsMapperContext,
} from "../domain/RevenueEventMapper.ts";

type Action = typeof PurchaseActionContext.Type;
type SubscriptionPatch = Omit<PurchaseSubscriptionUpdate, "id" | "occurredAt">;

interface ResolvedContext {
  readonly configurationProduct: {
    readonly id: string;
    readonly productId: string;
    readonly providerProductKey: string;
  };
  readonly distinctId: string;
  readonly personId: string;
}

interface ApplyMutationInput<I extends Action> {
  readonly action: I;
  readonly buildEvents: (
    result: { readonly personId: string; readonly subscriptionId: Option.Option<string> },
    context: RevenueAnalyticsMapperContext,
  ) => ReadonlyArray<RevenueEvent>;
  readonly buildPatch: (existing: {
    readonly expiresAt: Option.Option<Date>;
    readonly id: string;
    readonly status: number;
  }) => SubscriptionPatch;
  readonly methodName: string;
  readonly syncPerksOnApply: boolean;
}

export interface PurchaseSubscriptionMutationMachineShape {
  readonly enterBillingRetry: (
    input: typeof EnterBillingRetryInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly extendSubscription: (
    input: typeof ExtendSubscriptionInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly changeRenewalPreference: (
    input: typeof ChangeRenewalPreferenceInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly redeemOffer: (
    input: typeof RedeemOfferInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly recordPriceIncrease: (
    input: typeof RecordPriceIncreaseInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly resumeAutoRenew: (
    input: typeof ResumeAutoRenewInput.Type,
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

const subscriptionIdentifierError = (input: Action) =>
  new PurchaseProcessingServiceError({
    cause: `Subscription event has no subscription identifier (providerEventType=${input.providerEventType}, providerWebhookNotificationId=${Option.getOrElse(input.providerWebhookNotificationId, () => "—")})`,
  });

const makePurchaseSubscriptionMutationMachine = Effect.fn(
  "makePurchaseSubscriptionMutationMachine",
)(function* () {
  const ids = yield* PurchaseIdGenerator;
  const repository = yield* PurchaseStateRepository;
  const unitOfWork = yield* PurchaseUnitOfWork;

  const resolveContext = (input: Action) =>
    Effect.gen(function* () {
      const configurationProduct = yield* repository.resolveConfigurationProduct(
        input.paymentProviderConfigurationProductId,
      );
      if (
        configurationProduct === undefined ||
        configurationProduct.productProjectId !== input.projectId ||
        configurationProduct.paymentProviderConfigurationId !== input.paymentProviderConfigurationId
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
        configurationProduct,
        distinctId: person.primaryDistinctId ?? person.id,
        personId: person.id,
      } satisfies ResolvedContext;
    });

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

  const revenueContext = (
    txRepository: PurchaseStateRepositoryShape,
    action: Action,
    context: ResolvedContext,
  ) =>
    Effect.gen(function* () {
      const mapping = yield* txRepository.resolveConfigurationProduct(
        action.paymentProviderConfigurationProductId,
      );
      if (
        mapping === undefined ||
        mapping.productProjectId !== action.projectId ||
        mapping.paymentProviderConfigurationId !== action.paymentProviderConfigurationId
      ) {
        return yield* new PurchaseProcessingServiceError({
          cause: `Revenue product mapping ${action.paymentProviderConfigurationProductId} is missing or outside project ${action.projectId}`,
        });
      }
      const token = yield* txRepository.findPublicApiToken(action.projectId);
      const distinctId = yield* txRepository.resolveDistinctId(context.personId);
      return {
        distinctId,
        idempotencyKey: action.idempotencyKey,
        organizationId: action.organizationId,
        productId: mapping.productId,
        projectId: action.projectId,
        providerProductKey: mapping.providerProductKey,
        token: token ?? `vh_server_revenue_${action.projectId}`,
      } satisfies RevenueAnalyticsMapperContext;
    });

  const stage = (
    ledger: PurchaseLedgerWriteStoreShape,
    reservation: PurchaseLedgerReservation,
    events: ReadonlyArray<RevenueEvent>,
    result: PurchaseProcessingResult,
  ) =>
    Effect.gen(function* () {
      yield* Effect.annotateCurrentSpan({
        ...purchaseProcessingResultSpanAttributes(result),
        "voidhash.analytics.event_count": events.length,
      });
      yield* ledger.stageEvents({ events, reservation, result });
      return result;
    });

  const applyMutation = <I extends Action>(input: ApplyMutationInput<I>) =>
    Effect.gen(function* () {
      yield* Effect.annotateCurrentSpan(purchaseActionSpanAttributes(input.action));
      const context = yield* resolveContext(input.action);
      const storeSubscriptionId = Option.firstSomeOf([
        input.action.providerSubscriptionId,
        input.action.providerTransactionId,
      ]);
      if (Option.isNone(storeSubscriptionId)) {
        return yield* subscriptionIdentifierError(input.action);
      }

      return yield* unitOfWork.transact(
        Effect.gen(function* () {
          const txRepository = yield* PurchaseStateRepository;
          const ledger = yield* PurchaseLedgerWriteStore;
          const entitlements = yield* EntitlementSync;
          const claim = yield* reserve(ledger, input.action);
          if (P.hasProperty(claim, "result")) return claim.result;

          const existing = yield* txRepository.findSubscriptionByStoreSubscriptionId({
            paymentProviderConfigurationProductId: context.configurationProduct.id,
            storeSubscriptionId: storeSubscriptionId.value,
          });
          if (existing === undefined) {
            const result = emptyResult(context.personId);
            yield* ledger.finalize({ reservation: claim.reservation, result });
            return result;
          }

          const updated = yield* txRepository.updateSubscriptionIfFresher({
            ...input.buildPatch({
              ...existing,
              expiresAt: Option.fromNullishOr(existing.expiresAt),
            }),
            id: existing.id,
            occurredAt: input.action.occurredAt,
          });
          if (updated.affectedRows === 0) {
            yield* Effect.logInfo(
              `${input.methodName}: stale event; watermark guard rejected projection update (subscriptionId=${existing.id}, occurredAt=${input.action.occurredAt.toISOString()})`,
            );
          }
          let changedGrantIds: ReadonlyArray<string> = [];
          if (input.syncPerksOnApply) {
            changedGrantIds = yield* entitlements.syncUnlockedPerks(context.personId);
          }
          const mapperContext = yield* revenueContext(txRepository, input.action, context);
          const events = input.buildEvents(
            { personId: context.personId, subscriptionId: Option.some(existing.id) },
            mapperContext,
          );
          const result = new PurchaseProcessingResult({
            analyticsEventIds: events.map((event) => event.eventId),
            changedGrantIds,
            idempotent: false,
            personId: context.personId,
            purchaseId: Option.none(),
            subscriptionId: Option.some(existing.id),
            transactionId: Option.none(),
          });
          return yield* stage(ledger, claim.reservation, events, result);
        }),
      );
    }).pipe(
      Effect.mapError((error) => {
        if (error instanceof PurchasePortError) {
          return new PurchaseProcessingServiceError({ cause: describePurchaseErrorCause(error) });
        }
        return error;
      }),
    );

  return {
    changeRenewalPreference: (input) =>
      applyMutation({
        action: input,
        buildEvents: (result, context) =>
          toRenewalPreferenceChangeAnalyticsInputs(input, result, context),
        buildPatch: () =>
          Option.match(input.newPaymentProviderConfigurationProductId, {
            onNone: () => ({}),
            onSome: (pendingProductChangeId) => ({ pendingProductChangeId }),
          }),
        methodName: "changeRenewalPreference",
        syncPerksOnApply: false,
      }),
    enterBillingRetry: (input) =>
      applyMutation({
        action: input,
        buildEvents: (result, context) => toBillingRetryAnalyticsInputs(input, result, context),
        buildPatch: () => ({
          billingRetryAt: input.billingRetryAt,
          gracePeriodExpiresAt: Option.getOrNull(input.gracePeriodExpiresAt),
        }),
        methodName: "enterBillingRetry",
        syncPerksOnApply: false,
      }),
    extendSubscription: (input) =>
      applyMutation({
        action: input,
        buildEvents: (result, context) => toExtendedAnalyticsInputs(input, result, context),
        buildPatch: () => ({ expiresAt: input.extendedTo, extendedTo: input.extendedTo }),
        methodName: "extendSubscription",
        syncPerksOnApply: false,
      }),
    recordPriceIncrease: (input) => {
      const money = Option.getOrUndefined(input.money);
      return applyMutation({
        action: input,
        buildEvents: (result, context) => toPriceIncreaseAnalyticsInputs(input, result, context),
        buildPatch: () => ({
          pendingPriceAmount: money?.grossAmount ?? null,
          pendingPriceCurrency: money?.currency ?? null,
          pendingPriceEffectiveAt: Option.getOrNull(input.effectiveAt),
        }),
        methodName: "recordPriceIncrease",
        syncPerksOnApply: false,
      });
    },
    redeemOffer: (input) =>
      applyMutation({
        action: input,
        buildEvents: (result, context) => toOfferRedeemedAnalyticsInputs(input, result, context),
        buildPatch: () => ({
          redeemedOfferAt: input.redeemedAt,
          redeemedOfferId: Option.getOrNull(input.offerId),
        }),
        methodName: "redeemOffer",
        syncPerksOnApply: false,
      }),
    resumeAutoRenew: (input) =>
      applyMutation({
        action: input,
        buildEvents: (result, context) => toAutoRenewResumedAnalyticsInputs(input, result, context),
        buildPatch: (existing) => {
          const periodStillRunning =
            Option.isNone(existing.expiresAt) ||
            existing.expiresAt.value.getTime() > input.occurredAt.getTime();
          const patch = {
            cancelAtPeriodEnd: false,
            canceledAt: null,
            cancellationReason: null,
          };
          if (periodStillRunning) return { ...patch, status: SubscriptionStatus.Active };
          return patch;
        },
        methodName: "resumeAutoRenew",
        syncPerksOnApply: true,
      }),
  } satisfies PurchaseSubscriptionMutationMachineShape;
})();

/** Core state-machine slice for subscription metadata transitions. */
export class PurchaseSubscriptionMutationMachine extends Context.Service<
  PurchaseSubscriptionMutationMachine,
  PurchaseSubscriptionMutationMachineShape
>()("@voidhash/core-v2/purchases/PurchaseSubscriptionMutationMachine", {
  make: makePurchaseSubscriptionMutationMachine,
}) {
  static readonly layer = Layer.effect(PurchaseSubscriptionMutationMachine)(
    PurchaseSubscriptionMutationMachine.make,
  );
}
