import * as R from "effect/Record";
import * as Arr from "effect/Array";
import * as P from "effect/Predicate";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import type { EventContextField } from "@voidhash/generated-clients/event-capture";

import type { VoidhashTrackOptions } from "../../types";
import { BrowserPlatformProvider } from "../platform/browser-platform-provider";
import type { AnalyticsRequestEvent } from "./contracts";

/** Deepest nesting of arrays and objects kept in event properties. */
const MAX_PROPERTY_DEPTH = 10;

/**
 * An object literal or `Object.create(null)`, from any realm. Class instances,
 * DOM nodes, and framework events are not: walking them can reach the whole
 * page, as a React event does through its target.
 */
export const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!P.isObject(value) || P.isFunction(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || Object.getPrototypeOf(prototype) === null;
};

/**
 * The JSON value of an event property: scalars, dates, values with a `toJSON`
 * method (as `JSON.stringify` reads them), and arrays and plain objects of
 * those. Anything else, a value nested deeper than {@link MAX_PROPERTY_DEPTH},
 * and a reference back to an enclosing value are left out, so a stray object
 * can never hang or overflow the page.
 */
const normalizeAnalyticsValue = (
  value: unknown,
  ancestors: ReadonlyArray<object>,
): Option.Option<EventContextField> => {
  if (value === null || P.isString(value) || P.isNumber(value) || P.isBoolean(value)) {
    return Option.some(value);
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? Option.none() : Option.some(value.toISOString());
  }

  if (!P.isObject(value) || ancestors.length >= MAX_PROPERTY_DEPTH || ancestors.includes(value)) {
    return Option.none();
  }

  const nested = [...ancestors, value];
  const toJSON = P.hasProperty(value, "toJSON") ? value.toJSON : undefined;
  if (P.isFunction(toJSON)) {
    return Option.flatMap(
      Result.getSuccess(Result.try({ catch: (error) => error, try: () => toJSON.call(value) })),
      (json) => normalizeAnalyticsValue(json, nested),
    );
  }
  if (Array.isArray(value)) {
    return Option.some(Arr.getSomes(value.map((entry) => normalizeAnalyticsValue(entry, nested))));
  }
  return isPlainObject(value)
    ? Option.some(normalizeAnalyticsRecord(value, nested))
    : Option.none();
};

/** The JSON form of event properties or context; see {@link normalizeAnalyticsValue}. */
export const normalizeAnalyticsRecord = (
  entries: Record<string, unknown>,
  ancestors: ReadonlyArray<object> = [],
): Record<string, EventContextField> =>
  R.fromEntries(
    R.toEntries(entries).flatMap(([key, value]) =>
      Arr.fromOption(
        Option.map(
          normalizeAnalyticsValue(value, ancestors),
          (normalized): [string, EventContextField] => [key, normalized],
        ),
      ),
    ),
  );

export const createEventId = (platform: BrowserPlatformProvider) =>
  `evt_${platform.randomId().split("-").join("")}`;

/**
 * Builds a normalized analytics event with Effect-provided time. `context` is
 * the page context the SDK may record, from `buildAnalyticsContext`.
 */
export const createAnalyticsEvent = Effect.fnUntraced(function* createAnalyticsEvent(
  platform: BrowserPlatformProvider,
  distinctId: string,
  eventName: string,
  context: Record<string, unknown>,
  properties?: Record<string, unknown>,
  options?: VoidhashTrackOptions,
) {
  const timestamp =
    options?.timestamp ??
    // oxlint-disable-next-line effect/use-clock-service -- formats the time read from the Clock service.
    new Date(yield* Clock.currentTimeMillis).toISOString();
  return {
    context: normalizeAnalyticsRecord(context),
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
