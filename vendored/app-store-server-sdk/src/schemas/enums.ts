import * as R from "effect/Record";
import * as Schema from "effect/Schema";
import { constant } from "@voidhash/lib/lang";

// ===== Environment =====
export const Environment = constant({
  SANDBOX: "Sandbox",
  PRODUCTION: "Production",
  XCODE: "Xcode",
  LOCAL_TESTING: "LocalTesting",
});

export type Environment = (typeof Environment)[keyof typeof Environment];

export const EnvironmentCodec = Schema.Union([
  Schema.Literal(Environment.SANDBOX),
  Schema.Literal(Environment.PRODUCTION),
  Schema.Literal(Environment.XCODE),
  Schema.Literal(Environment.LOCAL_TESTING),
]);
export type EnvironmentCodec = typeof EnvironmentCodec.Type;

// ===== Status (subscription status) =====
export const Status = constant({
  ACTIVE: 1,
  EXPIRED: 2,
  BILLING_RETRY: 3,
  BILLING_GRACE_PERIOD: 4,
  REVOKED: 5,
});

export type Status = (typeof Status)[keyof typeof Status];

export const StatusCodec = Schema.Union([
  Schema.Literal(Status.ACTIVE),
  Schema.Literal(Status.EXPIRED),
  Schema.Literal(Status.BILLING_RETRY),
  Schema.Literal(Status.BILLING_GRACE_PERIOD),
  Schema.Literal(Status.REVOKED),
]);
export type StatusCodec = typeof StatusCodec.Type;

// ===== Type (product type) =====
export const Type = constant({
  AUTO_RENEWABLE_SUBSCRIPTION: "Auto-Renewable Subscription",
  NON_CONSUMABLE: "Non-Consumable",
  CONSUMABLE: "Consumable",
  NON_RENEWING_SUBSCRIPTION: "Non-Renewing Subscription",
});

export type Type = (typeof Type)[keyof typeof Type];

export const TypeCodec = Schema.Union([
  Schema.Literal(Type.AUTO_RENEWABLE_SUBSCRIPTION),
  Schema.Literal(Type.NON_CONSUMABLE),
  Schema.Literal(Type.CONSUMABLE),
  Schema.Literal(Type.NON_RENEWING_SUBSCRIPTION),
]);
export type TypeCodec = typeof TypeCodec.Type;

// ===== ProductType (for transaction history requests) =====
export const ProductType = constant({
  AUTO_RENEWABLE: "AUTO_RENEWABLE",
  NON_RENEWABLE: "NON_RENEWABLE",
  CONSUMABLE: "CONSUMABLE",
  NON_CONSUMABLE: "NON_CONSUMABLE",
});

export type ProductType = (typeof ProductType)[keyof typeof ProductType];

export const ProductTypeCodec = Schema.Union([
  Schema.Literal(ProductType.AUTO_RENEWABLE),
  Schema.Literal(ProductType.NON_RENEWABLE),
  Schema.Literal(ProductType.CONSUMABLE),
  Schema.Literal(ProductType.NON_CONSUMABLE),
]);
export type ProductTypeCodec = typeof ProductTypeCodec.Type;

// ===== Order (sort order) =====
export const Order = constant({
  ASCENDING: "ASCENDING",
  DESCENDING: "DESCENDING",
});

export type Order = (typeof Order)[keyof typeof Order];

export const OrderCodec = Schema.Union([
  Schema.Literal(Order.ASCENDING),
  Schema.Literal(Order.DESCENDING),
]);
export type OrderCodec = typeof OrderCodec.Type;

// ===== NotificationTypeV2 =====
export const NotificationTypeV2 = constant({
  SUBSCRIBED: "SUBSCRIBED",
  DID_CHANGE_RENEWAL_PREF: "DID_CHANGE_RENEWAL_PREF",
  DID_CHANGE_RENEWAL_STATUS: "DID_CHANGE_RENEWAL_STATUS",
  OFFER_REDEEMED: "OFFER_REDEEMED",
  DID_RENEW: "DID_RENEW",
  EXPIRED: "EXPIRED",
  DID_FAIL_TO_RENEW: "DID_FAIL_TO_RENEW",
  GRACE_PERIOD_EXPIRED: "GRACE_PERIOD_EXPIRED",
  PRICE_INCREASE: "PRICE_INCREASE",
  REFUND: "REFUND",
  REFUND_DECLINED: "REFUND_DECLINED",
  CONSUMPTION_REQUEST: "CONSUMPTION_REQUEST",
  RENEWAL_EXTENDED: "RENEWAL_EXTENDED",
  REVOKE: "REVOKE",
  TEST: "TEST",
  RENEWAL_EXTENSION: "RENEWAL_EXTENSION",
  REFUND_REVERSED: "REFUND_REVERSED",
  EXTERNAL_PURCHASE_TOKEN: "EXTERNAL_PURCHASE_TOKEN",
  ONE_TIME_CHARGE: "ONE_TIME_CHARGE",
  RESCIND_CONSENT: "RESCIND_CONSENT",
});

export type NotificationTypeV2 = (typeof NotificationTypeV2)[keyof typeof NotificationTypeV2];

export const NotificationTypeV2Codec = Schema.Union(
  R.values(NotificationTypeV2).map((v) => Schema.Literal(v)),
);
export type NotificationTypeV2Codec = typeof NotificationTypeV2Codec.Type;

// ===== Subtype =====
export const Subtype = constant({
  INITIAL_BUY: "INITIAL_BUY",
  RESUBSCRIBE: "RESUBSCRIBE",
  DOWNGRADE: "DOWNGRADE",
  UPGRADE: "UPGRADE",
  AUTO_RENEW_ENABLED: "AUTO_RENEW_ENABLED",
  AUTO_RENEW_DISABLED: "AUTO_RENEW_DISABLED",
  VOLUNTARY: "VOLUNTARY",
  BILLING_RETRY: "BILLING_RETRY",
  PRICE_INCREASE: "PRICE_INCREASE",
  GRACE_PERIOD: "GRACE_PERIOD",
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  BILLING_RECOVERY: "BILLING_RECOVERY",
  PRODUCT_NOT_FOR_SALE: "PRODUCT_NOT_FOR_SALE",
  SUMMARY: "SUMMARY",
  FAILURE: "FAILURE",
  UNREPORTED: "UNREPORTED",
});

export type Subtype = (typeof Subtype)[keyof typeof Subtype];

export const SubtypeCodec = Schema.Union(R.values(Subtype).map((v) => Schema.Literal(v)));
export type SubtypeCodec = typeof SubtypeCodec.Type;

// ===== OfferType =====
export const OfferType = constant({
  INTRODUCTORY_OFFER: 1,
  PROMOTIONAL_OFFER: 2,
  OFFER_CODE: 3,
  WIN_BACK_OFFER: 4,
});

export type OfferType = (typeof OfferType)[keyof typeof OfferType];

export const OfferTypeCodec = Schema.Union([
  Schema.Literal(OfferType.INTRODUCTORY_OFFER),
  Schema.Literal(OfferType.PROMOTIONAL_OFFER),
  Schema.Literal(OfferType.OFFER_CODE),
  Schema.Literal(OfferType.WIN_BACK_OFFER),
]);
export type OfferTypeCodec = typeof OfferTypeCodec.Type;

// ===== OfferDiscountType =====
export const OfferDiscountType = constant({
  FREE_TRIAL: "FREE_TRIAL",
  PAY_AS_YOU_GO: "PAY_AS_YOU_GO",
  PAY_UP_FRONT: "PAY_UP_FRONT",
  ONE_TIME: "ONE_TIME",
});

export type OfferDiscountType = (typeof OfferDiscountType)[keyof typeof OfferDiscountType];

export const OfferDiscountTypeCodec = Schema.Union([
  Schema.Literal(OfferDiscountType.FREE_TRIAL),
  Schema.Literal(OfferDiscountType.PAY_AS_YOU_GO),
  Schema.Literal(OfferDiscountType.PAY_UP_FRONT),
  Schema.Literal(OfferDiscountType.ONE_TIME),
]);
export type OfferDiscountTypeCodec = typeof OfferDiscountTypeCodec.Type;

// ===== AutoRenewStatus =====
export const AutoRenewStatus = constant({
  OFF: 0,
  ON: 1,
});

export type AutoRenewStatus = (typeof AutoRenewStatus)[keyof typeof AutoRenewStatus];

export const AutoRenewStatusCodec = Schema.Union([
  Schema.Literal(AutoRenewStatus.OFF),
  Schema.Literal(AutoRenewStatus.ON),
]);
export type AutoRenewStatusCodec = typeof AutoRenewStatusCodec.Type;

// ===== ExpirationIntent =====
export const ExpirationIntent = constant({
  CUSTOMER_CANCELLED: 1,
  BILLING_ERROR: 2,
  CUSTOMER_DID_NOT_CONSENT_TO_PRICE_INCREASE: 3,
  PRODUCT_NOT_AVAILABLE: 4,
  OTHER: 5,
});

export type ExpirationIntent = (typeof ExpirationIntent)[keyof typeof ExpirationIntent];

export const ExpirationIntentCodec = Schema.Union([
  Schema.Literal(ExpirationIntent.CUSTOMER_CANCELLED),
  Schema.Literal(ExpirationIntent.BILLING_ERROR),
  Schema.Literal(ExpirationIntent.CUSTOMER_DID_NOT_CONSENT_TO_PRICE_INCREASE),
  Schema.Literal(ExpirationIntent.PRODUCT_NOT_AVAILABLE),
  Schema.Literal(ExpirationIntent.OTHER),
]);
export type ExpirationIntentCodec = typeof ExpirationIntentCodec.Type;

// ===== PriceIncreaseStatus =====
export const PriceIncreaseStatus = constant({
  CUSTOMER_HAS_NOT_RESPONDED: 0,
  CUSTOMER_CONSENTED_OR_WAS_NOTIFIED_WITHOUT_NEEDING_CONSENT: 1,
});

export type PriceIncreaseStatus = (typeof PriceIncreaseStatus)[keyof typeof PriceIncreaseStatus];

export const PriceIncreaseStatusCodec = Schema.Union([
  Schema.Literal(PriceIncreaseStatus.CUSTOMER_HAS_NOT_RESPONDED),
  Schema.Literal(PriceIncreaseStatus.CUSTOMER_CONSENTED_OR_WAS_NOTIFIED_WITHOUT_NEEDING_CONSENT),
]);
export type PriceIncreaseStatusCodec = typeof PriceIncreaseStatusCodec.Type;

// ===== TransactionReason =====
export const TransactionReason = constant({
  PURCHASE: "PURCHASE",
  RENEWAL: "RENEWAL",
});

export type TransactionReason = (typeof TransactionReason)[keyof typeof TransactionReason];

export const TransactionReasonCodec = Schema.Union([
  Schema.Literal(TransactionReason.PURCHASE),
  Schema.Literal(TransactionReason.RENEWAL),
]);
export type TransactionReasonCodec = typeof TransactionReasonCodec.Type;

// ===== RevocationReason =====
export const RevocationReason = constant({
  REFUNDED_DUE_TO_ISSUE: 1,
  REFUNDED_FOR_OTHER_REASON: 0,
});

export type RevocationReason = (typeof RevocationReason)[keyof typeof RevocationReason];

export const RevocationReasonCodec = Schema.Union([
  Schema.Literal(RevocationReason.REFUNDED_DUE_TO_ISSUE),
  Schema.Literal(RevocationReason.REFUNDED_FOR_OTHER_REASON),
]);
export type RevocationReasonCodec = typeof RevocationReasonCodec.Type;

// ===== RevocationType =====
export const RevocationType = constant({
  REFUND_FULL: "REFUND_FULL",
  REFUND_PRORATED: "REFUND_PRORATED",
  FAMILY_REVOKE: "FAMILY_REVOKE",
});

export type RevocationType = (typeof RevocationType)[keyof typeof RevocationType];

export const RevocationTypeCodec = Schema.Union([
  Schema.Literal(RevocationType.REFUND_FULL),
  Schema.Literal(RevocationType.REFUND_PRORATED),
  Schema.Literal(RevocationType.FAMILY_REVOKE),
]);
export type RevocationTypeCodec = typeof RevocationTypeCodec.Type;

// ===== InAppOwnershipType =====
export const InAppOwnershipType = constant({
  FAMILY_SHARED: "FAMILY_SHARED",
  PURCHASED: "PURCHASED",
});

export type InAppOwnershipType = (typeof InAppOwnershipType)[keyof typeof InAppOwnershipType];

export const InAppOwnershipTypeCodec = Schema.Union([
  Schema.Literal(InAppOwnershipType.FAMILY_SHARED),
  Schema.Literal(InAppOwnershipType.PURCHASED),
]);
export type InAppOwnershipTypeCodec = typeof InAppOwnershipTypeCodec.Type;

// ===== Platform (consumption) =====
export const Platform = constant({
  UNDECLARED: 0,
  APPLE: 1,
  NON_APPLE: 2,
});

export type Platform = (typeof Platform)[keyof typeof Platform];

export const PlatformCodec = Schema.Union([
  Schema.Literal(Platform.UNDECLARED),
  Schema.Literal(Platform.APPLE),
  Schema.Literal(Platform.NON_APPLE),
]);
export type PlatformCodec = typeof PlatformCodec.Type;

// ===== PurchasePlatform =====
export const PurchasePlatform = constant({
  IOS: "iOS",
  MAC_OS: "macOS",
  TV_OS: "tvOS",
  VISION_OS: "visionOS",
});

export type PurchasePlatform = (typeof PurchasePlatform)[keyof typeof PurchasePlatform];

export const PurchasePlatformCodec = Schema.Union([
  Schema.Literal(PurchasePlatform.IOS),
  Schema.Literal(PurchasePlatform.MAC_OS),
  Schema.Literal(PurchasePlatform.TV_OS),
  Schema.Literal(PurchasePlatform.VISION_OS),
]);
export type PurchasePlatformCodec = typeof PurchasePlatformCodec.Type;

// ===== AccountTenure =====
export const AccountTenure = constant({
  UNDECLARED: 0,
  ZERO_TO_THREE_DAYS: 1,
  THREE_DAYS_TO_TEN_DAYS: 2,
  TEN_DAYS_TO_THIRTY_DAYS: 3,
  THIRTY_DAYS_TO_NINETY_DAYS: 4,
  NINETY_DAYS_TO_ONE_HUNDRED_EIGHTY_DAYS: 5,
  ONE_HUNDRED_EIGHTY_DAYS_TO_THREE_HUNDRED_SIXTY_FIVE_DAYS: 6,
  GREATER_THAN_THREE_HUNDRED_SIXTY_FIVE_DAYS: 7,
});

export type AccountTenure = (typeof AccountTenure)[keyof typeof AccountTenure];

export const AccountTenureCodec = Schema.Union(
  R.values(AccountTenure).map((v) => Schema.Literal(v)),
);
export type AccountTenureCodec = typeof AccountTenureCodec.Type;

// ===== PlayTime =====
export const PlayTime = constant({
  UNDECLARED: 0,
  ZERO_TO_FIVE_MINUTES: 1,
  FIVE_TO_SIXTY_MINUTES: 2,
  ONE_TO_SIX_HOURS: 3,
  SIX_HOURS_TO_TWENTY_FOUR_HOURS: 4,
  ONE_DAY_TO_FOUR_DAYS: 5,
  FOUR_DAYS_TO_SIXTEEN_DAYS: 6,
  OVER_SIXTEEN_DAYS: 7,
});

export type PlayTime = (typeof PlayTime)[keyof typeof PlayTime];

export const PlayTimeCodec = Schema.Union(R.values(PlayTime).map((v) => Schema.Literal(v)));
export type PlayTimeCodec = typeof PlayTimeCodec.Type;

// ===== ConsumptionStatus =====
export const ConsumptionStatus = constant({
  UNDECLARED: 0,
  NOT_CONSUMED: 1,
  PARTIALLY_CONSUMED: 2,
  FULLY_CONSUMED: 3,
});

export type ConsumptionStatus = (typeof ConsumptionStatus)[keyof typeof ConsumptionStatus];

export const ConsumptionStatusCodec = Schema.Union([
  Schema.Literal(ConsumptionStatus.UNDECLARED),
  Schema.Literal(ConsumptionStatus.NOT_CONSUMED),
  Schema.Literal(ConsumptionStatus.PARTIALLY_CONSUMED),
  Schema.Literal(ConsumptionStatus.FULLY_CONSUMED),
]);
export type ConsumptionStatusCodec = typeof ConsumptionStatusCodec.Type;

// ===== DeliveryStatus (V2) =====
export const DeliveryStatus = constant({
  DELIVERED: "DELIVERED",
  UNDELIVERED_QUALITY_ISSUE: "UNDELIVERED_QUALITY_ISSUE",
  UNDELIVERED_WRONG_ITEM: "UNDELIVERED_WRONG_ITEM",
  UNDELIVERED_SERVER_OUTAGE: "UNDELIVERED_SERVER_OUTAGE",
  UNDELIVERED_OTHER: "UNDELIVERED_OTHER",
});

export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

export const DeliveryStatusCodec = Schema.Union([
  Schema.Literal(DeliveryStatus.DELIVERED),
  Schema.Literal(DeliveryStatus.UNDELIVERED_QUALITY_ISSUE),
  Schema.Literal(DeliveryStatus.UNDELIVERED_WRONG_ITEM),
  Schema.Literal(DeliveryStatus.UNDELIVERED_SERVER_OUTAGE),
  Schema.Literal(DeliveryStatus.UNDELIVERED_OTHER),
]);
export type DeliveryStatusCodec = typeof DeliveryStatusCodec.Type;

// ===== DeliveryStatusV1 (deprecated) =====
export const DeliveryStatusV1 = constant({
  DELIVERED_AND_WORKING_PROPERLY: 0,
  DID_NOT_DELIVER_DUE_TO_QUALITY_ISSUE: 1,
  DELIVERED_WRONG_ITEM: 2,
  DID_NOT_DELIVER_DUE_TO_SERVER_OUTAGE: 3,
  DID_NOT_DELIVER_DUE_TO_IN_GAME_CURRENCY_CHANGE: 4,
  DID_NOT_DELIVER_FOR_OTHER_REASON: 5,
});

export type DeliveryStatusV1 = (typeof DeliveryStatusV1)[keyof typeof DeliveryStatusV1];

export const DeliveryStatusV1Codec = Schema.Union(
  R.values(DeliveryStatusV1).map((v) => Schema.Literal(v)),
);
export type DeliveryStatusV1Codec = typeof DeliveryStatusV1Codec.Type;

// ===== RefundPreference (V2) =====
export const RefundPreference = constant({
  DECLINE: "DECLINE",
  GRANT_FULL: "GRANT_FULL",
  GRANT_PRORATED: "GRANT_PRORATED",
});

export type RefundPreference = (typeof RefundPreference)[keyof typeof RefundPreference];

export const RefundPreferenceCodec = Schema.Union([
  Schema.Literal(RefundPreference.DECLINE),
  Schema.Literal(RefundPreference.GRANT_FULL),
  Schema.Literal(RefundPreference.GRANT_PRORATED),
]);
export type RefundPreferenceCodec = typeof RefundPreferenceCodec.Type;

// ===== RefundPreferenceV1 (deprecated) =====
export const RefundPreferenceV1 = constant({
  UNDECLARED: 0,
  PREFER_GRANT: 1,
  PREFER_DECLINE: 2,
  NO_PREFERENCE: 3,
});

export type RefundPreferenceV1 = (typeof RefundPreferenceV1)[keyof typeof RefundPreferenceV1];

export const RefundPreferenceV1Codec = Schema.Union([
  Schema.Literal(RefundPreferenceV1.UNDECLARED),
  Schema.Literal(RefundPreferenceV1.PREFER_GRANT),
  Schema.Literal(RefundPreferenceV1.PREFER_DECLINE),
  Schema.Literal(RefundPreferenceV1.NO_PREFERENCE),
]);
export type RefundPreferenceV1Codec = typeof RefundPreferenceV1Codec.Type;

// ===== UserStatus =====
export const UserStatus = constant({
  UNDECLARED: 0,
  ACTIVE: 1,
  SUSPENDED: 2,
  TERMINATED: 3,
  LIMITED_ACCESS: 4,
});

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const UserStatusCodec = Schema.Union([
  Schema.Literal(UserStatus.UNDECLARED),
  Schema.Literal(UserStatus.ACTIVE),
  Schema.Literal(UserStatus.SUSPENDED),
  Schema.Literal(UserStatus.TERMINATED),
  Schema.Literal(UserStatus.LIMITED_ACCESS),
]);
export type UserStatusCodec = typeof UserStatusCodec.Type;

// ===== SendAttemptResult =====
export const SendAttemptResult = constant({
  SUCCESS: "SUCCESS",
  TIMED_OUT: "TIMED_OUT",
  TLS_ISSUE: "TLS_ISSUE",
  CIRCULAR_REDIRECT: "CIRCULAR_REDIRECT",
  NO_RESPONSE: "NO_RESPONSE",
  SOCKET_ISSUE: "SOCKET_ISSUE",
  UNSUPPORTED_CHARSET: "UNSUPPORTED_CHARSET",
  INVALID_RESPONSE: "INVALID_RESPONSE",
  PREMATURE_CLOSE: "PREMATURE_CLOSE",
  UNSUCCESSFUL_HTTP_RESPONSE_CODE: "UNSUCCESSFUL_HTTP_RESPONSE_CODE",
  OTHER: "OTHER",
});

export type SendAttemptResult = (typeof SendAttemptResult)[keyof typeof SendAttemptResult];

export const SendAttemptResultCodec = Schema.Union(
  R.values(SendAttemptResult).map((v) => Schema.Literal(v)),
);
export type SendAttemptResultCodec = typeof SendAttemptResultCodec.Type;

// ===== OrderLookupStatus =====
export const OrderLookupStatus = constant({
  VALID: 0,
  INVALID: 1,
});

export type OrderLookupStatus = (typeof OrderLookupStatus)[keyof typeof OrderLookupStatus];

export const OrderLookupStatusCodec = Schema.Union([
  Schema.Literal(OrderLookupStatus.VALID),
  Schema.Literal(OrderLookupStatus.INVALID),
]);
export type OrderLookupStatusCodec = typeof OrderLookupStatusCodec.Type;

// ===== ExtendReasonCode =====
export const ExtendReasonCode = constant({
  UNDECLARED: 0,
  CUSTOMER_SATISFACTION: 1,
  OTHER: 2,
  SERVICE_ISSUE_OR_OUTAGE: 3,
});

export type ExtendReasonCode = (typeof ExtendReasonCode)[keyof typeof ExtendReasonCode];

export const ExtendReasonCodeCodec = Schema.Union([
  Schema.Literal(ExtendReasonCode.UNDECLARED),
  Schema.Literal(ExtendReasonCode.CUSTOMER_SATISFACTION),
  Schema.Literal(ExtendReasonCode.OTHER),
  Schema.Literal(ExtendReasonCode.SERVICE_ISSUE_OR_OUTAGE),
]);
export type ExtendReasonCodeCodec = typeof ExtendReasonCodeCodec.Type;

// ===== ImageState =====
export const ImageState = constant({
  PENDING_REVIEW: "PENDING_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
});

export type ImageState = (typeof ImageState)[keyof typeof ImageState];

export const ImageStateCodec = Schema.Union([
  Schema.Literal(ImageState.PENDING_REVIEW),
  Schema.Literal(ImageState.APPROVED),
  Schema.Literal(ImageState.REJECTED),
]);
export type ImageStateCodec = typeof ImageStateCodec.Type;

// ===== MessageState =====
export const MessageState = constant({
  PENDING_REVIEW: "PENDING_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
});

export type MessageState = (typeof MessageState)[keyof typeof MessageState];

export const MessageStateCodec = Schema.Union([
  Schema.Literal(MessageState.PENDING_REVIEW),
  Schema.Literal(MessageState.APPROVED),
  Schema.Literal(MessageState.REJECTED),
]);
export type MessageStateCodec = typeof MessageStateCodec.Type;

// ===== LifetimeDollarsPurchased =====
export const LifetimeDollarsPurchased = constant({
  UNDECLARED: 0,
  ZERO_DOLLARS: 1,
  ONE_CENT_TO_FORTY_NINE_DOLLARS_AND_NINETY_NINE_CENTS: 2,
  FIFTY_DOLLARS_TO_NINETY_NINE_DOLLARS_AND_NINETY_NINE_CENTS: 3,
  ONE_HUNDRED_DOLLARS_TO_FOUR_HUNDRED_NINETY_NINE_DOLLARS_AND_NINETY_NINE_CENTS: 4,
  FIVE_HUNDRED_DOLLARS_TO_NINE_HUNDRED_NINETY_NINE_DOLLARS_AND_NINETY_NINE_CENTS: 5,
  ONE_THOUSAND_DOLLARS_TO_ONE_THOUSAND_NINE_HUNDRED_NINETY_NINE_DOLLARS_AND_NINETY_NINE_CENTS: 6,
  TWO_THOUSAND_DOLLARS_OR_GREATER: 7,
});

export type LifetimeDollarsPurchased =
  (typeof LifetimeDollarsPurchased)[keyof typeof LifetimeDollarsPurchased];

export const LifetimeDollarsPurchasedCodec = Schema.Union(
  R.values(LifetimeDollarsPurchased).map((v) => Schema.Literal(v)),
);
export type LifetimeDollarsPurchasedCodec = typeof LifetimeDollarsPurchasedCodec.Type;

// ===== LifetimeDollarsRefunded =====
export const LifetimeDollarsRefunded = constant({
  UNDECLARED: 0,
  ZERO_DOLLARS: 1,
  ONE_CENT_TO_FORTY_NINE_DOLLARS_AND_NINETY_NINE_CENTS: 2,
  FIFTY_DOLLARS_TO_NINETY_NINE_DOLLARS_AND_NINETY_NINE_CENTS: 3,
  ONE_HUNDRED_DOLLARS_TO_FOUR_HUNDRED_NINETY_NINE_DOLLARS_AND_NINETY_NINE_CENTS: 4,
  FIVE_HUNDRED_DOLLARS_TO_NINE_HUNDRED_NINETY_NINE_DOLLARS_AND_NINETY_NINE_CENTS: 5,
  ONE_THOUSAND_DOLLARS_TO_ONE_THOUSAND_NINE_HUNDRED_NINETY_NINE_DOLLARS_AND_NINETY_NINE_CENTS: 6,
  TWO_THOUSAND_DOLLARS_OR_GREATER: 7,
});

export type LifetimeDollarsRefunded =
  (typeof LifetimeDollarsRefunded)[keyof typeof LifetimeDollarsRefunded];

export const LifetimeDollarsRefundedCodec = Schema.Union(
  R.values(LifetimeDollarsRefunded).map((v) => Schema.Literal(v)),
);
export type LifetimeDollarsRefundedCodec = typeof LifetimeDollarsRefundedCodec.Type;

// ===== ConsumptionRequestReason =====
export const ConsumptionRequestReason = constant({
  UNINTENDED_PURCHASE: "UNINTENDED_PURCHASE",
  FULFILLMENT_ISSUE: "FULFILLMENT_ISSUE",
  UNSATISFIED_WITH_PURCHASE: "UNSATISFIED_WITH_PURCHASE",
  LEGAL: "LEGAL",
  OTHER: "OTHER",
});

export type ConsumptionRequestReason =
  (typeof ConsumptionRequestReason)[keyof typeof ConsumptionRequestReason];

export const ConsumptionRequestReasonCodec = Schema.Union([
  Schema.Literal(ConsumptionRequestReason.UNINTENDED_PURCHASE),
  Schema.Literal(ConsumptionRequestReason.FULFILLMENT_ISSUE),
  Schema.Literal(ConsumptionRequestReason.UNSATISFIED_WITH_PURCHASE),
  Schema.Literal(ConsumptionRequestReason.LEGAL),
  Schema.Literal(ConsumptionRequestReason.OTHER),
]);
export type ConsumptionRequestReasonCodec = typeof ConsumptionRequestReasonCodec.Type;

// ===== GetTransactionHistoryVersion =====
export const GetTransactionHistoryVersion = constant({
  /** @deprecated */
  V1: "v1",
  V2: "v2",
});

export type GetTransactionHistoryVersion =
  (typeof GetTransactionHistoryVersion)[keyof typeof GetTransactionHistoryVersion];

export const GetTransactionHistoryVersionCodec = Schema.Union([
  Schema.Literal(GetTransactionHistoryVersion.V1),
  Schema.Literal(GetTransactionHistoryVersion.V2),
]);
export type GetTransactionHistoryVersionCodec = typeof GetTransactionHistoryVersionCodec.Type;

// ===== ImageSize =====
export const ImageSize = constant({
  FULL_SIZE: "FULL_SIZE",
});

export type ImageSize = (typeof ImageSize)[keyof typeof ImageSize];

export const ImageSizeCodec = Schema.Union([Schema.Literal(ImageSize.FULL_SIZE)]);
export type ImageSizeCodec = typeof ImageSizeCodec.Type;

// ===== HeaderPosition =====
export const HeaderPosition = constant({
  ABOVE_IMAGE: "ABOVE_IMAGE",
  BELOW_IMAGE: "BELOW_IMAGE",
});

export type HeaderPosition = (typeof HeaderPosition)[keyof typeof HeaderPosition];

export const HeaderPositionCodec = Schema.Union([
  Schema.Literal(HeaderPosition.ABOVE_IMAGE),
  Schema.Literal(HeaderPosition.BELOW_IMAGE),
]);
export type HeaderPositionCodec = typeof HeaderPositionCodec.Type;

// ===== BillingPlanType =====
export const BillingPlanType = constant({
  BILLED_UPFRONT: "BILLED_UPFRONT",
  MONTHLY: "MONTHLY",
});

export type BillingPlanType = (typeof BillingPlanType)[keyof typeof BillingPlanType];

export const BillingPlanTypeCodec = Schema.Union([
  Schema.Literal(BillingPlanType.BILLED_UPFRONT),
  Schema.Literal(BillingPlanType.MONTHLY),
]);
export type BillingPlanTypeCodec = typeof BillingPlanTypeCodec.Type;

// ===== RenewalBillingPlanType =====
export const RenewalBillingPlanType = constant({
  BILLED_UPFRONT: "BILLED_UPFRONT",
  MONTHLY: "MONTHLY",
});

export type RenewalBillingPlanType =
  (typeof RenewalBillingPlanType)[keyof typeof RenewalBillingPlanType];

export const RenewalBillingPlanTypeCodec = Schema.Union([
  Schema.Literal(RenewalBillingPlanType.BILLED_UPFRONT),
  Schema.Literal(RenewalBillingPlanType.MONTHLY),
]);
export type RenewalBillingPlanTypeCodec = typeof RenewalBillingPlanTypeCodec.Type;

// ===== PerformanceTestStatus =====
export const PerformanceTestStatus = constant({
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
});

export type PerformanceTestStatus =
  (typeof PerformanceTestStatus)[keyof typeof PerformanceTestStatus];

export const PerformanceTestStatusCodec = Schema.Union([
  Schema.Literal(PerformanceTestStatus.PENDING),
  Schema.Literal(PerformanceTestStatus.IN_PROGRESS),
  Schema.Literal(PerformanceTestStatus.COMPLETED),
]);
export type PerformanceTestStatusCodec = typeof PerformanceTestStatusCodec.Type;

// ===== PerformanceTestResult =====
export const PerformanceTestResult = constant({
  PASS: "PASS",
  FAIL: "FAIL",
});

export type PerformanceTestResult =
  (typeof PerformanceTestResult)[keyof typeof PerformanceTestResult];

export const PerformanceTestResultCodec = Schema.Union([
  Schema.Literal(PerformanceTestResult.PASS),
  Schema.Literal(PerformanceTestResult.FAIL),
]);
export type PerformanceTestResultCodec = typeof PerformanceTestResultCodec.Type;

// ===== AdvancedCommercePeriod =====
export const AdvancedCommercePeriod = constant({
  P1W: "P1W",
  P1M: "P1M",
  P2M: "P2M",
  P3M: "P3M",
  P6M: "P6M",
  P1Y: "P1Y",
});

export type AdvancedCommercePeriod =
  (typeof AdvancedCommercePeriod)[keyof typeof AdvancedCommercePeriod];

export const AdvancedCommercePeriodCodec = Schema.Union(
  R.values(AdvancedCommercePeriod).map((v) => Schema.Literal(v)),
);
export type AdvancedCommercePeriodCodec = typeof AdvancedCommercePeriodCodec.Type;

// ===== AdvancedCommerceOfferPeriod =====
export const AdvancedCommerceOfferPeriod = constant({
  P3D: "P3D",
  P1W: "P1W",
  P2W: "P2W",
  P1M: "P1M",
  P2M: "P2M",
  P3M: "P3M",
});

export type AdvancedCommerceOfferPeriod =
  (typeof AdvancedCommerceOfferPeriod)[keyof typeof AdvancedCommerceOfferPeriod];

export const AdvancedCommerceOfferPeriodCodec = Schema.Union(
  R.values(AdvancedCommerceOfferPeriod).map((v) => Schema.Literal(v)),
);
export type AdvancedCommerceOfferPeriodCodec = typeof AdvancedCommerceOfferPeriodCodec.Type;

// ===== AdvancedCommerceOfferReason =====
export const AdvancedCommerceOfferReason = constant({
  ACQUISITION: "ACQUISITION",
  WIN_BACK: "WIN_BACK",
  RETENTION: "RETENTION",
});

export type AdvancedCommerceOfferReason =
  (typeof AdvancedCommerceOfferReason)[keyof typeof AdvancedCommerceOfferReason];

export const AdvancedCommerceOfferReasonCodec = Schema.Union(
  R.values(AdvancedCommerceOfferReason).map((v) => Schema.Literal(v)),
);
export type AdvancedCommerceOfferReasonCodec = typeof AdvancedCommerceOfferReasonCodec.Type;

// ===== AdvancedCommerceReason =====
export const AdvancedCommerceReason = constant({
  UPGRADE: "UPGRADE",
  DOWNGRADE: "DOWNGRADE",
  APPLY_OFFER: "APPLY_OFFER",
});

export type AdvancedCommerceReason =
  (typeof AdvancedCommerceReason)[keyof typeof AdvancedCommerceReason];

export const AdvancedCommerceReasonCodec = Schema.Union(
  R.values(AdvancedCommerceReason).map((v) => Schema.Literal(v)),
);
export type AdvancedCommerceReasonCodec = typeof AdvancedCommerceReasonCodec.Type;

// ===== AdvancedCommerceRefundReason =====
export const AdvancedCommerceRefundReason = constant({
  UNINTENDED_PURCHASE: "UNINTENDED_PURCHASE",
  FULFILLMENT_ISSUE: "FULFILLMENT_ISSUE",
  UNSATISFIED_WITH_PURCHASE: "UNSATISFIED_WITH_PURCHASE",
  LEGAL: "LEGAL",
  OTHER: "OTHER",
  MODIFY_ITEMS_REFUND: "MODIFY_ITEMS_REFUND",
  SIMULATE_REFUND_DECLINE: "SIMULATE_REFUND_DECLINE",
});

export type AdvancedCommerceRefundReason =
  (typeof AdvancedCommerceRefundReason)[keyof typeof AdvancedCommerceRefundReason];

export const AdvancedCommerceRefundReasonCodec = Schema.Union(
  R.values(AdvancedCommerceRefundReason).map((v) => Schema.Literal(v)),
);
export type AdvancedCommerceRefundReasonCodec = typeof AdvancedCommerceRefundReasonCodec.Type;

// ===== AdvancedCommerceRefundType =====
export const AdvancedCommerceRefundType = constant({
  FULL: "FULL",
  PRORATED: "PRORATED",
  CUSTOM: "CUSTOM",
});

export type AdvancedCommerceRefundType =
  (typeof AdvancedCommerceRefundType)[keyof typeof AdvancedCommerceRefundType];

export const AdvancedCommerceRefundTypeCodec = Schema.Union(
  R.values(AdvancedCommerceRefundType).map((v) => Schema.Literal(v)),
);
export type AdvancedCommerceRefundTypeCodec = typeof AdvancedCommerceRefundTypeCodec.Type;

// ===== AdvancedCommerceEffective =====
export const AdvancedCommerceEffective = constant({
  IMMEDIATELY: "IMMEDIATELY",
  NEXT_BILL_CYCLE: "NEXT_BILL_CYCLE",
});

export type AdvancedCommerceEffective =
  (typeof AdvancedCommerceEffective)[keyof typeof AdvancedCommerceEffective];

export const AdvancedCommerceEffectiveCodec = Schema.Union(
  R.values(AdvancedCommerceEffective).map((v) => Schema.Literal(v)),
);
export type AdvancedCommerceEffectiveCodec = typeof AdvancedCommerceEffectiveCodec.Type;

// ===== AdvancedCommercePriceIncreaseInfoStatus =====
export const AdvancedCommercePriceIncreaseInfoStatus = constant({
  SCHEDULED: "SCHEDULED",
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
});

export type AdvancedCommercePriceIncreaseInfoStatus =
  (typeof AdvancedCommercePriceIncreaseInfoStatus)[keyof typeof AdvancedCommercePriceIncreaseInfoStatus];

export const AdvancedCommercePriceIncreaseInfoStatusCodec = Schema.Union(
  R.values(AdvancedCommercePriceIncreaseInfoStatus).map((v) => Schema.Literal(v)),
);
export type AdvancedCommercePriceIncreaseInfoStatusCodec = typeof AdvancedCommercePriceIncreaseInfoStatusCodec.Type;

export { EnvironmentCodec as EnvironmentSchema };
export { StatusCodec as StatusSchema };
export { TypeCodec as TypeSchema };
export { ProductTypeCodec as ProductTypeSchema };
export { OrderCodec as OrderSchema };
export { NotificationTypeV2Codec as NotificationTypeV2Schema };
export { SubtypeCodec as SubtypeSchema };
export { OfferTypeCodec as OfferTypeSchema };
export { OfferDiscountTypeCodec as OfferDiscountTypeSchema };
export { AutoRenewStatusCodec as AutoRenewStatusSchema };
export { ExpirationIntentCodec as ExpirationIntentSchema };
export { PriceIncreaseStatusCodec as PriceIncreaseStatusSchema };
export { TransactionReasonCodec as TransactionReasonSchema };
export { RevocationReasonCodec as RevocationReasonSchema };
export { RevocationTypeCodec as RevocationTypeSchema };
export { InAppOwnershipTypeCodec as InAppOwnershipTypeSchema };
export { PlatformCodec as PlatformSchema };
export { PurchasePlatformCodec as PurchasePlatformSchema };
export { AccountTenureCodec as AccountTenureSchema };
export { PlayTimeCodec as PlayTimeSchema };
export { ConsumptionStatusCodec as ConsumptionStatusSchema };
export { DeliveryStatusCodec as DeliveryStatusSchema };
export { DeliveryStatusV1Codec as DeliveryStatusV1Schema };
export { RefundPreferenceCodec as RefundPreferenceSchema };
export { RefundPreferenceV1Codec as RefundPreferenceV1Schema };
export { UserStatusCodec as UserStatusSchema };
export { SendAttemptResultCodec as SendAttemptResultSchema };
export { OrderLookupStatusCodec as OrderLookupStatusSchema };
export { ExtendReasonCodeCodec as ExtendReasonCodeSchema };
export { ImageStateCodec as ImageStateSchema };
export { MessageStateCodec as MessageStateSchema };
export { LifetimeDollarsPurchasedCodec as LifetimeDollarsPurchasedSchema };
export { LifetimeDollarsRefundedCodec as LifetimeDollarsRefundedSchema };
export { ConsumptionRequestReasonCodec as ConsumptionRequestReasonSchema };
export { GetTransactionHistoryVersionCodec as GetTransactionHistoryVersionSchema };
export { ImageSizeCodec as ImageSizeSchema };
export { HeaderPositionCodec as HeaderPositionSchema };
export { BillingPlanTypeCodec as BillingPlanTypeSchema };
export { RenewalBillingPlanTypeCodec as RenewalBillingPlanTypeSchema };
export { PerformanceTestStatusCodec as PerformanceTestStatusSchema };
export { PerformanceTestResultCodec as PerformanceTestResultSchema };
export { AdvancedCommercePeriodCodec as AdvancedCommercePeriodSchema };
export { AdvancedCommerceOfferPeriodCodec as AdvancedCommerceOfferPeriodSchema };
export { AdvancedCommerceOfferReasonCodec as AdvancedCommerceOfferReasonSchema };
export { AdvancedCommerceReasonCodec as AdvancedCommerceReasonSchema };
export { AdvancedCommerceRefundReasonCodec as AdvancedCommerceRefundReasonSchema };
export { AdvancedCommerceRefundTypeCodec as AdvancedCommerceRefundTypeSchema };
export { AdvancedCommerceEffectiveCodec as AdvancedCommerceEffectiveSchema };
export { AdvancedCommercePriceIncreaseInfoStatusCodec as AdvancedCommercePriceIncreaseInfoStatusSchema };
