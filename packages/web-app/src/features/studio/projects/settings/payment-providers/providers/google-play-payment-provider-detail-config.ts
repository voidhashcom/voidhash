import {
  googlePlay,
  type GooglePlayGlobalConfiguration,
} from "@/features/studio/lib/payment-providers/google-play";

export type GooglePlayTabId =
  | "app-details"
  | "service-account"
  | "real-time-developer-notifications";

export interface GooglePlayPaymentProviderDetailTab {
  fields: (keyof GooglePlayGlobalConfiguration)[];
  id: GooglePlayTabId;
  label: string;
}

type GooglePlayStoredConfiguration = Partial<GooglePlayGlobalConfiguration>;

export const GOOGLE_PLAY_TABS: GooglePlayPaymentProviderDetailTab[] = [
  {
    fields: ["packageName"],
    id: "app-details",
    label: "App Details",
  },
  {
    fields: ["serviceAccountKey"],
    id: "service-account",
    label: "Service account",
  },
  {
    fields: [
      "googleRealTimeDeveloperNotificationTopicName",
      "googleRealTimeDeveloperNotificationForwardingUrl",
    ],
    id: "real-time-developer-notifications",
    label: "Google developer notifications",
  },
];

export const GOOGLE_PLAY_FIELD_LABELS: Record<keyof GooglePlayGlobalConfiguration, string> = {
  googleRealTimeDeveloperNotificationForwardingUrl: "Raw Google events forwarding URL",
  googleRealTimeDeveloperNotificationTopicName: "Google Play RTDN topic name",
  packageName: "Google Play package name",
  serviceAccountKey: "Service account key file",
};

const OPTIONAL_FIELDS = new Set<keyof GooglePlayGlobalConfiguration>([
  "googleRealTimeDeveloperNotificationForwardingUrl",
  "googleRealTimeDeveloperNotificationTopicName",
]);

export function isGooglePlayOptionalField(
  field: keyof GooglePlayGlobalConfiguration,
  _values?: GooglePlayGlobalConfiguration,
): boolean {
  return OPTIONAL_FIELDS.has(field);
}

export function getGooglePlayInitialConfiguration(
  configuration: GooglePlayStoredConfiguration | null | undefined,
): GooglePlayGlobalConfiguration {
  return {
    ...googlePlay.defaultGlobalConfiguration,
    ...configuration,
  };
}
