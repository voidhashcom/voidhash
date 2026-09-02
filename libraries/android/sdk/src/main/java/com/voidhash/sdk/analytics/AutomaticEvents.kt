package com.voidhash.sdk.analytics

/**
 * Names of the analytics events the SDK captures on the app's behalf. The
 * leading `$` marks them as reserved, like the standardized properties.
 */
object AutomaticEvents {
    /** First launch the SDK has seen on this install (no cached release). */
    const val APP_INSTALLED = "\$app_installed"

    /** Launch where the app build or version differs from the last seen one. */
    const val APP_UPDATED = "\$app_updated"

    /** Every SDK initialization, after install/update has been resolved. */
    const val APP_OPENED = "\$app_opened"

    /** The last started activity stopped. */
    const val APP_BACKGROUNDED = "\$app_backgrounded"

    /** An activity started after the app had been backgrounded. */
    const val APP_BECAME_ACTIVE = "\$app_became_active"

    /** The identity was reset through [com.voidhash.sdk.VoidhashClient.reset]. */
    const val SIGN_OUT = "\$sign_out"

    /** The user arrived on a screen. */
    const val SCREEN = "\$screen"
}

/** Property names carried by the [AutomaticEvents.SCREEN] event. */
object ScreenProperties {
    const val NAME = "\$screen_name"
    const val PATH = "\$screen_path"
    const val TITLE = "\$screen_title"
    const val PREVIOUS_NAME = "\$previous_screen_name"
    const val PREVIOUS_PATH = "\$previous_screen_path"
    const val PREVIOUS_DURATION_MS = "\$previous_screen_duration_ms"
    const val SOURCE = "\$screen_source"
    const val PARAMS = "\$screen_params"
}
