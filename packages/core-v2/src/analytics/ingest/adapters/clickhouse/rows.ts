import { DateTime, Option, Schema } from "effect";

import { ProcessorPersonEventV1, ProcessorPersonIdentityEventV1 } from "../../domain/Ingest.ts";
import type { AnalyticsEventV1 } from "../../../domain/AnalyticsEvent.ts";
import {
  isReservedRevenueEventName,
  REVENUE_TRUSTED_SOURCE_TOPIC,
} from "../../../domain/InternalAnalyticsEvents.ts";
import type { AnalyticsWriteBatch } from "../../../application/ports/AnalyticsStore.ts";

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

const toNullableString = (value: string | undefined) => {
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
    // oxlint-disable-next-line effect/noThrowStatement, effect/noNewError -- synchronous ClickHouse row mapper used inside plain object literals (see the row builders below); it has no Effect channel, and an unparseable timestamp at this point is a defect.
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

/** Map a storage-neutral analytics event to the ClickHouse event schema. */
export const toAnalyticsEventRow = (
  event: typeof AnalyticsEventV1.Type,
): Record<string, unknown> => ({
  capture_id: event.captureId,
  context: encodeJson(event.context),
  distinct_id: event.distinctId,
  event_id: event.eventId,
  event_name: event.eventName,
  event_properties: encodeJson(event.properties),
  event_ts: toClickhouseTimestamp(event.eventTimestamp.toISOString()),
  identity_mode: event.identityMode,
  inserted_ts: toClickhouseTimestamp(event.processedAt.toISOString()),
  organization_id: event.organizationId,
  person_id: event.personId,
  previous_distinct_id: event.previousDistinctId,
  processed_ts: toClickhouseTimestamp(event.processedAt.toISOString()),
  project_id: event.projectId,
  received_ts: toClickhouseTimestamp(event.receivedAt.toISOString()),
  request_id: event.requestId,
  request_path: event.requestPath ?? "",
  schema_version: event.schemaVersion,
  session_id: event.sessionId,
  source_offset: "",
  source_partition: 0,
  source_topic: event.sourceTopic,
  token: event.token,
});

export const toPersonRow = (
  event: typeof ProcessorPersonEventV1.Type,
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
  event: typeof ProcessorPersonIdentityEventV1.Type,
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

const dedupeRevenueEventsWithinBatch = (
  events: ReadonlyArray<typeof AnalyticsEventV1.Type>,
): ReadonlyArray<typeof AnalyticsEventV1.Type> => {
  const seen = new Set<string>();
  const deduped: Array<typeof AnalyticsEventV1.Type> = [];
  for (const event of events) {
    if (
      event.sourceTopic !== REVENUE_TRUSTED_SOURCE_TOPIC ||
      !isReservedRevenueEventName(event.eventName)
    ) {
      deduped.push(event);
      continue;
    }
    const key = writePart("event", event.projectId, event.eventId);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(event);
  }
  if (deduped.length === events.length) return events;
  return deduped;
};

/** Map one logical analytics write to a single-partition ClickHouse record block. */
export const toAnalyticsWriteBatchRows = (
  batch: typeof AnalyticsWriteBatch.Type,
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
  ].sort();
  if (writeParts.length === 0) return [];
  const writeId = writeParts.join("|");
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
      ...toAnalyticsEventRow(event),
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
