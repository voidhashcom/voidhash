import type { Effect } from "effect";
import type { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";

import type {
  QueueProducer,
  QueueProducerError,
} from "../src/services/infrastructure/QueueProducer.ts";

declare const producer: QueueProducer<string>;

const queuePublishRuntime: Effect.Effect<void, QueueProducerError, PlatformRuntime> =
  producer.publish("message");
const queueBatchRuntime: Effect.Effect<void, QueueProducerError, PlatformRuntime> =
  producer.publishBatch(["message"]);

// @ts-expect-error Queue publishes must keep the platform runtime marker.
const queuePublishNeutral: Effect.Effect<void, QueueProducerError, never> =
  producer.publish("message");

// @ts-expect-error Queue batch publishes must keep the platform runtime marker.
const queueBatchNeutral: Effect.Effect<void, QueueProducerError, never> = producer.publishBatch([
  "message",
]);

void queuePublishRuntime;
void queueBatchRuntime;
void queuePublishNeutral;
void queueBatchNeutral;
