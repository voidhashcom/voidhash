/**
 * Analytics-ingest domain. Consolidates the wire-stable event schemas the
 * capture/processor/writer/janitor pipeline exchanges, plus the pure helpers
 * (envelope builders, DLQ builders, person-trait parsers, validation rules)
 * that the services rely on.
 *
 * Wire-stable schemas (consumers across processes must keep these stable):
 * - {@link CapturedEventV1} — capture → processor envelope.
 * - {@link ProcessedEventV2} — processor → writer (analytics events).
 * - {@link ProcessorPersonEventV1} — processor → writer (person snapshot).
 * - {@link ProcessorPersonIdentityEventV1} — processor → writer (identity map).
 * - {@link AnalyticsWriterMessage} — the writer's tagged input union.
 * - {@link EventProcessorDlqV1} — processor → DLQ.
 */
import { createId } from "@paralleldrive/cuid2";
import { DateTime, Option, Schema } from "effect";
import {
  sourceTopicForInternalAnalyticsEvent,
  type InternalAnalyticsEvent,
} from "../internalAnalytics/InternalAnalyticsEvents.ts";

/** `JSON.stringify` equivalent for the JSON text columns / round-trips below. */
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

// =============================================================================
// Captured event (capture → processor)
// =============================================================================

export type RouteClass = "main" | "dlq" | "overflow" | "historical" | "custom";

export const CapturedEventRequest = Schema.Struct({
  path: Schema.optional(Schema.String),
  requestId: Schema.String,
  userAgent: Schema.optional(Schema.String),
  clientIp: Schema.optional(Schema.String),
  isInternal: Schema.optional(Schema.Boolean),
});
export type CapturedEventRequest = typeof CapturedEventRequest.Type;

export const CapturedEventRouting = Schema.Struct({
  routeClass: Schema.Literals(["main", "dlq", "overflow", "historical", "custom"]),
  targetTopic: Schema.String,
  isHistorical: Schema.Boolean,
  skipEnrichment: Schema.Boolean,
});
export type CapturedEventRouting = typeof CapturedEventRouting.Type;

type EventPropertiesFieldPrimitive = string | number | boolean | null;
type EventPropertiesField =
  | EventPropertiesFieldPrimitive
  | ReadonlyArray<EventPropertiesField>
  | { readonly [key: string]: EventPropertiesField };

const EventPropertiesFieldSchema: Schema.Codec<EventPropertiesField> = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.Boolean,
  Schema.Null,
  Schema.Array(
    Schema.suspend((): Schema.Codec<EventPropertiesField> => EventPropertiesFieldSchema),
  ),
  Schema.Record(
    Schema.String,
    Schema.suspend((): Schema.Codec<EventPropertiesField> => EventPropertiesFieldSchema),
  ),
]);
const EventPropertiesSchema = Schema.Record(Schema.String, EventPropertiesFieldSchema);

type EventContextFieldPrimitive = string | number | boolean | null;
type EventContextField =
  | EventContextFieldPrimitive
  | ReadonlyArray<EventContextField>
  | { readonly [key: string]: EventContextField };

const EventContextFieldSchema: Schema.Codec<EventContextField> = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.Boolean,
  Schema.Null,
  Schema.Array(Schema.suspend((): Schema.Codec<EventContextField> => EventContextFieldSchema)),
  Schema.Record(
    Schema.String,
    Schema.suspend((): Schema.Codec<EventContextField> => EventContextFieldSchema),
  ),
]);
const EventContextSchema = Schema.Record(Schema.String, EventContextFieldSchema);

/**
 * The identity the capture layer asserts for an event, as a tagged claim the
 * processor honours:
 *  - `Anonymous` — SDK pre-identify; the processor resolves / creates identity.
 *  - `Stitch`    — SDK `$identify`; the processor stitches `previousDistinctId`.
 *  - `Resolved`  — a server-trusted caller (revenue) already knows the person;
 *                  the processor passes the `(distinctId, personId)` through and
 *                  writes NO `persons_v1` / `person_identity_v1` rows.
 *
 * Optional on {@link CapturedEventV1} so in-flight messages (and the SDK path,
 * until it stamps a claim) still decode; the processor only special-cases
 * `Resolved`, and only when the event is server-trusted.
 */
export const CapturedIdentityClaim = Schema.Union([
  Schema.Struct({ _tag: Schema.Literal("Anonymous"), distinctId: Schema.String }),
  Schema.Struct({
    _tag: Schema.Literal("Stitch"),
    distinctId: Schema.String,
    previousDistinctId: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal("Resolved"),
    distinctId: Schema.String,
    personId: Schema.String,
  }),
]);
export type CapturedIdentityClaim = typeof CapturedIdentityClaim.Type;

/**
 * Origin / trust of a captured event. The ingest queue is internal-only and
 * this marker is stamped SERVER-SIDE at the dispatch boundary (never threaded
 * from request input): `untrusted-sdk` for the public capture path,
 * `trusted-revenue` for server-emitted revenue events.
 */
export const TrustClass = Schema.Literals(["untrusted-sdk", "trusted-revenue", "trusted-internal"]);
export type TrustClass = typeof TrustClass.Type;

export const CapturedEventV1 = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  captureId: Schema.String,
  clientEventId: Schema.optional(Schema.String),
  sessionId: Schema.optional(Schema.String),
  token: Schema.String,
  organizationId: Schema.String,
  projectId: Schema.String,
  event: Schema.String,
  distinctId: Schema.String,
  eventTimestamp: Schema.String,
  receivedAt: Schema.String,
  sentAt: Schema.optional(Schema.String),
  properties: EventPropertiesSchema,
  context: EventContextSchema,
  rawPayload: Schema.Record(Schema.String, Schema.Unknown),
  request: CapturedEventRequest,
  routing: CapturedEventRouting,
  identityClaim: Schema.optional(CapturedIdentityClaim),
  trustClass: Schema.optional(TrustClass),
});
export type CapturedEventV1Type = typeof CapturedEventV1.Type;

// =============================================================================
// Processed event (processor → writer)
// =============================================================================

export const ProcessorLane = Schema.Literals(["historical", "main", "overflow"]);
export type ProcessorLane = typeof ProcessorLane.Type;

/**
 * Wire schema for one analytics-ingest queue message: an accepted capture
 * envelope plus the supported lane it routes to. Unsupported routes never reach
 * the queue (the producer records them in the ingest DLQ), so `lane` is a
 * {@link ProcessorLane}.
 */
export const AnalyticsIngestQueueMessage = Schema.Struct({
  envelope: CapturedEventV1,
  lane: ProcessorLane,
});
export type AnalyticsIngestQueueMessageType = typeof AnalyticsIngestQueueMessage.Type;

export const ProcessedEventIdentity = Schema.Struct({
  personId: Schema.optional(Schema.String),
  distinctId: Schema.String,
  mode: Schema.Literals(["full", "personless"]),
});
export type ProcessedEventIdentity = typeof ProcessedEventIdentity.Type;

export const ProcessedEventRouting = Schema.Struct({
  lane: ProcessorLane,
  skipEnrichment: Schema.Boolean,
  sourceOffset: Schema.String,
  sourcePartition: Schema.Number,
  sourceTopic: Schema.String,
});
export type ProcessedEventRouting = typeof ProcessedEventRouting.Type;

export const ProcessedEventV2 = Schema.Struct({
  captureId: Schema.String,
  context: Schema.Record(Schema.String, Schema.Unknown),
  distinctId: Schema.String,
  event: Schema.String,
  eventTimestamp: Schema.String,
  groups: Schema.Array(Schema.Never),
  identity: ProcessedEventIdentity,
  organizationId: Schema.String,
  processedAt: Schema.String,
  processedEventId: Schema.String,
  projectId: Schema.String,
  properties: Schema.Record(Schema.String, Schema.Unknown),
  request: CapturedEventRequest,
  routing: ProcessedEventRouting,
  schemaVersion: Schema.Literal(2),
  sessionId: Schema.optional(Schema.String),
  token: Schema.String,
});
export type ProcessedEventV2Type = typeof ProcessedEventV2.Type;

// =============================================================================
// Processor outputs (person snapshot / identity event)
// =============================================================================

export const ProcessorPersonEventV1 = Schema.Struct({
  changedAt: Schema.String,
  personId: Schema.String,
  email: Schema.optional(Schema.String),
  isArchived: Schema.Boolean,
  mergedIntoPersonId: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  primaryDistinctId: Schema.optional(Schema.String),
  projectId: Schema.String,
  schemaVersion: Schema.Literal(1),
  traits: Schema.Record(Schema.String, Schema.Unknown),
  version: Schema.Number,
});
export type ProcessorPersonEventV1Type = typeof ProcessorPersonEventV1.Type;

export const ProcessorPersonIdentityEventV1 = Schema.Struct({
  changedAt: Schema.String,
  personId: Schema.String,
  distinctId: Schema.String,
  isDeleted: Schema.Boolean,
  previousDistinctId: Schema.optional(Schema.String),
  projectId: Schema.String,
  schemaVersion: Schema.Literal(1),
  version: Schema.Number,
});
export type ProcessorPersonIdentityEventV1Type = typeof ProcessorPersonIdentityEventV1.Type;

// =============================================================================
// Capture route + project policy
// =============================================================================

export interface CaptureProjectPolicy {
  readonly customTopic?: string;
  readonly eventsPerDay?: number;
  readonly forceRoute?: RouteClass;
  readonly ingestEnabled: boolean;
  readonly projectId: string;
  readonly requestsPerMinute?: number;
  readonly skipEnrichment: boolean;
}

export interface RouteDecision {
  readonly isHistorical: boolean;
  readonly routeClass: RouteClass;
  readonly skipEnrichment: boolean;
  readonly targetTopic: string;
}

export const defaultCaptureProjectPolicy = (projectId: string): CaptureProjectPolicy => ({
  ingestEnabled: true,
  projectId,
  skipEnrichment: false,
});

// =============================================================================
// Transport record + DLQ event
// =============================================================================

export interface CapturedTransportRecord {
  readonly capturedEvent: CapturedEventV1Type;
  readonly headers: Readonly<Record<string, string>>;
  readonly lane: ProcessorLane;
  readonly rawKey?: string;
  readonly rawValue: string;
  readonly sourceOffset: string;
  readonly sourcePartition: number;
  readonly sourceTopic: string;
}

export interface EventProcessorDlqV1 {
  readonly captureId?: string;
  readonly distinctId?: string;
  readonly failedAt: string;
  readonly failureClass:
    | "captured_event_invalid"
    | "policy_rejected"
    | "project_not_found"
    | "reserved_event_name"
    | "schema_rejected"
    | "transport_invalid"
    | "unsupported_lane";
  readonly failureId: string;
  readonly failureMessage: string;
  readonly headers: Record<string, string>;
  readonly lane: ProcessorLane | "unknown";
  readonly projectId?: string;
  readonly rawKey?: string;
  readonly rawValue?: string;
  readonly schemaVersion: 1;
  readonly sourceOffset: string;
  readonly sourcePartition: number;
  readonly sourceTopic: string;
  readonly token?: string;
}

export const buildDlqEvent = ({
  captureId,
  distinctId,
  failureClass,
  failureMessage,
  headers,
  lane,
  projectId,
  rawKey,
  rawValue,
  sourceOffset,
  sourcePartition,
  sourceTopic,
  token,
}: Omit<EventProcessorDlqV1, "failedAt" | "failureId" | "schemaVersion">): EventProcessorDlqV1 => {
  // Absent optionals are omitted entirely (never present-but-undefined), so the
  // DLQ record stays minimal on the wire.
  const optional: {
    -readonly [K in "captureId" | "distinctId" | "projectId" | "rawKey" | "rawValue" | "token"]?:
      | EventProcessorDlqV1[K]
      | undefined;
  } = {};
  if (captureId) optional.captureId = captureId;
  if (distinctId) optional.distinctId = distinctId;
  if (projectId) optional.projectId = projectId;
  if (rawKey) optional.rawKey = rawKey;
  if (rawValue) optional.rawValue = rawValue;
  if (token) optional.token = token;

  return {
    ...optional,
    failedAt: DateTime.formatIso(DateTime.nowUnsafe()),
    failureClass,
    failureId: crypto.randomUUID(),
    failureMessage,
    headers,
    lane,
    schemaVersion: 1,
    sourceOffset,
    sourcePartition,
    sourceTopic,
  };
};

// =============================================================================
// Person-trait helpers (pure)
// =============================================================================

export interface PersonTraits {
  readonly setOnce: Record<string, unknown>;
  readonly set: Record<string, unknown>;
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parsePersonTraits = (
  properties: Record<string, unknown>,
):
  | { readonly ok: true; readonly value: PersonTraits }
  | { readonly ok: false; readonly message: string } => {
  const rawSet = properties.$set;
  if (typeof rawSet !== "undefined" && !isPlainRecord(rawSet)) {
    return { message: "$set must be an object", ok: false };
  }

  const rawSetOnce = properties.$set_once;
  if (typeof rawSetOnce !== "undefined" && !isPlainRecord(rawSetOnce)) {
    return { message: "$set_once must be an object", ok: false };
  }

  return {
    ok: true,
    value: {
      set: rawSet ?? {},
      setOnce: rawSetOnce ?? {},
    },
  };
};

export const extractInnerProperties = (
  wrappedProperties: Record<string, unknown>,
): Record<string, unknown> => {
  const inner = wrappedProperties.properties;
  if (isPlainRecord(inner)) {
    return inner;
  }
  return wrappedProperties;
};

/**
 * Epoch milliseconds for an ISO timestamp, or `NaN` when it cannot be parsed —
 * mirroring `new Date(value).getTime()` for the callers that compare ages.
 */
const epochMillisOf = (value: string): number => {
  const parsed = DateTime.make(value);
  if (Option.isNone(parsed)) {
    return Number.NaN;
  }
  return DateTime.toEpochMillis(parsed.value);
};

// =============================================================================
// Processor project policy + validation rules
// =============================================================================

export interface ProcessorProjectPolicy {
  readonly processorAllowHistorical: boolean;
  readonly processorAllowOverflow: boolean;
  readonly processorEnabled: boolean;
  readonly processorHistoricalMinAgeHours: number;
  readonly processorPersonProcessingEnabled: boolean;
  readonly processorSchemaMode: string;
}

export interface ResolvedProcessorProject {
  readonly organizationId: string;
  readonly policy: ProcessorProjectPolicy;
  readonly projectId: string;
}

export interface ProcessingEvent {
  readonly capturedEvent: CapturedEventV1Type;
  readonly headers: Readonly<Record<string, string>>;
  readonly identityKey: string;
  readonly lane: ProcessorLane;
  readonly projectPolicy: ProcessorProjectPolicy;
  readonly rawKey?: string;
  readonly rawValue: string;
  readonly sourceOffset: string;
  readonly sourcePartition: number;
  readonly sourceTopic: string;
}

export const ANONYMOUS_DISTINCT_ID_PREFIX = "vh:anon:";

export const validateBuiltInProcessorRules = ({
  capturedEvent,
  historicalMinAgeHours,
  lane,
  now,
  sourceTopic,
}: {
  readonly capturedEvent: CapturedEventV1Type;
  readonly historicalMinAgeHours: number;
  readonly lane: ProcessorLane;
  readonly now: Date;
  readonly sourceTopic: string;
}): string | undefined => {
  if (capturedEvent.routing.targetTopic !== sourceTopic) {
    return "captured event routing target does not match source topic";
  }

  if (lane === "historical") {
    if (!capturedEvent.routing.isHistorical) {
      return "historical topic requires isHistorical=true";
    }
    const eventAgeMs = now.getTime() - epochMillisOf(capturedEvent.eventTimestamp);
    const minimumAgeMs = historicalMinAgeHours * 60 * 60 * 1000;
    if (eventAgeMs < minimumAgeMs) {
      return "historical event is newer than the configured minimum age";
    }
  } else if (capturedEvent.routing.isHistorical) {
    return "non-historical lane received a historical captured event";
  }

  const innerProperties = extractInnerProperties(capturedEvent.properties);

  const traitsResult = parsePersonTraits(innerProperties);
  if (!traitsResult.ok) return traitsResult.message;

  const rawProcessPersonProfile = capturedEvent.properties.$process_person_profile;
  if (
    typeof rawProcessPersonProfile !== "undefined" &&
    typeof rawProcessPersonProfile !== "boolean"
  ) {
    return "$process_person_profile must be a boolean";
  }

  if (capturedEvent.event === "$identify") {
    const rawPreviousDistinctId = innerProperties.$previous_distinct_id;
    if (typeof rawPreviousDistinctId !== "string" || rawPreviousDistinctId.length === 0) {
      return "$identify requires properties.$previous_distinct_id";
    }
    if (capturedEvent.distinctId.startsWith(ANONYMOUS_DISTINCT_ID_PREFIX)) {
      return "$identify target distinct id cannot use the anonymous prefix";
    }
  }

  return undefined;
};

// =============================================================================
// Analytics writer message + row builders
// =============================================================================

export const AnalyticsWriterMessage = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("processed"),
    messageId: Schema.String,
    value: ProcessedEventV2,
  }),
  Schema.Struct({
    kind: Schema.Literal("person"),
    messageId: Schema.String,
    value: ProcessorPersonEventV1,
  }),
  Schema.Struct({
    kind: Schema.Literal("person-distinct-id"),
    messageId: Schema.String,
    value: ProcessorPersonIdentityEventV1,
  }),
]);

const decodeEventProperties = Schema.decodeUnknownSync(Schema.fromJsonString(EventPropertiesSchema));
const decodeEventContext = Schema.decodeUnknownSync(Schema.fromJsonString(EventContextSchema));

/**
 * Revenue always knows the person (`Resolved`); experiment exposure may fire for
 * an anonymous viewer (`personId` null → `Anonymous`, resolved on read).
 */
const capturedIdentityClaim = (event: InternalAnalyticsEvent): CapturedIdentityClaim => {
  if (event.personId) {
    return { _tag: "Resolved", distinctId: event.distinctId, personId: event.personId };
  }
  return { _tag: "Anonymous", distinctId: event.distinctId };
};

const capturedTrustClass = (event: InternalAnalyticsEvent): TrustClass => {
  if (event.eventName === "$experiment.exposed") {
    return "trusted-internal";
  }
  return "trusted-revenue";
};

/**
 * Maps a server-trusted {@link InternalAnalyticsEvent} into a
 * {@link CapturedEventV1} for the SHARED ingest queue — the revenue transport's
 * entry into the same pipeline the SDK uses.
 *
 * - The deterministic `event.eventId` becomes `clientEventId`, so it flows
 *   through `buildProcessedEvent` (`clientEventId ?? captureId`) to
 *   `events_v2.event_id` unchanged — the dedup key.
 * - A `Resolved` identity claim + the trusted source topic tell the processor
 *   to pass `(distinctId, personId)` through and emit NO person/identity rows
 *   (exactly today's revenue behaviour).
 * - `skipEnrichment` is set so the processor never runs person enrichment.
 * - `properties` is JSON round-tripped so Date values (e.g. `transferredAt`)
 *   become ISO strings — the wire `properties` schema permits only JSON
 *   primitives, and the result matches the stored JSON text form.
 */
export const makeCapturedEventFromInternalAnalyticsEvent = (
  event: InternalAnalyticsEvent,
): CapturedEventV1Type => {
  const captureId = `internal_${event.eventId}`;
  const targetTopic = sourceTopicForInternalAnalyticsEvent(event);
  const properties = decodeEventProperties(encodeJson(event.properties));
  const context = decodeEventContext(encodeJson(event.context ?? {}));
  const identityClaim = capturedIdentityClaim(event);
  const trustClass = capturedTrustClass(event);
  return {
    schemaVersion: 1,
    captureId,
    clientEventId: event.eventId,
    token: event.token,
    organizationId: event.organizationId,
    projectId: event.projectId,
    event: event.eventName,
    distinctId: event.distinctId,
    eventTimestamp: event.occurredAt.toISOString(),
    receivedAt: DateTime.formatIso(DateTime.nowUnsafe()),
    properties,
    context,
    rawPayload: {},
    request: {
      path: "/internal/analytics",
      requestId: captureId,
    },
    routing: {
      routeClass: "main",
      targetTopic,
      isHistorical: false,
      skipEnrichment: true,
    },
    identityClaim,
    trustClass,
  };
};

export type AnalyticsWriterMessageType = typeof AnalyticsWriterMessage.Type;

export interface AnalyticsWriterPlan {
  readonly personIdentityOverrideRows: ReadonlyArray<Record<string, unknown>>;
  readonly personIdentityPendingOverrideRows: ReadonlyArray<Record<string, unknown>>;
  readonly personIdentityRows: ReadonlyArray<Record<string, unknown>>;
  readonly personRows: ReadonlyArray<Record<string, unknown>>;
  readonly processedEventRows: ReadonlyArray<Record<string, unknown>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asRecord = (value: unknown): Record<string, unknown> => {
  if (isRecord(value)) {
    return value;
  }
  return {};
};

const toNullableString = (value: string | undefined): string | null => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  return null;
};

export const toFlag = (value: boolean): 0 | 1 => {
  if (value) {
    return 1;
  }
  return 0;
};

export const toClickhouseTimestamp = (value: string): string => {
  const parsed = DateTime.make(value);
  if (Option.isNone(parsed)) {
    throw new Error(`Invalid timestamp: ${value}`);
  }
  const date = DateTime.toDateUtc(parsed.value);
  const pad = (part: number, length = 2) => String(part).padStart(length, "0");
  return [
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(
      date.getUTCMilliseconds(),
      3,
    )}`,
  ].join(" ");
};

export const extractPreviousDistinctId = (event: ProcessedEventV2Type): string | null => {
  const wrappedProperties = asRecord(event.properties);
  const innerProperties = extractInnerProperties(wrappedProperties);
  const previousDistinctId = innerProperties.$previous_distinct_id;
  if (typeof previousDistinctId !== "string") {
    return null;
  }
  return toNullableString(previousDistinctId);
};

export const toProcessedEventRow = (event: ProcessedEventV2Type): Record<string, unknown> => ({
  capture_id: event.captureId,
  context: encodeJson(event.context),
  person_id: toNullableString(event.identity.personId),
  distinct_id: event.identity.distinctId,
  event_id: event.processedEventId,
  event_name: event.event,
  event_properties: encodeJson(event.properties),
  event_ts: toClickhouseTimestamp(event.eventTimestamp),
  identity_mode: event.identity.mode,
  organization_id: event.organizationId,
  previous_distinct_id: extractPreviousDistinctId(event),
  processed_ts: toClickhouseTimestamp(event.processedAt),
  project_id: event.projectId,
  request_id: event.request.requestId,
  request_path: event.request.path ?? "",
  route_lane: event.routing.lane,
  schema_version: event.schemaVersion,
  skip_enrichment: toFlag(event.routing.skipEnrichment),
  source_offset: event.routing.sourceOffset,
  source_partition: event.routing.sourcePartition,
  source_topic: event.routing.sourceTopic,
  token: event.token,
});

export const toPersonRow = (
  event: ProcessorPersonEventV1Type,
  organizationId: string,
): Record<string, unknown> => ({
  changed_at: toClickhouseTimestamp(event.changedAt),
  organization_id: organizationId,
  person_id: event.personId,
  email: toNullableString(event.email),
  is_archived: toFlag(event.isArchived),
  merged_into_person_id: toNullableString(event.mergedIntoPersonId),
  name: toNullableString(event.name),
  primary_distinct_id: toNullableString(event.primaryDistinctId),
  project_id: event.projectId,
  traits: encodeJson(event.traits),
  version: event.version,
});

export const toPersonIdentityRow = (
  event: ProcessorPersonIdentityEventV1Type,
  organizationId: string,
): Record<string, unknown> => ({
  changed_at: toClickhouseTimestamp(event.changedAt),
  organization_id: organizationId,
  person_id: event.personId,
  distinct_id: event.distinctId,
  is_deleted: toFlag(event.isDeleted),
  previous_distinct_id: toNullableString(event.previousDistinctId),
  project_id: event.projectId,
  version: event.version,
});

export const toPendingOverrideRow = (
  event: ProcessorPersonIdentityEventV1Type,
  organizationId: string,
): Record<string, unknown> => ({
  changed_at: toClickhouseTimestamp(event.changedAt),
  organization_id: organizationId,
  person_id: event.personId,
  is_deleted: toFlag(event.isDeleted),
  project_id: event.projectId,
  source_distinct_id: event.previousDistinctId ?? "",
  target_distinct_id: event.distinctId,
  version: event.version,
});

/**
 * Builds the per-table ClickHouse row plan. Person/identity rows carry an
 * `organization_id` resolved from their `project_id` via `organizationIdForProject`
 * (the writer looks this up in MySQL); processed-event rows already carry the
 * organization id from the upstream {@link ProcessedEventV2}. An unknown project
 * resolves to `""`, which the readonly RLS user's row policy treats as not
 * matching any tenant (fail-closed).
 */
export const buildAnalyticsWriterPlan = (
  messages: ReadonlyArray<AnalyticsWriterMessageType>,
  organizationIdForProject: (projectId: string) => string,
): AnalyticsWriterPlan => {
  const processedEventRows: Array<Record<string, unknown>> = [];
  const personRows: Array<Record<string, unknown>> = [];
  const personIdentityRows: Array<Record<string, unknown>> = [];
  const personIdentityOverrideRows: Array<Record<string, unknown>> = [];
  const personIdentityPendingOverrideRows: Array<Record<string, unknown>> = [];

  for (const message of messages) {
    switch (message.kind) {
      case "processed":
        processedEventRows.push(toProcessedEventRow(message.value));
        break;
      case "person":
        personRows.push(
          toPersonRow(message.value, organizationIdForProject(message.value.projectId)),
        );
        break;
      case "person-distinct-id": {
        const organizationId = organizationIdForProject(message.value.projectId);
        personIdentityRows.push(toPersonIdentityRow(message.value, organizationId));
        if (
          typeof message.value.previousDistinctId === "string" &&
          message.value.previousDistinctId.length > 0 &&
          message.value.version > 0
        ) {
          personIdentityOverrideRows.push(toPersonIdentityRow(message.value, organizationId));
          personIdentityPendingOverrideRows.push(
            toPendingOverrideRow(message.value, organizationId),
          );
        }
        break;
      }
    }
  }

  return {
    personIdentityOverrideRows,
    personIdentityPendingOverrideRows,
    personIdentityRows,
    personRows,
    processedEventRows,
  };
};

// =============================================================================
// Janitor snapshot resources
// =============================================================================

export interface BacklogRow {
  readonly changed_at: string;
  readonly person_id: string;
  readonly project_id: string;
  readonly source_distinct_id: string;
  readonly target_distinct_id: string;
  readonly version: number;
}

export interface SnapshotResources {
  readonly pendingOverrideDictionaryName: string;
  readonly pendingOverrideSnapshotName: string;
}

export const sanitizeIdentifier = (value: string): string =>
  value.replaceAll(/[^a-zA-Z0-9_]/g, "_");

// Names are unqualified — the runtime Clickhouse client connects with the
// per-stage database (provisioned by `Clickhouse.Database`) as its default, so
// the staging table created mid-squash lives in the right database.
export const makeSnapshotResources = (runId: string = createId()): SnapshotResources => {
  const suffix = sanitizeIdentifier(runId.replaceAll("-", ""));
  return {
    pendingOverrideDictionaryName: `person_identity_pending_override_dict_${suffix}`,
    pendingOverrideSnapshotName: `person_identity_pending_override_snapshot_${suffix}`,
  };
};

export const computeCutoffIso = ({
  now,
  safetyWindowSeconds,
}: {
  readonly now: Date;
  readonly safetyWindowSeconds: number;
}): string => DateTime.formatIso(DateTime.makeUnsafe(now.getTime() - safetyWindowSeconds * 1000));
