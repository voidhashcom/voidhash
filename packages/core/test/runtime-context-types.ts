import type { Effect } from "effect";
import type { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";

import type {
  PolicyCounterStoreShape,
  PolicyStoreError,
  RequestLimitCheck,
} from "../src/services/analyticsIngest/PolicyCounterStore.ts";
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

declare const policyStore: PolicyCounterStoreShape;

const requestLimitRuntime: Effect.Effect<RequestLimitCheck, PolicyStoreError, PlatformRuntime> =
  policyStore.checkRequestLimit({
    now: new Date(0),
    projectId: "project",
    requestsPerMinute: 1,
  });

const eventQuotaRuntime: Effect.Effect<boolean, PolicyStoreError, PlatformRuntime> =
  policyStore.checkEventQuota({
    now: new Date(0),
    projectId: "project",
    quota: 1,
  });

// @ts-expect-error Policy counters backed by runtime resources must stay runtime-colored.
const requestLimitNeutral: Effect.Effect<RequestLimitCheck, PolicyStoreError, never> =
  policyStore.checkRequestLimit({
    now: new Date(0),
    projectId: "project",
    requestsPerMinute: 1,
  });

// @ts-expect-error Policy counters backed by runtime resources must stay runtime-colored.
const eventQuotaNeutral: Effect.Effect<boolean, PolicyStoreError, never> =
  policyStore.checkEventQuota({
    now: new Date(0),
    projectId: "project",
    quota: 1,
  });

void queuePublishRuntime;
void queueBatchRuntime;
void requestLimitRuntime;
void eventQuotaRuntime;
void queuePublishNeutral;
void queueBatchNeutral;
void requestLimitNeutral;
void eventQuotaNeutral;
