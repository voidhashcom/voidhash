package com.voidhash.ui

import android.view.Surface
import org.json.JSONException
import org.json.JSONObject

/** Logical viewport of a paywall surface: sizes and safe-area insets in dp, [scale] the density. */
internal data class Viewport(
    val width: Float,
    val height: Float,
    val safeTop: Float,
    val safeRight: Float,
    val safeBottom: Float,
    val safeLeft: Float,
    val scale: Float,
)

/** One native renderer instance, bound to the surface it was created for. */
internal interface SurfaceRenderer {
    /** Returns `null` on success, otherwise the error. */
    fun loadPackage(bytes: ByteArray): String?

    /** Returns `null` on success, otherwise the error. */
    fun postMessage(message: String): String?

    /** Returns `null` on success, otherwise the error. */
    fun provideImage(url: String, bytes: ByteArray): String?

    fun setViewport(viewport: Viewport)

    fun pointer(pointerId: Long, phase: Int, x: Float, y: Float, timestampSeconds: Double)

    /** Returns the [FrameFlags] of the frame. */
    fun frame(timestampSeconds: Double): Int

    /** When the renderer next needs a frame although the last one wanted none; see [VoidhashUiNative.nativeWakeTime]. */
    fun wakeTime(): Double

    fun takeMessage(): String?

    fun setAccessibilityEnabled(enabled: Boolean)

    /** The accessibility tree as JSON if it changed, otherwise `null`. */
    fun takeSemantics(): String?

    /** Returns `null` on success, otherwise the error. */
    fun accessibilityAction(nodeId: Int, action: String): String?

    /** Releases the renderer; nothing may be called on it afterwards. */
    fun destroy()
}

/** [SurfaceRenderer] over the native library. */
internal class JniSurfaceRenderer private constructor(private val handle: Long) : SurfaceRenderer {
    override fun loadPackage(bytes: ByteArray) = VoidhashUiNative.nativeLoadPackage(handle, bytes)

    override fun postMessage(message: String) = VoidhashUiNative.nativePostMessage(handle, message)

    override fun provideImage(url: String, bytes: ByteArray) =
        VoidhashUiNative.nativeProvideImage(handle, url, bytes)

    override fun setViewport(viewport: Viewport) = VoidhashUiNative.nativeSetViewport(
        handle,
        viewport.width,
        viewport.height,
        viewport.safeTop,
        viewport.safeRight,
        viewport.safeBottom,
        viewport.safeLeft,
        viewport.scale,
    )

    override fun pointer(pointerId: Long, phase: Int, x: Float, y: Float, timestampSeconds: Double) =
        VoidhashUiNative.nativePointer(handle, pointerId, phase, x, y, timestampSeconds)

    override fun frame(timestampSeconds: Double) = VoidhashUiNative.nativeFrame(handle, timestampSeconds)

    override fun wakeTime() = VoidhashUiNative.nativeWakeTime(handle)

    override fun takeMessage() = VoidhashUiNative.nativeTakeMessage(handle)

    override fun setAccessibilityEnabled(enabled: Boolean) =
        VoidhashUiNative.nativeSetAccessibilityEnabled(handle, enabled)

    override fun takeSemantics() = VoidhashUiNative.nativeTakeSemantics(handle)

    override fun accessibilityAction(nodeId: Int, action: String) =
        VoidhashUiNative.nativeAccessibilityAction(handle, nodeId, action)

    override fun destroy() = VoidhashUiNative.nativeDestroy(handle)

    companion object {
        /** A renderer drawing into [surface], or `null` when the native library cannot provide one. */
        fun create(surface: Surface): SurfaceRenderer? {
            if (!VoidhashUiNative.isAvailable) return null
            val handle = VoidhashUiNative.nativeCreate(surface)
            return if (handle == 0L) null else JniSurfaceRenderer(handle)
        }
    }
}

/** When a view draws its next frame. */
internal sealed interface FrameOutcome {
    /** At the next display refresh: something is animating or changed. */
    data object NextFrame : FrameOutcome

    /**
     * Once something changes, or at [wakeAtSeconds] when a component's timer is due (seconds on
     * the clock of the frame timestamps; infinite when nothing is scheduled).
     */
    data class Idle(val wakeAtSeconds: Double) : FrameOutcome

    /** Not until a renderer is attached again. */
    data object Stopped : FrameOutcome
}

/** Failed frames in a row after which a paywall counts as failed. */
internal const val FAILED_FRAME_LIMIT = 3

/**
 * Keeps a paywall alive across the surfaces it is drawn into.
 *
 * A native renderer lives exactly as long as its surface, which Android destroys whenever the
 * window goes to the background, and the paywall's runtime lives in the renderer: a new surface
 * gets a new runtime, which starts at the paywall's first screen and reports `ready` again. The
 * controller gives it what it holds — the package, the viewport, the latest `context` and `status`
 * envelopes, the images already downloaded, and the latest `configure` unless the host sends one
 * for every renderer (see [replayConfigure]) — and routes the paywall's messages: `loadImage`
 * is answered here, everything else goes to [onMessage]. Main thread only.
 *
 * @param createRenderer binds a renderer to a surface; `null` when it cannot.
 * @param fetchImage downloads an image and reports the outcome on the main thread.
 * @param onFailure the paywall cannot keep running; reported once, after which the controller
 *   is inert.
 * @param onSemantics the paywall's accessibility tree changed (JSON, see [PaywallAccessibility]).
 * @param requestFrame something changed that the next frame must show: input, a message, the
 *   viewport, an image that arrived. The view draws frames only while there is something to show.
 * @param onImageRejected the renderer could not use the image fetched for a URL: it is not one
 *   it decodes. Whoever keeps images for later should drop this one.
 */
internal class PaywallSurfaceController(
    private val createRenderer: (Surface) -> SurfaceRenderer?,
    private val fetchImage: (url: String, onResult: (Result<ByteArray>) -> Unit) -> Unit,
    private val onMessage: (String) -> Unit,
    private val onWarning: (String) -> Unit,
    private val onFailure: (String) -> Unit,
    private val onSemantics: (String) -> Unit = {},
    private val requestFrame: () -> Unit = {},
    private val onImageRejected: (url: String) -> Unit = {},
) {
    private var renderer: SurfaceRenderer? = null
    private var flowPackage: ByteArray? = null
    private var viewport: Viewport? = null
    private var lastConfigure: String? = null
    private var lastContext: String? = null
    private var lastStatus: String? = null
    private val images = HashMap<String, ByteArray>()
    private val pendingImages = HashSet<String>()
    private var failed = false
    private var released = false
    private var accessibilityEnabled = false

    /** Whether a renderer was ever attached. */
    private var hadRenderer = false

    /** Frames of the current renderer that failed since the last one it drew. */
    private var failedFrames = 0

    /**
     * Whether a new renderer gets the last `configure` again. That one carries the state the
     * paywall was presented with, so a host that saves the paywall's `state` turns this off and
     * answers each renderer's `ready` with a `configure` of its own: replayed, the old one would
     * put the paywall back where it started, and its next `state` would overwrite what was saved
     * since. Then only a `configure` posted before the first surface exists waits for it.
     */
    var replayConfigure = true

    /** Whether a renderer is bound to a surface. */
    val isAttached: Boolean get() = renderer != null

    /** Shows [bytes], now or once a surface exists. */
    fun loadPackage(bytes: ByteArray) {
        flowPackage = bytes
        val current = renderer ?: return
        current.loadPackage(bytes)?.let { return fail("the paywall package could not be loaded: $it") }
        requestFrame()
    }

    /** Delivers a host → paywall envelope, now or once a surface exists. */
    fun postMessage(message: String) {
        // A renderer created later only needs the latest configuration, device settings and
        // status to catch up. The view always sends every device setting, so the latest suffices.
        when (messageType(message)) {
            "configure" -> when {
                replayConfigure || renderer == null && !hadRenderer -> lastConfigure = message
                // The next renderer's `ready` asks the host for one of its own.
                renderer == null -> return
            }
            "context" -> lastContext = message
            "status" -> lastStatus = message
        }
        val current = renderer ?: return
        current.postMessage(message)?.let { onWarning("The paywall rejected a message: $it") }
        requestFrame()
    }

    /** Binds a new renderer to [surface] and replays the paywall's state into it. */
    fun attach(surface: Surface) {
        if (failed || released) return
        detach()
        val created = createRenderer(surface) ?: return fail("no renderer could be created for the surface")
        renderer = created
        hadRenderer = true
        failedFrames = 0
        viewport?.let(created::setViewport)
        if (accessibilityEnabled) created.setAccessibilityEnabled(true)
        flowPackage?.let { bytes ->
            created.loadPackage(bytes)?.let { return fail("the paywall package could not be loaded: $it") }
        }
        val configure = lastConfigure
        if (!replayConfigure) lastConfigure = null
        for (message in listOfNotNull(configure, lastContext, lastStatus)) {
            created.postMessage(message)?.let { onWarning("The paywall rejected a message: $it") }
        }
        requestFrame()
    }

    /** Destroys the renderer, before its surface goes away. The paywall's state is kept. */
    fun detach() {
        renderer?.destroy()
        renderer = null
    }

    fun setViewport(value: Viewport) {
        if (value == viewport) return
        viewport = value
        val current = renderer ?: return
        current.setViewport(value)
        requestFrame()
    }

    fun pointer(pointerId: Long, phase: Int, x: Float, y: Float, timestampSeconds: Double) {
        val current = renderer ?: return
        current.pointer(pointerId, phase, x, y, timestampSeconds)
        requestFrame()
    }

    /** Builds the accessibility tree only while assistive technology needs it. */
    fun setAccessibilityEnabled(enabled: Boolean) {
        if (enabled == accessibilityEnabled) return
        accessibilityEnabled = enabled
        val current = renderer ?: return
        current.setAccessibilityEnabled(enabled)
        requestFrame()
    }

    /** Performs an accessibility action on a node of the tree reported to `onSemantics`. */
    fun accessibilityAction(nodeId: Int, action: String): Boolean {
        val current = renderer ?: return false
        current.accessibilityAction(nodeId, action)?.let {
            onWarning("An accessibility action failed: $it")
            return false
        }
        requestFrame()
        return true
    }

    /**
     * Draws a frame and routes the messages it produced; returns when to draw the next.
     *
     * One failed frame can be transient — the surface could not be acquired in time, or was lost
     * or outdated — so it is drawn again at the next display refresh. [FAILED_FRAME_LIMIT] in a
     * row fail the paywall: one that keeps failing shows nothing new and takes no input, its own
     * close control included.
     */
    fun frame(timestampSeconds: Double): FrameOutcome {
        val current = renderer ?: return FrameOutcome.Stopped
        val flags = current.frame(timestampSeconds)
        if (flags and FrameFlags.ERROR != 0) {
            failedFrames += 1
            if (failedFrames >= FAILED_FRAME_LIMIT) {
                fail("the paywall failed to draw $FAILED_FRAME_LIMIT frames in a row")
                return FrameOutcome.Stopped
            }
            if (failedFrames == 1) onWarning("The paywall failed to draw a frame; drawing it again")
            return FrameOutcome.NextFrame
        }
        failedFrames = 0
        if (flags and FrameFlags.HAS_MESSAGES != 0) {
            while (renderer === current) {
                route(current.takeMessage() ?: break)
            }
        }
        if (flags and FrameFlags.HAS_SEMANTICS != 0 && renderer === current) {
            current.takeSemantics()?.let(onSemantics)
        }
        return when {
            renderer !== current -> FrameOutcome.Stopped
            flags and FrameFlags.WANTS_NEXT_FRAME != 0 -> FrameOutcome.NextFrame
            else -> FrameOutcome.Idle(current.wakeTime())
        }
    }

    /** Ends the paywall for good. */
    fun release() {
        released = true
        detach()
        images.clear()
    }

    private fun route(message: String) {
        if (messageType(message) != "loadImage") {
            onMessage(message)
            return
        }
        val url = try {
            JSONObject(message).getJSONObject("payload").getString("url")
        } catch (error: JSONException) {
            onWarning("Ignoring an image request without a URL")
            return
        }
        images[url]?.let { return provideImage(url, it) }
        if (!pendingImages.add(url)) return
        fetchImage(url) { result ->
            pendingImages.remove(url)
            if (released) return@fetchImage
            result
                .onSuccess { bytes ->
                    images[url] = bytes
                    provideImage(url, bytes)
                }
                .onFailure { error -> onWarning("An image failed to load from $url: ${error.message}") }
        }
    }

    private fun provideImage(url: String, bytes: ByteArray) {
        val current = renderer ?: return
        current.provideImage(url, bytes)?.let { error ->
            onWarning("The image from $url could not be shown: $error")
            // Not kept, here or by the host: given again it fails again, where fetched again it
            // may be the image this time.
            images.remove(url)
            onImageRejected(url)
            return
        }
        requestFrame()
    }

    private fun fail(message: String) {
        if (failed) return
        failed = true
        detach()
        onFailure(message)
    }

    private fun messageType(message: String): String? = try {
        JSONObject(message).optString("type")
    } catch (error: JSONException) {
        null
    }
}
