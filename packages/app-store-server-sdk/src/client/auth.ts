import { Effect, Option } from "effect";
import { decodeJwt, importPKCS8, SignJWT } from "jose";
import { JwtCreationError } from "../errors/index.ts";
import { bytesToBase64, utf8ToBytes } from "../internal/bytes.ts";

const asOption = <T>(value: Option.Option<T> | T | null | undefined): Option.Option<T> =>
  Option.isOption(value) ? value : Option.fromNullishOr(value);

const ES256_ALG = "ES256";

/**
 * Configuration for creating App Store Server API bearer tokens.
 */
export interface BearerTokenConfig {
  /** Your private key downloaded from App Store Connect (ES256). */
  signingKey: string;
  /** Your private key ID from App Store Connect. */
  keyId: string;
  /** Your issuer ID from the Keys page in App Store Connect. */
  issuerId: string;
  /** Your app's bundle ID. */
  bundleId: string;
}

/**
 * Creates a bearer token for App Store Server API authentication.
 *
 * The token is a JWT signed with ES256 algorithm and has a 5-minute expiration.
 *
 * @param config - The configuration for token creation
 * @returns An Effect that produces the bearer token string
 */
export const createBearerToken = (
  config: BearerTokenConfig,
): Effect.Effect<string, JwtCreationError> =>
  Effect.tryPromise({
    try: async () => {
      const key = await importPKCS8(config.signingKey, ES256_ALG);
      return await new SignJWT({ bid: config.bundleId })
        .setProtectedHeader({ alg: ES256_ALG, kid: config.keyId, typ: "JWT" })
        .setIssuer(config.issuerId)
        .setAudience("appstoreconnect-v1")
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(key);
    },
    catch: (error) =>
      new JwtCreationError({
        message: `Failed to create bearer token: ${error instanceof Error ? error.message : String(error)}`,
        cause: Option.some(error),
      }),
  });

/**
 * Configuration for creating promotional offer signatures.
 */
export interface PromotionalOfferSignatureConfig {
  /** Your private key downloaded from App Store Connect (ES256). */
  signingKey: string;
  /** Your private key ID from App Store Connect. */
  keyId: string;
  /** Your issuer ID from the Keys page in App Store Connect. */
  issuerId: string;
  /** Your app's bundle ID. */
  bundleId: string;
}

/**
 * Creates a V2 promotional offer signature.
 *
 * @param config - The configuration for signature creation
 * @param productId - The product identifier
 * @param offerIdentifier - The offer identifier
 * @param transactionId - Original transaction ID for upgrades, when present.
 * @returns An Effect that produces the signature string
 */
export const createPromotionalOfferV2Signature = (
  config: PromotionalOfferSignatureConfig,
  productId: string,
  offerIdentifier: string,
  transactionId: Option.Option<string>,
): Effect.Effect<string, JwtCreationError> =>
  Effect.tryPromise({
    try: async () => {
      const nonce = globalThis.crypto.randomUUID();
      const payload: Record<string, unknown> = {
        bid: config.bundleId,
        nonce,
        productId,
        offerIdentifier,
      };

      const transactionIdOption = asOption(transactionId);
      if (Option.isSome(transactionIdOption)) {
        payload.transactionId = transactionIdOption.value;
      }

      const key = await importPKCS8(config.signingKey, ES256_ALG);
      return await new SignJWT(payload)
        .setProtectedHeader({ alg: ES256_ALG, kid: config.keyId, typ: "JWT" })
        .setIssuer(config.issuerId)
        .setAudience("promotional-offer")
        .setIssuedAt()
        .sign(key);
    },
    catch: (error) =>
      new JwtCreationError({
        message: `Failed to create promotional offer V2 signature: ${error instanceof Error ? error.message : String(error)}`,
        cause: Option.some(error),
      }),
  });

/**
 * Creates an introductory offer eligibility signature.
 *
 * @param config - The configuration for signature creation
 * @param productId - The product identifier
 * @param allowIntroductoryOffer - Whether the introductory offer should be allowed
 * @param transactionId - The original transaction ID
 * @returns An Effect that produces the signature string
 */
export const createIntroductoryOfferEligibilitySignature = (
  config: PromotionalOfferSignatureConfig,
  productId: string,
  allowIntroductoryOffer: boolean,
  transactionId: string,
): Effect.Effect<string, JwtCreationError> =>
  Effect.tryPromise({
    try: async () => {
      const nonce = globalThis.crypto.randomUUID();
      const payload = {
        bid: config.bundleId,
        nonce,
        productId,
        allowIntroductoryOffer,
        transactionId,
      };

      const key = await importPKCS8(config.signingKey, ES256_ALG);
      return await new SignJWT(payload)
        .setProtectedHeader({ alg: ES256_ALG, kid: config.keyId, typ: "JWT" })
        .setIssuer(config.issuerId)
        .setAudience("introductory-offer-eligibility")
        .setIssuedAt()
        .sign(key);
    },
    catch: (error) =>
      new JwtCreationError({
        message: `Failed to create introductory offer eligibility signature: ${error instanceof Error ? error.message : String(error)}`,
        cause: Option.some(error),
      }),
  });

/**
 * Creates an advanced commerce in-app signature.
 *
 * @param config - The configuration for signature creation
 * @param requestPayload - The request payload to sign (will be serialized and base64 encoded)
 * @returns An Effect that produces the signature string
 */
export const createAdvancedCommerceInAppSignature = (
  config: PromotionalOfferSignatureConfig,
  requestPayload: Record<string, unknown>,
): Effect.Effect<string, JwtCreationError> =>
  Effect.tryPromise({
    try: async () => {
      const nonce = globalThis.crypto.randomUUID();
      const requestJson = JSON.stringify(requestPayload);
      const payload = {
        bid: config.bundleId,
        nonce,
        request: bytesToBase64(utf8ToBytes(requestJson)),
      };

      const key = await importPKCS8(config.signingKey, ES256_ALG);
      return await new SignJWT(payload)
        .setProtectedHeader({ alg: ES256_ALG, kid: config.keyId, typ: "JWT" })
        .setIssuer(config.issuerId)
        .setAudience("advanced-commerce-api")
        .setIssuedAt()
        .sign(key);
    },
    catch: (error) =>
      new JwtCreationError({
        message: `Failed to create advanced commerce in-app signature: ${error instanceof Error ? error.message : String(error)}`,
        cause: Option.some(error),
      }),
  });

/**
 * Decodes a JWT without verification (for inspection purposes).
 *
 * @param token - The JWT token to decode
 * @returns The decoded payload
 */
export const decodeJwtWithoutVerification = (
  token: string,
): Effect.Effect<unknown, JwtCreationError> =>
  Effect.try({
    try: () => decodeJwt(token),
    catch: (error) =>
      new JwtCreationError({
        message: `Failed to decode JWT: ${error instanceof Error ? error.message : String(error)}`,
        cause: Option.some(error),
      }),
  });
