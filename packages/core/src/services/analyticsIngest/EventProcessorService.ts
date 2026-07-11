/**
 * `EventProcessorService` turns one captured record into the downstream wire
 * events the writer consumes: resolve the project + processor policy (DLQ on
 * failure), validate policy/lane preconditions via {@link attachProjectPolicy}
 * (DLQ on rejection), resolve identity through {@link PersonIdentityService},
 * build the wire-stable {@link ProcessedEventV2}, and return the three output
 * streams.
 *
 * Records for the same `(token, distinctId)` are safe to process in any order:
 * identity resolution is order-agnostic (oldest-wins union-find + per-trait LWW)
 * and serialized at the row level by the identity transaction's `FOR UPDATE`
 * locks — no application-level scheduler needed.
 */
import { Context, Effect, Layer, Schema } from "effect";

import { ANONYMOUS_USER_ID_PREFIX } from "@voidhash/lib";
import { and, apiKeys, captureProjectPolicies, Db, eq, projects } from "@voidhash/db";

import {
  buildDlqEvent,
  type CapturedEventV1Type,
  type CapturedTransportRecord,
  type EventProcessorDlqV1,
  extractInnerProperties,
  parsePersonTraits,
  type ProcessedEventIdentity,
  type ProcessedEventV2Type,
  type ProcessingEvent,
  type ProcessorLane,
  type ProcessorPersonEventV1Type,
  type ProcessorPersonIdentityEventV1Type,
  type ProcessorProjectPolicy,
  type ResolvedProcessorProject,
  validateBuiltInProcessorRules,
} from "../../domain/analyticsIngest/AnalyticsIngest.ts";
import {
  isReservedRevenueEventName,
  REVENUE_TRUSTED_SOURCE_TOPIC,
} from "../../domain/internalAnalytics/InternalAnalyticsEvents.ts";
import {
  PersonIdentityService,
  type PersonIdentityEventV1,
  type PersonIdentityResult,
  type PersonSnapshotEventV1,
  type ResolvedAnalyticsIdentity,
} from "../personIdentity/PersonIdentityService.ts";
import { DlqProducer } from "./DlqProducer.ts";
import type { ProcessorOutputs } from "./ProcessorOutputs.ts";

export class EventProcessorServiceError extends Schema.TaggedErrorClass<EventProcessorServiceError>(
  "EventProcessorServiceError",
)("EventProcessorServiceError", {
  cause: Schema.String,
  message: Schema.String,
}) {}

const DEFAULT_PROCESSOR_POLICY: ProcessorProjectPolicy = {
  processorAllowHistorical: true,
  processorAllowOverflow: true,
  processorEnabled: true,
  processorHistoricalMinAgeHours: 48,
  processorPersonProcessingEnabled: true,
  processorSchemaMode: "reject",
};

const buildProcessedEventIdentity = (
  identity: ResolvedAnalyticsIdentity,
): ProcessedEventIdentity => ({
  ...(identity.personId ? { personId: identity.personId } : {}),
  distinctId: identity.distinctId,
  mode: identity.mode,
});

/** Builds the wire-stable {@link ProcessedEventV2} the writer consumes. */
export const buildProcessedEvent = ({
  capturedEvent,
  identity,
  lane,
  sourceOffset,
  sourcePartition,
  sourceTopic,
}: {
  readonly capturedEvent: CapturedEventV1Type;
  readonly identity: ResolvedAnalyticsIdentity;
  readonly lane: ProcessorLane;
  readonly sourceOffset: string;
  readonly sourcePartition: number;
  readonly sourceTopic: string;
}): ProcessedEventV2Type => ({
  captureId: capturedEvent.captureId,
  context: capturedEvent.context,
  distinctId: capturedEvent.distinctId,
  event: capturedEvent.event,
  eventTimestamp: capturedEvent.eventTimestamp,
  groups: [],
  identity: buildProcessedEventIdentity(identity),
  organizationId: capturedEvent.organizationId,
  processedAt: new Date().toISOString(),
  // The ClickHouse dedup key prefers the SDK's stable client uuid (reused across
  // retries / offline redelivery) over the fresh per-request captureId, so an
  // SDK-level resend collapses on read; falls back to captureId for non-SDK callers.
  processedEventId: capturedEvent.clientEventId ?? capturedEvent.captureId,
  projectId: capturedEvent.projectId,
  properties: capturedEvent.properties,
  request: capturedEvent.request,
  routing: {
    lane,
    skipEnrichment: capturedEvent.routing.skipEnrichment,
    sourceOffset,
    sourcePartition,
    sourceTopic,
  },
  schemaVersion: 2,
  ...(capturedEvent.sessionId ? { sessionId: capturedEvent.sessionId } : {}),
  token: capturedEvent.token,
});

/**
 * Validate policy + lane preconditions for a captured record and, on success,
 * promote it to a {@link ProcessingEvent}; on rejection return the pre-built
 * {@link EventProcessorDlqV1} for the caller to publish.
 */
export const attachProjectPolicy = ({
  now,
  record,
  resolvedProject,
}: {
  readonly now: Date;
  readonly record: CapturedTransportRecord;
  readonly resolvedProject: ResolvedProcessorProject;
}):
  | { readonly ok: true; readonly value: ProcessingEvent }
  | { readonly ok: false; readonly value: EventProcessorDlqV1 } => {
  const reject = (
    failureClass: EventProcessorDlqV1["failureClass"],
    failureMessage: string,
  ): { readonly ok: false; readonly value: EventProcessorDlqV1 } => ({
    ok: false,
    value: buildDlqEvent({
      captureId: record.capturedEvent.captureId,
      distinctId: record.capturedEvent.distinctId,
      failureClass,
      failureMessage,
      headers: record.headers,
      lane: record.lane,
      projectId: record.capturedEvent.projectId,
      rawKey: record.rawKey,
      rawValue: record.rawValue,
      sourceOffset: record.sourceOffset,
      sourcePartition: record.sourcePartition,
      sourceTopic: record.sourceTopic,
      token: record.capturedEvent.token,
    }),
  });

  if (resolvedProject.projectId !== record.capturedEvent.projectId) {
    return reject("project_not_found", "captured event project id does not match resolved token");
  }
  if (!resolvedProject.policy.processorEnabled) {
    return reject("policy_rejected", "processor is disabled for the project");
  }
  if (record.lane === "overflow" && !resolvedProject.policy.processorAllowOverflow) {
    return reject("policy_rejected", "overflow lane is disabled for the project");
  }
  if (record.lane === "historical" && !resolvedProject.policy.processorAllowHistorical) {
    return reject("policy_rejected", "historical lane is disabled for the project");
  }

  const validationError = validateBuiltInProcessorRules({
    capturedEvent: record.capturedEvent,
    historicalMinAgeHours: resolvedProject.policy.processorHistoricalMinAgeHours,
    lane: record.lane,
    now,
    sourceTopic: record.sourceTopic,
  });
  if (validationError) return reject("schema_rejected", validationError);

  return {
    ok: true,
    value: {
      capturedEvent: record.capturedEvent,
      headers: record.headers,
      identityKey: `${record.capturedEvent.token}:${record.capturedEvent.distinctId}`,
      lane: record.lane,
      projectPolicy: resolvedProject.policy,
      rawKey: record.rawKey,
      rawValue: record.rawValue,
      sourceOffset: record.sourceOffset,
      sourcePartition: record.sourcePartition,
      sourceTopic: record.sourceTopic,
    },
  };
};

const parseProcessPersonProfile = (properties: Record<string, unknown>): boolean | undefined => {
  const rawValue = properties.$process_person_profile;
  if (typeof rawValue === "undefined") return undefined;
  if (typeof rawValue !== "boolean") {
    throw new Error("$process_person_profile must be a boolean");
  }
  return rawValue;
};

const parseIdentifySourceDistinctId = (properties: Record<string, unknown>): string => {
  const rawValue = properties.$previous_distinct_id;
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    throw new Error("$identify requires properties.$previous_distinct_id");
  }
  return rawValue;
};

/**
 * Computes the {@link PersonIdentityService} call (identify vs resolve) for a
 * processing event, extracting person traits and the stable identity `eventId`
 * (the SDK client uuid, falling back to captureId) used for assertion dedup.
 */
export const buildPersonIdentityCall = (
  processingEvent: ProcessingEvent,
):
  | {
      readonly kind: "identify";
      readonly input: {
        readonly distinctId: string;
        readonly email?: string;
        readonly eventId: string;
        readonly eventTimestamp: Date;
        readonly name?: string;
        readonly previousDistinctId: string;
        readonly projectId: string;
        readonly setAttributes: Record<string, unknown>;
        readonly setOnceAttributes: Record<string, unknown>;
      };
    }
  | {
      readonly kind: "resolve";
      readonly input: {
        readonly distinctId: string;
        readonly email?: string;
        readonly eventId: string;
        readonly eventTimestamp: Date;
        readonly name?: string;
        readonly projectId: string;
        readonly setAttributes: Record<string, unknown>;
        readonly setOnceAttributes: Record<string, unknown>;
        readonly shouldCreatePerson: boolean;
      };
    } => {
  const { capturedEvent } = processingEvent;
  const innerProperties = extractInnerProperties(capturedEvent.properties);
  const traits = parsePersonTraits(innerProperties);
  if (!traits.ok) throw new Error(traits.message);

  const name =
    typeof traits.value.set.name === "string"
      ? traits.value.set.name
      : typeof traits.value.setOnce.name === "string"
        ? traits.value.setOnce.name
        : undefined;
  const email =
    typeof traits.value.set.email === "string"
      ? traits.value.set.email
      : typeof traits.value.setOnce.email === "string"
        ? traits.value.setOnce.email
        : undefined;
  const setAttributes = Object.fromEntries(
    Object.entries(traits.value.set).filter(([key]) => key !== "email" && key !== "name"),
  );
  const setOnceAttributes = Object.fromEntries(
    Object.entries(traits.value.setOnce).filter(([key]) => key !== "email" && key !== "name"),
  );

  const eventId = capturedEvent.clientEventId ?? capturedEvent.captureId;

  if (capturedEvent.event === "$identify") {
    return {
      kind: "identify",
      input: {
        distinctId: capturedEvent.distinctId,
        email,
        eventId,
        eventTimestamp: new Date(capturedEvent.eventTimestamp),
        name,
        previousDistinctId: parseIdentifySourceDistinctId(innerProperties),
        projectId: capturedEvent.projectId,
        setAttributes,
        setOnceAttributes,
      },
    };
  }

  const shouldCreatePerson =
    parseProcessPersonProfile(capturedEvent.properties) ??
    !capturedEvent.distinctId.startsWith(ANONYMOUS_USER_ID_PREFIX);

  const enrichmentDisabled =
    capturedEvent.routing.skipEnrichment ||
    !processingEvent.projectPolicy.processorPersonProcessingEnabled;

  return {
    kind: "resolve",
    input: {
      distinctId: capturedEvent.distinctId,
      email,
      eventId,
      eventTimestamp: new Date(capturedEvent.eventTimestamp),
      name,
      projectId: capturedEvent.projectId,
      setAttributes: enrichmentDisabled ? {} : setAttributes,
      setOnceAttributes: enrichmentDisabled ? {} : setOnceAttributes,
      shouldCreatePerson,
    },
  };
};

export const toProcessorPersonEvent = (
  event: PersonSnapshotEventV1,
): ProcessorPersonEventV1Type => ({
  changedAt: event.changedAt,
  personId: event.personId,
  ...(event.email ? { email: event.email } : {}),
  isArchived: event.isArchived,
  ...(event.mergedIntoPersonId ? { mergedIntoPersonId: event.mergedIntoPersonId } : {}),
  ...(event.name ? { name: event.name } : {}),
  ...(event.primaryDistinctId ? { primaryDistinctId: event.primaryDistinctId } : {}),
  projectId: event.projectId,
  schemaVersion: event.schemaVersion,
  traits: event.traits,
  version: event.version,
});

const toProcessorPersonIdentityEvent = ({
  identityDistinctId,
  mappingEvent,
}: {
  readonly identityDistinctId: string;
  readonly mappingEvent: PersonIdentityEventV1;
}): ProcessorPersonIdentityEventV1Type => {
  // Prefer the explicit override direction from the synchronous merge; fall back
  // to inferring it from the identify target for legacy mapping events.
  const previousDistinctId =
    mappingEvent.previousDistinctId ??
    (mappingEvent.distinctId === identityDistinctId ? undefined : mappingEvent.distinctId);
  return {
    changedAt: mappingEvent.changedAt,
    personId: mappingEvent.personId,
    distinctId: previousDistinctId ? identityDistinctId : mappingEvent.distinctId,
    isDeleted: mappingEvent.isDeleted,
    ...(previousDistinctId ? { previousDistinctId } : {}),
    projectId: mappingEvent.projectId,
    schemaVersion: mappingEvent.schemaVersion,
    version: mappingEvent.version,
  };
};

export const toProcessorPersonIdentityEvents = (
  identityResult: Pick<PersonIdentityResult, "identity" | "mappingEvents">,
): ReadonlyArray<ProcessorPersonIdentityEventV1Type> =>
  identityResult.mappingEvents.map((mappingEvent) =>
    toProcessorPersonIdentityEvent({
      identityDistinctId: identityResult.identity.distinctId,
      mappingEvent,
    }),
  );

export class EventProcessorService extends Context.Service<EventProcessorService>()(
  "EventProcessorService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;
      const dlqProducer = yield* DlqProducer;
      const personIdentityService = yield* PersonIdentityService;

      const emptyOutputs = (): ProcessorOutputs => ({
        personEvents: [],
        personIdentityEvents: [],
        processedEvents: [],
      });

      const processRecordToOutputs = Effect.fn("processRecordToOutputs")(
        function* (transportRecord: CapturedTransportRecord) {
          const now = new Date();

          const capturedEvent = transportRecord.capturedEvent;
          if (capturedEvent.captureId)
            yield* Effect.annotateCurrentSpan("voidhash.capture.id", capturedEvent.captureId);
          if (capturedEvent.projectId)
            yield* Effect.annotateCurrentSpan("voidhash.project.id", capturedEvent.projectId);
          if (capturedEvent.distinctId)
            yield* Effect.annotateCurrentSpan(
              "voidhash.person.distinct_id",
              capturedEvent.distinctId,
            );
          if (capturedEvent.event)
            yield* Effect.annotateCurrentSpan("voidhash.event.name", capturedEvent.event);
          if (capturedEvent.sessionId)
            yield* Effect.annotateCurrentSpan("voidhash.session.id", capturedEvent.sessionId);
          yield* Effect.annotateCurrentSpan("voidhash.processor.lane", transportRecord.lane);

          // Trusted revenue is server-stamped, so resolve it by `projectId`
          // directly — its token may be synthetic (no `api_key` row). SDK events
          // MUST resolve through the `api_key` join (token-spoofing protection).
          const isTrustedRevenue =
            capturedEvent.identityClaim?._tag === "Resolved" &&
            capturedEvent.routing.targetTopic === REVENUE_TRUSTED_SOURCE_TOPIC;

          const resolved = yield* Effect.result(
            Effect.gen(function* () {
              const [projectRecord] = isTrustedRevenue
                ? yield* db
                    .select({
                      organizationId: projects.organizationId,
                      projectId: projects.id,
                    })
                    .from(projects)
                    .where(eq(projects.id, capturedEvent.projectId))
                    .limit(1)
                : yield* db
                    .select({
                      organizationId: projects.organizationId,
                      projectId: apiKeys.projectId,
                    })
                    .from(apiKeys)
                    .innerJoin(projects, eq(projects.id, apiKeys.projectId))
                    .where(and(eq(apiKeys.isPublic, true), eq(apiKeys.key, capturedEvent.token)))
                    .limit(1);

              if (!projectRecord) return null;

              const [policyRecord] = yield* db
                .select()
                .from(captureProjectPolicies)
                .where(eq(captureProjectPolicies.projectId, projectRecord.projectId))
                .limit(1);

              return {
                organizationId: projectRecord.organizationId,
                policy: policyRecord
                  ? {
                      processorAllowHistorical: policyRecord.processorAllowHistorical,
                      processorAllowOverflow: policyRecord.processorAllowOverflow,
                      processorEnabled: policyRecord.processorEnabled,
                      processorHistoricalMinAgeHours: policyRecord.processorHistoricalMinAgeHours,
                      processorPersonProcessingEnabled:
                        policyRecord.processorPersonProcessingEnabled,
                      processorSchemaMode: policyRecord.processorSchemaMode,
                    }
                  : DEFAULT_PROCESSOR_POLICY,
                projectId: projectRecord.projectId,
              };
            }),
          );

          if (resolved._tag === "Failure" || resolved.success === null) {
            yield* dlqProducer.publishBatch([
              buildDlqEvent({
                captureId: transportRecord.capturedEvent.captureId,
                distinctId: transportRecord.capturedEvent.distinctId,
                failureClass: "project_not_found",
                failureMessage: "failed to resolve processor project policy",
                headers: transportRecord.headers,
                lane: transportRecord.lane,
                projectId: transportRecord.capturedEvent.projectId,
                rawValue: transportRecord.rawValue,
                sourceOffset: transportRecord.sourceOffset,
                sourcePartition: transportRecord.sourcePartition,
                sourceTopic: transportRecord.sourceTopic,
                token: transportRecord.capturedEvent.token,
              }),
            ]);
            return emptyOutputs();
          }

          if (resolved.success.organizationId)
            yield* Effect.annotateCurrentSpan(
              "voidhash.organization.id",
              resolved.success.organizationId,
            );

          const attached = attachProjectPolicy({
            now,
            record: transportRecord,
            resolvedProject: resolved.success,
          });
          if (!attached.ok) {
            yield* dlqProducer.publishBatch([attached.value]);
            return emptyOutputs();
          }

          if (
            isReservedRevenueEventName(attached.value.capturedEvent.event) &&
            attached.value.sourceTopic !== REVENUE_TRUSTED_SOURCE_TOPIC
          ) {
            yield* dlqProducer.publishBatch([
              buildDlqEvent({
                captureId: attached.value.capturedEvent.captureId,
                distinctId: attached.value.capturedEvent.distinctId,
                failureClass: "reserved_event_name",
                failureMessage: `reserved revenue event '${attached.value.capturedEvent.event}' from untrusted source topic '${attached.value.sourceTopic}'`,
                headers: attached.value.headers,
                lane: attached.value.lane,
                projectId: attached.value.capturedEvent.projectId,
                rawKey: attached.value.rawKey,
                rawValue: attached.value.rawValue,
                sourceOffset: attached.value.sourceOffset,
                sourcePartition: attached.value.sourcePartition,
                sourceTopic: attached.value.sourceTopic,
                token: attached.value.capturedEvent.token,
              }),
            ]);
            return emptyOutputs();
          }

          // Honour a pre-resolved identity claim on trusted revenue: skip
          // identity resolution and emit NO person/identity rows. Gated on the
          // trusted source topic so a forged claim on an untrusted event falls
          // through to normal resolution (defence-in-depth).
          const identityClaim = attached.value.capturedEvent.identityClaim;
          if (
            identityClaim?._tag === "Resolved" &&
            attached.value.sourceTopic === REVENUE_TRUSTED_SOURCE_TOPIC
          ) {
            const processedEvent = buildProcessedEvent({
              capturedEvent: attached.value.capturedEvent,
              identity: {
                distinctId: identityClaim.distinctId,
                mode: "full",
                personId: identityClaim.personId,
              },
              lane: attached.value.lane,
              sourceOffset: attached.value.sourceOffset,
              sourcePartition: attached.value.sourcePartition,
              sourceTopic: attached.value.sourceTopic,
            });
            return {
              personEvents: [],
              personIdentityEvents: [],
              processedEvents: [processedEvent],
            } satisfies ProcessorOutputs;
          }

          const call = buildPersonIdentityCall(attached.value);
          const identityResult = yield* call.kind === "identify"
            ? personIdentityService.identifyDistinctId(call.input)
            : personIdentityService.resolveDistinctId(call.input);

          if (identityResult.identity.personId)
            yield* Effect.annotateCurrentSpan(
              "voidhash.person.id",
              identityResult.identity.personId,
            );

          const processedEvent = buildProcessedEvent({
            capturedEvent: attached.value.capturedEvent,
            identity: identityResult.identity,
            lane: attached.value.lane,
            sourceOffset: attached.value.sourceOffset,
            sourcePartition: attached.value.sourcePartition,
            sourceTopic: attached.value.sourceTopic,
          });
          const personEvents = identityResult.personEvents.map(toProcessorPersonEvent);
          const personIdentityEvents = toProcessorPersonIdentityEvents(identityResult);

          return {
            personIdentityEvents,
            personEvents,
            processedEvents: [processedEvent],
          } satisfies ProcessorOutputs;
        },
        (effect) =>
          effect.pipe(
            Effect.withSpan("event-processor.processRecordToOutputs"),
            Effect.catchTags({
              DlqProducerError: (error) =>
                Effect.fail(
                  new EventProcessorServiceError({
                    cause: String(error.cause ?? error.message),
                    message: error.message,
                  }),
                ),
              PersonServiceError: (error) =>
                Effect.fail(
                  new EventProcessorServiceError({
                    cause: String(error.cause),
                    message: "identity resolution failed",
                  }),
                ),
            }),
          ),
      );

      return { processRecordToOutputs } as const;
    }),
  },
) {
  static readonly layer: Layer.Layer<
    EventProcessorService,
    never,
    Db | DlqProducer | PersonIdentityService
  > = Layer.effect(EventProcessorService)(EventProcessorService.make);
}
