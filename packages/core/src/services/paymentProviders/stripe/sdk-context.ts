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
import { Effect, Layer, Redacted, Schema } from "effect";
import type { HttpClient } from "effect/unstable/http/HttpClient";
import { HttpClient as HttpClientTag } from "effect/unstable/http/HttpClient";
import { Credentials, DEFAULT_API_BASE_URL } from "@distilled.cloud/stripe/Credentials";
import {
  GetBalanceTransactionsId,
  GetChargesCharge,
  GetCheckoutSessionsSessionLineItems,
  GetPaymentIntentsIntent,
} from "@distilled.cloud/stripe/Operations";

import { StripePaymentProviderServiceError, StripeWebhookSignatureError } from "./errors.ts";
import { decodeStripeEvent, StripeBalanceTransactionSchema } from "./events.ts";

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

const PriceRefSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  product: Schema.optional(Schema.NullOr(Schema.String)),
});

const parseSignatureHeader = (
  header: string,
): { readonly timestamp: string | undefined; readonly signatures: ReadonlyArray<string> } => {
  let timestamp: string | undefined;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "t") timestamp = value;
    else if (key === "v1") signatures.push(value);
  }
  return { signatures, timestamp };
};

/** Length-checked constant-time hex-string comparison. */
const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
};

const computeHmacHex = (secret: string, payload: string) =>
  Effect.tryPromise({
    catch: (error) =>
      new StripeWebhookSignatureError({ reason: `HMAC computation failed: ${String(error)}` }),
    try: async () => {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { hash: "SHA-256", name: "HMAC" },
        false,
        ["sign"],
      );
      const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
      return Array.from(new Uint8Array(signature))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    },
  });

export type StripeContext = ReturnType<typeof buildStripeContext>;

/** Builds the per-tenant Stripe context over already-decrypted credentials. */
export const buildStripeContext = (config: StripeContextConfig) => {
  const apiBaseUrl = config.apiBaseUrl ?? DEFAULT_API_BASE_URL;

  const credentialsLayerFor = (mode: StripeMode) =>
    Layer.succeed(
      Credentials,
      Effect.succeed({
        apiBaseUrl,
        apiKey: Redacted.make(mode === "live" ? config.liveSecretKey : config.testSecretKey),
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
      if (!timestamp || signatures.length === 0) {
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
        const nowSeconds = Math.floor(Date.now() / 1000);
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

      let verifiedMode: StripeMode | undefined;
      for (const candidate of candidates) {
        if (!candidate.secret) continue;
        const expected = yield* computeHmacHex(candidate.secret, signedPayload);
        if (signatures.some((signature) => timingSafeEqual(signature, expected))) {
          verifiedMode = candidate.mode;
          break;
        }
      }
      if (!verifiedMode) {
        return yield* new StripeWebhookSignatureError({
          reason: "no signature matched the configured signing secrets",
        });
      }

      const parsed = yield* Effect.try({
        catch: (error) =>
          new StripeWebhookSignatureError({
            reason: `verified body is not valid JSON: ${String(error)}`,
          }),
        try: () => JSON.parse(input.rawBody) as unknown,
      });
      const event = yield* decodeStripeEvent(parsed).pipe(
        Effect.mapError((error) => new StripeWebhookSignatureError({ reason: error.cause })),
      );
      return { event, mode: verifiedMode } as const;
    });

  const decodePriceRef = (price: unknown) =>
    Schema.decodeUnknownEffect(PriceRefSchema)(price).pipe(
      Effect.map((ref) =>
        ref.id ? { priceId: ref.id, productId: ref.product ?? undefined } : undefined,
      ),
      Effect.catch(() => Effect.succeed(undefined)),
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
        if (typeof balanceTransaction === "string") {
          return runOp(GetBalanceTransactionsId({ id: balanceTransaction }), input.mode).pipe(
            Effect.map((tx) => tx.fee),
          );
        }
        if (balanceTransaction && typeof balanceTransaction === "object") {
          return Schema.decodeUnknownEffect(StripeBalanceTransactionSchema)(
            balanceTransaction,
          ).pipe(Effect.map((tx) => tx.fee));
        }
        return Effect.succeed<number | undefined>(undefined);
      }),
      Effect.catch((error) =>
        Effect.logWarning("Stripe charge fee fetch failed; recording without commission", {
          chargeId: input.chargeId,
          error: String(error),
        }).pipe(Effect.as<number | undefined>(undefined)),
      ),
    );

  /** Resolves a payment intent's latest charge id (for fee lookup). Best-effort. */
  const fetchPaymentIntentLatestChargeId = (input: {
    readonly paymentIntentId: string;
    readonly mode: StripeMode;
  }) =>
    runOp(GetPaymentIntentsIntent({ intent: input.paymentIntentId }), input.mode).pipe(
      Effect.map((intent) =>
        typeof intent.latest_charge === "string" ? intent.latest_charge : undefined,
      ),
      Effect.catch(() => Effect.succeed<string | undefined>(undefined)),
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
          (entry) => typeof entry.price === "object" && entry.price !== null,
        );
        return line ? decodePriceRef(line.price) : Effect.succeed(undefined);
      }),
      Effect.mapError(
        (error) =>
          new StripePaymentProviderServiceError({
            cause: `Stripe checkout line-item fetch failed: ${String(error)}`,
          }),
      ),
    );

  return {
    fetchChargeFeeMinor,
    fetchCheckoutLineItemPriceProduct,
    fetchPaymentIntentLatestChargeId,
    verifyAndDecodeEvent,
  } as const;
};
