import Foundation
import Testing
import VoidhashCore

@testable import Voidhash

extension StubbedNetworkSuite {
    @Suite("Voidhash client")
    struct VoidhashClientTests {
        static let personJson = """
            {
              "distinctId": "user-123",
              "email": null,
              "entitlements": { "grants": [] },
              "name": null,
              "personId": "person_1",
              "purchases": { "history": [] },
              "snapshotContext": {
                "includedPersonIds": ["person_1"],
                "migrationJobId": null,
                "mode": "persisted"
              },
              "subscriptions": { "current": null, "history": [] }
            }
            """

        static let schemaJson = """
            {
              "version": "v1",
              "products": {
                "pro-monthly": {
                  "slug": "pro-monthly",
                  "type": "subscription",
                  "properties": { "name": "Pro Monthly" },
                  "configuration": {
                    "providers": { "appleAppStore": { "productId": "com.example.pro.monthly" } },
                    "perks": {}
                  }
                }
              },
              "locations": {}
            }
            """

        private func makeClient(
            options: VoidhashOptions = VoidhashOptions(baseUrl: URL(string: "https://api.example.com")!),
            responses: [StubResponse],
            engine: MockStoreKitEngine = MockStoreKitEngine(),
            presenter: MockPaywallPresenter? = nil,
            warnings: WarningRecorder? = nil
        ) -> VoidhashClient {
            var options = options
            if let warnings {
                options.onWarning = warnings.handler
            }

            var dependencies = VoidhashClient.Dependencies()
            dependencies.session = StubURLProtocol.makeSession(responses: responses)
            dependencies.cacheAdapter = InMemoryCacheAdapter()
            dependencies.engine = engine
            dependencies.presenter = presenter
            dependencies.device = SdkDeviceInfo(
                bundleId: "com.example.app",
                appVersion: "1.2.3",
                systemVersion: "17.0",
                deviceBrand: "Apple",
                deviceName: "iPhone",
                locales: ["de-DE", "en-US"]
            )
            dependencies.startAutoFlush = false
            return VoidhashClient(
                publishableKey: "pk_test", options: options, dependencies: dependencies)
        }

        @Test("a disabled client makes no requests and returns inert results")
        func disabledClientIsInert() async throws {
            let engine = MockStoreKitEngine()
            let client = makeClient(
                options: VoidhashOptions(
                    baseUrl: URL(string: "https://api.example.com")!, enabled: false),
                responses: [StubResponse(body: VoidhashClientTests.schemaJson)],
                engine: engine
            )

            await client.start()
            #expect(try await client.getProducts().isEmpty)
            #expect(try await client.getCurrentPerson() == nil)
            #expect(try await client.identify(externalUserId: "user-123") == nil)
            #expect(try await client.getFeatureFlags().isEmpty)
            await client.capture("event")
            await client.flush()

            #expect(StubURLProtocol.recordedRequests().isEmpty)
            #expect(engine.transactionListener == nil)

            // The distinct id still resolves locally so callers can correlate their own analytics.
            let distinctId = await client.getDistinctId()
            #expect(distinctId.hasPrefix(IdentityStore.anonymousDistinctIdPrefix))
        }

        @Test("getProducts joins the schema with the store metadata")
        func getProductsJoinsSchemaAndStore() async throws {
            let engine = MockStoreKitEngine()
            engine.setProducts([TestFixtures.storeProduct()])
            let client = makeClient(
                responses: [StubResponse(body: VoidhashClientTests.schemaJson)], engine: engine)

            let products = try await client.getProducts()

            #expect(products.count == 1)
            let product = try #require(products.first)
            #expect(product.id == "com.example.pro.monthly")
            #expect(product.slug == "pro-monthly")
            #expect(product.name == "Pro Monthly")
            #expect(product.displayPrice == "59,99 €")
            #expect(product.interval == "month")
            #expect(product.productType == "subscription")

            let schemaRequest = try #require(StubURLProtocol.recordedRequests().first)
            #expect(schemaRequest.path == "/api/v1/sdk/schema")
            #expect(schemaRequest.header("x-sdk") == "ios")
            #expect(schemaRequest.header("x-publishable-key") == "pk_test")
            #expect(schemaRequest.header("x-observer-mode") == "false")
        }

        @Test("initialization registers the store observer and reconciles observed transactions")
        func initializationReconciles() async throws {
            let engine = MockStoreKitEngine()
            engine.setPurchasedItems([TestFixtures.storeTransaction()])
            let client = makeClient(
                responses: [
                    StubResponse(body: VoidhashClientTests.schemaJson),
                    StubResponse(body: #"{"accepted": true}"#),
                    StubResponse(body: VoidhashClientTests.personJson),
                ],
                engine: engine
            )

            try await client.waitForInitialization()
            // The reconciliation runs detached from initialization; give it a turn to complete.
            try await Task.sleep(nanoseconds: 200_000_000)

            #expect(engine.transactionListener != nil)
            #expect(engine.finishedTransactionIds == ["txn-1"])
            let paths = StubURLProtocol.recordedRequests().map(\.path)
            #expect(paths.contains("/api/v1/sdk/sync-transaction"))
        }

        @Test("identify switches the distinct id and reset allocates a new anonymous one")
        func identifyAndReset() async throws {
            let client = makeClient(responses: [StubResponse(body: VoidhashClientTests.personJson)])

            let anonymousId = await client.getDistinctId()
            #expect(anonymousId.hasPrefix(IdentityStore.anonymousDistinctIdPrefix))

            let person = try await client.identify(externalUserId: "user-123", email: "a@b.com")
            #expect(person?.distinctId == "user-123")
            #expect(await client.getDistinctId() == "user-123")

            // The identify call is made under the previous identity so the backend can merge them.
            let request = try #require(StubURLProtocol.recordedRequests().first)
            #expect(request.path == "/api/v1/sdk/identify")
            #expect(request.header("x-distinct-id") == anonymousId)
            #expect(request.jsonBody()?["distinctId"] as? String == "user-123")
            #expect(request.jsonBody()?["email"] as? String == "a@b.com")

            await client.reset()
            let resetId = await client.getDistinctId()
            #expect(resetId.hasPrefix(IdentityStore.anonymousDistinctIdPrefix))
            #expect(resetId != anonymousId)
        }

        @Test("the configured distinct id is used from the first request")
        func configuredDistinctIdIsUsed() async throws {
            let client = makeClient(
                options: VoidhashOptions(
                    baseUrl: URL(string: "https://api.example.com")!, distinctId: "user-123"),
                responses: [StubResponse(body: VoidhashClientTests.schemaJson)]
            )

            try await client.waitForInitialization()

            #expect(await client.getDistinctId() == "user-123")
            #expect(StubURLProtocol.recordedRequests().first?.header("x-distinct-id") == "user-123")
        }

        @Test("a missing person maps to nil and is served from cache afterwards")
        func personNotFoundMapsToNil() async throws {
            let client = makeClient(
                responses: [
                    StubResponse(statusCode: 404, body: #"{"_tag": "PersonNotFound"}"#),
                    StubResponse(body: VoidhashClientTests.personJson),
                ])

            #expect(try await client.getCurrentPerson() == nil)
            #expect(try await client.getCurrentPerson()?.personId == "person_1")
            // The second call cached the snapshot, so the third one issues no request.
            #expect(try await client.getCurrentPerson()?.personId == "person_1")
            #expect(StubURLProtocol.recordedRequests().count == 2)
        }

        @Test("read-only mode is reported to the backend and skips finishing transactions")
        func readOnlyModeIsReported() async throws {
            let engine = MockStoreKitEngine()
            engine.setProducts([TestFixtures.storeProduct()])
            engine.setBuyResult(.success(TestFixtures.storeTransaction()))
            let client = makeClient(
                responses: [
                    StubResponse(body: VoidhashClientTests.schemaJson),
                    StubResponse(body: #"{"accepted": true}"#),
                    StubResponse(body: VoidhashClientTests.personJson),
                ],
                engine: engine
            )
            await client.setReadOnly(true)

            let product = try #require(try await client.getProducts().first)
            try await client.purchase(product: product)

            #expect(engine.finishedTransactionIds.isEmpty)
            let syncRequest = try #require(
                StubURLProtocol.recordedRequests().first { $0.path == "/api/v1/sdk/sync-transaction" })
            #expect(syncRequest.header("x-observer-mode") == "true")
        }

        @Test("a failed initialization is retried by the next call")
        func failedInitializationIsRetried() async throws {
            let client = makeClient(
                responses: [
                    StubResponse(statusCode: 500, body: #"{"message": "boom"}"#),
                    StubResponse(body: VoidhashClientTests.schemaJson),
                ])

            await #expect(throws: FailedToFetchSchemaError.self) {
                try await client.waitForInitialization()
            }

            let schema = try await client.waitForInitialization()
            #expect(schema.version == "v1")
            #expect(
                StubURLProtocol.recordedRequests().filter { $0.path == "/api/v1/sdk/schema" }.count
                    == 2)
        }

        @Test("a successful initialization runs once and is shared by later calls")
        func successfulInitializationRunsOnce() async throws {
            let client = makeClient(responses: [StubResponse(body: VoidhashClientTests.schemaJson)])

            try await client.waitForInitialization()
            try await client.waitForInitialization()

            #expect(
                StubURLProtocol.recordedRequests().filter { $0.path == "/api/v1/sdk/schema" }.count
                    == 1)
        }

        @Test("a failed store connection fails initialization and is retried")
        func failedStoreConnectionFailsInitialization() async throws {
            let engine = MockStoreKitEngine()
            engine.setInitConnectionError(VoidhashStoreError.storeKitNotInitialized)
            let client = makeClient(
                responses: [StubResponse(body: VoidhashClientTests.schemaJson)], engine: engine)

            await #expect(throws: VoidhashStoreError.self) {
                try await client.waitForInitialization()
            }
            // The schema is never fetched: without the observer nothing would reconcile.
            #expect(StubURLProtocol.recordedRequests().isEmpty)

            engine.setInitConnectionError(nil)
            try await client.waitForInitialization()

            #expect(engine.initConnectionCount == 2)
            #expect(engine.transactionListener != nil)
        }

        @Test("a failed person refresh after a purchase warns instead of failing the purchase")
        func failedPersonRefreshWarns() async throws {
            let engine = MockStoreKitEngine()
            engine.setProducts([TestFixtures.storeProduct()])
            engine.setBuyResult(.success(TestFixtures.storeTransaction()))
            let warnings = WarningRecorder()
            let client = makeClient(
                responses: [
                    StubResponse(body: VoidhashClientTests.schemaJson),
                    StubResponse(body: #"{"accepted": true}"#),
                    StubResponse(statusCode: 500, body: #"{"message": "boom"}"#),
                ],
                engine: engine,
                warnings: warnings
            )

            let product = try #require(try await client.getProducts().first)
            try await client.purchase(product: product)

            #expect(engine.finishedTransactionIds == ["txn-1"])
            #expect(warnings.contains("Failed to refresh the person after a transaction"))
        }

        @Test("presenting a paywall resolves the location and configures the bundle")
        func presentsPaywall() async throws {
            let engine = MockStoreKitEngine()
            engine.setProducts([TestFixtures.storeProduct()])
            let presenter = MockPaywallPresenter()
            let resolvedJson = String(
                decoding: try JSONEncoder().encode(try PaywallCoordinatorTests.resolvedPaywall()),
                as: UTF8.self)
            let client = makeClient(
                responses: [
                    StubResponse(body: VoidhashClientTests.schemaJson),
                    StubResponse(body: resolvedJson),
                    StubResponse(body: VoidhashClientTests.schemaJson),
                ],
                engine: engine,
                presenter: presenter
            )

            let result = try await client.presentPaywall(location: "onboarding")

            #expect(result == .shown)
            #expect(presenter.shownLocations == ["onboarding"])
            let configure = try #require(presenter.message(ofType: "configure"))
            let payload = try #require(configure["payload"] as? [String: Any])
            #expect(payload["locale"] as? String == "de-DE")
            let products = try #require(payload["products"] as? [[String: Any]])
            #expect(products.first?["priceString"] as? String == "59,99 €")
        }
    }
}
