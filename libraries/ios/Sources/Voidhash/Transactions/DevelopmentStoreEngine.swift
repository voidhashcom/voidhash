import Foundation
import VoidhashCore

#if canImport(UIKit)
    import SwiftUI
    import UIKit
#endif

/// The mock store behind development mode.
///
/// Synthesizes products from the schema's computed `providers.development` entries and
/// confirms purchases with an in-app sheet instead of StoreKit, so an integration can be
/// validated end-to-end without an App Store Connect setup. Only constructible in debug
/// builds — release builds always use the real store engine.
public final class DevelopmentStoreEngine: StoreKitEngineProtocol, @unchecked Sendable {
    /// Artificial latency so loading states behave like the real store flow.
    private static let purchaseLatencyMilliseconds: UInt64 = 600

    private let lock = NSLock()
    private var catalog: [String: RuntimeDevelopmentProductConfiguration] = [:]
    private let now: @Sendable () -> Double
    private let uuid: @Sendable () -> String

    #if canImport(UIKit)
        private let windowSceneProvider: any WindowSceneProviding
    #endif

    public init(
        now: @escaping @Sendable () -> Double = { Date().timeIntervalSince1970 * 1000 },
        uuid: @escaping @Sendable () -> String = { UUID().uuidString.lowercased() }
    ) {
        self.now = now
        self.uuid = uuid
        #if canImport(UIKit)
            windowSceneProvider = DefaultWindowSceneProvider()
        #endif
    }

    /// Replaces the purchasable catalog from a freshly resolved schema. When several products
    /// share a development product id, the one whose slug sorts first is sold under it, and is
    /// the product the purchase is recorded for
    /// (``PurchaseOrchestrator/resolveProductDefinition(_:products:)``).
    public func updateCatalog(_ schema: RuntimeSchema) {
        let configurations = schema.products.values.sorted { $0.slug < $1.slug }
            .compactMap { definition in
                definition.configuration.providers.development.map { ($0.productId, $0) }
            }
        lock.withLock {
            catalog = Dictionary(configurations, uniquingKeysWith: { first, _ in first })
        }
    }

    public func initConnection(onTransaction: StoreKitTransactionListener?) async throws -> Bool {
        return true
    }

    public func endConnection() async throws -> Bool {
        return true
    }

    /// Nothing: development products are built from the schema, see
    /// ``VoidhashProduct/init(definition:development:)``.
    public func getItems(skus: [String], appAccountToken: String?) async throws
        -> [StoreKitProductInfo]
    {
        return []
    }

    /// The configuration the product `sku` is sold under.
    func configuration(for sku: String) -> RuntimeDevelopmentProductConfiguration? {
        return lock.withLock { catalog[sku] }
    }

    /// The development store has no external account state to refresh.
    public func syncStore() async throws {}

    public func getPurchasedItems(onlyIncludeActiveItems: Bool) async throws
        -> [StoreKitTransactionInfo]
    {
        // Dev purchases live server-side keyed by the derived account token; the person
        // snapshot carries entitlements, so there is nothing to replay from a store.
        return []
    }

    public func buyProduct(sku: String, request: StoreKitPurchaseRequest) async throws
        -> StoreKitPurchaseResult
    {
        guard let configuration = configuration(for: sku) else {
            throw VoidhashStoreError.invalidProductId
        }

        #if canImport(UIKit)
            let confirmed = try await presentConfirmationSheet(
                product: sku, configuration: configuration)
            guard confirmed else {
                return .cancelled
            }
        #else
            throw VoidhashStoreError.paywallPresenterNotAvailable
        #endif

        // Keeps loading states honest, mirroring the React Native mock store.
        try? await Task.sleep(nanoseconds: Self.purchaseLatencyMilliseconds * 1_000_000)

        return .purchased(
            Self.transaction(
                sku: sku, configuration: configuration, appAccountToken: request.appAccountToken,
                quantity: request.quantity, transactionId: uuid(), timestamp: now()))
    }

    /// What the confirmation sheet says the product costs: the price per whole billing period,
    /// `24,99 US$ / 3 months` for a quarterly plan as on Android, and the price alone for a
    /// lifetime product.
    static func priceLabel(of configuration: RuntimeDevelopmentProductConfiguration) -> String {
        let price = configuration.price.formatted(.currency(code: configuration.currencyCode))
        guard let unit = VoidhashPeriod.Unit(rawValue: configuration.period) else {
            return price
        }
        let period = VoidhashPeriod(unit: unit, count: Int(configuration.periodCount))
        return "\(price) / \(period.count == 1 ? period.unit.rawValue : period.description)"
    }

    /// The simulated transaction of a confirmed purchase of `sku`.
    static func transaction(
        sku: String, configuration: RuntimeDevelopmentProductConfiguration,
        appAccountToken: String, quantity: Int, transactionId: String, timestamp: Double
    ) -> StoreKitTransactionInfo {
        let purchaseDate = Date(timeIntervalSince1970: timestamp / 1000)
        // `productId` is the product, as on a transaction of the real store: the purchase is
        // recorded for the product it resolves to.
        return StoreKitTransactionInfo(
            transactionId: transactionId,
            originalTransactionId: transactionId,
            productId: sku,
            purchaseDate: purchaseDate,
            expirationDate: nil,
            quantity: quantity,
            appAccountToken: appAccountToken,
            productType: configuration.period == "lifetime" ? .nonConsumable : .autoRenewable,
            isRenewal: false,
            offer: nil,
            environment: .development,
            appStore: VoidhashAppStoreTransactionInfo(
                ownershipType: .purchased, storefrontCountryCode: nil, isUpgraded: false,
                revocationDate: nil, revocationReason: nil, appTransactionId: nil,
                jwsRepresentation: ""))
    }

    public func finishTransaction(transactionId: String) async throws {}

    public func getPendingTransactions() throws -> [StoreKitTransactionInfo] {
        return []
    }

    #if canImport(UIKit)
        /// Presents the confirmation sheet above whatever is on screen (including the paywall
        /// WebView) and suspends until the user picks an action.
        @discardableResult
        @MainActor
        private func presentConfirmationSheet(
            product: String, configuration: RuntimeDevelopmentProductConfiguration
        ) async throws -> Bool {
            let scene = windowSceneProvider.currentWindowScene()
            guard let presenter = Self.topViewController(from: scene?.keyWindow?.rootViewController)
            else {
                throw VoidhashStoreError.windowSceneNotFound
            }

            return try await withCheckedThrowingContinuation { continuation in
                let settler = SheetSettler(continuation: continuation)
                let content = DevelopmentPurchaseConfirmationView(
                    productId: product,
                    priceLabel: Self.priceLabel(of: configuration),
                    onConfirm: { settler.settle(with: true) },
                    onCancel: { settler.settle(with: false) }
                )
                let controller = ConfirmationSheetController(rootView: content)
                controller.onDismissed = { settler.settle(with: false) }
                controller.modalPresentationStyle = .formSheet
                #if !os(visionOS)
                    if #available(iOS 16.0, *) {
                        controller.sheetPresentationController?.detents = [.medium()]
                    }
                #endif
                settler.controller = controller
                presenter.present(controller, animated: true)
            }
        }

        @MainActor
        private static func topViewController(from base: UIViewController?) -> UIViewController? {
            if let navigation = base as? UINavigationController {
                return topViewController(from: navigation.visibleViewController)
            }
            if let tab = base as? UITabBarController, let selected = tab.selectedViewController {
                return topViewController(from: selected)
            }
            if let presented = base?.presentedViewController {
                return topViewController(from: presented)
            }
            return base
        }
    #endif
}

#if canImport(UIKit)
    /// Resumes the awaiting purchase exactly once and dismisses the sheet, whichever action
    /// (or double tap) wins the race.
    final class SheetSettler: @unchecked Sendable {
        private let lock = NSLock()
        private var settled = false
        private let continuation: CheckedContinuation<Bool, any Error>
        weak var controller: UIViewController?

        init(continuation: CheckedContinuation<Bool, any Error>) {
            self.continuation = continuation
        }

        func settle(with confirmed: Bool) {
            let shouldResume = lock.withLock {
                if settled {
                    return false
                }
                settled = true
                return true
            }
            guard shouldResume else {
                return
            }
            let controller = controller
            Task { @MainActor in
                controller?.dismiss(animated: true)
            }
            continuation.resume(returning: confirmed)
        }
    }

    /// Hosts the confirmation sheet and cancels the purchase when the sheet goes away without
    /// an answer: swiped down, or dismissed along with whatever presented it. Neither reaches
    /// the sheet's buttons, and the purchase call would wait for them for good.
    final class ConfirmationSheetController: UIHostingController<
        DevelopmentPurchaseConfirmationView
    >
    {
        var onDismissed: (() -> Void)?

        override func viewDidDisappear(_ animated: Bool) {
            super.viewDidDisappear(animated)
            // Covered by another presentation, the sheet is still there to answer.
            if isBeingDismissed || presentingViewController == nil {
                onDismissed?()
            }
        }
    }

    /// The dev-mode confirmation sheet. Explicitly labelled as a test purchase so nobody
    /// mistakes it for a real charge.
    struct DevelopmentPurchaseConfirmationView: View {
        let productId: String
        let priceLabel: String
        let onConfirm: () -> Void
        let onCancel: () -> Void

        var body: some View {
            VStack(spacing: 16) {
                Text("Test Purchase")
                    .font(.headline)
                Text(productId)
                    .font(.title3.bold())
                Text(priceLabel)
                    .font(.body)
                Text("Nothing will be charged.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                VStack(spacing: 8) {
                    Button(action: onConfirm) {
                        Text("Purchase")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    Button(action: onCancel) {
                        Text("Cancel")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }
            }
            .padding(24)
        }
    }
#endif
