import * as Arr from "effect/Array";
import * as WorkflowRegistration from "@voidhash/platform/WorkflowRegistration";
import * as Workflow from "@voidhash/platform/Workflow";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  Db,
  WebhookDeliveryStatus,
  WebhookEndpointStatus,
  and,
  eq,
  inArray,
  lt,
  or,
  webhookDeliveries,
  webhookEndpoints,
} from "@voidhash/db";
import { DeliverWebhook, WebhookDeliverySweep } from "@voidhash/core-v2";
import { WebhookDeliveryService } from "../services/webhookDispatch/WebhookDeliveryService.ts";

/**
 * How long a delivery may sit in a non-terminal state before the sweep
 * assumes its driving workflow was lost. Generous enough that a live
 * workflow (first attempt within seconds, retries waking at
 * `nextAttemptAt`) never trips it under normal operation.
 */
const STALE_AFTER = Duration.minutes(15);
const SWEEP_BATCH_SIZE = 200;

const SweepResult = Schema.Struct({
  candidateCount: Schema.Number,
  redispatchedCount: Schema.Number,
});

/**
 * Periodic drain for webhook deliveries nothing is driving. Safe against
 * racing a live workflow: re-dispatching the same `(deliveryId, attempt)`
 * resolves to the same durable instance id, so a duplicate dispatch joins
 * the in-flight run instead of double-sending.
 */
export const WebhookDeliverySweepRegistration = WorkflowRegistration.make(WebhookDeliverySweep, {
  dependencies: WebhookDeliveryService.layer,
  cron: {
    schedule: "*/5 * * * *",
    payload: (scheduledTime) => ({ runId: scheduledTime.toISOString() }),
  },
  run: (input, ctx) =>
    ctx.step({
      name: `webhook-delivery-sweep:${input.runId}`,
      success: SweepResult,
      execute: Effect.gen(function* () {
        const db = yield* Db;
        const now = yield* DateTime.now;
        const staleBefore = DateTime.toDateUtc(DateTime.subtractDuration(now, STALE_AFTER));

        const candidates = yield* db
          .select({
            attemptCount: webhookDeliveries.attemptCount,
            endpointId: webhookEndpoints.id,
            eventType: webhookDeliveries.eventType,
            id: webhookDeliveries.id,
            payload: webhookDeliveries.payload,
            url: webhookEndpoints.url,
          })
          .from(webhookDeliveries)
          .innerJoin(webhookEndpoints, eq(webhookDeliveries.webhookEndpointId, webhookEndpoints.id))
          .where(
            and(
              eq(webhookEndpoints.status, WebhookEndpointStatus.Active),
              or(
                and(
                  inArray(webhookDeliveries.status, [
                    WebhookDeliveryStatus.Pending,
                    WebhookDeliveryStatus.InProgress,
                  ]),
                  lt(webhookDeliveries.createdAt, staleBefore),
                ),
                and(
                  eq(webhookDeliveries.status, WebhookDeliveryStatus.Failed),
                  lt(webhookDeliveries.nextAttemptAt, staleBefore),
                ),
              ),
            ),
          )
          .limit(SWEEP_BATCH_SIZE);

        yield* Effect.forEach(
          candidates,
          (candidate) =>
            Workflow.dispatchAndForget(DeliverWebhook, {
              attemptNumber: candidate.attemptCount + 1,
              deliveryId: candidate.id,
              endpointId: candidate.endpointId,
              eventType: candidate.eventType,
              payload: candidate.payload,
              url: candidate.url,
            }),
          { concurrency: 1, discard: true },
        );
        const redispatchedCount = candidates.length;

        if (Arr.isReadonlyArrayNonEmpty(candidates)) {
          yield* Effect.logWarning("webhook delivery sweep re-dispatched stalled deliveries", {
            candidateCount: candidates.length,
            redispatchedCount,
          });
        }
        yield* Effect.annotateCurrentSpan({
          "voidhash.webhook.sweep.candidate_count": candidates.length,
          "voidhash.webhook.sweep.redispatched_count": redispatchedCount,
        });
        return { candidateCount: candidates.length, redispatchedCount };
      }),
    }),
});
