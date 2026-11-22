package com.voidhash.ui

import android.content.Context
import android.content.res.Configuration
import android.os.Build
import android.provider.Settings
import android.util.DisplayMetrics
import android.util.TypedValue
import android.view.WindowInsets
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs

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

/**
 * The end user's font size as a multiple of the default ([Configuration.fontScale]): 0.85 to 2 in
 * the system settings. The flow's runtime sizes every text by it, so the views draw and measure
 * the sizes they are given, in pixels, and never scale a text themselves.
 */
internal fun fontScale(configuration: Configuration): Float =
    configuration.fontScale.takeIf { it.isFinite() && it > 0f } ?: 1f

/**
 * The font sizes Android's own conversion is defined at: between two of them it is linear, past
 * the last it keeps the last one's ratio, so the runtime reproduces it from these points.
 */
private val FONT_SCALE_SIZES = floatArrayOf(8f, 10f, 12f, 14f, 18f, 20f, 24f, 30f, 100f)

/**
 * From Android 14, a large font scale grows small text more than large text: the size each of
 * [FONT_SCALE_SIZES] shows at (in dp, as the platform converts sp with [metrics]), or null where
 * every size grows by [fontScale] alike, as on every earlier version.
 */
internal fun fontScaleCurve(metrics: DisplayMetrics, fontScale: Float): List<Pair<Float, Float>>? {
    if (!(metrics.density > 0f)) return null
    val curve = FONT_SCALE_SIZES.map { size ->
        size to TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, size, metrics) / metrics.density
    }
    return curve.takeUnless { points -> points.all { (size, shown) -> abs(shown - size * fontScale) < 0.01f } }
}

/**
 * The scale and the curve of [configuration], both from it: the curve from resources made for
 * [configuration] itself, which a view's own resources may not have caught up with yet while it is
 * told of a change.
 */
internal fun fontScaleOf(context: Context, configuration: Configuration): Pair<Float, List<Pair<Float, Float>>?> {
    val scale = fontScale(configuration)
    val metrics = context.createConfigurationContext(configuration).resources.displayMetrics
    return scale to fontScaleCurve(metrics, scale)
}

/** [value] rounded to thousandths, as the envelope carries it. */
private fun rounded(value: Float): Double = Math.round(value * 1000.0) / 1000.0

/** The `context` envelope reporting the device's settings to the flow. */
internal fun contextMessage(
    reducedMotion: Boolean,
    dark: Boolean,
    locale: String?,
    fontScale: Float = 1f,
    fontScaleCurve: List<Pair<Float, Float>>? = null,
): String {
    val payload = JSONObject()
        .put("reducedMotion", reducedMotion)
        .put("colorScheme", if (dark) "dark" else "light")
        .put("fontScale", rounded(fontScale))
    fontScaleCurve?.let { curve ->
        payload.put(
            "fontScaleCurve",
            JSONArray(curve.map { (size, shown) -> JSONArray().put(rounded(size)).put(rounded(shown)) }),
        )
    }
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
