package com.voidhash.sdk.analytics

/** Source values reported through `$screen_source`. */
internal object ScreenSources {
    const val MANUAL = "manual"
    const val ACTIVITY = "android-activity"
    const val FRAGMENT = "android-fragment"
    const val COMPOSE_NAVIGATION = "compose-navigation"
}

/** Builds the view for a resumed activity; [title] is dropped when blank. */
internal fun activityScreenView(identity: Int, simpleName: String, title: CharSequence?): ScreenView =
    ScreenView(
        identity = "activity:$identity",
        name = simpleName,
        path = simpleName,
        title = title?.toString()?.takeIf { it.isNotEmpty() },
        source = ScreenSources.ACTIVITY,
    )

/** Builds the view for a resumed fragment. */
internal fun fragmentScreenView(identity: Int, simpleName: String): ScreenView =
    ScreenView(
        identity = "fragment:$identity",
        name = simpleName,
        path = simpleName,
        source = ScreenSources.FRAGMENT,
    )

/**
 * Builds the view for a Compose Navigation destination. The route pattern is
 * the name and the path substitutes `{argument}` placeholders from
 * [arguments]; a destination without a route falls back to its id.
 */
internal fun composeScreenView(
    destinationId: Int,
    route: String?,
    arguments: Map<String, Any?>,
): ScreenView {
    val name = route ?: "destination:$destinationId"
    val path = route?.let { substituteRouteArguments(it, arguments) } ?: name
    return ScreenView(
        identity = "compose:$destinationId:$path",
        name = name,
        path = path,
        params = arguments.takeIf { it.isNotEmpty() },
        source = ScreenSources.COMPOSE_NAVIGATION,
    )
}

/** Replaces every `{key}` placeholder in [route] that [arguments] has a value for. */
internal fun substituteRouteArguments(route: String, arguments: Map<String, Any?>): String {
    if (arguments.isEmpty() || !route.contains('{')) return route
    var path = route
    for ((key, value) in arguments) {
        path = path.replace("{$key}", value.toString())
    }
    return path
}
