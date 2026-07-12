/**
 * Google Play Real-Time Developer Notification (RTDN) decoding.
 *
 * Google delivers RTDN via a Pub/Sub PUSH subscription: the HTTP body is a
 * `{ message: { data: base64(DeveloperNotification JSON), messageId, ... } }`
 * envelope. This module decodes that envelope into one of our typed
 * {@link DecodedNotification} shapes. It performs NO database work and NO
 * authoritative state fetch — the webhook handler re-fetches purchase state
 * from the Play Developer API because RTDN bodies are pointers, not state.
 *
 * Base64 decode uses `atob`/`TextDecoder` (Workers-safe — no `Buffer`).
 */
import {
  DeveloperNotification,
  GooglePlayInvalidNotificationError,
  GooglePlayNotificationVerificationError,
  type SubscriptionNotificationTypeValue,
} from "@voidhash/google-play-server-sdk";
import { Effect, Schema } from "effect";

/** Subscription notification type code → name (RTDN `subscriptionNotification.notificationType`). */
export const SUBSCRIPTION_NOTIFICATION_TYPES: Record<SubscriptionNotificationTypeValue, string> = {
  1: "SUBSCRIPTION_RECOVERED",
  2: "SUBSCRIPTION_RENEWED",
  3: "SUBSCRIPTION_CANCELED",
  4: "SUBSCRIPTION_PURCHASED",
  5: "SUBSCRIPTION_ON_HOLD",
  6: "SUBSCRIPTION_IN_GRACE_PERIOD",
  7: "SUBSCRIPTION_RESTARTED",
  8: "SUBSCRIPTION_PRICE_CHANGE_CONFIRMED",
  9: "SUBSCRIPTION_DEFERRED",
  10: "SUBSCRIPTION_PAUSED",
  11: "SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED",
  12: "SUBSCRIPTION_REVOKED",
  13: "SUBSCRIPTION_EXPIRED",
};

/** One-time product notification type code → name. */
export const ONE_TIME_PRODUCT_NOTIFICATION_TYPES: Record<number, string> = {
  1: "ONE_TIME_PRODUCT_PURCHASED",
  2: "ONE_TIME_PRODUCT_CANCELED",
};

export interface DecodedSubscriptionNotification {
  readonly type: "subscription";
  readonly packageName: string;
  readonly eventTimeMillis?: string;
  readonly notificationType: SubscriptionNotificationTypeValue;
  readonly notificationTypeName: string;
  readonly purchaseToken: string;
  readonly subscriptionId: string;
}

export interface DecodedOneTimeProductNotification {
  readonly type: "oneTimeProduct";
  readonly packageName: string;
  readonly eventTimeMillis?: string;
  readonly notificationType: number;
  readonly notificationTypeName: string;
  readonly purchaseToken: string;
  readonly sku: string;
}

export interface DecodedVoidedPurchaseNotification {
  readonly type: "voidedPurchase";
  readonly packageName: string;
  readonly eventTimeMillis?: string;
  readonly purchaseToken: string;
  readonly orderId?: string;
  /** 1 = subscription, 2 = one-time product (RTDN convention). */
  readonly productType?: number;
  /** 1 = full refund, 2 = revoke (RTDN convention). */
  readonly refundType?: number;
}

export interface DecodedTestNotification {
  readonly type: "test";
  readonly packageName: string;
  readonly eventTimeMillis?: string;
  readonly version?: string;
}

export type DecodedNotification =
  | DecodedSubscriptionNotification
  | DecodedOneTimeProductNotification
  | DecodedVoidedPurchaseNotification
  | DecodedTestNotification;

/** Pub/Sub push message envelope. `message.data` is base64-encoded JSON. */
export const PubSubMessage = Schema.Struct({
  message: Schema.Struct({
    data: Schema.String,
    messageId: Schema.optional(Schema.String),
    publishTime: Schema.optional(Schema.String),
    attributes: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  }),
  subscription: Schema.optional(Schema.String),
});

export type PubSubMessage = typeof PubSubMessage.Type;

/** Workers-safe base64 → UTF-8 decode (no `Buffer`). */
const decodeBase64ToUtf8 = (base64: string): string => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
};

/**
 * Decodes a base64-encoded RTDN `message.data` payload into a validated
 * {@link DeveloperNotification}.
 */
export const decodeNotificationFromBase64 = (messageData: string) =>
  Effect.gen(function* () {
    const decodedString = yield* Effect.try({
      try: () => decodeBase64ToUtf8(messageData),
      catch: (error) =>
        new GooglePlayNotificationVerificationError({
          message: `Failed to decode base64 message: ${String(error)}`,
        }),
    });

    const parsedJson = yield* Effect.try({
      try: () => JSON.parse(decodedString) as unknown,
      catch: (error) =>
        new GooglePlayInvalidNotificationError({
          message: `Failed to parse notification JSON: ${String(error)}`,
          rawNotification: decodedString,
        }),
    });

    return yield* Schema.decodeUnknownEffect(DeveloperNotification)(parsedJson).pipe(
      Effect.mapError(
        (parseError) =>
          new GooglePlayInvalidNotificationError({
            message: `Invalid notification structure: ${parseError.message}`,
            rawNotification: parsedJson,
          }),
      ),
    );
  });

/** Parses a Pub/Sub push envelope and extracts the inner RTDN notification. */
export const parseNotificationFromPubSubMessage = (pubsubMessage: unknown) =>
  Effect.gen(function* () {
    const message = yield* Schema.decodeUnknownEffect(PubSubMessage)(pubsubMessage).pipe(
      Effect.mapError(
        (parseError) =>
          new GooglePlayInvalidNotificationError({
            message: `Invalid Pub/Sub message structure: ${parseError.message}`,
            rawNotification: pubsubMessage,
          }),
      ),
    );
    return yield* decodeNotificationFromBase64(message.message.data);
  });

/** Converts a {@link DeveloperNotification} into a typed {@link DecodedNotification}. */
export const categorizeNotification = (notification: typeof DeveloperNotification.Type) =>
  Effect.gen(function* () {
    const { packageName, eventTimeMillis } = notification;

    if (notification.subscriptionNotification) {
      const subNotif = notification.subscriptionNotification;
      const notificationType = subNotif.notificationType as SubscriptionNotificationTypeValue;
      return {
        type: "subscription",
        packageName,
        eventTimeMillis,
        notificationType,
        notificationTypeName: SUBSCRIPTION_NOTIFICATION_TYPES[notificationType] ?? "UNKNOWN",
        purchaseToken: subNotif.purchaseToken,
        subscriptionId: subNotif.subscriptionId,
      } satisfies DecodedSubscriptionNotification;
    }

    if (notification.oneTimeProductNotification) {
      const prodNotif = notification.oneTimeProductNotification;
      return {
        type: "oneTimeProduct",
        packageName,
        eventTimeMillis,
        notificationType: prodNotif.notificationType,
        notificationTypeName:
          ONE_TIME_PRODUCT_NOTIFICATION_TYPES[prodNotif.notificationType] ?? "UNKNOWN",
        purchaseToken: prodNotif.purchaseToken,
        sku: prodNotif.sku,
      } satisfies DecodedOneTimeProductNotification;
    }

    if (notification.voidedPurchaseNotification) {
      const voidedNotif = notification.voidedPurchaseNotification;
      return {
        type: "voidedPurchase",
        packageName,
        eventTimeMillis,
        purchaseToken: voidedNotif.purchaseToken,
        orderId: voidedNotif.orderId,
        productType: voidedNotif.productType,
        refundType: voidedNotif.refundType,
      } satisfies DecodedVoidedPurchaseNotification;
    }

    if (notification.testNotification) {
      return {
        type: "test",
        packageName,
        eventTimeMillis,
        version: notification.testNotification.version,
      } satisfies DecodedTestNotification;
    }

    return yield* Effect.fail(
      new GooglePlayInvalidNotificationError({
        message: "Notification does not contain a recognized notification type",
        rawNotification: notification,
      }),
    );
  });

/** Parses and categorizes a complete Pub/Sub RTDN push message. */
export const parseAndCategorizeNotification = (pubsubMessage: unknown) =>
  Effect.gen(function* () {
    const notification = yield* parseNotificationFromPubSubMessage(pubsubMessage);
    return yield* categorizeNotification(notification);
  });

/** Subscription notification types that indicate the subscription became active. */
export const isSubscriptionActivatedNotification = (notification: DecodedNotification): boolean =>
  notification.type === "subscription" && [1, 4, 7].includes(notification.notificationType); // RECOVERED / PURCHASED / RESTARTED

/** Subscription notification types that indicate a renewal. */
export const isSubscriptionRenewalNotification = (notification: DecodedNotification): boolean =>
  notification.type === "subscription" && notification.notificationType === 2; // RENEWED

/** Subscription notification types that indicate cancellation / loss of entitlement. */
export const isSubscriptionCancellationNotification = (
  notification: DecodedNotification,
): boolean =>
  notification.type === "subscription" && [3, 12, 13].includes(notification.notificationType); // CANCELED / REVOKED / EXPIRED
