import type { ShowPaywallResult } from "@voidhash/react-native";

export interface PaywallOutcome {
  /** Present the app-owned Upgrade screen instead of the hosted paywall. */
  fallback: boolean;
  /** One sentence explaining the outcome, safe to show a user. */
  reason: string;
}

/**
 * Turns a `show()` result into a decision. `show()` never rejects: every way a
 * paywall can fail to appear is a status, and all but one of them mean "show
 * your own screen".
 *
 * `not_assigned` is the one to design for. It is the state every project is in
 * before the first paywall is published, so a Nimbus with no dashboard
 * configuration still sells Pro.
 */
export function describePaywallOutcome(result: ShowPaywallResult): PaywallOutcome {
  switch (result.status) {
    case "shown":
      return { fallback: false, reason: "The hosted paywall is on screen." };
    case "not_assigned":
      return {
        fallback: true,
        reason: "No paywall is published for this location yet.",
      };
    case "disabled":
      return {
        fallback: true,
        reason: "Voidhash is disabled in this build.",
      };
    case "native_unavailable":
      return {
        fallback: true,
        reason: "This platform has no native paywall presenter.",
      };
    case "not_initialized":
      return {
        fallback: true,
        reason: "Voidhash is still starting up.",
      };
    case "initialization_failed":
      return {
        fallback: true,
        reason: `Voidhash failed to start: ${result.error.message}`,
      };
    case "failed":
      return {
        fallback: true,
        reason: `The paywall could not be presented: ${result.error.message}`,
      };
    default:
      // A future SDK could add a status. Falling back beats dead-ending on it.
      return { fallback: true, reason: "The paywall could not be presented." };
  }
}
