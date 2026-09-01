/**
 * JSON codec for {@link PurchaseProcessingResult}. The outbox row stores a
 * frozen snapshot of the first caller's result so a duplicate idempotency
 * key can be handed back the exact same `Option<transactionId>` /
 * `Option<subscriptionId>` / `Option<purchaseId>` / `analyticsEventIds`.
 *
 * Why not lean on `Schema.encodeUnknown` of the tagged class directly:
 * `Option<string>` round-trips well but the encoded shape is the wire
 * representation of `Schema.Option`, which is wordier than necessary for an
 * internal storage format. We use a flat JSON shape with nullable strings to
 * keep payloads small and inspectable in DB clients.
 */
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { PurchaseProcessingResult } from "../../domain/PurchaseProcessing.ts";

/** The flat, nullable-string storage shape written to (and read back from) the outbox row. */
const EncodedPurchaseProcessingResult = Schema.Struct({
  personId: Schema.String,
  purchaseId: Schema.NullOr(Schema.String),
  subscriptionId: Schema.NullOr(Schema.String),
  transactionId: Schema.NullOr(Schema.String),
  changedGrantIds: Schema.Array(Schema.String),
  analyticsEventIds: Schema.Array(Schema.String),
  isIdempotent: Schema.Boolean,
}).pipe(Schema.encodeKeys({ isIdempotent: "idempotent" }));

type EncodedPurchaseProcessingResult = typeof EncodedPurchaseProcessingResult.Encoded;

const decodeEncodedResult = Schema.decodeUnknownSync(EncodedPurchaseProcessingResult);

/** Encodes the result to a JSON-friendly object suitable for the outbox row. */
export const encodePurchaseProcessingResult = (
  result: PurchaseProcessingResult,
): EncodedPurchaseProcessingResult => ({
  analyticsEventIds: result.analyticsEventIds,
  changedGrantIds: result.changedGrantIds,
  idempotent: result.idempotent,
  personId: result.personId,
  purchaseId: Option.getOrNull(result.purchaseId),
  subscriptionId: Option.getOrNull(result.subscriptionId),
  transactionId: Option.getOrNull(result.transactionId),
});

/**
 * Decodes a previously-encoded result, forcing `idempotent: true` because by
 * the time we're decoding, the caller is a duplicate delivery — the prior
 * one already produced the canonical operational state.
 */
export const decodePurchaseProcessingResult = (encoded: unknown): PurchaseProcessingResult => {
  const decoded = decodeEncodedResult(encoded);
  return new PurchaseProcessingResult({
    analyticsEventIds: decoded.analyticsEventIds,
    changedGrantIds: decoded.changedGrantIds,
    idempotent: true,
    personId: decoded.personId,
    purchaseId: Option.fromNullishOr(decoded.purchaseId),
    subscriptionId: Option.fromNullishOr(decoded.subscriptionId),
    transactionId: Option.fromNullishOr(decoded.transactionId),
  });
};
