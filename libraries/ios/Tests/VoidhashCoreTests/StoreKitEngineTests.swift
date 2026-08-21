import Foundation
import Testing

@testable import VoidhashCore

@Suite("StoreKit engine")
struct StoreKitEngineTests {
    @Test("store calls before initConnection report STOREKIT_NOT_INITIALIZED")
    func requiresInitConnection() async {
        let engine = StoreKitEngine()

        await #expect(throws: VoidhashStoreError.storeKitNotInitialized) {
            _ = try await engine.getItems(skus: ["com.voidhash.pro"])
        }
        await #expect(throws: VoidhashStoreError.storeKitNotInitialized) {
            _ = try await engine.getPurchasedItems(onlyIncludeActiveItems: true)
        }
        await #expect(throws: VoidhashStoreError.storeKitNotInitialized) {
            _ = try await engine.buyProduct(
                sku: "com.voidhash.pro", appAccountToken: "", quantity: 1)
        }
    }

    @Test("endConnection without a connection is a no-op")
    func endConnectionWithoutConnection() async throws {
        let engine = StoreKitEngine()

        #expect(try await engine.endConnection() == false)
    }

    @Test("finishing an unknown transaction reports TRANSACTION_NOT_FOUND")
    func finishUnknownTransaction() async {
        let engine = StoreKitEngine()

        await #expect(throws: VoidhashStoreError.transactionNotFound) {
            try await engine.finishTransaction(transactionId: "42")
        }
    }

    @Test("pending transactions start empty")
    func pendingTransactionsStartEmpty() throws {
        let engine = StoreKitEngine()

        #expect(try engine.getPendingTransactions().isEmpty)
    }

    @Test("the engine protocol is mockable without StoreKit")
    func protocolIsMockable() async throws {
        let engine: StoreKitEngineProtocol = MockStoreKitEngine()

        #expect(try await engine.initConnection(onTransaction: nil))
        #expect(try await engine.getItems(skus: ["com.voidhash.pro"]).first?.id == "com.voidhash.pro")

        let transaction = try await engine.buyProduct(
            sku: "com.voidhash.pro", appAccountToken: UUID().uuidString, quantity: 1)
        #expect(transaction.sku == "com.voidhash.pro")
        #expect(transaction.type == .subscription)
    }
}

/// Mock engine proving the protocol covers the full surface the SDKs need.
final class MockStoreKitEngine: StoreKitEngineProtocol, @unchecked Sendable {
    func initConnection(onTransaction: StoreKitTransactionListener?) async throws -> Bool {
        return true
    }

    @discardableResult
    func endConnection() async throws -> Bool {
        return true
    }

    func getItems(skus: [String]) async throws -> [StoreKitProductInfo] {
        return skus.map { sku in
            StoreKitProductInfo(
                id: sku,
                type: "autoRenewable",
                displayName: "Pro",
                description: "Pro plan",
                displayPrice: "59,99 \u{20ac}",
                price: 59.99,
                currency: "EUR",
                debugDescription: nil,
                isFamilyShareable: false,
                subscription: StoreKitSubscriptionInfo(
                    introductoryOffer: nil,
                    promotionalOffers: [],
                    subscriptionGroupID: "group",
                    subscriptionPeriod: StoreKitSubscriptionPeriod(unit: .month, value: 1)
                )
            )
        }
    }

    func getPurchasedItems(onlyIncludeActiveItems: Bool) async throws -> [StoreKitTransactionInfo] {
        return []
    }

    func buyProduct(sku: String, appAccountToken: String, quantity: Double) async throws
        -> StoreKitTransactionInfo
    {
        return MockStoreKitEngine.transaction(sku: sku, appAccountToken: appAccountToken)
    }

    func finishTransaction(transactionId: String) async throws {}

    func getPendingTransactions() throws -> [StoreKitTransactionInfo] {
        return []
    }

    func presentCodeRedemptionSheet() throws {}

    func showManageSubscriptions() async throws {}

    static func transaction(sku: String, appAccountToken: String) -> StoreKitTransactionInfo {
        return StoreKitTransactionInfo(
            id: sku,
            ids: [sku],
            transactionId: "2000000012345678",
            transactionDate: 1_700_000_000_000,
            transactionReceipt: "{}",
            quantityIos: 1,
            originalTransactionDateIos: 1_700_000_000_000,
            originalTransactionIdentifierIos: "2000000012345678",
            appAccountToken: appAccountToken,
            appBundleIdIos: "com.voidhash.example",
            productTypeIos: "Auto-Renewable Subscription",
            subscriptionGroupIdIos: "group",
            webOrderLineItemIdIos: nil,
            expirationDateIos: 1_700_000_000_000,
            isUpgradedIos: false,
            ownershipTypeIos: "PURCHASED",
            revocationDateIos: nil,
            revocationReasonIos: nil,
            transactionReasonIos: "PURCHASE",
            jwsRepresentationIos: nil,
            environmentIos: "Sandbox",
            storefrontCountryCodeIos: "DEU",
            reasonIos: "PURCHASE",
            offerIos: nil,
            priceIos: 59990,
            currencyIos: "EUR",
            type: .subscription,
            sku: sku
        )
    }
}
