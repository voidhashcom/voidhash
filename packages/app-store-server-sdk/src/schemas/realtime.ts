import { Schema } from "effect";
import { BillingPlanTypeSchema, EnvironmentSchema } from "./enums.ts";

/**
 * Decoded request body the App Store sends to your real-time retention message endpoint.
 * @see https://developer.apple.com/documentation/retentionmessaging/decodedrealtimerequestbody
 */
export const DecodedRealtimeRequestBodySchema = Schema.Struct({
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

export type DecodedRealtimeRequestBody = Schema.Schema.Type<
  typeof DecodedRealtimeRequestBodySchema
>;

export const decodeRealtimeRequest = Schema.decodeUnknownEffect(DecodedRealtimeRequestBodySchema);

// ===== Realtime response body =====

/**
 * Plain message displayed to the customer for retention.
 * @see https://developer.apple.com/documentation/retentionmessaging/message
 */
export const MessageSchema = Schema.Struct({
  messageIdentifier: Schema.OptionFromOptionalKey(Schema.String),
});

export type Message = Schema.Schema.Type<typeof MessageSchema>;

/**
 * Switch-plan message and the suggested product.
 * @see https://developer.apple.com/documentation/retentionmessaging/alternateproduct
 */
export const AlternateProductSchema = Schema.Struct({
  messageIdentifier: Schema.OptionFromOptionalKey(Schema.String),
  productId: Schema.OptionFromOptionalKey(Schema.String),
  billingPlanType: Schema.OptionFromOptionalKey(
    Schema.Union([BillingPlanTypeSchema, Schema.String]),
  ),
});

export type AlternateProduct = Schema.Schema.Type<typeof AlternateProductSchema>;

/**
 * Promotional offer V1 signature.
 * @see https://developer.apple.com/documentation/retentionmessaging/promotionaloffersignaturev1
 */
export const PromotionalOfferSignatureV1Schema = Schema.Struct({
  encodedSignature: Schema.String,
  productId: Schema.String,
  nonce: Schema.String,
  timestamp: Schema.Number,
  keyId: Schema.String,
  offerIdentifier: Schema.String,
  appAccountToken: Schema.OptionFromOptionalKey(Schema.String),
});

export type PromotionalOfferSignatureV1 = Schema.Schema.Type<
  typeof PromotionalOfferSignatureV1Schema
>;

/**
 * Promotional offer message returned to the customer.
 * @see https://developer.apple.com/documentation/retentionmessaging/promotionaloffer
 */
export const PromotionalOfferSchema = Schema.Struct({
  messageIdentifier: Schema.OptionFromOptionalKey(Schema.String),
  promotionalOfferSignatureV2: Schema.OptionFromOptionalKey(Schema.String),
  promotionalOfferSignatureV1: Schema.OptionFromOptionalKey(PromotionalOfferSignatureV1Schema),
});

export type PromotionalOffer = Schema.Schema.Type<typeof PromotionalOfferSchema>;

/**
 * Advanced Commerce real-time offer/recommendation payload.
 * @see https://developer.apple.com/documentation/retentionmessaging/advancedcommerceinfo
 */
export const RealtimeAdvancedCommerceInfoSchema = Schema.Struct({
  messageIdentifier: Schema.OptionFromOptionalKey(Schema.String),
  advancedCommerceData: Schema.OptionFromOptionalKey(Schema.String),
});

export type RealtimeAdvancedCommerceInfo = Schema.Schema.Type<
  typeof RealtimeAdvancedCommerceInfoSchema
>;

/**
 * Response your endpoint returns to the App Store to choose a retention message.
 * @see https://developer.apple.com/documentation/retentionmessaging/realtimeresponsebody
 */
export const RealtimeResponseBodySchema = Schema.Struct({
  message: Schema.OptionFromOptionalKey(MessageSchema),
  alternateProduct: Schema.OptionFromOptionalKey(AlternateProductSchema),
  promotionalOffer: Schema.OptionFromOptionalKey(PromotionalOfferSchema),
  advancedCommerceInfo: Schema.OptionFromOptionalKey(RealtimeAdvancedCommerceInfoSchema),
});

export type RealtimeResponseBody = Schema.Schema.Type<typeof RealtimeResponseBodySchema>;

/**
 * Request your endpoint receives from the App Store to display a retention message.
 * @see https://developer.apple.com/documentation/retentionmessaging/realtimerequestbody
 */
export const RealtimeRequestBodySchema = Schema.Struct({
  signedPayload: Schema.String,
});

export type RealtimeRequestBody = Schema.Schema.Type<typeof RealtimeRequestBodySchema>;

/**
 * Request body for configuring or updating the realtime URL.
 * @see https://developer.apple.com/documentation/retentionmessaging/realtimeurlrequest
 */
export const RealtimeUrlRequestSchema = Schema.Struct({
  realtimeURL: Schema.String,
});

export type RealtimeUrlRequest = Schema.Schema.Type<typeof RealtimeUrlRequestSchema>;
