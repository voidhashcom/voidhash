// Signature creation is handled in the client/auth.ts module
// Re-export for convenience
export {
  createPromotionalOfferV2Signature,
  createIntroductoryOfferEligibilitySignature,
  createAdvancedCommerceInAppSignature,
  type PromotionalOfferSignatureConfig,
} from "../client/auth.ts";

// V1 promotional offer signature (legacy SHA256-based).
// Signed with raw WebCrypto ECDSA, then re-encoded to the ASN.1 DER form Apple
// expects (see `rawEcdsaSignatureToDer`).

import { Effect, Option } from "effect";
import { importPKCS8 } from "jose";
import { JwtCreationError } from "../errors/index.ts";
import { bytesToBase64, rawEcdsaSignatureToDer, utf8ToBytes } from "../internal/bytes.ts";

/**
 * Special separator character used in V1 promotional offer signatures.
 */
const INVISIBLE_SEPARATOR = "\u2063";

/**
 * Configuration for V1 promotional offer signature creation.
 */
export interface PromotionalOfferV1SignatureConfig {
  /** Your private key downloaded from App Store Connect. */
  signingKey: string;
  /** Your private key ID from App Store Connect. */
  keyId: string;
  /** Your app's bundle ID. */
  bundleId: string;
}

/**
 * Creates a V1 promotional offer signature (legacy).
 *
 * @param config - The configuration for signature creation
 * @param productId - The product identifier
 * @param offerId - The offer identifier
 * @param appAccountToken - The app account token (UUID or empty string)
 * @param nonce - A unique UUID for this signature
 * @param timestamp - The timestamp in milliseconds
 * @returns An Effect that produces the base64-encoded signature
 */
export const createPromotionalOfferV1Signature = (
  config: PromotionalOfferV1SignatureConfig,
  productId: string,
  offerId: string,
  appAccountToken: string,
  nonce: string,
  timestamp: number,
): Effect.Effect<string, JwtCreationError> =>
  Effect.tryPromise({
    try: async () => {
      const payload = [
        config.bundleId,
        config.keyId,
        productId,
        offerId,
        appAccountToken,
        nonce.toLowerCase(),
        timestamp.toString(),
      ].join(INVISIBLE_SEPARATOR);

      const key = await importPKCS8(config.signingKey, "ES256");
      // `as BufferSource`: TextEncoder yields `Uint8Array<ArrayBufferLike>`,
      // which the DOM lib's `BufferSource` (ArrayBuffer-backed) rejects at the
      // type level even though it is valid at runtime.
      const rawSignature = new Uint8Array(
        await globalThis.crypto.subtle.sign(
          { name: "ECDSA", hash: "SHA-256" },
          key,
          utf8ToBytes(payload) as BufferSource,
        ),
      );

      // Apple expects the DER `Ecdsa-Sig-Value`, not WebCrypto's raw r‖s output.
      return bytesToBase64(rawEcdsaSignatureToDer(rawSignature));
    },
    catch: (error) =>
      new JwtCreationError({
        message: `Failed to create V1 promotional offer signature: ${error instanceof Error ? error.message : String(error)}`,
        cause: Option.some(error),
      }),
  });
