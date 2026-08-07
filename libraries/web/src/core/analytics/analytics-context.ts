import { DateTime, Effect } from "effect";

import type {
  EventContextField,
  EventPropertiesField,
} from "@voidhash/generated-clients/event-capture";

import type { VoidhashTrackOptions } from "../../types";
import { BrowserPlatformProvider } from "../platform/browser-platform-provider";
import type { AnalyticsRequestEvent } from "./contracts";

const normalizeAnalyticsValue = (
  value: unknown,
): EventContextField | EventPropertiesField | undefined => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeAnalyticsValue(entry))
      .filter((entry) => typeof entry !== "undefined");
  }

  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).flatMap(normalizeAnalyticsEntry));
  }

  return undefined;
};

/**
 * Normalizes a single `[key, value]` pair, dropping entries whose value has no
 * analytics-compatible representation.
 */
const normalizeAnalyticsEntry = ([key, value]: [string, unknown]): ReadonlyArray<
  [string, EventContextField | EventPropertiesField]
> => {
  const normalized = normalizeAnalyticsValue(value);
  if (typeof normalized === "undefined") {
    return [];
  }

  return [[key, normalized]];
};

const normalizeAnalyticsRecord = (
  entries: Record<string, unknown>,
): Record<string, EventContextField | EventPropertiesField> =>
  Object.fromEntries(Object.entries(entries).flatMap(normalizeAnalyticsEntry));

const currentTimestamp = () => Effect.runSync(Effect.map(DateTime.now, DateTime.formatIso));

const createEventId = (platform: BrowserPlatformProvider) =>
  `evt_${platform.randomId().split("-").join("")}`;

export const createAnalyticsEvent = (
  platform: BrowserPlatformProvider,
  distinctId: string,
  eventName: string,
  properties?: Record<string, unknown>,
  options?: VoidhashTrackOptions,
): AnalyticsRequestEvent => ({
  context: normalizeAnalyticsRecord(platform.buildAnalyticsContext()),
  distinct_id: distinctId,
  event: eventName,
  properties: normalizeAnalyticsRecord(properties ?? {}),
  timestamp: options?.timestamp ?? currentTimestamp(),
  session_id: options?.sessionId,
  uuid: options?.eventId ?? createEventId(platform),
});
