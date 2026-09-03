import * as P from "effect/Predicate";
import * as Str from "effect/String";
/**
 * Analytics-ingest domain. Owns the wire-stable capture and processor
 * contracts plus their pure validation rules.
 *
 * Wire-stable schemas (consumers across processes must keep these stable):
 * - {@link CapturedEventV1} — capture → processor envelope.
 * - {@link ProcessorPersonEventV1} — processor → writer (person snapshot).
 * - {@link ProcessorPersonIdentityEventV1} — processor → writer (identity map).
 */
import { emptyEventAdmissionPolicy, EventAdmissionPolicy } from "./EventAdmission.ts";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

// =============================================================================
// Captured event (capture → processor)
// =============================================================================

/** Wire timestamp retained as a string but rejected unless it parses as a valid date. */
export const AnalyticsTimestamp = Schema.String.pipe(
  Schema.refine((value): value is string => Option.isSome(DateTime.make(value)), {
    expected: "a valid analytics timestamp",
  }),
);
export type AnalyticsTimestamp = typeof AnalyticsTimestamp.Type;

export const CapturedEventRequest = Schema.Struct({
  path: Schema.optional(Schema.String),
  requestId: Schema.String,
  userAgent: Schema.optional(Schema.String),
  clientIp: Schema.optional(Schema.String),
  isInternal: Schema.optional(Schema.Boolean),
});
export type CapturedEventRequest = typeof CapturedEventRequest.Type;

type EventPropertiesFieldPrimitive = string | number | boolean | typeof Schema.Null.Type;
type EventPropertiesField =
  | EventPropertiesFieldPrimitive
  | ReadonlyArray<EventPropertiesField>
  | { readonly [key: string]: EventPropertiesField };

const EventPropertiesFieldCodec: Schema.Codec<EventPropertiesField> = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.Boolean,
  Schema.Null,
  Schema.Array(Schema.suspend((): Schema.Codec<EventPropertiesField> => EventPropertiesFieldCodec)),
  Schema.Record(
    Schema.String,
    Schema.suspend((): Schema.Codec<EventPropertiesField> => EventPropertiesFieldCodec),
  ),
]);
export const EventProperties = Schema.Record(Schema.String, EventPropertiesFieldCodec);
export type EventProperties = typeof EventProperties.Type;

type EventContextFieldPrimitive = string | number | boolean | typeof Schema.Null.Type;
type EventContextField =
  | EventContextFieldPrimitive
  | ReadonlyArray<EventContextField>
  | { readonly [key: string]: EventContextField };

const EventContextFieldCodec: Schema.Codec<EventContextField> = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.Boolean,
  Schema.Null,
  Schema.Array(Schema.suspend((): Schema.Codec<EventContextField> => EventContextFieldCodec)),
  Schema.Record(
    Schema.String,
    Schema.suspend((): Schema.Codec<EventContextField> => EventContextFieldCodec),
  ),
]);
export const EventContext = Schema.Record(Schema.String, EventContextFieldCodec);
export type EventContext = typeof EventContext.Type;

/**
 * The identity the capture layer asserts for an event, as a tagged claim the
 * processor honours:
 *  - `Anonymous` — SDK pre-identify; the processor resolves / creates identity.
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
  eventTimestamp: AnalyticsTimestamp,
  receivedAt: AnalyticsTimestamp,
  sentAt: Schema.optional(AnalyticsTimestamp),
  sourceTopic: Schema.String,
  properties: EventProperties,
  context: EventContext,
  /**
   * Legacy copy of the decoded request event. Nothing downstream reads it and
   * it doubled every queue message, so new envelopes omit it; it stays optional
   * so in-flight messages from older producers still decode.
   */
  rawPayload: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  request: CapturedEventRequest,
  identityClaim: Schema.optional(CapturedIdentityClaim),
  trustClass: Schema.optional(TrustClass),
});
export type CapturedEventV1 = typeof CapturedEventV1.Type;

// =============================================================================
// Processor outputs (person snapshot / identity event)
// =============================================================================

export const ProcessorPersonEventV1 = Schema.Struct({
  changedAt: AnalyticsTimestamp,
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
export type ProcessorPersonEventV1 = typeof ProcessorPersonEventV1.Type;

export const ProcessorPersonIdentityEventV1 = Schema.Struct({
  changedAt: AnalyticsTimestamp,
  personId: Schema.String,
  distinctId: Schema.String,
  isDeleted: Schema.Boolean,
  previousDistinctId: Schema.optional(Schema.String),
  projectId: Schema.String,
  schemaVersion: Schema.Literal(1),
  version: Schema.Number,
});
export type ProcessorPersonIdentityEventV1 = typeof ProcessorPersonIdentityEventV1.Type;

// =============================================================================
// Capture project policy
// =============================================================================

export const CaptureProjectPolicy = Schema.Struct({
  /** Which event names this project stores, layered over the built-in registry defaults. */
  admission: EventAdmissionPolicy,
  eventsPerDay: Schema.optional(Schema.Int),
  isIngestEnabled: Schema.Boolean,
  projectId: Schema.String,
  requestsPerMinute: Schema.optional(Schema.Int),
});
export type CaptureProjectPolicy = typeof CaptureProjectPolicy.Type;

export const defaultCaptureProjectPolicy = (projectId: string) =>
  ({
    admission: emptyEventAdmissionPolicy,
    isIngestEnabled: true,
    projectId,
  }) satisfies typeof CaptureProjectPolicy.Type;

// =============================================================================
// Transport record + DLQ event
// =============================================================================

export const CapturedTransportRecord = Schema.Struct({
  capturedEvent: CapturedEventV1,
  headers: Schema.Record(Schema.String, Schema.String),
  rawKey: Schema.optional(Schema.String),
  rawValue: Schema.String,
  sourceOffset: Schema.String,
  sourcePartition: Schema.Int,
  sourceTopic: Schema.String,
});
export type CapturedTransportRecord = typeof CapturedTransportRecord.Type;

export const EventProcessorDlqV1 = Schema.Struct({
  captureId: Schema.optional(Schema.String),
  distinctId: Schema.optional(Schema.String),
  failedAt: AnalyticsTimestamp,
  failureClass: Schema.Literals([
    "captured_event_invalid",
    "policy_rejected",
    "project_not_found",
    "reserved_event_name",
    "schema_rejected",
    "transport_invalid",
  ]),
  failureId: Schema.String,
  failureMessage: Schema.String,
  headers: Schema.Record(Schema.String, Schema.String),
  projectId: Schema.optional(Schema.String),
  rawKey: Schema.optional(Schema.String),
  rawValue: Schema.optional(Schema.String),
  schemaVersion: Schema.Literal(1),
  sourceOffset: Schema.String,
  sourcePartition: Schema.Number,
  sourceTopic: Schema.String,
  token: Schema.optional(Schema.String),
});
export type EventProcessorDlqV1 = typeof EventProcessorDlqV1.Type;

export const buildDlqEvent = ({
  captureId,
  distinctId,
  failureClass,
  failureMessage,
  headers,
  projectId,
  rawKey,
  rawValue,
  sourceOffset,
  sourcePartition,
  sourceTopic,
  token,
}: Omit<typeof EventProcessorDlqV1.Type, "failedAt" | "failureId" | "schemaVersion">) =>
  Effect.gen(function* () {
    // Absent optionals are omitted entirely (never present-but-undefined), so the
    // DLQ record stays minimal on the wire.
    const optional: {
      -readonly [K in
        | "captureId"
        | "distinctId"
        | "projectId"
        | "rawKey"
        | "rawValue"
        | "token"]?: (typeof EventProcessorDlqV1.Type)[K];
    } = {};
    if (captureId) optional.captureId = captureId;
    if (distinctId) optional.distinctId = distinctId;
    if (projectId) optional.projectId = projectId;
    if (rawKey) optional.rawKey = rawKey;
    if (rawValue) optional.rawValue = rawValue;
    if (token) optional.token = token;

    const crypto = yield* Crypto.Crypto;
    const failedAt = yield* DateTime.nowAsDate;
    return {
      ...optional,
      failedAt: failedAt.toISOString(),
      failureClass,
      failureId: yield* crypto.randomUUIDv4,
      failureMessage,
      headers,
      schemaVersion: 1,
      sourceOffset,
      sourcePartition,
      sourceTopic,
    } satisfies typeof EventProcessorDlqV1.Type;
  });

// =============================================================================
// Person-trait helpers (pure)
// =============================================================================

export interface PersonTraits {
  readonly setOnce: Record<string, unknown>;
  readonly set: Record<string, unknown>;
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  P.isObject(value) && value !== null && !Array.isArray(value);

export const parsePersonTraits = (
  properties: Record<string, unknown>,
):
  | { readonly ok: true; readonly value: PersonTraits }
  | { readonly ok: false; readonly message: string } => {
  const rawSet = properties.$set;
  if (!P.isUndefined(rawSet) && !isPlainRecord(rawSet)) {
    return { message: "$set must be an object", ok: false };
  }

  const rawSetOnce = properties.$set_once;
  if (!P.isUndefined(rawSetOnce) && !isPlainRecord(rawSetOnce)) {
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

export const extractInnerProperties = (wrappedProperties: Record<string, unknown>) => {
  const inner = wrappedProperties.properties;
  if (isPlainRecord(inner)) {
    return inner;
  }
  return wrappedProperties;
};

// =============================================================================
// Processor project policy + validation rules
// =============================================================================

export const ProcessorProjectPolicy = Schema.Struct({
  /** Which event names this project stores, layered over the built-in registry defaults. */
  admission: EventAdmissionPolicy,
  isProcessorEnabled: Schema.Boolean,
});
export type ProcessorProjectPolicy = typeof ProcessorProjectPolicy.Type;

export const ResolvedProcessorProject = Schema.Struct({
  organizationId: Schema.String,
  policy: ProcessorProjectPolicy,
  projectId: Schema.String,
});
export type ResolvedProcessorProject = typeof ResolvedProcessorProject.Type;

export const ANONYMOUS_DISTINCT_ID_PREFIX = "vh:anon:";

export const validateBuiltInProcessorRules = ({
  capturedEvent,
  sourceTopic,
}: {
  readonly capturedEvent: typeof CapturedEventV1.Type;
  readonly sourceTopic: string;
}) => {
  if (capturedEvent.sourceTopic !== sourceTopic) {
    return "captured event source topic does not match transport topic";
  }

  const innerProperties = extractInnerProperties(capturedEvent.properties);

  const traitsResult = parsePersonTraits(innerProperties);
  if (!traitsResult.ok) return traitsResult.message;

  const rawProcessPersonProfile = capturedEvent.properties.$process_person_profile;
  if (!P.isUndefined(rawProcessPersonProfile) && !P.isBoolean(rawProcessPersonProfile)) {
    return "$process_person_profile must be a boolean";
  }

  if (capturedEvent.event === "$identify") {
    const rawPreviousDistinctId = innerProperties.$previous_distinct_id;
    if (!P.isString(rawPreviousDistinctId) || Str.isEmpty(rawPreviousDistinctId)) {
      return "$identify requires properties.$previous_distinct_id";
    }
    if (capturedEvent.distinctId.startsWith(ANONYMOUS_DISTINCT_ID_PREFIX)) {
      return "$identify target distinct id cannot use the anonymous prefix";
    }
  }

  return undefined;
};

export { EventProperties as EventPropertiesSchema };
export { EventContext as EventContextSchema };
