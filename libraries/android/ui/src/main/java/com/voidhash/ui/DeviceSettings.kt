package com.voidhash.ui

import android.content.Context
import android.content.res.Configuration
import android.os.Build
import android.provider.Settings
import android.view.WindowInsets
import org.json.JSONObject

/** System bars and display cutout, in pixels: top, right, bottom, left. */
internal fun safeAreaInsets(windowInsets: WindowInsets): IntArray {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        val safe = windowInsets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
        return intArrayOf(safe.top, safe.right, safe.bottom, safe.left)
    }
    // Before Android 11 the bottom inset grows by the keyboard while it is shown, which is
    // not part of the safe area: the stable inset is the system bar alone.
    @Suppress("DEPRECATION")
    val bars = intArrayOf(
        windowInsets.systemWindowInsetTop,
        windowInsets.systemWindowInsetRight,
        minOf(windowInsets.systemWindowInsetBottom, windowInsets.stableInsetBottom),
        windowInsets.systemWindowInsetLeft,
    )
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        val cutout = windowInsets.displayCutout ?: return bars
        return intArrayOf(
            maxOf(bars[0], cutout.safeInsetTop),
            maxOf(bars[1], cutout.safeInsetRight),
            maxOf(bars[2], cutout.safeInsetBottom),
            maxOf(bars[3], cutout.safeInsetLeft),
        )
    }
    return bars
}

/** Whether the device's "Remove animations" setting is on: it sets the animator duration scale to zero. */
internal fun reducedMotion(context: Context): Boolean =
    Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f

/** Whether [configuration] is in the dark theme. */
internal fun darkTheme(configuration: Configuration): Boolean =
    configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES

/** The `context` envelope reporting the device's settings to the flow. */
internal fun contextMessage(reducedMotion: Boolean, dark: Boolean, locale: String?): String {
    val payload = JSONObject()
        .put("reducedMotion", reducedMotion)
        .put("colorScheme", if (dark) "dark" else "light")
    locale?.let { payload.put("locale", it) }
    return JSONObject().put("version", 1).put("type", "context").put("payload", payload).toString()
}

/** The first preferred locale, as the SDK reports the device's locale. */
@Suppress("DEPRECATION")
internal fun primaryLocale(configuration: Configuration): String? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        configuration.locales.takeIf { it.size() > 0 }?.get(0)?.toLanguageTag()
    } else {
        configuration.locale?.toLanguageTag()
    }
