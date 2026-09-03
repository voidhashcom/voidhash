import * as R from "effect/Record";
import * as Arr from "effect/Array";
import * as P from "effect/Predicate";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import type { EventContextField } from "@voidhash/generated-clients/event-capture";

import type { VoidhashTrackOptions } from "../../types";
import { BrowserPlatformProvider } from "../platform/browser-platform-provider";
import type { AnalyticsRequestEvent } from "./contracts";

const normalizeAnalyticsValue = (value: unknown): Option.Option<EventContextField> => {
  if (value === null || P.isString(value) || P.isNumber(value) || P.isBoolean(value)) {
    return Option.some(value);
  }

  if (value instanceof Date) {
    return Option.some(value.toISOString());
  }

  if (Array.isArray(value)) {
    return Option.some(Arr.getSomes(value.map((entry) => normalizeAnalyticsValue(entry))));
  }

  if (P.isObject(value)) {
    return Option.some(R.fromEntries(R.toEntries(value).flatMap(normalizeAnalyticsEntry)));
  }

  return Option.none();
};

/**
 * Normalizes a single `[key, value]` pair, dropping entries whose value has no
 * analytics-compatible representation.
 */
const normalizeAnalyticsEntry = ([key, value]: [string, unknown]): ReadonlyArray<
  [string, EventContextField]
> => {
  const normalized = normalizeAnalyticsValue(value);
  if (Option.isNone(normalized)) {
    return [];
  }

  return [[key, normalized.value]];
};

const normalizeAnalyticsRecord = (
  entries: Record<string, unknown>,
): Record<string, EventContextField> =>
  R.fromEntries(R.toEntries(entries).flatMap(normalizeAnalyticsEntry));

const createEventId = (platform: BrowserPlatformProvider) =>
  `evt_${platform.randomId().split("-").join("")}`;

/** Builds a normalized analytics event with Effect-provided time. */
export const createAnalyticsEvent = Effect.fn("createAnalyticsEvent")(function* (
  platform: BrowserPlatformProvider,
  distinctId: string,
  eventName: string,
  properties?: Record<string, unknown>,
  options?: VoidhashTrackOptions,
) {
  const timestamp = options?.timestamp ?? DateTime.formatIso(yield* DateTime.now);
  return {
    context: normalizeAnalyticsRecord(platform.buildAnalyticsContext()),
    distinct_id: distinctId,
    event: eventName,
    // Standardized properties describe the SDK and device, so they win a key conflict.
    properties: normalizeAnalyticsRecord({
      ...properties,
      ...platform.buildStandardProperties(),
    }),
    timestamp,
    session_id: options?.sessionId,
    uuid: options?.eventId ?? createEventId(platform),
  } satisfies AnalyticsRequestEvent;
});
