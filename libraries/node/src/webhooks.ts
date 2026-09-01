import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";
const effectDecodeJson = Schema.decodeUnknownSync(Schema.UnknownFromJsonString);


/**
 * Lifecycle events Voidhash can deliver to a webhook endpoint.
 *
 * Source of truth lives server side in
 * `packages/core/src/services/webhookManager/event-types.ts` and
 * `packages/api-contracts/src/Schema.ts` (`WebhookEventType`). Keep this tuple
 * in sync when new events ship — receivers still get unknown event names as
 * plain strings, so an out-of-date SDK never drops a delivery.
 */
// oxlint-disable-next-line effect/noAs -- `as const` is what makes this tuple the single source of truth for `WebhookEventType` below; `satisfies` widens the elements back to `string`, and spelling the union out separately would let the two drift apart silently.
export const WEBHOOK_EVENT_TYPES = [
  "person.created",
  "person.updated",
  "person.deleted",
  "subscription.created",
  "subscription.renewed",
  "subscription.cancelled",
  "subscription.expired",
  "purchase.completed",
  "purchase.refunded",
] as const;

/** A lifecycle event name a webhook endpoint can subscribe to. */
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

/**
 * Event name carried by the `X-Webhook-Event` header. Besides the subscribable
 * {@link WebhookEventType} values, Voidhash sends `test.ping` when an endpoint
 * is tested from Studio or through `webhooks.testWebhookEndpoint`.
 */
export type WebhookEventName = WebhookEventType | "test.ping";

/** Why {@link constructWebhookEvent} refused to accept a request. */
export type VoidhashWebhookVerificationErrorReason =
  | "missing_header"
  | "invalid_signature"
  | "timestamp_out_of_tolerance"
  | "invalid_payload";

/**
 * Thrown by {@link constructWebhookEvent} when a request cannot be trusted.
 * Respond with a 4xx: Voidhash never retries its way out of a bad signature.
 */
export class VoidhashWebhookVerificationError extends Error {
  readonly reason: VoidhashWebhookVerificationErrorReason;

  constructor(
    reason: VoidhashWebhookVerificationErrorReason,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message);
    this.name = new.target.name;
    this.reason = reason;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

/** A verified webhook delivery. */
export interface VoidhashWebhookEvent {
  /**
   * Value of the `X-Webhook-Event` header. Known names narrow to
   * {@link WebhookEventName}; names added server side after this SDK release
   * still pass through as plain strings.
   */
  readonly type: string;
  /** `JSON.parse` of the raw request body. */
  readonly payload: unknown;
  /** Signing time reported by the `X-Webhook-Timestamp` header. */
  readonly timestamp: DateTime.Utc;
}

const EVENT_HEADER = "x-webhook-event";
const SIGNATURE_HEADER = "x-webhook-signature";
const TIMESTAMP_HEADER = "x-webhook-timestamp";

const SIGNATURE_PREFIX = "v1=";
const DEFAULT_TOLERANCE_SECONDS = 300;

/** Unix seconds carried by the timestamp header. */
const parseTimestampSeconds = (timestamp: string): Option.Option<number> => {
  if (!/^\d+$/.test(timestamp)) {
    return Option.none();
  }

  const seconds = Number(timestamp);

  if (!Number.isSafeInteger(seconds)) {
    return Option.none();
  }

  return Option.some(seconds);
};

const isWithinTolerance = (
  timestampSeconds: number,
  now: DateTime.Utc,
  toleranceSeconds: number,
): boolean =>
  Math.abs(Math.floor(DateTime.toEpochMillis(now) / 1000) - timestampSeconds) <= toleranceSeconds;

const currentUtc = (): DateTime.Utc =>
  DateTime.makeUnsafe(globalThis.performance.timeOrigin + globalThis.performance.now());

const computeSignature = (payload: string, timestamp: string, secret: string): string =>
  `${SIGNATURE_PREFIX}${bytesToHex(
    hmac(sha256, utf8ToBytes(secret), utf8ToBytes(`${timestamp}.${payload}`)),
  )}`;

/** Length-safe constant-time comparison for same-length signature strings. */
const constantTimeEquals = (left: string, right: string): boolean => {
  if (left.length !== right.length) {
    return false;
  }
  const difference = Arr.reduce(
    Array.from(left),
    0,
    (current, character, index) =>
      current | (character.charCodeAt(0) ^ right.charCodeAt(index)),
  );
  return difference === 0;
};

/**
 * The one value a header carries, or `undefined` when it was sent more than
 * once — a repeated signing header is ambiguous, so it is treated as missing.
 */
const singleHeaderValue = (raw?: string | string[]): Option.Option<string> => {
  if (!Array.isArray(raw)) {
    return Option.fromNullishOr(raw);
  }

  if (raw.length !== 1) {
    return Option.none();
  }

  return Option.fromNullishOr(raw[0]);
};

const readHeader = (
  headers: Readonly<Record<string, string | string[]>>,
  name: string,
): string => {
  const entry = R.toEntries(headers).find(([key]) => key.toLowerCase() === name);
  const value = singleHeaderValue(entry?.[1]);

  if (Option.isNone(value) || Str.isEmpty(value.value)) {
    throw new VoidhashWebhookVerificationError(
      "missing_header",
      `Webhook request must carry exactly one "${name}" header.`,
    );
  }

  return value.value;
};

export interface VerifyWebhookSignatureOptions {
  /** Raw request body, exactly as received — never a re-serialized object. */
  readonly payload: string;
  /** Value of the `X-Webhook-Signature` header (`v1=<hex>`). */
  readonly signature: string;
  /** Value of the `X-Webhook-Timestamp` header (unix seconds, decimal). */
  readonly timestamp: string;
  /** Endpoint signing secret (`whsec_...`) from Studio. */
  readonly secret: string;
  /** Accepted clock skew in either direction. Defaults to 300 seconds. */
  readonly toleranceSeconds?: number;
  /** Current time; injectable for tests. Defaults to the current UTC instant. */
  readonly now?: DateTime.Utc;
}

/**
 * Checks a webhook signature and its timestamp freshness.
 *
 * Voidhash signs `${timestamp}.${rawBody}` with HMAC-SHA256 keyed by the raw
 * UTF-8 endpoint secret, and sends it as `v1=<lowercase hex>`. Signatures with
 * an unknown scheme prefix, a malformed timestamp, or a timestamp outside
 * `toleranceSeconds` (past or future) are rejected.
 *
 * Prefer {@link constructWebhookEvent} unless you need the boolean directly.
 */
export const verifyWebhookSignature = (options: VerifyWebhookSignatureOptions): boolean => {
  const timestampSeconds = parseTimestampSeconds(options.timestamp);

  if (Option.isNone(timestampSeconds)) {
    return false;
  }

  if (
    !isWithinTolerance(
      timestampSeconds.value,
      options.now ?? currentUtc(),
      options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS,
    )
  ) {
    return false;
  }

  if (!options.signature.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }

  return constantTimeEquals(
    options.signature,
    computeSignature(options.payload, options.timestamp, options.secret),
  );
};

export interface ConstructWebhookEventOptions {
  /** Raw request body string, exactly as received. */
  readonly payload: string;
  /** Inbound request headers; looked up case-insensitively. */
  readonly headers: Readonly<Record<string, string | string[]>>;
  /** Endpoint signing secret (`whsec_...`) from Studio. */
  readonly secret: string;
  /** Accepted clock skew in either direction. Defaults to 300 seconds. */
  readonly toleranceSeconds?: number;
  /** Current time; injectable for tests. Defaults to the current UTC instant. */
  readonly now?: DateTime.Utc;
}

/**
 * Verifies an inbound webhook request and parses its body.
 *
 * Reads `X-Webhook-Event`, `X-Webhook-Timestamp` and `X-Webhook-Signature`
 * case-insensitively, enforces the signature and timestamp tolerance, then
 * returns the parsed delivery. Throws {@link VoidhashWebhookVerificationError}
 * — inspect `error.reason` — when the request cannot be trusted.
 *
 * The raw body string is what gets signed, so the route must not parse JSON
 * before this call:
 *
 * ```ts
 * import express from "express";
 * import { constructWebhookEvent } from "@voidhash/node";
 *
 * const app = express();
 *
 * // express.raw() keeps the exact bytes Voidhash signed; express.json()
 * // would re-serialize the body and break verification.
 * app.post("/webhooks/voidhash", express.raw({ type: "application/json" }), (req, res) => {
 *   try {
 *     const event = constructWebhookEvent({
 *       headers: req.headers,
 *       payload: req.body.toString("utf8"),
 *       secret: process.env.VOIDHASH_WEBHOOK_SECRET!,
 *     });
 *     console.log(event.type, event.payload);
 *     res.sendStatus(200);
 *   } catch {
 *     res.sendStatus(400);
 *   }
 * });
 * ```
 */
export const constructWebhookEvent = (
  options: ConstructWebhookEventOptions,
): VoidhashWebhookEvent => {
  const eventName = readHeader(options.headers, EVENT_HEADER);
  const timestamp = readHeader(options.headers, TIMESTAMP_HEADER);
  const signature = readHeader(options.headers, SIGNATURE_HEADER);

  const timestampSeconds = parseTimestampSeconds(timestamp);
  const toleranceSeconds = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const now = options.now ?? currentUtc();

  if (
    Option.isNone(timestampSeconds) ||
    !isWithinTolerance(timestampSeconds.value, now, toleranceSeconds)
  ) {
    throw new VoidhashWebhookVerificationError(
      "timestamp_out_of_tolerance",
      `Webhook timestamp "${timestamp}" is not within ${toleranceSeconds}s of the current time.`,
    );
  }

  if (
    !verifyWebhookSignature({
      now,
      payload: options.payload,
      secret: options.secret,
      signature,
      timestamp,
      toleranceSeconds,
    })
  ) {
    throw new VoidhashWebhookVerificationError(
      "invalid_signature",
      "Webhook signature does not match the expected value.",
    );
  }

  const payload = Result.try(() => effectDecodeJson(options.payload)).pipe(
    Result.getOrThrowWith(
      (cause) =>
        new VoidhashWebhookVerificationError(
          "invalid_payload",
          "Webhook payload is not valid JSON.",
          { cause },
        ),
    ),
  );

  return {
    payload,
    timestamp: DateTime.makeUnsafe(timestampSeconds.value * 1000),
    type: eventName,
  };
};
