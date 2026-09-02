import * as Schema from "effect/Schema";
import { BillingPlanTypeSchema, EnvironmentSchema } from "./enums.ts";

/**
 * Decoded request body the App Store sends to your real-time retention message endpoint.
 * @see https://developer.apple.com/documentation/retentionmessaging/decodedrealtimerequestbody
 */
export const DecodedRealtimeRequestBodyCodec = Schema.Struct({
  /** Original transaction identifier of the customer's subscription. */
  originalTransactionId: Schema.String,

  /** Unique identifier of the app in the App Store. */
  appAppleId: Schema.Number,

  /** Unique identifier of the auto-renewable subscription. */
  productId: Schema.String,

  /** Device's locale. */
  userLocale: Schema.String,

  /** UUID identifying the request. */
  requestIdentifier: Schema.String,

  /** Unix time (ms) when the App Store signed the JWS. */
  signedDate: Schema.Number,

  /** Server environment. */
  environment: Schema.Union([EnvironmentSchema, Schema.String]),
});
export type DecodedRealtimeRequestBodyCodec = typeof DecodedRealtimeRequestBodyCodec.Type;

export type DecodedRealtimeRequestBody = Schema.Schema.Type<typeof DecodedRealtimeRequestBodyCodec>;

const decodeRealtimeRequestEffect = Schema.decodeUnknownEffect(DecodedRealtimeRequestBodyCodec);

/** Decode a realtime request from an unknown value. */
export function decodeRealtimeRequest(
  ...args: Parameters<typeof decodeRealtimeRequestEffect>
): ReturnType<typeof decodeRealtimeRequestEffect> {
  return decodeRealtimeRequestEffect(...args);
}

// ===== Realtime response body =====

/**
 * Plain message displayed to the customer for retention.
 * @see https://developer.apple.com/documentation/retentionmessaging/message
 */
export const MessageCodec = Schema.Struct({
  messageIdentifier: Schema.OptionFromOptionalKey(Schema.String),
});
export type MessageCodec = typeof MessageCodec.Type;

export type Message = Schema.Schema.Type<typeof MessageCodec>;

/**
 * Switch-plan message and the suggested product.
 * @see https://developer.apple.com/documentation/retentionmessaging/alternateproduct
 */
export const AlternateProductCodec = Schema.Struct({
  messageIdentifier: Schema.OptionFromOptionalKey(Schema.String),
  productId: Schema.OptionFromOptionalKey(Schema.String),
  billingPlanType: Schema.OptionFromOptionalKey(
    Schema.Union([BillingPlanTypeSchema, Schema.String]),
  ),
});
export type AlternateProductCodec = typeof AlternateProductCodec.Type;

export type AlternateProduct = Schema.Schema.Type<typeof AlternateProductCodec>;

/**
 * Promotional offer V1 signature.
 * @see https://developer.apple.com/documentation/retentionmessaging/promotionaloffersignaturev1
 */
export const PromotionalOfferSignatureV1Codec = Schema.Struct({
  encodedSignature: Schema.String,
  productId: Schema.String,
  nonce: Schema.String,
  timestamp: Schema.Number,
  keyId: Schema.String,
  offerIdentifier: Schema.String,
  appAccountToken: Schema.OptionFromOptionalKey(Schema.String),
});
export type PromotionalOfferSignatureV1Codec = typeof PromotionalOfferSignatureV1Codec.Type;

export type PromotionalOfferSignatureV1 = Schema.Schema.Type<
  typeof PromotionalOfferSignatureV1Codec
>;

/**
 * Promotional offer message returned to the customer.
 * @see https://developer.apple.com/documentation/retentionmessaging/promotionaloffer
 */
export const PromotionalOfferCodec = Schema.Struct({
  messageIdentifier: Schema.OptionFromOptionalKey(Schema.String),
  promotionalOfferSignatureV2: Schema.OptionFromOptionalKey(Schema.String),
  promotionalOfferSignatureV1: Schema.OptionFromOptionalKey(PromotionalOfferSignatureV1Codec),
});
export type PromotionalOfferCodec = typeof PromotionalOfferCodec.Type;

export type PromotionalOffer = Schema.Schema.Type<typeof PromotionalOfferCodec>;

/**
 * Advanced Commerce real-time offer/recommendation payload.
 * @see https://developer.apple.com/documentation/retentionmessaging/advancedcommerceinfo
 */
export const RealtimeAdvancedCommerceInfoCodec = Schema.Struct({
  messageIdentifier: Schema.OptionFromOptionalKey(Schema.String),
  advancedCommerceData: Schema.OptionFromOptionalKey(Schema.String),
});
export type RealtimeAdvancedCommerceInfoCodec = typeof RealtimeAdvancedCommerceInfoCodec.Type;

export type RealtimeAdvancedCommerceInfo = Schema.Schema.Type<
  typeof RealtimeAdvancedCommerceInfoCodec
>;

/**
 * Response your endpoint returns to the App Store to choose a retention message.
 * @see https://developer.apple.com/documentation/retentionmessaging/realtimeresponsebody
 */
export const RealtimeResponseBodyCodec = Schema.Struct({
  message: Schema.OptionFromOptionalKey(MessageCodec),
  alternateProduct: Schema.OptionFromOptionalKey(AlternateProductCodec),
  promotionalOffer: Schema.OptionFromOptionalKey(PromotionalOfferCodec),
  advancedCommerceInfo: Schema.OptionFromOptionalKey(RealtimeAdvancedCommerceInfoCodec),
});
export type RealtimeResponseBodyCodec = typeof RealtimeResponseBodyCodec.Type;

export type RealtimeResponseBody = Schema.Schema.Type<typeof RealtimeResponseBodyCodec>;

/**
 * Request your endpoint receives from the App Store to display a retention message.
 * @see https://developer.apple.com/documentation/retentionmessaging/realtimerequestbody
 */
export const RealtimeRequestBodyCodec = Schema.Struct({
  signedPayload: Schema.String,
});
export type RealtimeRequestBodyCodec = typeof RealtimeRequestBodyCodec.Type;

export type RealtimeRequestBody = Schema.Schema.Type<typeof RealtimeRequestBodyCodec>;

/**
 * Request body for configuring or updating the realtime URL.
 * @see https://developer.apple.com/documentation/retentionmessaging/realtimeurlrequest
 */
export const RealtimeUrlRequestCodec = Schema.Struct({
  realtimeURL: Schema.String,
});
export type RealtimeUrlRequestCodec = typeof RealtimeUrlRequestCodec.Type;

export type RealtimeUrlRequest = Schema.Schema.Type<typeof RealtimeUrlRequestCodec>;

export { DecodedRealtimeRequestBodyCodec as DecodedRealtimeRequestBodySchema };
export { MessageCodec as MessageSchema };
export { AlternateProductCodec as AlternateProductSchema };
export { PromotionalOfferSignatureV1Codec as PromotionalOfferSignatureV1Schema };
export { PromotionalOfferCodec as PromotionalOfferSchema };
export { RealtimeAdvancedCommerceInfoCodec as RealtimeAdvancedCommerceInfoSchema };
export { RealtimeResponseBodyCodec as RealtimeResponseBodySchema };
export { RealtimeRequestBodyCodec as RealtimeRequestBodySchema };
export { RealtimeUrlRequestCodec as RealtimeUrlRequestSchema };
