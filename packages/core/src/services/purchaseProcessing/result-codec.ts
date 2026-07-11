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
import { Option } from "effect";

import { PurchaseProcessingResult } from "../../domain/purchaseProcessing/PurchaseProcessing.ts";

interface EncodedPurchaseProcessingResult {
  readonly personId: string;
  readonly purchaseId: string | null;
  readonly subscriptionId: string | null;
  readonly transactionId: string | null;
  readonly changedGrantIds: ReadonlyArray<string>;
  readonly analyticsEventIds: ReadonlyArray<string>;
  readonly idempotent: boolean;
}

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
  const e = encoded as EncodedPurchaseProcessingResult;
  return new PurchaseProcessingResult({
    analyticsEventIds: e.analyticsEventIds,
    changedGrantIds: e.changedGrantIds,
    idempotent: true,
    personId: e.personId,
    purchaseId: Option.fromNullishOr(e.purchaseId),
    subscriptionId: Option.fromNullishOr(e.subscriptionId),
    transactionId: Option.fromNullishOr(e.transactionId),
  });
};
