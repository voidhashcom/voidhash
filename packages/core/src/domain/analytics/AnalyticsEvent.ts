import type { CaptureEvent } from "@voidhash/api-contracts/event-capture";
import { constant } from "@voidhash/lib/lang";
import { DateTime, Schema } from "effect";

import {
  sourceTopicForInternalAnalyticsEvent,
  type InternalAnalyticsEvent,
} from "../internalAnalytics/InternalAnalyticsEvents.ts";

/** SDK events retained by the Community analytics implementation. */
export const COMMUNITY_CAPTURE_EVENT_NAMES = constant([
  "$app_installed",
  "$app_updated",
  "$app_opened",
  "$app_backgrounded",
  "$app_became_active",
  "$sign_out",
]);

export type CommunityCaptureEventName = (typeof COMMUNITY_CAPTURE_EVENT_NAMES)[number];

const communityCaptureEventNames: ReadonlySet<string> = new Set(COMMUNITY_CAPTURE_EVENT_NAMES);

/** Whether a public SDK event is supported by Community analytics. */
export const isCommunityCaptureEventName = (
  eventName: string,
): eventName is CommunityCaptureEventName => communityCaptureEventNames.has(eventName);

export const AnalyticsEventSource = Schema.Literals(["sdk", "revenue", "internal"]);
export type AnalyticsEventSource = typeof AnalyticsEventSource.Type;

/**
 * Storage-neutral event shared by the PostgreSQL and hosted analytics
 * implementations. The fields intentionally track the hosted processed-event
 * record so a Community export can be imported without semantic remapping.
 */
export const AnalyticsEventV1 = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  eventId: Schema.String,
  captureId: Schema.String,
  eventName: Schema.String,
  eventTimestamp: Schema.Date,
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

export type AnalyticsEventV1 = typeof AnalyticsEventV1.Type;

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

const identityModeForPerson = (personId: string | null): "full" | "personless" => {
  if (personId) return "full";
  return "personless";
};

const sourceForInternalEvent = (eventName: string): AnalyticsEventSource => {
  if (eventName === "$experiment.exposed") return "internal";
  return "revenue";
};

const previousDistinctIdFrom = (properties: Readonly<Record<string, unknown>>): string | null => {
  if (typeof properties.$previous_distinct_id === "string") {
    return properties.$previous_distinct_id;
  }
  return null;
};

const sourceForHostedTopic = (sourceTopic: string): AnalyticsEventSource => {
  if (sourceTopic.startsWith("revenue.")) return "revenue";
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
  readonly sentAt: Date;
  readonly token: string;
}): AnalyticsEventV1 => {
  const eventTimestamp = input.event.timestamp ?? input.sentAt ?? input.receivedAt;
  return {
    schemaVersion: 1,
    eventId: input.event.uuid,
    captureId: `capture_${input.event.uuid}`,
    eventName: input.event.event,
    eventTimestamp,
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
    sourceTopic: "community.capture.v1",
  };
};

/** Maps a server-trusted event onto the same portable event contract. */
export const analyticsEventFromInternal = (
  event: InternalAnalyticsEvent,
  processedAt: Date = DateTime.toDateUtc(DateTime.nowUnsafe()),
): AnalyticsEventV1 => ({
  schemaVersion: 1,
  eventId: event.eventId,
  captureId: `internal_${event.eventId}`,
  eventName: event.eventName,
  eventTimestamp: event.occurredAt,
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
});

/**
 * Structural hosted processed-event shape accepted by the compatibility
 * mapper. Kept independent of the queue schema so shared tests do not depend
 * on a particular transport implementation.
 */
export interface HostedProcessedAnalyticsEvent {
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
  readonly processedEventId: string;
  readonly projectId: string;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly request: { readonly path?: string; readonly requestId: string };
  readonly routing: { readonly sourceTopic: string };
  readonly sessionId?: string;
  readonly token: string;
}

/** Maps the hosted processed-event envelope onto the portable contract. */
export const analyticsEventFromHostedProcessed = (
  event: HostedProcessedAnalyticsEvent,
): AnalyticsEventV1 => {
  const properties = storedProperties(event.properties);
  return {
    schemaVersion: 1,
    eventId: event.processedEventId,
    captureId: event.captureId,
    eventName: event.event,
    eventTimestamp: DateTime.toDateUtc(DateTime.makeUnsafe(event.eventTimestamp)),
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
    source: sourceForHostedTopic(event.routing.sourceTopic),
    sourceTopic: event.routing.sourceTopic,
  };
};
