import Foundation
import Testing
import VoidhashCore

@testable import Voidhash

@Suite("Paywall coordinator")
struct PaywallCoordinatorTests {
    private static let locationSlug = "onboarding"

    static func resolvedPaywall(
        htmlUrl: String = "https://cdn.example.com/paywall.html",
        productSlugs: [String] = ["pro-monthly"],
        includeRuntime: Bool = true
    ) throws -> SdkResolvedPaywall {
        let slugs = productSlugs.map { "\"\($0)\"" }.joined(separator: ",")
        let runtime =
            includeRuntime
            ? """
            {
              "contentHash": "hash-1",
              "productSlugs": [\(slugs)],
              "variables": { "headline": "Go Pro" }
            }
            """
            : "null"

        let json = """
            {
              "location": { "id": "loc_1", "name": "Onboarding", "slug": "onboarding" },
              "showing": {
                "id": "showing_1",
                "paywall": { "id": "pw_1", "name": "Pro", "slug": "pro" },
                "paywallId": "pw_1",
                "paywallRelease": {
                  "htmlUrl": "\(htmlUrl)",
                  "publishedAt": "2026-01-01T00:00:00.000Z",
                  "releaseId": "rel_1",
                  "runtime": \(runtime),
                  "version": 3
                },
                "paywallReleaseId": "rel_1",
                "startedAt": "2026-01-01T00:00:00.000Z",
                "type": "paywall"
              }
            }
            """
        return try JSONDecoder().decode(SdkResolvedPaywall.self, from: Data(json.utf8))
    }

    private func makeCoordinator(
        presenter: MockPaywallPresenter,
        resolved: SdkResolvedPaywall?,
        products: [VoidhashProduct] = [TestFixtures.product()],
        productsError: (any Error)? = nil,
        purchaseError: (any Error)? = nil,
        restoreError: (any Error)? = nil,
        captured: CapturedEvents = CapturedEvents(),
        openedUrls: CapturedUrls = CapturedUrls(),
        warnings: WarningRecorder = WarningRecorder()
    ) -> PaywallCoordinator {
        return PaywallCoordinator(
            presenter: presenter,
            resolvePaywall: { _ in resolved },
            getProducts: {
                if let productsError {
                    throw productsError
                }
                return products
            },
            purchaseProduct: { _ in
                if let purchaseError {
                    throw purchaseError
                }
            },
            restorePurchases: {
                if let restoreError {
                    throw restoreError
                }
            },
            captureEvent: { name, properties in captured.record(name, properties) },
            openExternalUrl: { url in openedUrls.record(url) },
            locale: "de-DE",
            warn: warnings.handler
        )
    }

    @Test("presenting resolves the paywall and sends the configure envelope")
    func presentsAndConfigures() async throws {
        let presenter = MockPaywallPresenter()
        let coordinator = makeCoordinator(
            presenter: presenter, resolved: try PaywallCoordinatorTests.resolvedPaywall())

        let result = try await coordinator.present(location: PaywallCoordinatorTests.locationSlug)

        #expect(result == .shown)
        #expect(presenter.shownLocations == [PaywallCoordinatorTests.locationSlug])
        #expect(presenter.messageKinds() == ["configure"])
    }

    @Test("a location without an assigned paywall reports notAssigned")
    func notAssignedLocation() async throws {
        let presenter = MockPaywallPresenter()
        let coordinator = makeCoordinator(presenter: presenter, resolved: nil)

        let result = try await coordinator.present(location: PaywallCoordinatorTests.locationSlug)

        #expect(result == .notAssigned)
        #expect(presenter.shownLocations.isEmpty)
    }

    @Test("ready answers with a configure envelope carrying the formatted prices")
    func readySendsConfigure() async throws {
        let presenter = MockPaywallPresenter()
        let coordinator = makeCoordinator(
            presenter: presenter, resolved: try PaywallCoordinatorTests.resolvedPaywall())
        try await coordinator.present(location: PaywallCoordinatorTests.locationSlug)

        await coordinator.handleBridgeEvent(
            locationSlug: PaywallCoordinatorTests.locationSlug,
            rawEvent: #"{"version":1,"type":"ready","requestId":"req-ready"}"#
        )

        let messages = presenter.messages()
        #expect(messages.count == 2)
        let configure = try #require(messages.last)
        #expect(configure["type"] as? String == "configure")
        #expect(configure["requestId"] as? String == "req-ready")
        let payload = try #require(configure["payload"] as? [String: Any])
        #expect(payload["platform"] as? String == "ios")
        #expect(payload["locale"] as? String == "de-DE")
        #expect(payload["defaultSelectedProductId"] as? String == "com.example.pro.monthly")
        let products = try #require(payload["products"] as? [[String: Any]])
        #expect(products.count == 1)
        #expect(products[0]["priceString"] as? String == "59,99 €")
        #expect(products[0]["period"] as? String == "month")
        let variables = try #require(payload["variables"] as? [String: Any])
        #expect(variables["headline"] as? String == "Go Pro")
    }

    @Test("a visual-editor release receives no configure envelope")
    func visualEditorReleaseIsNotConfigured() async throws {
        let presenter = MockPaywallPresenter()
        let coordinator = makeCoordinator(
            presenter: presenter,
            resolved: try PaywallCoordinatorTests.resolvedPaywall(includeRuntime: false)
        )
        try await coordinator.present(location: PaywallCoordinatorTests.locationSlug)

        await coordinator.handleBridgeEvent(
            locationSlug: PaywallCoordinatorTests.locationSlug,
            rawEvent: #"{"version":1,"type":"ready"}"#
        )

        #expect(presenter.postedMessages.isEmpty)
    }

    @Test("a purchase emits purchasing, purchased, a success response and dismisses")
    func purchaseStatusSequence() async throws {
        let presenter = MockPaywallPresenter()
        let delegate = RecordingPaywallDelegate()
        let coordinator = makeCoordinator(
            presenter: presenter, resolved: try PaywallCoordinatorTests.resolvedPaywall())
        try await coordinator.present(
            location: PaywallCoordinatorTests.locationSlug, delegate: delegate)

        await coordinator.handleBridgeEvent(
            locationSlug: PaywallCoordinatorTests.locationSlug,
            rawEvent:
                #"{"version":1,"type":"purchase","requestId":"req-1","payload":{"productId":"pro-monthly"}}"#
        )

        #expect(
            presenter.messageKinds() == [
                "configure", "status:purchasing", "status:purchased", "response",
            ])
        #expect(presenter.dismissCount == 1)
        #expect(delegate.purchasedProductIds == ["com.example.pro.monthly"])
    }

    @Test("a cancelled purchase reports cancelled, not failed")
    func cancelledPurchase() async throws {
        let presenter = MockPaywallPresenter()
        let delegate = RecordingPaywallDelegate()
        let coordinator = makeCoordinator(
            presenter: presenter,
            resolved: try PaywallCoordinatorTests.resolvedPaywall(),
            purchaseError: VoidhashStoreError.userCancelled
        )
        try await coordinator.present(
            location: PaywallCoordinatorTests.locationSlug, delegate: delegate)

        await coordinator.handleBridgeEvent(
            locationSlug: PaywallCoordinatorTests.locationSlug,
            rawEvent:
                #"{"version":1,"type":"purchase","payload":{"productId":"pro-monthly"}}"#
        )

        #expect(
            presenter.messageKinds() == [
                "configure", "status:purchasing", "status:cancelled", "response",
            ])
        #expect(presenter.dismissCount == 0)
        #expect(delegate.purchasedProductIds.isEmpty)
        #expect(delegate.failures.count == 1)
    }

    @Test("a failed purchase reports failed with the store error string")
    func failedPurchase() async throws {
        let presenter = MockPaywallPresenter()
        let coordinator = makeCoordinator(
            presenter: presenter,
            resolved: try PaywallCoordinatorTests.resolvedPaywall(),
            purchaseError: VoidhashStoreError.purchaseFailed("network down")
        )
        try await coordinator.present(location: PaywallCoordinatorTests.locationSlug)

        await coordinator.handleBridgeEvent(
            locationSlug: PaywallCoordinatorTests.locationSlug,
            rawEvent: #"{"version":1,"type":"purchase","payload":{"productId":"pro-monthly"}}"#
        )

        #expect(
            presenter.messageKinds() == [
                "configure", "status:purchasing", "status:failed", "response",
            ])
        let messages = presenter.messages()
        let status = try #require(messages[2]["payload"] as? [String: Any])
        #expect(
            status["error"] as? String == "PURCHASE_FAILED: Purchase operation failed - network down"
        )
    }

    @Test("an unknown product id fails without touching the store")
    func unknownProductFails() async throws {
        let presenter = MockPaywallPresenter()
        let coordinator = makeCoordinator(
            presenter: presenter, resolved: try PaywallCoordinatorTests.resolvedPaywall())
        try await coordinator.present(location: PaywallCoordinatorTests.locationSlug)

        await coordinator.handleBridgeEvent(
            locationSlug: PaywallCoordinatorTests.locationSlug,
            rawEvent: #"{"version":1,"type":"purchase","payload":{"productId":"nope"}}"#
        )

        #expect(
            presenter.messageKinds() == [
                "configure", "status:purchasing", "status:failed", "response",
            ])
        let messages = presenter.messages()
        let status = try #require(messages[2]["payload"] as? [String: Any])
        #expect(status["error"] as? String == "Product not found: nope")
    }

    @Test("a restore emits restoring, restored, a success response and dismisses")
    func restoreStatusSequence() async throws {
        let presenter = MockPaywallPresenter()
        let delegate = RecordingPaywallDelegate()
        let coordinator = makeCoordinator(
            presenter: presenter, resolved: try PaywallCoordinatorTests.resolvedPaywall())
        try await coordinator.present(
            location: PaywallCoordinatorTests.locationSlug, delegate: delegate)

        await coordinator.handleBridgeEvent(
            locationSlug: PaywallCoordinatorTests.locationSlug,
            rawEvent: #"{"version":1,"type":"restore","requestId":"req-2"}"#
        )

        #expect(
            presenter.messageKinds() == [
                "configure", "status:restoring", "status:restored", "response",
            ])
        #expect(presenter.dismissCount == 1)
        #expect(delegate.restoreCount == 1)
    }

    @Test("close dismisses the paywall")
    func closeDismisses() async throws {
        let presenter = MockPaywallPresenter()
        let coordinator = makeCoordinator(
            presenter: presenter, resolved: try PaywallCoordinatorTests.resolvedPaywall())
        try await coordinator.present(location: PaywallCoordinatorTests.locationSlug)

        await coordinator.handleBridgeEvent(
            locationSlug: PaywallCoordinatorTests.locationSlug,
            rawEvent: #"{"version":1,"type":"close","payload":{"reason":"user"}}"#
        )

        #expect(presenter.dismissCount == 1)
    }

    @Test("openExternal opens the requested url")
    func opensExternalUrl() async throws {
        let presenter = MockPaywallPresenter()
        let openedUrls = CapturedUrls()
        let coordinator = makeCoordinator(
            presenter: presenter,
            resolved: try PaywallCoordinatorTests.resolvedPaywall(),
            openedUrls: openedUrls
        )
        try await coordinator.present(location: PaywallCoordinatorTests.locationSlug)

        await coordinator.handleBridgeEvent(
            locationSlug: PaywallCoordinatorTests.locationSlug,
            rawEvent:
                #"{"version":1,"type":"openExternal","payload":{"url":"https://example.com/terms"}}"#
        )

        #expect(openedUrls.values == ["https://example.com/terms"])
    }

    @Test("bundle events are captured with the paywall location and forwarded")
    func capturesBundleEvents() async throws {
        let presenter = MockPaywallPresenter()
        let captured = CapturedEvents()
        let delegate = RecordingPaywallDelegate()
        let coordinator = makeCoordinator(
            presenter: presenter,
            resolved: try PaywallCoordinatorTests.resolvedPaywall(),
            captured: captured
        )
        try await coordinator.present(
            location: PaywallCoordinatorTests.locationSlug, delegate: delegate)

        await coordinator.handleBridgeEvent(
            locationSlug: PaywallCoordinatorTests.locationSlug,
            rawEvent:
                #"{"version":1,"type":"event","payload":{"name":"cta_clicked","properties":{"variant":"a"}}}"#
        )

        #expect(captured.names == ["cta_clicked"])
        let properties = try #require(captured.properties.first)
        #expect(properties["variant"] == .string("a"))
        #expect(properties["paywall_location"] == .string(PaywallCoordinatorTests.locationSlug))
        #expect(delegate.events.count == 1)
    }

    @Test("log messages reach the delegate")
    func forwardsLogs() async throws {
        let presenter = MockPaywallPresenter()
        let delegate = RecordingPaywallDelegate()
        let coordinator = makeCoordinator(
            presenter: presenter, resolved: try PaywallCoordinatorTests.resolvedPaywall())
        try await coordinator.present(
            location: PaywallCoordinatorTests.locationSlug, delegate: delegate)

        await coordinator.handleBridgeEvent(
            locationSlug: PaywallCoordinatorTests.locationSlug,
            rawEvent: #"{"version":1,"type":"log","payload":{"level":"warn","message":"oops"}}"#
        )

        #expect(delegate.logs.count == 1)
        #expect(delegate.logs.first?.message == "oops")
        #expect(delegate.logs.first?.level == "warn")
    }

    @Test("unparseable messages are ignored and warned about with their parse code")
    func ignoresUnparseableMessages() async throws {
        let presenter = MockPaywallPresenter()
        let warnings = WarningRecorder()
        let coordinator = makeCoordinator(
            presenter: presenter,
            resolved: try PaywallCoordinatorTests.resolvedPaywall(),
            warnings: warnings
        )
        try await coordinator.present(location: PaywallCoordinatorTests.locationSlug)

        await coordinator.handleBridgeEvent(
            locationSlug: PaywallCoordinatorTests.locationSlug, rawEvent: "{not json")
        await coordinator.handleBridgeEvent(
            locationSlug: PaywallCoordinatorTests.locationSlug,
            rawEvent: #"{"version":2,"type":"ready"}"#
        )

        #expect(presenter.messageKinds() == ["configure"])
        #expect(warnings.contains("INVALID_JSON"))
        #expect(warnings.contains("UNSUPPORTED_VERSION"))
    }

    @Test("a failed product lookup warns and still configures the bundle")
    func degradedConfigureWarns() async throws {
        let presenter = MockPaywallPresenter()
        let warnings = WarningRecorder()
        let coordinator = makeCoordinator(
            presenter: presenter,
            resolved: try PaywallCoordinatorTests.resolvedPaywall(),
            productsError: VoidhashStoreError.storeKitNotInitialized,
            warnings: warnings
        )

        try await coordinator.present(location: PaywallCoordinatorTests.locationSlug)

        #expect(warnings.contains("STOREKIT_NOT_INITIALIZED"))
        let configure = try #require(presenter.message(ofType: "configure"))
        let payload = try #require(configure["payload"] as? [String: Any])
        // Degraded: no products, but the release's variables still reach the bundle.
        #expect((payload["products"] as? [[String: Any]])?.isEmpty == true)
        #expect((payload["variables"] as? [String: Any])?["headline"] as? String == "Go Pro")
    }

    @Test("a bridge purchase resolves the product id, the slug and the provider product id")
    func findsProductByEveryIdentifier() throws {
        let products = [
            TestFixtures.product(id: "com.example.pro.monthly", slug: "pro-monthly"),
            TestFixtures.product(id: "store-id", slug: "pro-yearly"),
        ]

        #expect(PaywallCoordinator.findProduct(products, id: "store-id")?.slug == "pro-yearly")
        #expect(PaywallCoordinator.findProduct(products, id: "pro-monthly")?.id
            == "com.example.pro.monthly")

        let withProviderId = [
            TestFixtures.product(id: "product_1", slug: "pro-monthly", providerProductId: "com.example.pro.monthly")
        ]
        #expect(
            PaywallCoordinator.findProduct(withProviderId, id: "com.example.pro.monthly")?.id
                == "product_1")
        #expect(PaywallCoordinator.findProduct(withProviderId, id: "nope") == nil)
    }

    @Test("a purchase requested by provider product id reaches the store")
    func purchaseByProviderProductId() async throws {
        let presenter = MockPaywallPresenter()
        let coordinator = makeCoordinator(
            presenter: presenter,
            resolved: try PaywallCoordinatorTests.resolvedPaywall(),
            products: [
                TestFixtures.product(
                    id: "product_1", slug: "pro-monthly",
                    providerProductId: "com.example.pro.monthly")
            ]
        )
        let delegate = RecordingPaywallDelegate()
        try await coordinator.present(
            location: PaywallCoordinatorTests.locationSlug, delegate: delegate)

        await coordinator.handleBridgeEvent(
            locationSlug: PaywallCoordinatorTests.locationSlug,
            rawEvent:
                #"{"version":1,"type":"purchase","payload":{"productId":"com.example.pro.monthly"}}"#
        )

        #expect(
            presenter.messageKinds() == [
                "configure", "status:purchasing", "status:purchased", "response",
            ])
        #expect(delegate.purchasedProductIds == ["product_1"])
    }
}

/// Collects the events the coordinator routes into analytics.
final class CapturedEvents: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [(String, [String: JSONValue])] = []

    var names: [String] {
        return lock.withLock { storage.map(\.0) }
    }

    var properties: [[String: JSONValue]] {
        return lock.withLock { storage.map(\.1) }
    }

    func record(_ name: String, _ properties: [String: JSONValue]) {
        lock.withLock { storage.append((name, properties)) }
    }
}

/// Collects the urls the coordinator asked the host to open.
final class CapturedUrls: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [String] = []

    var values: [String] {
        return lock.withLock { storage }
    }

    func record(_ url: String) {
        lock.withLock { storage.append(url) }
    }
}
