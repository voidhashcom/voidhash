package com.voidhash.ui

import android.content.Context
import android.content.res.Configuration
import android.database.ContentObserver
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.AttributeSet
import android.view.Choreographer
import android.view.MotionEvent
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.view.WindowInsets
import android.view.accessibility.AccessibilityManager
import android.view.accessibility.AccessibilityNodeProvider
import org.json.JSONObject
import kotlin.math.ceil

private const val PHASE_DOWN = 0
private const val PHASE_MOVE = 1
private const val PHASE_UP = 2
private const val PHASE_CANCEL = 3

/**
 * Draws a flow-package paywall natively into its own surface.
 *
 * Load a package with [loadPackage] and exchange paywall bridge envelopes through [postMessage]
 * and [Listener.onMessage]. The view draws frames while the paywall animates or something
 * changed, and when a component's timer is due; an idle paywall draws nothing.
 *
 * Android takes the view's surface away whenever its window is not visible, such as while the
 * app is in the background or the screen is off, and the paywall's runtime goes with it. When
 * the surface is back the view loads the package again and replays the last `configure`,
 * `context` and `status` envelopes: the paywall starts again at its first screen, with the
 * variables that `configure` carried, and emits `ready` again. A host that saves the `state`
 * the paywall reports should answer that `ready` with a `configure` carrying what it saved.
 * The window's system bars and display cutout become the paywall's safe area. The view reports
 * the device's locale, dark theme and Remove animations setting to the paywall, and again
 * whenever one changes while it is attached. Main thread only.
 *
 * Most apps never use the view directly: configure [VoidhashUiPaywallRenderer] and the SDK
 * presents paywalls with it.
 */
class VoidhashPaywallView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : SurfaceView(context, attrs) {
    /** Receives what the paywall reports, on the main thread. */
    interface Listener {
        /** A bridge envelope the paywall emitted (`ready`, `purchase`, `close`, …). */
        fun onMessage(message: String)

        /** A problem the paywall recovered from, such as an image that failed to load. */
        fun onWarning(message: String) {}

        /** The paywall cannot keep running and stopped drawing. Reported once. */
        fun onFailure(message: String)
    }

    /** Where the paywall's messages go; `null` drops them. */
    var listener: Listener? = null

    /**
     * Loads the paywall's images in place of the view's own download when it takes a request
     * (returns `true`): it reports the image, or why there is none, on the main thread. The SDK's
     * renderer sets it, so images come from those the SDK keeps on the device before the network.
     * Without one, or for a request it does not take, the view downloads the image itself and
     * keeps it only for as long as the view lives.
     */
    internal var imageSource: ((url: String, onResult: (Result<ByteArray>) -> Unit) -> Boolean)? = null

    /** Told of an image from [imageSource] the paywall could not decode, so it stops keeping it. */
    internal var imageRejected: ((url: String) -> Unit)? = null

    /**
     * Whether a surface that comes back gets the last `configure` again. The SDK's renderer turns
     * it off: the SDK answers every `ready` with a `configure` built from the state it saved.
     */
    internal var replaysConfigure: Boolean
        get() = controller.replayConfigure
        set(value) {
            controller.replayConfigure = value
        }

    private val controller: PaywallSurfaceController = PaywallSurfaceController(
        createRenderer = JniSurfaceRenderer::create,
        fetchImage = { url, onResult ->
            if (imageSource?.invoke(url, onResult) != true) PaywallImageLoader.fetch(url, onResult)
        },
        onMessage = { message -> listener?.onMessage(message) },
        onWarning = { message -> listener?.onWarning(message) },
        onFailure = { message ->
            stopFrames()
            listener?.onFailure(message)
        },
        onSemantics = { tree -> accessibility.update(tree) },
        requestFrame = { scheduleFrame() },
        onImageRejected = { url -> imageRejected?.invoke(url) },
    )

    private val accessibility: PaywallAccessibility = PaywallAccessibility(this) { nodeId, action ->
        controller.accessibilityAction(nodeId, action)
    }

    private val accessibilityManager =
        context.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager?

    private val accessibilityStateListener = AccessibilityManager.AccessibilityStateChangeListener { enabled ->
        controller.setAccessibilityEnabled(enabled)
    }

    /** "Remove animations" sets the animator duration scale to zero; nothing broadcasts it. */
    private val animationScaleObserver = object : ContentObserver(Handler(Looper.getMainLooper())) {
        override fun onChange(selfChange: Boolean) = postContext(resources.configuration)
    }

    /** The last `context` envelope sent, so unchanged settings are not sent again. */
    private var postedContext: String? = null

    private var surfaceWidth = 0
    private var surfaceHeight = 0

    /** Safe-area insets in pixels: top, right, bottom, left. */
    private var insets = intArrayOf(0, 0, 0, 0)
    private var framePosted = false

    /** Draws a frame when a component's timer is due while the paywall is otherwise idle. */
    private val wakeHandler = Handler(Looper.getMainLooper())
    private val wake = Runnable { scheduleFrame() }

    private val frameCallback = Choreographer.FrameCallback { frameTimeNanos ->
        framePosted = false
        when (val outcome = controller.frame(frameTimeNanos / 1_000_000_000.0)) {
            FrameOutcome.NextFrame -> scheduleFrame()
            is FrameOutcome.Idle -> scheduleWake(outcome.wakeAtSeconds)
            FrameOutcome.Stopped -> {}
        }
    }

    private val surfaceCallback = object : SurfaceHolder.Callback {
        override fun surfaceCreated(holder: SurfaceHolder) {
            controller.attach(holder.surface)
            if (controller.isAttached) scheduleFrame()
        }

        override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
            surfaceWidth = width
            surfaceHeight = height
            updateViewport()
        }

        override fun surfaceDestroyed(holder: SurfaceHolder) {
            stopFrames()
            controller.detach()
        }
    }

    init {
        holder.addCallback(surfaceCallback)
        isFocusable = true
        setOnApplyWindowInsetsListener { _, windowInsets ->
            insets = safeAreaInsets(windowInsets)
            updateViewport()
            windowInsets
        }
    }

    /** Shows the flow package [bytes], replacing the one shown before. */
    fun loadPackage(bytes: ByteArray) = controller.loadPackage(bytes)

    /** Delivers a host → paywall bridge envelope (`configure`, `status`). */
    fun postMessage(message: String) = controller.postMessage(message)

    /** Stops the paywall for good and frees its renderer; the view shows nothing afterwards. */
    fun release() {
        stopFrames()
        controller.release()
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        requestApplyInsets()
        accessibilityManager?.let { manager ->
            manager.addAccessibilityStateChangeListener(accessibilityStateListener)
            controller.setAccessibilityEnabled(manager.isEnabled)
        }
        context.contentResolver.registerContentObserver(
            Settings.Global.getUriFor(Settings.Global.ANIMATOR_DURATION_SCALE),
            false,
            animationScaleObserver,
        )
        postContext(resources.configuration)
    }

    override fun onDetachedFromWindow() {
        stopFrames()
        accessibilityManager?.removeAccessibilityStateChangeListener(accessibilityStateListener)
        context.contentResolver.unregisterContentObserver(animationScaleObserver)
        super.onDetachedFromWindow()
    }

    // Reaches the view only when the activity handles the change itself (`android:configChanges`
    // naming `uiMode` or `locale`). Otherwise Android recreates the activity and this view goes
    // with its window: a paywall the SDK presented is shown again above the new activity, in a
    // new view, which reports the settings as it is attached.
    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        postContext(newConfig)
    }

    // The paywall draws every pixel itself, so assistive technology reads the engine's
    // accessibility tree through virtual views. Being asked for them means a service is
    // querying, so the tree is built from then on.
    override fun getAccessibilityNodeProvider(): AccessibilityNodeProvider {
        controller.setAccessibilityEnabled(true)
        scheduleFrame()
        return accessibility
    }

    override fun dispatchHoverEvent(event: MotionEvent): Boolean {
        if (accessibilityManager?.isTouchExplorationEnabled != true) return super.dispatchHoverEvent(event)
        when (event.actionMasked) {
            MotionEvent.ACTION_HOVER_ENTER, MotionEvent.ACTION_HOVER_MOVE -> accessibility.hover(event.x, event.y, exit = false)
            MotionEvent.ACTION_HOVER_EXIT -> accessibility.hover(event.x, event.y, exit = true)
            else -> return super.dispatchHoverEvent(event)
        }
        return true
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        val timestamp = event.eventTime / 1000.0
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN ->
                sendPointer(event, event.actionIndex, PHASE_DOWN, timestamp)
            MotionEvent.ACTION_MOVE ->
                for (index in 0 until event.pointerCount) sendPointer(event, index, PHASE_MOVE, timestamp)
            MotionEvent.ACTION_POINTER_UP ->
                sendPointer(event, event.actionIndex, PHASE_UP, timestamp)
            MotionEvent.ACTION_UP -> {
                sendPointer(event, event.actionIndex, PHASE_UP, timestamp)
                performClick()
            }
            MotionEvent.ACTION_CANCEL ->
                for (index in 0 until event.pointerCount) sendPointer(event, index, PHASE_CANCEL, timestamp)
            else -> return super.onTouchEvent(event)
        }
        return true
    }

    override fun performClick(): Boolean = super.performClick()

    private fun sendPointer(event: MotionEvent, index: Int, phase: Int, timestamp: Double) {
        val density = resources.displayMetrics.density
        controller.pointer(
            event.getPointerId(index).toLong(),
            phase,
            event.getX(index) / density,
            event.getY(index) / density,
            timestamp,
        )
    }

    private fun updateViewport() {
        if (surfaceWidth == 0 || surfaceHeight == 0) return
        val density = resources.displayMetrics.density
        controller.setViewport(
            Viewport(
                width = surfaceWidth / density,
                height = surfaceHeight / density,
                safeTop = insets[0] / density,
                safeRight = insets[1] / density,
                safeBottom = insets[2] / density,
                safeLeft = insets[3] / density,
                scale = density,
            ),
        )
    }

    /**
     * Sends the paywall the settings ABI 2 components read as `$context`; reduced motion also
     * settles the paywall's own transitions at once.
     */
    private fun postContext(configuration: Configuration) {
        val reducedMotion = Settings.Global.getFloat(
            context.contentResolver,
            Settings.Global.ANIMATOR_DURATION_SCALE,
            1f,
        ) == 0f
        val dark = configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
        val message = contextMessage(reducedMotion, dark, primaryLocale(configuration))
        if (message == postedContext) return
        postedContext = message
        controller.postMessage(message)
        scheduleFrame()
    }

    private fun scheduleFrame() {
        wakeHandler.removeCallbacks(wake)
        if (framePosted) return
        framePosted = true
        Choreographer.getInstance().postFrameCallback(frameCallback)
    }

    /** Draws the next frame at [atSeconds] (the [System.nanoTime] clock frames run on). */
    private fun scheduleWake(atSeconds: Double) {
        wakeHandler.removeCallbacks(wake)
        if (!atSeconds.isFinite()) return
        val delayMillis = ((atSeconds - System.nanoTime() / 1_000_000_000.0) * 1000.0).coerceAtLeast(0.0)
        wakeHandler.postDelayed(wake, ceil(delayMillis).toLong())
    }

    private fun stopFrames() {
        wakeHandler.removeCallbacks(wake)
        if (!framePosted) return
        framePosted = false
        Choreographer.getInstance().removeFrameCallback(frameCallback)
    }

    /** System bars and display cutout, in pixels: top, right, bottom, left. */
    private fun safeAreaInsets(windowInsets: WindowInsets): IntArray {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val safe = windowInsets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
            return intArrayOf(safe.top, safe.right, safe.bottom, safe.left)
        }
        @Suppress("DEPRECATION")
        val bars = intArrayOf(
            windowInsets.systemWindowInsetTop,
            windowInsets.systemWindowInsetRight,
            windowInsets.systemWindowInsetBottom,
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
}

/** The `context` envelope reporting the device's settings to the paywall. */
internal fun contextMessage(reducedMotion: Boolean, dark: Boolean, locale: String?): String {
    val payload = JSONObject()
        .put("reducedMotion", reducedMotion)
        .put("colorScheme", if (dark) "dark" else "light")
    locale?.let { payload.put("locale", it) }
    return JSONObject().put("version", 1).put("type", "context").put("payload", payload).toString()
}

/** The first preferred locale, as the SDK reports the device's locale. */
@Suppress("DEPRECATION")
private fun primaryLocale(configuration: Configuration): String? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        configuration.locales.takeIf { it.size() > 0 }?.get(0)?.toLanguageTag()
    } else {
        configuration.locale?.toLanguageTag()
    }
