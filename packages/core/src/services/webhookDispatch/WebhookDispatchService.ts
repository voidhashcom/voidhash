import { Context, Effect, Layer } from "effect";
import * as Workflow from "@voidhash/platform/Workflow";

import { Db, WebhookDeliveryStatus, WebhookEndpointStatus, webhookDeliveries } from "@voidhash/db";
import { DeliverWebhook } from "../../workflows/definitions.ts";
import { generateId } from "../../utils/generate-id.ts";
import { WebhookServiceError } from "../webhookManager/WebhookManagerService.ts";
import type { WebhookEventType } from "../webhookManager/event-types.ts";

/**
 * Producer side of outbound webhooks. Creates delivery rows for all active
 * subscribed endpoints, then starts `DeliverWebhookWorkflow` for delivery and
 * retry handling.
 */
export class WebhookDispatchService extends Context.Service<WebhookDispatchService>()(
  "WebhookDispatchService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;

      const emit = Effect.fn("webhookDispatch.emit")(
        function* (input: {
          readonly projectId: string;
          readonly eventType: WebhookEventType;
          readonly payload: object;
        }) {
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
            try: () => JSON.stringify(input.payload),
            catch: (cause) =>
              new WebhookServiceError({
                cause: `Failed to emit webhook event: ${String(cause)}`,
              }),
          });

          const endpoints = yield* db.query.webhookEndpoints.findMany({
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

          if (subscribedEndpoints.length === 0) {
            yield* Effect.logDebug(
              `No webhook endpoints subscribed to ${input.eventType} for project ${input.projectId}`,
            );
            return { deliveriesCreated: 0 };
          }

          const eventOccurredAt = new Date();

          for (const endpoint of subscribedEndpoints) {
            const deliveryId = generateId("webhookDelivery");

            yield* db.insert(webhookDeliveries).values({
              attemptCount: 0,
              createdAt: new Date(),
              eventOccurredAt,
              eventType: input.eventType,
              id: deliveryId,
              payload: input.payload,
              projectId: input.projectId,
              status: WebhookDeliveryStatus.Pending,
              webhookEndpointId: endpoint.id,
            });

            yield* Workflow.dispatchAndForget(DeliverWebhook, {
              attemptNumber: 1,
              deliveryId,
              endpointId: endpoint.id,
              eventType: input.eventType,
              payload: input.payload,
              secret: endpoint.secret,
              url: endpoint.url,
            }).pipe(Effect.forkDetach);
          }

          yield* Effect.logInfo(
            `Emitted ${input.eventType} event to ${subscribedEndpoints.length} webhook endpoints`,
          );

          return { deliveriesCreated: subscribedEndpoints.length };
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

      return { emit } as const;
    }),
  },
) {
  static layer = Layer.effect(WebhookDispatchService)(WebhookDispatchService.make);
}
