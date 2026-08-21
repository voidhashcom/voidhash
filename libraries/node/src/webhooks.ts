// oxlint-disable effect/noThrowStatement, effect/noTryCatch, effect/noGlobals -- this module is the Node webhook adapter boundary and is deliberately Effect-free: it is called from plain Express/Fastify route handlers that have no Effect runtime, so verification failures surface as a thrown `VoidhashWebhookVerificationError` (the documented contract of `constructWebhookEvent`), the raw signed body is decoded with `JSON.parse` behind a try/catch, and the tolerance check falls back to the wall clock when the caller injects no `now`. Modelling any of that with Effect would put `effect` in the dependency graph of every consumer of this file.

import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";

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
  readonly type: WebhookEventName | (string & {});
  /** `JSON.parse` of the raw request body. */
  readonly payload: unknown;
  /** Signing time reported by the `X-Webhook-Timestamp` header. */
  readonly timestamp: Date;
}

const EVENT_HEADER = "x-webhook-event";
const SIGNATURE_HEADER = "x-webhook-signature";
const TIMESTAMP_HEADER = "x-webhook-timestamp";

const SIGNATURE_PREFIX = "v1=";
const DEFAULT_TOLERANCE_SECONDS = 300;

/** Unix seconds carried by the timestamp header, or `null` if malformed. */
const parseTimestampSeconds = (timestamp: string): number | null => {
  if (!/^\d+$/.test(timestamp)) {
    return null;
  }

  const seconds = Number(timestamp);

  if (!Number.isSafeInteger(seconds)) {
    return null;
  }

  return seconds;
};

const isWithinTolerance = (
  timestampSeconds: number,
  now: Date,
  toleranceSeconds: number,
): boolean =>
  Math.abs(Math.floor(now.getTime() / 1000) - timestampSeconds) <= toleranceSeconds;

const computeSignature = (payload: string, timestamp: string, secret: string): string =>
  `${SIGNATURE_PREFIX}${createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex")}`;

/** Length-safe constant-time comparison — `timingSafeEqual` throws on a size mismatch. */
const constantTimeEquals = (left: string, right: string): boolean => {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");

  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  return timingSafeEqual(leftBytes, rightBytes);
};

/**
 * The one value a header carries, or `undefined` when it was sent more than
 * once — a repeated signing header is ambiguous, so it is treated as missing.
 */
const singleHeaderValue = (raw: string | string[] | undefined): string | undefined => {
  if (!Array.isArray(raw)) {
    return raw;
  }

  if (raw.length !== 1) {
    return undefined;
  }

  return raw[0];
};

const readHeader = (
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string => {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  const value = singleHeaderValue(entry?.[1]);

  if (typeof value !== "string" || value.length === 0) {
    throw new VoidhashWebhookVerificationError(
      "missing_header",
      `Webhook request must carry exactly one "${name}" header.`,
    );
  }

  return value;
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
  /** Current time; injectable for tests. Defaults to `new Date()`. */
  readonly now?: Date;
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

  if (timestampSeconds === null) {
    return false;
  }

  if (
    !isWithinTolerance(
      timestampSeconds,
      options.now ?? new Date(),
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
  readonly headers: Record<string, string | string[] | undefined>;
  /** Endpoint signing secret (`whsec_...`) from Studio. */
  readonly secret: string;
  /** Accepted clock skew in either direction. Defaults to 300 seconds. */
  readonly toleranceSeconds?: number;
  /** Current time; injectable for tests. Defaults to `new Date()`. */
  readonly now?: Date;
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
  const now = options.now ?? new Date();

  if (timestampSeconds === null || !isWithinTolerance(timestampSeconds, now, toleranceSeconds)) {
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

  let payload: unknown;

  try {
    payload = JSON.parse(options.payload);
  } catch (cause) {
    throw new VoidhashWebhookVerificationError(
      "invalid_payload",
      "Webhook payload is not valid JSON.",
      { cause },
    );
  }

  return {
    payload,
    timestamp: new Date(timestampSeconds * 1000),
    type: eventName,
  };
};
