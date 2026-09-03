import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type * as Schema from "effect/Schema";

import {
  PurchasePortError,
  type PurchaseIdGeneratorShape,
  type PurchaseLedgerReservation,
  type PurchaseLedgerReservationResult,
  type PurchaseLedgerWriteStoreShape,
  type PurchaseStateRepositoryShape,
  type PurchaseWebhookDelivery,
  type PurchaseWebhookDispatcherShape,
  type PurchaseWebhookOutboxShape,
} from "../../application/ports.ts";
import {
  PurchaseProcessingProductNotMappedError,
  PurchaseProcessingServiceError,
  type PurchaseProcessingError,
} from "../../application/ports/PurchaseStateStore.ts";
import type { RevenueEvent } from "../../contract/RevenueEvents.ts";
import type { PurchaseActionContext } from "../../domain/PurchaseAction.ts";
import { PurchaseProcessingResult } from "../../domain/PurchaseProcessing.ts";
import {
  describePurchaseErrorCause,
  purchaseProcessingResultSpanAttributes,
} from "../domain/PurchaseProcessingHelpers.ts";
import type { RevenueAnalyticsMapperContext } from "../domain/RevenueEventMapper.ts";
import type {
  WebhookEventMapperContext,
  WebhookLifecycleEvent,
} from "../domain/WebhookEventMapper.ts";

type Action = typeof PurchaseActionContext.Type;

/** Product mapping and person identity every provider-neutral action runs against. */
export interface ResolvedPurchaseContext {
  readonly configurationProduct: {
    readonly id: string;
    readonly productId: string;
    readonly productSlug: string | typeof Schema.Null.Type;
    readonly providerProductKey: string;
  };
  readonly distinctId: string;
  readonly personId: string;
}

/** A deferred webhook payload, or `null` when the transition changed nothing worth announcing. */
export type WebhookBuilder = (() => WebhookLifecycleEvent) | typeof Schema.Null.Type;

/** Result shape for actions whose subject does not exist yet: nothing applied, nothing emitted. */
export const emptyPurchaseResult = (personId: string) =>
  new PurchaseProcessingResult({
    analyticsEventIds: [],
    changedGrantIds: [],
    idempotent: false,
    personId,
    purchaseId: Option.none(),
    subscriptionId: Option.none(),
    transactionId: Option.none(),
  });

/** The provider-side subscription series identifier, falling back to the transaction id. */
export const storeSubscriptionIdOf = (input: Action) =>
  Option.firstSomeOf([input.providerSubscriptionId, input.providerTransactionId]);

/** The provider-side one-time purchase key, falling back to the subscription id. */
export const purchaseProviderKeyOf = (input: Action) =>
  Option.firstSomeOf([input.providerTransactionId, input.providerSubscriptionId]);

export const subscriptionIdentifierError = (input: Action) =>
  new PurchaseProcessingServiceError({
    cause: `Subscription event has no subscription identifier (providerEventType=${input.providerEventType}, providerWebhookNotificationId=${Option.getOrElse(input.providerWebhookNotificationId, () => "—")})`,
  });

/**
 * Validates that the configuration product belongs to the action's project
 * and provider configuration, then resolves the person. Runs outside the
 * transaction: a failure here never reserves a ledger row.
 */
export const resolvePurchaseContext = (
  repository: PurchaseStateRepositoryShape,
  input: Action,
): Effect.Effect<
  ResolvedPurchaseContext,
  PurchaseProcessingProductNotMappedError | PurchaseProcessingServiceError | PurchasePortError
> =>
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
      configurationProduct: {
        id: configurationProduct.id,
        productId: configurationProduct.productId,
        productSlug: configurationProduct.productSlug,
        providerProductKey: configurationProduct.providerProductKey,
      },
      distinctId: person.primaryDistinctId ?? person.id,
      personId: person.id,
    };
  });

export const webhookContextOf = (context: ResolvedPurchaseContext): WebhookEventMapperContext => ({
  distinctId: context.distinctId,
  productId: context.configurationProduct.productId,
  productSlug: context.configurationProduct.productSlug,
  providerProductId: context.configurationProduct.providerProductKey,
});

/** Claims the action's idempotency key in the outbox before any operational write. */
export const reservePurchaseLedgerRow = (
  ids: PurchaseIdGeneratorShape,
  ledger: PurchaseLedgerWriteStoreShape,
  input: Action,
): Effect.Effect<PurchaseLedgerReservationResult, PurchasePortError> =>
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

/**
 * Builds the analytics mapper context inside the transaction. The product
 * mapping is re-validated on the transaction handle so a mapping removed
 * between context resolution and commit rolls the action back instead of
 * booking revenue against a product that no longer exists.
 */
export const buildRevenueMapperContext = (
  repository: PurchaseStateRepositoryShape,
  input: {
    readonly idempotencyKey: string;
    readonly organizationId: string;
    readonly paymentProviderConfigurationId: string;
    readonly paymentProviderConfigurationProductId: string;
    readonly personId: string;
    readonly projectId: string;
  },
): Effect.Effect<
  RevenueAnalyticsMapperContext,
  PurchaseProcessingServiceError | PurchasePortError
> =>
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
    const token = yield* repository.findPublicApiToken(input.projectId);
    const distinctId = yield* repository.resolveDistinctId(input.personId);
    return {
      distinctId,
      idempotencyKey: input.idempotencyKey,
      organizationId: input.organizationId,
      productId: mapping.productId,
      projectId: input.projectId,
      providerProductKey: mapping.providerProductKey,
      token: token ?? `vh_server_revenue_${input.projectId}`,
    };
  });

/** Writes the mapped revenue events and final result onto the reserved ledger row. */
export const stagePurchaseLedgerRow = (
  ledger: PurchaseLedgerWriteStoreShape,
  reservation: PurchaseLedgerReservation,
  events: ReadonlyArray<RevenueEvent>,
  result: PurchaseProcessingResult,
): Effect.Effect<PurchaseProcessingResult, PurchasePortError> =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan({
      ...purchaseProcessingResultSpanAttributes(result),
      "voidhash.analytics.event_count": events.length,
    });
    yield* ledger.stageEvents({ events, reservation, result });
    return result;
  });

export interface StagePurchaseRevenueInput {
  readonly action: Action;
  readonly buildEvents: (context: RevenueAnalyticsMapperContext) => ReadonlyArray<RevenueEvent>;
  readonly buildResult: (eventIds: ReadonlyArray<string>) => PurchaseProcessingResult;
  readonly context: ResolvedPurchaseContext;
  readonly ledger: PurchaseLedgerWriteStoreShape;
  readonly repository: PurchaseStateRepositoryShape;
  readonly reservation: PurchaseLedgerReservation;
}

/** Maps, records and stages the revenue events for an action inside its transaction. */
export const stagePurchaseRevenue = (input: StagePurchaseRevenueInput) =>
  Effect.gen(function* () {
    const mapperContext = yield* buildRevenueMapperContext(input.repository, {
      ...input.action,
      personId: input.context.personId,
    });
    const events = input.buildEvents(mapperContext);
    const result = input.buildResult(events.map((event) => event.eventId));
    return yield* stagePurchaseLedgerRow(input.ledger, input.reservation, events, result);
  });

/** Collapses infrastructure failures into the processing error union callers handle. */
export const mapPurchasePortErrors = <A, E extends PurchaseProcessingError | PurchasePortError>(
  effect: Effect.Effect<A, E>,
): Effect.Effect<A, PurchaseProcessingError> =>
  effect.pipe(
    Effect.mapError((error): PurchaseProcessingError => {
      if (error instanceof PurchasePortError) {
        return new PurchaseProcessingServiceError({ cause: describePurchaseErrorCause(error) });
      }
      return error;
    }),
  );

/**
 * Stages lifecycle webhooks on the transaction's outbox. Runs inside the unit
 * of work so the delivery rows commit, or roll back, with the transition; a
 * `null` builder means the transition changed nothing worth announcing. A
 * payload builder that throws (an unencodable value in the action) drops only
 * that announcement: the webhook is a side channel and must never undo the
 * applied transition.
 */
export const stageLifecycleEvents = (
  outbox: PurchaseWebhookOutboxShape,
  projectId: string,
  builders: ReadonlyArray<WebhookBuilder>,
): Effect.Effect<ReadonlyArray<PurchaseWebhookDelivery>, PurchasePortError> =>
  Effect.forEach(
    builders,
    (build) => {
      if (build === null) return Effect.succeed<ReadonlyArray<PurchaseWebhookDelivery>>([]);
      return Effect.try(build).pipe(
        Effect.flatMap((event) => outbox.stage({ ...event, projectId })),
        Effect.catchTag("UnknownError", (error) =>
          Effect.logWarning("failed to build purchase lifecycle webhook payload; skipping it", {
            cause: error.cause,
            projectId,
          }).pipe(Effect.as<ReadonlyArray<PurchaseWebhookDelivery>>([])),
        ),
      );
    },
    { concurrency: 1 },
  ).pipe(Effect.map((staged) => staged.flat()));

/**
 * Hands committed delivery rows to the dispatcher. Best effort: the rows are
 * already durable, so a failure is logged and left to the delivery sweep
 * instead of failing the applied transition.
 */
export const dispatchLifecycleEvents = (
  dispatcher: PurchaseWebhookDispatcherShape,
  projectId: string,
  deliveries: ReadonlyArray<PurchaseWebhookDelivery>,
) => {
  if (Arr.isReadonlyArrayEmpty(deliveries)) return Effect.void;
  return dispatcher.dispatch(deliveries).pipe(
    Effect.catchCause((cause) =>
      Effect.logWarning(
        "failed to dispatch purchase lifecycle webhooks; leaving them to the sweep",
        {
          cause,
          deliveryIds: deliveries.map((delivery) => delivery.deliveryId),
          projectId,
        },
      ),
    ),
  );
};
