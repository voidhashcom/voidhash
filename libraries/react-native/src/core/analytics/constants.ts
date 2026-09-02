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
  /** The user arrived on a screen (route, view controller, activity, …). */
  SCREEN: "$screen",
} as const;

/**
 * Property names stamped on the built-in `$screen` event. The `$` prefix
 * marks them as reserved, next to the standardized `$app_version`-style
 * properties every event carries.
 */
export const SCREEN_PROPERTIES = {
  /** Stable, low-cardinality identity of the screen (route pattern, route or class name). */
  NAME: "$screen_name",
  /** Concrete location, including dynamic segment values where the router has them. */
  PATH: "$screen_path",
  /** Human title when the platform exposes one. */
  TITLE: "$screen_title",
  /** `$screen_name` of the screen the user came from; `null` for the first screen. */
  PREVIOUS_NAME: "$previous_screen_name",
  /** `$screen_path` of the screen the user came from; `null` for the first screen. */
  PREVIOUS_PATH: "$previous_screen_path",
  /** Wall-clock milliseconds spent on the previous screen; `null` for the first screen. */
  PREVIOUS_DURATION_MS: "$previous_screen_duration_ms",
  /** Integration that produced the event (`expo-router`, `react-navigation`, `manual`, …). */
  SOURCE: "$screen_source",
  /** Route params, string-coerced and capped at 20 keys. Only with `includeParams`. */
  PARAMS: "$screen_params",
} as const;
