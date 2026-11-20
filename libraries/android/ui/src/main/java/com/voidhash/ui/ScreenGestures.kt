package com.voidhash.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.view.MotionEvent
import android.view.VelocityTracker
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewGroup
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * The touches of one presentation's host (a modal, sheet or dialog), turned into the
 * coordinator's drags and backdrop taps. The host sees each of its touches before its subviews
 * ([NodeView.dispatchTouchEvent]) and the nested scrolling of the scroll views inside it:
 *
 * - a modal or sheet drags vertically by its stack: a touch outside a vertical scroll view is
 *   taken from the subviews once it moves the touch slop, more vertically than horizontally,
 *   unless a subview (a horizontal scroll view, a native component that drags) asked to keep it
 *   first;
 * - in a vertical scroll view (the flow's, or a native component's view under the finger that
 *   scrolls vertically), the scroll view's nested scrolling moves the sheet while the finger
 *   moves up and the sheet is below its highest detent, or moves down with the scroll view at its
 *   top; otherwise the content scrolls. A sheet that reaches its highest detent stays there and
 *   the rest of the drag scrolls. A component's view that scrolls without nested scrolling keeps
 *   its drags;
 * - a tap on the backdrop (the host itself, not its stack) dismisses when `backdropBehavior`
 *   allows; the backdrop takes every touch on it either way.
 */
internal class ScreenGestures(val screen: NodeView, private val coordinator: TransitionCoordinator) {
    private val touchSlop = ViewConfiguration.get(screen.context).scaledTouchSlop
    private val density: Float get() = screen.resources.displayMetrics.density.takeIf { it > 0 } ?: 1f

    /**
     * The finger's velocity, cleared for every touch. Kept for as long as the gestures are rather
     * than returned to the framework's shared pool after each touch, so nothing outlives them
     * there.
     */
    private val velocity: VelocityTracker by lazy { VelocityTracker.obtain() }
    private var pointerId = -1
    private var downX = 0f
    private var downY = 0f

    /** The touch went down on the backdrop. */
    private var onBackdrop = false

    /** The touch went down in a vertical scroll view that scrolls: nested scrolling moves the sheet. */
    private var inScroll = false

    /**
     * The host follows the touch even when no subview takes it: it went down on a presentation
     * that may be dragged.
     */
    var follows = false
        private set

    /** The touch is the gestures', no longer the subviews'. */
    private var taken = false

    /** A subview asked to keep the touch (a scroll view started scrolling). */
    private var disallowed = false
    private var moved = false
    private var cancelled = false

    /** The coordinator moves the screen with the touch, from [takeover] pixels of it. */
    private var dragging = false
    private var takeover = 0f

    /** Whether nested scrolling moves the screen, and how far it moved it, in logical pixels towards dismissal. */
    private var nestedDragging = false
    private var nestedTranslation = 0f

    init {
        screen.screenGestures = this
    }

    fun uninstall() {
        if (screen.screenGestures === this) screen.screenGestures = null
        finish()
    }

    /** Ends the drag in flight without settling it; the coordinator already moved on. */
    fun cancel() {
        dragging = false
        nestedDragging = false
    }

    private val motion: ScreenMotion get() = coordinator.screenMotion(screen)

    /**
     * Sees [event], in the host's pixels, before its subviews do. Returns whether the gestures
     * take it, which the subviews then do not get; the host cancels their touches when they take
     * one midway.
     */
    fun takes(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                finish()
                velocity.clear()
                velocity.addMovement(event)
                pointerId = event.getPointerId(0)
                downX = event.x
                downY = event.y
                val hit = screen.hitTest(event.x, event.y)
                onBackdrop = hit === screen
                inScroll = hit != null && startsInVerticalScroll(hit, event.x, event.y)
                follows = hit != null && motion.draggable
                // The backdrop takes every touch on it, so none reaches the screens beneath.
                taken = onBackdrop
                return taken
            }
            MotionEvent.ACTION_MOVE -> {
                velocity.addMovement(event)
                val index = event.findPointerIndex(pointerId)
                if (index < 0) return taken
                val dx = event.getX(index) - downX
                val dy = event.getY(index) - downY
                if (abs(dx) > touchSlop || abs(dy) > touchSlop) moved = true
                if (dragging) {
                    coordinator.drag(screen, dy / density - takeover)
                    return true
                }
                if (taken || inScroll || disallowed || abs(dy) <= touchSlop || abs(dy) <= abs(dx)) return taken
                if (!coordinator.beginDrag(screen)) return false
                taken = true
                dragging = true
                takeover = dy / density
                return true
            }
            MotionEvent.ACTION_UP -> {
                velocity.addMovement(event)
                val wasTaken = taken
                if (dragging) {
                    dragging = false
                    coordinator.endDrag(screen, releaseVelocity())
                } else if (onBackdrop && !moved) {
                    coordinator.backdropTapped(screen)
                }
                if (!nestedDragging) finish()
                return wasTaken
            }
            MotionEvent.ACTION_CANCEL -> {
                cancelled = true
                val wasTaken = taken
                if (dragging) {
                    dragging = false
                    coordinator.cancelDrag(screen)
                }
                if (!nestedDragging) finish()
                return wasTaken
            }
            else -> return taken
        }
    }

    /** A subview asked its parents to keep, or no longer keep, the touch. */
    fun disallowIntercept(disallow: Boolean) {
        if (disallow) disallowed = true
    }

    // region Nested scrolling of a scroll view inside the presentation

    fun startNestedScroll(axes: Int): Boolean =
        axes and View.SCROLL_AXIS_VERTICAL != 0 && inScroll && motion.draggable

    /**
     * The scroll view is about to scroll by [dy] pixels (positive: the finger moves up); the
     * sheet takes what it moves by in [consumed].
     */
    fun nestedPreScroll(target: View, dy: Int, consumed: IntArray) {
        if (dy == 0) return
        if (!nestedDragging) {
            val expands = dy > 0 && coordinator.canExpand(screen)
            val collapses = dy < 0 && !target.canScrollVertically(-1)
            if (!expands && !collapses) return
            if (!coordinator.beginDrag(screen)) return
            nestedDragging = true
            nestedTranslation = 0f
        }
        nestedTranslation -= dy / density
        coordinator.drag(screen, nestedTranslation)
        consumed[1] = dy
        if (dy > 0 && !coordinator.canExpand(screen)) {
            // At its highest detent: the sheet settles there, and the content scrolls with the
            // rest of the drag.
            nestedDragging = false
            coordinator.endDrag(screen, 0f)
        }
    }

    /** The scroll view is about to fling: a sheet it moved settles instead, with the finger's velocity. */
    fun nestedPreFling(): Boolean {
        if (!nestedDragging) return false
        nestedDragging = false
        coordinator.endDrag(screen, releaseVelocity())
        finish()
        return true
    }

    fun stopNestedScroll() {
        if (!nestedDragging) return
        nestedDragging = false
        if (cancelled) coordinator.cancelDrag(screen) else coordinator.endDrag(screen, releaseVelocity())
        finish()
    }

    // endregion

    /** The finger's velocity when it lifted, in logical pixels per second towards dismissal. */
    private fun releaseVelocity(): Float {
        velocity.computeCurrentVelocity(1000)
        return velocity.getYVelocity(pointerId) / density
    }

    private fun finish() {
        taken = false
        disallowed = false
        moved = false
        cancelled = false
        dragging = false
        onBackdrop = false
        inScroll = false
        follows = false
    }

    /**
     * Whether [hit], a view inside the screen hit at [x], [y] in the screen's pixels, is in a
     * vertical scroll view whose content scrolls: the flow's own, or a view of a native component
     * under the point (a list, a web view), whose nested scrolling then moves the sheet as the
     * flow's scroll views do.
     */
    private fun startsInVerticalScroll(hit: NodeView, x: Float, y: Float): Boolean {
        if (!motion.kind.isPresentation) return false
        if (hit is ExternalNodeView && componentScrollsAt(hit, x, y)) return true
        var node: NodeView? = hit
        while (node != null && node !== screen) {
            if (node is ScrollNodeView) {
                if (node.props["scrollDirection"]?.string == "horizontal") return false
                val scroller = node.scroller
                return scroller.canScrollVertically(1) || scroller.canScrollVertically(-1)
            }
            node = node.parentNode
        }
        return false
    }

    /** Whether a view of [external]'s native component under [x], [y] in the screen's pixels scrolls vertically. */
    private fun componentScrollsAt(external: ExternalNodeView, x: Float, y: Float): Boolean {
        val view = external.componentView ?: return false
        val path = generateSequence<View>(view) { it.parent as? View }.takeWhile { it !== screen }.toList().asReversed()
        val point = floatArrayOf(x, y)
        var parent: View = screen
        for (child in path) {
            NodeView.toChild(parent, child, point)
            parent = child
        }
        return scrollsVerticallyAt(view, point[0], point[1])
    }

    private fun scrollsVerticallyAt(view: View, x: Float, y: Float): Boolean {
        if (view.visibility != View.VISIBLE || x < 0 || y < 0 || x >= view.width || y >= view.height) return false
        if (view.canScrollVertically(1) || view.canScrollVertically(-1)) return true
        if (view !is ViewGroup) return false
        for (index in view.childCount - 1 downTo 0) {
            val child = view.getChildAt(index)
            val point = floatArrayOf(x, y)
            NodeView.toChild(view, child, point)
            if (scrollsVerticallyAt(child, point[0], point[1])) return true
        }
        return false
    }
}

/**
 * A shared element flying between its frame on the screen beneath and its frame on the moving
 * screen, with their corner radii, while both real views are hidden. It shows a picture of the
 * moving screen's element, taken when the flight starts. Frames are in [layer]'s pixels.
 */
internal class SharedElementFlight(val source: NodeView, val target: NodeView, layer: ViewGroup) {
    /** The two frames in the flight layer: the source's, and the target's at rest. */
    val from: RectF = frameIn(layer, source)
    val to: RectF = frameIn(layer, target)
    private val fromRadius = source.shape.uniformRadius ?: 0f
    private val toRadius = target.shape.uniformRadius ?: 0f

    /** What flies. */
    val view = FlightView(layer.context, picture(target))

    init {
        layer.addView(view)
        source.setNavigation { copy(hiddenForFlight = true) }
        target.setNavigation { copy(hiddenForFlight = true) }
        apply(1f)
    }

    /** Places the element [presence] of the way from the source to the target. */
    fun apply(presence: Float) {
        val t = presence.coerceIn(0f, 1f)
        fun lerp(a: Float, b: Float) = a + (b - a) * t
        view.place(
            RectF(lerp(from.left, to.left), lerp(from.top, to.top), lerp(from.right, to.right), lerp(from.bottom, to.bottom)),
            lerp(fromRadius, toRadius),
        )
    }

    fun end() {
        (view.parent as? ViewGroup)?.removeView(view)
        view.picture?.recycle()
        source.setNavigation { copy(hiddenForFlight = false) }
        target.setNavigation { copy(hiddenForFlight = false) }
    }

    /** Draws [picture] stretched over its bounds, clipped to rounded corners of [radius] pixels. */
    class FlightView(context: android.content.Context, val picture: Bitmap?) : View(context) {
        var radius = 0f
            private set

        /** The frame the view was last placed at, in its parent's pixels. */
        val frame = RectF()
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
        private val clip = Path()

        init {
            importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
        }

        fun place(frame: RectF, radius: Float) {
            this.frame.set(frame)
            this.radius = radius
            layout(frame.left.roundToInt(), frame.top.roundToInt(), frame.right.roundToInt(), frame.bottom.roundToInt())
            invalidate()
        }

        override fun onDraw(canvas: Canvas) {
            val bitmap = picture ?: return
            clip.reset()
            clip.addRoundRect(0f, 0f, width.toFloat(), height.toFloat(), radius, radius, Path.Direction.CW)
            val saved = canvas.save()
            canvas.clipPath(clip)
            canvas.drawBitmap(bitmap, null, RectF(0f, 0f, width.toFloat(), height.toFloat()), paint)
            canvas.restoreToCount(saved)
        }
    }

    private companion object {
        /** [view]'s bounds in [layer]'s pixels, through every position, scroll and transform in between. */
        fun frameIn(layer: ViewGroup, view: View): RectF {
            val rect = RectF(0f, 0f, view.width.toFloat(), view.height.toFloat())
            val container = layer.parent as? View
            var current: View = view
            while (current !== container) {
                if (!current.matrix.isIdentity) current.matrix.mapRect(rect)
                val parent = current.parent as? View ?: break
                rect.offset((current.left - parent.scrollX).toFloat(), (current.top - parent.scrollY).toFloat())
                current = parent
            }
            // The layer covers its container from the top-left corner.
            rect.offset(-layer.left.toFloat(), -layer.top.toFloat())
            return rect
        }

        /** What [view] draws, at its size; `null` when it has none. */
        fun picture(view: View): Bitmap? {
            if (view.width <= 0 || view.height <= 0) return null
            val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
            // Never a password, nor the character a secure field shows while it is typed.
            TextInputNodeView.withSecureTextHidden(view) { view.draw(Canvas(bitmap)) }
            return bitmap
        }
    }
}
