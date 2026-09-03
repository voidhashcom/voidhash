import * as Arr from "effect/Array";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Option from "effect/Option";
import * as R from "effect/Record";
import * as Schema from "effect/Schema";

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
  type EventProcessorDlqV1,
  EventPropertiesSchema,
  type ResolvedProcessorProject,
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
    ...(input.record.capturedEvent.sentAt && { sentAt: input.record.capturedEvent.sentAt }),
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
    sourceOffset: input.record.sourceOffset,
    sourcePartition: input.record.sourcePartition,
    ...(input.record.capturedEvent.sessionId && {
      sessionId: input.record.capturedEvent.sessionId,
    }),
    token: input.record.capturedEvent.token,
    ...(input.record.capturedEvent.trustClass && {
      trustClass: input.record.capturedEvent.trustClass,
    }),
  } satisfies ProcessedAnalyticsEvent;
};

/** Outcome of processing a single transport record. */
export const ProcessResult = Schema.Struct({
  status: Schema.Literals(["dead-lettered", "stored"]),
  inserted: Schema.Int,
});
export type ProcessResult = typeof ProcessResult.Type;

/** Outcome of processing a batch of transport records with one storage write. */
export const ProcessBatchResult = Schema.Struct({
  /** Records rejected by policy or validation and persisted as dead letters. */
  deadLettered: Schema.Int,
  /** Canonical events the store reported as submitted for insert. */
  inserted: Schema.Int,
  /** Records that passed every rule and were handed to the store. */
  stored: Schema.Int,
});
export type ProcessBatchResult = typeof ProcessBatchResult.Type;

/** Analytics processing capabilities shared by inline and queued transports. */
interface AnalyticsProcessorShape {
  /** Processes one record; equivalent to a single-record {@link processBatch}. */
  readonly process: (
    record: typeof CapturedTransportRecord.Type,
  ) => Effect.Effect<typeof ProcessResult.Type, AnalyticsProcessorError>;
  /**
   * Processes a whole delivery at once: project policy is resolved once per
   * credential, rejected records are dead-lettered in one write, and every
   * accepted event plus its identity projections lands in a single store
   * insert. Nothing is stored when the batch fails, so a retried delivery
   * cannot leave a partially written prefix behind.
   */
  readonly processBatch: (
    records: ReadonlyArray<typeof CapturedTransportRecord.Type>,
  ) => Effect.Effect<typeof ProcessBatchResult.Type, AnalyticsProcessorError>;
}

type DlqFailureClass = (typeof EventProcessorDlqV1.Type)["failureClass"];

interface AdmittedRecord {
  readonly project: typeof ResolvedProcessorProject.Type;
  readonly record: typeof CapturedTransportRecord.Type;
  readonly trustedSource: boolean;
}

/**
 * Records sharing a credential and project resolve to the same policy, so a
 * batch only pays for one repository round trip per distinct key.
 */
const projectCacheKey = (
  capturedEvent: typeof CapturedEventV1.Type,
  trustedSource: boolean,
): string =>
  [String(trustedSource), capturedEvent.projectId, capturedEvent.token]
    .map((part) => `${part.length}:${part}`)
    .join("");

const makeAnalyticsProcessor = Effect.fn("makeAnalyticsProcessor")(function* () {
  const config = yield* AnalyticsConfig;
  const deadLetters = yield* AnalyticsDeadLetterStore;
  const identity = yield* AnalyticsIdentityResolver;
  const projects = yield* ProcessorProjectRepository;
  const store = yield* AnalyticsStore;
  const crypto = yield* Crypto.Crypto;

  const deadLetterFor = (
    record: typeof CapturedTransportRecord.Type,
    failureClass: DlqFailureClass,
    message: string,
  ) =>
    buildDlqEvent({
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

  /**
   * Applies every rule that needs no identity work. Returns the admitted
   * record, or the dead-letter event describing why it was refused.
   */
  const admit = (
    record: typeof CapturedTransportRecord.Type,
    resolveProject: (
      key: string,
      capturedEvent: typeof CapturedEventV1.Type,
    ) => Effect.Effect<
      typeof ResolvedProcessorProject.Type | typeof Schema.Undefined.Type,
      AnalyticsProcessorError
    >,
  ) =>
    Effect.gen(function* () {
      const reject = (failureClass: DlqFailureClass, message: string) =>
        Effect.map(deadLetterFor(record, failureClass, message), (event) => ({ event }));
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
      const project = yield* resolveProject(
        projectCacheKey(record.capturedEvent, trustedSource),
        record.capturedEvent,
      );
      if (!project || project.projectId !== record.capturedEvent.projectId) {
        return yield* reject("project_not_found", "failed to resolve processor project policy");
      }
      if (!project.policy.isProcessorEnabled) {
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
      const validation = validateBuiltInProcessorRules({
        capturedEvent: record.capturedEvent,
        sourceTopic: record.sourceTopic,
      });
      if (validation) return yield* reject("schema_rejected", validation);
      return { admitted: { project, record, trustedSource } satisfies AdmittedRecord };
    });

  const resolveIdentity = (admitted: AdmittedRecord) => {
    const claim = admitted.record.capturedEvent.identityClaim;
    if (claim?._tag === "Resolved" && admitted.trustedSource) {
      return Effect.succeed({
        identity: {
          distinctId: claim.distinctId,
          mode: "full",
          personId: claim.personId,
        },
        personEvents: [],
        personIdentityEvents: [],
      } satisfies typeof IdentityResolution.Type);
    }
    return identity.resolve(admitted.record).pipe(Effect.mapError(processorError));
  };

  const processBatch = (records: ReadonlyArray<typeof CapturedTransportRecord.Type>) =>
    Effect.gen(function* () {
      if (Arr.isReadonlyArrayEmpty(records)) {
        return { deadLettered: 0, inserted: 0, stored: 0 } satisfies typeof ProcessBatchResult.Type;
      }
      const projectCache = MutableHashMap.empty<
        string,
        typeof ResolvedProcessorProject.Type | typeof Schema.Undefined.Type
      >();
      const resolveProject = (key: string, capturedEvent: typeof CapturedEventV1.Type) =>
        Option.match(MutableHashMap.get(projectCache, key), {
          onSome: Effect.succeed,
          onNone: () =>
            projects.resolve(capturedEvent).pipe(
              Effect.mapError(processorError),
              Effect.tap((project) =>
                Effect.sync(() => {
                  MutableHashMap.set(projectCache, key, project);
                }),
              ),
            ),
        });

      const decisions = yield* Effect.forEach(
        records,
        (record) => admit(record, resolveProject),
        { concurrency: 1 },
      );
      const deadLetterEvents = Arr.getSomes(
        decisions.map((decision) =>
          "event" in decision ? Option.some(decision.event) : Option.none(),
        ),
      );
      const admitted = Arr.getSomes(
        decisions.map((decision) =>
          "admitted" in decision ? Option.some(decision.admitted) : Option.none(),
        ),
      );

      // Identity resolution mutates person state, so it stays sequential to
      // keep merges for one distinct id ordered within a delivery.
      const now = yield* DateTime.nowAsDate;
      const processed = yield* Effect.forEach(
        admitted,
        (entry) =>
          Effect.map(resolveIdentity(entry), (resolution) => ({
            event: analyticsEventFromProcessed(
              buildProcessedEvent({
                identity: resolution.identity,
                now,
                record: entry.record,
                trustedSource: entry.trustedSource,
              }),
            ),
            project: entry.project,
            resolution,
          })),
        { concurrency: 1 },
      );

      if (Arr.isReadonlyArrayNonEmpty(deadLetterEvents)) {
        yield* deadLetters.write(deadLetterEvents).pipe(Effect.mapError(processorError));
      }
      let inserted = 0;
      if (Arr.isReadonlyArrayNonEmpty(processed)) {
        inserted = yield* store
          .insert({
            events: processed.map((entry) => entry.event),
            organizationIdsByProject: R.fromEntries(
              processed.map((entry) => [entry.project.projectId, entry.project.organizationId]),
            ),
            personEvents: processed.flatMap((entry) => entry.resolution.personEvents),
            personIdentityEvents: processed.flatMap(
              (entry) => entry.resolution.personIdentityEvents,
            ),
          })
          .pipe(Effect.mapError(processorError));
      }
      return {
        deadLettered: deadLetterEvents.length,
        inserted,
        stored: processed.length,
      } satisfies typeof ProcessBatchResult.Type;
    });

  return {
    process: (record: typeof CapturedTransportRecord.Type) =>
      Effect.map(processBatch([record]), (outcome) =>
        outcome.stored > 0
          ? ({ inserted: outcome.inserted, status: "stored" } satisfies typeof ProcessResult.Type)
          : ({ inserted: 0, status: "dead-lettered" } satisfies typeof ProcessResult.Type),
      ),
    processBatch,
  } satisfies AnalyticsProcessorShape;
})();

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
