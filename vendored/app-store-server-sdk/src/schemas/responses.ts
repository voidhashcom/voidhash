import { Schema } from "effect";
import {
  EnvironmentSchema,
  ImageSizeSchema,
  ImageStateSchema,
  MessageStateSchema,
  OrderLookupStatusSchema,
  PerformanceTestResultSchema,
  PerformanceTestStatusSchema,
  SendAttemptResultSchema,
  StatusSchema,
} from "./enums.ts";

/**
 * Transaction info response containing signed transaction.
 * @see https://developer.apple.com/documentation/appstoreserverapi/transactioninforesponse
 */
export const TransactionInfoResponseSchema = Schema.Struct({
  /** A signed transaction in JWS format. */
  signedTransactionInfo: Schema.OptionFromOptionalKey(Schema.String),
});

export type TransactionInfoResponse = Schema.Schema.Type<typeof TransactionInfoResponseSchema>;

/**
 * The most recent transaction info for a subscription.
 * @see https://developer.apple.com/documentation/appstoreserverapi/lasttransactionsitem
 */
export const LastTransactionsItemSchema = Schema.Struct({
  /** The status of the auto-renewable subscription. */
  status: Schema.OptionFromOptionalKey(Schema.Union([StatusSchema, Schema.Number])),

  /** The original transaction identifier. */
  originalTransactionId: Schema.OptionFromOptionalKey(Schema.String),

  /** Transaction information signed by the App Store, in JWS format. */
  signedTransactionInfo: Schema.OptionFromOptionalKey(Schema.String),

  /** Subscription renewal information signed by the App Store, in JWS format. */
  signedRenewalInfo: Schema.OptionFromOptionalKey(Schema.String),
});

export type LastTransactionsItem = Schema.Schema.Type<typeof LastTransactionsItemSchema>;

/**
 * Information for subscriptions in one subscription group.
 * @see https://developer.apple.com/documentation/appstoreserverapi/subscriptiongroupidentifieritem
 */
export const SubscriptionGroupIdentifierItemSchema = Schema.Struct({
  /** The identifier of the subscription group. */
  subscriptionGroupIdentifier: Schema.OptionFromOptionalKey(Schema.String),

  /** An array of the most recent transaction info for subscriptions in the group. */
  lastTransactions: Schema.OptionFromOptionalKey(Schema.Array(LastTransactionsItemSchema)),
});

export type SubscriptionGroupIdentifierItem = Schema.Schema.Type<
  typeof SubscriptionGroupIdentifierItemSchema
>;

/**
 * Status information for all of a customer's auto-renewable subscriptions.
 * @see https://developer.apple.com/documentation/appstoreserverapi/statusresponse
 */
export const StatusResponseSchema = Schema.Struct({
  /** The server environment. */
  environment: Schema.OptionFromOptionalKey(Schema.Union([EnvironmentSchema, Schema.String])),

  /** The bundle identifier of the app. */
  bundleId: Schema.OptionFromOptionalKey(Schema.String),

  /** The unique identifier of the app in the App Store. */
  appAppleId: Schema.OptionFromOptionalKey(Schema.Number),

  /** An array of subscription group information. */
  data: Schema.OptionFromOptionalKey(Schema.Array(SubscriptionGroupIdentifierItemSchema)),
});

export type StatusResponse = Schema.Schema.Type<typeof StatusResponseSchema>;

/**
 * The customer's transaction history for an app.
 * @see https://developer.apple.com/documentation/appstoreserverapi/historyresponse
 */
export const HistoryResponseSchema = Schema.Struct({
  /** A token to request the next set of transactions. */
  revision: Schema.OptionFromOptionalKey(Schema.String),

  /** Whether the App Store has more transaction data. */
  hasMore: Schema.OptionFromOptionalKey(Schema.Boolean),

  /** The bundle identifier of the app. */
  bundleId: Schema.OptionFromOptionalKey(Schema.String),

  /** The unique identifier of the app in the App Store. */
  appAppleId: Schema.OptionFromOptionalKey(Schema.Number),

  /** The server environment. */
  environment: Schema.OptionFromOptionalKey(Schema.Union([EnvironmentSchema, Schema.String])),

  /** An array of signed transactions in JWS format. */
  signedTransactions: Schema.OptionFromOptionalKey(Schema.Array(Schema.String)),
});

export type HistoryResponse = Schema.Schema.Type<typeof HistoryResponseSchema>;

/**
 * Response for looking up an order.
 * @see https://developer.apple.com/documentation/appstoreserverapi/orderlookupresponse
 */
export const OrderLookupResponseSchema = Schema.Struct({
  /** The status indicating whether the order ID is valid. */
  status: Schema.OptionFromOptionalKey(Schema.Union([OrderLookupStatusSchema, Schema.Number])),

  /** An array of signed transactions in JWS format. */
  signedTransactions: Schema.OptionFromOptionalKey(Schema.Array(Schema.String)),
});

export type OrderLookupResponse = Schema.Schema.Type<typeof OrderLookupResponseSchema>;

/**
 * Response for extending a subscription renewal date.
 * @see https://developer.apple.com/documentation/appstoreserverapi/extendrenewaldateresponse
 */
export const ExtendRenewalDateResponseSchema = Schema.Struct({
  /** The original transaction identifier. */
  originalTransactionId: Schema.OptionFromOptionalKey(Schema.String),

  /** The unique identifier of the subscription-renewal-date extension. */
  webOrderLineItemId: Schema.OptionFromOptionalKey(Schema.String),

  /** Whether the renewal date extension was successful. */
  success: Schema.OptionFromOptionalKey(Schema.Boolean),

  /** The new subscription expiration date (Unix timestamp in milliseconds). */
  effectiveDate: Schema.OptionFromOptionalKey(Schema.Number),
});

export type ExtendRenewalDateResponse = Schema.Schema.Type<typeof ExtendRenewalDateResponseSchema>;

/**
 * Response for mass extending subscription renewal dates.
 * @see https://developer.apple.com/documentation/appstoreserverapi/massextendrenewaldateresponse
 */
export const MassExtendRenewalDateResponseSchema = Schema.Struct({
  /** A unique identifier for the request. */
  requestIdentifier: Schema.OptionFromOptionalKey(Schema.String),
});

export type MassExtendRenewalDateResponse = Schema.Schema.Type<
  typeof MassExtendRenewalDateResponseSchema
>;

/**
 * Status of a mass extend renewal date request.
 * @see https://developer.apple.com/documentation/appstoreserverapi/massextendrenewaldatestatusresponse
 */
export const MassExtendRenewalDateStatusResponseSchema = Schema.Struct({
  /** A unique identifier for the request. */
  requestIdentifier: Schema.OptionFromOptionalKey(Schema.String),

  /** Whether the request completed processing. */
  complete: Schema.OptionFromOptionalKey(Schema.Boolean),

  /** The date the request was created (Unix timestamp in milliseconds). */
  completeDate: Schema.OptionFromOptionalKey(Schema.Number),

  /** The number of subscriptions successfully extended. */
  succeededCount: Schema.OptionFromOptionalKey(Schema.Number),

  /** The number of subscriptions that failed to extend. */
  failedCount: Schema.OptionFromOptionalKey(Schema.Number),
});

export type MassExtendRenewalDateStatusResponse = Schema.Schema.Type<
  typeof MassExtendRenewalDateStatusResponseSchema
>;

/**
 * A notification history item.
 * @see https://developer.apple.com/documentation/appstoreserverapi/notificationhistoryresponseitem
 */
export const NotificationHistoryResponseItemSchema = Schema.Struct({
  /** A signed payload in JWS format. */
  signedPayload: Schema.OptionFromOptionalKey(Schema.String),

  /** An array of send attempt results. */
  sendAttempts: Schema.OptionFromOptionalKey(
    Schema.Array(
      Schema.Struct({
        /** The date of the send attempt (Unix timestamp in milliseconds). */
        attemptDate: Schema.OptionFromOptionalKey(Schema.Number),
        /** The result of the send attempt. */
        sendAttemptResult: Schema.OptionFromOptionalKey(
          Schema.Union([SendAttemptResultSchema, Schema.String]),
        ),
      }),
    ),
  ),
});

export type NotificationHistoryResponseItem = Schema.Schema.Type<
  typeof NotificationHistoryResponseItemSchema
>;

/**
 * Notification history response.
 * @see https://developer.apple.com/documentation/appstoreserverapi/notificationhistoryresponse
 */
export const NotificationHistoryResponseSchema = Schema.Struct({
  /** A pagination token for the next set of results. */
  paginationToken: Schema.OptionFromOptionalKey(Schema.String),

  /** Whether the App Store has more notification history. */
  hasMore: Schema.OptionFromOptionalKey(Schema.Boolean),

  /** An array of notification history records. */
  notificationHistory: Schema.OptionFromOptionalKey(
    Schema.Array(NotificationHistoryResponseItemSchema),
  ),
});

export type NotificationHistoryResponse = Schema.Schema.Type<
  typeof NotificationHistoryResponseSchema
>;

/**
 * Response for requesting a test notification.
 * @see https://developer.apple.com/documentation/appstoreserverapi/sendtestnotificationresponse
 */
export const SendTestNotificationResponseSchema = Schema.Struct({
  /** The test notification token. */
  testNotificationToken: Schema.OptionFromOptionalKey(Schema.String),
});

export type SendTestNotificationResponse = Schema.Schema.Type<
  typeof SendTestNotificationResponseSchema
>;

/**
 * Response for checking test notification status.
 * @see https://developer.apple.com/documentation/appstoreserverapi/checktestnotificationresponse
 */
export const CheckTestNotificationResponseSchema = Schema.Struct({
  /** The signed payload of the test notification in JWS format. */
  signedPayload: Schema.OptionFromOptionalKey(Schema.String),

  /** An array of send attempt results. */
  sendAttempts: Schema.OptionFromOptionalKey(
    Schema.Array(
      Schema.Struct({
        /** The date of the send attempt (Unix timestamp in milliseconds). */
        attemptDate: Schema.OptionFromOptionalKey(Schema.Number),
        /** The result of the send attempt. */
        sendAttemptResult: Schema.OptionFromOptionalKey(
          Schema.Union([SendAttemptResultSchema, Schema.String]),
        ),
      }),
    ),
  ),
});

export type CheckTestNotificationResponse = Schema.Schema.Type<
  typeof CheckTestNotificationResponseSchema
>;

/**
 * Response for getting a refund history.
 * @see https://developer.apple.com/documentation/appstoreserverapi/refundhistoryresponse
 */
export const RefundHistoryResponseSchema = Schema.Struct({
  /** A token to request the next set of transactions. */
  revision: Schema.OptionFromOptionalKey(Schema.String),

  /** Whether the App Store has more refund data. */
  hasMore: Schema.OptionFromOptionalKey(Schema.Boolean),

  /** An array of signed transactions in JWS format. */
  signedTransactions: Schema.OptionFromOptionalKey(Schema.Array(Schema.String)),
});

export type RefundHistoryResponse = Schema.Schema.Type<typeof RefundHistoryResponseSchema>;

/**
 * Response for getting app transaction info.
 * @see https://developer.apple.com/documentation/appstoreserverapi/apptransactioninforesponse
 */
export const AppTransactionInfoResponseSchema = Schema.Struct({
  /** A signed app transaction in JWS format. */
  signedAppTransactionInfo: Schema.OptionFromOptionalKey(Schema.String),
});

export type AppTransactionInfoResponse = Schema.Schema.Type<
  typeof AppTransactionInfoResponseSchema
>;

/**
 * An image list response item.
 * @see https://developer.apple.com/documentation/retentionmessaging/getimagelistresponseitem
 */
export const GetImageListResponseItemSchema = Schema.Struct({
  /** The image identifier. */
  imageIdentifier: Schema.OptionFromOptionalKey(Schema.String),

  /** The state of the image. */
  imageState: Schema.OptionFromOptionalKey(Schema.Union([ImageStateSchema, Schema.String])),

  /** The size of the image. */
  imageSize: Schema.OptionFromOptionalKey(Schema.Union([ImageSizeSchema, Schema.String])),
});

export type GetImageListResponseItem = Schema.Schema.Type<typeof GetImageListResponseItemSchema>;

/**
 * Response for getting the image list.
 * @see https://developer.apple.com/documentation/retentionmessaging/getimagelistresponse
 */
export const GetImageListResponseSchema = Schema.Struct({
  /** An array of image identifiers and their state. */
  imageIdentifiers: Schema.OptionFromOptionalKey(Schema.Array(GetImageListResponseItemSchema)),
});

export type GetImageListResponse = Schema.Schema.Type<typeof GetImageListResponseSchema>;

/**
 * A message list response item.
 * @see https://developer.apple.com/documentation/retentionmessaging/getmessagelistresponseitem
 */
export const GetMessageListResponseItemSchema = Schema.Struct({
  /** The message identifier. */
  messageIdentifier: Schema.OptionFromOptionalKey(Schema.String),

  /** The state of the message. */
  messageState: Schema.OptionFromOptionalKey(Schema.Union([MessageStateSchema, Schema.String])),
});

export type GetMessageListResponseItem = Schema.Schema.Type<
  typeof GetMessageListResponseItemSchema
>;

/**
 * Response for getting the message list.
 * @see https://developer.apple.com/documentation/retentionmessaging/getmessagelistresponse
 */
export const GetMessageListResponseSchema = Schema.Struct({
  /** An array of message identifiers and their state. */
  messageIdentifiers: Schema.OptionFromOptionalKey(Schema.Array(GetMessageListResponseItemSchema)),
});

export type GetMessageListResponse = Schema.Schema.Type<typeof GetMessageListResponseSchema>;

/**
 * Response for getting the default retention message for a product+locale.
 * @see https://developer.apple.com/documentation/retentionmessaging/defaultconfigurationresponse
 */
export const DefaultConfigurationResponseSchema = Schema.Struct({
  /** The configured default message identifier. */
  messageIdentifier: Schema.OptionFromOptionalKey(Schema.String),
});

export type DefaultConfigurationResponse = Schema.Schema.Type<
  typeof DefaultConfigurationResponseSchema
>;

/**
 * Response for getting the configured realtime URL.
 * @see https://developer.apple.com/documentation/retentionmessaging/realtimeurlresponse
 */
export const RealtimeUrlResponseSchema = Schema.Struct({
  /** The currently configured realtime URL. */
  realtimeURL: Schema.OptionFromOptionalKey(Schema.String),
});

export type RealtimeUrlResponse = Schema.Schema.Type<typeof RealtimeUrlResponseSchema>;

/**
 * Response time statistics returned by performance test endpoints.
 * @see https://developer.apple.com/documentation/retentionmessaging/performancetestresponsetimes
 */
export const PerformanceTestResponseTimesSchema = Schema.Struct({
  average: Schema.OptionFromOptionalKey(Schema.Number),
  p50: Schema.OptionFromOptionalKey(Schema.Number),
  p90: Schema.OptionFromOptionalKey(Schema.Number),
  p95: Schema.OptionFromOptionalKey(Schema.Number),
  p99: Schema.OptionFromOptionalKey(Schema.Number),
});

export type PerformanceTestResponseTimes = Schema.Schema.Type<
  typeof PerformanceTestResponseTimesSchema
>;

/**
 * Configuration parameters returned by the performance test endpoints.
 * @see https://developer.apple.com/documentation/retentionmessaging/performancetestconfig
 */
export const PerformanceTestConfigSchema = Schema.Struct({
  maxConcurrentRequests: Schema.OptionFromOptionalKey(Schema.Number),
  totalRequests: Schema.OptionFromOptionalKey(Schema.Number),
  totalDuration: Schema.OptionFromOptionalKey(Schema.Number),
  responseTimeThreshold: Schema.OptionFromOptionalKey(Schema.Number),
  successRateThreshold: Schema.OptionFromOptionalKey(Schema.Number),
});

export type PerformanceTestConfig = Schema.Schema.Type<typeof PerformanceTestConfigSchema>;

/**
 * Response for initiating a performance test.
 * @see https://developer.apple.com/documentation/retentionmessaging/performancetestresponse
 */
export const PerformanceTestResponseSchema = Schema.Struct({
  requestId: Schema.OptionFromOptionalKey(Schema.String),
  config: PerformanceTestConfigSchema,
  status: Schema.OptionFromOptionalKey(Schema.Union([PerformanceTestStatusSchema, Schema.String])),
});

export type PerformanceTestResponse = Schema.Schema.Type<typeof PerformanceTestResponseSchema>;

/**
 * Response for getting the results of a performance test.
 * @see https://developer.apple.com/documentation/retentionmessaging/performancetestresultresponse
 */
export const PerformanceTestResultResponseSchema = Schema.Struct({
  config: PerformanceTestConfigSchema,
  target: Schema.OptionFromOptionalKey(Schema.String),
  result: Schema.OptionFromOptionalKey(Schema.Union([PerformanceTestResultSchema, Schema.String])),
  successRate: Schema.OptionFromOptionalKey(Schema.Number),
  numPending: Schema.OptionFromOptionalKey(Schema.Number),
  responseTimes: PerformanceTestResponseTimesSchema,
  failures: Schema.OptionFromOptionalKey(Schema.Record(Schema.String, Schema.Number)),
});

export type PerformanceTestResultResponse = Schema.Schema.Type<
  typeof PerformanceTestResultResponseSchema
>;
