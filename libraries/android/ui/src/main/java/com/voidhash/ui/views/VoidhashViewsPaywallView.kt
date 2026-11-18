@file:OptIn(ExperimentalNativeComponents::class)

package com.voidhash.ui.views

import android.content.Context
import android.content.res.Configuration
import android.database.ContentObserver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Base64
import android.util.AttributeSet
import android.graphics.RectF
import android.view.Choreographer
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.accessibility.AccessibilityEvent
import com.voidhash.ui.FlowClock
import com.voidhash.ui.KeyboardInsetObserver
import com.voidhash.ui.PredictiveBack
import com.voidhash.ui.PaywallImageLoader
import com.voidhash.ui.contextMessage
import com.voidhash.ui.darkTheme
import com.voidhash.ui.imageRequestUrl
import com.voidhash.ui.messageType
import com.voidhash.ui.primaryLocale
import com.voidhash.ui.reducedMotion
import com.voidhash.ui.safeAreaInsets
import java.io.File
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** Failed frames in a row after which a paywall counts as failed. */
private const val FAILED_FRAME_LIMIT = 3

/** Images larger than this on either side are decoded at a smaller size. */
private const val MAX_IMAGE_SIDE = 4096

/** How far a tap may move, in dp (views protocol, `text_tap_outside`). */
private const val TAP_SLOP = 10f

/**
 * Shows a flow-package paywall with Android's own views.
 *
 * The views core interprets and lays out the package; after every frame it hands the view the
 * operations that bring its subviews up to date, and the view draws them with
 * `android.graphics`, measures and draws text itself, scrolls with the platform's scroll views,
 * and serves accessibility services from its subviews. Touches reach the paywall's views through
 * Android's dispatch, so a parent the view is embedded in can take them over as usual. Load a package with [loadPackage] and exchange paywall bridge envelopes
 * through [postMessage] and [Listener.onMessage]. The view runs frames while the paywall
 * animates or something changed, and when a component's timer is due; an idle paywall runs none.
 * The window's system bars and display cutout become the paywall's safe area. The view reports
 * the device's locale, dark theme and Remove animations setting to the paywall, and again
 * whenever one changes while it is attached.
 *
 * The flow's text inputs are the platform's own [android.widget.EditText]s. While the keyboard is
 * shown, what the flow shows ends above it: the view reports the keyboard's height to the flow
 * on every step of its animation (Android 11 and later; before, as the window's insets change)
 * and scrolls the focused field into view. It expects a window that neither resizes nor pans
 * for the keyboard, as the SDK's presentation sets it up. Main thread only.
 *
 * Most apps never use the view directly: configure [VoidhashViewsPaywallRenderer] and the SDK
 * presents paywalls with it.
 */
class VoidhashViewsPaywallView internal constructor(
    context: Context,
    attrs: AttributeSet?,
    /** The registry of the renderer creating the view, whose components its flows show; `null` for none. */
    componentRegistry: ComponentRegistry?,
    /** The native components the app provides, by renderer: those [componentRegistry] holds. */
    private val components: Map<String, NativeComponentFactory>,
) : ViewGroup(context, attrs) {
    /** A view whose flows show no native component of the app's: each shows the fallback its flow defines. */
    @JvmOverloads
    constructor(context: Context, attrs: AttributeSet? = null) : this(context, attrs, null, emptyMap())

    /** Receives what the paywall reports, on the main thread. */
    interface Listener {
        /** A bridge envelope the paywall emitted (`ready`, `purchase`, `close`, …). */
        fun onMessage(message: String)

        /** A problem the paywall recovered from, such as an image that failed to load. */
        fun onWarning(message: String) {}

        /** The paywall cannot keep running and stopped. Reported once. */
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

    /** Renderers the flow showed that the app does not provide, each reported once. */
    private val missingComponents = HashSet<String>()

    /** Names of component events the core failed to take, each reported once. */
    private val failedComponentEvents = HashSet<String>()

    /** Keys of component props the core refused a write of, each reported once. */
    private val failedComponentWrites = HashSet<String>()

    /** Safe-area insets in pixels (top, right, bottom, left) used instead of the window's. */
    internal var safeAreaOverride: IntArray? = null
        set(value) {
            field = value
            updateViewport()
        }

    /**
     * Whether the flow's time stands still. While it is held, nothing in the flow that waits on
     * time moves on: an app call's timeout, a timed step, an animation. Touches still reach the
     * flow, at the held moment. When it is released, the flow's time runs on from where it stood.
     * Hosts that stand in for the app, such as a preview where a person answers app calls by
     * hand, hold it while the person answers. Main thread only.
     */
    var isClockHeld: Boolean
        get() = clock.isHeld
        set(value) {
            if (clock.hold(value)) scheduleFrame()
        }

    private val clock = FlowClock()

    /** Measures and draws text, for the core's layout and for the text views alike. */
    private val textSystem = TextSystem(FontRegistry(File(context.cacheDir, "voidhash-fonts")))
    private val nodeHost = Host()

    /** The tree the operations built. */
    internal val viewTree = ViewTree(context, nodeHost)
    /** Moves screens in and out, and the drags and back gestures that move them. */
    internal val transitions = TransitionCoordinator(this).apply {
        onDismissed = { screen -> screenEvent(screen.nodeId, "dismissed", closing = false) }
    }

    /** A completed predictive back gesture waits for the flow's answer to the `back` it posted. */
    private var awaitingBack = false

    /** Follows the predictive back gesture of the dialog presenting the view. */
    internal val predictiveBack = object : PredictiveBack {
        override fun started() {
            transitions.startBack()
        }

        override fun progressed(fraction: Float) = transitions.progressBack(fraction)

        override fun cancelled() = transitions.cancelBack()

        override fun invoked() {
            transitions.commitBack()
            awaitingBack = true
        }
    }
    private val textHost = ViewsTextHost(textSystem)
    private var handle = 0L
    private var failed = false
    private var released = false
    private var failedFrames = 0

    private val images = HashMap<String, Bitmap>()
    private val pendingImages = HashSet<String>()

    /** `data:` URLs whose image did not decode, reported once. */
    private val undecodableImages = HashSet<String>()

    /** Safe-area insets in pixels: top, right, bottom, left. */
    private var insets = intArrayOf(0, 0, 0, 0)

    /** The last `context` envelope sent, so unchanged settings are not sent again. */
    private var postedContext: String? = null
    private var lastPointerId = 0L

    private var framePosted = false

    /** Whether a frame is due at the next display refresh. */
    internal val runsFrames: Boolean get() = framePosted

    /** The text field that has the keyboard. */
    internal var focusedField: TextInputNodeView? = null
        private set

    /** How much of the view's bottom the keyboard covers, in dp. */
    internal var keyboardInset = 0f
        private set

    /** The focused field is kept clear of the keyboard after the next frame: the keyboard or the focus moved. */
    private var revealPending = false

    /** Where the pointer of a possible tap outside every text field went down, in pixels. */
    private var tapStart: Pair<Float, Float>? = null

    private val keyboard = KeyboardInsetObserver(
        view = this,
        onOverlap = { pixels -> keyboardInsetChanged(pixels / resources.displayMetrics.density) },
        onVisibility = { visible ->
            // An input method that hid itself while a field has it: the end user dismissed it.
            if (!visible) focusedField?.takeIf { it.field.isFocused }?.clearFieldFocus()
        },
    )

    /** Runs a frame when a component's timer is due while the paywall is otherwise idle. */
    private val wakeHandler = Handler(Looper.getMainLooper())
    private val wake = Runnable { scheduleFrame() }
    private val frameCallback = Choreographer.FrameCallback { frameTimeNanos ->
        framePosted = false
        val wantsNext = runFrame(clock.flowTime(frameTimeNanos / 1_000_000_000.0)) ?: return@FrameCallback
        if (wantsNext) {
            scheduleFrame()
        } else {
            scheduleWake(VoidhashViewsNative.nativeWakeTime(handle))
        }
    }

    /** "Remove animations" sets the animator duration scale to zero; nothing broadcasts it. */
    private val animationScaleObserver = object : ContentObserver(Handler(Looper.getMainLooper())) {
        override fun onChange(selfChange: Boolean) = postContext(resources.configuration)
    }

    init {
        clipChildren = true
        addView(viewTree.root)
        setOnApplyWindowInsetsListener { _, windowInsets ->
            insets = safeAreaInsets(windowInsets)
            updateViewport()
            keyboard.update()
            windowInsets
        }
        if (VoidhashViewsNative.isAvailable) {
            registerDefaultFonts()
            // The surface keeps a reference of its own to the registry.
            handle = componentRegistry?.withHandle { VoidhashViewsNative.nativeCreateSurface(textHost, it) }
                ?: VoidhashViewsNative.nativeCreateSurface(textHost, 0L)
        }
    }

    /** Shows the flow package [bytes], replacing the one shown before. */
    fun loadPackage(bytes: ByteArray) {
        if (failed || released) return
        if (handle == 0L) return fail("the views core is not available on this device")
        VoidhashViewsNative.nativeLoadPackage(handle, bytes)?.let { return fail("the paywall package could not be loaded: $it") }
        failedFrames = 0
        drainMessages()
        scheduleFrame()
    }

    /** Delivers a host → paywall bridge envelope (`configure`, `status`). */
    fun postMessage(message: String) {
        if (handle == 0L || released) return
        VoidhashViewsNative.nativePostMessage(handle, message)?.let { listener?.onWarning("The paywall rejected a message: $it") }
        scheduleFrame()
    }

    /** Stops the paywall for good and frees its core; the view shows nothing more afterwards. */
    fun release() {
        if (released) return
        released = true
        stopFrames()
        transitions.reset()
        viewTree.disposeComponents()
        destroyCore()
        images.clear()
    }

    private fun destroyCore() {
        if (handle != 0L) VoidhashViewsNative.nativeDestroy(handle)
        handle = 0L
    }

    /** The default font, which the core carries, registered for this view under `Inter`. */
    private fun registerDefaultFonts() {
        val directory = File(context.cacheDir, "voidhash-fonts")
        for (index in 0 until VoidhashViewsNative.nativeDefaultFontCount()) {
            val weight = VoidhashViewsNative.nativeDefaultFontWeight(index)
            val data = VoidhashViewsNative.nativeDefaultFont(index) ?: continue
            // Named by length too, so an SDK update with other files writes new ones.
            textSystem.fonts.register(FontRegistry.DEFAULT_FAMILY, File(directory, "inter-$weight-${data.size}.font"), data, weight)
        }
    }

    // Shared element flights are pictures of what the flow shows: no node of their own.
    override fun addChildrenForAccessibility(outChildren: ArrayList<View>) {
        val first = outChildren.size
        super.addChildrenForAccessibility(outChildren)
        removeHiddenForAccessibility(this, outChildren, first)
    }

    // region Layout and settings

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        setMeasuredDimension(
            getDefaultSize(suggestedMinimumWidth, widthMeasureSpec),
            getDefaultSize(suggestedMinimumHeight, heightMeasureSpec),
        )
    }

    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        val density = resources.displayMetrics.density
        viewTree.layoutRoot((r - l) / density, (b - t) / density)
        updateViewport()
        keyboard.update()
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        requestApplyInsets()
        context.contentResolver.registerContentObserver(
            Settings.Global.getUriFor(Settings.Global.ANIMATOR_DURATION_SCALE),
            false,
            animationScaleObserver,
        )
        postContext(resources.configuration)
        scheduleFrame()
    }

    override fun onDetachedFromWindow() {
        stopFrames()
        // No keyboard covers a view that is not on screen.
        keyboard.detached()
        context.contentResolver.unregisterContentObserver(animationScaleObserver)
        super.onDetachedFromWindow()
    }

    // Reaches the view only when the activity handles the change itself (`android:configChanges`
    // naming `uiMode` or `locale`); otherwise the view goes with its window.
    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        postContext(newConfig)
    }

    private fun updateViewport() {
        if (handle == 0L || width == 0 || height == 0) return
        val density = resources.displayMetrics.density
        val safe = safeAreaOverride ?: insets
        VoidhashViewsNative.nativeSetViewport(
            handle,
            width / density,
            height / density,
            safe[0] / density,
            safe[1] / density,
            safe[2] / density,
            safe[3] / density,
            density,
        )
        scheduleFrame()
    }

    /** Sends the paywall the settings ABI 2 components read as `$context`. */
    private fun postContext(configuration: Configuration) {
        val message = contextMessage(reducedMotion(context), darkTheme(configuration), primaryLocale(configuration))
        if (message == postedContext) return
        postedContext = message
        postMessage(message)
    }

    // endregion

    // region Frames

    private fun scheduleFrame() {
        wakeHandler.removeCallbacks(wake)
        if (framePosted || handle == 0L || failed) return
        framePosted = true
        Choreographer.getInstance().postFrameCallback(frameCallback)
    }

    /** Runs the next frame at [atSeconds] on the flow's clock; nothing falls due while it is held. */
    private fun scheduleWake(atSeconds: Double) {
        wakeHandler.removeCallbacks(wake)
        val delayMillis = clock.millisUntil(atSeconds) ?: return
        wakeHandler.postDelayed(wake, delayMillis)
    }

    private fun stopFrames() {
        wakeHandler.removeCallbacks(wake)
        if (!framePosted) return
        framePosted = false
        Choreographer.getInstance().removeFrameCallback(frameCallback)
    }

    /**
     * Runs one frame of the core at [timestamp] (seconds on the flow's clock), applies
     * its operations and handles its messages. Returns whether the core wants another frame, or
     * `null` when it runs none until something changes.
     *
     * One failed frame can be transient, so it runs again at the next display refresh;
     * [FAILED_FRAME_LIMIT] in a row fail the paywall.
     */
    internal fun runFrame(timestamp: Double): Boolean? {
        if (handle == 0L || failed) return null
        val flags = VoidhashViewsNative.nativeFrame(handle, timestamp)
        if (flags and ViewsFrameFlags.ERROR != 0) {
            val reason = VoidhashViewsNative.nativeLastError(handle) ?: "unknown error"
            failedFrames += 1
            if (failedFrames >= FAILED_FRAME_LIMIT) {
                fail("the paywall failed $FAILED_FRAME_LIMIT frames in a row: $reason")
                return null
            }
            if (failedFrames == 1) listener?.onWarning("The paywall failed a frame; running it again: $reason")
            return true
        }
        failedFrames = 0
        if (flags and ViewsFrameFlags.HAS_OPERATIONS != 0) applyOperations()
        if (flags and ViewsFrameFlags.HAS_MESSAGES != 0) drainMessages()
        if (revealPending) {
            revealPending = false
            revealFocusedField()
        }
        // The flow answers `back` in the first frame after it: a screen held by the gesture that
        // it did not close goes back.
        if (awaitingBack) {
            awaitingBack = false
            transitions.backAnswered()
        }
        if (handle == 0L || failed) return null
        return flags and ViewsFrameFlags.WANTS_NEXT_FRAME != 0
    }

    private fun applyOperations() {
        val bytes = VoidhashViewsNative.nativeTakeOperations(handle) ?: return
        val batch = try {
            OperationBatch.decode(bytes)
        } catch (error: OperationBatchException) {
            listener?.onWarning("The paywall's view operations could not be read: ${error.message}")
            return
        }
        val changes = viewTree.apply(batch.operations)
        val issues = batch.skipped + changes.issues
        if (issues.isNotEmpty()) listener?.onWarning("Paywall view operations skipped: ${issues.joinToString("; ")}")
        if (changes.reset) transitions.reset()
        for (screen in changes.deletedScreens) transitions.remove(screen)
        for (screen in changes.enteredScreens) transitions.enter(screen)
        for (screen in changes.closingScreens) {
            transitions.leave(screen) { screenEvent(screen.nodeId, "transitionEnd", closing = true) }
        }
        transitions.update(viewTree.screens)
        viewTree.updateAccessibility()
        transitions.moveAccessibilityFocus()
        if (changes.reset || changes.enteredScreens.isNotEmpty() || changes.closingScreens.isNotEmpty()) {
            sendAccessibilityEvent(AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED)
        }
    }

    private fun screenEvent(id: Int, event: String, closing: Boolean) {
        if (handle == 0L) return
        VoidhashViewsNative.nativeScreenEvent(handle, id, event, closing)?.let { listener?.onWarning("A screen transition was not taken: $it") }
        scheduleFrame()
    }

    private fun drainMessages() {
        while (handle != 0L) {
            val message = VoidhashViewsNative.nativeTakeMessage(handle) ?: return
            if (messageType(message) != "loadImage") {
                listener?.onMessage(message)
                continue
            }
            val url = imageRequestUrl(message)
            if (url == null) listener?.onWarning("Ignoring an image request without a URL") else loadImage(url)
        }
    }

    private fun fail(message: String) {
        if (failed) return
        failed = true
        stopFrames()
        listener?.onFailure(message)
    }

    // endregion

    // region Text fields and the keyboard

    /** Tells the flow how much of its bottom the keyboard covers, and keeps the focused field clear of it. */
    internal fun keyboardInsetChanged(height: Float) {
        if (height == keyboardInset) return
        keyboardInset = height
        revealPending = true
        if (handle == 0L) return
        VoidhashViewsNative.nativeSetKeyboardInset(handle, height)
        scheduleFrame()
    }

    /**
     * Watches every touch for a tap whose pointer went down on no `textInput` view, and reports
     * it before the views below see the tap's release, so before the press of the same tap.
     */
    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> tapStart = if (landsOnTextInput(event.x, event.y)) null else event.x to event.y
            MotionEvent.ACTION_POINTER_DOWN, MotionEvent.ACTION_CANCEL -> tapStart = null
            MotionEvent.ACTION_MOVE -> if (!withinTap(event)) tapStart = null
            MotionEvent.ACTION_UP -> {
                if (tapStart != null && withinTap(event)) tappedOutsideTextFields()
                tapStart = null
            }
        }
        return super.dispatchTouchEvent(event)
    }

    private fun withinTap(event: MotionEvent): Boolean {
        val (x, y) = tapStart ?: return false
        return hypot(event.x - x, event.y - y) <= TAP_SLOP * resources.displayMetrics.density
    }

    /** Whether a pointer going down at [x], [y] in this view's pixels lands on a text input. */
    private fun landsOnTextInput(x: Float, y: Float): Boolean {
        val root = viewTree.root
        val point = floatArrayOf(x, y)
        NodeView.toChild(this, root, point)
        var node = root.hitTest(point[0], point[1])
        while (node != null && node !is TextInputNodeView) node = node.parentNode
        return node != null
    }

    private fun tappedOutsideTextFields() {
        if (handle == 0L || focusedField?.field?.isFocused != true) return
        VoidhashViewsNative.nativeTextTapOutside(handle)
        scheduleFrame()
    }

    /**
     * Scrolls the focused field into view within its nearest vertical scroll view, above the
     * keyboard. The flow already ends its content at the keyboard's top, so this only moves a
     * scroll view's offset; nothing else avoids the keyboard.
     */
    internal fun revealFocusedField() {
        val field = focusedField?.takeIf { it.field.isFocused } ?: return
        var ancestor = field.parentNode
        while (ancestor != null && ancestor !is ScrollNodeView) ancestor = ancestor.parentNode
        val scrollNode = ancestor as? ScrollNodeView ?: return
        if (scrollNode.props["scrollDirection"]?.string == "horizontal") return
        val scroller = scrollNode.scroller
        val visible = frameInView(scroller)
        val bottom = min(visible.bottom, height - keyboardInset * resources.displayMetrics.density)
        val frame = frameInView(field)
        val delta = when {
            // Its bottom above the keyboard, unless that pushes its top out of view.
            frame.bottom > bottom -> min(frame.bottom - bottom, frame.top - visible.top)
            frame.top < visible.top -> frame.top - visible.top
            else -> 0f
        }
        if (delta == 0f) return
        val extent = scroller.getChildAt(0)?.height ?: return
        val maxOffset = max(0, extent - scroller.height)
        scroller.scrollTo(scroller.scrollX, (scroller.scrollY + delta).roundToInt().coerceIn(0, maxOffset))
    }

    /** [view]'s bounds in this view's pixels, through every position, scroll and transform in between. */
    private fun frameInView(view: View): RectF {
        val rect = RectF(0f, 0f, view.width.toFloat(), view.height.toFloat())
        var current: View = view
        while (current !== this) {
            if (!current.matrix.isIdentity) current.matrix.mapRect(rect)
            val parent = current.parent as? View ?: break
            rect.offset((current.left - parent.scrollX).toFloat(), (current.top - parent.scrollY).toFloat())
            current = parent
        }
        return rect
    }

    // endregion

    // region Images

    private fun loadImage(url: String) {
        if (images.containsKey(url)) return showLoadedImage(url)
        if (!pendingImages.add(url)) return
        val onResult: (Result<ByteArray>) -> Unit = { result ->
            result
                .onSuccess { bytes -> PaywallImageLoader.background({ decode(bytes) }) { decoded -> provideImage(url, decoded.getOrNull()) } }
                .onFailure { error ->
                    pendingImages.remove(url)
                    if (!released) listener?.onWarning("An image failed to load from $url: ${error.message}")
                }
        }
        if (imageSource?.invoke(url, onResult) != true) PaywallImageLoader.fetch(url, onResult)
    }

    private fun provideImage(url: String, image: Bitmap?) {
        pendingImages.remove(url)
        if (released) return
        if (image == null) {
            listener?.onWarning("The image from $url could not be shown: it is not an image Android decodes")
            // Not kept, here or by the host: fetched again it may be the image this time.
            imageRejected?.invoke(url)
            return
        }
        images[url] = image
        showLoadedImage(url)
    }

    /** Tells the core and every view showing [url] that it is loaded. */
    internal fun showLoadedImage(url: String) {
        if (handle == 0L) return
        VoidhashViewsNative.nativeImageLoaded(handle, url)
        viewTree.imageLoaded(url)
        scheduleFrame()
    }

    /** Hands the view an already decoded image, as if it had been loaded for [url]. */
    internal fun provideDecodedImage(url: String, image: Bitmap) = provideImage(url, image)

    // endregion

    /** What node views reach the core and the view's resources through. */
    private inner class Host : NodeHost {
        override val textSystem: TextSystem get() = this@VoidhashViewsPaywallView.textSystem

        override val density: Float get() = resources.displayMetrics.density

        override fun image(url: String): Bitmap? {
            images[url]?.let { return it }
            if (!url.startsWith("data:") || url in undecodableImages) return null
            // A `data:` URL carries its image: decoded here, once, with no request and no
            // image-loaded call.
            val image = dataUrlBytes(url)?.let(::decode)
            if (image == null) {
                undecodableImages.add(url)
                listener?.onWarning("Could not decode a paywall image from a data URL")
                return null
            }
            images[url] = image
            return image
        }

        override fun press(handler: Long) {
            if (handle == 0L) return
            VoidhashViewsNative.nativePress(handle, handler)
            scheduleFrame()
        }

        override fun pointer(handler: Long, pointerId: Long, phase: Int, x: Float, y: Float) {
            if (handle == 0L) return
            VoidhashViewsNative.nativePointer(handle, handler, pointerId, phase, x, y)
            scheduleFrame()
        }

        override fun newPointerId(): Long {
            lastPointerId += 1
            return lastPointerId
        }

        override fun accessibilityAction(handler: Long, name: String): Boolean {
            if (handle == 0L) return false
            val taken = VoidhashViewsNative.nativeAccessibilityAction(handle, handler, name)
            scheduleFrame()
            return taken
        }

        override fun textFocused(field: TextInputNodeView) {
            focusedField = field
            revealPending = true
            if (handle == 0L) return
            VoidhashViewsNative.nativeTextFocused(handle, field.nodeId)
            scheduleFrame()
        }

        override fun textBlurred(field: TextInputNodeView) {
            if (focusedField === field) focusedField = null
            if (handle == 0L) return
            // False when the surface already moved the keyboard on; nothing to do then.
            VoidhashViewsNative.nativeTextBlurred(handle, field.nodeId)
            scheduleFrame()
        }

        override fun textChanged(field: TextInputNodeView, state: TextFieldState, edit: TextEdit?, byUser: Boolean): Long? {
            if (handle == 0L) return null
            val revision = if (edit == null) {
                VoidhashViewsNative.nativeTextChanged(
                    handle,
                    field.nodeId,
                    state.text,
                    state.selectionBase,
                    state.selectionExtent,
                    state.composing,
                    byUser,
                )
            } else {
                VoidhashViewsNative.nativeTextEdited(
                    handle,
                    field.nodeId,
                    state.text,
                    state.selectionBase,
                    state.selectionExtent,
                    edit.start,
                    edit.end,
                    edit.inserted,
                    state.composing,
                    byUser,
                )
            }
            scheduleFrame()
            return revision.takeIf { it != -1L }
        }

        override fun textAction(field: TextInputNodeView, action: String) {
            if (handle == 0L) return
            VoidhashViewsNative.nativeTextAction(handle, field.nodeId, action)
            scheduleFrame()
        }

        override fun componentFactory(renderer: String): NativeComponentFactory? = components[renderer]

        override fun componentMissing(renderer: String) {
            if (!missingComponents.add(renderer)) return
            listener?.onWarning("The flow shows native component $renderer, which this app does not provide; it shows nothing in its place")
        }

        override fun componentEvent(nodeId: Int, name: String, payload: String) {
            if (handle == 0L) return
            // An event the flow takes no more (it ended, or the component stopped running) is
            // dropped. A failure is reported without its payload, which may hold the app's data.
            val result = VoidhashViewsNative.nativeDeliverComponentEvent(handle, nodeId, name, payload)
            if (result == VoidhashViewsNative.COMPONENT_EVENT_FAILED && failedComponentEvents.add(name)) {
                listener?.onWarning("The flow could not take the event \"$name\" of a native component; later failures of it are not reported")
            }
            scheduleFrame()
        }

        override fun componentWrite(nodeId: Int, key: String, value: String) {
            if (handle == 0L) return
            // A value the prop holds already, or one the flow no longer takes, changes nothing. A
            // refusal is reported without the value, which may hold the app's data.
            val result = VoidhashViewsNative.nativeWriteComponentProp(handle, nodeId, key, value)
            if (result == VoidhashViewsNative.COMPONENT_PROP_FAILED && failedComponentWrites.add(key)) {
                listener?.onWarning("The flow refused a native component's write of \"$key\"; later failures of it are not reported")
            }
            scheduleFrame()
        }

        override fun componentSize(nodeId: Int, width: Float, height: Float) {
            if (handle == 0L) return
            // False only for a view that shows no component of the app's any more, which a frame
            // deletes, or a size the measure never gives.
            VoidhashViewsNative.nativeSetComponentSize(handle, nodeId, width, height)
            scheduleFrame()
        }
    }

    internal companion object {
        /**
         * Decodes an image off the main thread, at most [MAX_IMAGE_SIDE] pixels on a side;
         * `null` when the bytes are not an image Android decodes.
         */
        fun decode(bytes: ByteArray): Bitmap? {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
            var sample = 1
            while (max(bounds.outWidth, bounds.outHeight) / sample > MAX_IMAGE_SIDE) sample *= 2
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
        }

        /**
         * The bytes a `data:` URL (RFC 2397) carries, base64 or percent-encoded; `null` when [url]
         * is not one or its payload is malformed.
         */
        fun dataUrlBytes(url: String): ByteArray? {
            if (!url.startsWith("data:")) return null
            val comma = url.indexOf(',')
            if (comma < 0) return null
            val base64 = url.substring(5, comma).split(';').any { it.equals("base64", ignoreCase = true) }
            val payload = percentDecoded(url.substring(comma + 1)) ?: return null
            if (!base64) return payload
            return try {
                Base64.decode(String(payload, Charsets.US_ASCII).filterNot(Char::isWhitespace), Base64.DEFAULT)
            } catch (error: IllegalArgumentException) {
                null
            }
        }

        /** [text]'s bytes with `%XX` escapes decoded; `null` for a malformed escape. */
        private fun percentDecoded(text: String): ByteArray? {
            val out = java.io.ByteArrayOutputStream(text.length)
            val bytes = text.toByteArray(Charsets.UTF_8)
            var at = 0
            while (at < bytes.size) {
                val byte = bytes[at]
                if (byte == '%'.code.toByte()) {
                    if (at + 2 >= bytes.size) return null
                    val high = Character.digit(bytes[at + 1].toInt(), 16)
                    val low = Character.digit(bytes[at + 2].toInt(), 16)
                    if (high < 0 || low < 0) return null
                    out.write(high shl 4 or low)
                    at += 3
                } else {
                    out.write(byte.toInt())
                    at += 1
                }
            }
            return out.toByteArray()
        }
    }
}
