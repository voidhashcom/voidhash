import Foundation
import Testing
import VoidhashCore

@testable import Voidhash

@Suite("Paywall runtime config")
struct PaywallRuntimeConfigTests {
    static func runtime(productSlugs: [String], variables: String = #"{"headline": "Go Pro"}"#)
        -> SdkResolvedPaywall.Runtime
    {
        let slugs = productSlugs.map { "\"\($0)\"" }.joined(separator: ",")
        let json = """
            {
              "contentHash": "hash-1",
              "productSlugs": [\(slugs)],
              "variables": \(variables)
            }
            """
        // swiftlint:disable:next force_try
        return try! JSONDecoder().decode(
            SdkResolvedPaywall.Runtime.self, from: Data(json.utf8))
    }

    @Test("ISO-8601 billing periods map onto the contract period union")
    func mapsIsoIntervals() {
        #expect(PaywallRuntimeConfigBuilder.mapStoreIntervalToPeriod("P1M") == .month)
        #expect(PaywallRuntimeConfigBuilder.mapStoreIntervalToPeriod("p1y") == .year)
        #expect(PaywallRuntimeConfigBuilder.mapStoreIntervalToPeriod("P1W") == .week)
        #expect(PaywallRuntimeConfigBuilder.mapStoreIntervalToPeriod("P7D") == .week)
    }

    @Test("keyword intervals map onto the contract period union")
    func mapsKeywordIntervals() {
        #expect(PaywallRuntimeConfigBuilder.mapStoreIntervalToPeriod("month") == .month)
        #expect(PaywallRuntimeConfigBuilder.mapStoreIntervalToPeriod("Monthly") == .month)
        #expect(PaywallRuntimeConfigBuilder.mapStoreIntervalToPeriod("year") == .year)
        #expect(PaywallRuntimeConfigBuilder.mapStoreIntervalToPeriod("yearly") == .year)
        #expect(PaywallRuntimeConfigBuilder.mapStoreIntervalToPeriod(" ANNUAL ") == .year)
        #expect(PaywallRuntimeConfigBuilder.mapStoreIntervalToPeriod("week") == .week)
        #expect(PaywallRuntimeConfigBuilder.mapStoreIntervalToPeriod("weekly") == .week)
        #expect(PaywallRuntimeConfigBuilder.mapStoreIntervalToPeriod("lifetime") == .lifetime)
    }

    @Test("unknown and missing intervals map to no period")
    func unknownIntervalsMapToNil() {
        #expect(PaywallRuntimeConfigBuilder.mapStoreIntervalToPeriod(nil) == nil)
        #expect(PaywallRuntimeConfigBuilder.mapStoreIntervalToPeriod("") == nil)
        #expect(PaywallRuntimeConfigBuilder.mapStoreIntervalToPeriod("P3M") == nil)
    }

    @Test("the config carries the store-formatted price and the first product as the default")
    func buildsConfig() {
        let config = PaywallRuntimeConfigBuilder.build(
            runtime: PaywallRuntimeConfigTests.runtime(productSlugs: ["pro-yearly", "pro-monthly"]),
            productsBySlug: [
                "pro-monthly": TestFixtures.product(),
                "pro-yearly": TestFixtures.product(
                    id: "com.example.pro.yearly", slug: "pro-yearly",
                    displayPrice: "599,99 €", interval: "year"),
            ],
            platform: "ios",
            locale: "de-DE"
        )

        #expect(config.products.map(\.slug) == ["pro-yearly", "pro-monthly"])
        #expect(config.products[0].priceString == "599,99 €")
        #expect(config.products[0].period == .year)
        #expect(config.products[0].currencyCode == "EUR")
        #expect(config.products[1].period == .month)
        #expect(config.defaultSelectedProductId == "com.example.pro.yearly")
        #expect(config.platform == "ios")
        #expect(config.locale == "de-DE")
        #expect(config.variables["headline"] == .string("Go Pro"))
    }

    @Test("product slugs that did not resolve in the store are skipped")
    func skipsUnresolvedProducts() {
        var skipped: [String] = []
        let config = PaywallRuntimeConfigBuilder.build(
            runtime: PaywallRuntimeConfigTests.runtime(productSlugs: ["pro-monthly", "missing"]),
            productsBySlug: ["pro-monthly": TestFixtures.product()],
            platform: "ios",
            locale: nil,
            onSkippedProductSlug: { skipped.append($0) }
        )

        #expect(config.products.map(\.slug) == ["pro-monthly"])
        #expect(skipped == ["missing"])
    }

    @Test("an empty description and currency are omitted from the wire payload")
    func omitsEmptyOptionalFields() throws {
        let product = VoidhashProduct(
            id: "com.example.lifetime",
            slug: "lifetime",
            name: "Lifetime",
            description: "",
            displayName: "Lifetime",
            displayPrice: "$99.99",
            price: 99.99,
            currency: "",
            type: "nonConsumable",
            productType: "one-time-permanent",
            interval: nil
        )
        let config = PaywallRuntimeConfigBuilder.build(
            runtime: PaywallRuntimeConfigTests.runtime(productSlugs: ["lifetime"]),
            productsBySlug: ["lifetime": product],
            platform: "ios",
            locale: nil
        )

        let encoded = try JSONSerialization.jsonObject(with: JSONEncoder().encode(config))
        let object = try #require(encoded as? [String: Any])
        let products = try #require(object["products"] as? [[String: Any]])
        #expect(products[0]["description"] == nil)
        #expect(products[0]["currencyCode"] == nil)
        #expect(products[0]["period"] == nil)
        #expect(products[0]["priceString"] as? String == "$99.99")
    }
}
