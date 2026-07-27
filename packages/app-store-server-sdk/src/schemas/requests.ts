import { Schema } from "effect";
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
export const TransactionHistoryRequestSchema = Schema.Struct({
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

export type TransactionHistoryRequest = Schema.Schema.Type<typeof TransactionHistoryRequestSchema>;

/**
 * Request body for extending a subscription renewal date.
 * @see https://developer.apple.com/documentation/appstoreserverapi/extendrenewaldaterequest
 */
export const ExtendRenewalDateRequestSchema = Schema.Struct({
  /** The number of days to extend (maximum: 90). */
  extendByDays: Schema.OptionFromOptionalKey(Schema.Number),

  /** The reason code for the extension. */
  extendReasonCode: Schema.OptionFromOptionalKey(ExtendReasonCodeSchema),

  /** A unique identifier to track the extension request. */
  requestIdentifier: Schema.OptionFromOptionalKey(Schema.String),
});

export type ExtendRenewalDateRequest = Schema.Schema.Type<typeof ExtendRenewalDateRequestSchema>;

/**
 * Request body for mass extending subscription renewal dates.
 * @see https://developer.apple.com/documentation/appstoreserverapi/massextendrenewaldaterequest
 */
export const MassExtendRenewalDateRequestSchema = Schema.Struct({
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

export type MassExtendRenewalDateRequest = Schema.Schema.Type<
  typeof MassExtendRenewalDateRequestSchema
>;

/**
 * Request body for consumption information (V2).
 * @see https://developer.apple.com/documentation/appstoreserverapi/consumptionrequest
 */
export const ConsumptionRequestSchema = Schema.Struct({
  /** Whether the customer consented to provide consumption data. */
  customerConsented: Schema.Boolean,

  /** The percentage, in milliunits, of the purchase the customer consumed. */
  consumptionPercentage: Schema.OptionFromOptionalKey(Schema.Number),

  /** Whether the app successfully delivered the purchase. */
  deliveryStatus: Schema.Union([DeliveryStatusSchema, Schema.String]),

  /** Your preferred outcome for the refund request. */
  refundPreference: Schema.OptionFromOptionalKey(
    Schema.Union([RefundPreferenceSchema, Schema.String]),
  ),

  /** Whether you provided a free sample or trial prior to purchase. */
  sampleContentProvided: Schema.Boolean,
});

export type ConsumptionRequest = Schema.Schema.Type<typeof ConsumptionRequestSchema>;

/**
 * Request body for notification history.
 * @see https://developer.apple.com/documentation/appstoreserverapi/notificationhistoryrequest
 */
export const NotificationHistoryRequestSchema = Schema.Struct({
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

export type NotificationHistoryRequest = Schema.Schema.Type<
  typeof NotificationHistoryRequestSchema
>;

/**
 * Request body for updating an app account token.
 * @see https://developer.apple.com/documentation/appstoreserverapi/updateappaccounttokenrequest
 */
export const UpdateAppAccountTokenRequestSchema = Schema.Struct({
  /** The app account token UUID value. */
  appAccountToken: Schema.String,
});

export type UpdateAppAccountTokenRequest = Schema.Schema.Type<
  typeof UpdateAppAccountTokenRequestSchema
>;

/**
 * Request body for configuring a default retention message.
 * @see https://developer.apple.com/documentation/retentionmessaging/defaultconfigurationrequest
 */
export const DefaultConfigurationRequestSchema = Schema.Struct({
  /** The message identifier to configure as the default. */
  messageIdentifier: Schema.String,
});

export type DefaultConfigurationRequest = Schema.Schema.Type<
  typeof DefaultConfigurationRequestSchema
>;

/**
 * Image attached to a retention message or bullet point.
 * @see https://developer.apple.com/documentation/retentionmessaging/uploadmessageimage
 */
export const UploadMessageImageSchema = Schema.Struct({
  /** The image identifier. */
  imageIdentifier: Schema.String,
  /** Alternative text for the image. */
  altText: Schema.OptionFromOptionalKey(Schema.String),
});

export type UploadMessageImage = Schema.Schema.Type<typeof UploadMessageImageSchema>;

/**
 * Bullet point displayed within a retention message.
 * @see https://developer.apple.com/documentation/retentionmessaging/bulletpoint
 */
export const BulletPointSchema = Schema.Struct({
  /** The bullet point text. */
  text: Schema.String,
  /** The image identifier shown next to the bullet point. */
  imageIdentifier: Schema.OptionFromOptionalKey(Schema.String),
  /** Alternative text for the bullet point image. */
  altText: Schema.OptionFromOptionalKey(Schema.String),
});

export type BulletPoint = Schema.Schema.Type<typeof BulletPointSchema>;

/**
 * Request body for uploading a retention message. Apple's payload mixes
 * single-locale fields and a multi-locale `messages` array; both are accepted.
 * @see https://developer.apple.com/documentation/retentionmessaging/uploadmessagerequestbody
 */
export const UploadMessageRequestBodySchema = Schema.Struct({
  /** The header text. */
  header: Schema.OptionFromOptionalKey(Schema.String),
  /** The body text. */
  body: Schema.OptionFromOptionalKey(Schema.String),
  /** The header position relative to the image. */
  headerPosition: Schema.OptionFromOptionalKey(Schema.Union([HeaderPositionSchema, Schema.String])),
  /** Image attached to the message. */
  image: Schema.OptionFromOptionalKey(UploadMessageImageSchema),
  /** Bullet points displayed in the message. */
  bulletPoints: Schema.OptionFromOptionalKey(Schema.Array(BulletPointSchema)),
  /** Optional multi-locale variants of the message. */
  messages: Schema.OptionFromOptionalKey(
    Schema.Array(
      Schema.Struct({
        locale: Schema.String,
        header: Schema.OptionFromOptionalKey(Schema.String),
        body: Schema.String,
        image: Schema.OptionFromOptionalKey(UploadMessageImageSchema),
      }),
    ),
  ),
});

export type UploadMessageRequestBody = Schema.Schema.Type<typeof UploadMessageRequestBodySchema>;

/**
 * Request body for the deprecated V1 consumption endpoint.
 * @see https://developer.apple.com/documentation/appstoreserverapi/consumptionrequestv1
 */
export const ConsumptionRequestV1Schema = Schema.Struct({
  customerConsented: Schema.Boolean,
  consumptionStatus: Schema.Union([ConsumptionStatusSchema, Schema.Number]),
  platform: Schema.Union([PlatformSchema, Schema.Number]),
  sampleContentProvided: Schema.Boolean,
  deliveryStatus: Schema.Union([DeliveryStatusV1Schema, Schema.Number]),
  appAccountToken: Schema.String,
  accountTenure: Schema.Union([AccountTenureSchema, Schema.Number]),
  playTime: Schema.Union([PlayTimeSchema, Schema.Number]),
  lifetimeDollarsRefunded: Schema.Union([LifetimeDollarsRefundedSchema, Schema.Number]),
  lifetimeDollarsPurchased: Schema.Union([LifetimeDollarsPurchasedSchema, Schema.Number]),
  userStatus: Schema.Union([UserStatusSchema, Schema.Number]),
  refundPreference: Schema.Union([RefundPreferenceV1Schema, Schema.Number]),
});

export type ConsumptionRequestV1 = Schema.Schema.Type<typeof ConsumptionRequestV1Schema>;

/**
 * Request body for initiating a performance test.
 * @see https://developer.apple.com/documentation/retentionmessaging/performancetestrequest
 */
export const PerformanceTestRequestSchema = Schema.Struct({
  originalTransactionId: Schema.String,
});

export type PerformanceTestRequest = Schema.Schema.Type<typeof PerformanceTestRequestSchema>;
