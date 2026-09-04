import Foundation
import VoidhashCore

/// Callbacks a host app can observe while a paywall is presented.
///
/// Every method has a default no-op implementation. The coordinator holds the delegate weakly, so
/// the host has to keep its own strong reference for the lifetime of the paywall — an unretained
/// delegate is released and then silently receives nothing.
public protocol VoidhashPaywallDelegate: AnyObject, Sendable {
    /// A purchase started from the paywall completed.
    func paywall(_ locationSlug: String, didPurchaseProductId productId: String, requestId: String?)
    /// A restore started from the paywall completed.
    func paywallDidRestore(_ locationSlug: String, requestId: String?)
    /// A paywall action failed. `action` is `purchase` or `restore`.
    func paywall(
        _ locationSlug: String,
        didFailAction action: PaywallBridgeActionType,
        error: any Error,
        requestId: String?
    )
    /// The bundle emitted a custom analytics event.
    func paywall(
        _ locationSlug: String, didEmitEvent name: String, properties: [String: JSONValue])
    /// The bundle emitted a log line.
    func paywall(_ locationSlug: String, didLog message: String, level: String)
    /// The paywall was dismissed.
    func paywallDidDismiss(_ locationSlug: String)
}

extension VoidhashPaywallDelegate {
    public func paywall(
        _ locationSlug: String, didPurchaseProductId productId: String, requestId: String?
    ) {}
    public func paywallDidRestore(_ locationSlug: String, requestId: String?) {}
    public func paywall(
        _ locationSlug: String,
        didFailAction action: PaywallBridgeActionType,
        error: any Error,
        requestId: String?
    ) {}
    public func paywall(
        _ locationSlug: String, didEmitEvent name: String, properties: [String: JSONValue]
    ) {}
    public func paywall(_ locationSlug: String, didLog message: String, level: String) {}
    public func paywallDidDismiss(_ locationSlug: String) {}
}

/// Outcome of ``PaywallCoordinator/present(location:delegate:)``.
public enum PaywallPresentationResult: Sendable, Equatable {
    /// The paywall was presented.
    case shown
    /// The location resolved, but no published paywall is assigned to it.
    case notAssigned
    /// The presenter declined to present the paywall, or the SDK was misconfigured.
    ///
    /// Reserved for causes the developer can act on; a backend that is down or unreachable
    /// reports ``unavailable`` instead.
    case failed
    /// No configuration for this placement is cached and the backend could not be reached.
    ///
    /// The placement may well have a paywall; the device simply has never seen it. Show your own
    /// fallback, or nothing.
    case unavailable
}

/// Presents paywalls and speaks the bridge protocol on their behalf.
///
/// Mirrors the React Native `usePaywallByLocation` bridge handling: `ready` is answered with a
/// `configure` envelope, `purchase`/`restore` emit the status sequence and a terminal response,
/// `close` dismisses, `openExternal` opens a URL and `event`/`log` are forwarded to the delegate.
public actor PaywallCoordinator {
    private struct ResolvedPaywallEntry {
        let htmlUrl: String
        let runtime: SdkResolvedPaywall.Runtime?
    }

    private let presenter: any PaywallPresenting
    private let resolvePaywall: @Sendable (String) async throws -> SdkResolvedPaywall?
    private let getProducts: @Sendable () async throws -> [VoidhashProduct]
    private let purchaseProduct: @Sendable (VoidhashProduct) async throws -> Void
    private let restorePurchases: @Sendable () async throws -> Void
    private let captureEvent: @Sendable (String, [String: JSONValue]) -> Void
    private let openExternalUrl: @Sendable (String) async -> Void
    private let locale: String?
    private let warn: VoidhashWarningHandler

    private var resolvedByLocation: [String: ResolvedPaywallEntry] = [:]
    private var inFlightActionLocations: Set<String> = []
    /// Held weakly: the host owns the delegate, and a released one simply stops receiving events.
    private weak var delegate: (any VoidhashPaywallDelegate)?

    /// - Parameters:
    ///   - presenter: Presentation surface.
    ///   - resolvePaywall: Resolves the paywall currently assigned to a location slug.
    ///   - getProducts: Returns the products available for purchase.
    ///   - purchaseProduct: Runs a purchase through the SDK client.
    ///   - restorePurchases: Runs a restore through the SDK client.
    ///   - captureEvent: Routes bundle events into the analytics queue.
    ///   - openExternalUrl: Opens an external URL.
    ///   - locale: Locale identifier reported to the bundle.
    ///   - warn: Receives diagnostics the bundle never sees (an unparseable bridge message, a
    ///     degraded `configure` envelope).
    public init(
        presenter: any PaywallPresenting,
        resolvePaywall: @escaping @Sendable (String) async throws -> SdkResolvedPaywall?,
        getProducts: @escaping @Sendable () async throws -> [VoidhashProduct],
        purchaseProduct: @escaping @Sendable (VoidhashProduct) async throws -> Void,
        restorePurchases: @escaping @Sendable () async throws -> Void,
        captureEvent: @escaping @Sendable (String, [String: JSONValue]) -> Void,
        openExternalUrl: @escaping @Sendable (String) async -> Void,
        locale: String? = nil,
        warn: @escaping VoidhashWarningHandler = VoidhashWarnings.standard
    ) {
        self.presenter = presenter
        self.resolvePaywall = resolvePaywall
        self.getProducts = getProducts
        self.purchaseProduct = purchaseProduct
        self.restorePurchases = restorePurchases
        self.captureEvent = captureEvent
        self.openExternalUrl = openExternalUrl
        self.locale = locale
        self.warn = warn
    }

    func preload(locationSlug: String, htmlUrl: String) async throws -> Bool {
        try await presenter.preload(locationSlug: locationSlug, htmlUrl: htmlUrl)
    }

    /// Resolves and presents the paywall assigned to `location`.
    ///
    /// - Parameter delegate: Held weakly — keep a strong reference to it for as long as the
    ///   paywall is presented, or its callbacks silently stop firing.
    @discardableResult
    public func present(location: String, delegate: (any VoidhashPaywallDelegate)? = nil)
        async throws -> PaywallPresentationResult
    {
        self.delegate = delegate

        let resolved: SdkResolvedPaywall?
        do {
            resolved = try await resolvePaywall(location)
        } catch {
            // Transport is never a `failed`: there is simply nothing cached to show.
            warn("Paywall \"\(location)\" is unavailable: \(errorMessage(error))")
            return .unavailable
        }
        guard let release = resolved?.showing.paywallRelease, !release.htmlUrl.isEmpty else {
            return .notAssigned
        }

        resolvedByLocation[location] = ResolvedPaywallEntry(
            htmlUrl: release.htmlUrl, runtime: release.runtime)

        let presented = try await presenter.show(
            locationSlug: location,
            htmlUrl: release.htmlUrl,
            onBridgeEvent: { [weak self] rawEvent in
                guard let self else { return }
                Task { await self.handleBridgeEvent(locationSlug: location, rawEvent: rawEvent) }
            },
            onDismiss: { [weak self] in
                guard let self else { return }
                Task { await self.notifyDismissed(location) }
            }
        )

        guard presented else {
            return .failed
        }

        // The bundle announces `ready` exactly once at mount, which may have happened during a
        // preload whose handler is already gone — re-send the config after presenting.
        await sendConfigureMessage(locationSlug: location, requestId: nil)
        return .shown
    }

    /// Dismisses the presented paywall.
    public func dismiss() async throws {
        try await presenter.dismiss()
    }

    /// Handles one raw page → native bridge message.
    ///
    /// Messages that fail to parse are dropped after a warning carrying the contract error code,
    /// mirroring the React Native hook.
    public func handleBridgeEvent(locationSlug: String, rawEvent: String) async {
        let envelope: PaywallBridgeEnvelope
        do {
            envelope = try PaywallBridgeProtocol.parse(rawEvent)
        } catch {
            warn("Ignoring unparseable paywall bridge message: \(errorMessage(error))")
            return
        }

        switch envelope.type {
        case .ready:
            await sendConfigureMessage(locationSlug: locationSlug, requestId: envelope.requestId)
        case .close:
            try? await presenter.dismiss()
        case .openExternal:
            if let url = envelope.string("url") {
                await openExternalUrl(url)
            }
        case .event:
            guard let name = envelope.string("name") else {
                return
            }
            var properties = envelope.object("properties") ?? [:]
            properties["paywall_location"] = .string(locationSlug)
            captureEvent(name, properties)
            delegate?.paywall(locationSlug, didEmitEvent: name, properties: properties)
        case .log:
            guard let message = envelope.string("message") else {
                return
            }
            delegate?.paywall(
                locationSlug, didLog: message, level: envelope.string("level") ?? "info")
        case .purchase, .restore:
            await runBridgeAction(locationSlug: locationSlug, envelope: envelope)
        }
    }

    private func runBridgeAction(locationSlug: String, envelope: PaywallBridgeEnvelope) async {
        if inFlightActionLocations.contains(locationSlug) {
            let busyMessage = "Another paywall action is already running"
            delegate?.paywall(
                locationSlug,
                didFailAction: envelope.type,
                error: PaywallActionError(code: "ACTION_BUSY", message: busyMessage),
                requestId: envelope.requestId
            )
            presenter.postMessage(
                locationSlug: locationSlug,
                data: PaywallBridgeProtocol.errorResponse(
                    envelope.type, code: "ACTION_BUSY", message: busyMessage,
                    requestId: envelope.requestId)
            )
            return
        }

        inFlightActionLocations.insert(locationSlug)
        defer { inFlightActionLocations.remove(locationSlug) }

        do {
            if envelope.type == .purchase {
                try await runPurchase(locationSlug: locationSlug, envelope: envelope)
            } else {
                try await runRestore(locationSlug: locationSlug, envelope: envelope)
            }
        } catch {
            let message = errorMessage(error)
            presenter.postMessage(
                locationSlug: locationSlug,
                data: PaywallBridgeProtocol.statusMessage(
                    isCancellation(error) ? .cancelled : .failed,
                    requestId: envelope.requestId,
                    error: message)
            )
            delegate?.paywall(
                locationSlug, didFailAction: envelope.type, error: error,
                requestId: envelope.requestId)
            presenter.postMessage(
                locationSlug: locationSlug,
                data: PaywallBridgeProtocol.errorResponse(
                    envelope.type, code: errorCode(error), message: message,
                    requestId: envelope.requestId)
            )
        }
    }

    private func runPurchase(locationSlug: String, envelope: PaywallBridgeEnvelope) async throws {
        let requestedProductId = envelope.string("productId") ?? ""
        presenter.postMessage(
            locationSlug: locationSlug,
            data: PaywallBridgeProtocol.statusMessage(
                .purchasing, requestId: envelope.requestId, productId: requestedProductId)
        )

        let products = try await getProducts()
        guard let product = PaywallCoordinator.findProduct(products, id: requestedProductId) else {
            let message = "Product not found: \(requestedProductId)"
            delegate?.paywall(
                locationSlug,
                didFailAction: .purchase,
                error: PaywallActionError(code: "ACTION_FAILED", message: message),
                requestId: envelope.requestId
            )
            presenter.postMessage(
                locationSlug: locationSlug,
                data: PaywallBridgeProtocol.statusMessage(
                    .failed, requestId: envelope.requestId, error: message)
            )
            presenter.postMessage(
                locationSlug: locationSlug,
                data: PaywallBridgeProtocol.errorResponse(
                    .purchase, code: "ACTION_FAILED", message: message,
                    requestId: envelope.requestId)
            )
            return
        }

        try await purchaseProduct(product)

        delegate?.paywall(
            locationSlug, didPurchaseProductId: product.id, requestId: envelope.requestId)
        presenter.postMessage(
            locationSlug: locationSlug,
            data: PaywallBridgeProtocol.statusMessage(
                .purchased, requestId: envelope.requestId, productId: product.id)
        )
        presenter.postMessage(
            locationSlug: locationSlug,
            data: PaywallBridgeProtocol.successResponse(
                .purchase, requestId: envelope.requestId, data: ["productId": product.id])
        )
        try? await presenter.dismiss()
    }

    private func runRestore(locationSlug: String, envelope: PaywallBridgeEnvelope) async throws {
        presenter.postMessage(
            locationSlug: locationSlug,
            data: PaywallBridgeProtocol.statusMessage(.restoring, requestId: envelope.requestId)
        )

        try await restorePurchases()

        delegate?.paywallDidRestore(locationSlug, requestId: envelope.requestId)
        presenter.postMessage(
            locationSlug: locationSlug,
            data: PaywallBridgeProtocol.statusMessage(.restored, requestId: envelope.requestId)
        )
        presenter.postMessage(
            locationSlug: locationSlug,
            data: PaywallBridgeProtocol.successResponse(.restore, requestId: envelope.requestId)
        )
        try? await presenter.dismiss()
    }

    /// Answers a bundle's `ready` with the `configure` envelope for code releases.
    ///
    /// Visual-editor releases (no `runtime` block) receive nothing. When resolving the products
    /// fails, a warning is emitted and a degraded envelope — no products, the release's variables
    /// passed through — is sent so the paywall is never left configless.
    private func sendConfigureMessage(locationSlug: String, requestId: String?) async {
        guard let runtime = resolvedByLocation[locationSlug]?.runtime else {
            return
        }

        var products: [VoidhashProduct] = []
        do {
            products = try await getProducts()
        } catch {
            warn(
                "Sending a degraded paywall configure message for location \"\(locationSlug)\": \(errorMessage(error))"
            )
        }

        var productsBySlug: [String: VoidhashProduct] = [:]
        for product in products {
            productsBySlug[product.slug] = product
        }

        let config = PaywallRuntimeConfigBuilder.build(
            runtime: runtime,
            productsBySlug: productsBySlug,
            platform: SdkHeaders.platformName,
            locale: locale
        )

        presenter.postMessage(
            locationSlug: locationSlug,
            data: PaywallBridgeProtocol.configureMessage(config, requestId: requestId, warn: warn)
        )
    }

    private func notifyDismissed(_ locationSlug: String) {
        delegate?.paywallDidDismiss(locationSlug)
    }

    /// Resolves a bridge product identifier against the product id, the slug and the provider id,
    /// in that order — the lookup order of the React Native hook.
    static func findProduct(_ products: [VoidhashProduct], id: String) -> VoidhashProduct? {
        if let byId = products.first(where: { $0.id == id }) {
            return byId
        }
        if let bySlug = products.first(where: { $0.slug == id }) {
            return bySlug
        }
        return products.first { $0.providerProductId == id }
    }

    private func isCancellation(_ error: any Error) -> Bool {
        return (error as? VoidhashStoreError)?.code == "USER_CANCELLED"
    }

    private func errorCode(_ error: any Error) -> String {
        if let actionError = error as? PaywallActionError {
            return actionError.code
        }
        return "ACTION_FAILED"
    }

    private func errorMessage(_ error: any Error) -> String {
        if let storeError = error as? VoidhashStoreError {
            return storeError.description
        }
        if let apiError = error as? VoidhashApiError {
            return apiError.description
        }
        if let actionError = error as? PaywallActionError {
            return actionError.message
        }
        return String(describing: error)
    }
}

/// Error surfaced to the paywall bundle when an action cannot run.
public struct PaywallActionError: Error, Sendable, Equatable, CustomStringConvertible {
    /// Bridge error code, e.g. `ACTION_BUSY`.
    public let code: String
    /// Human readable message.
    public let message: String

    public init(code: String, message: String) {
        self.code = code
        self.message = message
    }

    public var description: String {
        return "\(code): \(message)"
    }
}
