package com.voidhash.sdk.analytics

import com.voidhash.sdk.ScreenTrackingOptions

private const val MAX_SCREEN_LABEL_LENGTH = 200
private const val MAX_SCREEN_PARAMS = 20

/**
 * One screen the user arrived on.
 *
 * @property identity token telling screen instances apart; a repeat of the
 *   current identity is not a new arrival.
 * @property name stable, low-cardinality label (route pattern or class name).
 * @property path concrete location; equals [name] when nothing is more specific.
 * @property title human title when the platform exposes one.
 * @property params route arguments; only sent with `includeParams`.
 * @property source integration that produced the view, e.g. `android-activity`.
 */
data class ScreenView(
    val identity: String,
    val name: String,
    val path: String,
    val title: String? = null,
    val params: Map<String, Any?>? = null,
    val source: String,
)

/**
 * The `$screen` state machine shared by every Voidhash SDK: remembers the
 * current screen so the next arrival carries the previous screen and the time
 * spent on it.
 */
class ScreenTracker(
    private val options: ScreenTrackingOptions = ScreenTrackingOptions(),
    private val clock: () -> Long = { System.currentTimeMillis() },
) {
    private data class Current(val identity: String, val name: String, val path: String, val arrivedAt: Long)

    private var current: Current? = null

    /**
     * Feeds a screen arrival. Returns the `$screen` properties to capture, or
     * `null` when the view is the current instance or `mapScreen` dropped it.
     */
    @Synchronized
    fun transition(view: ScreenView): Map<String, Any?>? {
        val mapped = options.mapScreen?.let { map -> map(view) ?: return null } ?: view
        val previous = current
        if (previous?.identity == mapped.identity) return null

        val now = clock()
        val name = mapped.name.take(MAX_SCREEN_LABEL_LENGTH)
        val path = mapped.path.take(MAX_SCREEN_LABEL_LENGTH)
        val properties = LinkedHashMap<String, Any?>()
        properties[ScreenProperties.NAME] = name
        properties[ScreenProperties.PATH] = path
        mapped.title?.takeIf { it.isNotEmpty() }?.let { properties[ScreenProperties.TITLE] = it }
        properties[ScreenProperties.SOURCE] = mapped.source
        properties[ScreenProperties.PREVIOUS_NAME] = previous?.name
        properties[ScreenProperties.PREVIOUS_PATH] = previous?.path
        properties[ScreenProperties.PREVIOUS_DURATION_MS] = previous?.let { now - it.arrivedAt }
        if (options.includeParams) {
            mapped.params?.let { properties[ScreenProperties.PARAMS] = coerceParams(it) }
        }

        current = Current(mapped.identity, name, path, now)
        return properties
    }

    /** Forgets the current screen; the next arrival has `null` previous fields. */
    @Synchronized
    fun reset() {
        current = null
    }

    private fun coerceParams(params: Map<String, Any?>): Map<String, String> {
        val coerced = LinkedHashMap<String, String>()
        for ((key, value) in params) {
            if (coerced.size >= MAX_SCREEN_PARAMS) break
            coerced[key] = value.toString()
        }
        return coerced
    }
}
