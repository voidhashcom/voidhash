import Foundation
import Testing
import VoidhashCore

@testable import Voidhash

@Suite("Purchase orchestrator")
struct PurchaseOrchestratorTests {
    private func makeOrchestrator(
        engine: MockStoreKitEngine,
        api: MockTransactionSync,
        readOnly: AtomicBool = AtomicBool(false),
        cacheManager: CacheManager = TestFixtures.makeCacheManager(),
        refreshCount: AtomicCounter = AtomicCounter()
    ) -> PurchaseOrchestrator {
        return PurchaseOrchestrator(
            engine: engine,
            api: api,
            cacheManager: cacheManager,
            headersProvider: { ["x-publishable-key": "pk_test"] },
            distinctIdProvider: { "user-123" },
            isReadOnly: { readOnly.value },
            refreshPerson: { refreshCount.increment() }
        )
    }

    @Test("a purchase syncs the transaction, finishes it and refreshes the person")
    func purchaseSyncsAndFinishes() async throws {
        let engine = MockStoreKitEngine()
        engine.setBuyResult(.success(TestFixtures.storeTransaction()))
        let api = MockTransactionSync()
        let refreshCount = AtomicCounter()
        let orchestrator = makeOrchestrator(engine: engine, api: api, refreshCount: refreshCount)

        try await orchestrator.purchase(
            product: TestFixtures.product(), schema: TestFixtures.schema())

        #expect(engine.boughtSkus == ["com.example.pro.monthly"])
        // The account token is the UUIDv5 of the distinct id.
        #expect(engine.boughtAccountTokens == ["3501e751-7582-58f9-9c1d-533c7466049f"])
        #expect(engine.finishedTransactionIds == ["txn-1"])
        #expect(refreshCount.value == 1)

        let body = try #require(api.bodies.first)
        #expect(body.platform == "ios")
        #expect(body.productSlug == "pro-monthly")
        #expect(body.providerProductId == "com.example.pro.monthly")
        #expect(body.transactionId == "txn-1")
        #expect(body.purchaseDate == 1_700_000_000_000)
        #expect(body.quantity == 1)
        #expect(body.receipt == "signed-payload")
        #expect(body.purchaseToken == nil)
        #expect(body.appAccountToken == "3501e751-7582-58f9-9c1d-533c7466049f")
        #expect(api.headerSets.first?["x-distinct-id"] == "user-123")
    }

    @Test("the product slug falls back to the store product id when nothing matches")
    func unknownProductKeepsStoreId() async throws {
        let engine = MockStoreKitEngine()
        engine.setBuyResult(.success(TestFixtures.storeTransaction(productId: "com.other")))
        let api = MockTransactionSync()
        let orchestrator = makeOrchestrator(engine: engine, api: api)

        try await orchestrator.purchase(
            product: TestFixtures.product(id: "com.other"), schema: TestFixtures.schema())

        #expect(api.bodies.first?.productSlug == "com.other")
    }

    @Test("a read-only observation syncs but never finishes the transaction")
    func readOnlySkipsFinish() async throws {
        let engine = MockStoreKitEngine()
        let api = MockTransactionSync()
        let orchestrator = makeOrchestrator(
            engine: engine, api: api, readOnly: AtomicBool(true))

        try await orchestrator.processTransaction(
            VoidhashTransaction(storeTransaction: TestFixtures.storeTransaction()),
            schema: TestFixtures.schema()
        )

        #expect(api.bodies.count == 1)
        #expect(engine.finishedTransactionIds.isEmpty)
    }

    @Test("a purchase started in owner mode finishes even if read-only flips mid-flight")
    func midFlightReadOnlyFlipStillFinishes() async throws {
        let readOnly = AtomicBool(false)
        let engine = MockStoreKitEngine()
        engine.setBuyResult(.success(TestFixtures.storeTransaction()))
        // The host app flips to observer mode while the store sheet is open.
        engine.onBuyProduct = { readOnly.value = true }
        let api = MockTransactionSync()
        let orchestrator = makeOrchestrator(engine: engine, api: api, readOnly: readOnly)

        try await orchestrator.purchase(
            product: TestFixtures.product(), schema: TestFixtures.schema())

        #expect(engine.finishedTransactionIds == ["txn-1"])
    }

    @Test("concurrent processing of the same transaction is coalesced")
    func concurrentProcessingIsDeduplicated() async throws {
        let engine = MockStoreKitEngine()
        let api = MockTransactionSync()
        // Hold the first sync open so the second call joins the in-flight entry.
        api.onSync = { try? await Task.sleep(nanoseconds: 50_000_000) }
        let orchestrator = makeOrchestrator(engine: engine, api: api)
        let transaction = VoidhashTransaction(storeTransaction: TestFixtures.storeTransaction())
        let schema = TestFixtures.schema()

        async let first: Void = orchestrator.processTransaction(transaction, schema: schema)
        async let second: Void = orchestrator.processTransaction(transaction, schema: schema)
        _ = try await (first, second)

        #expect(api.bodies.count == 1)
        #expect(engine.finishedTransactionIds == ["txn-1"])
    }

    @Test("an already processed transaction is not synced again")
    func processedCacheSkipsRepeatedWork() async throws {
        let engine = MockStoreKitEngine()
        let api = MockTransactionSync()
        let cacheManager = TestFixtures.makeCacheManager()
        let orchestrator = makeOrchestrator(engine: engine, api: api, cacheManager: cacheManager)
        let transaction = VoidhashTransaction(storeTransaction: TestFixtures.storeTransaction())
        let schema = TestFixtures.schema()

        try await orchestrator.processTransaction(transaction, schema: schema)
        try await orchestrator.processTransaction(transaction, schema: schema)

        #expect(api.bodies.count == 1)
        #expect(engine.finishedTransactionIds == ["txn-1"])
    }

    @Test("a backend rejection leaves the transaction unfinished")
    func backendRejectionSkipsFinish() async throws {
        let engine = MockStoreKitEngine()
        let api = MockTransactionSync(
            error: VoidhashApiError(code: "API_ERROR", message: "boom", statusCode: 500))
        let orchestrator = makeOrchestrator(engine: engine, api: api)

        await #expect(throws: VoidhashApiError.self) {
            try await orchestrator.processTransaction(
                VoidhashTransaction(storeTransaction: TestFixtures.storeTransaction()),
                schema: TestFixtures.schema()
            )
        }

        #expect(engine.finishedTransactionIds.isEmpty)
    }

    @Test("reconciliation processes pending and owned transactions once each")
    func reconciliationDeduplicatesObservedTransactions() async throws {
        let engine = MockStoreKitEngine()
        let shared = TestFixtures.storeTransaction(transactionId: "txn-1")
        engine.setPendingItems([shared])
        engine.setPurchasedItems([
            shared, TestFixtures.storeTransaction(transactionId: "txn-2"),
        ])
        let api = MockTransactionSync()
        let refreshCount = AtomicCounter()
        let orchestrator = makeOrchestrator(engine: engine, api: api, refreshCount: refreshCount)

        try await orchestrator.restorePurchases(schema: TestFixtures.schema())

        #expect(api.bodies.map(\.transactionId).sorted() == ["txn-1", "txn-2"])
        #expect(engine.finishedTransactionIds.sorted() == ["txn-1", "txn-2"])
        #expect(refreshCount.value == 1)
    }

    @Test("reconciliation skips one-time consumables")
    func reconciliationSkipsConsumables() async throws {
        let engine = MockStoreKitEngine()
        engine.setPurchasedItems([TestFixtures.storeTransaction()])
        let api = MockTransactionSync()
        let orchestrator = makeOrchestrator(engine: engine, api: api)
        let schema = TestFixtures.schema(products: [
            TestFixtures.productDefinition(type: "one-time-consumable")
        ])

        try await orchestrator.reconcileObservedTransactions(schema: schema)

        #expect(api.bodies.isEmpty)
        #expect(engine.finishedTransactionIds.isEmpty)
    }

    @Test("reconciliation reports the transactions that failed")
    func reconciliationReportsFailures() async throws {
        let engine = MockStoreKitEngine()
        engine.setPurchasedItems([TestFixtures.storeTransaction()])
        let api = MockTransactionSync(
            error: VoidhashApiError(code: "API_ERROR", message: "boom", statusCode: 500))
        let orchestrator = makeOrchestrator(engine: engine, api: api)

        await #expect(throws: ReconcileTransactionsError.self) {
            try await orchestrator.reconcileObservedTransactions(schema: TestFixtures.schema())
        }
    }

    @Test("a failed pending-transaction read fails the restore")
    func pendingTransactionReadFailureFailsRestore() async throws {
        let engine = MockStoreKitEngine()
        engine.setPendingTransactionsError(VoidhashStoreError.storeKitNotInitialized)
        let api = MockTransactionSync()
        let refreshCount = AtomicCounter()
        let orchestrator = makeOrchestrator(engine: engine, api: api, refreshCount: refreshCount)

        await #expect(throws: VoidhashStoreError.self) {
            try await orchestrator.restorePurchases(schema: TestFixtures.schema())
        }

        // Reporting "restored nothing" off an unreadable store would hide the customer's
        // purchases, so nothing is synced and the person is not refreshed either.
        #expect(api.bodies.isEmpty)
        #expect(refreshCount.value == 0)
    }

    @Test("a failed purchased-items read fails the restore")
    func purchasedItemsReadFailureFailsRestore() async throws {
        let engine = MockStoreKitEngine()
        engine.setPurchasedItemsError(VoidhashStoreError.storeKitNotInitialized)
        let api = MockTransactionSync()
        let orchestrator = makeOrchestrator(engine: engine, api: api)

        await #expect(throws: VoidhashStoreError.self) {
            try await orchestrator.restorePurchases(schema: TestFixtures.schema())
        }

        #expect(api.bodies.isEmpty)
    }

    @Test("a sync answered with accepted false fails and leaves the transaction unfinished")
    func rejectedSyncDoesNotFinishTheTransaction() async throws {
        let engine = MockStoreKitEngine()
        let api = MockTransactionSync(responseJson: #"{"accepted": false}"#)
        let cacheManager = TestFixtures.makeCacheManager()
        let orchestrator = makeOrchestrator(engine: engine, api: api, cacheManager: cacheManager)
        let transaction = VoidhashTransaction(storeTransaction: TestFixtures.storeTransaction())

        await #expect(throws: VoidhashStoreError.self) {
            try await orchestrator.processTransaction(
                transaction, schema: TestFixtures.schema())
        }

        #expect(engine.finishedTransactionIds.isEmpty)
        // Nothing is cached as accepted, so a later attempt syncs the transaction again.
        try? await orchestrator.processTransaction(transaction, schema: TestFixtures.schema())
        #expect(api.bodies.count == 2)
    }

    @Test("a rejected sync reports the transaction verification error code")
    func rejectedSyncReportsVerificationCode() async throws {
        let engine = MockStoreKitEngine()
        let api = MockTransactionSync(responseJson: #"{"accepted": false}"#)
        let orchestrator = makeOrchestrator(engine: engine, api: api)

        do {
            try await orchestrator.processTransaction(
                VoidhashTransaction(storeTransaction: TestFixtures.storeTransaction()),
                schema: TestFixtures.schema()
            )
            Issue.record("expected the rejected sync to throw")
        } catch let error as VoidhashStoreError {
            #expect(error.code == "TRANSACTION_VERIFICATION_FAILED")
            #expect(error.description.contains("txn-1"))
        }
    }

    @Test("a response without the accepted flag finishes the transaction")
    func responseWithoutAcceptedFlagFinishes() async throws {
        let engine = MockStoreKitEngine()
        let api = MockTransactionSync(responseJson: "{}")
        let orchestrator = makeOrchestrator(engine: engine, api: api)

        try await orchestrator.processTransaction(
            VoidhashTransaction(storeTransaction: TestFixtures.storeTransaction()),
            schema: TestFixtures.schema()
        )

        #expect(engine.finishedTransactionIds == ["txn-1"])
    }
}

/// Lock-guarded counter for assertions made from `@Sendable` callbacks.
final class AtomicCounter: @unchecked Sendable {
    private let lock = NSLock()
    private var storage = 0

    var value: Int {
        return lock.withLock { storage }
    }

    func increment() {
        lock.withLock { storage += 1 }
    }
}
