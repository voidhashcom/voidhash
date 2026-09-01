import * as Schema from "effect/Schema";
import {
  AccountTenureSchema,
  ConsumptionStatusSchema,
  DeliveryStatusSchema,
  DeliveryStatusV1Schema,
  ExtendReasonCodeSchema,
  HeaderPositionSchema,
  InAppOwnershipTypeSchema,
  LifetimeDollarsPurchasedSchema,
  LifetimeDollarsRefundedSchema,
  NotificationTypeV2Schema,
  OrderSchema,
  PlatformSchema,
  PlayTimeSchema,
  ProductTypeSchema,
  RefundPreferenceSchema,
  RefundPreferenceV1Schema,
  SubtypeSchema,
  UserStatusSchema,
} from "./enums.ts";

/**
 * Request body for transaction history.
 * @see https://developer.apple.com/documentation/appstoreserverapi/transactionhistoryrequest
 */
export const TransactionHistoryRequestCodec = Schema.Struct({
  /** The start date of the timespan (Unix timestamp in milliseconds). */
  startDate: Schema.OptionFromOptionalKey(Schema.Number),

  /** The end date of the timespan (Unix timestamp in milliseconds). */
  endDate: Schema.OptionFromOptionalKey(Schema.Number),

  /** An array of product identifiers to include. */
  productIds: Schema.OptionFromOptionalKey(Schema.Array(Schema.String)),

  /** An array of product types to include. */
  productTypes: Schema.OptionFromOptionalKey(Schema.Array(ProductTypeSchema)),

  /** Sort order for the transaction history records. */
  sort: Schema.OptionFromOptionalKey(OrderSchema),

  /** An array of subscription group identifiers to include. */
  subscriptionGroupIdentifiers: Schema.OptionFromOptionalKey(Schema.Array(Schema.String)),

  /** Filter by the in-app ownership type. */
  inAppOwnershipType: Schema.OptionFromOptionalKey(InAppOwnershipTypeSchema),

  /** Whether to include only revoked transactions. */
  revoked: Schema.OptionFromOptionalKey(Schema.Boolean),
});
export type TransactionHistoryRequestCodec = typeof TransactionHistoryRequestCodec.Type;

export type TransactionHistoryRequest = Schema.Schema.Type<typeof TransactionHistoryRequestCodec>;

/**
 * Request body for extending a subscription renewal date.
 * @see https://developer.apple.com/documentation/appstoreserverapi/extendrenewaldaterequest
 */
export const ExtendRenewalDateRequestCodec = Schema.Struct({
  /** The number of days to extend (maximum: 90). */
  extendByDays: Schema.OptionFromOptionalKey(Schema.Number),

  /** The reason code for the extension. */
  extendReasonCode: Schema.OptionFromOptionalKey(ExtendReasonCodeSchema),

  /** A unique identifier to track the extension request. */
  requestIdentifier: Schema.OptionFromOptionalKey(Schema.String),
});
export type ExtendRenewalDateRequestCodec = typeof ExtendRenewalDateRequestCodec.Type;

export type ExtendRenewalDateRequest = Schema.Schema.Type<typeof ExtendRenewalDateRequestCodec>;

/**
 * Request body for mass extending subscription renewal dates.
 * @see https://developer.apple.com/documentation/appstoreserverapi/massextendrenewaldaterequest
 */
export const MassExtendRenewalDateRequestCodec = Schema.Struct({
  /** The number of days to extend (maximum: 90). */
  extendByDays: Schema.OptionFromOptionalKey(Schema.Number),

  /** The reason code for the extension. */
  extendReasonCode: Schema.OptionFromOptionalKey(ExtendReasonCodeSchema),

  /** A unique identifier to track the extension request. */
  requestIdentifier: Schema.OptionFromOptionalKey(Schema.String),

  /** A list of storefront country codes to limit the extension. */
  storefrontCountryCodes: Schema.OptionFromOptionalKey(Schema.Array(Schema.String)),

  /** The product identifier for the subscription. */
  productId: Schema.OptionFromOptionalKey(Schema.String),
});
export type MassExtendRenewalDateRequestCodec = typeof MassExtendRenewalDateRequestCodec.Type;

export type MassExtendRenewalDateRequest = Schema.Schema.Type<
  typeof MassExtendRenewalDateRequestCodec
>;

/**
 * Request body for consumption information (V2).
 * @see https://developer.apple.com/documentation/appstoreserverapi/consumptionrequest
 */
export const ConsumptionRequestCodec = Schema.Struct({
  /** Whether the customer consented to provide consumption data. */
  isCustomerConsented: Schema.Boolean,

  /** The percentage, in milliunits, of the purchase the customer consumed. */
  consumptionPercentage: Schema.OptionFromOptionalKey(Schema.Number),

  /** Whether the app successfully delivered the purchase. */
  deliveryStatus: Schema.Union([DeliveryStatusSchema, Schema.String]),

  /** Your preferred outcome for the refund request. */
  refundPreference: Schema.OptionFromOptionalKey(
    Schema.Union([RefundPreferenceSchema, Schema.String]),
  ),

  /** Whether you provided a free sample or trial prior to purchase. */
  isSampleContentProvided: Schema.Boolean,
}).pipe(
  Schema.encodeKeys({
    isCustomerConsented: "customerConsented",
    isSampleContentProvided: "sampleContentProvided",
  }),
);
export type ConsumptionRequestCodec = typeof ConsumptionRequestCodec.Type;

export type ConsumptionRequest = Schema.Schema.Type<typeof ConsumptionRequestCodec>;

/**
 * Request body for notification history.
 * @see https://developer.apple.com/documentation/appstoreserverapi/notificationhistoryrequest
 */
export const NotificationHistoryRequestCodec = Schema.Struct({
  /** The start date of the timespan (Unix timestamp in milliseconds). */
  startDate: Schema.OptionFromOptionalKey(Schema.Number),

  /** The end date of the timespan (Unix timestamp in milliseconds). */
  endDate: Schema.OptionFromOptionalKey(Schema.Number),

  /** Filter by notification type. */
  notificationType: Schema.OptionFromOptionalKey(NotificationTypeV2Schema),

  /** Filter by notification subtype. */
  notificationSubtype: Schema.OptionFromOptionalKey(SubtypeSchema),

  /** Filter by a specific transaction. */
  transactionId: Schema.OptionFromOptionalKey(Schema.String),

  /** Request only notifications that haven't reached your server. */
  onlyFailures: Schema.OptionFromOptionalKey(Schema.Boolean),
});
export type NotificationHistoryRequestCodec = typeof NotificationHistoryRequestCodec.Type;

export type NotificationHistoryRequest = Schema.Schema.Type<
  typeof NotificationHistoryRequestCodec
>;

/**
 * Request body for updating an app account token.
 * @see https://developer.apple.com/documentation/appstoreserverapi/updateappaccounttokenrequest
 */
export const UpdateAppAccountTokenRequestCodec = Schema.Struct({
  /** The app account token UUID value. */
  appAccountToken: Schema.String,
});
export type UpdateAppAccountTokenRequestCodec = typeof UpdateAppAccountTokenRequestCodec.Type;

export type UpdateAppAccountTokenRequest = Schema.Schema.Type<
  typeof UpdateAppAccountTokenRequestCodec
>;

/**
 * Request body for configuring a default retention message.
 * @see https://developer.apple.com/documentation/retentionmessaging/defaultconfigurationrequest
 */
export const DefaultConfigurationRequestCodec = Schema.Struct({
  /** The message identifier to configure as the default. */
  messageIdentifier: Schema.String,
});
export type DefaultConfigurationRequestCodec = typeof DefaultConfigurationRequestCodec.Type;

export type DefaultConfigurationRequest = Schema.Schema.Type<
  typeof DefaultConfigurationRequestCodec
>;

/**
 * Image attached to a retention message or bullet point.
 * @see https://developer.apple.com/documentation/retentionmessaging/uploadmessageimage
 */
export const UploadMessageImageCodec = Schema.Struct({
  /** The image identifier. */
  imageIdentifier: Schema.String,
  /** Alternative text for the image. */
  altText: Schema.OptionFromOptionalKey(Schema.String),
});
export type UploadMessageImageCodec = typeof UploadMessageImageCodec.Type;

export type UploadMessageImage = Schema.Schema.Type<typeof UploadMessageImageCodec>;

/**
 * Bullet point displayed within a retention message.
 * @see https://developer.apple.com/documentation/retentionmessaging/bulletpoint
 */
export const BulletPointCodec = Schema.Struct({
  /** The bullet point text. */
  text: Schema.String,
  /** The image identifier shown next to the bullet point. */
  imageIdentifier: Schema.OptionFromOptionalKey(Schema.String),
  /** Alternative text for the bullet point image. */
  altText: Schema.OptionFromOptionalKey(Schema.String),
});
export type BulletPointCodec = typeof BulletPointCodec.Type;

export type BulletPoint = Schema.Schema.Type<typeof BulletPointCodec>;

/**
 * Request body for uploading a retention message. Apple's payload mixes
 * single-locale fields and a multi-locale `messages` array; both are accepted.
 * @see https://developer.apple.com/documentation/retentionmessaging/uploadmessagerequestbody
 */
export const UploadMessageRequestBodyCodec = Schema.Struct({
  /** The header text. */
  header: Schema.OptionFromOptionalKey(Schema.String),
  /** The body text. */
  body: Schema.OptionFromOptionalKey(Schema.String),
  /** The header position relative to the image. */
  headerPosition: Schema.OptionFromOptionalKey(Schema.Union([HeaderPositionSchema, Schema.String])),
  /** Image attached to the message. */
  image: Schema.OptionFromOptionalKey(UploadMessageImageCodec),
  /** Bullet points displayed in the message. */
  bulletPoints: Schema.OptionFromOptionalKey(Schema.Array(BulletPointCodec)),
  /** Optional multi-locale variants of the message. */
  messages: Schema.OptionFromOptionalKey(
    Schema.Array(
      Schema.Struct({
        locale: Schema.String,
        header: Schema.OptionFromOptionalKey(Schema.String),
        body: Schema.String,
        image: Schema.OptionFromOptionalKey(UploadMessageImageCodec),
      }),
    ),
  ),
});
export type UploadMessageRequestBodyCodec = typeof UploadMessageRequestBodyCodec.Type;

export type UploadMessageRequestBody = Schema.Schema.Type<typeof UploadMessageRequestBodyCodec>;

/**
 * Request body for the deprecated V1 consumption endpoint.
 * @see https://developer.apple.com/documentation/appstoreserverapi/consumptionrequestv1
 */
export const ConsumptionRequestV1Codec = Schema.Struct({
  isCustomerConsented: Schema.Boolean,
  consumptionStatus: Schema.Union([ConsumptionStatusSchema, Schema.Number]),
  platform: Schema.Union([PlatformSchema, Schema.Number]),
  isSampleContentProvided: Schema.Boolean,
  deliveryStatus: Schema.Union([DeliveryStatusV1Schema, Schema.Number]),
  appAccountToken: Schema.String,
  accountTenure: Schema.Union([AccountTenureSchema, Schema.Number]),
  playTime: Schema.Union([PlayTimeSchema, Schema.Number]),
  lifetimeDollarsRefunded: Schema.Union([LifetimeDollarsRefundedSchema, Schema.Number]),
  lifetimeDollarsPurchased: Schema.Union([LifetimeDollarsPurchasedSchema, Schema.Number]),
  userStatus: Schema.Union([UserStatusSchema, Schema.Number]),
  refundPreference: Schema.Union([RefundPreferenceV1Schema, Schema.Number]),
}).pipe(
  Schema.encodeKeys({
    isCustomerConsented: "customerConsented",
    isSampleContentProvided: "sampleContentProvided",
  }),
);
export type ConsumptionRequestV1Codec = typeof ConsumptionRequestV1Codec.Type;

export type ConsumptionRequestV1 = Schema.Schema.Type<typeof ConsumptionRequestV1Codec>;

/**
 * Request body for initiating a performance test.
 * @see https://developer.apple.com/documentation/retentionmessaging/performancetestrequest
 */
export const PerformanceTestRequestCodec = Schema.Struct({
  originalTransactionId: Schema.String,
});
export type PerformanceTestRequestCodec = typeof PerformanceTestRequestCodec.Type;

export type PerformanceTestRequest = Schema.Schema.Type<typeof PerformanceTestRequestCodec>;

export { TransactionHistoryRequestCodec as TransactionHistoryRequestSchema };
export { ExtendRenewalDateRequestCodec as ExtendRenewalDateRequestSchema };
export { MassExtendRenewalDateRequestCodec as MassExtendRenewalDateRequestSchema };
export { ConsumptionRequestCodec as ConsumptionRequestSchema };
export { NotificationHistoryRequestCodec as NotificationHistoryRequestSchema };
export { UpdateAppAccountTokenRequestCodec as UpdateAppAccountTokenRequestSchema };
export { DefaultConfigurationRequestCodec as DefaultConfigurationRequestSchema };
export { UploadMessageImageCodec as UploadMessageImageSchema };
export { BulletPointCodec as BulletPointSchema };
export { UploadMessageRequestBodyCodec as UploadMessageRequestBodySchema };
export { ConsumptionRequestV1Codec as ConsumptionRequestV1Schema };
export { PerformanceTestRequestCodec as PerformanceTestRequestSchema };
