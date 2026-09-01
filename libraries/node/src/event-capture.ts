import type {
  CaptureEvent,
  EventCaptureCaptureRequest,
  VoidhashEventCaptureClient,
} from "@voidhash/generated-clients/event-capture";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
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
  /** ISO 8601 time the event occurred. */
  readonly timestamp: string;
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
}

/**
 * Fills in what the ingestion API requires and renames the fields to their
 * snake_case wire names.
 */
const prepareEvent = (event: VoidhashCaptureEvent): CaptureEvent => ({
  context: event.context ?? {},
  distinct_id: event.distinctId,
  event: event.event,
  properties: event.properties ?? {},
  session_id: event.sessionId,
  timestamp: event.timestamp,
  uuid: event.uuid ?? globalThis.crypto.randomUUID(),
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
  };
};
