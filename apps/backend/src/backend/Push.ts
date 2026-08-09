import { PushDeliveryQueueMessage } from "@voidhash/core/domain/notifications/PushDeliveryQueueMessage";
import {
  AuditLogPort,
  FirebaseCloudMessagingServiceConfigLive,
  makeApplePushNotificationServiceConfigLive,
  NotificationTokenService,
  PersonNotificationTokenService,
  PushDeliveryService,
} from "@voidhash/core/services";
import {
  PushDeliveryDispatch,
  PushDeliveryDispatchError,
} from "@voidhash/core/services/notifications/PushDeliveryDispatch";
import { PaymentConfigSecretCrypto } from "@voidhash/core/utils/crypto/PaymentConfigSecretCrypto";
import { Db } from "@voidhash/db";
import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import { QueueDriver } from "@voidhash/platform/Queue";
import { Config, Context, Effect, Layer } from "effect";

import type { SelfhostRuntimeConfig } from "../config.ts";

const pushDeliveryQueueName = "push-delivery";
const pushDeliveryDeadLetterQueueName = "push-delivery-dlq";
const pushDeliveryMaxRetries = 6;

/** Builds the PostgreSQL queue-backed dispatch port used by notification sends. */
export const SelfhostPushDeliveryDispatchLive = Layer.effect(
  PushDeliveryDispatch,
  Effect.gen(function* () {
    const queues = yield* QueueDriver;
    const runtime = yield* PlatformRuntime;
    const producer = queues.producer(pushDeliveryQueueName, PushDeliveryQueueMessage);
    return PushDeliveryDispatch.of({
      dispatch: (items) =>
        producer
          .publishBatch(
            items.map((item) => ({
              projectId: item.projectId,
              provider: item.provider,
              pushNotificationDeliveryId: item.pushNotificationDeliveryId,
              pushNotificationSendId: item.pushNotificationSendId,
            })),
          )
          .pipe(
            Effect.provideService(PlatformRuntime, runtime),
            Effect.mapError(
              (error) => new PushDeliveryDispatchError({ cause: error.cause }),
            ),
          ),
    });
  }),
);

const makePushDeliveryServiceLive = (config: SelfhostRuntimeConfig) => {
  const database = Db.layer(config.database);
  const crypto = PaymentConfigSecretCrypto.layer({
    key: Config.string("ENCRYPTION_KEY").pipe(Config.withDefault(""), Effect.orDie),
  });
  const providers = Layer.mergeAll(
    FirebaseCloudMessagingServiceConfigLive,
    makeApplePushNotificationServiceConfigLive({
      deliveryEnabled: Config.string("APNS_DELIVERY_ENABLED").pipe(
        Config.withDefault(""),
        Effect.map((value) => value === "true"),
        Effect.orDie,
      ),
    }),
  ).pipe(Layer.provide(crypto));
  const tokens = NotificationTokenService.layer.pipe(
    Layer.provide(PersonNotificationTokenService.layer),
    Layer.provide(AuditLogPort.noop),
  );
  return PushDeliveryService.layer.pipe(
    Layer.provide(tokens),
    Layer.provide(providers),
    Layer.provide(database),
  );
};

/** Runs the push-delivery and dead-letter consumers until their scope closes. */
export const runSelfhostPushDeliveryConsumers = (
  config: SelfhostRuntimeConfig,
) =>
  Effect.gen(function* () {
    const queues = yield* QueueDriver;
    const serviceContext = yield* Layer.build(
      makePushDeliveryServiceLive(config),
    );
    const service = Context.get(serviceContext, PushDeliveryService);

    const consumeDeliveries = queues.consumeBatch(
      pushDeliveryQueueName,
      PushDeliveryQueueMessage,
      (messages) =>
        Effect.forEach(
          messages,
          (message) => service.processDelivery(message.pushNotificationDeliveryId),
          { discard: true },
        ),
      {
        batchSize: 20,
        deadLetterQueue: pushDeliveryDeadLetterQueueName,
        maxRetries: pushDeliveryMaxRetries,
        retryDelayMillis: 10_000,
      },
    );
    const consumeDeadLetters = queues.consumeBatch(
      pushDeliveryDeadLetterQueueName,
      PushDeliveryQueueMessage,
      (messages) =>
        Effect.forEach(
          messages,
          (message) => service.markExhausted(message.pushNotificationDeliveryId),
          { discard: true },
        ),
      { batchSize: 20, maxRetries: 5 },
    );

    return yield* Effect.all([consumeDeliveries, consumeDeadLetters], {
      concurrency: "unbounded",
    });
  });
