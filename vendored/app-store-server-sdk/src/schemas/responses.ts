import * as Schema from "effect/Schema";
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
export const TransactionInfoResponseCodec = Schema.Struct({
  /** A signed transaction in JWS format. */
  signedTransactionInfo: Schema.OptionFromOptionalKey(Schema.String),
});
export type TransactionInfoResponseCodec = typeof TransactionInfoResponseCodec.Type;

export type TransactionInfoResponse = Schema.Schema.Type<typeof TransactionInfoResponseCodec>;

/**
 * The most recent transaction info for a subscription.
 * @see https://developer.apple.com/documentation/appstoreserverapi/lasttransactionsitem
 */
export const LastTransactionsItemCodec = Schema.Struct({
  /** The status of the auto-renewable subscription. */
  status: Schema.OptionFromOptionalKey(Schema.Union([StatusSchema, Schema.Number])),

  /** The original transaction identifier. */
  originalTransactionId: Schema.OptionFromOptionalKey(Schema.String),

  /** Transaction information signed by the App Store, in JWS format. */
  signedTransactionInfo: Schema.OptionFromOptionalKey(Schema.String),

  /** Subscription renewal information signed by the App Store, in JWS format. */
  signedRenewalInfo: Schema.OptionFromOptionalKey(Schema.String),
});
export type LastTransactionsItemCodec = typeof LastTransactionsItemCodec.Type;

export type LastTransactionsItem = Schema.Schema.Type<typeof LastTransactionsItemCodec>;

/**
 * Information for subscriptions in one subscription group.
 * @see https://developer.apple.com/documentation/appstoreserverapi/subscriptiongroupidentifieritem
 */
export const SubscriptionGroupIdentifierItemCodec = Schema.Struct({
  /** The identifier of the subscription group. */
  subscriptionGroupIdentifier: Schema.OptionFromOptionalKey(Schema.String),

  /** An array of the most recent transaction info for subscriptions in the group. */
  lastTransactions: Schema.OptionFromOptionalKey(Schema.Array(LastTransactionsItemCodec)),
});
export type SubscriptionGroupIdentifierItemCodec = typeof SubscriptionGroupIdentifierItemCodec.Type;

export type SubscriptionGroupIdentifierItem = Schema.Schema.Type<
  typeof SubscriptionGroupIdentifierItemCodec
>;

/**
 * Status information for all of a customer's auto-renewable subscriptions.
 * @see https://developer.apple.com/documentation/appstoreserverapi/statusresponse
 */
export const StatusResponseCodec = Schema.Struct({
  /** The server environment. */
  environment: Schema.OptionFromOptionalKey(Schema.Union([EnvironmentSchema, Schema.String])),

  /** The bundle identifier of the app. */
  bundleId: Schema.OptionFromOptionalKey(Schema.String),

  /** The unique identifier of the app in the App Store. */
  appAppleId: Schema.OptionFromOptionalKey(Schema.Number),

  /** An array of subscription group information. */
  data: Schema.OptionFromOptionalKey(Schema.Array(SubscriptionGroupIdentifierItemCodec)),
});
export type StatusResponseCodec = typeof StatusResponseCodec.Type;

export type StatusResponse = Schema.Schema.Type<typeof StatusResponseCodec>;

/**
 * The customer's transaction history for an app.
 * @see https://developer.apple.com/documentation/appstoreserverapi/historyresponse
 */
export const HistoryResponseCodec = Schema.Struct({
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
export type HistoryResponseCodec = typeof HistoryResponseCodec.Type;

export type HistoryResponse = Schema.Schema.Type<typeof HistoryResponseCodec>;

/**
 * Response for looking up an order.
 * @see https://developer.apple.com/documentation/appstoreserverapi/orderlookupresponse
 */
export const OrderLookupResponseCodec = Schema.Struct({
  /** The status indicating whether the order ID is valid. */
  status: Schema.OptionFromOptionalKey(Schema.Union([OrderLookupStatusSchema, Schema.Number])),

  /** An array of signed transactions in JWS format. */
  signedTransactions: Schema.OptionFromOptionalKey(Schema.Array(Schema.String)),
});
export type OrderLookupResponseCodec = typeof OrderLookupResponseCodec.Type;

export type OrderLookupResponse = Schema.Schema.Type<typeof OrderLookupResponseCodec>;

/**
 * Response for extending a subscription renewal date.
 * @see https://developer.apple.com/documentation/appstoreserverapi/extendrenewaldateresponse
 */
export const ExtendRenewalDateResponseCodec = Schema.Struct({
  /** The original transaction identifier. */
  originalTransactionId: Schema.OptionFromOptionalKey(Schema.String),

  /** The unique identifier of the subscription-renewal-date extension. */
  webOrderLineItemId: Schema.OptionFromOptionalKey(Schema.String),

  /** Whether the renewal date extension was successful. */
  success: Schema.OptionFromOptionalKey(Schema.Boolean),

  /** The new subscription expiration date (Unix timestamp in milliseconds). */
  effectiveDate: Schema.OptionFromOptionalKey(Schema.Number),
});
export type ExtendRenewalDateResponseCodec = typeof ExtendRenewalDateResponseCodec.Type;

export type ExtendRenewalDateResponse = Schema.Schema.Type<typeof ExtendRenewalDateResponseCodec>;

/**
 * Response for mass extending subscription renewal dates.
 * @see https://developer.apple.com/documentation/appstoreserverapi/massextendrenewaldateresponse
 */
export const MassExtendRenewalDateResponseCodec = Schema.Struct({
  /** A unique identifier for the request. */
  requestIdentifier: Schema.OptionFromOptionalKey(Schema.String),
});
export type MassExtendRenewalDateResponseCodec = typeof MassExtendRenewalDateResponseCodec.Type;

export type MassExtendRenewalDateResponse = Schema.Schema.Type<
  typeof MassExtendRenewalDateResponseCodec
>;

/**
 * Status of a mass extend renewal date request.
 * @see https://developer.apple.com/documentation/appstoreserverapi/massextendrenewaldatestatusresponse
 */
export const MassExtendRenewalDateStatusResponseCodec = Schema.Struct({
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
export type MassExtendRenewalDateStatusResponseCodec = typeof MassExtendRenewalDateStatusResponseCodec.Type;

export type MassExtendRenewalDateStatusResponse = Schema.Schema.Type<
  typeof MassExtendRenewalDateStatusResponseCodec
>;

/**
 * A notification history item.
 * @see https://developer.apple.com/documentation/appstoreserverapi/notificationhistoryresponseitem
 */
export const NotificationHistoryResponseItemCodec = Schema.Struct({
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
export type NotificationHistoryResponseItemCodec = typeof NotificationHistoryResponseItemCodec.Type;

export type NotificationHistoryResponseItem = Schema.Schema.Type<
  typeof NotificationHistoryResponseItemCodec
>;

/**
 * Notification history response.
 * @see https://developer.apple.com/documentation/appstoreserverapi/notificationhistoryresponse
 */
export const NotificationHistoryResponseCodec = Schema.Struct({
  /** A pagination token for the next set of results. */
  paginationToken: Schema.OptionFromOptionalKey(Schema.String),

  /** Whether the App Store has more notification history. */
  hasMore: Schema.OptionFromOptionalKey(Schema.Boolean),

  /** An array of notification history records. */
  notificationHistory: Schema.OptionFromOptionalKey(
    Schema.Array(NotificationHistoryResponseItemCodec),
  ),
});
export type NotificationHistoryResponseCodec = typeof NotificationHistoryResponseCodec.Type;

export type NotificationHistoryResponse = Schema.Schema.Type<
  typeof NotificationHistoryResponseCodec
>;

/**
 * Response for requesting a test notification.
 * @see https://developer.apple.com/documentation/appstoreserverapi/sendtestnotificationresponse
 */
export const SendTestNotificationResponseCodec = Schema.Struct({
  /** The test notification token. */
  testNotificationToken: Schema.OptionFromOptionalKey(Schema.String),
});
export type SendTestNotificationResponseCodec = typeof SendTestNotificationResponseCodec.Type;

export type SendTestNotificationResponse = Schema.Schema.Type<
  typeof SendTestNotificationResponseCodec
>;

/**
 * Response for checking test notification status.
 * @see https://developer.apple.com/documentation/appstoreserverapi/checktestnotificationresponse
 */
export const CheckTestNotificationResponseCodec = Schema.Struct({
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
export type CheckTestNotificationResponseCodec = typeof CheckTestNotificationResponseCodec.Type;

export type CheckTestNotificationResponse = Schema.Schema.Type<
  typeof CheckTestNotificationResponseCodec
>;

/**
 * Response for getting a refund history.
 * @see https://developer.apple.com/documentation/appstoreserverapi/refundhistoryresponse
 */
export const RefundHistoryResponseCodec = Schema.Struct({
  /** A token to request the next set of transactions. */
  revision: Schema.OptionFromOptionalKey(Schema.String),

  /** Whether the App Store has more refund data. */
  hasMore: Schema.OptionFromOptionalKey(Schema.Boolean),

  /** An array of signed transactions in JWS format. */
  signedTransactions: Schema.OptionFromOptionalKey(Schema.Array(Schema.String)),
});
export type RefundHistoryResponseCodec = typeof RefundHistoryResponseCodec.Type;

export type RefundHistoryResponse = Schema.Schema.Type<typeof RefundHistoryResponseCodec>;

/**
 * Response for getting app transaction info.
 * @see https://developer.apple.com/documentation/appstoreserverapi/apptransactioninforesponse
 */
export const AppTransactionInfoResponseCodec = Schema.Struct({
  /** A signed app transaction in JWS format. */
  signedAppTransactionInfo: Schema.OptionFromOptionalKey(Schema.String),
});
export type AppTransactionInfoResponseCodec = typeof AppTransactionInfoResponseCodec.Type;

export type AppTransactionInfoResponse = Schema.Schema.Type<
  typeof AppTransactionInfoResponseCodec
>;

/**
 * An image list response item.
 * @see https://developer.apple.com/documentation/retentionmessaging/getimagelistresponseitem
 */
export const GetImageListResponseItemCodec = Schema.Struct({
  /** The image identifier. */
  imageIdentifier: Schema.OptionFromOptionalKey(Schema.String),

  /** The state of the image. */
  imageState: Schema.OptionFromOptionalKey(Schema.Union([ImageStateSchema, Schema.String])),

  /** The size of the image. */
  imageSize: Schema.OptionFromOptionalKey(Schema.Union([ImageSizeSchema, Schema.String])),
});
export type GetImageListResponseItemCodec = typeof GetImageListResponseItemCodec.Type;

export type GetImageListResponseItem = Schema.Schema.Type<typeof GetImageListResponseItemCodec>;

/**
 * Response for getting the image list.
 * @see https://developer.apple.com/documentation/retentionmessaging/getimagelistresponse
 */
export const GetImageListResponseCodec = Schema.Struct({
  /** An array of image identifiers and their state. */
  imageIdentifiers: Schema.OptionFromOptionalKey(Schema.Array(GetImageListResponseItemCodec)),
});
export type GetImageListResponseCodec = typeof GetImageListResponseCodec.Type;

export type GetImageListResponse = Schema.Schema.Type<typeof GetImageListResponseCodec>;

/**
 * A message list response item.
 * @see https://developer.apple.com/documentation/retentionmessaging/getmessagelistresponseitem
 */
export const GetMessageListResponseItemCodec = Schema.Struct({
  /** The message identifier. */
  messageIdentifier: Schema.OptionFromOptionalKey(Schema.String),

  /** The state of the message. */
  messageState: Schema.OptionFromOptionalKey(Schema.Union([MessageStateSchema, Schema.String])),
});
export type GetMessageListResponseItemCodec = typeof GetMessageListResponseItemCodec.Type;

export type GetMessageListResponseItem = Schema.Schema.Type<
  typeof GetMessageListResponseItemCodec
>;

/**
 * Response for getting the message list.
 * @see https://developer.apple.com/documentation/retentionmessaging/getmessagelistresponse
 */
export const GetMessageListResponseCodec = Schema.Struct({
  /** An array of message identifiers and their state. */
  messageIdentifiers: Schema.OptionFromOptionalKey(Schema.Array(GetMessageListResponseItemCodec)),
});
export type GetMessageListResponseCodec = typeof GetMessageListResponseCodec.Type;

export type GetMessageListResponse = Schema.Schema.Type<typeof GetMessageListResponseCodec>;

/**
 * Response for getting the default retention message for a product+locale.
 * @see https://developer.apple.com/documentation/retentionmessaging/defaultconfigurationresponse
 */
export const DefaultConfigurationResponseCodec = Schema.Struct({
  /** The configured default message identifier. */
  messageIdentifier: Schema.OptionFromOptionalKey(Schema.String),
});
export type DefaultConfigurationResponseCodec = typeof DefaultConfigurationResponseCodec.Type;

export type DefaultConfigurationResponse = Schema.Schema.Type<
  typeof DefaultConfigurationResponseCodec
>;

/**
 * Response for getting the configured realtime URL.
 * @see https://developer.apple.com/documentation/retentionmessaging/realtimeurlresponse
 */
export const RealtimeUrlResponseCodec = Schema.Struct({
  /** The currently configured realtime URL. */
  realtimeURL: Schema.OptionFromOptionalKey(Schema.String),
});
export type RealtimeUrlResponseCodec = typeof RealtimeUrlResponseCodec.Type;

export type RealtimeUrlResponse = Schema.Schema.Type<typeof RealtimeUrlResponseCodec>;

/**
 * Response time statistics returned by performance test endpoints.
 * @see https://developer.apple.com/documentation/retentionmessaging/performancetestresponsetimes
 */
export const PerformanceTestResponseTimesCodec = Schema.Struct({
  average: Schema.OptionFromOptionalKey(Schema.Number),
  p50: Schema.OptionFromOptionalKey(Schema.Number),
  p90: Schema.OptionFromOptionalKey(Schema.Number),
  p95: Schema.OptionFromOptionalKey(Schema.Number),
  p99: Schema.OptionFromOptionalKey(Schema.Number),
});
export type PerformanceTestResponseTimesCodec = typeof PerformanceTestResponseTimesCodec.Type;

export type PerformanceTestResponseTimes = Schema.Schema.Type<
  typeof PerformanceTestResponseTimesCodec
>;

/**
 * Configuration parameters returned by the performance test endpoints.
 * @see https://developer.apple.com/documentation/retentionmessaging/performancetestconfig
 */
export const PerformanceTestConfigCodec = Schema.Struct({
  maxConcurrentRequests: Schema.OptionFromOptionalKey(Schema.Number),
  totalRequests: Schema.OptionFromOptionalKey(Schema.Number),
  totalDuration: Schema.OptionFromOptionalKey(Schema.Number),
  responseTimeThreshold: Schema.OptionFromOptionalKey(Schema.Number),
  successRateThreshold: Schema.OptionFromOptionalKey(Schema.Number),
});
export type PerformanceTestConfigCodec = typeof PerformanceTestConfigCodec.Type;

export type PerformanceTestConfig = Schema.Schema.Type<typeof PerformanceTestConfigCodec>;

/**
 * Response for initiating a performance test.
 * @see https://developer.apple.com/documentation/retentionmessaging/performancetestresponse
 */
export const PerformanceTestResponseCodec = Schema.Struct({
  requestId: Schema.OptionFromOptionalKey(Schema.String),
  config: PerformanceTestConfigCodec,
  status: Schema.OptionFromOptionalKey(Schema.Union([PerformanceTestStatusSchema, Schema.String])),
});
export type PerformanceTestResponseCodec = typeof PerformanceTestResponseCodec.Type;

export type PerformanceTestResponse = Schema.Schema.Type<typeof PerformanceTestResponseCodec>;

/**
 * Response for getting the results of a performance test.
 * @see https://developer.apple.com/documentation/retentionmessaging/performancetestresultresponse
 */
export const PerformanceTestResultResponseCodec = Schema.Struct({
  config: PerformanceTestConfigCodec,
  target: Schema.OptionFromOptionalKey(Schema.String),
  result: Schema.OptionFromOptionalKey(Schema.Union([PerformanceTestResultSchema, Schema.String])),
  successRate: Schema.OptionFromOptionalKey(Schema.Number),
  numPending: Schema.OptionFromOptionalKey(Schema.Number),
  responseTimes: PerformanceTestResponseTimesCodec,
  failures: Schema.OptionFromOptionalKey(Schema.Record(Schema.String, Schema.Number)),
});
export type PerformanceTestResultResponseCodec = typeof PerformanceTestResultResponseCodec.Type;

export type PerformanceTestResultResponse = Schema.Schema.Type<
  typeof PerformanceTestResultResponseCodec
>;

export { TransactionInfoResponseCodec as TransactionInfoResponseSchema };
export { LastTransactionsItemCodec as LastTransactionsItemSchema };
export { SubscriptionGroupIdentifierItemCodec as SubscriptionGroupIdentifierItemSchema };
export { StatusResponseCodec as StatusResponseSchema };
export { HistoryResponseCodec as HistoryResponseSchema };
export { OrderLookupResponseCodec as OrderLookupResponseSchema };
export { ExtendRenewalDateResponseCodec as ExtendRenewalDateResponseSchema };
export { MassExtendRenewalDateResponseCodec as MassExtendRenewalDateResponseSchema };
export { MassExtendRenewalDateStatusResponseCodec as MassExtendRenewalDateStatusResponseSchema };
export { NotificationHistoryResponseItemCodec as NotificationHistoryResponseItemSchema };
export { NotificationHistoryResponseCodec as NotificationHistoryResponseSchema };
export { SendTestNotificationResponseCodec as SendTestNotificationResponseSchema };
export { CheckTestNotificationResponseCodec as CheckTestNotificationResponseSchema };
export { RefundHistoryResponseCodec as RefundHistoryResponseSchema };
export { AppTransactionInfoResponseCodec as AppTransactionInfoResponseSchema };
export { GetImageListResponseItemCodec as GetImageListResponseItemSchema };
export { GetImageListResponseCodec as GetImageListResponseSchema };
export { GetMessageListResponseItemCodec as GetMessageListResponseItemSchema };
export { GetMessageListResponseCodec as GetMessageListResponseSchema };
export { DefaultConfigurationResponseCodec as DefaultConfigurationResponseSchema };
export { RealtimeUrlResponseCodec as RealtimeUrlResponseSchema };
export { PerformanceTestResponseTimesCodec as PerformanceTestResponseTimesSchema };
export { PerformanceTestConfigCodec as PerformanceTestConfigSchema };
export { PerformanceTestResponseCodec as PerformanceTestResponseSchema };
export { PerformanceTestResultResponseCodec as PerformanceTestResultResponseSchema };
