import type { CaptureEvent } from "@voidhash/api-contracts/event-capture";
import { DateTime, Schema } from "effect";

import {
  sourceTopicForInternalAnalyticsEvent,
  InternalAnalyticsEventSchema,
} from "./InternalAnalyticsEvents.ts";

export const AnalyticsEventSource = Schema.Literals(["sdk", "revenue", "internal"]);

/**
 * Storage-neutral event shared by every analytics storage implementation.
 * The fields track the processed ingest record so events can move between
 * storage engines without semantic remapping.
 */
export const AnalyticsEventV1 = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  eventId: Schema.String,
  captureId: Schema.String,
  eventName: Schema.String,
  eventTimestamp: Schema.Date,
  receivedAt: Schema.Date,
  processedAt: Schema.Date,
  organizationId: Schema.String,
  projectId: Schema.String,
  distinctId: Schema.String,
  previousDistinctId: Schema.NullOr(Schema.String),
  personId: Schema.NullOr(Schema.String),
  identityMode: Schema.Literals(["full", "personless"]),
  properties: Schema.Record(Schema.String, Schema.Unknown),
  context: Schema.Record(Schema.String, Schema.Unknown),
  sessionId: Schema.NullOr(Schema.String),
  token: Schema.String,
  requestId: Schema.String,
  requestPath: Schema.NullOr(Schema.String),
  source: AnalyticsEventSource,
  sourceTopic: Schema.String,
});

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const decodeJsonRecord = Schema.decodeUnknownSync(
  Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)),
);

const normalizeJsonRecord = (value: unknown) => decodeJsonRecord(encodeJson(value ?? {}));

const storedProperties = (value: Readonly<Record<string, unknown>>) => {
  const inner = value.properties;
  if (typeof inner !== "object" || inner === null || Array.isArray(inner)) return value;
  return normalizeJsonRecord(inner);
};

const identityModeForPerson = (personId: string | null) => {
  if (personId) return "full";
  return "personless";
};

const sourceForInternalEvent = (eventName: string) => {
  if (eventName === "$experiment.exposed") return "internal";
  return "revenue";
};

const previousDistinctIdFrom = (properties: Readonly<Record<string, unknown>>) => {
  if (typeof properties.$previous_distinct_id === "string") {
    return properties.$previous_distinct_id;
  }
  return null;
};

const sourceForProcessedTopic = (sourceTopic: string) => {
  if (sourceTopic.startsWith("revenue.")) return "revenue";
  if (sourceTopic.startsWith("experiment.")) return "internal";
  return "sdk";
};

/** Maps an allow-listed SDK capture onto the portable event contract. */
export const analyticsEventFromCapture = (input: {
  readonly event: typeof CaptureEvent.Type;
  readonly organizationId: string;
  readonly projectId: string;
  readonly receivedAt: Date;
  readonly requestId: string;
  readonly requestPath?: string;
  readonly token: string;
}) => {
  return {
    schemaVersion: 1,
    eventId: input.event.uuid,
    captureId: `capture_${input.event.uuid}`,
    eventName: input.event.event,
    eventTimestamp: input.event.timestamp,
    receivedAt: input.receivedAt,
    processedAt: input.receivedAt,
    organizationId: input.organizationId,
    projectId: input.projectId,
    distinctId: input.event.distinct_id,
    previousDistinctId: null,
    personId: null,
    identityMode: "personless",
    properties: normalizeJsonRecord(input.event.properties),
    context: input.event.context,
    sessionId: input.event.session_id ?? null,
    token: input.token,
    requestId: input.requestId,
    requestPath: input.requestPath ?? null,
    source: "sdk",
    sourceTopic: "analytics.capture.v1",
  } satisfies typeof AnalyticsEventV1.Type;
};

/** Maps a server-trusted event onto the same portable event contract. */
export const analyticsEventFromInternal = (
  event: typeof InternalAnalyticsEventSchema.Type,
  processedAt: Date,
) =>
  ({
    schemaVersion: 1,
    eventId: event.eventId,
    captureId: `internal_${event.eventId}`,
    eventName: event.eventName,
    eventTimestamp: event.occurredAt,
    receivedAt: processedAt,
    processedAt,
    organizationId: event.organizationId,
    projectId: event.projectId,
    distinctId: event.distinctId,
    previousDistinctId: null,
    personId: event.personId,
    identityMode: identityModeForPerson(event.personId),
    properties: normalizeJsonRecord(event.properties),
    context: normalizeJsonRecord(event.context),
    sessionId: null,
    token: event.token,
    requestId: `internal_${event.eventId}`,
    requestPath: "/internal/analytics",
    source: sourceForInternalEvent(event.eventName),
    sourceTopic: sourceTopicForInternalAnalyticsEvent(event),
  }) satisfies typeof AnalyticsEventV1.Type;

/**
 * Structural processed-event shape accepted by the storage-neutral mapper.
 * It is independent of queue and storage implementation details.
 */
export interface ProcessedAnalyticsEvent {
  readonly captureId: string;
  readonly context: Readonly<Record<string, unknown>>;
  readonly distinctId: string;
  readonly event: string;
  readonly eventTimestamp: string;
  readonly identity: {
    readonly distinctId: string;
    readonly mode: "full" | "personless";
    readonly personId?: string;
  };
  readonly organizationId: string;
  readonly processedAt: string;
  readonly receivedAt: string;
  readonly processedEventId: string;
  readonly projectId: string;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly request: { readonly path?: string; readonly requestId: string };
  readonly sourceTopic: string;
  readonly sessionId?: string;
  readonly token: string;
}

/** Maps a processed ingest envelope onto the portable event contract. */
export const analyticsEventFromProcessed = (event: ProcessedAnalyticsEvent) => {
  const properties = storedProperties(event.properties);
  return {
    schemaVersion: 1,
    eventId: event.processedEventId,
    captureId: event.captureId,
    eventName: event.event,
    eventTimestamp: DateTime.toDateUtc(DateTime.makeUnsafe(event.eventTimestamp)),
    receivedAt: DateTime.toDateUtc(DateTime.makeUnsafe(event.receivedAt)),
    processedAt: DateTime.toDateUtc(DateTime.makeUnsafe(event.processedAt)),
    organizationId: event.organizationId,
    projectId: event.projectId,
    distinctId: event.identity.distinctId,
    previousDistinctId: previousDistinctIdFrom(properties),
    personId: event.identity.personId ?? null,
    identityMode: event.identity.mode,
    properties,
    context: event.context,
    sessionId: event.sessionId ?? null,
    token: event.token,
    requestId: event.request.requestId,
    requestPath: event.request.path ?? null,
    source: sourceForProcessedTopic(event.sourceTopic),
    sourceTopic: event.sourceTopic,
  } satisfies typeof AnalyticsEventV1.Type;
};
