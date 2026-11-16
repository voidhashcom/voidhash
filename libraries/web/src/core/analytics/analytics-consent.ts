import * as Context from "effect/Context";
import * as Option from "effect/Option";

import type { AnalyticsConsent, ResolvedVoidhashConfig } from "../../types";

/**
 * Storage key of the end user's consent choice. It sits outside the
 * `analytics:` prefix on purpose: revoking consent clears every `analytics:`
 * key, and the choice itself must survive that.
 */
export const ANALYTICS_CONSENT_KEY = "consent:analytics";

/**
 * Storage key of the mark that the stored `granted` was implied by `identify()`,
 * with `grantConsentOnIdentify`, rather than answered by the end user. It only
 * exists beside a granted choice, which `signOut()` and `reset()` then return
 * to `pending`.
 */
export const ANALYTICS_CONSENT_IMPLIED_KEY = "consent:analytics-implied";

/**
 * Storage key of the agreements to sharing with ad platforms that are still to be
 * taken back, each with its distinct id. Also outside the `analytics:` prefix, for withdrawal
 * not to discard them, and, like the choice, kept on the device whatever
 * `storeBeforeConsent` says: it is what the end user asked for, and without it a
 * page closed during an outage would leave sharing on.
 */
export const AD_DATA_SHARING_REVOCATIONS_KEY = "consent:ad-data-sharing-revocations";

/** Checks an untrusted value, such as a stored one, against the consent values. */
export const isAnalyticsConsent = (value: unknown): value is AnalyticsConsent =>
  value === "granted" || value === "denied" || value === "pending";

/** Header telling the API that analytics are not permitted for this request. */
export const ANALYTICS_CONSENT_HEADER = "x-analytics-consent";

/**
 * The consent currently in effect, shared by everything that records or sends
 * analytics and by the transports that attach the consent header.
 */
export class AnalyticsConsentState extends Context.Service<
  AnalyticsConsentState,
  {
    /**
     * Consent in effect for recording and sending: always `denied` while
     * `analytics.enabled` is `false`.
     */
    readonly current: () => AnalyticsConsent;
    /**
     * The end user's choice, whatever `analytics.enabled` says. What the SDK
     * may store on the device follows it, so a client that records no
     * analytics stores what the end user allowed, no more and no less.
     */
    readonly choice: () => AnalyticsConsent;
    /** Records an answer of the end user, from the app or another tab. */
    readonly set: (consent: AnalyticsConsent) => void;
    /**
     * Takes in the choice an earlier visit stored. Returns the app's answer
     * when it should replace the stored one, with `analyticsConsentSource:
     * "app"`.
     */
    readonly restore: (stored: Option.Option<AnalyticsConsent>) => Option.Option<AnalyticsConsent>;
    /** Whether the app paused recording; see `VoidhashWebClient.pauseAnalytics`. */
    readonly isPaused: () => boolean;
    readonly setPaused: (paused: boolean) => void;
  }
>()("web-voidhash/AnalyticsConsentState") {}

/**
 * Builds the consent cell. It lives outside the Effect runtime so the client
 * can answer `getAnalyticsConsent()` synchronously, before initialization.
 *
 * With `analyticsConsentSource: "app"`, `pending` means the app does not know
 * the answer yet. It stops recording, but the device keeps what the last
 * answer allowed, so the choice behind storage only follows answers.
 */
export const makeAnalyticsConsentState = (
  config: ResolvedVoidhashConfig,
): AnalyticsConsentState["Service"] => {
  const isAppSource = config.analyticsConsentSource === "app";
  let recording = config.analyticsConsent;
  let choice = config.analyticsConsent;
  let paused = false;
  return {
    choice: () => choice,
    current: () => (config.analytics.enabled ? recording : "denied"),
    isPaused: () => paused,
    restore: (stored) => {
      if (!isAppSource) {
        Option.map(stored, (value) => {
          recording = value;
          choice = value;
        });
        return Option.none();
      }
      // Until the app answers, the device keeps following the last answer
      // stored; once it has, its answer replaces a different stored one.
      if (recording === "pending") {
        Option.map(stored, (value) => {
          choice = value;
        });
        return Option.none();
      }
      return Option.contains(stored, recording) ? Option.none() : Option.some(recording);
    },
    set: (consent) => {
      recording = consent;
      if (!isAppSource || consent !== "pending") choice = consent;
    },
    setPaused: (next) => {
      paused = next;
    },
  };
};
