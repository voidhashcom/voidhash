@file:OptIn(ExperimentalNativeComponents::class)

package com.voidhash.ui.views

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.view.View
import org.json.JSONObject
import java.util.Locale

/**
 * Makes a native component: a component of the app's own, built from Android views (a map, a
 * video player, another SDK's view), that flows place like any component. Hand the factories to
 * [VoidhashViewsPaywallRenderer] when the app configures the SDK:
 *
 * ```kotlin
 * object MapComponentFactory : NativeComponentFactory {
 *     override val id = "acme/map"
 *     override val version = "1.0.0"
 *
 *     override fun create(context: Context, component: NativeComponentContext): NativeComponent =
 *         MapComponent(context, component)
 * }
 *
 * Voidhash.configure(
 *     context,
 *     publishableKey,
 *     VoidhashOptions(paywallRenderer = VoidhashViewsPaywallRenderer(components = listOf(MapComponentFactory))),
 * )
 * ```
 *
 * The SDK reports every component it was given to Voidhash, which then serves this build only
 * flows whose components it has. A flow that names a component an app build does not have shows
 * the fallback the flow defines for it instead.
 *
 * A component built in the flow editor and marked for native rendering is provided the same way,
 * as `native/<name>` at its contract's version; the code `voidhash types generate` writes for it
 * is a typed layer over this interface. A flow whose component asks for another version (its
 * contract changed since the app was built) shows the editor-built version in its place.
 */
@ExperimentalNativeComponents
interface NativeComponentFactory {
    /**
     * The component definition's id, `namespace/name`, as the component is defined for flows
     * (`acme/map`). The `vh` and `voidhash` namespaces are Voidhash's own.
     */
    val id: String

    /**
     * The definition version the component implements: letters, digits, `.`, `+` and `-`
     * (`1.0.0`), or for a component built in the editor its contract's version. It reaches the
     * core unchanged, and a flow shows the component only where it asks for exactly this version
     * or for none. An id has one version per renderer.
     */
    val version: String

    /**
     * Creates the component for one place a flow shows it, on the main thread. [context] is the
     * context of the paywall's views, for the component's own views; [component] is its way to
     * the flow. The component receives its first props through [NativeComponent.update] right
     * after, before its view is shown.
     */
    fun create(context: Context, component: NativeComponentContext): NativeComponent
}

/**
 * One instance of a native component in a flow. Everything is called on the main thread.
 *
 * The component's view fills the box the flow lays the component out in and moves with it,
 * through screen transitions too. An element the flow shares between two screens flies between
 * them as a picture, which a live view cannot be, so one holding a component does not fly: it
 * moves with its screen. A view that draws on a surface of its own (a `SurfaceView`) is
 * composited apart from the flow's views and may not follow the flow's opacity and motion; prefer
 * a `TextureView` where the component offers one.
 *
 * Its views take their own touches, and are the accessibility nodes of the component, unless the
 * flow hides the component from assistive technology. Touches reach them through Android's
 * dispatch, so the usual rules decide between a component that drags and what it sits in:
 *
 * - A flow's scroll view and a sheet that can be dragged take a vertical drag once it moves the
 *   touch slop. A component that drags (a map, a slider, a drawing pad) calls
 *   `parent.requestDisallowInterceptTouchEvent(true)` when the drag is its own, as it would
 *   inside any `ScrollView`; the flow's scroll views and sheets then leave the rest of the touch
 *   to it.
 * - A component's view that scrolls vertically keeps its drags in a sheet. With nested scrolling
 *   (a `RecyclerView`, a `NestedScrollView`) it moves the sheet as the flow's own scroll views
 *   do: up to the sheet's highest detent before it scrolls, and down from its top. In a flow's
 *   scroll view, what it does not consume scrolls the flow.
 * - On Android the back gesture belongs to the system, so no drag of a component goes back.
 *
 * A component that needs the app's state (a signed-in user, a service client) gets it from the
 * app that created its factory, not from the flow.
 */
@ExperimentalNativeComponents
interface NativeComponent {
    /**
     * The view the flow shows; read once, after the first [update]. It fills the box the flow
     * lays the component out in.
     *
     * Where the flow leaves the component's width or height to its content, the view's own size
     * decides it: the SDK measures the view with an unspecified width and height for the width it
     * wants, and with the width it was laid out at and an unspecified height for its height. It
     * does so after creating it, after each [update], when [NativeComponentContext.invalidateSize]
     * is called and when the laid-out width changes, and tells the flow when the result changed.
     * An axis the view has no preference on is left to the flow's layout: one whose
     * `layoutParams` the component set to `MATCH_PARENT`, or one the view measures as 0. On an
     * axis the flow's style fixes, the measured size plays no part.
     */
    val view: View

    /**
     * The props the flow gives the component, whole, first when it is created and then each
     * time any of them changes, also after the component's own [NativeComponentContext.write].
     * Values are plain Kotlin values: `String`, `Double` (every number), `Boolean`, `List<Any?>`,
     * `Map<String, Any?>` and `null`. What the flow knows of the device, the component's state
     * and whether it is disabled are in [NativeComponentContext], not in the props.
     */
    fun update(props: Map<String, Any?>)

    /**
     * The flow no longer shows the component: release what it holds. Called once, after its
     * view left the flow; events it emits afterwards are dropped.
     */
    fun dispose() {}
}

/** What a native component reaches the flow through. */
@ExperimentalNativeComponents
interface NativeComponentContext {
    /** The settings the flow shows the component with. */
    val environment: NativeComponentEnvironment

    /**
     * The state the flow shows the component in (a node's named state, as the flow's editor
     * previews it), or `null`. It changes together with the props: read it in
     * [NativeComponent.update].
     */
    val state: String?

    /**
     * Whether the flow disables the component, as it disables a button: a component that takes
     * input should not take it then, and may look it. It changes together with the props: read
     * it in [NativeComponent.update].
     */
    val disabled: Boolean

    /**
     * Called on the main thread with the new [environment] when one of its settings changes,
     * before the [NativeComponent.update] of the same change.
     */
    var onEnvironmentChanged: ((NativeComponentEnvironment) -> Unit)?

    /**
     * Tells the flow about something that happened in the component: the flow runs the action it
     * binds to [name], reading a bound value from [payload]. Values are those of
     * [NativeComponent.update]; any `Number` is accepted. May be called on any thread: the event
     * reaches the flow on the main thread, in order. Events emitted after the component was
     * disposed are dropped. The action a flow binds to a component's event may purchase, restore
     * or open a link, except for a component a code component shows in its own tree, whose
     * events reach that code component as caused by no input of the end user.
     *
     * @throws IllegalArgumentException when [payload] holds a value of another type, or a number
     * that is not finite.
     */
    fun emit(name: String, payload: Map<String, Any?> = emptyMap())

    /**
     * Sets prop [key] to [value], as the flow's own layers of the component would: the flow sets
     * what the prop is bound to (a flow variable, say), and the next [NativeComponent.update]
     * carries the new value. The value has the prop's type: a `String` (an enum's option, or a
     * product's id for a product), a finite `Number`, a `Boolean`, or for a list a `List` of
     * distinct strings. May be called on any thread, as [emit] may: the write reaches the flow on
     * the main thread, in order with the component's events, and runs a frame. Writes after the
     * component was disposed are dropped.
     *
     * A value the prop already holds, a prop the flow computes or binds to something that cannot
     * be written, or a flow that has ended changes nothing. A write the flow refuses (a key that
     * is not one of the component's props, a value of another type) is reported to the SDK's log
     * as a warning, never thrown, since a flow may change after the app was built.
     *
     * @throws IllegalArgumentException when [value] is of a type JSON cannot carry, as for [emit].
     */
    fun write(key: String, value: Any?)

    /**
     * Tells the SDK the component's view may want another size, after a change of its content
     * that no [NativeComponent.update] brought: it measures the view again (see
     * [NativeComponent.view]) and lays the flow out around it. May be called on any thread.
     */
    fun invalidateSize()
}

/** The settings a flow shows a native component with. */
@ExperimentalNativeComponents
data class NativeComponentEnvironment(
    /** The locale the flow's text is in, or `null` when the flow has none. */
    val locale: Locale?,
    /** Whether the device asks for reduced motion ("Remove animations"). */
    val reducedMotion: Boolean,
    val colorScheme: ColorScheme,
    /**
     * Whether the flow lays the component out right to left. The component's view also inherits
     * the direction as its `layoutDirection`.
     */
    val isRightToLeft: Boolean,
) {
    enum class ColorScheme { LIGHT, DARK }
}

/**
 * The [NativeComponentContext] of one component, alive until the component is disposed: events
 * go to [container] while it is set, and are dropped once [detach] cleared it.
 */
internal class HostedComponentContext(
    private var container: ExternalNodeView?,
    override var environment: NativeComponentEnvironment,
    override var state: String?,
    override var disabled: Boolean,
) : NativeComponentContext {
    override var onEnvironmentChanged: ((NativeComponentEnvironment) -> Unit)? = null

    override fun emit(name: String, payload: Map<String, Any?>) {
        val json = StringBuilder().also { writeJson(it, payload) }.toString()
        onMainThread { it.componentEmitted(name, json) }
    }

    override fun write(key: String, value: Any?) {
        val json = StringBuilder().also { writeJson(it, value) }.toString()
        onMainThread { it.componentWrote(key, json) }
    }

    override fun invalidateSize() = onMainThread { it.measureComponentSize() }

    /** Runs [action] with the container now on the main thread, else posted there, in order; nothing once detached. */
    private fun onMainThread(action: (ExternalNodeView) -> Unit) {
        if (Looper.myLooper() === Looper.getMainLooper()) {
            container?.let(action)
        } else {
            mainThread.post { container?.let(action) }
        }
    }

    /** Takes [next], telling the component when it differs. */
    fun environmentChanged(next: NativeComponentEnvironment) {
        if (next == environment) return
        environment = next
        onEnvironmentChanged?.invoke(next)
    }

    fun detach() {
        container = null
        onEnvironmentChanged = null
    }

    private companion object {
        val mainThread by lazy { Handler(Looper.getMainLooper()) }

        fun writeJson(out: StringBuilder, value: Any?) {
            when (value) {
                null -> out.append("null")
                is String -> out.append(JSONObject.quote(value))
                is Boolean -> out.append(value)
                is Byte, is Short, is Int, is Long -> out.append(value)
                is Number -> {
                    val number = value.toDouble()
                    require(number.isFinite()) { "a component's value holds $number, which JSON cannot carry" }
                    out.append(number)
                }
                is Map<*, *> -> {
                    out.append('{')
                    var first = true
                    for ((key, item) in value) {
                        require(key is String) { "a component's value holds a map key that is not a string: $key" }
                        if (!first) out.append(',')
                        first = false
                        out.append(JSONObject.quote(key)).append(':')
                        writeJson(out, item)
                    }
                    out.append('}')
                }
                is List<*> -> {
                    out.append('[')
                    value.forEachIndexed { index, item ->
                        if (index > 0) out.append(',')
                        writeJson(out, item)
                    }
                    out.append(']')
                }
                else -> throw IllegalArgumentException("a component's value holds a ${value.javaClass.name}, which JSON cannot carry")
            }
        }
    }
}

/** A prop value as a component receives it; `undefined` is `null`. */
internal fun componentValue(value: PropValue): Any? = when (value) {
    PropValue.Undefined, PropValue.Null -> null
    is PropValue.Bool -> value.value
    is PropValue.Number -> value.value
    is PropValue.Text -> value.value
    is PropValue.Array -> value.items.map(::componentValue)
    is PropValue.Object -> value.entries.filterValues { it != PropValue.Undefined }.mapValues { componentValue(it.value) }
}

/** The keys of `componentProps` the host offers through [NativeComponentContext] rather than as props. */
internal const val CONTEXT_PROP = "\$context"
internal const val STATE_PROP = "\$state"
internal const val DISABLED_PROP = "\$disabled"
