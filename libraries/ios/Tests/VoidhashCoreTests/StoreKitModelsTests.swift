import Foundation
import Testing

@testable import VoidhashCore

@Suite("StoreKit model mapping")
struct StoreKitModelsTests {
    private static let jsonRepresentation = Data(
        """
        {"webOrderLineItemID":2000000012345678,"transactionReason":"PURCHASE","price":59990,"currency":"EUR"}
        """.utf8)

    @Test("jsonRepresentation fallbacks scrape the signed payload")
    func scrapesJsonRepresentation() {
        let data = Self.jsonRepresentation

        #expect(StoreKitTransactionJson.webOrderLineItemId(from: data) == 2_000_000_012_345_678)
        #expect(StoreKitTransactionJson.transactionReason(from: data) == "PURCHASE")
        #expect(StoreKitTransactionJson.price(from: data) == 59990)
        #expect(StoreKitTransactionJson.currency(from: data) == "EUR")
    }

    @Test("missing fields fall back to nil")
    func missingFieldsAreNil() {
        let data = Data("{}".utf8)

        #expect(StoreKitTransactionJson.webOrderLineItemId(from: data) == nil)
        #expect(StoreKitTransactionJson.transactionReason(from: data) == nil)
        #expect(StoreKitTransactionJson.price(from: data) == nil)
        #expect(StoreKitTransactionJson.currency(from: data) == nil)
    }

    @Test("malformed payloads do not throw")
    func malformedPayloadIsTolerated() {
        let data = Data("not json".utf8)

        #expect(StoreKitTransactionJson.webOrderLineItemId(from: data) == nil)
        #expect(StoreKitTransactionJson.currency(from: data) == nil)
    }

    @Test("purchased item kinds match the React Native union")
    func purchasedItemKindRawValues() {
        #expect(PurchasedItemKind.subscription.rawValue == "subscription")
        #expect(PurchasedItemKind.inapp.rawValue == "inapp")
    }

    @Test("subscription period units match the React Native union")
    func periodUnitRawValues() {
        #expect(StoreKitSubscriptionPeriodUnit.day.rawValue == "day")
        #expect(StoreKitSubscriptionPeriodUnit.week.rawValue == "week")
        #expect(StoreKitSubscriptionPeriodUnit.month.rawValue == "month")
        #expect(StoreKitSubscriptionPeriodUnit.year.rawValue == "year")
    }
}
