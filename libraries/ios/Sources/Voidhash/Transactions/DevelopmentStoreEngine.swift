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

    /// Replaces the purchasable catalog from a freshly resolved schema.
    public func updateCatalog(_ schema: RuntimeSchema) {
        lock.withLock {
            catalog = Dictionary(
                uniqueKeysWithValues: schema.products.values.compactMap { definition in
                    guard let configuration = definition.configuration.providers.development else {
                        return nil
                    }
                    return (configuration.productId, configuration)
                })
        }
    }

    public func initConnection(onTransaction: StoreKitTransactionListener?) async throws -> Bool {
        return true
    }

    public func endConnection() async throws -> Bool {
        return true
    }

    public func getItems(skus: [String]) async throws -> [StoreKitProductInfo] {
        return skus.compactMap { sku in
            guard let configuration = lock.withLock({ catalog[sku] }) else {
                return nil
            }
            return Self.productInfo(for: configuration)
        }
    }

    public func getPurchasedItems(onlyIncludeActiveItems: Bool) async throws
        -> [StoreKitTransactionInfo]
    {
        // Dev purchases live server-side keyed by the derived account token; the person
        // snapshot carries entitlements, so there is nothing to replay from a store.
        return []
    }

    public func buyProduct(sku: String, appAccountToken: String, quantity: Double) async throws
        -> StoreKitTransactionInfo
    {
        guard let configuration = lock.withLock({ catalog[sku] }) else {
            throw VoidhashStoreError.invalidProductId
        }

        #if canImport(UIKit)
            let confirmed = try await presentConfirmationSheet(product: sku, configuration: configuration)
            guard confirmed else {
                throw VoidhashStoreError.userCancelled
            }
        #else
            throw VoidhashStoreError.paywallPresenterNotAvailable
        #endif

        // Keeps loading states honest, mirroring the React Native mock store.
        try? await Task.sleep(nanoseconds: Self.purchaseLatencyMilliseconds * 1_000_000)

        let transactionId = uuid()
        let timestamp = now()
        return StoreKitTransactionInfo(
            id: transactionId,
            ids: [sku],
            transactionId: transactionId,
            transactionDate: timestamp,
            transactionReceipt: "",
            quantityIos: quantity,
            originalTransactionDateIos: timestamp,
            originalTransactionIdentifierIos: transactionId,
            appAccountToken: appAccountToken,
            appBundleIdIos: Bundle.main.bundleIdentifier ?? "",
            productTypeIos: "Development",
            subscriptionGroupIdIos: nil,
            webOrderLineItemIdIos: nil,
            expirationDateIos: nil,
            isUpgradedIos: nil,
            ownershipTypeIos: "PURCHASED",
            revocationDateIos: nil,
            revocationReasonIos: nil,
            transactionReasonIos: "PURCHASE",
            jwsRepresentationIos: nil,
            environmentIos: "Development",
            storefrontCountryCodeIos: nil,
            reasonIos: nil,
            offerIos: nil,
            priceIos: configuration.price,
            currencyIos: configuration.currencyCode,
            type: configuration.period == "lifetime" ? .inapp : .subscription,
            sku: sku
        )
    }

    public func finishTransaction(transactionId: String) async throws {}

    public func getPendingTransactions() throws -> [StoreKitTransactionInfo] {
        return []
    }

    public func presentCodeRedemptionSheet() throws {
        throw VoidhashStoreError.methodNotAvailableOnPlatform(
            "Offer codes are not available in development mode")
    }

    public func showManageSubscriptions() async throws {
        throw VoidhashStoreError.methodNotAvailableOnPlatform(
            "Subscription management is not available in development mode")
    }

    static func productInfo(for configuration: RuntimeDevelopmentProductConfiguration)
        -> StoreKitProductInfo
    {
        let priceLabel = "$" + String(format: "%.2f", configuration.price)
        let periodLabel =
            configuration.period == "lifetime"
            ? "" : " / \(configuration.period)"
        return StoreKitProductInfo(
            id: configuration.productId,
            type: configuration.period == "lifetime" ? "inapp" : "subscription",
            displayName: configuration.productId,
            description: "Development purchase",
            displayPrice: priceLabel + periodLabel,
            price: configuration.price,
            currency: configuration.currencyCode,
            debugDescription: nil,
            isFamilyShareable: false,
            subscription: nil
        )
    }

    #if canImport(UIKit)
        /// Presents the confirmation sheet above whatever is on screen (including the paywall
        /// WebView) and suspends until the user picks an action.
        @discardableResult
        private func presentConfirmationSheet(
            product: String, configuration: RuntimeDevelopmentProductConfiguration
        ) async throws -> Bool {
            let scene = await windowSceneProvider.currentWindowScene()
            guard let presenter = await Self.topViewController(from: scene?.keyWindow?.rootViewController)
            else {
                throw VoidhashStoreError.windowSceneNotFound
            }

            return try await withCheckedThrowingContinuation { continuation in
                let settler = SheetSettler(continuation: continuation)
                let content = DevelopmentPurchaseConfirmationView(
                    productId: product,
                    price: configuration.price,
                    period: configuration.period,
                    currencyCode: configuration.currencyCode,
                    onConfirm: { settler.settle(with: true) },
                    onCancel: { settler.settle(with: false) }
                )
                let controller = UIHostingController(rootView: content)
                controller.modalPresentationStyle = .formSheet
                if #available(iOS 16.0, *) {
                    controller.sheetPresentationController?.detents = [.medium()]
                }
                settler.controller = controller
                Task { @MainActor in
                    presenter.present(controller, animated: true)
                }
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

    /// The dev-mode confirmation sheet. Explicitly labelled as a test purchase so nobody
    /// mistakes it for a real charge.
    struct DevelopmentPurchaseConfirmationView: View {
        let productId: String
        let price: Double
        let period: String
        let currencyCode: String
        let onConfirm: () -> Void
        let onCancel: () -> Void

        private var priceLabel: String {
            let formatted = String(format: "%.2f", price)
            return period == "lifetime" ? "$\(formatted)" : "$\(formatted) / \(period)"
        }

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
