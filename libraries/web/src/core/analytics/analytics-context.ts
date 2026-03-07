import type { VoidhashTrackOptions } from "../../types";
import { BrowserPlatformProvider } from "../platform/browser-platform-provider";
import type { AnalyticsRequestEvent } from "./contracts";

const trimUndefined = (entries: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(entries).filter(([, value]) => typeof value !== "undefined")
  );

const createEventId = (platform: BrowserPlatformProvider) =>
  `evt_${platform.randomId().split("-").join("")}`;

export const createAnalyticsEvent = (
  platform: BrowserPlatformProvider,
  eventName: string,
  properties?: Record<string, unknown>,
  options?: VoidhashTrackOptions
): AnalyticsRequestEvent => ({
  context: platform.buildAnalyticsContext(),
  event_id: options?.eventId ?? createEventId(platform),
  event_name: eventName,
  event_ts: options?.timestamp ?? new Date().toISOString(),
  properties: trimUndefined(properties ?? {}),
  session_id: options?.sessionId,
});
