@file:OptIn(ExperimentalNativeComponents::class)

package com.voidhash.ui

import android.app.Activity
import android.content.Context
import com.voidhash.sdk.api.FlowPackageReference
import com.voidhash.sdk.flows.FlowEngineCapabilities
import com.voidhash.sdk.flows.FlowLoadingSession
import com.voidhash.sdk.flows.FlowRenderer
import com.voidhash.sdk.flows.FlowRendererHost
import com.voidhash.sdk.flows.FlowRendererSession

/**
 * Presents flows with Android's own views.
 *
 * The SDK finds it on its own when the app depends on this module (it is registered for
 * [com.voidhash.sdk.flows.FlowRendererDiscovery]). Construct one yourself only to give it the
 * app's [native components][NativeComponentFactory]:
 *
 * ```kotlin
 * Voidhash.configure(
 *     context,
 *     publishableKey,
 *     VoidhashOptions(flowRenderer = FlowViewRenderer(components = listOf(...))),
 * )
 * ```
 *
 * Each flow is shown in a [FlowView] in a fullscreen dialog above the presenting
 * activity, drawn edge to edge with the system bars as its safe area. The back button goes back
 * through the flow (popping screens and dismissing its modals and sheets) and closes it from the
 * flow's first screen; in an app that opts into predictive back, the screen going back follows
 * the gesture. The dialog goes with its activity: [present] is called again, for the same
 * flow, once an activity recreated for a configuration change is started. On a device whose CPU
 * architecture the native library does not ship for, [supportsAbiVersion] answers false,
 * [engineCapabilities] is `null`, and flows report `FlowFailure.UNSUPPORTED_PACKAGE` saying the
 * device's CPU has no renderer library.
 *
 * By default it runs the flow runtime linked into its core: it reports no runtime bridge in
 * [engineCapabilities], so it is served releases by package format, and it draws a release whose
 * package format it reads, whatever runtime module the release also names. With [runtimeMode]
 * [RuntimeMode.MODULE] it runs each release on the runtime module the release names instead
 * (downloaded once, verified and cached, or the module the core bundles when that runs the
 * release), whatever its package format; two differences remain there: a native component cannot
 * write its props back (runtime bridge 1 has no call for it), and a text field in a package
 * format only the module reads gets its keyboard set-up when first focused.
 * Text inputs are the platform's own fields, with the keyboard laid out below the flow.
 *
 * While a flow waits for the network it shows [loading]: the [standard][FlowLoading.Standard] one
 * unless the app sets another.
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
class FlowViewRenderer @ExperimentalNativeComponents constructor(
    components: List<NativeComponentFactory>,
) : FlowRenderer {
    /** A renderer whose flows show no native component of the app's. */
    constructor() : this(emptyList())

    /**
     * What the end user sees while a flow waits for the network, from [FlowLoading.DELAY_MS] after
     * the presentation began until the flow is shown: [FlowLoading.Standard] unless the app sets
     * another. A flow already on the device is shown before the delay is up, without it.
     *
     * ```kotlin
     * VoidhashOptions(flowRenderer = FlowViewRenderer().apply { loading = FlowLoading.None })
     * ```
     */
    @Volatile
    var loading: FlowLoading = FlowLoading.Standard

    /** Which flow runtime draws flows; see [runtimeMode]. */
    enum class RuntimeMode {
        /** The flow runtime linked into the views core (the default). */
        LINKED,

        /**
         * Flow runtime modules: each release names the one it needs, which the SDK downloads
         * once, verifies and caches, and runs in its interpreter.
         */
        MODULE,
    }

    companion object {
        /**
         * The flow runtime flows are drawn with, process-wide: [RuntimeMode.LINKED] (the default)
         * or [RuntimeMode.MODULE]. Set it before the SDK resolves its first flow: what the
         * renderer reports, and so which releases it is served, depends on it. It reads
         * [RuntimeMode.LINKED] in a build that trusts no key that signs runtime modules.
         */
        @JvmStatic
        var runtimeMode: RuntimeMode
            get() {
                if (!ViewsNative.isAvailable) return RuntimeMode.LINKED
                // The core runs modules only once it trusts a root; a debug build trusts its own.
                RuntimeModules.trustDevelopmentKeys()
                return if (ViewsNative.nativeRuntimeMode() == 1) RuntimeMode.MODULE else RuntimeMode.LINKED
            }
            set(mode) {
                if (ViewsNative.isAvailable) {
                    RuntimeModules.trustDevelopmentKeys()
                    ViewsNative.nativeSetRuntimeMode(if (mode == RuntimeMode.MODULE) 1 else 0)
                }
            }
    }

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
        registry = if (ViewsNative.isAvailable) ComponentRegistry() else null
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
        ViewsNative.isAvailable &&
            abiVersion in ViewsNative.nativeMinPackageAbiVersion()..ViewsNative.nativePackageAbiVersion()

    /**
     * What the core runs with this renderer's registry: the components linked into it and this
     * renderer's own, and in module mode the runtime bridge it hosts. `null` on a device whose
     * CPU architecture the native library does not ship for.
     */
    override val engineCapabilities: FlowEngineCapabilities?
        get() {
            val registry = registry ?: return null
            return FlowEngineCapabilities(
                packageAbiVersion = ViewsNative.nativePackageAbiVersion(),
                guestAbiVersion = ViewsNative.nativeGuestAbiVersion(),
                nativeComponents = registry.capabilities,
                runtimeBridgeVersion = ViewsNative.nativeRuntimeBridgeVersion().takeIf { runtimeMode == RuntimeMode.MODULE },
            )
        }

    override fun useRuntimeModules() {
        runtimeMode = RuntimeMode.MODULE
    }

    /** In module mode any release naming a runtime module is drawn: the module reads its package. */
    override fun supports(reference: FlowPackageReference): Boolean =
        if (registry != null && reference.runtime != null && runtimeMode == RuntimeMode.MODULE) {
            true
        } else {
            supportsAbiVersion(reference.abiVersion)
        }

    /** In module mode, gets the runtime module the release names, or the one that runs it. */
    override suspend fun prepare(activity: Activity, reference: FlowPackageReference) {
        val runtime = reference.runtime ?: return
        // The app's own flags, here where a context is at hand (a renderer used without the SDK).
        if (RuntimeModules.isDebuggable(activity.applicationInfo)) RuntimeModules.trustDevelopmentKeys(debuggable = true)
        if (runtimeMode != RuntimeMode.MODULE) return
        RuntimeModules.prepare(activity.applicationContext.cacheDir, runtime)
    }

    override fun present(
        activity: Activity,
        flowPackage: ByteArray,
        host: FlowRendererHost,
    ): FlowRendererSession = present(activity, flowPackage, runtimeSha256 = "", host)

    override fun present(
        activity: Activity,
        flowPackage: ByteArray,
        reference: FlowPackageReference,
        host: FlowRendererHost,
    ): FlowRendererSession = present(
        activity,
        flowPackage,
        runtimeSha256 = reference.runtime?.sha256?.takeIf { runtimeMode == RuntimeMode.MODULE }.orEmpty(),
        host,
    )

    private fun present(
        activity: Activity,
        flowPackage: ByteArray,
        runtimeSha256: String,
        host: FlowRendererHost,
    ): FlowRendererSession {
        val view = newView(activity)
        // From the images the SDK keeps on the device, so a cached flow shows them offline too.
        view.imageSource = host::loadImage
        view.imageRejected = host::onImageRejected
        // Over a loading state the window is clear until the flow draws, so the loading state shows
        // through rather than an empty window; it turns black like every flow's once that ends.
        val loading = loadings.firstOrNull { it.activity === activity && it.isShowing }
        return presentInDialog(activity, view, host, view::postMessage, view::release, view.predictiveBack, loading) { fail ->
            view.listener = object : FlowView.Listener {
                override fun onMessage(message: String) = host.onMessage(message)

                override fun onWarning(message: String) = host.onWarning(message)

                override fun onFailure(message: String) = fail(message)
            }
            view.loadPackage(flowPackage, runtimeSha256)
        }
    }

    /** The loading states begun and not ended yet; main thread. A flow presented above one draws over it. */
    private val loadings = mutableListOf<LoadingDialog>()

    /**
     * Shows [loading] above [activity] once the presentation has waited [FlowLoading.DELAY_MS];
     * none on a device the core does not run on.
     */
    override fun beginLoading(activity: Activity, waitedMs: Long, onCancel: () -> Unit): FlowLoadingSession? {
        if (!ViewsNative.isAvailable) return null
        val createView = when (val loading = loading) {
            FlowLoading.None -> return null
            FlowLoading.Standard -> ::standardLoadingView
            is FlowLoading.Custom -> loading.createView
        }
        val dialog = LoadingDialog(activity, createView, onCancel, (FlowLoading.DELAY_MS - waitedMs).coerceAtLeast(0))
        loadings.add(dialog)
        dialog.afterEnd { loadings.remove(dialog) }
        return dialog
    }

    /** Main thread. Turns [loading] on or off, as React Native's `flowLoading` option does. */
    override fun useLoading(shows: Boolean) {
        loading = if (shows) FlowLoading.Standard else FlowLoading.None
    }

    /** A view showing flows with this renderer's native components. */
    internal fun newView(context: Context): FlowView = FlowView(context, null, registry, components)
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
    private val releaseHandle: (Long) -> Unit = ViewsNative::nativeComponentsRelease,
) {
    private var handle = ViewsNative.nativeComponentsCreate()

    init {
        check(handle != 0L) { "The views core could not create a component registry" }
    }

    /** Registers a component; `null` on success, otherwise why the core refused it. */
    fun register(id: String, version: String, renderer: String): String? =
        withHandle { ViewsNative.nativeComponentsRegister(it, id, version, renderer) }

    /** What a surface created with the registry provides, `id@version` each. */
    val capabilities: List<String>
        get() = withHandle { ViewsNative.nativeComponentsCapabilities(it) }.orEmpty().split(',').filter { it.isNotEmpty() }

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
