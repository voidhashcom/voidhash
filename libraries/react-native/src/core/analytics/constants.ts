/**
 * Names of analytics events the SDK captures automatically on the user's
 * behalf. The leading `$` marks them as built-in/reserved — mirroring the
 * convention used for standardized properties (`$app_version`, `$platform`,
 * …) — so they can be told apart from custom product events captured via
 * `capture(...)`.
 */
export const AUTOMATIC_EVENTS = {
  /** First launch the SDK has seen on this install (no cached release). */
  APP_INSTALLED: "$app_installed",
  /** Launch where the app build/version differs from the last seen one. */
  APP_UPDATED: "$app_updated",
  /** Every SDK startup, after install/update has been resolved. */
  APP_OPENED: "$app_opened",
  /** App moved to the background. */
  APP_BACKGROUNDED: "$app_backgrounded",
  /** App returned to the foreground from a non-active state. */
  APP_BECAME_ACTIVE: "$app_became_active",
  /** User signed out (identity reset triggered via `signOut`). */
  SIGN_OUT: "$sign_out",
} as const;
