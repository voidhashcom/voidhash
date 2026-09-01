import * as Schema from "effect/Schema";
import {
  AdvancedCommerceRenewalInfoSchema,
  RenewalCommitmentInfoSchema,
} from "./advanced-commerce.ts";
import {
  AutoRenewStatusSchema,
  EnvironmentSchema,
  ExpirationIntentSchema,
  OfferDiscountTypeSchema,
  OfferTypeSchema,
  PriceIncreaseStatusSchema,
  RenewalBillingPlanTypeSchema,
} from "./enums.ts";

/**
 * A decoded payload containing subscription renewal information for an auto-renewable subscription.
 * @see https://developer.apple.com/documentation/appstoreserverapi/jwsrenewalinfodecodedpayload
 */
export const JWSRenewalInfoDecodedPayloadCodec = Schema.Struct({
  /** The reason the subscription expired. */
  expirationIntent: Schema.OptionFromOptionalKey(
    Schema.Union([ExpirationIntentSchema, Schema.Number]),
  ),

  /** The original transaction identifier of a purchase. */
  originalTransactionId: Schema.OptionFromOptionalKey(Schema.String),

  /** The product identifier of the product that will renew at the next billing period. */
  autoRenewProductId: Schema.OptionFromOptionalKey(Schema.String),

  /** The unique identifier for the product. */
  productId: Schema.OptionFromOptionalKey(Schema.String),

  /** The renewal status of the auto-renewable subscription. */
  autoRenewStatus: Schema.OptionFromOptionalKey(
    Schema.Union([AutoRenewStatusSchema, Schema.Number]),
  ),

  /** Whether the App Store is attempting to automatically renew an expired subscription. */
  isInBillingRetryPeriod: Schema.OptionFromOptionalKey(Schema.Boolean),

  /** The status indicating whether the subscription is subject to a price increase. */
  priceIncreaseStatus: Schema.OptionFromOptionalKey(
    Schema.Union([PriceIncreaseStatusSchema, Schema.Number]),
  ),

  /** The time when the billing grace period expires (Unix timestamp in milliseconds). */
  gracePeriodExpiresDate: Schema.OptionFromOptionalKey(Schema.Number),

  /** The type of subscription offer. */
  offerType: Schema.OptionFromOptionalKey(Schema.Union([OfferTypeSchema, Schema.Number])),

  /** The offer code or promotional offer identifier. */
  offerIdentifier: Schema.OptionFromOptionalKey(Schema.String),

  /** The time the App Store signed the JWS data (Unix timestamp in milliseconds). */
  signedDate: Schema.OptionFromOptionalKey(Schema.Number),

  /** The server environment, either sandbox or production. */
  environment: Schema.OptionFromOptionalKey(Schema.Union([EnvironmentSchema, Schema.String])),

  /** The earliest start date of a subscription in a series (Unix timestamp in milliseconds). */
  recentSubscriptionStartDate: Schema.OptionFromOptionalKey(Schema.Number),

  /** The time when the most recent subscription purchase expires (Unix timestamp in milliseconds). */
  renewalDate: Schema.OptionFromOptionalKey(Schema.Number),

  /** The currency code for the renewal price. */
  currency: Schema.OptionFromOptionalKey(Schema.String),

  /** The renewal price, in milliunits, of the subscription. */
  renewalPrice: Schema.OptionFromOptionalKey(Schema.Number),

  /** The payment mode for the offer. */
  offerDiscountType: Schema.OptionFromOptionalKey(
    Schema.Union([OfferDiscountTypeSchema, Schema.String]),
  ),

  /** An array of win-back offer identifiers the customer is eligible to redeem. */
  eligibleWinBackOfferIds: Schema.OptionFromOptionalKey(Schema.Array(Schema.String)),

  /** The UUID that maps a customer's in-app purchase with its resulting transaction. */
  appAccountToken: Schema.OptionFromOptionalKey(Schema.String),

  /** The unique identifier of the app download transaction. */
  appTransactionId: Schema.OptionFromOptionalKey(Schema.String),

  /** The duration of the offer. */
  offerPeriod: Schema.OptionFromOptionalKey(Schema.String),

  /** Advanced Commerce renewal info, present only for Advanced Commerce subscriptions. */
  advancedCommerceInfo: Schema.OptionFromOptionalKey(AdvancedCommerceRenewalInfoSchema),

  /** Renewal commitment information. */
  commitmentInfo: Schema.OptionFromOptionalKey(RenewalCommitmentInfoSchema),

  /** Renewal billing plan type. */
  renewalBillingPlanType: Schema.OptionFromOptionalKey(
    Schema.Union([RenewalBillingPlanTypeSchema, Schema.String]),
  ),
});
export type JWSRenewalInfoDecodedPayloadCodec = typeof JWSRenewalInfoDecodedPayloadCodec.Type;

export type JWSRenewalInfoDecodedPayload = Schema.Schema.Type<
  typeof JWSRenewalInfoDecodedPayloadCodec
>;

/**
 * Decode a JWSRenewalInfoDecodedPayload from an unknown value.
 */
const decodeJWSRenewalInfoDecodedPayloadEffect = Schema.decodeUnknownEffect(
  JWSRenewalInfoDecodedPayloadCodec,
);

/** Decode a JWSRenewalInfoDecodedPayload from an unknown value. */
export function decodeJWSRenewalInfoDecodedPayload(
  ...args: Parameters<typeof decodeJWSRenewalInfoDecodedPayloadEffect>
): ReturnType<typeof decodeJWSRenewalInfoDecodedPayloadEffect> {
  return decodeJWSRenewalInfoDecodedPayloadEffect(...args);
}

export { JWSRenewalInfoDecodedPayloadCodec as JWSRenewalInfoDecodedPayloadSchema };
