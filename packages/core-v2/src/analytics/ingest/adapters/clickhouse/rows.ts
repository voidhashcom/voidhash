import * as Str from "effect/String";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Schema from "effect/Schema";

import { ProcessorPersonEventV1, ProcessorPersonIdentityEventV1 } from "../../domain/Ingest.ts";
import type { AnalyticsEventV1 } from "../../../domain/AnalyticsEvent.ts";
import {
  isReservedRevenueEventName,
  REVENUE_TRUSTED_SOURCE_TOPIC,
} from "../../../domain/InternalAnalyticsEvents.ts";
import type { AnalyticsWriteBatch } from "../../../application/ports/AnalyticsStore.ts";

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

const toNullableString = (value: Option.Option<string>) =>
  Option.match(value, {
    onNone: () => null,
    onSome: (text) => (Str.isNonEmpty(text.trim()) ? text : null),
  });

class InvalidTimestampError extends Schema.TaggedErrorClass<InvalidTimestampError>(
  "InvalidTimestampError",
)("InvalidTimestampError", { message: Schema.String, value: Schema.String }) {}

export const toFlag = (value: boolean): 0 | 1 => {
  if (value) {
    return 1;
  }
  return 0;
};

/** Formats an instant as UTC DateTime64(3) text for ClickHouse rows and parameters. */
export const toClickhouseTimestamp = (value: string): string => {
  const parsed = DateTime.make(value);
  if (Option.isNone(parsed)) {
    throw new InvalidTimestampError({ message: `Invalid timestamp: ${value}`, value });
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

const toNullableTimestamp = (value: Date | typeof Schema.Null.Type) =>
  value === null ? null : toClickhouseTimestamp(value.toISOString());

/**
 * Map a storage-neutral analytics event to the ClickHouse event schema.
 * `insertedAt` is the moment the row is handed to ClickHouse; it defaults to
 * the processing time for callers that do not track the write separately.
 */
export const toAnalyticsEventRow = (
  event: typeof AnalyticsEventV1.Type,
  insertedAt: Date = event.processedAt,
): Record<string, unknown> => ({
  capture_id: event.captureId,
  context: encodeJson(event.context),
  distinct_id: event.distinctId,
  event_id: event.eventId,
  event_name: event.eventName,
  event_properties: encodeJson(event.properties),
  event_ts: toClickhouseTimestamp(event.eventTimestamp.toISOString()),
  identity_mode: event.identityMode,
  inserted_ts: toClickhouseTimestamp(insertedAt.toISOString()),
  organization_id: event.organizationId,
  person_id: event.personId,
  previous_distinct_id: event.previousDistinctId,
  processed_ts: toClickhouseTimestamp(event.processedAt.toISOString()),
  project_id: event.projectId,
  received_ts: toClickhouseTimestamp(event.receivedAt.toISOString()),
  request_id: event.requestId,
  request_path: event.requestPath ?? "",
  schema_version: event.schemaVersion,
  sent_ts: toNullableTimestamp(event.sentAt),
  session_id: event.sessionId,
  source_offset: event.sourceOffset,
  source_partition: event.sourcePartition,
  source_topic: event.sourceTopic,
  token: event.token,
  trust_class: event.trustClass,
});

export const toPersonRow = (
  event: typeof ProcessorPersonEventV1.Type,
  organizationId: string,
): Record<string, unknown> => ({
  changed_at: toClickhouseTimestamp(event.changedAt),
  organization_id: organizationId,
  person_id: event.personId,
  email: toNullableString(Option.fromNullishOr(event.email)),
  is_archived: toFlag(event.isArchived),
  merged_into_person_id: toNullableString(Option.fromNullishOr(event.mergedIntoPersonId)),
  name: toNullableString(Option.fromNullishOr(event.name)),
  primary_distinct_id: toNullableString(Option.fromNullishOr(event.primaryDistinctId)),
  project_id: event.projectId,
  traits: encodeJson(event.traits),
  version: event.version,
});

export const toPersonIdentityRow = (
  event: typeof ProcessorPersonIdentityEventV1.Type,
  organizationId: string,
): Record<string, unknown> => ({
  changed_at: toClickhouseTimestamp(event.changedAt),
  organization_id: organizationId,
  person_id: event.personId,
  distinct_id: event.distinctId,
  is_deleted: toFlag(event.isDeleted),
  previous_distinct_id: toNullableString(Option.fromNullishOr(event.previousDistinctId)),
  project_id: event.projectId,
  version: event.version,
});

export const toPendingOverrideRow = (
  event: typeof ProcessorPersonIdentityEventV1.Type,
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

const writePart = (kind: string, ...values: ReadonlyArray<string | number>) => {
  const encoded = values.map((value) => String(value)).map((value) => `${value.length}:${value}`);
  return `${kind}:${encoded.join("")}`;
};

const FNV_PRIME_32 = 16_777_619;
const FNV_OFFSET_BASIS_32 = 0x811c_9dc5;
/** Second, unrelated seed so two 32-bit lanes give 64 bits of digest. */
const FNV_ALTERNATE_BASIS_32 = 0x9747_b28c;

/** 32-bit FNV-1a over Unicode code points, as fixed-width hex. Plain integer math keeps it target-agnostic. */
const fnv1a32 = (value: string, basis: number) =>
  (
    Arr.reduce(Array.from(value), basis, (hash, character) =>
      Math.imul(hash ^ (character.codePointAt(0) ?? 0), FNV_PRIME_32),
    ) >>> 0
  )
    .toString(16)
    .padStart(8, "0");

/** Two independent 32-bit FNV-1a lanes concatenated into a 64-bit hex digest. */
const digest64 = (value: string) =>
  `${fnv1a32(value, FNV_OFFSET_BASIS_32)}${fnv1a32(value, FNV_ALTERNATE_BASIS_32)}`;

/**
 * Deterministic id for one logical write, used both as the ClickHouse insert
 * deduplication token and as the `write_id` column on every row. A delivery of
 * a hundred events would otherwise stamp kilobytes of concatenated parts onto
 * each row, so the sorted parts are digested; the record count and the
 * lexicographic bounds are kept in clear so two writes can be told apart by eye
 * and a digest collision would additionally require identical bounds.
 */
export const analyticsWriteId = (sortedWriteParts: ReadonlyArray<string>) => {
  const joined = sortedWriteParts.join("|");
  const first = sortedWriteParts[0] ?? "";
  const last = sortedWriteParts[sortedWriteParts.length - 1] ?? "";
  return `w1:${sortedWriteParts.length}:${digest64(joined)}:${digest64(first)}:${digest64(last)}`;
};

const dedupeRevenueEventsWithinBatch = (
  events: ReadonlyArray<typeof AnalyticsEventV1.Type>,
): ReadonlyArray<typeof AnalyticsEventV1.Type> => {
  const initial: {
    readonly seen: HashSet.HashSet<string>;
    readonly deduped: ReadonlyArray<typeof AnalyticsEventV1.Type>;
  } = { seen: HashSet.empty(), deduped: [] };
  const result = Arr.reduce(events, initial, (state, event) => {
    if (
      event.sourceTopic !== REVENUE_TRUSTED_SOURCE_TOPIC ||
      !isReservedRevenueEventName(event.eventName)
    ) {
      return { ...state, deduped: [...state.deduped, event] };
    }
    const key = writePart("event", event.projectId, event.eventId);
    if (HashSet.has(state.seen, key)) return state;
    return {
      deduped: [...state.deduped, event],
      seen: HashSet.add(state.seen, key),
    };
  });
  if (result.deduped.length === events.length) return events;
  return result.deduped;
};

/**
 * Map one logical analytics write to a single-partition ClickHouse record
 * block. `insertedAt` stamps every event row with the real write time.
 */
export const toAnalyticsWriteBatchRows = (
  batch: typeof AnalyticsWriteBatch.Type,
  insertedAt?: Date,
): ReadonlyArray<Record<string, unknown>> => {
  const events = dedupeRevenueEventsWithinBatch(batch.events);
  const overrideEvents = batch.personIdentityEvents.filter((event) =>
    Boolean(event.previousDistinctId && event.version > 0),
  );
  const writeParts = [
    ...events.map((event) => writePart("event", event.projectId, event.eventId)),
    ...batch.personEvents.map((event) =>
      writePart("person", event.projectId, event.personId, event.version),
    ),
    ...batch.personIdentityEvents.map((event) =>
      writePart("identity", event.projectId, event.distinctId, event.version),
    ),
  ];
  const sortedWriteParts = Arr.sort(writeParts, Order.String);
  if (Arr.isReadonlyArrayEmpty(sortedWriteParts)) return [];
  const writeId = analyticsWriteId(sortedWriteParts);
  const writeTimestamp =
    events[0]?.processedAt.toISOString() ??
    batch.personEvents[0]?.changedAt ??
    batch.personIdentityEvents[0]?.changedAt;
  if (!writeTimestamp) return [];
  const base = (input: {
    readonly organizationId: string;
    readonly projectId: string;
    readonly recordId: string;
    readonly recordType: string;
    readonly recordVersion: number;
  }) => ({
    organization_id: input.organizationId,
    project_id: input.projectId,
    record_id: input.recordId,
    record_type: input.recordType,
    record_version: input.recordVersion,
    write_id: writeId,
    write_ts: toClickhouseTimestamp(writeTimestamp),
  });
  const organizationId = (projectId: string) => batch.organizationIdsByProject[projectId] ?? "";
  return [
    ...events.map((event) => ({
      ...base({
        organizationId: event.organizationId,
        projectId: event.projectId,
        recordId: event.eventId,
        recordType: "event",
        recordVersion: event.processedAt.getTime(),
      }),
      ...toAnalyticsEventRow(event, insertedAt),
    })),
    ...batch.personEvents.map((event) => ({
      ...base({
        organizationId: organizationId(event.projectId),
        projectId: event.projectId,
        recordId: writePart("person", event.projectId, event.personId),
        recordType: "person",
        recordVersion: event.version,
      }),
      ...toPersonRow(event, organizationId(event.projectId)),
    })),
    ...batch.personIdentityEvents.map((event) => ({
      ...base({
        organizationId: organizationId(event.projectId),
        projectId: event.projectId,
        recordId: writePart("identity", event.projectId, event.distinctId),
        recordType: "identity",
        recordVersion: event.version,
      }),
      ...toPersonIdentityRow(event, organizationId(event.projectId)),
    })),
    ...overrideEvents.map((event) => ({
      ...base({
        organizationId: organizationId(event.projectId),
        projectId: event.projectId,
        recordId: writePart("override", event.projectId, event.distinctId),
        recordType: "identity_override",
        recordVersion: event.version,
      }),
      ...toPersonIdentityRow(event, organizationId(event.projectId)),
    })),
    ...overrideEvents.map((event) => ({
      ...base({
        organizationId: organizationId(event.projectId),
        projectId: event.projectId,
        recordId: writePart("pending", event.projectId, event.previousDistinctId ?? ""),
        recordType: "pending_identity_override",
        recordVersion: event.version,
      }),
      ...toPendingOverrideRow(event, organizationId(event.projectId)),
    })),
  ];
};
