package com.margelo.nitro.voidhash

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.util.Base64
import android.view.View
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.annotation.Keep
import androidx.core.view.ViewCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext
import java.io.ByteArrayInputStream
import java.net.HttpURLConnection
import java.net.URL

@Keep
@DoNotStrip
@SuppressLint("SetJavaScriptEnabled")
class HybridPaywallWebView(
    private val reactContext: ThemedReactContext,
) : HybridPaywallWebViewSpec() {
    private val webView: WebView = WebView(reactContext)
    private val refreshLayout: SwipeRefreshLayout = SwipeRefreshLayout(reactContext)
    private var lockIdentifier: Double = 0.0
    @Volatile
    private var pendingPostRequest: PendingPostRequest? = null

    override val view: View = refreshLayout

    override var source: PaywallWebViewSource? = null
        set(value) {
            field = value
            loadSource(value)
        }

    override var javaScriptEnabled: Boolean = true
        set(value) {
            field = value
            webView.settings.javaScriptEnabled = value
        }

    override var cacheEnabled: Boolean = true
        set(value) {
            field = value
            if (!value) {
                webView.settings.cacheMode = WebSettings.LOAD_NO_CACHE
            }
        }

    override var incognito: Boolean = false
        set(value) {
            field = value
            if (value) {
                CookieManager.getInstance().removeAllCookies(null)
                CookieManager.getInstance().flush()
            }
        }

    override var userAgent: String? = null
        set(value) {
            field = value
            updateUserAgent()
        }

    override var applicationNameForUserAgent: String? = null
        set(value) {
            field = value
            updateUserAgent()
        }

    override var injectedJavaScript: String? = null
    override var injectedJavaScriptBeforeContentLoaded: String? = null

    override var injectedJavaScriptForMainFrameOnly: Boolean = true
    override var injectedJavaScriptBeforeContentLoadedForMainFrameOnly: Boolean = true

    override var mediaPlaybackRequiresUserAction: Boolean = true
        set(value) {
            field = value
            webView.settings.mediaPlaybackRequiresUserGesture = value
        }

    override var allowsInlineMediaPlayback: Boolean = false
    override var allowsPictureInPictureMediaPlayback: Boolean = true
    override var allowsAirPlayForMediaPlayback: Boolean = true

    override var allowsFullscreenVideo: Boolean = false
    override var setSupportMultipleWindows: Boolean = true
        set(value) {
            field = value
            webView.settings.setSupportMultipleWindows(value)
        }

    override var setBuiltInZoomControls: Boolean = true
        set(value) {
            field = value
            webView.settings.builtInZoomControls = value
        }

    override var setDisplayZoomControls: Boolean = false
        set(value) {
            field = value
            webView.settings.displayZoomControls = value
        }

    override var scalesPageToFit: Boolean = true
        set(value) {
            field = value
            webView.settings.useWideViewPort = value
            webView.settings.loadWithOverviewMode = value
        }

    override var thirdPartyCookiesEnabled: Boolean = true
        set(value) {
            field = value
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, value)
        }

    override var sharedCookiesEnabled: Boolean = false

    override var allowFileAccess: Boolean = false
        set(value) {
            field = value
            webView.settings.allowFileAccess = value
        }

    override var allowFileAccessFromFileURLs: Boolean = false
        set(value) {
            field = value
            webView.settings.allowFileAccessFromFileURLs = value
        }

    override var allowUniversalAccessFromFileURLs: Boolean = false
        set(value) {
            field = value
            webView.settings.allowUniversalAccessFromFileURLs = value
        }

    override var textZoom: Double = 100.0
        set(value) {
            field = value
            webView.settings.textZoom = value.toInt()
        }

    override var overScrollMode: PaywallWebViewOverScrollModeType =
        PaywallWebViewOverScrollModeType.ALWAYS
        set(value) {
            field = value
            webView.overScrollMode = when (value) {
                PaywallWebViewOverScrollModeType.NEVER -> WebView.OVER_SCROLL_NEVER
                PaywallWebViewOverScrollModeType.CONTENT -> WebView.OVER_SCROLL_IF_CONTENT_SCROLLS
                PaywallWebViewOverScrollModeType.ALWAYS -> WebView.OVER_SCROLL_ALWAYS
            }
        }

    override var cacheMode: PaywallWebViewCacheMode = PaywallWebViewCacheMode.LOAD_DEFAULT
        set(value) {
            field = value
            webView.settings.cacheMode = when (value) {
                PaywallWebViewCacheMode.LOAD_DEFAULT -> WebSettings.LOAD_DEFAULT
                PaywallWebViewCacheMode.LOAD_CACHE_ONLY -> WebSettings.LOAD_CACHE_ONLY
                PaywallWebViewCacheMode.LOAD_CACHE_ELSE_NETWORK -> WebSettings.LOAD_CACHE_ELSE_NETWORK
                PaywallWebViewCacheMode.LOAD_NO_CACHE -> WebSettings.LOAD_NO_CACHE
            }
        }

    override var mixedContentMode: PaywallWebViewMixedContentMode =
        PaywallWebViewMixedContentMode.NEVER
        set(value) {
            field = value
            webView.settings.mixedContentMode = when (value) {
                PaywallWebViewMixedContentMode.NEVER -> WebSettings.MIXED_CONTENT_NEVER_ALLOW
                PaywallWebViewMixedContentMode.ALWAYS -> WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                PaywallWebViewMixedContentMode.COMPATIBILITY -> WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            }
        }

    override var androidLayerType: PaywallWebViewAndroidLayerType =
        PaywallWebViewAndroidLayerType.NONE
        set(value) {
            field = value
            val layerType = when (value) {
                PaywallWebViewAndroidLayerType.NONE -> View.LAYER_TYPE_NONE
                PaywallWebViewAndroidLayerType.SOFTWARE -> View.LAYER_TYPE_SOFTWARE
                PaywallWebViewAndroidLayerType.HARDWARE -> View.LAYER_TYPE_HARDWARE
            }
            webView.setLayerType(layerType, null)
        }

    override var geolocationEnabled: Boolean = false
        set(value) {
            field = value
            webView.settings.setGeolocationEnabled(value)
        }

    override var pullToRefreshEnabled: Boolean = false
        set(value) {
            field = value
            refreshLayout.isEnabled = value
        }

    override var nestedScrollEnabled: Boolean = false
        set(value) {
            field = value
            ViewCompat.setNestedScrollingEnabled(webView, value)
        }

    override var bounces: Boolean = true

    override var dataDetectorTypes: Array<PaywallWebViewDataDetectorType> =
        arrayOf(PaywallWebViewDataDetectorType.PHONENUMBER)

    override var originWhitelist: Array<String> = arrayOf("http://*", "https://*")
    override var messagingEnabled: Boolean = false

    override var onLoadingStart: ((event: PaywallWebViewNavigationEvent) -> Unit)? = null
    override var onLoadingProgress: ((event: PaywallWebViewProgressEvent) -> Unit)? = null
    override var onLoadingFinish: ((event: PaywallWebViewNavigationEvent) -> Unit)? = null
    override var onLoadingError: ((event: PaywallWebViewErrorEvent) -> Unit)? = null
    override var onHttpError: ((event: PaywallWebViewHttpErrorEvent) -> Unit)? = null
    override var onMessage: ((event: PaywallWebViewMessageEvent) -> Unit)? = null
    override var onOpenWindow: ((event: PaywallWebViewOpenWindowEvent) -> Unit)? = null
    override var onFileDownload: ((event: PaywallWebViewFileDownloadEvent) -> Unit)? = null
    override var onRenderProcessGone: ((event: PaywallWebViewRenderProcessGoneEvent) -> Unit)? = null
    override var onContentProcessDidTerminate: ((event: PaywallWebViewBaseEvent) -> Unit)? = null
    override var onShouldStartLoadWithRequest: ((event: PaywallWebViewShouldStartLoadRequest) -> Boolean)? =
        null

    init {
        refreshLayout.addView(
            webView,
            SwipeRefreshLayout.LayoutParams(
                SwipeRefreshLayout.LayoutParams.MATCH_PARENT,
                SwipeRefreshLayout.LayoutParams.MATCH_PARENT,
            ),
        )

        refreshLayout.isEnabled = pullToRefreshEnabled
        refreshLayout.setOnRefreshListener {
            webView.reload()
        }

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.builtInZoomControls = true
        webView.settings.displayZoomControls = false
        webView.settings.setSupportMultipleWindows(true)
        webView.settings.mediaPlaybackRequiresUserGesture = true
        webView.settings.allowFileAccess = false
        webView.settings.allowFileAccessFromFileURLs = false
        webView.settings.allowUniversalAccessFromFileURLs = false
        webView.settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW

        webView.addJavascriptInterface(Bridge(), "ReactNativeWebView")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest,
            ): WebResourceResponse? {
                val pendingRequest = pendingPostRequest
                if (
                    pendingRequest != null &&
                    request.isForMainFrame &&
                    request.method.equals("POST", ignoreCase = true) &&
                    request.url.toString() == pendingRequest.uri
                ) {
                    pendingPostRequest = null
                    val interceptedResponse = executePostWithHeaders(pendingRequest)
                    if (interceptedResponse != null) {
                        return interceptedResponse
                    }
                }

                return super.shouldInterceptRequest(view, request)
            }

            override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                injectedJavaScriptBeforeContentLoaded?.let { script ->
                    if (script.isNotBlank()) {
                        view.evaluateJavascript(script, null)
                    }
                }
                onLoadingStart?.invoke(createNavigationEvent(url, PaywallWebViewNavigationType.OTHER))
            }

            override fun onPageFinished(view: WebView, url: String?) {
                super.onPageFinished(view, url)
                refreshLayout.isRefreshing = false
                injectMessagingShim()
                injectedJavaScript?.let { script ->
                    if (script.isNotBlank()) {
                        view.evaluateJavascript(script, null)
                    }
                }
                onLoadingProgress?.invoke(createProgressEvent(url, 1.0))
                onLoadingFinish?.invoke(createNavigationEvent(url, PaywallWebViewNavigationType.OTHER))
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest,
            ): Boolean {
                lockIdentifier += 1
                val shouldStartRequest = PaywallWebViewShouldStartLoadRequest(
                    isTopFrame = request.isForMainFrame,
                    navigationType = PaywallWebViewNavigationType.OTHER,
                    mainDocumentURL = request.url.toString(),
                    url = request.url.toString(),
                    loading = view.isLoading,
                    title = view.title ?: "",
                    canGoBack = view.canGoBack(),
                    canGoForward = view.canGoForward(),
                    lockIdentifier = lockIdentifier,
                )

                val shouldStart = onShouldStartLoadWithRequest?.invoke(shouldStartRequest) ?: true
                return !shouldStart
            }

            @Deprecated("Deprecated in Java")
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                lockIdentifier += 1
                val shouldStartRequest = PaywallWebViewShouldStartLoadRequest(
                    isTopFrame = true,
                    navigationType = PaywallWebViewNavigationType.OTHER,
                    mainDocumentURL = url,
                    url = url,
                    loading = view.isLoading,
                    title = view.title ?: "",
                    canGoBack = view.canGoBack(),
                    canGoForward = view.canGoForward(),
                    lockIdentifier = lockIdentifier,
                )
                val shouldStart = onShouldStartLoadWithRequest?.invoke(shouldStartRequest) ?: true
                return !shouldStart
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError,
            ) {
                super.onReceivedError(view, request, error)
                onLoadingError?.invoke(
                    PaywallWebViewErrorEvent(
                        domain = "android",
                        code = error.errorCode.toDouble(),
                        description = error.description.toString(),
                        url = request.url.toString(),
                        loading = view.isLoading,
                        title = view.title ?: "",
                        canGoBack = view.canGoBack(),
                        canGoForward = view.canGoForward(),
                        lockIdentifier = lockIdentifier,
                    ),
                )
            }

            override fun onReceivedHttpError(
                view: WebView,
                request: WebResourceRequest,
                errorResponse: WebResourceResponse,
            ) {
                super.onReceivedHttpError(view, request, errorResponse)
                onHttpError?.invoke(
                    PaywallWebViewHttpErrorEvent(
                        description = errorResponse.reasonPhrase ?: "HTTP Error",
                        statusCode = errorResponse.statusCode.toDouble(),
                        url = request.url.toString(),
                        loading = view.isLoading,
                        title = view.title ?: "",
                        canGoBack = view.canGoBack(),
                        canGoForward = view.canGoForward(),
                        lockIdentifier = lockIdentifier,
                    ),
                )
            }

            override fun onRenderProcessGone(
                view: WebView,
                detail: android.webkit.RenderProcessGoneDetail,
            ): Boolean {
                onRenderProcessGone?.invoke(
                    PaywallWebViewRenderProcessGoneEvent(didCrash = detail.didCrash()),
                )
                onContentProcessDidTerminate?.invoke(createBaseEvent(view.url))
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                super.onProgressChanged(view, newProgress)
                onLoadingProgress?.invoke(
                    createProgressEvent(view.url, (newProgress.toDouble() / 100.0).coerceIn(0.0, 1.0)),
                )
            }

            override fun onCreateWindow(
                view: WebView,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: android.os.Message,
            ): Boolean {
                @Suppress("UNUSED_VARIABLE")
                val ignored = listOf(isDialog, isUserGesture, resultMsg)
                val target = view.hitTestResult?.extra ?: view.url.orEmpty()
                onOpenWindow?.invoke(PaywallWebViewOpenWindowEvent(targetUrl = target))
                return false
            }
        }

        webView.setDownloadListener(
            DownloadListener { url, _, _, _, _ ->
                if (url != null) {
                    onFileDownload?.invoke(PaywallWebViewFileDownloadEvent(downloadUrl = url))
                }
            },
        )
    }

    override fun goBack() {
        if (webView.canGoBack()) {
            webView.goBack()
        }
    }

    override fun goForward() {
        if (webView.canGoForward()) {
            webView.goForward()
        }
    }

    override fun reload() {
        webView.reload()
    }

    override fun stopLoading() {
        webView.stopLoading()
    }

    override fun requestFocus() {
        webView.requestFocus()
    }

    override fun postMessage(data: String) {
        val encoded = Base64.encodeToString(data.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
        webView.evaluateJavascript(
            "window.dispatchEvent(new MessageEvent('message', { data: atob('$encoded') }));",
            null,
        )
    }

    override fun injectJavaScript(javascript: String) {
        webView.evaluateJavascript(javascript, null)
    }

    override fun loadUrl(url: String) {
        webView.loadUrl(url)
    }

    override fun clearFormData() {
        webView.clearFormData()
    }

    override fun clearHistory() {
        webView.clearHistory()
    }

    override fun clearCache(includeDiskFiles: Boolean) {
        webView.clearCache(includeDiskFiles)
    }

    private fun updateUserAgent() {
        val explicitUserAgent = userAgent
        if (!explicitUserAgent.isNullOrBlank()) {
            webView.settings.userAgentString = explicitUserAgent
            return
        }

        val applicationName = applicationNameForUserAgent
        if (!applicationName.isNullOrBlank()) {
            val defaultUserAgent = WebSettings.getDefaultUserAgent(reactContext)
            webView.settings.userAgentString = "$defaultUserAgent $applicationName"
            return
        }

        webView.settings.userAgentString = WebSettings.getDefaultUserAgent(reactContext)
    }

    private fun injectMessagingShim() {
        if (!messagingEnabled) {
            return
        }

        val script =
            "window.ReactNativeWebView = window.ReactNativeWebView || {};" +
                "window.ReactNativeWebView.postMessage = function(data) {" +
                "ReactNativeWebView.postMessage(String(data));" +
                "};"
        webView.evaluateJavascript(script, null)
    }

    private fun loadSource(value: PaywallWebViewSource?) {
        val sourceValue = value ?: return
        pendingPostRequest = null

        sourceValue.html?.let { html ->
            webView.loadDataWithBaseURL(
                sourceValue.baseUrl,
                html,
                "text/html",
                "UTF-8",
                null,
            )
            return
        }

        val uri = sourceValue.uri ?: return
        val method = sourceValue.method?.uppercase() ?: "GET"
        val headersMap = sourceValue.headers?.associate { it.name to it.value } ?: emptyMap()

        if (method == "POST" && sourceValue.body != null) {
            if (headersMap.isNotEmpty()) {
                pendingPostRequest = PendingPostRequest(
                    uri = uri,
                    body = sourceValue.body!!,
                    headers = headersMap,
                )
            }
            webView.postUrl(uri, sourceValue.body!!.toByteArray(Charsets.UTF_8))
            return
        }

        webView.loadUrl(uri, headersMap)
    }

    private fun executePostWithHeaders(pendingRequest: PendingPostRequest): WebResourceResponse? {
        val connection = (URL(pendingRequest.uri).openConnection() as? HttpURLConnection) ?: return null
        return try {
            connection.instanceFollowRedirects = true
            connection.requestMethod = "POST"
            connection.doInput = true
            connection.doOutput = true
            pendingRequest.headers.forEach { (name, value) ->
                connection.setRequestProperty(name, value)
            }
            connection.outputStream.use { outputStream ->
                outputStream.write(pendingRequest.body.toByteArray(Charsets.UTF_8))
            }

            val statusCode = connection.responseCode
            val reasonPhrase = connection.responseMessage ?: "HTTP Error"
            val contentType = connection.contentType
            val mimeType = contentType?.substringBefore(";")?.takeIf { it.isNotBlank() } ?: "text/html"
            val encoding = extractCharset(contentType) ?: "UTF-8"
            val responseHeaders = mutableMapOf<String, String>()
            connection.headerFields?.forEach { (name, values) ->
                if (name != null && !values.isNullOrEmpty()) {
                    responseHeaders[name] = values.joinToString(",")
                }
            }
            val bodyBytes = (
                if (statusCode >= 400) {
                    connection.errorStream
                } else {
                    connection.inputStream
                }
            )?.use { inputStream ->
                inputStream.readBytes()
            } ?: ByteArray(0)

            if (statusCode >= 400) {
                webView.post {
                    onHttpError?.invoke(
                        PaywallWebViewHttpErrorEvent(
                            description = reasonPhrase,
                            statusCode = statusCode.toDouble(),
                            url = pendingRequest.uri,
                            loading = webView.isLoading,
                            title = webView.title ?: "",
                            canGoBack = webView.canGoBack(),
                            canGoForward = webView.canGoForward(),
                            lockIdentifier = lockIdentifier,
                        ),
                    )
                }
            }

            WebResourceResponse(
                mimeType,
                encoding,
                statusCode,
                reasonPhrase,
                responseHeaders,
                ByteArrayInputStream(bodyBytes),
            )
        } catch (_: Exception) {
            null
        } finally {
            connection.disconnect()
        }
    }

    private fun extractCharset(contentType: String?): String? {
        if (contentType.isNullOrBlank()) {
            return null
        }

        return contentType
            .split(";")
            .map { it.trim() }
            .firstOrNull { it.startsWith("charset=", ignoreCase = true) }
            ?.substringAfter("=")
            ?.trim()
            ?.ifEmpty { null }
    }

    private fun createNavigationEvent(
        url: String?,
        navigationType: PaywallWebViewNavigationType,
    ): PaywallWebViewNavigationEvent {
        return PaywallWebViewNavigationEvent(
            navigationType = navigationType,
            mainDocumentURL = url,
            url = url.orEmpty(),
            loading = webView.isLoading,
            title = webView.title ?: "",
            canGoBack = webView.canGoBack(),
            canGoForward = webView.canGoForward(),
            lockIdentifier = lockIdentifier,
        )
    }

    private fun createProgressEvent(url: String?, progress: Double): PaywallWebViewProgressEvent {
        return PaywallWebViewProgressEvent(
            progress = progress,
            url = url.orEmpty(),
            loading = webView.isLoading,
            title = webView.title ?: "",
            canGoBack = webView.canGoBack(),
            canGoForward = webView.canGoForward(),
            lockIdentifier = lockIdentifier,
        )
    }

    private fun createBaseEvent(url: String?): PaywallWebViewBaseEvent {
        return PaywallWebViewBaseEvent(
            url = url.orEmpty(),
            loading = webView.isLoading,
            title = webView.title ?: "",
            canGoBack = webView.canGoBack(),
            canGoForward = webView.canGoForward(),
            lockIdentifier = lockIdentifier,
        )
    }

    private inner class Bridge {
        @JavascriptInterface
        fun postMessage(data: String) {
            val event = PaywallWebViewMessageEvent(
                data = data,
                url = webView.url.orEmpty(),
                loading = webView.isLoading,
                title = webView.title ?: "",
                canGoBack = webView.canGoBack(),
                canGoForward = webView.canGoForward(),
                lockIdentifier = lockIdentifier,
            )
            onMessage?.invoke(event)
        }
    }

    private data class PendingPostRequest(
        val uri: String,
        val body: String,
        val headers: Map<String, String>,
    )
}
