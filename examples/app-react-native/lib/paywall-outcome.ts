export interface PaywallFailure {
  /** One sentence explaining why the hosted paywall did not appear, safe to show a user. */
  reason: string;
}

/**
 * Turns a rejected `present()` into a decision. `present()` resolves once the
 * paywall is gone with how it ended, and rejects when the paywall could not
 * appear, with an error whose `code` says why. Every rejection means "show
 * your own screen".
 *
 * `FLOW_NOT_ASSIGNED` is the state every project is in before the first
 * paywall is published, so a Nimbus with no dashboard configuration still
 * sells Pro.
 */
export function describePaywallFailure(error: unknown): PaywallFailure {
  const message = error instanceof Error ? error.message : String(error);
  const code = error instanceof Error && "code" in error ? String(error.code) : "";
  return { reason: describeFailure(code, message) };
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
