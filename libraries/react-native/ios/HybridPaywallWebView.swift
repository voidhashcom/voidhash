import Foundation
import NitroModules
import UIKit
import VoidhashCore
import WebKit

private final class PaywallWebViewDelegate: NSObject, WKNavigationDelegate, WKUIDelegate,
    WKScriptMessageHandler
{
    weak var owner: HybridPaywallWebView?

    init(owner: HybridPaywallWebView?) {
        self.owner = owner
        super.init()
    }

    func userContentController(
        _: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        owner?.handleScriptMessage(message)
    }

    func webView(
        _ webView: WKWebView,
        didStartProvisionalNavigation _: WKNavigation!
    ) {
        owner?.handleLoadingStart(webView: webView)
    }

    func webView(
        _ webView: WKWebView,
        didFinish _: WKNavigation!
    ) {
        owner?.handleLoadingFinish(webView: webView)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        owner?.handleContentProcessDidTerminate(webView: webView)
    }

    func webView(
        _ webView: WKWebView,
        didFail navigation: WKNavigation!,
        withError error: Error
    ) {
        _ = navigation
        owner?.handleLoadingError(webView: webView, error: error)
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        _ = navigation
        owner?.handleLoadingError(webView: webView, error: error)
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        let shouldAllow = owner?.handleShouldStartLoad(
            webView: webView,
            navigationAction: navigationAction
        ) ?? true
        decisionHandler(shouldAllow ? .allow : .cancel)
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationResponse: WKNavigationResponse,
        decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void
    ) {
        owner?.handleNavigationResponse(
            webView: webView,
            navigationResponse: navigationResponse
        )
        decisionHandler(.allow)
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith _: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures _: WKWindowFeatures
    ) -> WKWebView? {
        owner?.handleOpenWindow(webView: webView, navigationAction: navigationAction)
        return nil
    }
}

class HybridPaywallWebView: HybridPaywallWebViewSpec {
    private let containerView: UIView = .init()
    private let delegate: PaywallWebViewDelegate
    private let refreshControl: UIRefreshControl = .init()
    private var webView: WKWebView
    private var progressObservation: NSKeyValueObservation?
    private var lockIdentifier: Double = 0

    var view: UIView { containerView }

    var source: PaywallWebViewSource? {
        didSet { loadSource() }
    }

    var javaScriptEnabled: Bool = true {
        didSet { updateJavaScriptConfig() }
    }
    var cacheEnabled: Bool = true
    var incognito: Bool = false

    var userAgent: String? {
        didSet { updateUserAgent() }
    }

    var applicationNameForUserAgent: String? {
        didSet { updateUserAgent() }
    }

    var injectedJavaScript: String? {
        didSet { rebuildUserScripts() }
    }

    var injectedJavaScriptBeforeContentLoaded: String? {
        didSet { rebuildUserScripts() }
    }

    var injectedJavaScriptForMainFrameOnly: Bool = true {
        didSet { rebuildUserScripts() }
    }

    var injectedJavaScriptBeforeContentLoadedForMainFrameOnly: Bool = true {
        didSet { rebuildUserScripts() }
    }

    var mediaPlaybackRequiresUserAction: Bool = true {
        didSet { updateMediaConfig() }
    }

    var allowsInlineMediaPlayback: Bool = false {
        didSet { updateMediaConfig() }
    }

    var allowsPictureInPictureMediaPlayback: Bool = true {
        didSet { updateMediaConfig() }
    }

    var allowsAirPlayForMediaPlayback: Bool = true {
        didSet { updateMediaConfig() }
    }

    var allowsFullscreenVideo: Bool = false
    var setSupportMultipleWindows: Bool = true
    var setBuiltInZoomControls: Bool = true
    var setDisplayZoomControls: Bool = false

    var scalesPageToFit: Bool = true {
        didSet {
            webView.scrollView.minimumZoomScale = scalesPageToFit ? 1.0 : 1.0
            webView.scrollView.maximumZoomScale = scalesPageToFit ? 1.0 : 1.0
        }
    }

    var thirdPartyCookiesEnabled: Bool = true
    var sharedCookiesEnabled: Bool = false
    var allowFileAccess: Bool = false
    var allowFileAccessFromFileURLs: Bool = false
    var allowUniversalAccessFromFileURLs: Bool = false

    var textZoom: Double = 100 {
        didSet { applyTextZoom() }
    }

    var overScrollMode: PaywallWebViewOverScrollModeType = .always
    var cacheMode: PaywallWebViewCacheMode = .loadDefault
    var mixedContentMode: PaywallWebViewMixedContentMode = .never
    var androidLayerType: PaywallWebViewAndroidLayerType = .none
    var geolocationEnabled: Bool = false

    var pullToRefreshEnabled: Bool = false {
        didSet {
            refreshControl.isEnabled = pullToRefreshEnabled
            webView.scrollView.bounces = pullToRefreshEnabled || bounces
        }
    }

    var nestedScrollEnabled: Bool = false

    var bounces: Bool = true {
        didSet { webView.scrollView.bounces = pullToRefreshEnabled || bounces }
    }

    var dataDetectorTypes: [PaywallWebViewDataDetectorType] = [.phonenumber]
    var originWhitelist: [String] = ["http://*", "https://*"]

    var messagingEnabled: Bool = false {
        didSet { rebuildUserScripts() }
    }

    var onLoadingStart: ((PaywallWebViewNavigationEvent) -> Void)?
    var onLoadingProgress: ((PaywallWebViewProgressEvent) -> Void)?
    var onLoadingFinish: ((PaywallWebViewNavigationEvent) -> Void)?
    var onLoadingError: ((PaywallWebViewErrorEvent) -> Void)?
    var onHttpError: ((PaywallWebViewHttpErrorEvent) -> Void)?
    var onMessage: ((PaywallWebViewMessageEvent) -> Void)?
    var onOpenWindow: ((PaywallWebViewOpenWindowEvent) -> Void)?
    var onFileDownload: ((PaywallWebViewFileDownloadEvent) -> Void)?
    var onRenderProcessGone: ((PaywallWebViewRenderProcessGoneEvent) -> Void)?
    var onContentProcessDidTerminate: ((PaywallWebViewBaseEvent) -> Void)?
    var onShouldStartLoadWithRequest: ((PaywallWebViewShouldStartLoadRequest) -> Bool)?

    override init() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = false
        config.defaultWebpagePreferences.allowsContentJavaScript = true

        webView = WKWebView(frame: .zero, configuration: config)
        delegate = PaywallWebViewDelegate(owner: nil)

        super.init()

        delegate.owner = self
        webView.navigationDelegate = delegate
        webView.uiDelegate = delegate
        webView.scrollView.refreshControl = refreshControl
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.frame = containerView.bounds
        containerView.addSubview(webView)

        refreshControl.addTarget(self, action: #selector(onRefreshPulled), for: .valueChanged)

        webView.configuration.userContentController.add(
            delegate, name: PaywallBridge.messageHandlerName)
        rebuildUserScripts()

        progressObservation = webView.observe(\.estimatedProgress, options: [.new]) {
            [weak self] webView, _ in
            guard let self else { return }
            self.emitProgress(webView: webView)
        }
    }

    deinit {
        progressObservation?.invalidate()
        webView.configuration.userContentController.removeScriptMessageHandler(
            forName: PaywallBridge.messageHandlerName)
    }

    @objc private func onRefreshPulled() {
        webView.reload()
    }

    func goBack() throws {
        webView.goBack()
    }

    func goForward() throws {
        webView.goForward()
    }

    func reload() throws {
        webView.reload()
    }

    func stopLoading() throws {
        webView.stopLoading()
    }

    func requestFocus() throws {
        webView.becomeFirstResponder()
    }

    func postMessage(data: String) throws {
        webView.evaluateJavaScript(PaywallBridge.inboundScript(json: data))
    }

    func injectJavaScript(javascript: String) throws {
        webView.evaluateJavaScript(javascript)
    }

    func loadUrl(url: String) throws {
        guard let webUrl = URL(string: url) else { return }
        webView.load(URLRequest(url: webUrl))
    }

    func clearFormData() throws {
        // Not available on iOS.
    }

    func clearHistory() throws {
        // No direct API on iOS.
    }

    func clearCache(includeDiskFiles: Bool) throws {
        let dataStore = webView.configuration.websiteDataStore
        var dataTypes = Set<String>()
        if includeDiskFiles {
            dataTypes = WKWebsiteDataStore.allWebsiteDataTypes()
        } else {
            dataTypes.insert(WKWebsiteDataTypeMemoryCache)
        }
        dataStore.removeData(ofTypes: dataTypes, modifiedSince: .distantPast) {}
    }

    fileprivate func handleScriptMessage(_ message: WKScriptMessage) {
        guard message.name == PaywallBridge.messageHandlerName else { return }
        guard messagingEnabled else { return }

        let data = String(describing: message.body)
        let event = PaywallWebViewMessageEvent(
            data: data,
            url: webView.url?.absoluteString ?? "",
            loading: webView.isLoading,
            title: webView.title ?? "",
            canGoBack: webView.canGoBack,
            canGoForward: webView.canGoForward,
            lockIdentifier: lockIdentifier
        )
        onMessage?(event)
    }

    fileprivate func handleLoadingStart(webView: WKWebView) {
        onLoadingStart?(navigationEvent(for: webView, navigationType: .other))
    }

    fileprivate func handleLoadingFinish(webView: WKWebView) {
        refreshControl.endRefreshing()
        applyTextZoom()
        onLoadingFinish?(navigationEvent(for: webView, navigationType: .other))
    }

    fileprivate func handleLoadingError(webView: WKWebView, error: Error) {
        refreshControl.endRefreshing()
        let nsError = error as NSError
        let event = PaywallWebViewErrorEvent(
            domain: nsError.domain,
            code: Double(nsError.code),
            description: nsError.localizedDescription,
            url: webView.url?.absoluteString ?? "",
            loading: webView.isLoading,
            title: webView.title ?? "",
            canGoBack: webView.canGoBack,
            canGoForward: webView.canGoForward,
            lockIdentifier: lockIdentifier
        )
        onLoadingError?(event)
    }

    fileprivate func handleContentProcessDidTerminate(webView: WKWebView) {
        let event = PaywallWebViewBaseEvent(
            url: webView.url?.absoluteString ?? "",
            loading: webView.isLoading,
            title: webView.title ?? "",
            canGoBack: webView.canGoBack,
            canGoForward: webView.canGoForward,
            lockIdentifier: lockIdentifier
        )
        onContentProcessDidTerminate?(event)
        onRenderProcessGone?(PaywallWebViewRenderProcessGoneEvent(didCrash: true))
    }

    fileprivate func handleOpenWindow(webView: WKWebView, navigationAction: WKNavigationAction) {
        _ = webView
        guard let url = navigationAction.request.url?.absoluteString else { return }
        onOpenWindow?(PaywallWebViewOpenWindowEvent(targetUrl: url))
    }

    fileprivate func handleNavigationResponse(
        webView: WKWebView,
        navigationResponse: WKNavigationResponse
    ) {
        guard navigationResponse.isForMainFrame else { return }
        guard let response = navigationResponse.response as? HTTPURLResponse else { return }
        guard response.statusCode >= 400 else { return }

        let event = PaywallWebViewHttpErrorEvent(
            description: HTTPURLResponse.localizedString(forStatusCode: response.statusCode),
            statusCode: Double(response.statusCode),
            url: response.url?.absoluteString ?? webView.url?.absoluteString ?? "",
            loading: webView.isLoading,
            title: webView.title ?? "",
            canGoBack: webView.canGoBack,
            canGoForward: webView.canGoForward,
            lockIdentifier: lockIdentifier
        )
        onHttpError?(event)
    }

    fileprivate func handleShouldStartLoad(
        webView: WKWebView,
        navigationAction: WKNavigationAction
    ) -> Bool {
        lockIdentifier += 1

        let url = navigationAction.request.url?.absoluteString ?? ""
        let request = PaywallWebViewShouldStartLoadRequest(
            isTopFrame: navigationAction.targetFrame?.isMainFrame ?? true,
            navigationType: mapNavigationType(navigationAction.navigationType),
            mainDocumentURL: navigationAction.request.mainDocumentURL?.absoluteString,
            url: url,
            loading: webView.isLoading,
            title: webView.title ?? "",
            canGoBack: webView.canGoBack,
            canGoForward: webView.canGoForward,
            lockIdentifier: lockIdentifier
        )

        if let shouldStart = onShouldStartLoadWithRequest?(request), !shouldStart {
            return false
        }

        return true
    }

    private func navigationEvent(
        for webView: WKWebView,
        navigationType: PaywallWebViewNavigationType
    ) -> PaywallWebViewNavigationEvent {
        PaywallWebViewNavigationEvent(
            navigationType: navigationType,
            mainDocumentURL: webView.url?.absoluteString,
            url: webView.url?.absoluteString ?? "",
            loading: webView.isLoading,
            title: webView.title ?? "",
            canGoBack: webView.canGoBack,
            canGoForward: webView.canGoForward,
            lockIdentifier: lockIdentifier
        )
    }

    private func emitProgress(webView: WKWebView) {
        onLoadingProgress?(
            PaywallWebViewProgressEvent(
                progress: webView.estimatedProgress,
                url: webView.url?.absoluteString ?? "",
                loading: webView.isLoading,
                title: webView.title ?? "",
                canGoBack: webView.canGoBack,
                canGoForward: webView.canGoForward,
                lockIdentifier: lockIdentifier
            ))
    }

    private func mapNavigationType(_ navigationType: WKNavigationType) -> PaywallWebViewNavigationType {
        switch navigationType {
        case .linkActivated:
            return .click
        case .formSubmitted:
            return .formsubmit
        case .backForward:
            return .backforward
        case .reload:
            return .reload
        case .formResubmitted:
            return .formresubmit
        case .other:
            return .other
        @unknown default:
            return .other
        }
    }

    private func updateMediaConfig() {
        webView.configuration.allowsInlineMediaPlayback = allowsInlineMediaPlayback
        updateJavaScriptConfig()
        webView.configuration.allowsAirPlayForMediaPlayback = allowsAirPlayForMediaPlayback
        webView.configuration.allowsPictureInPictureMediaPlayback =
            allowsPictureInPictureMediaPlayback
    }

    private func updateJavaScriptConfig() {
        webView.configuration.defaultWebpagePreferences.allowsContentJavaScript = javaScriptEnabled
    }

    private func updateUserAgent() {
        if let userAgent {
            webView.customUserAgent = userAgent
            return
        }

        guard let applicationNameForUserAgent, !applicationNameForUserAgent.isEmpty else {
            webView.customUserAgent = nil
            return
        }

        let defaultUserAgent = webView.value(forKey: "userAgent") as? String
        webView.customUserAgent = "\(defaultUserAgent ?? "") \(applicationNameForUserAgent)"
    }

    private func rebuildUserScripts() {
        let controller = webView.configuration.userContentController
        controller.removeAllUserScripts()

        if messagingEnabled {
            let script = WKUserScript(
                source: PaywallBridge.shimScript,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: false
            )
            controller.addUserScript(script)
        }

        if let injectedJavaScriptBeforeContentLoaded, !injectedJavaScriptBeforeContentLoaded.isEmpty
        {
            controller.addUserScript(
                WKUserScript(
                    source: injectedJavaScriptBeforeContentLoaded,
                    injectionTime: .atDocumentStart,
                    forMainFrameOnly: injectedJavaScriptBeforeContentLoadedForMainFrameOnly
                ))
        }

        if let injectedJavaScript, !injectedJavaScript.isEmpty {
            controller.addUserScript(
                WKUserScript(
                    source: injectedJavaScript,
                    injectionTime: .atDocumentEnd,
                    forMainFrameOnly: injectedJavaScriptForMainFrameOnly
                ))
        }
    }

    private func loadSource() {
        guard let source else { return }

        if let html = source.html {
            webView.loadHTMLString(html, baseURL: source.baseUrl.flatMap(URL.init(string:)))
            return
        }

        guard let urlString = source.uri, let url = URL(string: urlString) else {
            return
        }

        if (source.method ?? "GET").uppercased() == "POST", let body = source.body {
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.httpBody = body.data(using: .utf8)
            if let headers = source.headers {
                for header in headers {
                    request.setValue(header.value, forHTTPHeaderField: header.name)
                }
            }
            webView.load(request)
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = source.method ?? "GET"
        if let headers = source.headers {
            for header in headers {
                request.setValue(header.value, forHTTPHeaderField: header.name)
            }
        }
        webView.load(request)
    }

    private func applyTextZoom() {
        guard textZoom != 100 else { return }
        let script = "document.getElementsByTagName('body')[0].style.webkitTextSizeAdjust='\(textZoom)%'"
        webView.evaluateJavaScript(script)
    }
}
