import * as Schema from "effect/Schema";
import {
  AdvancedCommerceTransactionInfoSchema,
  TransactionCommitmentInfoSchema,
} from "./advanced-commerce.ts";
import {
  BillingPlanTypeSchema,
  EnvironmentSchema,
  InAppOwnershipTypeSchema,
  OfferDiscountTypeSchema,
  OfferTypeSchema,
  RevocationReasonSchema,
  RevocationTypeSchema,
  TransactionReasonSchema,
  TypeSchema,
} from "./enums.ts";

/**
 * A decoded payload containing transaction information.
 * @see https://developer.apple.com/documentation/appstoreserverapi/jwstransactiondecodedpayload
 */
export const JWSTransactionDecodedPayloadCodec = Schema.Struct({
  /** The original transaction identifier of a purchase. */
  originalTransactionId: Schema.OptionFromOptionalKey(Schema.String),

  /** The unique identifier for a transaction such as an in-app purchase, restored in-app purchase, or subscription renewal. */
  transactionId: Schema.OptionFromOptionalKey(Schema.String),

  /** The unique identifier of subscription-purchase events across devices, including renewals. */
  webOrderLineItemId: Schema.OptionFromOptionalKey(Schema.String),

  /** The bundle identifier of an app. */
  bundleId: Schema.OptionFromOptionalKey(Schema.String),

  /** The unique identifier for the product. */
  productId: Schema.OptionFromOptionalKey(Schema.String),

  /** The identifier of the subscription group. */
  subscriptionGroupIdentifier: Schema.OptionFromOptionalKey(Schema.String),

  /** The time that the App Store charged the user's account (Unix timestamp in milliseconds). */
  purchaseDate: Schema.OptionFromOptionalKey(Schema.Number),

  /** The purchase date of the original transaction (Unix timestamp in milliseconds). */
  originalPurchaseDate: Schema.OptionFromOptionalKey(Schema.Number),

  /** The expiration date of an auto-renewable subscription (Unix timestamp in milliseconds). */
  expiresDate: Schema.OptionFromOptionalKey(Schema.Number),

  /** The number of consumable products purchased. */
  quantity: Schema.OptionFromOptionalKey(Schema.Number),

  /** The type of the in-app purchase. */
  type: Schema.OptionFromOptionalKey(Schema.Union([TypeSchema, Schema.String])),

  /** The UUID that maps a customer's in-app purchase with its resulting transaction. */
  appAccountToken: Schema.OptionFromOptionalKey(Schema.String),

  /** Whether the transaction was purchased by the user or via Family Sharing. */
  inAppOwnershipType: Schema.OptionFromOptionalKey(
    Schema.Union([InAppOwnershipTypeSchema, Schema.String]),
  ),

  /** The time the App Store signed the JWS data (Unix timestamp in milliseconds). */
  signedDate: Schema.OptionFromOptionalKey(Schema.Number),

  /** The reason that the App Store refunded or revoked the transaction. */
  revocationReason: Schema.OptionFromOptionalKey(
    Schema.Union([RevocationReasonSchema, Schema.Number]),
  ),

  /** The time Apple Support refunded a transaction (Unix timestamp in milliseconds). */
  revocationDate: Schema.OptionFromOptionalKey(Schema.Number),

  /** Whether the user upgraded to another subscription. */
  isUpgraded: Schema.OptionFromOptionalKey(Schema.Boolean),

  /** The promotional offer type. */
  offerType: Schema.OptionFromOptionalKey(Schema.Union([OfferTypeSchema, Schema.Number])),

  /** The offer code or promotional offer identifier. */
  offerIdentifier: Schema.OptionFromOptionalKey(Schema.String),

  /** The server environment, either sandbox or production. */
  environment: Schema.OptionFromOptionalKey(Schema.Union([EnvironmentSchema, Schema.String])),

  /** The three-letter country or region code for the App Store storefront. */
  storefront: Schema.OptionFromOptionalKey(Schema.String),

  /** An Apple-defined value that uniquely identifies the storefront. */
  storefrontId: Schema.OptionFromOptionalKey(Schema.String),

  /** The reason for the purchase transaction. */
  transactionReason: Schema.OptionFromOptionalKey(
    Schema.Union([TransactionReasonSchema, Schema.String]),
  ),

  /** The three-letter ISO 4217 currency code. */
  currency: Schema.OptionFromOptionalKey(Schema.String),

  /** The price, in milliunits, of the in-app purchase. */
  price: Schema.OptionFromOptionalKey(Schema.Number),

  /** The payment mode for the offer. */
  offerDiscountType: Schema.OptionFromOptionalKey(
    Schema.Union([OfferDiscountTypeSchema, Schema.String]),
  ),

  /** The unique identifier of the app download transaction. */
  appTransactionId: Schema.OptionFromOptionalKey(Schema.String),

  /** The duration of the offer. */
  offerPeriod: Schema.OptionFromOptionalKey(Schema.String),

  /** The type of the refund or revocation. */
  revocationType: Schema.OptionFromOptionalKey(Schema.Union([RevocationTypeSchema, Schema.String])),

  /** The percentage, in milliunits, that has been refunded or revoked. */
  revocationPercentage: Schema.OptionFromOptionalKey(Schema.Number),

  /** Advanced Commerce transaction info, present only for Advanced Commerce subscriptions. */
  advancedCommerceInfo: Schema.OptionFromOptionalKey(AdvancedCommerceTransactionInfoSchema),

  /** Billing plan type for this transaction. */
  billingPlanType: Schema.OptionFromOptionalKey(
    Schema.Union([BillingPlanTypeSchema, Schema.String]),
  ),

  /** Commitment info for this transaction. */
  commitmentInfo: Schema.OptionFromOptionalKey(TransactionCommitmentInfoSchema),
});
export type JWSTransactionDecodedPayloadCodec = typeof JWSTransactionDecodedPayloadCodec.Type;

export type JWSTransactionDecodedPayload = Schema.Schema.Type<
  typeof JWSTransactionDecodedPayloadCodec
>;

/**
 * Decode a JWSTransactionDecodedPayload from an unknown value.
 */
const decodeJWSTransactionDecodedPayloadEffect = Schema.decodeUnknownEffect(
  JWSTransactionDecodedPayloadCodec,
);

/** Decode a JWSTransactionDecodedPayload from an unknown value. */
export function decodeJWSTransactionDecodedPayload(
  ...args: Parameters<typeof decodeJWSTransactionDecodedPayloadEffect>
): ReturnType<typeof decodeJWSTransactionDecodedPayloadEffect> {
  return decodeJWSTransactionDecodedPayloadEffect(...args);
}

export { JWSTransactionDecodedPayloadCodec as JWSTransactionDecodedPayloadSchema };
