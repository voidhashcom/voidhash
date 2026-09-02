import Foundation
import StoreKit

#if canImport(UIKit)
    import UIKit
#endif

/// Callback invoked when the store reports a new or updated transaction.
public typealias StoreKitTransactionListener = @Sendable (StoreKitTransactionInfo) -> Void

/// The StoreKit surface consumed by the SDKs, expressed as plain values so it can be mocked.
public protocol StoreKitEngineProtocol: AnyObject, Sendable {
    /// Opens the store connection and returns whether the device can make payments.
    ///
    /// `onTransaction` receives every transaction the store reports for the lifetime of the
    /// connection — purchases this engine made and purchases made outside it (another SDK,
    /// renewals, Ask to Buy approvals). The engine only retains and reports; it never finishes.
    func initConnection(onTransaction: StoreKitTransactionListener?) async throws -> Bool
    /// Tears down the store connection, dropping cached products and retained transactions.
    @discardableResult
    func endConnection() async throws -> Bool
    /// Fetches (and caches) store metadata for the given product identifiers.
    func getItems(skus: [String]) async throws -> [StoreKitProductInfo]
    /// Returns the customer's purchases, optionally limited to currently active entitlements.
    func getPurchasedItems(onlyIncludeActiveItems: Bool) async throws -> [StoreKitTransactionInfo]
    /// Buys a product previously fetched via ``getItems(skus:)``.
    func buyProduct(sku: String, appAccountToken: String, quantity: Double) async throws
        -> StoreKitTransactionInfo
    /// Finishes a retained transaction, removing it from the store queue.
    func finishTransaction(transactionId: String) async throws
    /// Transactions retained but not yet finished.
    func getPendingTransactions() throws -> [StoreKitTransactionInfo]
    /// Presents the offer code redemption sheet.
    func presentCodeRedemptionSheet() throws
    /// Presents the subscription management sheet and polls for auto-renew changes.
    func showManageSubscriptions() async throws
}

/// StoreKit 2 engine shared by the bare iOS SDK and the React Native native layer.
public final class StoreKitEngine: StoreKitEngineProtocol, @unchecked Sendable {
    private let transactions = TransactionRetentionStore<Transaction>()
    private let lock = NSLock()
    private var productStore: ProductStore?
    private var onTransactionListener: StoreKitTransactionListener?
    private var transactionUpdatesTask: Task<Void, Never>?
    private var subscriptionPollingTask: Task<Void, Never>?
    private var pollingSkus: Set<String> = []

    #if canImport(UIKit)
        private let windowSceneProvider: WindowSceneProviding

        public init(windowSceneProvider: WindowSceneProviding = DefaultWindowSceneProvider()) {
            self.windowSceneProvider = windowSceneProvider
        }
    #else
        public init() {}
    #endif

    public func initConnection(onTransaction: StoreKitTransactionListener?) async throws -> Bool {
        let previousUpdatesTask = lock.withLock {
            self.productStore = ProductStore()
            self.onTransactionListener = onTransaction
            let previous = transactionUpdatesTask
            transactionUpdatesTask = nil
            return previous
        }
        previousUpdatesTask?.cancel()
        startObservingTransactionUpdates()
        return AppStore.canMakePayments
    }

    @discardableResult
    public func endConnection() async throws -> Bool {
        guard let productStore = currentProductStore else {
            return false
        }
        await productStore.removeAll()
        transactions.removeAll()
        let updatesTask = lock.withLock {
            self.productStore = nil
            self.onTransactionListener = nil
            let task = transactionUpdatesTask
            transactionUpdatesTask = nil
            return task
        }
        updatesTask?.cancel()
        return true
    }

    /// Subscribes to `Transaction.updates` for the lifetime of the connection so transactions
    /// that did not go through ``buyProduct(sku:appAccountToken:quantity:)`` — renewals, Ask to
    /// Buy approvals, purchases made by another SDK in the same app — are retained and reported
    /// to the listener. Observer-mode hosts rely on this stream to collect anything at all.
    ///
    /// Transactions still unfinished when the connection opens (completed while the app was not
    /// running, or before the listener attached) are reported first, so nothing that landed in
    /// the store queue is ever missed.
    private func startObservingTransactionUpdates() {
        let task = Task { [weak self] in
            for await verification in Transaction.unfinished {
                guard let self, !Task.isCancelled else {
                    return
                }
                self.observe(verification)
            }
            for await verification in Transaction.updates {
                guard let self, !Task.isCancelled else {
                    return
                }
                self.observe(verification)
            }
        }
        lock.withLock {
            transactionUpdatesTask = task
        }
    }

    private func observe(_ verification: VerificationResult<Transaction>) {
        guard let transaction = try? Self.checkVerified(verification) else {
            return
        }
        transactions.retain(id: String(transaction.id), value: transaction)
        currentTransactionListener?(StoreKitTransactionInfo(transaction: transaction))
    }

    public func getItems(skus: [String]) async throws -> [StoreKitProductInfo] {
        guard let productStore = currentProductStore else {
            throw VoidhashStoreError.storeKitNotInitialized
        }
        let fetchedProducts = try await Product.products(for: skus)
        for product in fetchedProducts {
            await productStore.addProduct(product)
        }
        let products = await productStore.getAllProducts()
        return products.map { StoreKitProductInfo(product: $0) }
    }

    public func getPurchasedItems(onlyIncludeActiveItems: Bool) async throws
        -> [StoreKitTransactionInfo]
    {
        guard currentProductStore != nil else {
            throw VoidhashStoreError.storeKitNotInitialized
        }

        var purchasedItems: [StoreKitTransactionInfo] = []

        func addTransaction(transaction: Transaction) {
            transactions.retain(id: String(transaction.id), value: transaction)
            purchasedItems.append(StoreKitTransactionInfo(transaction: transaction))
        }

        for await verification in onlyIncludeActiveItems
            ? Transaction.currentEntitlements
            : Transaction.all
        {
            do {
                let transaction = try Self.checkVerified(verification)

                if !onlyIncludeActiveItems {
                    if transaction.productType != .consumable {
                        addTransaction(transaction: transaction)
                    }
                    continue
                }

                switch transaction.productType {
                case .nonConsumable, .autoRenewable:
                    addTransaction(transaction: transaction)
                case .consumable:
                    continue
                case .nonRenewable:
                    let currentDate = Date()
                    let expirationDate = Calendar(identifier: .gregorian).date(
                        byAdding: DateComponents(year: 1),
                        to: transaction.purchaseDate
                    )!
                    if currentDate < expirationDate {
                        addTransaction(transaction: transaction)
                    }
                default:
                    break
                }
            } catch {
                // Log error but continue processing other transactions
                print("Error processing transaction: \(error.localizedDescription)")
            }
        }

        return purchasedItems
    }

    public func buyProduct(sku: String, appAccountToken: String, quantity: Double) async throws
        -> StoreKitTransactionInfo
    {
        guard let productStore = currentProductStore else {
            throw VoidhashStoreError.storeKitNotInitialized
        }

        guard let product = await productStore.getProduct(productID: sku) else {
            throw VoidhashStoreError.invalidProductId
        }

        do {
            var options: Set<Product.PurchaseOption> = []

            if quantity > 0 {
                options.insert(.quantity(Int(quantity)))
            }

            if let appAccountUUID = UUID(uuidString: appAccountToken) {
                options.insert(.appAccountToken(appAccountUUID))
            }

            let result = try await purchase(product: product, options: options)

            switch result {
            case .success(let verification):
                let transaction = try Self.checkVerified(verification)
                transactions.retain(id: String(transaction.id), value: transaction)
                let transactionInfo = StoreKitTransactionInfo(transaction: transaction)
                currentTransactionListener?(transactionInfo)
                return transactionInfo

            case .userCancelled:
                throw VoidhashStoreError.userCancelled

            case .pending:
                throw VoidhashStoreError.purchasePending

            @unknown default:
                throw VoidhashStoreError.purchaseUnknownResult
            }
        } catch {
            if let storeError = error as? VoidhashStoreError {
                throw storeError
            }
            throw VoidhashStoreError.purchaseFailed(error.localizedDescription)
        }
    }

    public func finishTransaction(transactionId: String) async throws {
        guard let transaction = transactions.value(for: transactionId) else {
            throw VoidhashStoreError.transactionNotFound
        }

        await transaction.finish()
        transactions.remove(id: transactionId)
    }

    public func getPendingTransactions() throws -> [StoreKitTransactionInfo] {
        return transactions.values().map { StoreKitTransactionInfo(transaction: $0) }
    }

    public func presentCodeRedemptionSheet() throws {
        #if os(iOS)
            SKPaymentQueue.default().presentCodeRedemptionSheet()
        #elseif os(tvOS)
            throw VoidhashStoreError.methodNotAvailableTvOS(
                "presentCodeRedemptionSheet is not available on this platform")
        #else
            throw VoidhashStoreError.methodNotAvailableOnPlatform(
                "presentCodeRedemptionSheet is not available on this platform")
        #endif
    }

    public func showManageSubscriptions() async throws {
        #if canImport(UIKit) && !os(tvOS)
            guard let windowScene = await windowSceneProvider.currentWindowScene() else {
                throw VoidhashStoreError.windowSceneNotFound
            }
            // Get all subscription products before showing the management UI
            let subscriptionSkus = await getAllSubscriptionProductIds()
            lock.withLock {
                self.pollingSkus = Set(subscriptionSkus)
            }
            // Show the management UI
            try await AppStore.showManageSubscriptions(in: windowScene)
            // Start polling for status changes
            pollForSubscriptionStatusChanges()
        #elseif os(tvOS)
            throw VoidhashStoreError.methodNotAvailableTvOS(
                "presentCodeRedemptionSheet is not available on this platform")
        #else
            throw VoidhashStoreError.methodNotAvailableOnPlatform(
                "showManageSubscriptions is not available on this platform")
        #endif
    }

    // MARK: - Helper Methods

    private var currentProductStore: ProductStore? {
        return lock.withLock { productStore }
    }

    private var currentTransactionListener: StoreKitTransactionListener? {
        return lock.withLock { onTransactionListener }
    }

    private var currentPollingSkus: Set<String> {
        return lock.withLock { pollingSkus }
    }

    private func purchase(product: Product, options: Set<Product.PurchaseOption>) async throws
        -> Product.PurchaseResult
    {
        #if os(visionOS)
            guard let windowScene = await windowSceneProvider.currentWindowScene() else {
                throw VoidhashStoreError.windowSceneNotFound
            }
            return try await product.purchase(confirmIn: windowScene, options: options)
        #elseif canImport(UIKit)
            guard let windowScene = await windowSceneProvider.currentWindowScene() else {
                throw VoidhashStoreError.windowSceneNotFound
            }
            if #available(iOS 17.0, tvOS 17.0, *) {
                return try await product.purchase(confirmIn: windowScene, options: options)
            }
            return try await product.purchase(options: options)
        #else
            return try await product.purchase(options: options)
        #endif
    }

    private func pollForSubscriptionStatusChanges() {
        let previousTask = lock.withLock { subscriptionPollingTask }
        previousTask?.cancel()

        let task = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 1_500_000_000)  // 1.5 seconds
            guard let self else { return }

            var previousStatuses: [String: Bool] = [:]  // Track auto-renewal state with Bool

            for sku in self.currentPollingSkus {
                guard let product = await self.currentProductStore?.getProduct(productID: sku),
                    let status = try? await product.subscription?.status.first
                else { continue }

                // Track willAutoRenew as a bool value
                var willAutoRenew = false
                if case .verified(let info) = status.renewalInfo {
                    willAutoRenew = info.willAutoRenew
                }
                previousStatuses[sku] = willAutoRenew
            }

            for _ in 1...5 {
                try? await Task.sleep(nanoseconds: 2_000_000_000)  // 2 seconds
                if Task.isCancelled {
                    return
                }

                for sku in self.currentPollingSkus {
                    guard let product = await self.currentProductStore?.getProduct(productID: sku),
                        let status = try? await product.subscription?.status.first,
                        let result = await product.latestTransaction
                    else { continue }
                    // Try to verify the transaction
                    let transaction: Transaction
                    do {
                        transaction = try Self.checkVerified(result)
                    } catch {
                        continue  // Skip if verification fails
                    }

                    // Track current auto-renewal state
                    var currentWillAutoRenew = false
                    if case .verified(let info) = status.renewalInfo {
                        currentWillAutoRenew = info.willAutoRenew
                    }

                    // Compare with previous state
                    if let previousWillAutoRenew = previousStatuses[sku],
                        previousWillAutoRenew != currentWillAutoRenew
                    {
                        self.currentTransactionListener?(
                            StoreKitTransactionInfo(transaction: transaction))
                        previousStatuses[sku] = currentWillAutoRenew
                    }
                }
            }

            self.lock.withLock {
                self.pollingSkus.removeAll()
            }
        }

        lock.withLock {
            subscriptionPollingTask = task
        }
    }

    private func getAllSubscriptionProductIds() async -> [String] {
        guard let productStore = currentProductStore else { return [] }
        let products = await productStore.getAllProducts()
        return products.compactMap { product in
            if product.subscription != nil {
                return product.id
            }
            return nil
        }
    }

    private static func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified:
            throw VoidhashStoreError.transactionVerificationFailed
        case .verified(let safe):
            return safe
        }
    }
}
