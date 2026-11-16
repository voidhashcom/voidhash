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

    /**
     * The first foreground of the process: its first activity start. A process started in the
     * background — a push, a job, a broadcast — has none until the user brings up an activity.
     */
    const val APP_OPENED = "\$app_opened"

    /** The last started activity stopped. */
    const val APP_BACKGROUNDED = "\$app_backgrounded"

    /** An activity started after the app had been backgrounded, later in the same process. */
    const val APP_BECAME_ACTIVE = "\$app_became_active"

    /** The app ended in a crash or ANR Android recorded, reported at a later launch. */
    const val APP_CRASHED = "\$app_crashed"

    /** The identity was reset through [com.voidhash.sdk.VoidhashClient.reset]. */
    const val SIGN_OUT = "\$sign_out"

    /** The user arrived on a screen. */
    const val SCREEN = "\$screen"

    /**
     * The user opened a notification sent through Voidhash, reported by the app through
     * [com.voidhash.sdk.VoidhashClient.trackPushOpened].
     */
    const val PUSH_OPENED = "\$push_opened"
}

/** The custom data key Voidhash adds to every notification it sends, holding its send's id. */
internal const val PUSH_SEND_ID_DATA_KEY = "voidhash_send_id"

/** The [AutomaticEvents.PUSH_OPENED] property naming the send. */
internal const val PUSH_SEND_ID_PROPERTY = "push_notification_send_id"

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
