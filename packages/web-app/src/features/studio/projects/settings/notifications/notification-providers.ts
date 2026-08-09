/**
 * Static metadata for the push-notification providers a project can configure.
 * There are only two — Google's FCM and Apple's APNs — and unlike the payment
 * providers there is no dynamic catalog, so this small in-code list is enough to
 * drive the list page, the setup buttons, and the detail-page chrome.
 */
export interface NotificationProvider {
  /** Wire id sent to the backend (`providerId`). */
  readonly id: "fcm" | "apns";
  /** Human-readable name shown in the UI. */
  readonly title: string;
  /** Short one-line description shown on the list page. */
  readonly description: string;
}

export const notificationProviders: readonly NotificationProvider[] = [
  {
    id: "fcm",
    title: "Firebase Cloud Messaging",
    description: "Deliver push notifications to Android devices via Google FCM.",
  },
  {
    id: "apns",
    title: "Apple Push Notification service",
    description: "Deliver push notifications to iOS devices via Apple APNs.",
  },
];
