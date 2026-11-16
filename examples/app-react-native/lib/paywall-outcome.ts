import type { FlowResult } from "@voidhash/react-native";

export interface PaywallOutcome {
  /** Present the app-owned Upgrade screen instead of the hosted paywall. */
  fallback: boolean;
  /** One sentence explaining the outcome, safe to show a user. */
  reason: string;
}

/**
 * Turns a `present()` result into a decision. `present()` never rejects: it
 * resolves once the paywall is gone with how it ended, and a paywall that
 * could not appear is `failed` with an error code saying why. Every failure
 * means "show your own screen".
 *
 * `FLOW_NOT_ASSIGNED` is the state every project is in before the first
 * paywall is published, so a Nimbus with no dashboard configuration still
 * sells Pro.
 */
export function describePaywallOutcome(result: FlowResult): PaywallOutcome {
  switch (result.status) {
    case "purchased":
      return { fallback: false, reason: "The user bought Pro from the paywall." };
    case "restored":
      return { fallback: false, reason: "The user restored their purchases from the paywall." };
    case "finished":
    case "closed":
      return { fallback: false, reason: "The user saw the paywall and left it." };
    case "failed":
      return { fallback: true, reason: describeFailure(result.error.code, result.error.message) };
  }
}

function describeFailure(code: string, message: string): string {
  switch (code) {
    case "FLOW_NOT_ASSIGNED":
      return "No paywall is published for this location yet.";
    case "FLOW_UNAVAILABLE":
      return "The paywall could not be loaded while the device is offline.";
    case "FLOW_RENDERER_MISSING":
      return "This build does not include the paywall renderer.";
    case "FLOW_UNSUPPORTED_PACKAGE":
      return "This version of the app cannot show the published paywall; update the app.";
    case "FLOW_DISABLED":
      return "Voidhash is disabled in this build.";
    default:
      // A future SDK could add a code. Falling back beats dead-ending on it.
      return `The paywall could not be presented: ${message}`;
  }
}
