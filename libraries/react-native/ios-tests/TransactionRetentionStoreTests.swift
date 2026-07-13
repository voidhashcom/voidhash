import Testing
@testable import VoidhashPurchaseCoordinators

@Suite("StoreKit transaction retention")
struct TransactionRetentionStoreTests {
    @Test("purchase and restore transactions remain available for finish")
    func retainsTransactionsUntilFinish() {
        let store = TransactionRetentionStore<String>()
        store.retain(id: "purchase", value: "purchase-value")
        store.retain(id: "restore", value: "restore-value")

        #expect(store.value(for: "purchase") == "purchase-value")
        #expect(store.value(for: "restore") == "restore-value")
        #expect(Set(store.values()) == Set(["purchase-value", "restore-value"]))
    }

    @Test("successful finish removes only the matching transaction")
    func removesFinishedTransaction() {
        let store = TransactionRetentionStore<String>()
        store.retain(id: "first", value: "first-value")
        store.retain(id: "second", value: "second-value")

        #expect(store.remove(id: "first") == "first-value")
        #expect(store.value(for: "first") == nil)
        #expect(store.value(for: "second") == "second-value")
    }

    @Test("connection teardown clears retained transactions")
    func clearsTransactions() {
        let store = TransactionRetentionStore<String>()
        store.retain(id: "transaction", value: "value")

        store.removeAll()

        #expect(store.values().isEmpty)
    }
}
