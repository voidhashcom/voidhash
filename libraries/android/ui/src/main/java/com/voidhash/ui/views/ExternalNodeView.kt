@file:OptIn(ExperimentalNativeComponents::class)

package com.voidhash.ui.views

import android.content.Context
import android.graphics.Canvas
import android.view.View
import android.view.ViewGroup
import com.voidhash.ui.darkTheme
import com.voidhash.ui.primaryLocale
import com.voidhash.ui.reducedMotion
import java.util.Locale

/** The renderer of an `external` view that draws the draw lists of `CANVAS` operations. */
private const val CANVAS_RENDERER = "vh.canvas"

/** The keys of `componentProps` a component reads from its context rather than its props. */
private val CONTEXT_KEYS = setOf(CONTEXT_PROP, STATE_PROP, DISABLED_PROP)

/**
 * An `external` view. `vh.canvas` draws its latest draw list; any other renderer is a native
 * component the app provides (views protocol, "Native components"): the view creates it from the
 * app's factory when the renderer first arrives, keeps its view filling the frame, hands it every
 * `componentProps`, reports the size its view wants (see [measureComponentSize]), and disposes of
 * it on [disposeComponent]. A renderer the app did not provide shows nothing.
 */
internal class ExternalNodeView(context: Context, nodeId: Int, kind: NodeKind, host: NodeHost?) : NodeView(context, nodeId, kind, host) {
    private var drawList = ByteArray(0)
    private var images: List<String> = emptyList()

    /** Subviews the protocol may give the view, kept apart from the component's view. */
    private val subviews = NodeHolder(context)

    /** The renderer whose component the view shows or reported missing; `null` before the first. */
    private var renderer: String? = null

    /** The component's view left for good: nothing creates a component again. */
    private var released = false

    /** The component shown, with its context and the view it showed. */
    var component: NativeComponent? = null
        private set
    private var componentContext: HostedComponentContext? = null
    var componentView: View? = null
        private set

    /** The `componentProps` the component last received. */
    private var deliveredProps: PropValue? = null
    private var relayoutPosted = false

    /** The size last reported for the component, in the surface's units; `null` before the first. */
    private var reportedSize: Pair<Float, Float>? = null

    /** The width in pixels the size was last measured for; a new width measures again. */
    private var measuredForWidth = -1

    init {
        addView(subviews)
    }

    override val contentHost: ViewGroup get() = subviews

    /** Keeps the list until the next one arrives. */
    fun show(drawList: ByteArray, images: List<String>) {
        this.drawList = drawList
        this.images = images
        invalidate()
    }

    override fun imageLoaded(url: String) {
        if (url in images) invalidate()
    }

    override fun drawContent(canvas: Canvas) {
        val host = host ?: return
        if (props["renderer"]?.string != CANVAS_RENDERER || drawList.isEmpty()) return
        val saved = canvas.save()
        canvas.clipRect(0f, 0f, width.toFloat(), height.toFloat())
        canvas.scale(host.density, host.density)
        val urls = images
        DrawList.draw(drawList, canvas, { index -> urls.getOrNull(index)?.let(host::image) }, host.textSystem.fonts)
        canvas.restoreToCount(saved)
    }

    // region The native component

    override fun refreshContent(change: Change) {
        if (released) return
        // The direction the flow lays the component out in, which its views inherit; the
        // device's direction plays no part (views protocol, "Layout direction").
        layoutDirection = if (isRightToLeft) LAYOUT_DIRECTION_RTL else LAYOUT_DIRECTION_LTR
        val renderer = props["renderer"]?.string?.takeIf { it != CANVAS_RENDERER }
        if (renderer != this.renderer) {
            removeComponent()
            this.renderer = renderer
            if (renderer != null) createComponent(renderer)
            return
        }
        val component = component ?: return
        // Every `PROPS` carrying `componentProps` merges a new value, even an equal one.
        val raw = props["componentProps"]
        val propsChanged = raw !== deliveredProps
        componentContext?.let { context ->
            if (propsChanged) {
                context.state = raw?.get(STATE_PROP)?.string
                context.disabled = raw?.get(DISABLED_PROP)?.bool == true
            }
            // Also on its own: the direction may change without the props.
            context.environmentChanged(environment(raw))
        }
        if (!propsChanged) return
        deliveredProps = raw
        component.update(developerProps(raw))
        measureComponentSize()
    }

    /** Whether the flow lays the component out right to left; a view without `layoutDirection` is left to right. */
    private val isRightToLeft: Boolean get() = props["layoutDirection"]?.string == "rtl"

    private fun createComponent(renderer: String) {
        val host = host ?: return
        val factory = host.componentFactory(renderer) ?: return host.componentMissing(renderer)
        val raw = props["componentProps"]
        val context = HostedComponentContext(this, environment(raw), raw?.get(STATE_PROP)?.string, raw?.get(DISABLED_PROP)?.bool == true)
        val created = factory.create(this.context, context)
        created.update(developerProps(raw))
        deliveredProps = raw
        val view = created.view
        component = created
        componentContext = context
        componentView = view
        // An axis the component's own params fill has no size of its own (see `measureComponentSize`).
        val own = view.layoutParams
        fillsWidth = own?.width == LayoutParams.MATCH_PARENT
        fillsHeight = own?.height == LayoutParams.MATCH_PARENT
        // Beneath any subviews, filling the view.
        addView(view, 0, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
        layoutComponent()
        measureComponentSize()
    }

    /** Clears the measure caches of [view] and every view under it. */
    private fun forceLayoutAll(view: View) {
        view.forceLayout()
        if (view is ViewGroup) for (index in 0 until view.childCount) forceLayoutAll(view.getChildAt(index))
    }

    /** Whether the component's view set `MATCH_PARENT` on an axis itself, before the view took it in. */
    private var fillsWidth = false
    private var fillsHeight = false

    /**
     * Measures the size the component's view wants and reports it to the flow when it changed:
     * its width measured with an unspecified width, its height with the width it is laid out at
     * (unspecified before its first layout). An axis the view fills (`MATCH_PARENT` params set by
     * the component) or measures as 0 has no preference and is reported as `NaN`. The flow uses
     * the size only on an axis its style leaves to the content.
     *
     * It converges: the wanted width does not depend on the laid-out width, so a width the flow
     * takes from it lays the view out at that width and the height measured for it is reported
     * once. Only a changed size is reported, and a layout measures again only for a new width.
     */
    fun measureComponentSize() {
        val view = componentView ?: return
        val host = host ?: return
        // A view whose box is fixed changes its content without asking for a layout (a
        // `TextView` given new text), so a measure would answer from its cache.
        forceLayoutAll(view)
        val unspecified = MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED)
        view.measure(unspecified, unspecified)
        val wantedWidth = view.measuredWidth
        val laidOut = width
        val wantedHeight = if (laidOut > 0) {
            view.measure(MeasureSpec.makeMeasureSpec(laidOut, MeasureSpec.EXACTLY), unspecified)
            view.measuredHeight
        } else {
            view.measuredHeight
        }
        measuredForWidth = laidOut
        // Measuring left the view's measured size at the wanted one: lay it out at its frame again.
        layoutComponent()
        val density = host.density
        val size = Pair(
            if (fillsWidth || wantedWidth <= 0) Float.NaN else wantedWidth / density,
            if (fillsHeight || wantedHeight <= 0) Float.NaN else wantedHeight / density,
        )
        val previous = reportedSize
        // NaN is never equal to itself: compare the axes' bits.
        if (previous != null && previous.first.toRawBits() == size.first.toRawBits() && previous.second.toRawBits() == size.second.toRawBits()) return
        reportedSize = size
        host.componentSize(nodeId, size.first, size.second)
    }

    /** Takes the component's view out and disposes of the component; its later events are dropped. */
    private fun removeComponent() {
        val component = component ?: return
        componentView?.let(::removeView)
        componentContext?.detach()
        this.component = null
        componentContext = null
        componentView = null
        deliveredProps = null
        reportedSize = null
        measuredForWidth = -1
        component.dispose()
    }

    /** The view leaves the tree (`DELETE`, `RESET`, the paywall's release): its component goes, once. */
    fun disposeComponent() {
        released = true
        removeComponent()
    }

    /** The component emitted an event; it is still shown. */
    fun componentEmitted(name: String, payload: String) {
        host?.componentEvent(nodeId, name, payload)
    }

    /** The component wrote prop [key], [value] its JSON; it is still shown. */
    fun componentWrote(key: String, value: String) {
        host?.componentWrite(nodeId, key, value)
    }

    /** The props a component receives: `componentProps` without what its context offers. */
    private fun developerProps(raw: PropValue?): Map<String, Any?> {
        val entries = raw?.obj ?: return emptyMap()
        return entries
            .filter { (key, value) -> key !in CONTEXT_KEYS && value != PropValue.Undefined }
            .mapValues { componentValue(it.value) }
    }

    /**
     * The settings the flow shows the component with: its `$context`, which a component node
     * carries, else the device's (a `native` element of a code component carries none).
     */
    private fun environment(raw: PropValue?): NativeComponentEnvironment {
        val flow = raw?.get(CONTEXT_PROP)?.obj
        val configuration = resources.configuration
        val locale = if (flow != null) flow["locale"]?.string else primaryLocale(configuration)
        val dark = flow?.get("colorScheme")?.string?.let { it == "dark" } ?: darkTheme(configuration)
        return NativeComponentEnvironment(
            locale = locale?.let(Locale::forLanguageTag),
            reducedMotion = flow?.get("reducedMotion")?.bool ?: reducedMotion(context),
            colorScheme = if (dark) NativeComponentEnvironment.ColorScheme.DARK else NativeComponentEnvironment.ColorScheme.LIGHT,
            isRightToLeft = isRightToLeft,
        )
    }

    // endregion

    // region Layout and touches

    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        super.onLayout(changed, l, t, r, b)
        layoutComponent()
        // A height may depend on the width: a new width measures again.
        if (componentView != null && width != measuredForWidth) measureComponentSize()
    }

    private fun layoutComponent() {
        val view = componentView ?: return
        view.measure(MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY))
        view.layout(0, 0, width, height)
    }

    /**
     * Node views are laid out by their frames, never measured, so a layout the component's views
     * request ends here: the view lays the component out again itself, once per request.
     */
    override fun requestLayout() {
        super.requestLayout()
        if (relayoutPosted || componentView == null) return
        relayoutPosted = true
        post {
            relayoutPosted = false
            // Measured and laid out at the same frame, which clears the request.
            measure(MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY))
            layout(left, top, right, bottom)
        }
    }

    /** The component's views take their own touches, inside the view's bounds. */
    override fun touchTarget(x: Float, y: Float): View? {
        val view = componentView ?: return null
        return if (pointerEvents != "box-only" && inside(x, y)) view else null
    }

    /** With `box-none` the view takes no touch itself, but its component does. */
    override fun hitTest(x: Float, y: Float): NodeView? {
        super.hitTest(x, y)?.let { return it }
        val takes = componentView != null && pointerEvents == "box-none" && visibility == VISIBLE && !navigation.covered
        return if (takes && inside(x, y)) this else null
    }

    // endregion
}
