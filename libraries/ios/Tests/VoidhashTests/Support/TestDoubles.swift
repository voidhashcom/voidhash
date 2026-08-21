import Foundation
import VoidhashCore

@testable import Voidhash

/// Records every call and serves scripted results, so the orchestrator and the client can be
/// driven without StoreKit.
final class MockStoreKitEngine: StoreKitEngineProtocol, @unchecked Sendable {
    private let lock = NSLock()

    private var products: [StoreKitProductInfo] = []
    private var purchasedItems: [StoreKitTransactionInfo] = []
    private var pendingItems: [StoreKitTransactionInfo] = []
    private var buyResult: Result<StoreKitTransactionInfo, any Error> = .failure(
        VoidhashStoreError.invalidProductId)
    private var finishError: (any Error)?
    private var initConnectionError: (any Error)?
    private var pendingTransactionsError: (any Error)?
    private var purchasedItemsError: (any Error)?

    private(set) var initConnectionCount = 0

    private(set) var finishedTransactionIds: [String] = []
    private(set) var boughtSkus: [String] = []
    private(set) var boughtAccountTokens: [String] = []
    private(set) var transactionListener: StoreKitTransactionListener?
    /// Invoked inside `buyProduct`, before the result is returned.
    var onBuyProduct: (@Sendable () -> Void)?

    func setProducts(_ products: [StoreKitProductInfo]) {
        lock.withLock { self.products = products }
    }

    func setPurchasedItems(_ items: [StoreKitTransactionInfo]) {
        lock.withLock { self.purchasedItems = items }
    }

    func setPendingItems(_ items: [StoreKitTransactionInfo]) {
        lock.withLock { self.pendingItems = items }
    }

    func setBuyResult(_ result: Result<StoreKitTransactionInfo, any Error>) {
        lock.withLock { self.buyResult = result }
    }

    func setFinishError(_ error: (any Error)?) {
        lock.withLock { self.finishError = error }
    }

    func setInitConnectionError(_ error: (any Error)?) {
        lock.withLock { self.initConnectionError = error }
    }

    func setPendingTransactionsError(_ error: (any Error)?) {
        lock.withLock { self.pendingTransactionsError = error }
    }

    func setPurchasedItemsError(_ error: (any Error)?) {
        lock.withLock { self.purchasedItemsError = error }
    }

    func initConnection(onTransaction: StoreKitTransactionListener?) async throws -> Bool {
        let error = lock.withLock { () -> (any Error)? in
            initConnectionCount += 1
            return initConnectionError
        }
        if let error {
            throw error
        }
        lock.withLock { self.transactionListener = onTransaction }
        return true
    }

    @discardableResult
    func endConnection() async throws -> Bool {
        return true
    }

    func getItems(skus: [String]) async throws -> [StoreKitProductInfo] {
        return lock.withLock { products.filter { skus.contains($0.id) } }
    }

    func getPurchasedItems(onlyIncludeActiveItems: Bool) async throws -> [StoreKitTransactionInfo] {
        if let error = lock.withLock({ purchasedItemsError }) {
            throw error
        }
        return lock.withLock { purchasedItems }
    }

    func buyProduct(sku: String, appAccountToken: String, quantity: Double) async throws
        -> StoreKitTransactionInfo
    {
        lock.withLock {
            boughtSkus.append(sku)
            boughtAccountTokens.append(appAccountToken)
        }
        onBuyProduct?()
        switch lock.withLock({ buyResult }) {
        case .success(let transaction):
            return transaction
        case .failure(let error):
            throw error
        }
    }

    func finishTransaction(transactionId: String) async throws {
        if let error = lock.withLock({ finishError }) {
            throw error
        }
        lock.withLock { finishedTransactionIds.append(transactionId) }
    }

    func getPendingTransactions() throws -> [StoreKitTransactionInfo] {
        if let error = lock.withLock({ pendingTransactionsError }) {
            throw error
        }
        return lock.withLock { pendingItems }
    }

    func presentCodeRedemptionSheet() throws {}

    func showManageSubscriptions() async throws {}
}

/// Captures the `sync-transaction` payloads and can be scripted to fail or to reject.
final class MockTransactionSync: TransactionSyncing, @unchecked Sendable {
    private let lock = NSLock()
    private var error: (any Error)?
    private var responseJson: String
    private(set) var bodies: [SdkSyncTransactionBody] = []
    private(set) var headerSets: [[String: String]] = []
    /// Invoked inside `syncTransaction`, before the response is produced.
    var onSync: (@Sendable () async -> Void)?

    init(error: (any Error)? = nil, responseJson: String = #"{"accepted": true}"#) {
        self.error = error
        self.responseJson = responseJson
    }

    func setError(_ error: (any Error)?) {
        lock.withLock { self.error = error }
    }

    func setResponseJson(_ json: String) {
        lock.withLock { self.responseJson = json }
    }

    func syncTransaction(headers: [String: String], body: SdkSyncTransactionBody) async throws
        -> SdkSyncTransactionResponse
    {
        lock.withLock {
            bodies.append(body)
            headerSets.append(headers)
        }
        await onSync?()
        if let error = lock.withLock({ self.error }) {
            throw error
        }
        return try JSONDecoder().decode(
            SdkSyncTransactionResponse.self, from: Data(lock.withLock { responseJson }.utf8))
    }
}

/// Collects the diagnostics the SDK routes through its warning hook.
final class WarningRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [String] = []

    var messages: [String] {
        return lock.withLock { storage }
    }

    /// The handler to hand to the component under test.
    var handler: VoidhashWarningHandler {
        return { [self] message in lock.withLock { storage.append(message) } }
    }

    func contains(_ fragment: String) -> Bool {
        return messages.contains { $0.contains(fragment) }
    }
}

/// Records the messages the coordinator delivers to the page.
final class MockPaywallPresenter: PaywallPresenting, @unchecked Sendable {
    private let lock = NSLock()

    private(set) var postedMessages: [String] = []
    private(set) var shownLocations: [String] = []
    private(set) var dismissCount = 0
    private(set) var bridgeEventHandler: PaywallRawEventHandler?
    private(set) var dismissHandler: PaywallDismissedHandler?
    var showResult = true

    func preload(locationSlug: String, htmlUrl: String) async throws -> Bool {
        return true
    }

    func show(
        locationSlug: String,
        htmlUrl: String,
        onBridgeEvent: PaywallRawEventHandler?,
        onDismiss: PaywallDismissedHandler?
    ) async throws -> Bool {
        lock.withLock {
            shownLocations.append(locationSlug)
            bridgeEventHandler = onBridgeEvent
            dismissHandler = onDismiss
        }
        return showResult
    }

    func dismiss() async throws {
        lock.withLock { dismissCount += 1 }
    }

    func postMessage(locationSlug: String, data: String) {
        lock.withLock { postedMessages.append(data) }
    }

    func release(locationSlug: String) {}

    /// Decoded envelopes of every message delivered so far.
    func messages() -> [[String: Any]] {
        return lock.withLock { postedMessages }.compactMap { raw in
            guard let data = raw.data(using: .utf8),
                let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            else {
                return nil
            }
            return object
        }
    }

    /// `type` of every message delivered so far, with `status` messages reported as their status.
    func messageKinds() -> [String] {
        return messages().map { message in
            let type = message["type"] as? String ?? "?"
            guard type == "status", let payload = message["payload"] as? [String: Any],
                let status = payload["status"] as? String
            else {
                return type
            }
            return "status:\(status)"
        }
    }

    func message(ofType type: String) -> [String: Any]? {
        return messages().first { ($0["type"] as? String) == type }
    }
}

/// Collects the coordinator's delegate callbacks.
final class RecordingPaywallDelegate: VoidhashPaywallDelegate, @unchecked Sendable {
    private let lock = NSLock()

    private(set) var purchasedProductIds: [String] = []
    private(set) var restoreCount = 0
    private(set) var failures: [(action: PaywallBridgeActionType, message: String)] = []
    private(set) var events: [(name: String, properties: [String: JSONValue])] = []
    private(set) var logs: [(message: String, level: String)] = []
    private(set) var dismissedLocations: [String] = []

    func paywall(
        _ locationSlug: String, didPurchaseProductId productId: String, requestId: String?
    ) {
        lock.withLock { purchasedProductIds.append(productId) }
    }

    func paywallDidRestore(_ locationSlug: String, requestId: String?) {
        lock.withLock { restoreCount += 1 }
    }

    func paywall(
        _ locationSlug: String,
        didFailAction action: PaywallBridgeActionType,
        error: any Error,
        requestId: String?
    ) {
        lock.withLock { failures.append((action, String(describing: error))) }
    }

    func paywall(
        _ locationSlug: String, didEmitEvent name: String, properties: [String: JSONValue]
    ) {
        lock.withLock { events.append((name, properties)) }
    }

    func paywall(_ locationSlug: String, didLog message: String, level: String) {
        lock.withLock { logs.append((message, level)) }
    }

    func paywallDidDismiss(_ locationSlug: String) {
        lock.withLock { dismissedLocations.append(locationSlug) }
    }
}

enum TestFixtures {
    static func storeTransaction(
        transactionId: String = "txn-1",
        productId: String = "com.example.pro.monthly",
        purchaseDate: Double = 1_700_000_000_000,
        appAccountToken: String? = "3501e751-7582-58f9-9c1d-533c7466049f",
        receipt: String = "signed-payload"
    ) -> StoreKitTransactionInfo {
        return StoreKitTransactionInfo(
            id: productId,
            ids: [productId],
            transactionId: transactionId,
            transactionDate: purchaseDate,
            transactionReceipt: receipt,
            quantityIos: 1,
            originalTransactionDateIos: purchaseDate,
            originalTransactionIdentifierIos: transactionId,
            appAccountToken: appAccountToken,
            appBundleIdIos: "com.example.app",
            productTypeIos: "autoRenewable",
            subscriptionGroupIdIos: "group-1",
            webOrderLineItemIdIos: nil,
            expirationDateIos: nil,
            isUpgradedIos: nil,
            ownershipTypeIos: "PURCHASED",
            revocationDateIos: nil,
            revocationReasonIos: nil,
            transactionReasonIos: "PURCHASE",
            jwsRepresentationIos: nil,
            environmentIos: "Sandbox",
            storefrontCountryCodeIos: "USA",
            reasonIos: nil,
            offerIos: nil,
            priceIos: 9.99,
            currencyIos: "USD",
            type: .subscription,
            sku: productId
        )
    }

    static func storeProduct(
        id: String = "com.example.pro.monthly",
        displayPrice: String = "59,99 €",
        price: Double = 59.99,
        currency: String = "EUR",
        periodUnit: StoreKitSubscriptionPeriodUnit? = .month
    ) -> StoreKitProductInfo {
        let subscription = periodUnit.map { unit in
            StoreKitSubscriptionInfo(
                introductoryOffer: nil,
                promotionalOffers: [],
                subscriptionGroupID: "group-1",
                subscriptionPeriod: StoreKitSubscriptionPeriod(unit: unit, value: 1)
            )
        }

        return StoreKitProductInfo(
            id: id,
            type: "autoRenewable",
            displayName: "Pro Monthly",
            description: "Everything in Pro",
            displayPrice: displayPrice,
            price: price,
            currency: currency,
            debugDescription: nil,
            isFamilyShareable: false,
            subscription: subscription
        )
    }

    static func productDefinition(
        slug: String = "pro-monthly",
        productId: String = "com.example.pro.monthly",
        type: String = "subscription"
    ) -> RuntimeProductDefinition {
        return RuntimeProductDefinition(
            slug: slug,
            type: type,
            properties: RuntimeProductProperties(name: "Pro Monthly"),
            configuration: RuntimeProductConfiguration(
                providers: RuntimeProductProviders(
                    appleAppStore: RuntimeAppleAppStoreProductConfiguration(productId: productId)
                )
            )
        )
    }

    static func schema(products: [RuntimeProductDefinition] = [productDefinition()])
        -> RuntimeSchema
    {
        var bySlug: [String: RuntimeProductDefinition] = [:]
        for product in products {
            bySlug[product.slug] = product
        }
        return RuntimeSchema(version: "v1", products: bySlug)
    }

    static func product(
        id: String = "com.example.pro.monthly",
        slug: String = "pro-monthly",
        displayPrice: String = "59,99 €",
        interval: String? = "month",
        price: Double = 59.99,
        providerProductId: String? = nil
    ) -> VoidhashProduct {
        return VoidhashProduct(
            id: id,
            slug: slug,
            name: "Pro Monthly",
            description: "Everything in Pro",
            displayName: "Pro Monthly",
            displayPrice: displayPrice,
            price: price,
            currency: "EUR",
            type: "autoRenewable",
            productType: "subscription",
            interval: interval,
            providerProductId: providerProductId
        )
    }

    static func makeCacheManager() -> CacheManager {
        return CacheManager(adapter: InMemoryCacheAdapter())
    }
}
