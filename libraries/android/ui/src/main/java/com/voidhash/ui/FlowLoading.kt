package com.voidhash.ui

import android.app.Activity
import android.app.Dialog
import android.content.Context
import android.content.res.Configuration
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.Drawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.accessibility.AccessibilityNodeInfo
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ProgressBar
import com.voidhash.sdk.flows.FlowLoadingSession

/**
 * What the end user sees while a flow waits for the network: see [FlowViewRenderer.loading].
 *
 * A presentation that has to wait for its flow (its location's answer, or its package) shows the
 * loading state full screen once it has waited [DELAY_MS], so a flow already on the device is
 * shown without it. It stays until the flow is shown above it, or the presentation fails or is
 * cancelled. The end user can leave it, with its close button or the back button or gesture: the
 * presentation then returns `FlowResult.DISMISSED`, as when the app dismisses it, and is reported
 * as cancelled by the end user.
 */
sealed class FlowLoading {
    /**
     * The SDK's own: a progress indicator, which TalkBack announces as loading, and a close button,
     * on the app theme's background (`android:colorBackground`), inside the system bars and display
     * cutouts.
     */
    object Standard : FlowLoading()

    /** None: the app's screen stays as it is until the flow is shown, as before loading states. */
    object None : FlowLoading()

    /**
     * The app's own view, from [createView] with the presenting activity and the function that lets
     * the end user leave the loading state. It fills the screen edge to edge, behind the system bars:
     * keep its content inside their insets. The back button and gesture leave it too.
     */
    class Custom(val createView: (context: Context, cancel: () -> Unit) -> View) : FlowLoading()

    companion object {
        /** How long a presentation waits before its loading state shows, in milliseconds. */
        const val DELAY_MS = 400L

        /** How long a loading state that appeared stays at least, so it never flashes. */
        internal const val MIN_SHOWN_MS = 300L
    }
}

/**
 * A presentation's loading state: a fullscreen dialog above [activity] showing the view
 * [createView] makes, from [delayMs] after it is created until [end]. The end user leaving it (its
 * view's cancel, or back) calls [onCancel]. It goes with its activity, as a flow's dialog does;
 * the SDK begins another above the activity that replaces it. Main thread.
 */
internal class LoadingDialog(
    val activity: Activity,
    private val createView: (context: Context, cancel: () -> Unit) -> View,
    private val onCancel: () -> Unit,
    delayMs: Long = FlowLoading.DELAY_MS,
) : FlowLoadingSession {
    private val handler = Handler(Looper.getMainLooper())
    private val showing = Runnable { show() }
    private var dialog: Dialog? = null
    private var ended = false

    /** When it appeared, in uptime milliseconds; `null` before. */
    private var shownAt: Long? = null

    /** Run once when it ends, after it was taken down. */
    private val afterEnd = mutableListOf<() -> Unit>()

    /** Runs [action] once the loading state has ended; at once when it has. */
    fun afterEnd(action: () -> Unit) {
        if (ended) action() else afterEnd.add(action)
    }

    private val lifecycle = object : EmptyActivityLifecycleCallbacks() {
        override fun onActivityDestroyed(destroyed: Activity) {
            if (destroyed === activity) dialog?.dismiss()
        }
    }

    init {
        handler.postDelayed(showing, delayMs)
    }

    /** Whether the loading state is on screen. */
    val isShowing: Boolean get() = dialog?.isShowing == true

    override fun remainingMs(): Long {
        val shown = shownAt ?: return 0
        if (!isShowing) return 0
        return (FlowLoading.MIN_SHOWN_MS - (SystemClock.uptimeMillis() - shown)).coerceAtLeast(0)
    }

    override fun end() {
        if (ended) return
        ended = true
        handler.removeCallbacks(showing)
        dialog?.dismiss()
        dialog = null
        afterEnd.forEach { it() }
        afterEnd.clear()
    }

    private fun cancel() {
        if (!ended) onCancel()
    }

    private fun show() {
        if (ended || activity.isFinishing || activity.isDestroyed) return
        val view = createView(activity, ::cancel)
        val dialog = Dialog(activity, android.R.style.Theme_Black_NoTitleBar)
        dialog.setContentView(view, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        dialog.window?.let { window ->
            drawEdgeToEdge(window)
            // The view draws the background; the dialog only fades in.
            window.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
            window.setWindowAnimations(android.R.style.Animation_Toast)
            useBarsFor(window, backgroundOf(activity))
        }
        dialog.setCancelable(true)
        dialog.setCanceledOnTouchOutside(false)
        dialog.setOnCancelListener { cancel() }
        activity.application.registerActivityLifecycleCallbacks(lifecycle)
        dialog.setOnDismissListener { activity.application.unregisterActivityLifecycleCallbacks(lifecycle) }
        try {
            dialog.show()
        } catch (error: RuntimeException) {
            // The activity's window went away meanwhile; the flow still shows when it is ready.
            activity.application.unregisterActivityLifecycleCallbacks(lifecycle)
            return
        }
        this.dialog = dialog
        shownAt = SystemClock.uptimeMillis()
        // TalkBack reads the indicator, once: the window has no title of its own to read as well.
        view.findViewById<View>(LOADING_INDICATOR_ID)?.let { indicator ->
            indicator.post { indicator.performAccessibilityAction(AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS, null) }
        }
    }

    private companion object {
        /** Dark system bar icons over a light background, light ones over a dark one. */
        fun useBarsFor(window: android.view.Window, background: Int) {
            val light = luminance(background) > 0.5
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val appearance = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or
                    WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
                window.insetsController?.setSystemBarsAppearance(if (light) appearance else 0, appearance)
            } else if (light) {
                @Suppress("DEPRECATION")
                window.decorView.systemUiVisibility = window.decorView.systemUiVisibility or
                    View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or
                    (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR else 0)
            }
        }
    }
}

/**
 * The standard loading state: a large indeterminate progress indicator in the middle and a close
 * button in the top end corner, on the app theme's background, both inside the system bars and
 * display cutouts. TalkBack reads the indicator as loading and the button as cancel, in the
 * reader's language (the loading text is the `voidhash_flow_loading` string, which an app can
 * translate).
 */
internal fun standardLoadingView(context: Context, cancel: () -> Unit): View {
    val density = context.resources.displayMetrics.density
    val foreground = themeColor(context, android.R.attr.textColorPrimary)
        ?: if (isNight(context)) Color.WHITE else Color.BLACK
    val root = FrameLayout(context)
    root.setBackgroundColor(backgroundOf(context))

    val progress = ProgressBar(context, null, android.R.attr.progressBarStyleLarge)
    progress.id = LOADING_INDICATOR_ID
    progress.isIndeterminate = true
    progress.contentDescription = context.getString(R.string.voidhash_flow_loading)
    progress.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
    root.addView(progress, FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER))

    val close = ImageButton(context)
    close.setImageDrawable(CloseGlyph(foreground, density))
    close.background = null
    close.contentDescription = context.getString(android.R.string.cancel)
    close.setOnClickListener { cancel() }
    val size = (48 * density).toInt()
    root.addView(close, FrameLayout.LayoutParams(size, size, Gravity.TOP or Gravity.END))

    // Inside the system bars and display cutouts, as a flow lays itself out.
    root.setOnApplyWindowInsetsListener { view, insets ->
        val margin = (4 * density).toInt()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val safe = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
            view.setPadding(safe.left + margin, safe.top + margin, safe.right + margin, safe.bottom + margin)
        } else {
            @Suppress("DEPRECATION")
            view.setPadding(
                insets.systemWindowInsetLeft + margin,
                insets.systemWindowInsetTop + margin,
                insets.systemWindowInsetRight + margin,
                insets.systemWindowInsetBottom + margin,
            )
        }
        insets
    }
    // A quick fade in; none with animations turned off, which scales animator durations to 0.
    root.alpha = 0f
    root.animate().alpha(1f).setDuration(150).start()
    return root
}

/** The standard loading state's indicator, which TalkBack focuses when it appears. */
internal val LOADING_INDICATOR_ID = View.generateViewId()

/** The background of [context]'s theme, `android:colorBackground`, or white or black by the night mode. */
private fun backgroundOf(context: Context): Int =
    themeColor(context, android.R.attr.colorBackground) ?: if (isNight(context)) Color.BLACK else Color.WHITE

private fun themeColor(context: Context, attribute: Int): Int? {
    val value = TypedValue()
    if (!context.theme.resolveAttribute(attribute, value, true)) return null
    return when {
        value.type >= TypedValue.TYPE_FIRST_COLOR_INT && value.type <= TypedValue.TYPE_LAST_COLOR_INT -> value.data
        value.resourceId != 0 -> try {
            context.getColorStateList(value.resourceId).defaultColor
        } catch (error: Exception) {
            null
        }
        else -> null
    }
}

private fun isNight(context: Context): Boolean =
    context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES

private fun luminance(color: Int): Double =
    (0.2126 * Color.red(color) + 0.7152 * Color.green(color) + 0.0722 * Color.blue(color)) / 255

/** A close glyph, an × in [color] on a faint disc of it, 30 dp across, centred in its bounds. */
private class CloseGlyph(private val color: Int, private val density: Float) : Drawable() {
    private val disc = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = Color.argb(31, Color.red(color), Color.green(color), Color.blue(color))
    }
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color
        style = Paint.Style.STROKE
        strokeWidth = 2 * density
        strokeCap = Paint.Cap.ROUND
    }

    override fun draw(canvas: Canvas) {
        val x = bounds.exactCenterX()
        val y = bounds.exactCenterY()
        canvas.drawCircle(x, y, 15 * density, disc)
        val arm = 5 * density
        canvas.drawLine(x - arm, y - arm, x + arm, y + arm, stroke)
        canvas.drawLine(x - arm, y + arm, x + arm, y - arm, stroke)
    }

    override fun getIntrinsicWidth(): Int = (30 * density).toInt()

    override fun getIntrinsicHeight(): Int = (30 * density).toInt()

    override fun setAlpha(alpha: Int) {
        stroke.alpha = alpha
    }

    override fun setColorFilter(colorFilter: ColorFilter?) {
        stroke.colorFilter = colorFilter
        disc.colorFilter = colorFilter
    }

    @Deprecated("Deprecated in Java")
    override fun getOpacity(): Int = PixelFormat.TRANSLUCENT
}
