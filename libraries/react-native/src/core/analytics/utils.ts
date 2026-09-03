import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { SDK_VERSION } from "../constants";
import { getNonce } from "../utils/crypto";
import { QueuedAnalyticsEvent } from "./types";
import { PlatformProvider } from "../platform/platform-provider";
import { SdkConfiguration } from "../sdk-configuration";

/**
 * IANA time zone of the device; none where `Intl` is unavailable (older
 * Hermes builds without the Intl bundle).
 */
const resolveTimezone = Effect.try(() => Intl.DateTimeFormat().resolvedOptions().timeZone).pipe(
  Effect.map(Option.fromNullishOr),
  Effect.orElseSucceed(() => Option.none<string>()),
);

export const createQueuedAnalyticsEvent = (
  eventName: string,
  properties: Record<string, unknown>,
  sessionId: string,
): Effect.Effect<QueuedAnalyticsEvent> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now;
    return {
      attempts: 0,
      availableAt: DateTime.toEpochMillis(now),
      eventName,
      eventTimestamp: DateTime.formatIso(now),
      id: getNonce(),
      properties,
      sessionId,
    };
  });

const fallbackProperties = {
  $app_build: null,
  $app_name: null,
  $app_version: null,
  $bundle_id: null,
  $device_brand: null,
  $device_name: null,
  $environment: "production",
  $locale: null,
  $platform: "unknown",
  $platform_version: null,
  $sdk: "react-native",
  $sdk_version: SDK_VERSION,
  $timezone: null,
} satisfies Record<string, unknown>;

/**
 * The `$`-prefixed properties stamped on every event. The key set is mirrored
 * by the iOS and Android SDKs and by the web SDK; `$environment` reports the
 * SDK's environment mode (the same value as the `x-environment` header).
 */
export const getAnalyticsStandardizedProperties = Effect.gen(function* () {
  const platformProvider = yield* PlatformProvider;
  const sdkConfiguration = yield* SdkConfiguration;
  return {
    $app_build: platformProvider.appBuild ?? null,
    $app_name: platformProvider.appName ?? platformProvider.bundleId ?? null,
    $app_version: platformProvider.appVersion ?? null,
    $bundle_id: platformProvider.bundleId ?? null,
    $device_brand: platformProvider.deviceBrand ?? null,
    $device_name: platformProvider.deviceName ?? null,
    $environment: sdkConfiguration.environmentMode,
    $locale: platformProvider.locales[0]?.languageTag ?? null,
    $platform: platformProvider.platform ?? "unknown",
    $platform_version: platformProvider.systemVersion ?? null,
    $sdk: "react-native",
    $sdk_version: SDK_VERSION,
    $timezone: Option.getOrNull(yield* resolveTimezone),
  } satisfies Record<string, unknown>;
}).pipe(Effect.orElseSucceed(() => fallbackProperties));

export const mapQueuedAnalyticsEventToIngestEvent = (
  event: QueuedAnalyticsEvent,
  standardizedProperties: Record<string, unknown>,
) => ({
  context: {},
  event_id: event.id,
  event_name: event.eventName,
  event_ts: event.eventTimestamp,
  properties: {
    ...event.properties,
    ...standardizedProperties,
  },
  session_id: event.sessionId,
});
