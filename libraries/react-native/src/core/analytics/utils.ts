import { Effect } from "effect";
import { SDK_VERSION } from "../constants";
import { getNonce } from "../utils/crypto";
import { QueuedAnalyticsEvent } from "./types";
import { PlatformProvider } from "../platform/platform-provider";

export const createQueuedAnalyticsEvent = (
  eventName: string,
  properties: Record<string, unknown>,
): QueuedAnalyticsEvent => ({
  attempts: 0,
  availableAt: Date.now(),
  eventName,
  eventTimestamp: new Date().toISOString(),
  id: getNonce(),
  properties,
});

export const getAnalyticsStandardizedProperties = () => {
  let cached: Record<string, unknown> | null = null;

  const fallbackProperties = {
    $app_build: null,
    $app_name: null,
    $app_version: null,
    $bundle_id: null,
    $device_brand: null,
    $device_name: null,
    $locale: null,
    $platform: "unknown",
    $platform_version: null,
    $sdk: "react-native",
    $sdk_version: SDK_VERSION,
  } satisfies Record<string, unknown>;

  return () =>
    Effect.gen(function* () {
      if (cached) return cached;
      const platformProvider = yield* PlatformProvider;
      const props = {
        $app_build: platformProvider.appBuild ?? null,
        $app_name: platformProvider.appName ?? platformProvider.bundleId ?? null,
        $app_version: platformProvider.appVersion ?? null,
        $bundle_id: platformProvider.bundleId ?? null,
        $device_brand: platformProvider.deviceBrand ?? null,
        $device_name: platformProvider.deviceName ?? null,
        $locale: platformProvider.locales[0]?.languageTag ?? null,
        $platform: platformProvider.platform ?? "unknown",
        $platform_version: platformProvider.systemVersion ?? null,
        $sdk: "react-native",
        $sdk_version: SDK_VERSION,
      };
      cached = props;
      return props;
    }).pipe(
      Effect.orElseSucceed(() => {
        cached = fallbackProperties;
        return fallbackProperties;
      })
    );
};

export const mapQueuedAnalyticsEventToIngestEvent = (
  event: QueuedAnalyticsEvent,
  standardizedProperties: Record<string, unknown>,
  sessionId: string
) => ({
  context: {},
  event_id: event.id,
  event_name: event.eventName,
  event_ts: event.eventTimestamp,
  properties: {
    ...event.properties,
    ...standardizedProperties,
  },
  session_id: sessionId,
});
