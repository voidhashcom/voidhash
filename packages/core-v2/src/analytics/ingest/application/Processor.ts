import { Context, Crypto, DateTime, Effect, Layer, Schema } from "effect";

import {
  analyticsEventFromProcessed,
  type ProcessedAnalyticsEvent,
} from "../../domain/AnalyticsEvent.ts";
import {
  isReservedRevenueEventName,
  isTrustedInternalAnalyticsEventSource,
  sourceTopicForInternalAnalyticsEvent,
  InternalAnalyticsEventSchema,
} from "../../domain/InternalAnalyticsEvents.ts";
import {
  AnalyticsConfig,
  AnalyticsDeadLetterStore,
  AnalyticsIdentityResolver,
  AnalyticsStore,
  ProcessorProjectRepository,
} from "../../application/ports.ts";
import type { IdentityResolution, ResolvedAnalyticsIdentity } from "../../application/ports.ts";
import { admitEvent } from "../domain/EventAdmission.ts";
import {
  buildDlqEvent,
  CapturedEventV1,
  type CapturedTransportRecord,
  EventContextSchema,
  EventPropertiesSchema,
  validateBuiltInProcessorRules,
} from "../domain/Ingest.ts";

/** Unexpected failure while processing a captured analytics event. */
export class AnalyticsProcessorError extends Schema.TaggedErrorClass<AnalyticsProcessorError>(
  "AnalyticsProcessorError",
)("AnalyticsProcessorError", {
  cause: Schema.String,
  message: Schema.String,
}) {}

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/** How far a client timestamp may lag behind (24h) or run ahead (5m) of receipt. */
const MAX_EVENT_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * Clamps client-supplied event timestamps to a bounded window around receipt:
 * unbounded client clocks would otherwise create arbitrary ClickHouse
 * partitions (atomic write records partition by their server-derived write time).
 */
const clampEventTimestamp = (eventTimestamp: string, receivedAt: string) => {
  const received = DateTime.toDateUtc(DateTime.makeUnsafe(receivedAt)).getTime();
  const event = DateTime.toDateUtc(DateTime.makeUnsafe(eventTimestamp)).getTime();
  const clamped = Math.min(
    Math.max(event, received - MAX_EVENT_AGE_MS),
    received + MAX_CLOCK_SKEW_MS,
  );
  return DateTime.toDateUtc(DateTime.makeUnsafe(clamped)).toISOString();
};

const processorError = (error: { readonly cause?: unknown; readonly message: string }) =>
  new AnalyticsProcessorError({ cause: String(error.cause), message: error.message });

/** Put a trusted internal event onto the same envelope contract used by SDK capture. */
export const makeInternalCaptureEnvelope = (
  event: typeof InternalAnalyticsEventSchema.Type,
  receivedAt: Date,
) => {
  let identityClaim: (typeof CapturedEventV1.Type)["identityClaim"] = {
    _tag: "Anonymous",
    distinctId: event.distinctId,
  };
  if (event.personId) {
    identityClaim = {
      _tag: "Resolved",
      distinctId: event.distinctId,
      personId: event.personId,
    };
  }
  let trustClass: (typeof CapturedEventV1.Type)["trustClass"] = "trusted-revenue";
  if (event.eventName === "$experiment.exposed") {
    trustClass = "trusted-internal";
  }
  // The top-level transactionId would otherwise be dropped before storage.
  const enrichedProperties: Record<string, unknown> = { ...event.properties };
  if ("transactionId" in event && event.transactionId) {
    enrichedProperties.transactionId = event.transactionId;
  }
  return {
    schemaVersion: 1,
    captureId: `internal_${event.eventId}`,
    clientEventId: event.eventId,
    context: Schema.decodeUnknownSync(Schema.fromJsonString(EventContextSchema))(
      encodeJson(event.context ?? {}),
    ),
    distinctId: event.distinctId,
    event: event.eventName,
    eventTimestamp: event.occurredAt.toISOString(),
    identityClaim,
    organizationId: event.organizationId,
    projectId: event.projectId,
    properties: Schema.decodeUnknownSync(Schema.fromJsonString(EventPropertiesSchema))(
      encodeJson(enrichedProperties),
    ),
    rawPayload: {},
    receivedAt: receivedAt.toISOString(),
    request: {
      isInternal: true,
      path: "/internal/analytics",
      requestId: `internal_${event.eventId}`,
    },
    sourceTopic: sourceTopicForInternalAnalyticsEvent(event),
    token: event.token,
    trustClass,
  } satisfies typeof CapturedEventV1.Type;
};

const buildProcessedEvent = (input: {
  readonly identity: typeof ResolvedAnalyticsIdentity.Type;
  readonly now: Date;
  readonly record: typeof CapturedTransportRecord.Type;
  readonly trustedSource: boolean;
}) => {
  let eventTimestamp = input.record.capturedEvent.eventTimestamp;
  if (!input.trustedSource) {
    eventTimestamp = clampEventTimestamp(
      input.record.capturedEvent.eventTimestamp,
      input.record.capturedEvent.receivedAt,
    );
  }
  return {
    captureId: input.record.capturedEvent.captureId,
    context: input.record.capturedEvent.context,
    distinctId: input.record.capturedEvent.distinctId,
    event: input.record.capturedEvent.event,
    eventTimestamp,
    identity: input.identity,
    organizationId: input.record.capturedEvent.organizationId,
    processedAt: input.now.toISOString(),
    receivedAt: input.record.capturedEvent.receivedAt,
    processedEventId:
      input.record.capturedEvent.clientEventId ?? input.record.capturedEvent.captureId,
    projectId: input.record.capturedEvent.projectId,
    properties: input.record.capturedEvent.properties,
    request: input.record.capturedEvent.request,
    sourceTopic: input.record.sourceTopic,
    ...(input.record.capturedEvent.sessionId && {
      sessionId: input.record.capturedEvent.sessionId,
    }),
    token: input.record.capturedEvent.token,
  } satisfies ProcessedAnalyticsEvent;
};

/** Outcome of processing a single transport record. */
export const ProcessResult = Schema.Struct({
  status: Schema.Literals(["dead-lettered", "stored"]),
  inserted: Schema.Int,
});

/** Analytics processing capabilities shared by inline and queued transports. */
interface AnalyticsProcessorShape {
  readonly process: (
    record: typeof CapturedTransportRecord.Type,
  ) => Effect.Effect<typeof ProcessResult.Type, AnalyticsProcessorError>;
}

const makeAnalyticsProcessor = Effect.gen(function* () {
  const config = yield* AnalyticsConfig;
  const deadLetters = yield* AnalyticsDeadLetterStore;
  const identity = yield* AnalyticsIdentityResolver;
  const projects = yield* ProcessorProjectRepository;
  const store = yield* AnalyticsStore;
  const crypto = yield* Crypto.Crypto;

  return {
    process: (record: typeof CapturedTransportRecord.Type) =>
      Effect.gen(function* () {
        const reject = (
          failureClass: Parameters<typeof buildDlqEvent>[0]["failureClass"],
          message: string,
        ) =>
          Effect.gen(function* () {
            const event = yield* buildDlqEvent({
              captureId: record.capturedEvent.captureId,
              distinctId: record.capturedEvent.distinctId,
              failureClass,
              failureMessage: message,
              headers: { ...record.headers },
              projectId: record.capturedEvent.projectId,
              rawKey: record.rawKey,
              rawValue: record.rawValue,
              sourceOffset: record.sourceOffset,
              sourcePartition: record.sourcePartition,
              sourceTopic: record.sourceTopic,
              token: record.capturedEvent.token,
            }).pipe(Effect.provideService(Crypto.Crypto, crypto), Effect.mapError(processorError));
            yield* deadLetters.write([event]).pipe(Effect.mapError(processorError));
            return { inserted: 0, status: "dead-lettered" } satisfies typeof ProcessResult.Type;
          });
        const trustedSource = isTrustedInternalAnalyticsEventSource({
          eventName: record.capturedEvent.event,
          sourceTopic: record.sourceTopic,
          trustClass: record.capturedEvent.trustClass,
        });
        const claimsTrustedSource =
          isReservedRevenueEventName(record.capturedEvent.event) ||
          record.capturedEvent.event === "$experiment.exposed" ||
          (record.capturedEvent.trustClass !== undefined &&
            record.capturedEvent.trustClass !== "untrusted-sdk");
        if (claimsTrustedSource && !trustedSource) {
          return yield* reject(
            "reserved_event_name",
            "internal analytics event does not have a trusted source",
          );
        }
        const project = yield* projects
          .resolve(record.capturedEvent)
          .pipe(Effect.mapError(processorError));
        if (!project || project.projectId !== record.capturedEvent.projectId) {
          return yield* reject("project_not_found", "failed to resolve processor project policy");
        }
        if (!project.policy.processorEnabled) {
          return yield* reject("policy_rejected", "processor is disabled for the project");
        }
        if (
          !admitEvent({
            edition: config.edition,
            eventName: record.capturedEvent.event,
            policy: project.policy.admission,
          }).admitted
        ) {
          return yield* reject(
            "policy_rejected",
            `event ${record.capturedEvent.event} is not admitted for this project`,
          );
        }
        const now = yield* DateTime.nowAsDate;
        const validation = validateBuiltInProcessorRules({
          capturedEvent: record.capturedEvent,
          sourceTopic: record.sourceTopic,
        });
        if (validation) return yield* reject("schema_rejected", validation);

        const claim = record.capturedEvent.identityClaim;
        let resolution: typeof IdentityResolution.Type;
        if (claim?._tag === "Resolved" && trustedSource) {
          resolution = {
            identity: {
              distinctId: claim.distinctId,
              mode: "full",
              personId: claim.personId,
            },
            personEvents: [],
            personIdentityEvents: [],
          };
        } else {
          resolution = yield* identity.resolve(record).pipe(Effect.mapError(processorError));
        }
        const event = analyticsEventFromProcessed(
          buildProcessedEvent({ identity: resolution.identity, now, record, trustedSource }),
        );
        const inserted = yield* store
          .insert({
            events: [event],
            organizationIdsByProject: { [project.projectId]: project.organizationId },
            personEvents: resolution.personEvents,
            personIdentityEvents: resolution.personIdentityEvents,
          })
          .pipe(Effect.mapError(processorError));
        return { inserted, status: "stored" };
      }),
  } satisfies AnalyticsProcessorShape;
});

/** Processor use case whose implementation dependencies are supplied by layers. */
export class AnalyticsProcessor extends Context.Service<
  AnalyticsProcessor,
  AnalyticsProcessorShape
>()("@voidhash/core-v2/analytics/AnalyticsProcessor", { make: makeAnalyticsProcessor }) {
  /** Layer constructor that leaves all implementation dependencies explicit. */
  static readonly layer = Layer.effect(AnalyticsProcessor)(AnalyticsProcessor.make);
}

/** Build transport metadata for inline delivery. */
export const inlineTransportRecord = (envelope: typeof CapturedEventV1.Type, offset: number) =>
  ({
    capturedEvent: envelope,
    headers: {},
    rawValue: encodeJson(envelope),
    sourceOffset: String(offset),
    sourcePartition: 0,
    sourceTopic: envelope.sourceTopic,
  }) satisfies typeof CapturedTransportRecord.Type;
