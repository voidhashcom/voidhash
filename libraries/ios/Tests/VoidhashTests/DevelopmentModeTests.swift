import Foundation
import Testing
import VoidhashCore

@testable import Voidhash

/// A dev-gateway double recording the development purchases the orchestrator makes.
final class MockDevelopmentPurchasing: DevelopmentPurchasing, @unchecked Sendable {
    private let lock = NSLock()
    private var error: (any Error)?
    private(set) var bodies: [SdkDevelopmentPurchaseBody] = []
    private(set) var headerSets: [[String: String]] = []

    func setError(_ error: (any Error)?) {
        lock.withLock { self.error = error }
    }

    func developmentPurchase(headers: [String: String], body: SdkDevelopmentPurchaseBody)
        async throws
    {
        lock.withLock {
            headerSets.append(headers)
            bodies.append(body)
        }
        if let error = lock.withLock({ self.error }) {
            throw error
        }
    }
}

@Suite("Development mode")
struct DevelopmentModeTests {
    private func developmentSchema() -> RuntimeSchema {
        var products: [String: RuntimeProductDefinition] = [:]
        products["pro-monthly"] = RuntimeProductDefinition(
            slug: "pro-monthly",
            type: "subscription",
            properties: RuntimeProductProperties(name: "Pro Monthly"),
            configuration: RuntimeProductConfiguration(
                providers: RuntimeProductProviders(
                    development: RuntimeDevelopmentProductConfiguration(
                        currencyCode: "USD",
                        duration: "monthly",
                        period: "month",
                        periodCount: 1,
                        price: 9.99,
                        priceInMinorUnits: 999,
                        productId: "pro-monthly",
                        warning: nil
                    )
                )
            )
        )
        return RuntimeSchema(version: "v1", products: products)
    }

    private func makeOrchestrator(
        engine: StoreKitEngineProtocol,
        api: TransactionSyncing,
        developmentApi: DevelopmentPurchasing
    ) -> PurchaseOrchestrator {
        let cacheManager = TestFixtures.makeCacheManager()
        return PurchaseOrchestrator(
            engine: engine,
            api: api,
            developmentApi: developmentApi,
            isDevelopmentMode: true,
            cacheManager: cacheManager,
            headersProvider: {
                SdkHeaders.build(
                    publishableKey: "pk_test",
                    distinctId: "user-123",
                    sdkVersion: "0.0.1",
                    device: .init(bundleId: "com.example.app"),
                    isDebugBuild: true,
                    readOnly: false,
                    environment: "development"
                )
            },
            distinctIdProvider: { "user-123" },
            isReadOnly: { false },
            refreshPerson: {}
        )
    }

    @Test("a purchase routes to the development gateway and never finishes with the store")
    func routesToDevelopmentGateway() async throws {
        let engine = MockStoreKitEngine()
        engine.setBuyResult(.success(TestFixtures.storeTransaction(transactionId: "dev-1")))
        engine.setProducts([TestFixtures.storeProduct()])
        let sync = MockTransactionSync()
        let development = MockDevelopmentPurchasing()

        let orchestrator = makeOrchestrator(engine: engine, api: sync, developmentApi: development)
        try await orchestrator.purchase(product: TestFixtures.product(), schema: TestFixtures.schema())

        #expect(development.bodies.count == 1)
        #expect(development.bodies[0].devTransactionId == "dev-1")
        #expect(development.bodies[0].productSlug == "pro-monthly")
        #expect(sync.bodies.isEmpty)
        #expect(engine.finishedTransactionIds.isEmpty)
    }

    @Test("development requests carry the development environment header")
    func carriesEnvironmentHeader() async throws {
        let engine = MockStoreKitEngine()
        engine.setBuyResult(.success(TestFixtures.storeTransaction(transactionId: "dev-1")))
        engine.setProducts([TestFixtures.storeProduct()])
        let development = MockDevelopmentPurchasing()

        let orchestrator = makeOrchestrator(engine: engine, api: MockTransactionSync(),
            developmentApi: development)
        try await orchestrator.purchase(product: TestFixtures.product(), schema: TestFixtures.schema())

        #expect(development.headerSets[0]["x-environment"] == "development")
    }

    @Test("a gateway failure fails the purchase without caching acceptance")
    func gatewayFailurePropagates() async throws {
        let engine = MockStoreKitEngine()
        engine.setBuyResult(.success(TestFixtures.storeTransaction(transactionId: "dev-1")))
        engine.setProducts([TestFixtures.storeProduct()])
        let development = MockDevelopmentPurchasing()
        development.setError(VoidhashStoreError(code: "API_ERROR", message: "boom"))

        let orchestrator = makeOrchestrator(engine: engine, api: MockTransactionSync(),
            developmentApi: development)

        do {
            try await orchestrator.purchase(
                product: TestFixtures.product(), schema: TestFixtures.schema())
            Issue.record("Expected the purchase to fail")
        } catch {
            // Expected.
        }

        // Retrying re-attempts the gateway call — nothing was cached as accepted.
        development.setError(nil)
        try await orchestrator.purchase(
            product: TestFixtures.product(), schema: TestFixtures.schema())
        #expect(development.bodies.count == 2)
    }

    @Test("products synthesize from the schema's computed development metadata")
    func synthesizesProductsFromSchema() throws {
        let schema = developmentSchema()
        guard let definition = schema.products["pro-monthly"],
            let configuration = definition.configuration.providers.development
        else {
            Issue.record("Fixture is missing its development configuration")
            return
        }

        let product = VoidhashProduct(definition: definition, development: configuration)

        #expect(product.id == "pro-monthly")
        #expect(product.slug == "pro-monthly")
        #expect(product.price == 9.99)
        #expect(product.currency == "USD")
        #expect(product.interval == "month")
        #expect(product.displayPrice.contains("9.99"))
    }
}
