package com.voidhash.ui

import android.app.Activity
import android.app.Application
import android.app.Dialog
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Build
import android.os.Bundle
import android.window.OnBackInvokedDispatcher
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.view.WindowManager
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
        val dialog = Dialog(activity, android.R.style.Theme_Black_NoTitleBar)
        dialog.setContentView(
            view,
            ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
        )
        dialog.window?.let(::drawEdgeToEdge)

        // A dialog cannot outlive its activity; one destroyed underneath the paywall (a
        // configuration change, `finish()`) dismisses it instead of leaking its window. After a
        // configuration change the SDK presents the flow again above the recreated activity.
        val lifecycle = object : EmptyActivityLifecycleCallbacks() {
            override fun onActivityDestroyed(destroyed: Activity) {
                if (destroyed === activity) dialog.dismiss()
            }
        }
        activity.application.registerActivityLifecycleCallbacks(lifecycle)

        view.listener = object : VoidhashPaywallView.Listener {
            override fun onMessage(message: String) = host.onMessage(message)

            override fun onWarning(message: String) = host.onWarning(message)

            override fun onFailure(message: String) {
                host.onFailure(message)
                dialog.dismiss()
            }
        }
        // Back is the flow's to answer: it asks to close (a `close` message) only from its
        // first screen, so the dialog does not cancel itself.
        dialog.setCancelable(false)
        dialog.setOnKeyListener { _, keyCode, event ->
            if (keyCode != KeyEvent.KEYCODE_BACK) return@setOnKeyListener false
            if (event.action == KeyEvent.ACTION_UP && !event.isCanceled) {
                view.postMessage(BACK_MESSAGE)
            }
            true
        }
        // Apps that opt into predictive back receive it here instead of as a key event.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            dialog.onBackInvokedDispatcher.registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT,
            ) { view.postMessage(BACK_MESSAGE) }
        }
        dialog.setOnDismissListener {
            activity.application.unregisterActivityLifecycleCallbacks(lifecycle)
            view.release()
            host.onDismiss()
        }

        view.loadPackage(flowPackage, runtimeSha256)
        try {
            dialog.show()
        } catch (error: RuntimeException) {
            activity.application.unregisterActivityLifecycleCallbacks(lifecycle)
            view.release()
            throw error
        }

        return object : PaywallRendererSession {
            override fun postMessage(message: String) = view.postMessage(message)

            override fun dismiss() = dialog.dismiss()
        }
    }

    private fun drawEdgeToEdge(window: Window) {
        window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        window.setBackgroundDrawable(ColorDrawable(Color.BLACK))
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
        // The flow makes room for the keyboard itself; a panned window would move it as well.
        @Suppress("DEPRECATION")
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        @Suppress("DEPRECATION")
        window.statusBarColor = Color.TRANSPARENT
        @Suppress("DEPRECATION")
        window.navigationBarColor = Color.TRANSPARENT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        }
    }
}

/** The bridge envelope reporting the platform's back button or gesture to the flow. */
private const val BACK_MESSAGE = """{"version":1,"type":"back","payload":{}}"""

private open class EmptyActivityLifecycleCallbacks : Application.ActivityLifecycleCallbacks {
    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}

    override fun onActivityStarted(activity: Activity) {}

    override fun onActivityResumed(activity: Activity) {}

    override fun onActivityPaused(activity: Activity) {}

    override fun onActivityStopped(activity: Activity) {}

    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}

    override fun onActivityDestroyed(activity: Activity) {}
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
