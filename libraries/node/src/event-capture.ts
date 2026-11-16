import type {
  CaptureEvent,
  EventCaptureCaptureRequest,
  VoidhashEventCaptureClient,
} from "@voidhash/generated-clients/event-capture";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Str from "effect/String";

type EffectError<TEffect> =
  TEffect extends Effect.Effect<infer _Success, infer Error, infer _Requirements> ? Error : never;

type CaptureError = EffectError<ReturnType<VoidhashEventCaptureClient["eventCaptureCapture"]>>;

type BatchError = EffectError<ReturnType<VoidhashEventCaptureClient["eventCaptureBatch"]>>;

/** How ingest handled a request: how many events it took and how many it discarded. */
export type VoidhashCaptureResult = {
  readonly accepted: number;
  readonly rejected: number;
};

/** A single analytics event, in the SDK's camelCase shape. */
export type VoidhashCaptureEvent = {
  /**
   * Deduplication key. A UUIDv4 is generated when omitted; set it explicitly —
   * and reuse it — to make retries of the same event idempotent.
   */
  readonly uuid?: string;
  /** Event name, for example `"paywall_viewed"`. */
  readonly event: string;
  /** Identifies the person the event belongs to. */
  readonly distinctId: string;
  /** The event's own attributes. Sent as `{}` when omitted. */
  readonly properties?: Record<string, unknown>;
  /** Ambient attributes (app version, platform, locale). Sent as `{}` when omitted. */
  readonly context?: Record<string, unknown>;
  /** Groups events into a session. Omitted from the request when unset. */
  readonly sessionId?: string;
  /**
   * The groups the event belongs to, by group type, such as `{ company: "acme" }`: sent as the
   * `$groups` property, where a group already named in `properties.$groups` wins for its type.
   */
  readonly groups?: Readonly<Record<string, string>>;
  /** ISO 8601 time the event occurred. */
  readonly timestamp: string;
};

/** A group property's value: text, a number or a boolean. */
export type VoidhashGroupPropertyValue = string | number | boolean;

/** What `groupIdentify` sets on one group, such as a company. */
export type VoidhashGroupIdentify = {
  /** The group type's key, such as `"company"`: a lower-case letter, then up to 63 lower-case letters, digits or underscores. */
  readonly groupType: string;
  /** The group's key within its type, as your events name it in `groups`, such as the company's id. */
  readonly groupKey: string;
  /** Properties to set, replacing their values, such as `name`, `plan` or `seats`. */
  readonly properties?: Readonly<Record<string, VoidhashGroupPropertyValue>>;
  /** Properties to set only where the group has no value yet. */
  readonly setOnce?: Readonly<Record<string, VoidhashGroupPropertyValue>>;
  /** ISO 8601 time of the change; now when omitted. Later changes of a property win. */
  readonly timestamp?: string;
  /** Deduplication key; a UUIDv4 when omitted. Reuse it to make retries idempotent. */
  readonly uuid?: string;
};

export interface VoidhashEventCaptureEffectNamespace {
  /** Posts one event to the ingestion API. */
  readonly capture: (
    event: VoidhashCaptureEvent,
  ) => Effect.Effect<VoidhashCaptureResult, CaptureError>;
  /**
   * Posts several events in a single request. All events share one `sent_at`
   * stamp; each still carries its own uuid and occurrence timestamp. An empty
   * array is a no-op — the API rejects a batch without events.
   */
  readonly batch: (
    events: ReadonlyArray<VoidhashCaptureEvent>,
  ) => Effect.Effect<VoidhashCaptureResult, BatchError>;
  /**
   * Sets a group's properties, such as a company's plan and seats, by sending a `$groupidentify`
   * event. It belongs to no person; events name the group with `groups`.
   */
  readonly groupIdentify: (
    group: VoidhashGroupIdentify,
  ) => Effect.Effect<VoidhashCaptureResult, CaptureError>;
}

/**
 * Fills in what the ingestion API requires and renames the fields to their
 * snake_case wire names.
 */
const prepareEvent = (event: VoidhashCaptureEvent): CaptureEvent => ({
  context: event.context ?? {},
  distinct_id: event.distinctId,
  event: event.event,
  properties: withGroups(event.properties ?? {}, event.groups ?? {}),
  session_id: event.sessionId,
  timestamp: event.timestamp,
  uuid: event.uuid ?? globalThis.crypto.randomUUID(),
});

/** `properties` with `groups` as `$groups`; a group `properties.$groups` names wins for its type. */
const withGroups = (
  properties: Record<string, unknown>,
  groups: Readonly<Record<string, string>>,
) => {
  if (R.isEmptyRecord(groups)) return properties;
  const own = properties.$groups;
  return { ...properties, $groups: { ...groups, ...(P.isObject(own) ? own : {}) } };
};

/**
 * The distinct id a `$groupidentify` is sent with. It belongs to no person, so the id only has
 * to be valid; it names the group where it fits in 255 characters.
 */
const groupDistinctId = (groupType: string, groupKey: string) => {
  const named = `$group_${groupType}_${groupKey}`;
  return named.length <= 255 ? named : `$group_${groupType}`;
};

/** The `$groupidentify` event that sets `group`'s properties. */
const groupIdentifyEvent = (group: VoidhashGroupIdentify, now: string): VoidhashCaptureEvent => ({
  distinctId: groupDistinctId(group.groupType, group.groupKey),
  event: "$groupidentify",
  properties: {
    $group_type: group.groupType,
    $group_key: group.groupKey,
    $group_set: group.properties ?? {},
    ...(group.setOnce !== undefined && { $group_set_once: group.setOnce }),
  },
  timestamp: group.timestamp ?? now,
  ...(group.uuid !== undefined && { uuid: group.uuid }),
});

/** Normalizes a configured key, treating a blank string as "not configured". */
const presentedToken = (publishableKey?: string): Option.Option<string> => {
  const token = publishableKey?.trim();
  if (token === undefined || Str.isEmpty(token)) return Option.none();
  return Option.some(token);
};

/**
 * Wraps the generated ingestion client in the SDK's `eventCapture` namespace.
 *
 * The client authorizes with the `x-secret-key` header, so a backend needs no
 * publishable key. When one is configured anyway it is sent as the body
 * `token`, matching how the browser and mobile SDKs authorize.
 */
export const makeEventCapture = (
  client: VoidhashEventCaptureClient,
  publishableKey?: string,
): VoidhashEventCaptureEffectNamespace => {
  const tokenPatch: Pick<EventCaptureCaptureRequest, "token"> = {
    token: Option.getOrUndefined(presentedToken(publishableKey)),
  };

  return {
    batch: (events) =>
      Effect.gen(function* () {
        if (Arr.isReadonlyArrayEmpty(events)) {
          return { accepted: 0, rejected: 0 };
        }

        const sentAt = yield* DateTime.now;

        return yield* client.eventCaptureBatch({
          payload: {
            events: events.map(prepareEvent),
            sent_at: DateTime.formatIso(sentAt),
            ...tokenPatch,
          },
        });
      }),
    capture: (event) =>
      Effect.gen(function* () {
        const sentAt = yield* DateTime.now;

        return yield* client.eventCaptureCapture({
          payload: {
            ...prepareEvent(event),
            sent_at: DateTime.formatIso(sentAt),
            ...tokenPatch,
          },
        });
      }),
    groupIdentify: (group) =>
      Effect.gen(function* () {
        const sentAt = DateTime.formatIso(yield* DateTime.now);

        return yield* client.eventCaptureCapture({
          payload: {
            ...prepareEvent(groupIdentifyEvent(group, sentAt)),
            sent_at: sentAt,
            ...tokenPatch,
          },
        });
      }),
  };
};
