import Foundation
import NitroModules
import UIKit
import WebKit

private final class PaywallPresenterBridgeDelegate: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
    weak var owner: HybridPaywallPresenter?
    private let locationSlug: String

    init(owner: HybridPaywallPresenter, locationSlug: String) {
        self.owner = owner
        self.locationSlug = locationSlug
        super.init()
    }

    func webView(_ webView: WKWebView, didFinish _: WKNavigation!) {
        owner?.setLoaded(locationSlug: locationSlug, loaded: true)
        owner?.injectBridgeShim(webView: webView)
    }

    func userContentController(_: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "reactNative" else { return }

        if let raw = message.body as? String {
            owner?.emitBridgeEvent(locationSlug: locationSlug, rawEvent: raw)
            return
        }

        owner?.emitBridgeEvent(locationSlug: locationSlug, rawEvent: String(describing: message.body))
    }
}

private final class WarmedPaywallEntry {
    let locationSlug: String
    let webView: WKWebView
    let delegate: PaywallPresenterBridgeDelegate

    var htmlUrl: String
    var isLoaded: Bool
    var onBridgeEvent: ((_ rawEvent: String) -> Void)?
    var onDismiss: (() -> Void)?

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

            closeButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            closeButton.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -12),
        ])
    }

    @objc private func closeTapped() {
        onClose()
    }
}

class HybridPaywallPresenter: HybridPaywallPresenterSpec {
    private var entriesByLocation: [String: WarmedPaywallEntry] = [:]
    private weak var modalViewController: PaywallPresenterViewController?
    private var activeLocationSlug: String?

    func preload(locationSlug: String, htmlUrl: String) throws -> Promise<Bool> {
        Promise.async {
            try await self.onMain {
                let entry = self.getOrCreateEntry(locationSlug: locationSlug, htmlUrl: htmlUrl)
                self.ensureEntryLoaded(entry)
                return true
            }
        }
    }

    func show(
        locationSlug: String,
        htmlUrl: String,
        onBridgeEvent: ((_ rawEvent: String) -> Void)?,
        onDismiss: (() -> Void)?
    ) throws -> Promise<Bool> {
        Promise.async {
            try await self.onMain {
                if self.activeLocationSlug != nil {
                    self.dismissActiveModal(notify: false)
                }

                let entry = self.getOrCreateEntry(locationSlug: locationSlug, htmlUrl: htmlUrl)
                entry.onBridgeEvent = onBridgeEvent
                entry.onDismiss = onDismiss
                self.ensureEntryLoaded(entry)

                guard let presenter = self.getTopViewController() else {
                    throw RuntimeError.error(withMessage: "PAYWALL_PRESENTER_NOT_AVAILABLE: Could not resolve active UIViewController")
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
    }

    func dismiss() throws -> Promise<Void> {
        Promise.async {
            try await self.onMain {
                self.dismissActiveModal(notify: true)
            }
        }
    }

    func release(locationSlug: String) throws {
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
            entry.webView.configuration.userContentController.removeScriptMessageHandler(forName: "reactNative")
            entry.webView.removeFromSuperview()
        }
    }

    func postMessage(locationSlug: String, data: String) throws {
        Task { @MainActor in
            guard let webView = self.entriesByLocation[locationSlug]?.webView else {
                return
            }

            let encoded = Data(data.utf8).base64EncodedString()
            let script = "(function(){const d=atob('" + encoded + "');window.dispatchEvent(new MessageEvent('message',{data:d}));if(typeof window.onVoidhashNativeMessage==='function'){window.onVoidhashNativeMessage(d);}})();"
            webView.evaluateJavaScript(script)
        }
    }

    fileprivate func setLoaded(locationSlug: String, loaded: Bool) {
        entriesByLocation[locationSlug]?.isLoaded = loaded
    }

    fileprivate func emitBridgeEvent(locationSlug: String, rawEvent: String) {
        entriesByLocation[locationSlug]?.onBridgeEvent?(rawEvent)
    }

    fileprivate func injectBridgeShim(webView: WKWebView) {
        let script = "window.ReactNativeWebView = window.ReactNativeWebView || {}; window.ReactNativeWebView.postMessage = function(data) { window.webkit.messageHandlers.reactNative.postMessage(String(data)); };"
        webView.evaluateJavaScript(script)
    }

    @MainActor
    private func getOrCreateEntry(locationSlug: String, htmlUrl: String) -> WarmedPaywallEntry {
        if let existing = entriesByLocation[locationSlug] {
            if existing.htmlUrl != htmlUrl {
                existing.htmlUrl = htmlUrl
                existing.isLoaded = false
                if let url = URL(string: htmlUrl) {
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
        userContentController.add(delegate, name: "reactNative")

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

        guard let url = URL(string: entry.htmlUrl) else {
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

    @MainActor
    private func getTopViewController() -> UIViewController? {
        let activeScene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first(where: { $0.activationState == .foregroundActive })

        guard let root = activeScene?.windows.first(where: { $0.isKeyWindow })?.rootViewController
        else {
            return nil
        }

        var top = root
        while let presented = top.presentedViewController {
            top = presented
        }

        return top
    }

    private func onMain<T>(_ action: @MainActor @escaping () throws -> T) async throws -> T {
        try await MainActor.run {
            try action()
        }
    }
}
