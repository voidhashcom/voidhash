package com.margelo.nitro.voidhash

import android.app.Dialog
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.view.Gravity
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

@Keep
@DoNotStrip
class HybridPaywallPresenter : HybridPaywallPresenterSpec() {
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

    override fun preload(locationSlug: String, htmlUrl: String): Promise<Boolean> {
        return Promise.async {
            runOnMain {
                val entry = getOrCreateEntry(locationSlug, htmlUrl)
                ensureLoaded(entry)
                true
            }
        }
    }

    override fun show(
        locationSlug: String,
        htmlUrl: String,
        onBridgeEvent: ((rawEvent: String) -> Unit)?,
        onDismiss: (() -> Unit)?,
    ): Promise<Boolean> {
        return Promise.async {
            runOnMain {
                if (activeDialog != null) {
                    dismissActiveDialog(notify = false)
                }

                val entry = getOrCreateEntry(locationSlug, htmlUrl)
                entry.onBridgeEvent = onBridgeEvent
                entry.onDismiss = onDismiss
                ensureLoaded(entry)

                val activity = NitroModules.applicationContext?.currentActivity
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
    }

    override fun dismiss(): Promise<Unit> {
        return Promise.async {
            runOnMain {
                dismissActiveDialog(notify = true)
                Unit
            }
        }
    }

    override fun release(locationSlug: String) {
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

    override fun postMessage(locationSlug: String, data: String) {
        runOnMainThread {
            val entry = entriesByLocation[locationSlug] ?: return@runOnMainThread
            val encoded = Base64.encodeToString(data.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
            val script =
                "(function(){const d=atob('$encoded');window.dispatchEvent(new MessageEvent('message',{data:d}));if(typeof window.onVoidhashNativeMessage==='function'){window.onVoidhashNativeMessage(d);}})();"
            entry.webView.evaluateJavascript(script, null)
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

        val appContext = NitroModules.applicationContext
            ?: throw Error("PAYWALL_PRESENTER_NOT_AVAILABLE: React application context is not available")

        val webView = WebView(appContext).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            addJavascriptInterface(Bridge(locationSlug), "ReactNativeWebView")
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, url: String?) {
                    super.onPageFinished(view, url)
                    entriesByLocation[locationSlug]?.isLoaded = true
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
        @JavascriptInterface
        fun postMessage(data: String) {
            entriesByLocation[locationSlug]?.onBridgeEvent?.invoke(data)
        }
    }
}
