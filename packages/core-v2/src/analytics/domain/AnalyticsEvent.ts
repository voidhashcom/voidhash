import { DateTime, Schema } from "effect";

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

const sourceForProcessedTopic = (sourceTopic: string) => {
  if (sourceTopic.startsWith("revenue.")) return "revenue";
  if (sourceTopic.startsWith("experiment.")) return "internal";
  return "sdk";
};

const previousDistinctIdFrom = (properties: Readonly<Record<string, unknown>>) => {
  if (typeof properties.$previous_distinct_id === "string") {
    return properties.$previous_distinct_id;
  }
  return null;
};

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
