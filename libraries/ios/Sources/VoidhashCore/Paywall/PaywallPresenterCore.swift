import Foundation

/// Why a paywall WebView could not be loaded.
///
/// Reported through ``PaywallPresenterCore``'s `onLoadFailed` callback; the string form keeps the
/// cross-platform `"CODE: message"` shape.
public enum PaywallLoadFailure: Error, Sendable, Equatable, CustomStringConvertible {
    /// The release's `htmlUrl` is empty or not a loadable URL, so nothing was loaded.
    case invalidUrl(locationSlug: String, htmlUrl: String)
    /// The WebView navigation failed (offline, DNS, a 4xx/5xx on the bundle, …).
    case navigationFailed(locationSlug: String, message: String)

    public var description: String {
        switch self {
        case .invalidUrl(let locationSlug, let htmlUrl):
            return
                "PAYWALL_INVALID_URL: Invalid paywall url for location \"\(locationSlug)\": \"\(htmlUrl)\""
        case .navigationFailed(let locationSlug, let message):
            return
                "PAYWALL_LOAD_FAILED: The paywall for location \"\(locationSlug)\" failed to load - \(message)"
        }
    }
}

/// Invoked when a paywall WebView could not be loaded.
public typealias PaywallLoadFailureHandler = @Sendable (PaywallLoadFailure) -> Void

/// The `htmlUrl` of a paywall release.
public enum PaywallHtmlUrl {
    /// Parses the value a release carries.
    ///
    /// - Returns: `nil` when it is blank or cannot be turned into a URL to load.
    public static func parse(_ htmlUrl: String) -> URL? {
        guard !htmlUrl.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return nil
        }
        return URL(string: htmlUrl)
    }
}

#if canImport(UIKit)
    import UIKit
    import WebKit

    /// Raw bridge event (`page → native`) as delivered by the WebView.
    public typealias PaywallBridgeEventHandler = @Sendable (_ rawEvent: String) -> Void
    /// Invoked when the presented paywall is dismissed by the user.
    public typealias PaywallDismissHandler = @Sendable () -> Void

    /// Resolves the view controller a paywall is presented from.
    @MainActor
    public protocol PaywallPresentationContextProviding: AnyObject {
        func topViewController() -> UIViewController?
    }

    /// Default provider walking the key window of the foreground-active scene.
    @MainActor
    public final class DefaultPaywallPresentationContextProvider:
        PaywallPresentationContextProviding
    {
        public init() {}

        public func topViewController() -> UIViewController? {
            let activeScene = UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .first(where: { $0.activationState == .foregroundActive })

            guard let root = activeScene?.windows.first(where: { $0.isKeyWindow })?
                .rootViewController
            else {
                return nil
            }

            var top = root
            while let presented = top.presentedViewController {
                top = presented
            }

            return top
        }
    }

    private final class PaywallPresenterBridgeDelegate: NSObject, WKNavigationDelegate,
        WKScriptMessageHandler
    {
        weak var owner: PaywallPresenterCore?
        private let locationSlug: String

        init(owner: PaywallPresenterCore, locationSlug: String) {
            self.owner = owner
            self.locationSlug = locationSlug
            super.init()
        }

        func webView(_ webView: WKWebView, didFinish _: WKNavigation!) {
            owner?.setLoaded(locationSlug: locationSlug, loaded: true)
            owner?.injectBridgeShim(webView: webView)
        }

        func webView(_: WKWebView, didFail _: WKNavigation!, withError error: any Error) {
            reportLoadFailure(error)
        }

        func webView(
            _: WKWebView, didFailProvisionalNavigation _: WKNavigation!, withError error: any Error
        ) {
            reportLoadFailure(error)
        }

        // A failed load leaves the entry unloaded so the next `preload`/`show` retries it instead
        // of presenting a blank WebView forever.
        @MainActor
        private func reportLoadFailure(_ error: any Error) {
            owner?.setLoaded(locationSlug: locationSlug, loaded: false)
            owner?.reportLoadFailure(
                .navigationFailed(
                    locationSlug: locationSlug, message: error.localizedDescription))
        }

        func userContentController(_: WKUserContentController, didReceive message: WKScriptMessage)
        {
            guard message.name == PaywallBridge.messageHandlerName else { return }

            if let raw = message.body as? String {
                owner?.emitBridgeEvent(locationSlug: locationSlug, rawEvent: raw)
                return
            }

            owner?.emitBridgeEvent(
                locationSlug: locationSlug, rawEvent: String(describing: message.body))
        }
    }

    private final class WarmedPaywallEntry {
        let locationSlug: String
        let webView: WKWebView
        let delegate: PaywallPresenterBridgeDelegate

        var htmlUrl: String
        var isLoaded: Bool
        var onBridgeEvent: PaywallBridgeEventHandler?
        var onDismiss: PaywallDismissHandler?

        init(
            locationSlug: String,
            htmlUrl: String,
            webView: WKWebView,
            delegate: PaywallPresenterBridgeDelegate
        ) {
            self.locationSlug = locationSlug
            self.htmlUrl = htmlUrl
            self.webView = webView
            self.delegate = delegate
            self.isLoaded = false
        }
    }

    private final class PaywallPresenterViewController: UIViewController {
        let contentContainer = UIView()
        private let onClose: () -> Void

        init(onClose: @escaping () -> Void) {
            self.onClose = onClose
            super.init(nibName: nil, bundle: nil)
            modalPresentationStyle = .fullScreen
            view.backgroundColor = .black
        }

        @available(*, unavailable)
        required init?(coder _: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        override func viewDidLoad() {
            super.viewDidLoad()

            contentContainer.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(contentContainer)

            let closeButton = UIButton(type: .system)
            closeButton.setTitle("Close", for: .normal)
            closeButton.setTitleColor(.white, for: .normal)
            closeButton.backgroundColor = UIColor.black.withAlphaComponent(0.45)
            closeButton.layer.cornerRadius = 14
            closeButton.contentEdgeInsets = UIEdgeInsets(top: 8, left: 12, bottom: 8, right: 12)
            closeButton.translatesAutoresizingMaskIntoConstraints = false
            closeButton.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)

            view.addSubview(closeButton)

            NSLayoutConstraint.activate([
                contentContainer.topAnchor.constraint(equalTo: view.topAnchor),
                contentContainer.leadingAnchor.constraint(equalTo: view.leadingAnchor),
                contentContainer.trailingAnchor.constraint(equalTo: view.trailingAnchor),
                contentContainer.bottomAnchor.constraint(equalTo: view.bottomAnchor),

                closeButton.topAnchor.constraint(
                    equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
                closeButton.trailingAnchor.constraint(
                    equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -12),
            ])
        }

        @objc private func closeTapped() {
            onClose()
        }
    }

    /// Warm-cached WebView paywall presenter shared by the bare iOS SDK and the RN native layer.
    public final class PaywallPresenterCore: @unchecked Sendable {
        private var entriesByLocation: [String: WarmedPaywallEntry] = [:]
        private weak var modalViewController: PaywallPresenterViewController?
        private var activeLocationSlug: String?
        private let contextProvider: (@MainActor () -> PaywallPresentationContextProviding)
        private let onLoadFailed: PaywallLoadFailureHandler

        /// - Parameters:
        ///   - contextProvider: Resolves the view controller a paywall is presented from.
        ///   - onLoadFailed: Called when a paywall could not be loaded — an unusable `htmlUrl` or
        ///     a failed WebView navigation. Defaults to ignoring the failure.
        public init(
            contextProvider: @escaping @MainActor () -> PaywallPresentationContextProviding = {
                DefaultPaywallPresentationContextProvider()
            },
            onLoadFailed: @escaping PaywallLoadFailureHandler = { _ in }
        ) {
            self.contextProvider = contextProvider
            self.onLoadFailed = onLoadFailed
        }

        /// Warms (or reloads) the WebView backing a location without presenting it.
        @discardableResult
        public func preload(locationSlug: String, htmlUrl: String) async throws -> Bool {
            return try await onMain {
                let entry = self.getOrCreateEntry(locationSlug: locationSlug, htmlUrl: htmlUrl)
                self.ensureEntryLoaded(entry)
                return true
            }
        }

        /// Presents the paywall for a location, reusing the warmed WebView when available.
        @discardableResult
        public func show(
            locationSlug: String,
            htmlUrl: String,
            onBridgeEvent: PaywallBridgeEventHandler?,
            onDismiss: PaywallDismissHandler?
        ) async throws -> Bool {
            return try await onMain {
                if self.activeLocationSlug != nil {
                    self.dismissActiveModal(notify: false)
                }

                let entry = self.getOrCreateEntry(locationSlug: locationSlug, htmlUrl: htmlUrl)
                entry.onBridgeEvent = onBridgeEvent
                entry.onDismiss = onDismiss
                self.ensureEntryLoaded(entry)

                guard let presenter = self.contextProvider().topViewController() else {
                    throw VoidhashStoreError.paywallPresenterNotAvailable
                }

                let modal = PaywallPresenterViewController { [weak self] in
                    self?.dismissActiveModal(notify: true)
                }

                self.attachWebView(entry.webView, to: modal.contentContainer)
                presenter.present(modal, animated: true)

                self.modalViewController = modal
                self.activeLocationSlug = locationSlug
                return true
            }
        }

        /// Dismisses the presented paywall, notifying its dismiss handler.
        public func dismiss() async throws {
            try await onMain {
                self.dismissActiveModal(notify: true)
            }
        }

        /// Drops the warmed WebView for a location.
        public func release(locationSlug: String) {
            Task { @MainActor in
                if self.activeLocationSlug == locationSlug {
                    self.dismissActiveModal(notify: false)
                }

                guard let entry = self.entriesByLocation.removeValue(forKey: locationSlug) else {
                    return
                }

                entry.webView.stopLoading()
                entry.webView.navigationDelegate = nil
                entry.webView.uiDelegate = nil
                entry.webView.configuration.userContentController.removeScriptMessageHandler(
                    forName: PaywallBridge.messageHandlerName)
                entry.webView.removeFromSuperview()
            }
        }

        /// Delivers a native → page message to the WebView of a location.
        public func postMessage(locationSlug: String, data: String) {
            Task { @MainActor in
                guard let webView = self.entriesByLocation[locationSlug]?.webView else {
                    return
                }

                webView.evaluateJavaScript(PaywallBridge.inboundScript(json: data))
            }
        }

        @MainActor
        fileprivate func setLoaded(locationSlug: String, loaded: Bool) {
            entriesByLocation[locationSlug]?.isLoaded = loaded
        }

        fileprivate func reportLoadFailure(_ failure: PaywallLoadFailure) {
            onLoadFailed(failure)
        }

        @MainActor
        fileprivate func emitBridgeEvent(locationSlug: String, rawEvent: String) {
            entriesByLocation[locationSlug]?.onBridgeEvent?(rawEvent)
        }

        @MainActor
        fileprivate func injectBridgeShim(webView: WKWebView) {
            webView.evaluateJavaScript(PaywallBridge.shimScript)
        }

        @MainActor
        private func getOrCreateEntry(locationSlug: String, htmlUrl: String) -> WarmedPaywallEntry {
            if let existing = entriesByLocation[locationSlug] {
                if existing.htmlUrl != htmlUrl {
                    existing.htmlUrl = htmlUrl
                    existing.isLoaded = false
                    if let url = PaywallHtmlUrl.parse(htmlUrl) {
                        existing.webView.load(URLRequest(url: url))
                    }
                }
                return existing
            }

            let userContentController = WKUserContentController()
            let webConfig = WKWebViewConfiguration()
            webConfig.userContentController = userContentController
            webConfig.defaultWebpagePreferences.allowsContentJavaScript = true

            let webView = WKWebView(frame: .zero, configuration: webConfig)
            webView.translatesAutoresizingMaskIntoConstraints = false

            let delegate = PaywallPresenterBridgeDelegate(owner: self, locationSlug: locationSlug)
            webView.navigationDelegate = delegate
            userContentController.add(delegate, name: PaywallBridge.messageHandlerName)

            let entry = WarmedPaywallEntry(
                locationSlug: locationSlug,
                htmlUrl: htmlUrl,
                webView: webView,
                delegate: delegate
            )

            entriesByLocation[locationSlug] = entry
            return entry
        }

        @MainActor
        private func ensureEntryLoaded(_ entry: WarmedPaywallEntry) {
            guard !entry.isLoaded else {
                return
            }

            guard let url = PaywallHtmlUrl.parse(entry.htmlUrl) else {
                reportLoadFailure(
                    .invalidUrl(locationSlug: entry.locationSlug, htmlUrl: entry.htmlUrl))
                return
            }

            entry.webView.load(URLRequest(url: url))
        }

        @MainActor
        private func dismissActiveModal(notify: Bool) {
            guard let modal = modalViewController else {
                return
            }

            let locationSlug = activeLocationSlug
            modal.dismiss(animated: true)
            modalViewController = nil
            activeLocationSlug = nil

            if notify, let locationSlug, let entry = entriesByLocation[locationSlug] {
                entry.onDismiss?()
            }
        }

        @MainActor
        private func attachWebView(_ webView: WKWebView, to container: UIView) {
            webView.removeFromSuperview()
            container.addSubview(webView)

            NSLayoutConstraint.activate([
                webView.topAnchor.constraint(equalTo: container.topAnchor),
                webView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
                webView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
                webView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            ])
        }

        private func onMain<T>(_ action: @MainActor @escaping () throws -> T) async throws -> T
        where T: Sendable {
            return try await MainActor.run {
                try action()
            }
        }
    }
#endif
