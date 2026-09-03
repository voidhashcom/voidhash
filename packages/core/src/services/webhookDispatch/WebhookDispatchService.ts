import * as Arr from "effect/Array";
import { constant } from "@voidhash/lib/lang";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Workflow from "@voidhash/platform/Workflow";
import type { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import type { WorkflowRunner } from "@voidhash/platform/WorkflowRunner";

import {
  Db,
  type Database,
  type DbTransaction,
  WebhookDeliveryStatus,
  WebhookEndpointStatus,
  webhookDeliveries,
} from "@voidhash/db";
import { DeliverWebhook } from "@voidhash/core-v2";
import { generateId } from "../../utils/generate-id.ts";
import { WebhookServiceError } from "../webhookManager/WebhookManagerService.ts";
import type { WebhookEventType } from "../webhookManager/event-types.ts";

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/** One lifecycle event to fan out to a project's subscribed endpoints. */
export interface WebhookDispatchInput {
  readonly projectId: string;
  readonly eventType: WebhookEventType;
  readonly payload: object;
}

/**
 * A delivery row written by {@link WebhookDispatchService.stage}, carrying
 * everything the delivery workflow needs so dispatch never has to re-read a
 * row that may not be committed yet.
 */
export interface StagedWebhookDelivery {
  readonly deliveryId: string;
  readonly endpointId: string;
  readonly eventType: string;
  readonly payload: unknown;
  readonly url: string;
}

/**
 * Producer side of outbound webhooks. Delivery rows are the outbox: `stage`
 * writes one per subscribed endpoint on the caller's database handle (so a
 * caller inside a transaction commits them together with the state change
 * that produced them), and `dispatch` starts `DeliverWebhookWorkflow` for
 * rows that are already durable. A dispatch that is lost leaves the row
 * `Pending`, which the periodic delivery sweep re-dispatches.
 */
export class WebhookDispatchService extends Context.Service<WebhookDispatchService>()(
  "WebhookDispatchService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;

      const stage = Effect.fn("webhookDispatch.stage")(
        function* (handle: Database | DbTransaction, input: WebhookDispatchInput) {
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.webhook.event_type", input.eventType);

          // Reject a non-serializable `payload` up front. It is written to the
          // jsonb `payload` column, where drizzle's codec `JSON.stringify`s it
          // while building the insert SQL — a circular/unserializable payload
          // makes that throw a synchronous `TypeError` that Effect surfaces as a
          // defect, not the `EffectDrizzleQueryError` the catch below maps. Guard
          // here so it fails as a typed `WebhookServiceError` before any delivery
          // row is written, instead of escaping as an unhandled defect.
          yield* Effect.try({
            try: () => encodeJson(input.payload),
            catch: (cause) =>
              new WebhookServiceError({
                cause: `Failed to emit webhook event: ${String(cause)}`,
              }),
          });

          const endpoints = yield* handle.query.webhookEndpoints.findMany({
            where: {
              projectId: input.projectId,
              status: WebhookEndpointStatus.Active,
            },
          });

          const subscribedEndpoints = endpoints.filter((endpoint) =>
            endpoint.events.includes(input.eventType),
          );

          yield* Effect.annotateCurrentSpan(
            "voidhash.webhook.endpoint.count",
            subscribedEndpoints.length,
          );

          if (Arr.isReadonlyArrayEmpty(subscribedEndpoints)) {
            yield* Effect.logDebug(
              `No webhook endpoints subscribed to ${input.eventType} for project ${input.projectId}`,
            );
            return [];
          }

          const eventOccurredAt = yield* DateTime.nowAsDate;
          return yield* Effect.forEach(
            subscribedEndpoints,
            Effect.fn("webhookDispatch.stageForEndpoint")(function* (endpoint) {
              const deliveryId = generateId("webhookDelivery");
              yield* handle.insert(webhookDeliveries).values({
                attemptCount: 0,
                createdAt: yield* DateTime.nowAsDate,
                eventOccurredAt,
                eventType: input.eventType,
                id: deliveryId,
                payload: input.payload,
                projectId: input.projectId,
                status: WebhookDeliveryStatus.Pending,
                webhookEndpointId: endpoint.id,
              });
              return {
                deliveryId,
                endpointId: endpoint.id,
                eventType: input.eventType,
                payload: input.payload,
                url: endpoint.url,
              } satisfies StagedWebhookDelivery;
            }),
            { concurrency: 1 },
          );
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new WebhookServiceError({
                    cause: `Failed to emit webhook event: ${String(error.cause)}`,
                  }),
                ),
            }),
          ),
      );

      const dispatch = Effect.fn("webhookDispatch.dispatch")(function* (
        deliveries: ReadonlyArray<StagedWebhookDelivery>,
      ) {
        yield* Effect.annotateCurrentSpan("voidhash.webhook.delivery.count", deliveries.length);
        yield* Effect.forEach(
          deliveries,
          (delivery) =>
            Workflow.dispatchAndForget(DeliverWebhook, {
              attemptNumber: 1,
              deliveryId: delivery.deliveryId,
              endpointId: delivery.endpointId,
              eventType: delivery.eventType,
              payload: delivery.payload,
              url: delivery.url,
            }).pipe(Effect.forkDetach),
          { concurrency: 1, discard: true },
        );
      });

      const emit = Effect.fn("webhookDispatch.emit")(function* (input: WebhookDispatchInput) {
        const deliveries = yield* stage(db, input);
        yield* dispatch(deliveries);
        if (Arr.isReadonlyArrayNonEmpty(deliveries)) {
          yield* Effect.logInfo(
            `Emitted ${input.eventType} event to ${deliveries.length} webhook endpoints`,
          );
        }
        return { deliveriesCreated: deliveries.length };
      });

      return constant({ dispatch, emit, stage });
    }),
  },
) {
  static layer = Layer.effect(WebhookDispatchService)(WebhookDispatchService.make);
}

/** Shape of {@link WebhookDispatchService}, for test doubles. */
export interface WebhookDispatchServiceShape {
  readonly stage: (
    handle: Database | DbTransaction,
    input: WebhookDispatchInput,
  ) => Effect.Effect<ReadonlyArray<StagedWebhookDelivery>, WebhookServiceError>;
  readonly dispatch: (
    deliveries: ReadonlyArray<StagedWebhookDelivery>,
  ) => Effect.Effect<void, WebhookServiceError, WorkflowRunner | PlatformRuntime>;
  readonly emit: (
    input: WebhookDispatchInput,
  ) => Effect.Effect<
    { readonly deliveriesCreated: number },
    WebhookServiceError,
    WorkflowRunner | PlatformRuntime
  >;
}
