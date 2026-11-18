@file:OptIn(ExperimentalNativeComponents::class)

package com.voidhash.ui.views

import android.app.Activity
import android.content.Context
import com.voidhash.sdk.paywall.FlowEngineCapabilities
import com.voidhash.sdk.paywall.PaywallRenderer
import com.voidhash.sdk.paywall.PaywallRendererHost
import com.voidhash.sdk.paywall.PaywallRendererSession
import com.voidhash.ui.presentInDialog

/**
 * Presents flows with Android's own views.
 *
 * ```kotlin
 * Voidhash.configure(
 *     context,
 *     publishableKey,
 *     VoidhashOptions(paywallRenderer = VoidhashViewsPaywallRenderer()),
 * )
 * ```
 *
 * Each flow is shown in a [VoidhashViewsPaywallView] in a fullscreen dialog above the presenting
 * activity, drawn edge to edge with the system bars as its safe area. The back button goes back
 * through the flow (popping screens and dismissing its modals and sheets) and closes it from the
 * flow's first screen; in an app that opts into predictive back, the screen going back follows
 * the gesture. The dialog goes with its activity: [present] is called again, for the same
 * flow, once an activity recreated for a configuration change is started. On a device whose CPU
 * architecture the native library does not ship for, [supportsAbiVersion] answers false and
 * flows report `FlowFailure.UNSUPPORTED_PACKAGE`.
 *
 * It runs the flow runtime linked into its core, never a downloaded runtime module: it reports
 * no runtime bridge in [engineCapabilities], so it is served releases by package format, and it
 * draws a release whose package format it reads, whatever runtime module the release also names.
 * Text inputs are the platform's own fields, with the keyboard laid out below the flow.
 *
 * [components] (behind the opt-in [ExperimentalNativeComponents]) are the app's own
 * [native components][NativeComponentFactory] flows may show. The
 * renderer registers them with the core as it is constructed, in a registry of its own: only
 * the flows it presents show them, and a flow another renderer of the process presents shows the
 * fallback the flow defines in their place. Construct it when the app configures the SDK; it
 * reports them in [engineCapabilities], and Voidhash serves this build only flows whose native
 * components it reports.
 *
 * @throws IllegalArgumentException when two of [components] have the same id, or one cannot be
 * registered: its id or version is malformed, or its id is in a namespace of Voidhash's own or
 * names a component the core provides itself. The message says why. A mistake in the app's
 * set-up fails where the app makes it, every time, rather than leaving the component out of the
 * build's flows unnoticed.
 */
class VoidhashViewsPaywallRenderer @ExperimentalNativeComponents constructor(
    components: List<NativeComponentFactory>,
) : PaywallRenderer {
    /** A renderer whose flows show no native component of the app's. */
    constructor() : this(emptyList())

    /** The native components by renderer, which is their id. */
    private val components: Map<String, NativeComponentFactory>

    /** The core's registry of [components]; `null` without the core on this device, where no flow is shown. */
    private val registry: ComponentRegistry?

    init {
        val byId = LinkedHashMap<String, NativeComponentFactory>()
        for (factory in components) {
            require(byId.put(factory.id, factory) == null) { "Two native components have the id ${factory.id}" }
        }
        this.components = byId
        registry = if (VoidhashViewsNative.isAvailable) ComponentRegistry() else null
        try {
            for (factory in byId.values) {
                registry?.register(factory.id, factory.version, factory.id)?.let { reason ->
                    throw IllegalArgumentException("Native component ${factory.id}@${factory.version} cannot be registered: $reason")
                }
            }
        } catch (error: IllegalArgumentException) {
            // No renderer holds the registry: it goes now rather than when it is collected.
            registry?.release()
            throw error
        }
    }

    override fun supportsAbiVersion(abiVersion: Int): Boolean =
        VoidhashViewsNative.isAvailable &&
            abiVersion in VoidhashViewsNative.nativeMinPackageAbiVersion()..VoidhashViewsNative.nativePackageAbiVersion()

    /**
     * What the core runs with this renderer's registry: the components linked into it and this
     * renderer's own. `null` on a device whose CPU architecture the native library does not ship
     * for.
     */
    override val engineCapabilities: FlowEngineCapabilities?
        get() {
            val registry = registry ?: return null
            return FlowEngineCapabilities(
                packageAbiVersion = VoidhashViewsNative.nativePackageAbiVersion(),
                guestAbiVersion = VoidhashViewsNative.nativeGuestAbiVersion(),
                nativeComponents = registry.capabilities,
            )
        }

    override fun present(
        activity: Activity,
        flowPackage: ByteArray,
        host: PaywallRendererHost,
    ): PaywallRendererSession {
        val view = newView(activity)
        // From the images the SDK keeps on the device, so a cached flow shows them offline too.
        view.imageSource = host::loadImage
        view.imageRejected = host::onImageRejected
        return presentInDialog(activity, view, host, view::postMessage, view::release, view.predictiveBack) { fail ->
            view.listener = object : VoidhashViewsPaywallView.Listener {
                override fun onMessage(message: String) = host.onMessage(message)

                override fun onWarning(message: String) = host.onWarning(message)

                override fun onFailure(message: String) = fail(message)
            }
            view.loadPackage(flowPackage)
        }
    }

    /** A view showing flows with this renderer's native components. */
    internal fun newView(context: Context): VoidhashViewsPaywallView = VoidhashViewsPaywallView(context, null, registry, components)
}

/**
 * The core's registry of the native components one renderer provides (views protocol,
 * "Registration"). Its renderer owns the handle for as long as the renderer lives; every surface
 * created with it holds a reference of its own, so releasing the handle never takes a component
 * from a flow on screen. The handle is released exactly once: by [release] when the renderer's
 * construction fails, otherwise when the registry is collected with its renderer. Any thread.
 */
internal class ComponentRegistry(
    /** Releases the core's handle; replaced only by tests that watch the release. */
    private val releaseHandle: (Long) -> Unit = VoidhashViewsNative::nativeComponentsRelease,
) {
    private var handle = VoidhashViewsNative.nativeComponentsCreate()

    init {
        check(handle != 0L) { "The views core could not create a component registry" }
    }

    /** Registers a component; `null` on success, otherwise why the core refused it. */
    fun register(id: String, version: String, renderer: String): String? =
        withHandle { VoidhashViewsNative.nativeComponentsRegister(it, id, version, renderer) }

    /** What a surface created with the registry provides, `id@version` each. */
    val capabilities: List<String>
        get() = withHandle { VoidhashViewsNative.nativeComponentsCapabilities(it) }.orEmpty().split(',').filter { it.isNotEmpty() }

    /**
     * Runs [use] with the handle, which stays valid until it returns; 0 once released, which the
     * core reads as a registry of the linked components alone.
     */
    fun <T> withHandle(use: (Long) -> T): T = synchronized(this) { use(handle) }

    /** Releases the handle; the second and later calls do nothing. */
    fun release() {
        val released = synchronized(this) { handle.also { handle = 0L } }
        if (released != 0L) releaseHandle(released)
    }

    // The renderer has no end of its own: it lives as long as the app keeps it configured.
    protected fun finalize() = release()
}
