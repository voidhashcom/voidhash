import {
  MimicDocumentIdleMessage,
  type MimicDocumentIdleMessageType,
} from "@voidhash/mimic-db/ws/idle-notify";
import { PlatformRuntime } from "@orbian/sdk/PlatformRuntime";
import { QueueDriver } from "@orbian/sdk/Queue";
import { Effect } from "effect";

/** Logical PostgreSQL queue carrying idle Mimic document revisions. */
export const mimicDocumentIdleQueueName = "mimic-document-idle";

/** Builds the typed idle-document publisher from the active queue runtime. */
export const makeSelfhostMimicDocumentIdlePublisher = Effect.gen(function* () {
  const queues = yield* QueueDriver;
  const runtime = yield* PlatformRuntime;
  const producer = queues.producer(
    mimicDocumentIdleQueueName,
    MimicDocumentIdleMessage,
  );
  return (message: MimicDocumentIdleMessageType) =>
    producer.publish(message).pipe(
      Effect.provideService(PlatformRuntime, runtime),
    );
});
