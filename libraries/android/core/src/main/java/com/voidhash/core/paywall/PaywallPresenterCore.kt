package com.voidhash.core.paywall

import android.app.Activity
import android.app.Dialog
import android.content.Context
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Shared fullscreen paywall presenter: keeps a warm `WebView` per location,
 * shows it inside a fullscreen dialog, and relays bridge messages both ways.
 *
 * Context and activity are resolved lazily through the injected providers so
 * the presenter always sees the host application's current state.
 *
 * @param onLoadFailed reports a main-frame load failure for a location; the
 *   paywall stays warm and is reloaded on the next `preload` / `show`.
 */
class PaywallPresenterCore(
    private val contextProvider: () -> Context?,
    private val activityProvider: () -> Activity?,
    private val onLoadFailed: (locationSlug: String, description: String) -> Unit = { _, _ -> },
) {
    private data class WarmedPaywallEntry(
        val locationSlug: String,
        val webView: WebView,
        var htmlUrl: String,
        var isLoaded: Boolean,
        var onBridgeEvent: ((String) -> Unit)?,
        var onDismiss: (() -> Unit)?,
    )

    private val mainHandler = Handler(Looper.getMainLooper())
    private val entriesByLocation = mutableMapOf<String, WarmedPaywallEntry>()

    private var activeDialog: Dialog? = null
    private var activeLocationSlug: String? = null
    private var notifyOnDismiss: Boolean = true

    /** Warms (or reloads) the paywall for [locationSlug] without presenting it. */
    suspend fun preload(locationSlug: String, htmlUrl: String): Boolean {
        return runOnMain {
            val entry = getOrCreateEntry(locationSlug, htmlUrl)
            ensureLoaded(entry)
            true
        }
    }

    /** Presents the paywall for [locationSlug] fullscreen, wiring the bridge callbacks. */
    suspend fun show(
        locationSlug: String,
        htmlUrl: String,
        onBridgeEvent: ((rawEvent: String) -> Unit)?,
        onDismiss: (() -> Unit)?,
    ): Boolean {
        return runOnMain {
            if (activeDialog != null) {
                dismissActiveDialog(notify = false)
            }

            val entry = getOrCreateEntry(locationSlug, htmlUrl)
            entry.onBridgeEvent = onBridgeEvent
            entry.onDismiss = onDismiss
            ensureLoaded(entry)

            val activity = activityProvider()
                ?: throw Error("PAYWALL_PRESENTER_NOT_AVAILABLE: Could not resolve current activity")

            val dialog = Dialog(activity, android.R.style.Theme_Black_NoTitleBar_Fullscreen)
            val rootLayout = FrameLayout(activity).apply {
                setBackgroundColor(Color.BLACK)
                layoutParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT,
                )
            }

            val closeButton = Button(activity).apply {
                text = "Close"
                setOnClickListener {
                    dismissActiveDialog(notify = true)
                }
            }

            (entry.webView.parent as? ViewGroup)?.removeView(entry.webView)

            rootLayout.addView(
                entry.webView,
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT,
                ),
            )

            val closeLayoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.TOP or Gravity.END,
            ).apply {
                setMargins(0, 64, 24, 0)
            }

            rootLayout.addView(closeButton, closeLayoutParams)

            dialog.setContentView(rootLayout)
            dialog.setCancelable(true)
            dialog.setOnDismissListener {
                val dismissedLocationSlug = activeLocationSlug
                activeDialog = null
                activeLocationSlug = null

                if (notifyOnDismiss && dismissedLocationSlug != null) {
                    entriesByLocation[dismissedLocationSlug]?.onDismiss?.invoke()
                }
                notifyOnDismiss = true
            }

            dialog.show()

            activeDialog = dialog
            activeLocationSlug = locationSlug

            true
        }
    }

    /** Dismisses the currently presented paywall, notifying its dismiss callback. */
    suspend fun dismiss() {
        runOnMain {
            dismissActiveDialog(notify = true)
        }
    }

    /** Destroys the warm entry for [locationSlug], dismissing it first if visible. */
    fun release(locationSlug: String) {
        runOnMainThread {
            if (activeLocationSlug == locationSlug) {
                dismissActiveDialog(notify = false)
            }

            val entry = entriesByLocation.remove(locationSlug) ?: return@runOnMainThread

            entry.onBridgeEvent = null
            entry.onDismiss = null
            entry.webView.stopLoading()
            (entry.webView.parent as? ViewGroup)?.removeView(entry.webView)
            entry.webView.destroy()
        }
    }

    /** Delivers a native → page bridge message to the paywall for [locationSlug]. */
    fun postMessage(locationSlug: String, data: String) {
        runOnMainThread {
            val entry = entriesByLocation[locationSlug] ?: return@runOnMainThread
            entry.webView.evaluateJavascript(PaywallBridge.inboundScript(data), null)
        }
    }

    private fun getOrCreateEntry(locationSlug: String, htmlUrl: String): WarmedPaywallEntry {
        val existing = entriesByLocation[locationSlug]
        if (existing != null) {
            if (existing.htmlUrl != htmlUrl) {
                existing.htmlUrl = htmlUrl
                existing.isLoaded = false
                existing.webView.loadUrl(htmlUrl)
            }
            return existing
        }

        val appContext = contextProvider()
            ?: throw Error("PAYWALL_PRESENTER_NOT_AVAILABLE: React application context is not available")

        val webView = WebView(appContext).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            addJavascriptInterface(Bridge(locationSlug), PaywallBridge.JS_INTERFACE_NAME)
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, url: String?) {
                    super.onPageFinished(view, url)
                    entriesByLocation[locationSlug]?.isLoaded = true
                    view.evaluateJavascript(PaywallBridge.MESSAGING_SHIM_SCRIPT, null)
                }

                override fun onReceivedError(
                    view: WebView,
                    request: WebResourceRequest,
                    error: WebResourceError,
                ) {
                    super.onReceivedError(view, request, error)
                    if (!request.isForMainFrame) {
                        return
                    }
                    onLoadFailed(locationSlug, "${error.errorCode}: ${error.description}")
                }
            }
        }

        val entry = WarmedPaywallEntry(
            locationSlug = locationSlug,
            webView = webView,
            htmlUrl = htmlUrl,
            isLoaded = false,
            onBridgeEvent = null,
            onDismiss = null,
        )

        entriesByLocation[locationSlug] = entry
        return entry
    }

    private fun ensureLoaded(entry: WarmedPaywallEntry) {
        if (entry.isLoaded) {
            return
        }

        entry.webView.loadUrl(entry.htmlUrl)
    }

    private fun dismissActiveDialog(notify: Boolean) {
        val dialog = activeDialog ?: return
        notifyOnDismiss = notify
        dialog.dismiss()
    }

    private suspend fun <T> runOnMain(action: () -> T): T {
        return suspendCancellableCoroutine { continuation ->
            mainHandler.post {
                try {
                    continuation.resume(action())
                } catch (error: Throwable) {
                    continuation.resumeWithException(error)
                }
            }
        }
    }

    private fun runOnMainThread(action: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            action()
            return
        }

        mainHandler.post {
            action()
        }
    }

    private inner class Bridge(
        private val locationSlug: String,
    ) {
        /**
         * Called on the WebView's JavaScript thread. The entry registry is only
         * ever mutated on the main thread, so the lookup hops there too rather
         * than reading it from under a concurrent write.
         */
        @JavascriptInterface
        fun postMessage(data: String) {
            runOnMainThread {
                entriesByLocation[locationSlug]?.onBridgeEvent?.invoke(data)
            }
        }
    }
}
