import { Schema } from "effect";

// ===== Environment =====
export const Environment = {
  SANDBOX: "Sandbox",
  PRODUCTION: "Production",
  XCODE: "Xcode",
  LOCAL_TESTING: "LocalTesting",
} as const;

export type Environment = (typeof Environment)[keyof typeof Environment];

export const EnvironmentSchema = Schema.Union([
  Schema.Literal(Environment.SANDBOX),
  Schema.Literal(Environment.PRODUCTION),
  Schema.Literal(Environment.XCODE),
  Schema.Literal(Environment.LOCAL_TESTING),
]);

// ===== Status (subscription status) =====
export const Status = {
  ACTIVE: 1,
  EXPIRED: 2,
  BILLING_RETRY: 3,
  BILLING_GRACE_PERIOD: 4,
  REVOKED: 5,
} as const;

export type Status = (typeof Status)[keyof typeof Status];

export const StatusSchema = Schema.Union([
  Schema.Literal(Status.ACTIVE),
  Schema.Literal(Status.EXPIRED),
  Schema.Literal(Status.BILLING_RETRY),
  Schema.Literal(Status.BILLING_GRACE_PERIOD),
  Schema.Literal(Status.REVOKED),
]);

// ===== Type (product type) =====
export const Type = {
  AUTO_RENEWABLE_SUBSCRIPTION: "Auto-Renewable Subscription",
  NON_CONSUMABLE: "Non-Consumable",
  CONSUMABLE: "Consumable",
  NON_RENEWING_SUBSCRIPTION: "Non-Renewing Subscription",
} as const;

export type Type = (typeof Type)[keyof typeof Type];

export const TypeSchema = Schema.Union([
  Schema.Literal(Type.AUTO_RENEWABLE_SUBSCRIPTION),
  Schema.Literal(Type.NON_CONSUMABLE),
  Schema.Literal(Type.CONSUMABLE),
  Schema.Literal(Type.NON_RENEWING_SUBSCRIPTION),
]);

// ===== ProductType (for transaction history requests) =====
export const ProductType = {
  AUTO_RENEWABLE: "AUTO_RENEWABLE",
  NON_RENEWABLE: "NON_RENEWABLE",
  CONSUMABLE: "CONSUMABLE",
  NON_CONSUMABLE: "NON_CONSUMABLE",
} as const;

export type ProductType = (typeof ProductType)[keyof typeof ProductType];

export const ProductTypeSchema = Schema.Union([
  Schema.Literal(ProductType.AUTO_RENEWABLE),
  Schema.Literal(ProductType.NON_RENEWABLE),
  Schema.Literal(ProductType.CONSUMABLE),
  Schema.Literal(ProductType.NON_CONSUMABLE),
]);

// ===== Order (sort order) =====
export const Order = {
  ASCENDING: "ASCENDING",
  DESCENDING: "DESCENDING",
} as const;

export type Order = (typeof Order)[keyof typeof Order];

export const OrderSchema = Schema.Union([
  Schema.Literal(Order.ASCENDING),
  Schema.Literal(Order.DESCENDING),
]);

// ===== NotificationTypeV2 =====
export const NotificationTypeV2 = {
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
} as const;

export type NotificationTypeV2 = (typeof NotificationTypeV2)[keyof typeof NotificationTypeV2];

export const NotificationTypeV2Schema = Schema.Union(
  Object.values(NotificationTypeV2).map((v) => Schema.Literal(v)),
);

// ===== Subtype =====
export const Subtype = {
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
} as const;

export type Subtype = (typeof Subtype)[keyof typeof Subtype];

export const SubtypeSchema = Schema.Union(Object.values(Subtype).map((v) => Schema.Literal(v)));

// ===== OfferType =====
export const OfferType = {
  INTRODUCTORY_OFFER: 1,
  PROMOTIONAL_OFFER: 2,
  OFFER_CODE: 3,
  WIN_BACK_OFFER: 4,
} as const;

export type OfferType = (typeof OfferType)[keyof typeof OfferType];

export const OfferTypeSchema = Schema.Union([
  Schema.Literal(OfferType.INTRODUCTORY_OFFER),
  Schema.Literal(OfferType.PROMOTIONAL_OFFER),
  Schema.Literal(OfferType.OFFER_CODE),
  Schema.Literal(OfferType.WIN_BACK_OFFER),
]);

// ===== OfferDiscountType =====
export const OfferDiscountType = {
  FREE_TRIAL: "FREE_TRIAL",
  PAY_AS_YOU_GO: "PAY_AS_YOU_GO",
  PAY_UP_FRONT: "PAY_UP_FRONT",
  ONE_TIME: "ONE_TIME",
} as const;

export type OfferDiscountType = (typeof OfferDiscountType)[keyof typeof OfferDiscountType];

export const OfferDiscountTypeSchema = Schema.Union([
  Schema.Literal(OfferDiscountType.FREE_TRIAL),
  Schema.Literal(OfferDiscountType.PAY_AS_YOU_GO),
  Schema.Literal(OfferDiscountType.PAY_UP_FRONT),
  Schema.Literal(OfferDiscountType.ONE_TIME),
]);

// ===== AutoRenewStatus =====
export const AutoRenewStatus = {
  OFF: 0,
  ON: 1,
} as const;

export type AutoRenewStatus = (typeof AutoRenewStatus)[keyof typeof AutoRenewStatus];

export const AutoRenewStatusSchema = Schema.Union([
  Schema.Literal(AutoRenewStatus.OFF),
  Schema.Literal(AutoRenewStatus.ON),
]);

// ===== ExpirationIntent =====
export const ExpirationIntent = {
  CUSTOMER_CANCELLED: 1,
  BILLING_ERROR: 2,
  CUSTOMER_DID_NOT_CONSENT_TO_PRICE_INCREASE: 3,
  PRODUCT_NOT_AVAILABLE: 4,
  OTHER: 5,
} as const;

export type ExpirationIntent = (typeof ExpirationIntent)[keyof typeof ExpirationIntent];

export const ExpirationIntentSchema = Schema.Union([
  Schema.Literal(ExpirationIntent.CUSTOMER_CANCELLED),
  Schema.Literal(ExpirationIntent.BILLING_ERROR),
  Schema.Literal(ExpirationIntent.CUSTOMER_DID_NOT_CONSENT_TO_PRICE_INCREASE),
  Schema.Literal(ExpirationIntent.PRODUCT_NOT_AVAILABLE),
  Schema.Literal(ExpirationIntent.OTHER),
]);

// ===== PriceIncreaseStatus =====
export const PriceIncreaseStatus = {
  CUSTOMER_HAS_NOT_RESPONDED: 0,
  CUSTOMER_CONSENTED_OR_WAS_NOTIFIED_WITHOUT_NEEDING_CONSENT: 1,
} as const;

export type PriceIncreaseStatus = (typeof PriceIncreaseStatus)[keyof typeof PriceIncreaseStatus];

export const PriceIncreaseStatusSchema = Schema.Union([
  Schema.Literal(PriceIncreaseStatus.CUSTOMER_HAS_NOT_RESPONDED),
  Schema.Literal(PriceIncreaseStatus.CUSTOMER_CONSENTED_OR_WAS_NOTIFIED_WITHOUT_NEEDING_CONSENT),
]);

// ===== TransactionReason =====
export const TransactionReason = {
  PURCHASE: "PURCHASE",
  RENEWAL: "RENEWAL",
} as const;

export type TransactionReason = (typeof TransactionReason)[keyof typeof TransactionReason];

export const TransactionReasonSchema = Schema.Union([
  Schema.Literal(TransactionReason.PURCHASE),
  Schema.Literal(TransactionReason.RENEWAL),
]);

// ===== RevocationReason =====
export const RevocationReason = {
  REFUNDED_DUE_TO_ISSUE: 1,
  REFUNDED_FOR_OTHER_REASON: 0,
} as const;

export type RevocationReason = (typeof RevocationReason)[keyof typeof RevocationReason];

export const RevocationReasonSchema = Schema.Union([
  Schema.Literal(RevocationReason.REFUNDED_DUE_TO_ISSUE),
  Schema.Literal(RevocationReason.REFUNDED_FOR_OTHER_REASON),
]);

// ===== RevocationType =====
export const RevocationType = {
  REFUND_FULL: "REFUND_FULL",
  REFUND_PRORATED: "REFUND_PRORATED",
  FAMILY_REVOKE: "FAMILY_REVOKE",
} as const;

export type RevocationType = (typeof RevocationType)[keyof typeof RevocationType];

export const RevocationTypeSchema = Schema.Union([
  Schema.Literal(RevocationType.REFUND_FULL),
  Schema.Literal(RevocationType.REFUND_PRORATED),
  Schema.Literal(RevocationType.FAMILY_REVOKE),
]);

// ===== InAppOwnershipType =====
export const InAppOwnershipType = {
  FAMILY_SHARED: "FAMILY_SHARED",
  PURCHASED: "PURCHASED",
} as const;

export type InAppOwnershipType = (typeof InAppOwnershipType)[keyof typeof InAppOwnershipType];

export const InAppOwnershipTypeSchema = Schema.Union([
  Schema.Literal(InAppOwnershipType.FAMILY_SHARED),
  Schema.Literal(InAppOwnershipType.PURCHASED),
]);

// ===== Platform (consumption) =====
export const Platform = {
  UNDECLARED: 0,
  APPLE: 1,
  NON_APPLE: 2,
} as const;

export type Platform = (typeof Platform)[keyof typeof Platform];

export const PlatformSchema = Schema.Union([
  Schema.Literal(Platform.UNDECLARED),
  Schema.Literal(Platform.APPLE),
  Schema.Literal(Platform.NON_APPLE),
]);

// ===== PurchasePlatform =====
export const PurchasePlatform = {
  IOS: "iOS",
  MAC_OS: "macOS",
  TV_OS: "tvOS",
  VISION_OS: "visionOS",
} as const;

export type PurchasePlatform = (typeof PurchasePlatform)[keyof typeof PurchasePlatform];

export const PurchasePlatformSchema = Schema.Union([
  Schema.Literal(PurchasePlatform.IOS),
  Schema.Literal(PurchasePlatform.MAC_OS),
  Schema.Literal(PurchasePlatform.TV_OS),
  Schema.Literal(PurchasePlatform.VISION_OS),
]);

// ===== AccountTenure =====
export const AccountTenure = {
  UNDECLARED: 0,
  ZERO_TO_THREE_DAYS: 1,
  THREE_DAYS_TO_TEN_DAYS: 2,
  TEN_DAYS_TO_THIRTY_DAYS: 3,
  THIRTY_DAYS_TO_NINETY_DAYS: 4,
  NINETY_DAYS_TO_ONE_HUNDRED_EIGHTY_DAYS: 5,
  ONE_HUNDRED_EIGHTY_DAYS_TO_THREE_HUNDRED_SIXTY_FIVE_DAYS: 6,
  GREATER_THAN_THREE_HUNDRED_SIXTY_FIVE_DAYS: 7,
} as const;

export type AccountTenure = (typeof AccountTenure)[keyof typeof AccountTenure];

export const AccountTenureSchema = Schema.Union(
  Object.values(AccountTenure).map((v) => Schema.Literal(v)),
);

// ===== PlayTime =====
export const PlayTime = {
  UNDECLARED: 0,
  ZERO_TO_FIVE_MINUTES: 1,
  FIVE_TO_SIXTY_MINUTES: 2,
  ONE_TO_SIX_HOURS: 3,
  SIX_HOURS_TO_TWENTY_FOUR_HOURS: 4,
  ONE_DAY_TO_FOUR_DAYS: 5,
  FOUR_DAYS_TO_SIXTEEN_DAYS: 6,
  OVER_SIXTEEN_DAYS: 7,
} as const;

export type PlayTime = (typeof PlayTime)[keyof typeof PlayTime];

export const PlayTimeSchema = Schema.Union(Object.values(PlayTime).map((v) => Schema.Literal(v)));

// ===== ConsumptionStatus =====
export const ConsumptionStatus = {
  UNDECLARED: 0,
  NOT_CONSUMED: 1,
  PARTIALLY_CONSUMED: 2,
  FULLY_CONSUMED: 3,
} as const;

export type ConsumptionStatus = (typeof ConsumptionStatus)[keyof typeof ConsumptionStatus];

export const ConsumptionStatusSchema = Schema.Union([
  Schema.Literal(ConsumptionStatus.UNDECLARED),
  Schema.Literal(ConsumptionStatus.NOT_CONSUMED),
  Schema.Literal(ConsumptionStatus.PARTIALLY_CONSUMED),
  Schema.Literal(ConsumptionStatus.FULLY_CONSUMED),
]);

// ===== DeliveryStatus (V2) =====
export const DeliveryStatus = {
  DELIVERED: "DELIVERED",
  UNDELIVERED_QUALITY_ISSUE: "UNDELIVERED_QUALITY_ISSUE",
  UNDELIVERED_WRONG_ITEM: "UNDELIVERED_WRONG_ITEM",
  UNDELIVERED_SERVER_OUTAGE: "UNDELIVERED_SERVER_OUTAGE",
  UNDELIVERED_OTHER: "UNDELIVERED_OTHER",
} as const;

export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

export const DeliveryStatusSchema = Schema.Union([
  Schema.Literal(DeliveryStatus.DELIVERED),
  Schema.Literal(DeliveryStatus.UNDELIVERED_QUALITY_ISSUE),
  Schema.Literal(DeliveryStatus.UNDELIVERED_WRONG_ITEM),
  Schema.Literal(DeliveryStatus.UNDELIVERED_SERVER_OUTAGE),
  Schema.Literal(DeliveryStatus.UNDELIVERED_OTHER),
]);

// ===== DeliveryStatusV1 (deprecated) =====
export const DeliveryStatusV1 = {
  DELIVERED_AND_WORKING_PROPERLY: 0,
  DID_NOT_DELIVER_DUE_TO_QUALITY_ISSUE: 1,
  DELIVERED_WRONG_ITEM: 2,
  DID_NOT_DELIVER_DUE_TO_SERVER_OUTAGE: 3,
  DID_NOT_DELIVER_DUE_TO_IN_GAME_CURRENCY_CHANGE: 4,
  DID_NOT_DELIVER_FOR_OTHER_REASON: 5,
} as const;

export type DeliveryStatusV1 = (typeof DeliveryStatusV1)[keyof typeof DeliveryStatusV1];

export const DeliveryStatusV1Schema = Schema.Union(
  Object.values(DeliveryStatusV1).map((v) => Schema.Literal(v)),
);

// ===== RefundPreference (V2) =====
export const RefundPreference = {
  DECLINE: "DECLINE",
  GRANT_FULL: "GRANT_FULL",
  GRANT_PRORATED: "GRANT_PRORATED",
} as const;

export type RefundPreference = (typeof RefundPreference)[keyof typeof RefundPreference];

export const RefundPreferenceSchema = Schema.Union([
  Schema.Literal(RefundPreference.DECLINE),
  Schema.Literal(RefundPreference.GRANT_FULL),
  Schema.Literal(RefundPreference.GRANT_PRORATED),
]);

// ===== RefundPreferenceV1 (deprecated) =====
export const RefundPreferenceV1 = {
  UNDECLARED: 0,
  PREFER_GRANT: 1,
  PREFER_DECLINE: 2,
  NO_PREFERENCE: 3,
} as const;

export type RefundPreferenceV1 = (typeof RefundPreferenceV1)[keyof typeof RefundPreferenceV1];

export const RefundPreferenceV1Schema = Schema.Union([
  Schema.Literal(RefundPreferenceV1.UNDECLARED),
  Schema.Literal(RefundPreferenceV1.PREFER_GRANT),
  Schema.Literal(RefundPreferenceV1.PREFER_DECLINE),
  Schema.Literal(RefundPreferenceV1.NO_PREFERENCE),
]);

// ===== UserStatus =====
export const UserStatus = {
  UNDECLARED: 0,
  ACTIVE: 1,
  SUSPENDED: 2,
  TERMINATED: 3,
  LIMITED_ACCESS: 4,
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const UserStatusSchema = Schema.Union([
  Schema.Literal(UserStatus.UNDECLARED),
  Schema.Literal(UserStatus.ACTIVE),
  Schema.Literal(UserStatus.SUSPENDED),
  Schema.Literal(UserStatus.TERMINATED),
  Schema.Literal(UserStatus.LIMITED_ACCESS),
]);

// ===== SendAttemptResult =====
export const SendAttemptResult = {
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
} as const;

export type SendAttemptResult = (typeof SendAttemptResult)[keyof typeof SendAttemptResult];

export const SendAttemptResultSchema = Schema.Union(
  Object.values(SendAttemptResult).map((v) => Schema.Literal(v)),
);

// ===== OrderLookupStatus =====
export const OrderLookupStatus = {
  VALID: 0,
  INVALID: 1,
} as const;

export type OrderLookupStatus = (typeof OrderLookupStatus)[keyof typeof OrderLookupStatus];

export const OrderLookupStatusSchema = Schema.Union([
  Schema.Literal(OrderLookupStatus.VALID),
  Schema.Literal(OrderLookupStatus.INVALID),
]);

// ===== ExtendReasonCode =====
export const ExtendReasonCode = {
  UNDECLARED: 0,
  CUSTOMER_SATISFACTION: 1,
  OTHER: 2,
  SERVICE_ISSUE_OR_OUTAGE: 3,
} as const;

export type ExtendReasonCode = (typeof ExtendReasonCode)[keyof typeof ExtendReasonCode];

export const ExtendReasonCodeSchema = Schema.Union([
  Schema.Literal(ExtendReasonCode.UNDECLARED),
  Schema.Literal(ExtendReasonCode.CUSTOMER_SATISFACTION),
  Schema.Literal(ExtendReasonCode.OTHER),
  Schema.Literal(ExtendReasonCode.SERVICE_ISSUE_OR_OUTAGE),
]);

// ===== ImageState =====
export const ImageState = {
  PENDING_REVIEW: "PENDING_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export type ImageState = (typeof ImageState)[keyof typeof ImageState];

export const ImageStateSchema = Schema.Union([
  Schema.Literal(ImageState.PENDING_REVIEW),
  Schema.Literal(ImageState.APPROVED),
  Schema.Literal(ImageState.REJECTED),
]);

// ===== MessageState =====
export const MessageState = {
  PENDING_REVIEW: "PENDING_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export type MessageState = (typeof MessageState)[keyof typeof MessageState];

export const MessageStateSchema = Schema.Union([
  Schema.Literal(MessageState.PENDING_REVIEW),
  Schema.Literal(MessageState.APPROVED),
  Schema.Literal(MessageState.REJECTED),
]);

// ===== LifetimeDollarsPurchased =====
export const LifetimeDollarsPurchased = {
  UNDECLARED: 0,
  ZERO_DOLLARS: 1,
  ONE_CENT_TO_FORTY_NINE_DOLLARS_AND_NINETY_NINE_CENTS: 2,
  FIFTY_DOLLARS_TO_NINETY_NINE_DOLLARS_AND_NINETY_NINE_CENTS: 3,
  ONE_HUNDRED_DOLLARS_TO_FOUR_HUNDRED_NINETY_NINE_DOLLARS_AND_NINETY_NINE_CENTS: 4,
  FIVE_HUNDRED_DOLLARS_TO_NINE_HUNDRED_NINETY_NINE_DOLLARS_AND_NINETY_NINE_CENTS: 5,
  ONE_THOUSAND_DOLLARS_TO_ONE_THOUSAND_NINE_HUNDRED_NINETY_NINE_DOLLARS_AND_NINETY_NINE_CENTS: 6,
  TWO_THOUSAND_DOLLARS_OR_GREATER: 7,
} as const;

export type LifetimeDollarsPurchased =
  (typeof LifetimeDollarsPurchased)[keyof typeof LifetimeDollarsPurchased];

export const LifetimeDollarsPurchasedSchema = Schema.Union(
  Object.values(LifetimeDollarsPurchased).map((v) => Schema.Literal(v)),
);

// ===== LifetimeDollarsRefunded =====
export const LifetimeDollarsRefunded = {
  UNDECLARED: 0,
  ZERO_DOLLARS: 1,
  ONE_CENT_TO_FORTY_NINE_DOLLARS_AND_NINETY_NINE_CENTS: 2,
  FIFTY_DOLLARS_TO_NINETY_NINE_DOLLARS_AND_NINETY_NINE_CENTS: 3,
  ONE_HUNDRED_DOLLARS_TO_FOUR_HUNDRED_NINETY_NINE_DOLLARS_AND_NINETY_NINE_CENTS: 4,
  FIVE_HUNDRED_DOLLARS_TO_NINE_HUNDRED_NINETY_NINE_DOLLARS_AND_NINETY_NINE_CENTS: 5,
  ONE_THOUSAND_DOLLARS_TO_ONE_THOUSAND_NINE_HUNDRED_NINETY_NINE_DOLLARS_AND_NINETY_NINE_CENTS: 6,
  TWO_THOUSAND_DOLLARS_OR_GREATER: 7,
} as const;

export type LifetimeDollarsRefunded =
  (typeof LifetimeDollarsRefunded)[keyof typeof LifetimeDollarsRefunded];

export const LifetimeDollarsRefundedSchema = Schema.Union(
  Object.values(LifetimeDollarsRefunded).map((v) => Schema.Literal(v)),
);

// ===== ConsumptionRequestReason =====
export const ConsumptionRequestReason = {
  UNINTENDED_PURCHASE: "UNINTENDED_PURCHASE",
  FULFILLMENT_ISSUE: "FULFILLMENT_ISSUE",
  UNSATISFIED_WITH_PURCHASE: "UNSATISFIED_WITH_PURCHASE",
  LEGAL: "LEGAL",
  OTHER: "OTHER",
} as const;

export type ConsumptionRequestReason =
  (typeof ConsumptionRequestReason)[keyof typeof ConsumptionRequestReason];

export const ConsumptionRequestReasonSchema = Schema.Union([
  Schema.Literal(ConsumptionRequestReason.UNINTENDED_PURCHASE),
  Schema.Literal(ConsumptionRequestReason.FULFILLMENT_ISSUE),
  Schema.Literal(ConsumptionRequestReason.UNSATISFIED_WITH_PURCHASE),
  Schema.Literal(ConsumptionRequestReason.LEGAL),
  Schema.Literal(ConsumptionRequestReason.OTHER),
]);

// ===== GetTransactionHistoryVersion =====
export const GetTransactionHistoryVersion = {
  /** @deprecated */
  V1: "v1",
  V2: "v2",
} as const;

export type GetTransactionHistoryVersion =
  (typeof GetTransactionHistoryVersion)[keyof typeof GetTransactionHistoryVersion];

export const GetTransactionHistoryVersionSchema = Schema.Union([
  Schema.Literal(GetTransactionHistoryVersion.V1),
  Schema.Literal(GetTransactionHistoryVersion.V2),
]);

// ===== ImageSize =====
export const ImageSize = {
  FULL_SIZE: "FULL_SIZE",
} as const;

export type ImageSize = (typeof ImageSize)[keyof typeof ImageSize];

export const ImageSizeSchema = Schema.Union([Schema.Literal(ImageSize.FULL_SIZE)]);

// ===== HeaderPosition =====
export const HeaderPosition = {
  ABOVE_IMAGE: "ABOVE_IMAGE",
  BELOW_IMAGE: "BELOW_IMAGE",
} as const;

export type HeaderPosition = (typeof HeaderPosition)[keyof typeof HeaderPosition];

export const HeaderPositionSchema = Schema.Union([
  Schema.Literal(HeaderPosition.ABOVE_IMAGE),
  Schema.Literal(HeaderPosition.BELOW_IMAGE),
]);

// ===== BillingPlanType =====
export const BillingPlanType = {
  BILLED_UPFRONT: "BILLED_UPFRONT",
  MONTHLY: "MONTHLY",
} as const;

export type BillingPlanType = (typeof BillingPlanType)[keyof typeof BillingPlanType];

export const BillingPlanTypeSchema = Schema.Union([
  Schema.Literal(BillingPlanType.BILLED_UPFRONT),
  Schema.Literal(BillingPlanType.MONTHLY),
]);

// ===== RenewalBillingPlanType =====
export const RenewalBillingPlanType = {
  BILLED_UPFRONT: "BILLED_UPFRONT",
  MONTHLY: "MONTHLY",
} as const;

export type RenewalBillingPlanType =
  (typeof RenewalBillingPlanType)[keyof typeof RenewalBillingPlanType];

export const RenewalBillingPlanTypeSchema = Schema.Union([
  Schema.Literal(RenewalBillingPlanType.BILLED_UPFRONT),
  Schema.Literal(RenewalBillingPlanType.MONTHLY),
]);

// ===== PerformanceTestStatus =====
export const PerformanceTestStatus = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
} as const;

export type PerformanceTestStatus =
  (typeof PerformanceTestStatus)[keyof typeof PerformanceTestStatus];

export const PerformanceTestStatusSchema = Schema.Union([
  Schema.Literal(PerformanceTestStatus.PENDING),
  Schema.Literal(PerformanceTestStatus.IN_PROGRESS),
  Schema.Literal(PerformanceTestStatus.COMPLETED),
]);

// ===== PerformanceTestResult =====
export const PerformanceTestResult = {
  PASS: "PASS",
  FAIL: "FAIL",
} as const;

export type PerformanceTestResult =
  (typeof PerformanceTestResult)[keyof typeof PerformanceTestResult];

export const PerformanceTestResultSchema = Schema.Union([
  Schema.Literal(PerformanceTestResult.PASS),
  Schema.Literal(PerformanceTestResult.FAIL),
]);

// ===== AdvancedCommercePeriod =====
export const AdvancedCommercePeriod = {
  P1W: "P1W",
  P1M: "P1M",
  P2M: "P2M",
  P3M: "P3M",
  P6M: "P6M",
  P1Y: "P1Y",
} as const;

export type AdvancedCommercePeriod =
  (typeof AdvancedCommercePeriod)[keyof typeof AdvancedCommercePeriod];

export const AdvancedCommercePeriodSchema = Schema.Union(
  Object.values(AdvancedCommercePeriod).map((v) => Schema.Literal(v)),
);

// ===== AdvancedCommerceOfferPeriod =====
export const AdvancedCommerceOfferPeriod = {
  P3D: "P3D",
  P1W: "P1W",
  P2W: "P2W",
  P1M: "P1M",
  P2M: "P2M",
  P3M: "P3M",
} as const;

export type AdvancedCommerceOfferPeriod =
  (typeof AdvancedCommerceOfferPeriod)[keyof typeof AdvancedCommerceOfferPeriod];

export const AdvancedCommerceOfferPeriodSchema = Schema.Union(
  Object.values(AdvancedCommerceOfferPeriod).map((v) => Schema.Literal(v)),
);

// ===== AdvancedCommerceOfferReason =====
export const AdvancedCommerceOfferReason = {
  ACQUISITION: "ACQUISITION",
  WIN_BACK: "WIN_BACK",
  RETENTION: "RETENTION",
} as const;

export type AdvancedCommerceOfferReason =
  (typeof AdvancedCommerceOfferReason)[keyof typeof AdvancedCommerceOfferReason];

export const AdvancedCommerceOfferReasonSchema = Schema.Union(
  Object.values(AdvancedCommerceOfferReason).map((v) => Schema.Literal(v)),
);

// ===== AdvancedCommerceReason =====
export const AdvancedCommerceReason = {
  UPGRADE: "UPGRADE",
  DOWNGRADE: "DOWNGRADE",
  APPLY_OFFER: "APPLY_OFFER",
} as const;

export type AdvancedCommerceReason =
  (typeof AdvancedCommerceReason)[keyof typeof AdvancedCommerceReason];

export const AdvancedCommerceReasonSchema = Schema.Union(
  Object.values(AdvancedCommerceReason).map((v) => Schema.Literal(v)),
);

// ===== AdvancedCommerceRefundReason =====
export const AdvancedCommerceRefundReason = {
  UNINTENDED_PURCHASE: "UNINTENDED_PURCHASE",
  FULFILLMENT_ISSUE: "FULFILLMENT_ISSUE",
  UNSATISFIED_WITH_PURCHASE: "UNSATISFIED_WITH_PURCHASE",
  LEGAL: "LEGAL",
  OTHER: "OTHER",
  MODIFY_ITEMS_REFUND: "MODIFY_ITEMS_REFUND",
  SIMULATE_REFUND_DECLINE: "SIMULATE_REFUND_DECLINE",
} as const;

export type AdvancedCommerceRefundReason =
  (typeof AdvancedCommerceRefundReason)[keyof typeof AdvancedCommerceRefundReason];

export const AdvancedCommerceRefundReasonSchema = Schema.Union(
  Object.values(AdvancedCommerceRefundReason).map((v) => Schema.Literal(v)),
);

// ===== AdvancedCommerceRefundType =====
export const AdvancedCommerceRefundType = {
  FULL: "FULL",
  PRORATED: "PRORATED",
  CUSTOM: "CUSTOM",
} as const;

export type AdvancedCommerceRefundType =
  (typeof AdvancedCommerceRefundType)[keyof typeof AdvancedCommerceRefundType];

export const AdvancedCommerceRefundTypeSchema = Schema.Union(
  Object.values(AdvancedCommerceRefundType).map((v) => Schema.Literal(v)),
);

// ===== AdvancedCommerceEffective =====
export const AdvancedCommerceEffective = {
  IMMEDIATELY: "IMMEDIATELY",
  NEXT_BILL_CYCLE: "NEXT_BILL_CYCLE",
} as const;

export type AdvancedCommerceEffective =
  (typeof AdvancedCommerceEffective)[keyof typeof AdvancedCommerceEffective];

export const AdvancedCommerceEffectiveSchema = Schema.Union(
  Object.values(AdvancedCommerceEffective).map((v) => Schema.Literal(v)),
);

// ===== AdvancedCommercePriceIncreaseInfoStatus =====
export const AdvancedCommercePriceIncreaseInfoStatus = {
  SCHEDULED: "SCHEDULED",
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
} as const;

export type AdvancedCommercePriceIncreaseInfoStatus =
  (typeof AdvancedCommercePriceIncreaseInfoStatus)[keyof typeof AdvancedCommercePriceIncreaseInfoStatus];

export const AdvancedCommercePriceIncreaseInfoStatusSchema = Schema.Union(
  Object.values(AdvancedCommercePriceIncreaseInfoStatus).map((v) => Schema.Literal(v)),
);
