import { Schema } from "effect";
import {
  ConsumptionRequestReasonSchema,
  EnvironmentSchema,
  NotificationTypeV2Schema,
  StatusSchema,
  SubtypeSchema,
} from "./enums.ts";

/**
 * The app metadata and the signed renewal and transaction information.
 * @see https://developer.apple.com/documentation/appstoreservernotifications/data
 */
export const DataSchema = Schema.Struct({
  /** The server environment that the notification applies to. */
  environment: Schema.OptionFromOptionalKey(Schema.Union([EnvironmentSchema, Schema.String])),

  /** The unique identifier of an app in the App Store. */
  appAppleId: Schema.OptionFromOptionalKey(Schema.Number),

  /** The bundle identifier of an app. */
  bundleId: Schema.OptionFromOptionalKey(Schema.String),

  /** The version of the build that identifies an iteration of the bundle. */
  bundleVersion: Schema.OptionFromOptionalKey(Schema.String),

  /** Transaction information signed by the App Store, in JWS format. */
  signedTransactionInfo: Schema.OptionFromOptionalKey(Schema.String),

  /** Subscription renewal information signed by the App Store, in JWS format. */
  signedRenewalInfo: Schema.OptionFromOptionalKey(Schema.String),

  /** The status of an auto-renewable subscription. */
  status: Schema.OptionFromOptionalKey(Schema.Union([StatusSchema, Schema.Number])),

  /** The reason the customer requested the refund. */
  consumptionRequestReason: Schema.OptionFromOptionalKey(
    Schema.Union([ConsumptionRequestReasonSchema, Schema.String]),
  ),
});

export type Data = Schema.Schema.Type<typeof DataSchema>;

/**
 * The payload data for a subscription-renewal-date extension notification.
 * @see https://developer.apple.com/documentation/appstoreservernotifications/summary
 */
export const SummarySchema = Schema.Struct({
  /** The server environment that the notification applies to. */
  environment: Schema.OptionFromOptionalKey(Schema.Union([EnvironmentSchema, Schema.String])),

  /** The unique identifier of an app in the App Store. */
  appAppleId: Schema.OptionFromOptionalKey(Schema.Number),

  /** The bundle identifier of an app. */
  bundleId: Schema.OptionFromOptionalKey(Schema.String),

  /** The unique identifier for the product. */
  productId: Schema.OptionFromOptionalKey(Schema.String),

  /** A unique identifier to track each subscription-renewal-date extension request. */
  requestIdentifier: Schema.OptionFromOptionalKey(Schema.String),

  /** A list of storefront country codes to limit the storefronts for the extension. */
  storefrontCountryCodes: Schema.OptionFromOptionalKey(Schema.Array(Schema.String)),

  /** The count of subscriptions that successfully receive a renewal-date extension. */
  succeededCount: Schema.OptionFromOptionalKey(Schema.Number),

  /** The count of subscriptions that fail to receive a renewal-date extension. */
  failedCount: Schema.OptionFromOptionalKey(Schema.Number),
});

export type Summary = Schema.Schema.Type<typeof SummarySchema>;

/**
 * The payload data that contains an external purchase token.
 * @see https://developer.apple.com/documentation/appstoreservernotifications/externalpurchasetoken
 */
export const ExternalPurchaseTokenSchema = Schema.Struct({
  /** The field that uniquely identifies the external purchase token. */
  externalPurchaseId: Schema.OptionFromOptionalKey(Schema.String),

  /** The Unix timestamp in milliseconds when the system created the token. */
  tokenCreationDate: Schema.OptionFromOptionalKey(Schema.Number),

  /** The unique identifier of an app in the App Store. */
  appAppleId: Schema.OptionFromOptionalKey(Schema.Number),

  /** The bundle identifier of an app. */
  bundleId: Schema.OptionFromOptionalKey(Schema.String),
});

export type ExternalPurchaseToken = Schema.Schema.Type<typeof ExternalPurchaseTokenSchema>;

/**
 * The object that contains the app metadata and signed app transaction information.
 * @see https://developer.apple.com/documentation/appstoreservernotifications/appdata
 */
export const AppDataSchema = Schema.Struct({
  /** The unique identifier of the app that the notification applies to. */
  appAppleId: Schema.OptionFromOptionalKey(Schema.Number),

  /** The bundle identifier of the app. */
  bundleId: Schema.OptionFromOptionalKey(Schema.String),

  /** The server environment that the notification applies to. */
  environment: Schema.OptionFromOptionalKey(Schema.Union([EnvironmentSchema, Schema.String])),

  /** App transaction information signed by the App Store, in JWS format. */
  signedAppTransactionInfo: Schema.OptionFromOptionalKey(Schema.String),
});

export type AppData = Schema.Schema.Type<typeof AppDataSchema>;

/**
 * A decoded payload containing the version 2 notification data.
 * @see https://developer.apple.com/documentation/appstoreservernotifications/responsebodyv2decodedpayload
 */
export const ResponseBodyV2DecodedPayloadSchema = Schema.Struct({
  /** The in-app purchase event for which the App Store sends this notification. */
  notificationType: Schema.OptionFromOptionalKey(
    Schema.Union([NotificationTypeV2Schema, Schema.String]),
  ),

  /** Additional information that identifies the notification event. */
  subtype: Schema.OptionFromOptionalKey(Schema.Union([SubtypeSchema, Schema.String])),

  /** A unique identifier for the notification. */
  notificationUUID: Schema.OptionFromOptionalKey(Schema.String),

  /** The object that contains the app metadata and signed renewal and transaction information. */
  data: Schema.OptionFromOptionalKey(DataSchema),

  /** A string that indicates the notification's version number. */
  version: Schema.OptionFromOptionalKey(Schema.String),

  /** The Unix timestamp in milliseconds that the App Store signed the JWS data. */
  signedDate: Schema.OptionFromOptionalKey(Schema.Number),

  /** The summary data for subscription-renewal-date extension notifications. */
  summary: Schema.OptionFromOptionalKey(SummarySchema),

  /** The external purchase token data. */
  externalPurchaseToken: Schema.OptionFromOptionalKey(ExternalPurchaseTokenSchema),

  /** The app metadata and signed app transaction information (for RESCIND_CONSENT). */
  appData: Schema.OptionFromOptionalKey(AppDataSchema),
});

export type ResponseBodyV2DecodedPayload = Schema.Schema.Type<
  typeof ResponseBodyV2DecodedPayloadSchema
>;

/**
 * Decode a ResponseBodyV2DecodedPayload from an unknown value.
 */
export const decodeResponseBodyV2DecodedPayload = Schema.decodeUnknownEffect(
  ResponseBodyV2DecodedPayloadSchema,
);

/**
 * The raw signed notification payload received from Apple.
 * @see https://developer.apple.com/documentation/appstoreservernotifications/responsebodyv2
 */
export const ResponseBodyV2Schema = Schema.Struct({
  /** A cryptographically signed payload, in JWS format. */
  signedPayload: Schema.String,
});

export type ResponseBodyV2 = Schema.Schema.Type<typeof ResponseBodyV2Schema>;
