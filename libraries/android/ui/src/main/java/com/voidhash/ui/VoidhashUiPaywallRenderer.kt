package com.voidhash.ui

import android.app.Activity
import com.voidhash.sdk.api.FlowPackageReference
import com.voidhash.sdk.paywall.FlowEngineCapabilities
import com.voidhash.sdk.paywall.PaywallRenderer
import com.voidhash.sdk.paywall.PaywallRendererHost
import com.voidhash.sdk.paywall.PaywallRendererSession

/**
 * Presents flows natively, drawing every pixel on the GPU.
 *
 * ```kotlin
 * Voidhash.configure(
 *     context,
 *     publishableKey,
 *     VoidhashOptions(paywallRenderer = VoidhashUiPaywallRenderer()),
 * )
 * ```
 *
 * Each flow is shown in a fullscreen dialog above the presenting activity, drawn edge to edge
 * with the system bars as its safe area. The back button goes back through the flow (popping
 * screens and dismissing its modals and sheets) and closes it from the flow's first screen; while
 * a text input of the flow has the keyboard up, it puts the keyboard away first.
 * The dialog goes with its activity: [present] is called again, for the same flow, once an
 * activity recreated for a configuration change is started.
 * On a device whose CPU
 * architecture the native library does not ship for, [supportsAbiVersion] answers false and
 * flows report `FlowFailure.UNSUPPORTED_PACKAGE`.
 */
class VoidhashUiPaywallRenderer : PaywallRenderer {
    /** Which flow runtime draws flows; see [runtimeMode]. */
    enum class RuntimeMode {
        /** The flow runtime built into the SDK (the default). */
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
         * or [RuntimeMode.MODULE]. Set it before the SDK resolves its first flow.
         */
        @JvmStatic
        var runtimeMode: RuntimeMode
            get() = if (VoidhashUiNative.isAvailable && VoidhashUiNative.nativeRuntimeMode() == 1) {
                RuntimeMode.MODULE
            } else {
                RuntimeMode.LINKED
            }
            set(mode) {
                if (VoidhashUiNative.isAvailable) {
                    VoidhashUiNative.nativeSetRuntimeMode(if (mode == RuntimeMode.MODULE) 1 else 0)
                }
            }
    }

    override fun supportsAbiVersion(abiVersion: Int): Boolean =
        VoidhashUiNative.isAvailable &&
            abiVersion in
            VoidhashUiNative.nativeMinPackageAbiVersion()..VoidhashUiNative.nativePackageAbiVersion()

    /**
     * `null` on a device whose CPU architecture the native library does not ship for. In module
     * mode it also reports the runtime bridge the engine hosts.
     */
    override val engineCapabilities: FlowEngineCapabilities?
        get() = bundledEngineCapabilities?.let { engine ->
            if (runtimeMode == RuntimeMode.MODULE) {
                engine.copy(runtimeBridgeVersion = VoidhashUiNative.nativeRuntimeBridgeVersion())
            } else {
                engine
            }
        }

    /** In module mode any release naming a runtime module is drawn: the module reads its package. */
    override fun supports(reference: FlowPackageReference): Boolean =
        if (VoidhashUiNative.isAvailable && runtimeMode == RuntimeMode.MODULE && reference.runtime != null) {
            true
        } else {
            supportsAbiVersion(reference.abiVersion)
        }

    override suspend fun prepare(activity: Activity, reference: FlowPackageReference) {
        val runtime = reference.runtime ?: return
        if (runtimeMode != RuntimeMode.MODULE) return
        RuntimeModules.prepare(activity.applicationContext, runtime)
    }

    override fun present(
        activity: Activity,
        flowPackage: ByteArray,
        host: PaywallRendererHost,
    ): PaywallRendererSession = present(activity, flowPackage, runtimeSha256 = "", host)

    override fun present(
        activity: Activity,
        flowPackage: ByteArray,
        reference: FlowPackageReference,
        host: PaywallRendererHost,
    ): PaywallRendererSession = present(
        activity,
        flowPackage,
        runtimeSha256 = reference.runtime?.sha256?.takeIf { runtimeMode == RuntimeMode.MODULE }.orEmpty(),
        host,
    )

    private fun present(
        activity: Activity,
        flowPackage: ByteArray,
        runtimeSha256: String,
        host: PaywallRendererHost,
    ): PaywallRendererSession {
        val view = VoidhashPaywallView(activity)
        // The SDK answers each `ready` with the state saved by then; a replay would be older.
        view.replaysConfigure = false
        // From the images the SDK keeps on the device, so a cached flow shows them offline too.
        view.imageSource = host::loadImage
        view.imageRejected = host::onImageRejected
        return presentInDialog(activity, view, host, view::postMessage, view::release) { fail ->
            view.listener = object : VoidhashPaywallView.Listener {
                override fun onMessage(message: String) = host.onMessage(message)

                override fun onWarning(message: String) = host.onWarning(message)

                override fun onFailure(message: String) = fail(message)
            }
            view.loadPackage(flowPackage, runtimeSha256)
        }
    }
}

/** What the bundled engine can run; read once, as it is fixed for the build. */
private val bundledEngineCapabilities: FlowEngineCapabilities? by lazy {
    if (!VoidhashUiNative.isAvailable) return@lazy null
    FlowEngineCapabilities(
        packageAbiVersion = VoidhashUiNative.nativePackageAbiVersion(),
        guestAbiVersion = VoidhashUiNative.nativeGuestAbiVersion(),
        nativeComponents = VoidhashUiNative.nativeNativeComponents()
            .orEmpty()
            .split(',')
            .filter { it.isNotEmpty() },
    )
}
