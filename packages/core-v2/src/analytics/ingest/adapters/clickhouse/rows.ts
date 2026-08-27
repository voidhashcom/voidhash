import { DateTime, Option, Schema } from "effect";

import {
  extractInnerProperties,
  ProcessedEventV2,
  ProcessorPersonEventV1,
  ProcessorPersonIdentityEventV1,
} from "../../domain/Ingest.ts";
import {
  isReservedRevenueEventName,
  REVENUE_TRUSTED_SOURCE_TOPIC,
} from "../../../domain/InternalAnalyticsEvents.ts";
import type { AnalyticsEventV1 } from "../../../domain/AnalyticsEvent.ts";

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

export type AnalyticsWriterMessageType =
  | {
      readonly kind: "processed";
      readonly messageId: string;
      readonly value: typeof ProcessedEventV2.Type;
    }
  | {
      readonly kind: "person";
      readonly messageId: string;
      readonly value: typeof ProcessorPersonEventV1.Type;
    }
  | {
      readonly kind: "person-distinct-id";
      readonly messageId: string;
      readonly value: typeof ProcessorPersonIdentityEventV1.Type;
    };

/** Whether a row is a trusted revenue event with a deterministic id. */
export const isRevenueAnalyticsWriterRow = (row: Readonly<Record<string, unknown>>): boolean =>
  row.source_topic === REVENUE_TRUSTED_SOURCE_TOPIC &&
  typeof row.event_name === "string" &&
  isReservedRevenueEventName(row.event_name);

/** Collapse duplicate trusted revenue ids within one write batch. */
export const dedupeRevenueRowsWithinBatch = (
  rows: ReadonlyArray<Record<string, unknown>>,
): { readonly rows: ReadonlyArray<Record<string, unknown>>; readonly skippedCount: number } => {
  const seen = new Set<string>();
  const deduped: Array<Record<string, unknown>> = [];
  let skippedCount = 0;
  for (const row of rows) {
    if (!isRevenueAnalyticsWriterRow(row) || typeof row.event_id !== "string") {
      deduped.push(row);
      continue;
    }
    if (seen.has(row.event_id)) {
      skippedCount += 1;
      continue;
    }
    seen.add(row.event_id);
    deduped.push(row);
  }
  if (skippedCount === 0) return { rows, skippedCount };
  return { rows: deduped, skippedCount };
};

export interface AnalyticsWriterPlan {
  readonly personIdentityOverrideRows: ReadonlyArray<Record<string, unknown>>;
  readonly personIdentityPendingOverrideRows: ReadonlyArray<Record<string, unknown>>;
  readonly personIdentityRows: ReadonlyArray<Record<string, unknown>>;
  readonly personRows: ReadonlyArray<Record<string, unknown>>;
  readonly processedEventRows: ReadonlyArray<Record<string, unknown>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asRecord = (value: unknown) => {
  if (isRecord(value)) {
    return value;
  }
  return {};
};

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

export const extractPreviousDistinctId = (event: typeof ProcessedEventV2.Type): string | null => {
  const wrappedProperties = asRecord(event.properties);
  const innerProperties = extractInnerProperties(wrappedProperties);
  const previousDistinctId = innerProperties.$previous_distinct_id;
  if (typeof previousDistinctId !== "string") {
    return null;
  }
  return toNullableString(previousDistinctId);
};

export const toProcessedEventRow = (
  event: typeof ProcessedEventV2.Type,
  insertedAt: Date,
): Record<string, unknown> => ({
  capture_id: event.captureId,
  context: encodeJson(event.context),
  person_id: toNullableString(event.identity.personId),
  distinct_id: event.identity.distinctId,
  event_id: event.processedEventId,
  event_name: event.event,
  event_properties: encodeJson(event.properties),
  event_ts: toClickhouseTimestamp(event.eventTimestamp),
  identity_mode: event.identity.mode,
  // The write moment, as opposed to `processed_ts` (pipeline acceptance) and
  // `event_ts` (client clock); stamped once per batch by the writer.
  inserted_ts: toClickhouseTimestamp(insertedAt.toISOString()),
  organization_id: event.organizationId,
  previous_distinct_id: extractPreviousDistinctId(event),
  processed_ts: toClickhouseTimestamp(event.processedAt),
  project_id: event.projectId,
  request_id: event.request.requestId,
  request_path: event.request.path ?? "",
  schema_version: event.schemaVersion,
  source_offset: event.transport.sourceOffset,
  source_partition: event.transport.sourcePartition,
  source_topic: event.transport.sourceTopic,
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

/**
 * Builds the per-table ClickHouse row plan. Person/identity rows carry an
 * `organization_id` resolved from their `project_id` via `organizationIdForProject`
 * (the writer resolves this through its metadata port); processed-event rows already carry the
 * organization id from the upstream {@link ProcessedEventV2}. An unknown project
 * resolves to `""`, which the readonly RLS user's row policy treats as not
 * matching any tenant (fail-closed).
 */
export const buildAnalyticsWriterPlan = (
  messages: ReadonlyArray<AnalyticsWriterMessageType>,
  organizationIdForProject: (projectId: string) => string,
  insertedAt: Date,
): AnalyticsWriterPlan => {
  const processedEventRows: Array<Record<string, unknown>> = [];
  const personRows: Array<Record<string, unknown>> = [];
  const personIdentityRows: Array<Record<string, unknown>> = [];
  const personIdentityOverrideRows: Array<Record<string, unknown>> = [];
  const personIdentityPendingOverrideRows: Array<Record<string, unknown>> = [];

  for (const message of messages) {
    switch (message.kind) {
      case "processed":
        processedEventRows.push(toProcessedEventRow(message.value, insertedAt));
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
