@file:OptIn(ExperimentalNativeComponents::class)

package com.voidhash.ui

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BlendMode
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.RenderEffect
import android.graphics.Shader
import android.os.Build
import android.os.Bundle
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.accessibility.AccessibilityNodeInfo
import java.text.NumberFormat
import kotlin.math.atan2
import kotlin.math.hypot
import kotlin.math.roundToInt

/** The node kinds of batch version 1 (views protocol, "Node kinds"). */
internal enum class NodeKind(val code: Int) {
    VIEW(1),
    TEXT(2),
    PRESSABLE(3),
    SAFE_AREA(4),
    SCROLL_VIEW(5),
    PATH(6),
    IMAGE(7),
    EXTERNAL(8),
    TEXT_INPUT(9),
    STACK(10),
    SCREEN(11),
    ;

    companion object {
        /** The kind of [code]; a kind this host does not know shows a plain view. */
        fun of(code: Int): NodeKind = values().firstOrNull { it.code == code } ?: VIEW
    }
}

/** What node views need from the view hosting the tree: shared resources, and the way back to the core. */
internal interface NodeHost {
    val textSystem: TextSystem

    /** Device pixels per logical pixel. */
    val density: Float

    /** A loaded image, `null` until it is. */
    fun image(url: String): Bitmap?

    fun press(handler: Long)

    /** Reports a raw pointer event to [handler], at [x], [y] in the view's logical pixels. */
    fun pointer(handler: Long, pointerId: Long, phase: Int, x: Float, y: Float)

    /** An id for a pointer that went down, never reported before. */
    fun newPointerId(): Long

    fun accessibilityAction(handler: Long, name: String): Boolean

    /** The platform gave [field] the keyboard. */
    fun textFocused(field: TextInputNodeView)

    /** The platform took the keyboard from [field] and gave it to no other field. */
    fun textBlurred(field: TextInputNodeView)

    /**
     * [field] changed to [state], by [edit] when the platform named it (`text_edited`), else by
     * an edit it did not name or a moved selection (`text_changed`); returns its revision after
     * the change, `null` when the core has no such field.
     */
    fun textChanged(field: TextInputNodeView, state: TextFieldState, edit: TextEdit?, byUser: Boolean): Long?

    /** [field]'s return key, as `text_action` names it. */
    fun textAction(field: TextInputNodeView, action: String)

    /** The factory the app provides native component [renderer] with, or `null`. */
    fun componentFactory(renderer: String): NativeComponentFactory?

    /** An `external` view names [renderer], which the app does not provide: it shows nothing. */
    fun componentMissing(renderer: String)

    /** The native component of `external` view [nodeId] emitted [name] with [payload], a JSON object. */
    fun componentEvent(nodeId: Int, name: String, payload: String)

    /** The native component of `external` view [nodeId] wrote its prop [key], [value] the new value's JSON. */
    fun componentWrite(nodeId: Int, key: String, value: String)

    /**
     * The native component of `external` view [nodeId] wants [width] × [height] in logical
     * pixels; `NaN` leaves an axis to the layout.
     */
    fun componentSize(nodeId: Int, width: Float, height: Float)
}

/**
 * One view of the tree: frame, transform, opacity, decoration, clipping, hit-testing and
 * accessibility. Kinds with their own content subclass it.
 *
 * Frames arrive in logical pixels and are laid out in device pixels; the transform's pivot is the
 * view's top-left corner, as the protocol defines it. Children may draw outside their bounds
 * (shadows, outlines, overflow) unless a view `clips`. Touches travel through Android's dispatch;
 * each view hands them to the subview [hitTest] picks (see [TouchDispatch]), so that subviews
 * outside a parent's bounds take touches as on the web.
 */
internal open class NodeView(context: Context, val nodeId: Int, val kind: NodeKind, val host: NodeHost?) : ViewGroup(context) {
    val props = HashMap<String, PropValue>()

    /** The frame in the parent, before the transform. */
    var nodeFrame: ViewFrame = ViewFrame.ZERO
        private set

    /** Subviews in paint order. */
    val childNodes = ArrayList<NodeView>()
    var parentNode: NodeView? = null

    protected val decoration = BoxDecoration()

    /** What a live region last read, to announce only changes. */
    var spokenLiveText: String? = null

    /** The `accessibilityActions` ids handed to assistive technology, by action name. */
    private var actionIds = emptyMap<Int, String>()

    /** Prop keys merged since the last [refresh], and whether it is the first. */
    private val pendingKeys = HashSet<String>()
    private var pendingEverything = true

    /**
     * What changed on the view, so that a refresh rebuilds only that: style transitions change
     * a few props on every frame.
     */
    class Change(private val keys: Set<String>, private val resized: Boolean, private val everything: Boolean) {
        /** Whether any of [keys] changed, or the size when [orSize]. */
        fun touches(keys: Set<String>, orSize: Boolean = true): Boolean =
            everything || (orSize && resized) || keys.any { it in this.keys }

        companion object {
            /** Only the size changed. */
            val RESIZED = Change(emptySet(), resized = true, everything = false)
        }
    }

    /** Screen transitions' part of the view's state, over what its props say. */
    var navigation = NavigationState()
        private set

    /** The drags and backdrop taps of a presentation's host, which see its touches first. */
    var screenGestures: ScreenGestures? = null

    /** The translation the `transform` prop asks for, in pixels, before [navigation]'s offset. */
    private var transformX = 0f
    private var transformY = 0f
    private var dimPaint: Paint? = null

    /**
     * What screen transitions set on a view (a screen, a presentation's stack, a shared
     * element), kept apart from its props so a batch's [refresh] does not undo it. Offsets are
     * logical pixels.
     */
    data class NavigationState(
        /** Moves the view after its `transform`. */
        val offsetX: Float = 0f,
        val offsetY: Float = 0f,
        /** Multiplies its `opacity`. */
        val alpha: Float = 1f,
        /** A presentation's backdrop: black at this opacity over the view, under its subviews. */
        val dim: Float = 0f,
        /** Another screen covers it, or it is on its way out: it takes no touches. */
        val covered: Boolean = false,
        /** The screen covering it hides it from assistive technology. */
        val hiddenFromAccessibility: Boolean = false,
        /** A shared element whose flight shows in its place. */
        val hiddenForFlight: Boolean = false,
    )

    init {
        setWillNotDraw(false)
        clipChildren = false
        clipToPadding = false
        pivotX = 0f
        pivotY = 0f
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    }

    /** Where subviews go. */
    open val contentHost: ViewGroup get() = this

    protected val density: Float get() = host?.density ?: resources.displayMetrics.density

    // region Operations

    /** Merges a `PROPS` delta; `null` returns a key to its default. */
    fun merge(delta: Map<String, PropValue>) {
        for ((key, value) in delta) {
            if (value == PropValue.Null || value == PropValue.Undefined) props.remove(key) else props[key] = value
        }
        pendingKeys.addAll(delta.keys)
    }

    fun place(frame: ViewFrame) {
        nodeFrame = frame.sanitized()
    }

    /** Makes [children] the subviews, in this order; subviews not listed leave the view but stay alive. */
    fun setChildren(children: List<NodeView>) {
        for (old in childNodes) {
            if (old.parentNode === this && children.none { it === old }) {
                (old.parent as? ViewGroup)?.removeViewInLayout(old)
                old.parentNode = null
            }
        }
        for (child in children) {
            val previous = child.parentNode
            if (previous != null && previous !== this) previous.childNodes.removeAll { it === child }
            child.parentNode = this
        }
        childNodes.clear()
        childNodes.addAll(children)
        placeChildren()
    }

    /** Puts the subviews into [contentHost] in paint order. */
    private fun placeChildren() {
        val host = contentHost
        val current = (0 until host.childCount).map { host.getChildAt(it) }
        if (current.size == childNodes.size && current.indices.all { current[it] === childNodes[it] }) return
        host.removeAllViewsInLayout()
        for (child in childNodes) {
            (child.parent as? ViewGroup)?.removeViewInLayout(child)
            host.addView(child, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT))
            child.applyFrame()
        }
        host.invalidate()
    }

    /** Called when the view leaves the tree for good. */
    fun detachFromParent() {
        parentNode?.childNodes?.removeAll { it === this }
        parentNode = null
        (parent as? ViewGroup)?.removeViewInLayout(this)
    }

    // endregion

    // region Applying props and frames

    /**
     * Applies the props and frame after a batch changed them, rebuilding only what the changed
     * props feed; a changed size rebuilds through [onSizeChanged] while the frame is applied.
     */
    fun refresh() {
        val change = Change(HashSet(pendingKeys), resized = false, everything = pendingEverything)
        pendingKeys.clear()
        pendingEverything = false
        applyFrame()
        if (change.touches(setOf("transform"))) applyTransform()
        applyNavigation()
        if (change.touches(DECORATION_KEYS)) decoration.update(props, width.toFloat(), height.toFloat(), density)
        if (change.touches(setOf("layerBlur", "blendMode"))) applyLayerEffects()
        refreshContent(change)
        invalidate()
    }

    fun setNavigation(change: NavigationState.() -> NavigationState) {
        val state = navigation.change()
        if (state == navigation) return
        val redraw = state.dim != navigation.dim
        navigation = state
        applyNavigation()
        if (redraw) invalidate()
    }

    private fun applyNavigation() {
        translationX = transformX + navigation.offsetX * density
        translationY = transformY + navigation.offsetY * density
        alpha = (props["opacity"]?.number ?: 1.0).toFloat().coerceIn(0f, 1f) * navigation.alpha
        visibility = if (props["hidden"]?.bool == true || navigation.hiddenForFlight) INVISIBLE else VISIBLE
    }

    /** Kind-specific content; called at the end of [refresh] with what changed, and when the size changes. */
    open fun refreshContent(change: Change) {}

    /** An image this view may show finished loading. */
    open fun imageLoaded(url: String) {}

    /** The border box with its corners, in pixels. */
    val shape: RoundedRect get() = decoration.shape

    /** Lays the view out at its frame, in device pixels. */
    fun applyFrame() {
        val frame = nodeFrame
        val scale = density
        val left = (frame.x * scale).roundToInt()
        val top = (frame.y * scale).roundToInt()
        val right = ((frame.x + frame.width) * scale).roundToInt()
        val bottom = ((frame.y + frame.height) * scale).roundToInt()
        if (left != this.left || top != this.top || right != this.right || bottom != this.bottom || isLayoutRequested) {
            layout(left, top, right, bottom)
        }
    }

    /**
     * `transform` `[a, b, c, d, tx, ty]` as translation, rotation and scale about the top-left
     * corner; a negative scale is a flip, and skew is dropped.
     */
    private fun applyTransform() {
        val values = props["transform"]?.numbers?.takeIf { it.size == 6 }
        if (values == null) {
            transformX = 0f
            transformY = 0f
            rotation = 0f
            scaleX = 1f
            scaleY = 1f
            return
        }
        val (a, b, c, d) = values
        val determinant = a * d - b * c
        // A mirrored transform flips on x, so a flip shows as a flip rather than a half turn.
        val scaleX = if (determinant < 0) -hypot(a, b) else hypot(a, b)
        val angle = if (scaleX != 0.0) atan2(b / scaleX, a / scaleX) else 0.0
        val scaleY = if (scaleX != 0.0) determinant / scaleX else d
        transformX = values[4].toFloat() * density
        transformY = values[5].toFloat() * density
        rotation = Math.toDegrees(angle).toFloat()
        this.scaleX = scaleX.toFloat()
        this.scaleY = scaleY.toFloat()
    }

    /**
     * `layerBlur` (API 31) and `blendMode` (API 29; before it the modes Porter-Duff has),
     * both through the view's layer.
     */
    private fun applyLayerEffects() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val sigma = (props["layerBlur"]?.number ?: 0.0).toFloat() * density
            setRenderEffect(
                if (sigma > 0f) {
                    val radius = BoxDecoration.blurMaskRadius(sigma * 2).coerceAtLeast(0.01f)
                    RenderEffect.createBlurEffect(radius, radius, Shader.TileMode.DECAL)
                } else {
                    null
                },
            )
        }
        val paint = blendPaint(props["blendMode"]?.string)
        if (paint != null) {
            setLayerType(LAYER_TYPE_HARDWARE, paint)
        } else if (layerType != LAYER_TYPE_NONE) {
            setLayerType(LAYER_TYPE_NONE, null)
        }
    }

    // endregion

    // region Drawing

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        setMeasuredDimension(width, height)
    }

    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        val host = contentHost
        if (host !== this) host.layout(0, 0, r - l, b - t)
        for (index in 0 until host.childCount) (host.getChildAt(index) as? NodeView)?.applyFrame()
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        decoration.update(props, w.toFloat(), h.toFloat(), density)
        refreshContent(Change.RESIZED)
    }

    override fun onDraw(canvas: Canvas) {
        decoration.draw(canvas)
        drawContent(canvas)
        if (navigation.dim > 0f) {
            val paint = dimPaint ?: Paint().also { dimPaint = it }
            paint.color = Color.argb((navigation.dim.coerceIn(0f, 1f) * 255).roundToInt(), 0, 0, 0)
            canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
        }
    }

    /** Kind-specific drawing over the decoration and below the subviews. */
    protected open fun drawContent(canvas: Canvas) {}

    override fun dispatchDraw(canvas: Canvas) {
        if (props["clips"]?.bool == true && clipsWithContainer) {
            val saved = canvas.save()
            canvas.clipPath(decoration.shapePath)
            super.dispatchDraw(canvas)
            canvas.restoreToCount(saved)
        } else {
            super.dispatchDraw(canvas)
        }
    }

    /** Whether `clips` clips the subviews here; a scroll view clips its content itself. */
    protected open val clipsWithContainer: Boolean get() = true

    // endregion

    // region Hit-testing

    /** `pointerEvents`: `none`, `box-none`, `box-only` or `null` for auto. */
    val pointerEvents: String? get() = props["pointerEvents"]?.string

    /**
     * The deepest view taking a touch at [x], [y] in this view's pixels, by the protocol's rules:
     * a transparent view still takes touches, subviews outside the bounds take them unless the
     * view clips, and `pointerEvents` limits who does.
     */
    open fun hitTest(x: Float, y: Float): NodeView? {
        if (visibility != VISIBLE || pointerEvents == "none" || navigation.covered) return null
        val within = inside(x, y)
        if (pointerEvents != "box-only" && (within || props["clips"]?.bool != true)) {
            hitTestChildren(x, y)?.let { return it }
        }
        if (pointerEvents == "box-none") return null
        return if (within) this else null
    }

    /** The deepest view under the topmost subview the point hits. */
    protected open fun hitTestChildren(x: Float, y: Float): NodeView? {
        val host = contentHost
        val point = floatArrayOf(x, y)
        if (host !== this) toChild(this, host, point)
        return touchedChild(host, childNodes, point[0], point[1])?.second
    }

    protected fun inside(x: Float, y: Float) = x >= 0 && y >= 0 && x < width && y < height

    // endregion

    // region Touches

    private val touches = TouchDispatch(this)

    /** The pointers the view takes itself, with the ids reported for them. */
    private val ownPointers = HashMap<Int, Long>()

    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
        val gestures = screenGestures ?: return touches.dispatch(event, ::touchTarget, ::ownTouch)
        if (gestures.takes(event)) {
            // Taken from the subviews midway, as a parent's interception does.
            touches.cancel(event, ::ownTouch)
            return true
        }
        return touches.dispatch(event, ::touchTarget, ::ownTouch) || gestures.follows
    }

    /**
     * The subview a pointer going down at [x], [y] in this view's pixels goes to: the topmost
     * one [hitTest] finds the point in. The view's parent only hands it pointers it hit-tests.
     */
    protected open fun touchTarget(x: Float, y: Float): View? {
        if (contentHost !== this || pointerEvents == "box-only") return null
        if (!inside(x, y) && props["clips"]?.bool == true) return null
        return touchedChild(this, childNodes, x, y)?.first
    }

    /**
     * Takes the pointers no subview took when the view has `onPress` or `onPointer`: reports
     * them to `onPointer`, and a pointer lifted inside the view as a press.
     */
    private fun ownTouch(event: MotionEvent): Boolean {
        val host = host ?: return false
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN -> {
                if (handler("onPointer") == null && !takesPresses) return false
                val index = event.actionIndex
                val id = host.newPointerId()
                ownPointers[event.getPointerId(index)] = id
                reportPointer(id, PHASE_DOWN, event.getX(index), event.getY(index))
            }
            MotionEvent.ACTION_MOVE -> for (index in 0 until event.pointerCount) {
                ownPointers[event.getPointerId(index)]?.let { reportPointer(it, PHASE_MOVE, event.getX(index), event.getY(index)) }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_POINTER_UP -> {
                val index = event.actionIndex
                val id = ownPointers.remove(event.getPointerId(index)) ?: return true
                val x = event.getX(index)
                val y = event.getY(index)
                reportPointer(id, PHASE_UP, x, y)
                // A tap: lifted inside the view, not cancelled by a scroll view or the system.
                if (inside(x, y)) pressHandler(x, y)?.let(host::press)
            }
            MotionEvent.ACTION_CANCEL -> {
                for ((pointer, id) in ownPointers) {
                    val index = event.findPointerIndex(pointer)
                    reportPointer(id, PHASE_CANCEL, if (index >= 0) event.getX(index) else 0f, if (index >= 0) event.getY(index) else 0f)
                }
                ownPointers.clear()
            }
        }
        return true
    }

    /** Whether a tap on the view may press a handler. */
    protected open val takesPresses: Boolean get() = handler("onPress") != null

    /** The handler a tap at [x], [y] in the view's pixels presses. */
    open fun pressHandler(x: Float, y: Float): Long? = handler("onPress")

    private fun reportPointer(id: Long, phase: Int, x: Float, y: Float) {
        val handler = handler("onPointer") ?: return
        host?.pointer(handler, id, phase, x / density, y / density)
    }

    // A node view never intercepts touches; the request is for the views above it, and for a
    // presentation's drag.
    override fun requestDisallowInterceptTouchEvent(disallowIntercept: Boolean) {
        screenGestures?.disallowIntercept(disallowIntercept)
        parent?.requestDisallowInterceptTouchEvent(disallowIntercept)
    }

    // A presentation's host is the nested scrolling parent of the scroll views in it, which
    // move the sheet before they scroll; other views pass nested scrolling on to their parents.
    override fun onStartNestedScroll(child: View, target: View, nestedScrollAxes: Int): Boolean =
        screenGestures?.startNestedScroll(nestedScrollAxes) == true

    override fun onNestedPreScroll(target: View, dx: Int, dy: Int, consumed: IntArray) {
        screenGestures?.nestedPreScroll(target, dy, consumed)
    }

    override fun onNestedPreFling(target: View, velocityX: Float, velocityY: Float): Boolean =
        screenGestures?.nestedPreFling() == true

    override fun onStopNestedScroll(child: View) {
        screenGestures?.stopNestedScroll()
        super.onStopNestedScroll(child)
    }

    // endregion

    // region Accessibility

    /**
     * Whether assistive technology sees the view as one element, by React Native's rules: as
     * `accessible` says, else text and pressables are, other views are not.
     */
    val accessibleElement: Boolean
        get() = props["accessible"]?.bool ?: (
            kind == NodeKind.TEXT || kind == NodeKind.TEXT_INPUT || kind == NodeKind.PRESSABLE || props["onPress"] != null
            )

    override fun addChildrenForAccessibility(outChildren: ArrayList<View>) {
        val first = outChildren.size
        super.addChildrenForAccessibility(outChildren)
        removeHiddenForAccessibility(this, outChildren, first)
    }

    /**
     * Whether the view, an element, holds a developer's native component whose views stay
     * accessibility nodes after it (`accessibilityKeepsComponents`); any other element is one
     * node, its subviews hidden.
     */
    val keepsComponents: Boolean get() = accessibleElement && props["accessibilityKeepsComponents"]?.bool == true

    /** Text the view itself shows. */
    open val ownText: String? get() = null

    /** What the view reads as: its label, or the text it and its subviews show. */
    val spokenText: String?
        get() {
            props["accessibilityLabel"]?.string?.let { return it }
            val parts = ArrayList<String>()
            ownText?.takeIf { it.isNotEmpty() }?.let(parts::add)
            for (child in childNodes) {
                if (child.visibility != VISIBLE || child.props["accessibilityElementsHidden"]?.bool == true) continue
                child.spokenText?.takeIf { it.isNotEmpty() }?.let(parts::add)
            }
            return if (parts.isEmpty()) null else parts.joinToString(" ")
        }

    /** The handler a prop names, or `null`. */
    fun handler(key: String): Long? = props[key]?.number?.takeIf { it >= 0 && it <= 4294967295.0 }?.toLong()

    private fun declaredActions(): List<Pair<String, String?>> =
        props["accessibilityActions"]?.array.orEmpty().mapNotNull { action ->
            action["name"]?.string?.let { it to action["label"]?.string }
        }

    override fun getAccessibilityClassName(): CharSequence = when (props["accessibilityRole"]?.string) {
        "button", "togglebutton", "imagebutton", "link", "menuitem", "tab" -> "android.widget.Button"
        "checkbox" -> "android.widget.CheckBox"
        "radio" -> "android.widget.RadioButton"
        "switch" -> "android.widget.Switch"
        "adjustable" -> "android.widget.SeekBar"
        "image" -> "android.widget.ImageView"
        "search" -> "android.widget.EditText"
        "tablist" -> "android.widget.TabWidget"
        else -> if (kind == NodeKind.TEXT) "android.widget.TextView" else "android.view.View"
    }

    override fun onInitializeAccessibilityNodeInfo(info: AccessibilityNodeInfo) {
        super.onInitializeAccessibilityNodeInfo(info)
        val role = props["accessibilityRole"]?.string
        val state = props["accessibilityState"]
        info.contentDescription = if (accessibleElement) spokenText else props["accessibilityLabel"]?.string
        props["accessibilityHint"]?.string?.let { hint ->
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) info.hintText = hint
        }
        if (role == "header" && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.isHeading = true
        if (role == "link" && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            info.extras.putCharSequence("AccessibilityNodeInfo.roleDescription", "link")
        }
        info.isEnabled = state?.get("disabled")?.bool != true
        // A radio button's checked state is also its selection, as on iOS.
        info.isSelected = state?.get("selected")?.bool == true || role == "radio" && state?.get("checked")?.bool == true
        // A checkable node's state is the platform's to announce, so the value leaves it out.
        val checkable = state?.get("checked") is PropValue.Bool
        if (checkable) {
            info.isCheckable = true
            info.isChecked = state?.get("checked")?.bool == true
        }
        accessibilityValue(props["accessibilityValue"], state, announcesChecked = !checkable)?.let { value ->
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                info.stateDescription = value
            } else {
                info.contentDescription = listOfNotNull(info.contentDescription, value).joinToString(", ")
            }
        }
        val value = props["accessibilityValue"]
        val now = value?.get("now")?.number
        val min = value?.get("min")?.number
        val max = value?.get("max")?.number
        if (now != null && min != null && max != null && max > min) {
            info.rangeInfo = AccessibilityNodeInfo.RangeInfo.obtain(
                AccessibilityNodeInfo.RangeInfo.RANGE_TYPE_FLOAT,
                min.toFloat(),
                max.toFloat(),
                now.toFloat(),
            )
        }
        if (handler("onPress") != null) {
            info.isClickable = true
            info.addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_CLICK)
        }
        // An element its component's nodes follow is still one stop of its own.
        if (keepsComponents && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.isScreenReaderFocusable = true
        val ids = HashMap<Int, String>()
        if (role == "adjustable") {
            // Moved by assistive technology although the runtime declared no actions.
            ids[AccessibilityNodeInfo.ACTION_SCROLL_FORWARD] = "increment"
            ids[AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD] = "decrement"
            info.addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_FORWARD)
            info.addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_BACKWARD)
        }
        var custom = 0
        for ((name, label) in declaredActions()) {
            val standard = when (name) {
                "activate" -> AccessibilityNodeInfo.AccessibilityAction.ACTION_CLICK
                "increment" -> AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_FORWARD
                "decrement" -> AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_BACKWARD
                "longpress" -> AccessibilityNodeInfo.AccessibilityAction.ACTION_LONG_CLICK
                else -> null
            }
            if (standard != null) {
                ids[standard.id] = name
                info.addAction(standard)
            } else {
                val id = CUSTOM_ACTION_BASE + custom
                custom += 1
                ids[id] = name
                info.addAction(AccessibilityNodeInfo.AccessibilityAction(id, label ?: name))
            }
        }
        actionIds = ids
    }

    override fun performAccessibilityAction(action: Int, arguments: Bundle?): Boolean {
        val host = host ?: return super.performAccessibilityAction(action, arguments)
        if (action == AccessibilityNodeInfo.ACTION_CLICK) {
            handler("onPress")?.let {
                host.press(it)
                return true
            }
        }
        val name = actionIds[action] ?: declaredName(action) ?: return super.performAccessibilityAction(action, arguments)
        val handler = handler("onAccessibilityAction") ?: return false
        return host.accessibilityAction(handler, name)
    }

    /**
     * The action a standard action id stands for, before the node info was asked for: a
     * declared one, or `increment` and `decrement` of an `adjustable` element.
     */
    private fun declaredName(action: Int): String? {
        val name = when (action) {
            AccessibilityNodeInfo.ACTION_CLICK -> "activate"
            AccessibilityNodeInfo.ACTION_SCROLL_FORWARD -> "increment"
            AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD -> "decrement"
            AccessibilityNodeInfo.ACTION_LONG_CLICK -> "longpress"
            else -> return null
        }
        val adjusts = (name == "increment" || name == "decrement") && props["accessibilityRole"]?.string == "adjustable"
        return name.takeIf { declared -> adjusts || declaredActions().any { it.first == declared } }
    }

    // endregion

    companion object {
        /**
         * The topmost of [children], subviews of [group] in paint order, that takes a touch at
         * [x], [y] in [group]'s pixels, with the deepest view under it that does.
         */
        fun touchedChild(group: ViewGroup, children: List<NodeView>, x: Float, y: Float): Pair<NodeView, NodeView>? {
            for (child in children.asReversed()) {
                if (child.parent !== group) continue
                val local = floatArrayOf(x, y)
                toChild(group, child, local)
                child.hitTest(local[0], local[1])?.let { return child to it }
            }
            return null
        }

        /**
         * The first id of the accessibility actions a flow declares beyond the standard ones,
         * clear of the standard actions' bits and of framework resource ids.
         */
        private const val CUSTOM_ACTION_BASE = 0x56480000

        /**
         * Maps [point] from [parent]'s coordinates (pixels, before its own scroll) into [child]'s,
         * through the child's position, the parent's scroll and the child's transform.
         */
        fun toChild(parent: View, child: View, point: FloatArray) {
            point[0] += parent.scrollX - child.left
            point[1] += parent.scrollY - child.top
            val matrix = child.matrix
            if (!matrix.isIdentity) {
                val inverse = Matrix()
                if (matrix.invert(inverse)) inverse.mapPoints(point)
            }
        }

        /** The props the decoration paints from. */
        private val DECORATION_KEYS = setOf(
            "backgroundColor", "backgroundGradient", "borderWidths", "borderColors", "borderStyle",
            "cornerRadii", "shadows", "outline",
        )

        /**
         * `accessibilityValue` (its text, or `now` as a percentage of `min`…`max`), followed by the
         * checked state when [announcesChecked] and the expanded state, as React Native reads them.
         */
        fun accessibilityValue(value: PropValue?, state: PropValue?, announcesChecked: Boolean = true): String? {
            val parts = ArrayList<String>()
            val text = value?.get("text")?.string
            val now = value?.get("now")?.number
            if (text != null) {
                parts.add(text)
            } else if (now != null) {
                val min = value?.get("min")?.number
                val max = value?.get("max")?.number
                parts.add(
                    if (min != null && max != null && max > min) {
                        NumberFormat.getPercentInstance().format((now - min) / (max - min))
                    } else {
                        NumberFormat.getNumberInstance().format(now)
                    },
                )
            }
            when (val checked = state?.get("checked")) {
                is PropValue.Bool -> if (announcesChecked) parts.add(if (checked.value) "checked" else "unchecked")
                is PropValue.Text -> if (checked.value == "mixed") parts.add("mixed")
                else -> {}
            }
            state?.get("expanded")?.bool?.let { parts.add(if (it) "expanded" else "collapsed") }
            return if (parts.isEmpty()) null else parts.joinToString(", ")
        }

        /**
         * The layer paint of a CSS `mix-blend-mode` keyword: every mode from API 29, the
         * Porter-Duff ones before it; `null` for `normal` and unknown modes.
         */
        fun blendPaint(mode: String?): Paint? {
            mode ?: return null
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val blend = when (mode) {
                    "multiply" -> BlendMode.MULTIPLY
                    "screen" -> BlendMode.SCREEN
                    "overlay" -> BlendMode.OVERLAY
                    "darken" -> BlendMode.DARKEN
                    "lighten" -> BlendMode.LIGHTEN
                    "color-dodge" -> BlendMode.COLOR_DODGE
                    "color-burn" -> BlendMode.COLOR_BURN
                    "hard-light" -> BlendMode.HARD_LIGHT
                    "soft-light" -> BlendMode.SOFT_LIGHT
                    "difference" -> BlendMode.DIFFERENCE
                    "exclusion" -> BlendMode.EXCLUSION
                    "hue" -> BlendMode.HUE
                    "saturation" -> BlendMode.SATURATION
                    "color" -> BlendMode.COLOR
                    "luminosity" -> BlendMode.LUMINOSITY
                    "plus-lighter" -> BlendMode.PLUS
                    else -> return null
                }
                return Paint().apply { blendMode = blend }
            }
            val porterDuff = when (mode) {
                "multiply" -> PorterDuff.Mode.MULTIPLY
                "screen" -> PorterDuff.Mode.SCREEN
                "overlay" -> PorterDuff.Mode.OVERLAY
                "darken" -> PorterDuff.Mode.DARKEN
                "lighten" -> PorterDuff.Mode.LIGHTEN
                "plus-lighter" -> PorterDuff.Mode.ADD
                else -> return null
            }
            return Paint().apply { xfermode = PorterDuffXfermode(porterDuff) }
        }
    }
}

/**
 * Removes from [children], from index [first] on, the views [parent] listed for accessibility
 * that are, or lie inside, a view hiding its descendants from assistive technology. The platform
 * lists every shown child to a service that asks for views not important for accessibility (as
 * tools reading the node tree do), whatever their importance; this keeps what the flow hides (a
 * covered screen, a closing or hidden view) out of the tree for every service.
 */
internal fun removeHiddenForAccessibility(parent: View, children: ArrayList<View>, first: Int) {
    for (index in children.size - 1 downTo first) {
        var view: View? = children[index]
        while (view != null && view !== parent) {
            if (view.importantForAccessibility == View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS) {
                children.removeAt(index)
                break
            }
            view = view.parent as? View
        }
    }
}
