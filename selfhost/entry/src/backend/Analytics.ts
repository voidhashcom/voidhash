import {
  AnalyticsIngestQueueMessage,
  type AnalyticsIngestQueueMessageType,
  type AnalyticsWriterMessageType,
} from "@voidhash/core/domain/analyticsIngest/AnalyticsIngest";
import { IdentityProjectionPublisher } from "@voidhash/core/services";
import { AnalyticsIngestDlqService } from "@voidhash/core/services/analyticsIngest/AnalyticsIngestDlqService";
import { AnalyticsDispatchService } from "@voidhash/core/services/analyticsIngest/AnalyticsDispatchService";
import { AnalyticsWriterService } from "@voidhash/core/services/analyticsIngest/AnalyticsWriterService";
import {
  CaptureIngress,
  CaptureIngressError,
  type PublishableCaptureEvent,
} from "@voidhash/core/services/analyticsIngest/CaptureIngress";
import { DlqProducer } from "@voidhash/core/services/analyticsIngest/DlqProducer";
import { EventCaptureService } from "@voidhash/core/services/analyticsIngest/EventCaptureService";
import { EventProcessorService } from "@voidhash/core/services/analyticsIngest/EventProcessorService";
import {
  PolicyCounterStore,
  PolicyStoreError,
} from "@voidhash/core/services/analyticsIngest/PolicyCounterStore";
import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
import { PersonIdentityService } from "@voidhash/core/services/personIdentity/PersonIdentityService";
import { Db } from "@voidhash/db";
import { KeyValueStore } from "@orbian/sdk/KeyValueStore";
import { PlatformRuntime } from "@orbian/sdk/PlatformRuntime";
import { QueueDriver } from "@orbian/sdk/Queue";
import { PgKeyValueStoreLive } from "../runtime/KeyValueStore.ts";
import { NodePlatformRuntimeLive } from "../runtime/PlatformRuntime.ts";
import { PgQueueLive } from "../runtime/Queue.ts";
import { Context, Effect, Layer, Redacted } from "effect";

import type { SelfhostRuntimeConfig } from "../config.ts";

const analyticsQueueName = "analytics-ingest";
const analyticsDeadLetterQueueName = "analytics-ingest-dlq";

const minuteBucket = (value: Date): string => value.toISOString().slice(0, 16);
const dayBucket = (value: Date): string => value.toISOString().slice(0, 10);

const millisecondsUntilNextMinute = (value: Date): number => {
  const nextMinute = new Date(value);
  nextMinute.setUTCSeconds(0, 0);
  nextMinute.setUTCMinutes(nextMinute.getUTCMinutes() + 1);
  return Math.max(nextMinute.getTime() - value.getTime(), 0);
};

const makePolicyCounterStoreLive = Layer.effect(
  PolicyCounterStore,
  Effect.gen(function* () {
    const store = yield* KeyValueStore;
    const runtime = yield* PlatformRuntime;
    const increment = (key: string, ttlMillis: number) =>
      store.increment("analytics-policy", key, { ttlMillis }).pipe(
        Effect.provideService(PlatformRuntime, runtime),
        Effect.mapError(
          (error) =>
            new PolicyStoreError({
              cause: error.cause,
              message: "policy counter increment failed",
            }),
        ),
      );
    return PolicyCounterStore.of({
      checkEventQuota: ({ now, projectId, quota }) =>
        typeof quota !== "number" || quota < 1
          ? Effect.succeed(true)
          : increment(`events:${projectId}:${dayBucket(now)}`, 172_800_000).pipe(
              Effect.map((count) => count <= quota),
            ),
      checkRequestLimit: ({ now, projectId, requestsPerMinute }) =>
        typeof requestsPerMinute !== "number" || requestsPerMinute < 1
          ? Effect.succeed({ allowed: true })
          : increment(`requests:${projectId}:${minuteBucket(now)}`, 120_000).pipe(
              Effect.map((count) =>
                count <= requestsPerMinute
                  ? { allowed: true }
                  : {
                      allowed: false,
                      retryAfterMs: millisecondsUntilNextMinute(now),
                    },
              ),
            ),
    });
  }),
);

const makeCaptureIngressLive = Layer.effect(
  CaptureIngress,
  Effect.gen(function* () {
    const queues = yield* QueueDriver;
    const runtime = yield* PlatformRuntime;
    const dlq = yield* AnalyticsIngestDlqService;
    const producer = queues.producer(analyticsQueueName, AnalyticsIngestQueueMessage);

    const enqueueBatch = (events: ReadonlyArray<PublishableCaptureEvent>) =>
      Effect.gen(function* () {
        const publishable: AnalyticsIngestQueueMessageType[] = [];
        for (const event of events) {
          if (
            event.routeClass !== "main" &&
            event.routeClass !== "overflow" &&
            event.routeClass !== "historical"
          ) {
            yield* dlq.recordFailure({
              attemptCount: 0,
              captureId: event.envelope.captureId,
              distinctId: event.envelope.distinctId,
              failureClass: "unsupported_route",
              failureMessage: `route '${event.routeClass}' is not supported by queue ingest`,
              payloadJson: event.envelope,
              projectId: event.envelope.projectId,
              routeClass: event.routeClass,
              sourceSequence: 0,
              sourceShard: "capture-ingress",
            });
            continue;
          }
          publishable.push({ envelope: event.envelope, lane: event.routeClass });
        }
        if (publishable.length > 0) {
          yield* producer.publishBatch(publishable).pipe(
            Effect.provideService(PlatformRuntime, runtime),
          );
        }
      }).pipe(
        Effect.mapError(
          (error) =>
            new CaptureIngressError({
              cause:
                typeof error === "object" && error !== null && "cause" in error
                  ? String(error.cause)
                  : String(error),
              message: "failed to enqueue captured analytics events",
            }),
        ),
      );

    return CaptureIngress.of({ enqueueBatch });
  }),
);

/** Builds the PostgreSQL queue, policy counter, and capture service runtime. */
export const makeSelfhostAnalyticsRuntimeLive = (config: SelfhostRuntimeConfig) => {
  const postgres = {
    database: config.database.databaseName,
    host: config.database.host,
    password: Redacted.make(config.database.password),
    port: config.database.port,
    ...(config.database.ssl === undefined ? {} : { ssl: config.database.ssl }),
    username: config.database.username,
  };
  const platform = Layer.mergeAll(
    PgQueueLive(postgres),
    PgKeyValueStoreLive(postgres),
    NodePlatformRuntimeLive,
  );
  const database = Db.layer(config.database);
  const dlq = AnalyticsIngestDlqService.layer.pipe(Layer.provide(database));
  const policy = makePolicyCounterStoreLive.pipe(Layer.provide(platform));
  const ingress = makeCaptureIngressLive.pipe(
    Layer.provide(dlq),
    Layer.provide(database),
    Layer.provide(platform),
  );
  const capture = EventCaptureService.layer.pipe(
    Layer.provide(policy),
    Layer.provide(ingress),
    Layer.provide(database),
  );
  const dispatch = AnalyticsDispatchService.layer.pipe(Layer.provide(ingress));
  return Layer.mergeAll(platform, capture, dispatch);
};

/** Runs the analytics ingest and dead-letter consumers until their scope closes. */
export const runSelfhostAnalyticsConsumers = (
  config: SelfhostRuntimeConfig,
  clickhouse?: Layer.Layer<ClickhouseWebClient.ClickhouseWebClient>,
) =>
  Effect.gen(function* () {
    const queues = yield* QueueDriver;
    const database = Db.layer(config.database);
    const dlq = AnalyticsIngestDlqService.layer.pipe(Layer.provide(database));
    const processor = EventProcessorService.layer.pipe(
      Layer.provide(
        DlqProducer.dbLive.pipe(
          Layer.provide(dlq),
          Layer.provide(database),
        ),
      ),
      Layer.provide(
        PersonIdentityService.layer.pipe(
          Layer.provide(IdentityProjectionPublisher.noop),
          Layer.provide(database),
        ),
      ),
      Layer.provide(database),
    );
    const writerContext = clickhouse
      ? yield* Effect.gen(function* () {
          const clickhouseContext = yield* Layer.build(clickhouse);
          const client = Context.get(
            clickhouseContext,
            ClickhouseWebClient.ClickhouseWebClient,
          );
          return yield* Layer.build(
            AnalyticsWriterService.layerWithClickhouse(client).pipe(
              Layer.provide(database),
            ),
          );
        })
      : yield* Layer.build(AnalyticsWriterService.layer.pipe(Layer.provide(database)));
    const analyticsWriter = Context.get(writerContext, AnalyticsWriterService);

    const consumeAnalytics = queues.consumeBatch(
      analyticsQueueName,
      AnalyticsIngestQueueMessage,
      (messages) =>
        Effect.gen(function* () {
          const eventProcessor = yield* EventProcessorService;
          const writerMessages: AnalyticsWriterMessageType[] = [];
          for (const message of messages) {
            const outputs = yield* eventProcessor.processRecordToOutputs({
              capturedEvent: message.envelope,
              headers: {},
              lane: message.lane,
              rawValue: JSON.stringify(message.envelope),
              sourceOffset: message.envelope.captureId,
              sourcePartition: 0,
              sourceTopic: message.envelope.routing.targetTopic,
            });
            for (const processed of outputs.processedEvents) {
              writerMessages.push({
                kind: "processed",
                messageId: processed.processedEventId,
                value: processed,
              });
            }
            for (const person of outputs.personEvents) {
              writerMessages.push({
                kind: "person",
                messageId: `${person.projectId}:${person.personId}:${person.version}`,
                value: person,
              });
            }
            for (const identity of outputs.personIdentityEvents) {
              writerMessages.push({
                kind: "person-distinct-id",
                messageId: `${identity.projectId}:${identity.distinctId}:${identity.version}`,
                value: identity,
              });
            }
          }
          if (writerMessages.length > 0) {
            yield* analyticsWriter.writeMessages(writerMessages);
          }
        }).pipe(Effect.provide(processor)),
      {
        batchSize: 100,
        deadLetterQueue: analyticsDeadLetterQueueName,
        maxRetries: 10,
      },
    );

    const consumeDeadLetters = queues.consumeBatch(
      analyticsDeadLetterQueueName,
      AnalyticsIngestQueueMessage,
      (messages) =>
        Effect.gen(function* () {
          const service = yield* AnalyticsIngestDlqService;
          yield* Effect.forEach(
            messages,
            (message) =>
              service.recordFailure({
                attemptCount: 10,
                captureId: message.envelope.captureId,
                distinctId: message.envelope.distinctId,
                failureClass: "ingest_retry_exhausted",
                failureMessage: "exhausted analytics ingest queue retries",
                payloadJson: message.envelope,
                projectId: message.envelope.projectId,
                routeClass: message.envelope.routing.routeClass,
                sourceSequence: 0,
                sourceShard: analyticsDeadLetterQueueName,
              }),
            { discard: true },
          );
        }).pipe(Effect.provide(dlq), Effect.provide(database)),
      { batchSize: 100, maxRetries: 5 },
    );

    return yield* Effect.all([consumeAnalytics, consumeDeadLetters], {
      concurrency: "unbounded",
    });
  });
