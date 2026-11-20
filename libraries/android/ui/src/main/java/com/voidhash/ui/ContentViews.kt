package com.voidhash.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
import android.graphics.Rect
import android.graphics.RectF
import android.os.Build
import android.os.Bundle
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityManager
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityNodeProvider
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.ScrollView
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * A view group that only holds node views, laid out by their own frames, and hands touches to
 * them by the protocol's hit-testing (see [TouchDispatch]); it takes none itself.
 */
internal open class NodeHolder(context: Context) : ViewGroup(context) {
    private val touches = TouchDispatch(this)

    init {
        clipChildren = false
        clipToPadding = false
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) = setMeasuredDimension(width, height)

    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        for (index in 0 until childCount) (getChildAt(index) as? NodeView)?.applyFrame()
    }

    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
        val children = (0 until childCount).mapNotNull { getChildAt(it) as? NodeView }
        return touches.dispatch(event, { x, y -> NodeView.touchedChild(this, children, x, y)?.first }, null)
    }

    // A holder never intercepts touches; the request is for the views above it.
    override fun requestDisallowInterceptTouchEvent(disallowIntercept: Boolean) {
        parent?.requestDisallowInterceptTouchEvent(disallowIntercept)
    }
}

/**
 * A `text` view: draws its paragraph with the same layout the core measured. Its runs with
 * their own `onPress` take the taps on their characters, and are links of their own to
 * assistive technology, with the text around them in parts, as virtual views of the view (see
 * [LinkProvider]).
 */
internal class TextNodeView(context: Context, nodeId: Int, kind: NodeKind, host: NodeHost?) : NodeView(context, nodeId, kind, host) {
    /** The children of a text view are not shown. */
    private val hiddenChildren = NodeHolder(context).apply { visibility = INVISIBLE }

    /** A run with its own press handler: its UTF-16 range of the text, and the handler. */
    class PressableRun(val start: Int, val end: Int, val handler: Long)

    private val linkProvider = LinkProvider()

    init {
        addView(hiddenChildren)
    }

    override val contentHost: ViewGroup get() = hiddenChildren

    override fun hitTestChildren(x: Float, y: Float): NodeView? = null

    override val ownText: String? get() = props["text"]?.string

    /** The `textRuns` prop: each run's style, and its press handler. */
    private val runs: List<Pair<TextRun, Long?>>
        get() = props["textRuns"]?.array.orEmpty().mapNotNull { value ->
            val start = value["start"]?.number ?: return@mapNotNull null
            val end = value["end"]?.number ?: return@mapNotNull null
            if (start < 0 || end < start || end > Int.MAX_VALUE) return@mapNotNull null
            val run = TextRun(
                start = start.toInt(),
                end = end.toInt(),
                weight = value["fontWeight"]?.number?.toInt()?.coerceIn(1, 1000),
                italic = value["italic"]?.bool,
                color = value["color"]?.color,
                underline = value["underline"]?.bool == true,
                lineThrough = value["lineThrough"]?.bool == true,
            )
            run to value["onPress"]?.number?.takeIf { it >= 0 && it <= 4294967295.0 }?.toLong()
        }

    /** The runs a tap or assistive technology presses. */
    val pressableRuns: List<PressableRun>
        get() = runs.mapNotNull { (run, handler) -> handler?.let { PressableRun(run.start, run.end, it) } }

    override val takesPresses: Boolean get() = super.takesPresses || pressableRuns.isNotEmpty()

    /** A tap on a run with its own handler presses that; any other tap is the view's. */
    override fun pressHandler(x: Float, y: Float): Long? {
        val runs = pressableRuns
        if (runs.isNotEmpty()) {
            val box = textBox
            val offset = drawnLayout?.characterIndex(x - box.left, y - box.top, box.width())
            runs.firstOrNull { offset != null && offset >= it.start && offset < it.end }?.let { return it.handler }
        }
        return super.pressHandler(x, y)
    }

    /** The paragraph's style as layout measured it. */
    val textStyle: TextStyle
        get() {
            val size = (props["fontSize"]?.number ?: 14.0).toFloat()
            return TextStyle(
                family = props["fontFamily"]?.string.orEmpty(),
                size = size,
                weight = (props["fontWeight"]?.number ?: 400.0).toInt().coerceIn(1, 1000),
                italic = props["italic"]?.bool == true,
                lineHeight = props["lineHeight"]?.number?.toFloat() ?: (size * 1.2f),
                letterSpacing = (props["letterSpacing"]?.number ?: 0.0).toFloat(),
                alignment = when (props["textAlign"]?.string) {
                    "right" -> TextStyle.ALIGN_RIGHT
                    "center" -> TextStyle.ALIGN_CENTER
                    "justify" -> TextStyle.ALIGN_JUSTIFY
                    else -> TextStyle.ALIGN_LEFT
                },
                maxLines = props["numberOfLines"]?.number?.takeIf { it >= 1 }?.let { min(it, Int.MAX_VALUE.toDouble()).toInt() } ?: 0,
                runs = runs.map { it.first },
            )
        }

    /** Where the text box sits in the bounds, in pixels. */
    val textBox: RectF
        get() {
            val insets = props["textInsets"]?.numbers?.takeIf { it.size == 4 }?.map { it.toFloat() * density }
                ?: return RectF(0f, 0f, width.toFloat(), height.toFloat())
            return RectF(insets[3], insets[0], width - insets[1], height - insets[2])
        }

    /** The layout the view draws: the one measured for its text box (see [TextSystem.drawnLayout]). */
    val drawnLayout: TextLayout?
        get() {
            val host = host ?: return null
            val text = props["text"]?.string ?: return null
            val box = textBox
            return host.textSystem.drawnLayout(text, textStyle, max(0f, box.width()), max(0f, box.height()), host.density)
        }

    private val paint: TextPaint
        get() {
            val color = props["color"]?.color ?: 0xFF000000.toInt()
            val decoration = props["decoration"]?.takeIf { it["underline"]?.bool == true || it["lineThrough"]?.bool == true }
            val stroke = props["textStroke"]
            val shadow = props["textShadow"]
            return TextPaint(
                color = color,
                decoration = decoration?.let {
                    TextPaint.Decoration(
                        underline = it["underline"]?.bool == true,
                        lineThrough = it["lineThrough"]?.bool == true,
                        color = it["color"]?.color ?: color,
                        style = it["style"]?.string ?: "solid",
                    )
                },
                stroke = stroke?.get("width")?.number?.takeIf { it > 0 }?.let {
                    TextPaint.Stroke(it.toFloat(), stroke["color"]?.color ?: 0xFF000000.toInt())
                },
                shadow = shadow?.get("color")?.color?.let {
                    TextPaint.Shadow(
                        it,
                        (shadow["x"]?.number ?: 0.0).toFloat(),
                        (shadow["y"]?.number ?: 0.0).toFloat(),
                        (shadow["blur"]?.number ?: 0.0).toFloat(),
                    )
                },
            )
        }

    override fun refreshContent(change: Change) {
        if (change.touches(TEXT_KEYS + setOf("accessibilityLabel", "accessible", "onPress"))) linkProvider.textChanged()
    }

    override fun drawContent(canvas: Canvas) {
        val layout = drawnLayout ?: return
        val box = textBox
        layout.draw(canvas, box.left, box.top, box.width(), paint)
    }

    // region Links

    /** While runs take presses, the virtual views of its parts and links in front of the paragraph's node. */
    override fun getAccessibilityNodeProvider(): AccessibilityNodeProvider? =
        if (pressableRuns.isEmpty()) super.getAccessibilityNodeProvider() else linkProvider

    override fun dispatchHoverEvent(event: MotionEvent): Boolean =
        linkProvider.hover(event) || super.dispatchHoverEvent(event)

    /** While runs take presses, the view's own node only holds its parts and links, which read the text. */
    override fun onInitializeAccessibilityNodeInfo(info: AccessibilityNodeInfo) {
        super.onInitializeAccessibilityNodeInfo(info)
        if (pressableRuns.isEmpty()) return
        info.contentDescription = null
        info.isClickable = false
        info.isFocusable = false
        info.isCheckable = false
        info.rangeInfo = null
        info.removeAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_CLICK)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) info.hintText = null
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            info.isHeading = false
            info.isScreenReaderFocusable = false
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) info.stateDescription = null
    }

    /**
     * What assistive technology reads of a text view whose runs take presses, in reading order:
     * each pressable run is a link of its own, with the role `link`, labelled by its text,
     * framed by its glyphs (the union of their boxes when it wraps) and pressing the run; the
     * text between the links stays the view's, as parts that read and activate as the view. An
     * author's label reads as one part, before the links. The first part carries the view's
     * hint and value, so they are read once. Each is a virtual view of the text view.
     */
    inner class LinkProvider : AccessibilityNodeProvider() {
        /** The parts as last handed out, by virtual view id; rebuilt after the text changes. */
        private var parts: List<Part>? = null
        private var focused = HOST_VIEW_ID
        private var hovered = HOST_VIEW_ID

        /** A link when [run] is set, otherwise a stretch of the view's own text (or its label). */
        inner class Part(val run: PressableRun?, val label: String, val bounds: Rect, val first: Boolean)

        fun textChanged() {
            parts = null
        }

        /** The parts and links in reading order, each framed in the view's pixels. */
        fun parts(): List<Part> {
            parts?.let { return it }
            val text = props["text"]?.string.orEmpty()
            val layout = drawnLayout
            val box = textBox
            val built = ArrayList<Part>()
            fun frame(start: Int, end: Int): Rect? {
                val rects = layout?.rects(start, end, box.width()).orEmpty()
                if (rects.isEmpty()) return null
                val union = RectF(rects[0]).apply { for (rect in rects) union(rect) }
                union.offset(box.left, box.top)
                return Rect(floor(union.left).toInt(), floor(union.top).toInt(), ceil(union.right).toInt(), ceil(union.bottom).toInt())
            }
            val label = props["accessibilityLabel"]?.string
            val readsText = accessibleElement && label == null
            fun addPart(start: Int, end: Int) {
                val content = text.substring(start, end).trim()
                if (content.isEmpty()) return
                val bounds = frame(start, end) ?: return
                built.add(Part(null, content, bounds, first = built.none { it.run == null }))
            }
            if (accessibleElement && label != null) built.add(Part(null, label, Rect(0, 0, width, height), first = true))
            var cursor = 0
            for (run in pressableRuns.sortedBy { it.start }) {
                val start = run.start.coerceIn(cursor, text.length)
                val end = min(run.end, text.length)
                if (end <= start) continue
                val bounds = frame(start, end) ?: continue
                if (readsText && start > cursor) addPart(cursor, start)
                built.add(Part(run, text.substring(start, end), bounds, first = false))
                cursor = end
            }
            if (readsText && cursor < text.length) addPart(cursor, text.length)
            parts = built
            return built
        }

        override fun createAccessibilityNodeInfo(virtualViewId: Int): AccessibilityNodeInfo? {
            val view = this@TextNodeView
            if (virtualViewId == HOST_VIEW_ID) {
                val info = AccessibilityNodeInfo.obtain(view)
                onInitializeAccessibilityNodeInfo(info)
                for (index in parts().indices) info.addChild(view, index)
                return info
            }
            val part = parts().getOrNull(virtualViewId) ?: return null
            val info = AccessibilityNodeInfo.obtain(view, virtualViewId)
            info.packageName = context.packageName
            info.setParent(view)
            info.contentDescription = part.label
            if (part.run != null) {
                info.className = "android.widget.Button"
                info.extras.putCharSequence("AccessibilityNodeInfo.roleDescription", "link")
            } else {
                describePart(info, part)
            }
            @Suppress("DEPRECATION")
            info.setBoundsInParent(part.bounds)
            val location = IntArray(2)
            getLocationOnScreen(location)
            info.setBoundsInScreen(Rect(part.bounds).apply { offset(location[0], location[1]) })
            info.isVisibleToUser = isShown
            info.isEnabled = part.run != null || props["accessibilityState"]?.get("disabled")?.bool != true
            info.isFocusable = true
            if (part.run != null || handler("onPress") != null) {
                info.isClickable = true
                info.addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_CLICK)
            }
            if (focused == virtualViewId) {
                info.isAccessibilityFocused = true
                info.addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_CLEAR_ACCESSIBILITY_FOCUS)
            } else {
                info.addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_ACCESSIBILITY_FOCUS)
            }
            return info
        }

        /** A part of the view's own text reads with the view's role; the first also with its hint and value. */
        private fun describePart(info: AccessibilityNodeInfo, part: Part) {
            info.className = accessibilityClassName
            val role = props["accessibilityRole"]?.string
            if (role == "header" && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.isHeading = true
            if (!part.first) return
            props["accessibilityHint"]?.string?.let { hint ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) info.hintText = hint
            }
            accessibilityValue(props["accessibilityValue"], props["accessibilityState"])?.let { value ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    info.stateDescription = value
                } else {
                    info.contentDescription = "${part.label}, $value"
                }
            }
        }

        override fun performAction(virtualViewId: Int, action: Int, arguments: Bundle?): Boolean {
            if (virtualViewId == HOST_VIEW_ID) return performAccessibilityAction(action, arguments)
            val part = parts().getOrNull(virtualViewId) ?: return false
            return when (action) {
                AccessibilityNodeInfo.ACTION_CLICK -> {
                    val host = host ?: return false
                    val run = part.run
                    if (run != null) {
                        host.press(run.handler)
                    } else {
                        host.press(handler("onPress") ?: return false)
                    }
                    send(virtualViewId, AccessibilityEvent.TYPE_VIEW_CLICKED)
                    true
                }
                AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS -> {
                    if (focused == virtualViewId) return false
                    if (focused != HOST_VIEW_ID) send(focused, AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUS_CLEARED)
                    focused = virtualViewId
                    invalidate()
                    send(virtualViewId, AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUSED)
                    true
                }
                AccessibilityNodeInfo.ACTION_CLEAR_ACCESSIBILITY_FOCUS -> {
                    if (focused != virtualViewId) return false
                    focused = HOST_VIEW_ID
                    invalidate()
                    send(virtualViewId, AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUS_CLEARED)
                    true
                }
                else -> false
            }
        }

        /** Touch exploration over a part or a link reports it as hovered, so assistive technology focuses it. */
        fun hover(event: MotionEvent): Boolean {
            val manager = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager
            if (manager?.isEnabled != true || manager.isTouchExplorationEnabled.not() || pressableRuns.isEmpty()) return false
            val target = when (event.actionMasked) {
                MotionEvent.ACTION_HOVER_ENTER, MotionEvent.ACTION_HOVER_MOVE ->
                    parts().indexOfFirst { it.bounds.contains(event.x.toInt(), event.y.toInt()) }.takeIf { it >= 0 } ?: HOST_VIEW_ID
                else -> HOST_VIEW_ID
            }
            if (target != hovered) {
                val previous = hovered
                hovered = target
                if (target != HOST_VIEW_ID) send(target, AccessibilityEvent.TYPE_VIEW_HOVER_ENTER)
                if (previous != HOST_VIEW_ID) send(previous, AccessibilityEvent.TYPE_VIEW_HOVER_EXIT)
            }
            return target != HOST_VIEW_ID
        }

        private fun send(virtualViewId: Int, type: Int) {
            val manager = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager
            // Android refuses an event on the main thread while no service listens.
            if (manager?.isEnabled != true) return
            val parent = parent ?: return
            val part = parts().getOrNull(virtualViewId)
            val event = AccessibilityEvent.obtain(type)
            event.packageName = context.packageName
            event.className = if (part?.run != null) "android.widget.Button" else accessibilityClassName
            event.setSource(this@TextNodeView, virtualViewId)
            part?.let { event.contentDescription = it.label }
            parent.requestSendAccessibilityEvent(this@TextNodeView, event)
        }
    }

    // endregion

    private companion object {
        /** The props the paragraph is laid out and drawn from. */
        val TEXT_KEYS = setOf(
            "text", "fontFamily", "fontSize", "fontWeight", "italic", "lineHeight", "letterSpacing", "textAlign",
            "numberOfLines", "textInsets", "textRuns",
        )
    }
}

/** An `image` view: the loaded image in its resize mode, optionally tinted, clipped to the view's corners. */
internal class ImageNodeView(context: Context, nodeId: Int, kind: NodeKind, host: NodeHost?) : NodeView(context, nodeId, kind, host) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)

    /** Whether the image is loaded and shown. */
    val showsImage: Boolean get() = props["source"]?.string?.let { host?.image(it) } != null

    override fun imageLoaded(url: String) {
        if (props["source"]?.string == url) invalidate()
    }

    override fun drawContent(canvas: Canvas) {
        val url = props["source"]?.string ?: return
        val image = host?.image(url) ?: return
        val width = width.toFloat()
        val height = height.toFloat()
        if (width <= 0f || height <= 0f || image.width <= 0 || image.height <= 0) return
        val imageWidth = image.width.toFloat()
        val imageHeight = image.height.toFloat()
        val target = when (props["resizeMode"]?.string) {
            "cover", "contain" -> {
                val fit = if (props["resizeMode"]?.string == "cover") {
                    max(width / imageWidth, height / imageHeight)
                } else {
                    min(width / imageWidth, height / imageHeight)
                }
                centered(imageWidth * fit, imageHeight * fit, width, height)
            }
            // The image's pixels as logical pixels, as the engine sizes it.
            "center" -> centered(imageWidth * density, imageHeight * density, width, height)
            else -> RectF(0f, 0f, width, height)
        }
        paint.colorFilter = props["tintColor"]?.color?.let { PorterDuffColorFilter(it, PorterDuff.Mode.SRC_IN) }
        val saved = canvas.save()
        canvas.clipPath(decoration.shapePath)
        canvas.drawBitmap(image, null, target, paint)
        canvas.restoreToCount(saved)
    }

    private fun centered(width: Float, height: Float, boxWidth: Float, boxHeight: Float) =
        RectF((boxWidth - width) / 2, (boxHeight - height) / 2, (boxWidth + width) / 2, (boxHeight + height) / 2)
}

/**
 * A `path` view: SVG path data stretched from its view box to the frame, filled or stroked, with
 * its stroke's caps and joins, and trimmed to part of its outline.
 *
 * Style transitions change the colour, width and trim on every frame, so the geometry is parsed
 * and measured once per path, view box and size, and a trim only cuts the measured outline.
 */
internal class PathNodeView(context: Context, nodeId: Int, kind: NodeKind, host: NodeHost?) : NodeView(context, nodeId, kind, host) {
    private var parsed: Pair<String, Path>? = null

    /** The path stretched to the frame, and what it was stretched from. */
    internal var outline: PathOutline? = null
        private set
    private var outlineKey: List<Any?>? = null

    /** The path drawn, and the trim it was cut at (`null`: untrimmed). */
    private var shown: Path? = null
    private var shownTrim: Pair<Float, Float>? = null
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)

    /** The path the view draws, in its own pixels. */
    val shownPath: Path? get() = shown

    override fun refreshContent(change: Change) {
        val data = props["path"]?.string.orEmpty()
        val viewBox = props["viewBox"]?.numbers?.takeIf { it.size == 2 }
        val key = listOf(data, viewBox, width, height, density)
        var outline = outline
        if (outline == null || key != outlineKey) {
            val path = parsed?.takeIf { it.first == data }?.second ?: SvgPath.parse(data).also { parsed = data to it }
            val scaleX = viewBox?.get(0)?.takeIf { it > 0 }?.let { width / it.toFloat() } ?: density
            val scaleY = viewBox?.get(1)?.takeIf { it > 0 }?.let { height / it.toFloat() } ?: density
            val scaled = Path()
            path.transform(Matrix().apply { setScale(scaleX, scaleY) }, scaled)
            outline = PathOutline(scaled)
            this.outline = outline
            outlineKey = key
            shown = null
        }
        val start = props["pathTrimStart"]?.number
        val end = props["pathTrimEnd"]?.number
        val trim = if (start != null || end != null) {
            (start ?: 0.0).coerceIn(0.0, 1.0).toFloat() to (end ?: 1.0).coerceIn(0.0, 1.0).toFloat()
        } else {
            null
        }
        if (shown == null || trim != shownTrim) {
            shown = trim?.let { outline.trimmed(it.first, it.second) } ?: outline.path
            shownTrim = trim
        }
        paint.color = props["pathColor"]?.color ?: 0xFF000000.toInt()
        if (props["pathStyle"]?.string == "stroke") {
            paint.style = Paint.Style.STROKE
            paint.strokeWidth = (props["pathStrokeWidth"]?.number ?: 1.0).toFloat() * density
            paint.strokeCap = when (props["pathStrokeCap"]?.string) {
                "round" -> Paint.Cap.ROUND
                "square" -> Paint.Cap.SQUARE
                else -> Paint.Cap.BUTT
            }
            paint.strokeJoin = when (props["pathStrokeJoin"]?.string) {
                "round" -> Paint.Join.ROUND
                "bevel" -> Paint.Join.BEVEL
                else -> Paint.Join.MITER
            }
        } else {
            paint.style = Paint.Style.FILL
        }
    }

    override fun drawContent(canvas: Canvas) {
        shown?.let { canvas.drawPath(it, paint) }
    }
}

/**
 * A `scrollView`: the platform's own [ScrollView] or [HorizontalScrollView] along
 * `scrollDirection`, holding a content view of `contentSize` in which the subviews sit at their
 * frames. Offset, flings, edge effects, the scroll bar, wheel and keyboard scrolling,
 * accessibility scroll actions and nested scrolling are the platform's.
 */
internal class ScrollNodeView(context: Context, nodeId: Int, kind: NodeKind, host: NodeHost?) : NodeView(context, nodeId, kind, host) {
    private val content = ScrollContent(context)
    /** The platform scroll view. */
    var scroller: FrameLayout = scroller(horizontal = false)
        private set

    init {
        addView(scroller)
    }

    override val contentHost: ViewGroup get() = content

    override val clipsWithContainer: Boolean get() = false

    private fun scroller(horizontal: Boolean): FrameLayout =
        (if (horizontal) HorizontalScrollView(context) else ScrollView(context)).apply {
            isNestedScrollingEnabled = true
            addView(content)
        }

    override fun refreshContent(change: Change) {
        if (!change.touches(setOf("scrollDirection", "showsIndicator", "contentSize"))) return
        val horizontal = props["scrollDirection"]?.string == "horizontal"
        if (horizontal != (scroller is HorizontalScrollView)) {
            scroller.removeView(content)
            removeView(scroller)
            scroller = scroller(horizontal)
            addView(scroller)
        }
        val indicator = props["showsIndicator"]?.bool != false
        scroller.isVerticalScrollBarEnabled = indicator && !horizontal
        scroller.isHorizontalScrollBarEnabled = indicator && horizontal
        val size = props["contentSize"]?.numbers?.takeIf { it.size == 2 }
        // At least the viewport, so that every point in it reaches the content.
        content.extentWidth = max(width, ((size?.get(0) ?: 0.0) * density).roundToInt())
        content.extentHeight = max(height, ((size?.get(1) ?: 0.0) * density).roundToInt())
        layoutScroller()
    }

    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) = layoutScroller()

    private fun layoutScroller() {
        // Measured again for a changed extent, without asking the views above for a layout.
        content.forceLayout()
        scroller.forceLayout()
        scroller.measure(MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY))
        scroller.layout(0, 0, width, height)
    }

    /** The scroll view takes a touch anywhere in its bounds, its subviews only there. */
    override fun touchTarget(x: Float, y: Float): View? {
        if (pointerEvents == "box-only" || !inside(x, y)) return null
        if (pointerEvents == "box-none" && hitTestChildren(x, y) == null) return null
        return scroller
    }

    override fun hitTestChildren(x: Float, y: Float): NodeView? {
        if (!inside(x, y)) return null
        val point = floatArrayOf(x, y)
        toChild(this, scroller, point)
        toChild(scroller, content, point)
        return touchedChild(content, childNodes, point[0], point[1])?.second
    }

    override fun dispatchDraw(canvas: Canvas) {
        val saved = canvas.save()
        canvas.clipPath(decoration.shapePath)
        super.dispatchDraw(canvas)
        canvas.restoreToCount(saved)
    }

    /** The scrolled content: [extentWidth] × [extentHeight] pixels, holding the subviews. */
    private class ScrollContent(context: Context) : NodeHolder(context) {
        var extentWidth = 0
        var extentHeight = 0

        override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) = setMeasuredDimension(extentWidth, extentHeight)
    }
}
