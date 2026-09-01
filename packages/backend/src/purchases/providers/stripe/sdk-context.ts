/**
 * Per-tenant Stripe context shared by the webhook handler and the record
 * engine. Owns two things the `@distilled.cloud/stripe` SDK does NOT provide:
 *
 *  1. Webhook signature verification — the SDK is outbound-REST only, so the
 *     `Stripe-Signature` HMAC-SHA256 scheme is hand-rolled with WebCrypto
 *     (`crypto.subtle`), exactly like `SecretBox.ts`. Both the live and test
 *     signing secrets are tried; the one that verifies determines the mode.
 *  2. Best-effort REST enrichment using the per-tenant secret key — fetching a
 *     charge's processing fee (for net proceeds) and a checkout session's line
 *     items (to resolve the purchased price/product). These never fail the
 *     record path: any error resolves to "unavailable" and is logged.
 *
 * The shared `HttpClient` is captured once at engine construction and threaded
 * in here, so the REST requirement never leaks into each `record*` method's
 * `R` channel (mirrors how `appStore/sdk-context.ts` + FX capture work).
 */
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import type { HttpClient } from "effect/unstable/http/HttpClient";
import { HttpClient as HttpClientTag } from "effect/unstable/http/HttpClient";
import { Credentials, DEFAULT_API_BASE_URL } from "@distilled.cloud/stripe/Credentials";
import {
  GetBalanceTransactionsId,
  GetChargesCharge,
  GetCheckoutSessionsSessionLineItems,
  GetPaymentIntentsIntent,
} from "@distilled.cloud/stripe/Operations";

import { constant } from "@voidhash/lib/lang";

import { StripePaymentProviderServiceError, StripeWebhookSignatureError } from "./errors.ts";
import { decodeStripeEvent, StripeBalanceTransaction } from "./events.ts";
import * as P from "effect/Predicate";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import { recoverAll } from "../../../runtime-boundary.ts";

/** Stripe's default replay-protection window for webhook timestamps (seconds). */
const SIGNATURE_TOLERANCE_SECONDS = 300;

export type StripeMode = "live" | "test";

export interface StripeContextConfig {
  readonly liveSecretKey: string;
  readonly testSecretKey: string;
  readonly liveWebhookSecret: string;
  readonly testWebhookSecret: string;
  readonly httpClient: HttpClient;
  readonly apiBaseUrl?: string;
}

const PriceRef = Schema.Struct({
  id: Schema.optional(Schema.String),
  product: Schema.optional(Schema.NullOr(Schema.String)),
});

/** Parses an already signature-verified webhook body as arbitrary JSON. */
const decodeJsonBody = Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown));

const initialSignatureParts: {
  readonly timestamp: string | typeof Schema.Undefined.Type;
  readonly signatures: ReadonlyArray<string>;
} = { signatures: [], timestamp: undefined };

const parseSignatureHeader = (
  header: string,
): { readonly timestamp: string | typeof Schema.Undefined.Type; readonly signatures: ReadonlyArray<string> } => {
  return Arr.reduce(header.split(","), initialSignatureParts, (result, part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return result;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "t") return { ...result, timestamp: value };
    if (key === "v1") return { ...result, signatures: Arr.append(result.signatures, value) };
    return result;
  });
};

/** Length-checked constant-time hex-string comparison. */
const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  const mismatch = Arr.reduce(
    Arr.range(0, a.length - 1),
    0,
    (result, index) => result | (a.charCodeAt(index) ^ b.charCodeAt(index)),
  );
  return mismatch === 0;
};

const hmacFailure = (error: unknown) =>
  new StripeWebhookSignatureError({ reason: `HMAC computation failed: ${String(error)}` });

const computeHmacHex = (secret: string, payload: string) =>
  Effect.gen(function* () {
    const encoder = new TextEncoder();
    const key = yield* Effect.tryPromise({
      catch: hmacFailure,
      try: () =>
        crypto.subtle.importKey(
          "raw",
          encoder.encode(secret),
          { hash: "SHA-256", name: "HMAC" },
          false,
          ["sign"],
        ),
    });
    const signature = yield* Effect.tryPromise({
      catch: hmacFailure,
      try: () => crypto.subtle.sign("HMAC", key, encoder.encode(payload)),
    });
    return Array.from(new Uint8Array(signature))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  });

export type StripeContext = ReturnType<typeof buildStripeContext>;

/** Builds the per-tenant Stripe context over already-decrypted credentials. */
export const buildStripeContext = (config: StripeContextConfig) => {
  const apiBaseUrl = config.apiBaseUrl ?? DEFAULT_API_BASE_URL;

  const secretKeyFor = (mode: StripeMode): string => {
    if (mode === "live") return config.liveSecretKey;
    return config.testSecretKey;
  };

  const credentialsLayerFor = (mode: StripeMode) =>
    Layer.succeed(
      Credentials,
      Effect.succeed({
        apiBaseUrl,
        apiKey: Redacted.make(secretKeyFor(mode)),
      }),
    );

  const runOp = <A, E>(
    op: Effect.Effect<A, E, Credentials | HttpClient>,
    mode: StripeMode,
  ): Effect.Effect<A, E> =>
    op.pipe(
      Effect.provideService(HttpClientTag, config.httpClient),
      Effect.provide(credentialsLayerFor(mode)),
    );

  /**
   * Verifies the `Stripe-Signature` HMAC against the live then test signing
   * secret and decodes the body. The verifying secret determines `mode`. On
   * internal replay, `skipTimestampTolerance` bypasses the freshness window
   * (the signature itself is still checked) so an old parked payload is not
   * rejected for staleness.
   */
  const verifyAndDecodeEvent = (input: {
    readonly rawBody: string;
    readonly signatureHeader: string;
    readonly skipTimestampTolerance?: boolean;
  }) =>
    Effect.gen(function* () {
      const { signatures, timestamp } = parseSignatureHeader(input.signatureHeader);
      if (!timestamp || Arr.isReadonlyArrayEmpty(signatures)) {
        return yield* new StripeWebhookSignatureError({
          reason: "Stripe-Signature header missing t/v1 components",
        });
      }
      const timestampSeconds = Number(timestamp);
      if (!Number.isFinite(timestampSeconds)) {
        return yield* new StripeWebhookSignatureError({
          reason: "Stripe-Signature timestamp is not numeric",
        });
      }
      if (!input.skipTimestampTolerance) {
        const nowSeconds = Math.floor((yield* Clock.currentTimeMillis) / 1000);
        if (Math.abs(nowSeconds - timestampSeconds) > SIGNATURE_TOLERANCE_SECONDS) {
          return yield* new StripeWebhookSignatureError({
            reason: "Stripe-Signature timestamp outside tolerance window",
          });
        }
      }

      const signedPayload = `${timestamp}.${input.rawBody}`;
      const candidates: ReadonlyArray<{ readonly mode: StripeMode; readonly secret: string }> = [
        { mode: "live", secret: config.liveWebhookSecret },
        { mode: "test", secret: config.testWebhookSecret },
      ];

      const verifiedModes = yield* Effect.forEach(
        candidates,
        (candidate) =>
          candidate.secret
            ? computeHmacHex(candidate.secret, signedPayload).pipe(
                Effect.map((expected) =>
                  signatures.some((signature) => timingSafeEqual(signature, expected))
                    ? Option.some(candidate.mode)
                    : Option.none<StripeMode>(),
                ),
              )
            : Effect.succeed(Option.none<StripeMode>()),
        { concurrency: 1 },
      );
      const verifiedMode = Option.getOrUndefined(
        Option.flatten(Arr.findFirst(verifiedModes, Option.isSome)),
      );
      if (!verifiedMode) {
        return yield* new StripeWebhookSignatureError({
          reason: "no signature matched the configured signing secrets",
        });
      }

      const parsed = yield* decodeJsonBody(input.rawBody).pipe(
        Effect.mapError(
          (error) =>
            new StripeWebhookSignatureError({
              reason: `verified body is not valid JSON: ${String(error)}`,
            }),
        ),
      );
      const event = yield* decodeStripeEvent(parsed).pipe(
        Effect.mapError((error) => new StripeWebhookSignatureError({ reason: error.cause })),
      );
      return constant({ event, mode: verifiedMode });
    });

  const toPriceRef = (ref: {
    readonly id?: string | typeof Schema.Undefined.Type;
    readonly product?: string | typeof Schema.Null.Type | typeof Schema.Undefined.Type;
  }) => {
    if (!ref.id) return undefined;
    return { priceId: ref.id, productId: ref.product ?? undefined };
  };

  const decodePriceRef = (price: unknown) =>
    Schema.decodeUnknownEffect(PriceRef)(price).pipe(
      Effect.map(toPriceRef),
      recoverAll(() => undefined),
    );

  /**
   * Fetches a charge's Stripe processing fee (minor units) for net-proceeds
   * accounting. Best-effort: returns `undefined` if the charge, its balance
   * transaction, or the fetch is unavailable.
   */
  const fetchChargeFeeMinor = (input: { readonly chargeId: string; readonly mode: StripeMode }) =>
    runOp(GetChargesCharge({ charge: input.chargeId }), input.mode).pipe(
      Effect.flatMap((charge) => {
        const balanceTransaction = charge.balance_transaction;
        if (P.isString(balanceTransaction)) {
          return runOp(GetBalanceTransactionsId({ id: balanceTransaction }), input.mode).pipe(
            Effect.map((tx) => tx.fee),
          );
        }
        if (balanceTransaction && P.isObject(balanceTransaction)) {
          return Schema.decodeUnknownEffect(StripeBalanceTransaction)(balanceTransaction).pipe(
            Effect.map((tx) => tx.fee),
          );
        }
        return Effect.succeed<number | typeof Schema.Undefined.Type>(undefined);
      }),
      Effect.catch((error) =>
        Effect.logWarning("Stripe charge fee fetch failed; recording without commission", {
          chargeId: input.chargeId,
          error: String(error),
        }).pipe(Effect.as<number | typeof Schema.Undefined.Type>(undefined)),
      ),
    );

  /** Resolves a payment intent's latest charge id (for fee lookup). Best-effort. */
  const fetchPaymentIntentLatestChargeId = (input: {
    readonly paymentIntentId: string;
    readonly mode: StripeMode;
  }) =>
    runOp(GetPaymentIntentsIntent({ intent: input.paymentIntentId }), input.mode).pipe(
      Effect.map((intent) => {
        if (P.isString(intent.latest_charge)) return intent.latest_charge;
        return undefined;
      }),
      recoverAll((): string | typeof Schema.Undefined.Type => undefined),
    );

  /**
   * Resolves the purchased price/product from a checkout session's line items
   * (not present on the webhook payload). Returns `undefined` when the session
   * genuinely has no priced line item; a REST/transport failure is surfaced as
   * a transient {@link StripePaymentProviderServiceError} so the webhook is
   * retried rather than silently dropping a real purchase.
   */
  const fetchCheckoutLineItemPriceProduct = (input: {
    readonly sessionId: string;
    readonly mode: StripeMode;
  }) =>
    runOp(GetCheckoutSessionsSessionLineItems({ session: input.sessionId }), input.mode).pipe(
      Effect.flatMap((response) => {
        const line = response.data.find(
          (entry) => P.isObject(entry.price) && entry.price !== null,
        );
        if (!line) return Effect.succeed(undefined);
        return decodePriceRef(line.price);
      }),
      Effect.mapError(
        (error) =>
          new StripePaymentProviderServiceError({
            cause: `Stripe checkout line-item fetch failed: ${String(error)}`,
          }),
      ),
    );

  return constant({
    fetchChargeFeeMinor,
    fetchCheckoutLineItemPriceProduct,
    fetchPaymentIntentLatestChargeId,
    verifyAndDecodeEvent,
  });
};
