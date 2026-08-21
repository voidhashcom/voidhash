import Foundation
import StoreKit

/// Kind of a purchased item, mirroring the `PurchasedItemType` union in the RN specs.
public enum PurchasedItemKind: String, Sendable, Equatable {
    case subscription
    case inapp
}

/// Unit of a subscription period.
public enum StoreKitSubscriptionPeriodUnit: String, Sendable, Equatable {
    case day
    case week
    case month
    case year
}

/// Duration of a subscription or offer period.
public struct StoreKitSubscriptionPeriod: Sendable, Equatable {
    public let unit: StoreKitSubscriptionPeriodUnit
    public let value: Double

    public init(unit: StoreKitSubscriptionPeriodUnit, value: Double) {
        self.unit = unit
        self.value = value
    }
}

/// Introductory or promotional offer attached to a subscription.
public struct StoreKitSubscriptionOffer: Sendable, Equatable {
    public let id: String?
    public let period: StoreKitSubscriptionPeriod
    public let periodCount: Double
    public let paymentMode: String
    public let type: String
    public let price: Double
    public let displayPrice: String

    public init(
        id: String?,
        period: StoreKitSubscriptionPeriod,
        periodCount: Double,
        paymentMode: String,
        type: String,
        price: Double,
        displayPrice: String
    ) {
        self.id = id
        self.period = period
        self.periodCount = periodCount
        self.paymentMode = paymentMode
        self.type = type
        self.price = price
        self.displayPrice = displayPrice
    }
}

/// Subscription metadata of a product.
public struct StoreKitSubscriptionInfo: Sendable, Equatable {
    public let introductoryOffer: StoreKitSubscriptionOffer?
    public let promotionalOffers: [StoreKitSubscriptionOffer]
    public let subscriptionGroupID: String
    public let subscriptionPeriod: StoreKitSubscriptionPeriod

    public init(
        introductoryOffer: StoreKitSubscriptionOffer?,
        promotionalOffers: [StoreKitSubscriptionOffer],
        subscriptionGroupID: String,
        subscriptionPeriod: StoreKitSubscriptionPeriod
    ) {
        self.introductoryOffer = introductoryOffer
        self.promotionalOffers = promotionalOffers
        self.subscriptionGroupID = subscriptionGroupID
        self.subscriptionPeriod = subscriptionPeriod
    }
}

/// Store metadata of a purchasable product.
public struct StoreKitProductInfo: Sendable, Equatable {
    public let id: String
    public let type: String
    public let displayName: String
    public let description: String
    public let displayPrice: String
    public let price: Double
    public let currency: String
    public let debugDescription: String?
    public let isFamilyShareable: Bool
    public let subscription: StoreKitSubscriptionInfo?

    public init(
        id: String,
        type: String,
        displayName: String,
        description: String,
        displayPrice: String,
        price: Double,
        currency: String,
        debugDescription: String?,
        isFamilyShareable: Bool,
        subscription: StoreKitSubscriptionInfo?
    ) {
        self.id = id
        self.type = type
        self.displayName = displayName
        self.description = description
        self.displayPrice = displayPrice
        self.price = price
        self.currency = currency
        self.debugDescription = debugDescription
        self.isFamilyShareable = isFamilyShareable
        self.subscription = subscription
    }
}

/// Offer that was applied to a purchase, mirroring `StorekitProductPurchaseOffer`.
public struct StoreKitPurchaseOffer: Sendable, Equatable {
    public let id: String
    public let type: Double
    public let paymentMode: String

    public init(id: String, type: Double, paymentMode: String) {
        self.id = id
        self.type = type
        self.paymentMode = paymentMode
    }
}

/// A verified StoreKit transaction projected into plain values.
public struct StoreKitTransactionInfo: Sendable, Equatable {
    public let id: String
    public let ids: [String]
    public let transactionId: String
    public let transactionDate: Double
    public let transactionReceipt: String
    public let quantityIos: Double
    public let originalTransactionDateIos: Double
    public let originalTransactionIdentifierIos: String
    public let appAccountToken: String?
    public let appBundleIdIos: String
    public let productTypeIos: String
    public let subscriptionGroupIdIos: String?
    public let webOrderLineItemIdIos: Double?
    public let expirationDateIos: Double?
    public let isUpgradedIos: Bool?
    public let ownershipTypeIos: String
    public let revocationDateIos: Double?
    public let revocationReasonIos: String?
    public let transactionReasonIos: String?
    public let jwsRepresentationIos: String?
    public let environmentIos: String?
    public let storefrontCountryCodeIos: String?
    public let reasonIos: String?
    public let offerIos: StoreKitPurchaseOffer?
    public let priceIos: Double?
    public let currencyIos: String?
    public let type: PurchasedItemKind
    public let sku: String

    public init(
        id: String,
        ids: [String],
        transactionId: String,
        transactionDate: Double,
        transactionReceipt: String,
        quantityIos: Double,
        originalTransactionDateIos: Double,
        originalTransactionIdentifierIos: String,
        appAccountToken: String?,
        appBundleIdIos: String,
        productTypeIos: String,
        subscriptionGroupIdIos: String?,
        webOrderLineItemIdIos: Double?,
        expirationDateIos: Double?,
        isUpgradedIos: Bool?,
        ownershipTypeIos: String,
        revocationDateIos: Double?,
        revocationReasonIos: String?,
        transactionReasonIos: String?,
        jwsRepresentationIos: String?,
        environmentIos: String?,
        storefrontCountryCodeIos: String?,
        reasonIos: String?,
        offerIos: StoreKitPurchaseOffer?,
        priceIos: Double?,
        currencyIos: String?,
        type: PurchasedItemKind,
        sku: String
    ) {
        self.id = id
        self.ids = ids
        self.transactionId = transactionId
        self.transactionDate = transactionDate
        self.transactionReceipt = transactionReceipt
        self.quantityIos = quantityIos
        self.originalTransactionDateIos = originalTransactionDateIos
        self.originalTransactionIdentifierIos = originalTransactionIdentifierIos
        self.appAccountToken = appAccountToken
        self.appBundleIdIos = appBundleIdIos
        self.productTypeIos = productTypeIos
        self.subscriptionGroupIdIos = subscriptionGroupIdIos
        self.webOrderLineItemIdIos = webOrderLineItemIdIos
        self.expirationDateIos = expirationDateIos
        self.isUpgradedIos = isUpgradedIos
        self.ownershipTypeIos = ownershipTypeIos
        self.revocationDateIos = revocationDateIos
        self.revocationReasonIos = revocationReasonIos
        self.transactionReasonIos = transactionReasonIos
        self.jwsRepresentationIos = jwsRepresentationIos
        self.environmentIos = environmentIos
        self.storefrontCountryCodeIos = storefrontCountryCodeIos
        self.reasonIos = reasonIos
        self.offerIos = offerIos
        self.priceIos = priceIos
        self.currencyIos = currencyIos
        self.type = type
        self.sku = sku
    }
}

/// Values scraped out of `Transaction.jsonRepresentation`.
///
/// StoreKit does not surface `webOrderLineItemID`, `transactionReason`, `price` or `currency`
/// on every supported OS version, so they are read back out of the signed JSON payload — this
/// is the same fallback the React Native projection performs.
public enum StoreKitTransactionJson {
    public static func webOrderLineItemId(from jsonRepresentation: Data) -> Double? {
        return (object(from: jsonRepresentation)?["webOrderLineItemID"] as? NSNumber)?.doubleValue
    }

    public static func transactionReason(from jsonRepresentation: Data) -> String? {
        return object(from: jsonRepresentation)?["transactionReason"] as? String
    }

    public static func price(from jsonRepresentation: Data) -> Double? {
        return (object(from: jsonRepresentation)?["price"] as? NSNumber)?.doubleValue
    }

    public static func currency(from jsonRepresentation: Data) -> String? {
        return object(from: jsonRepresentation)?["currency"] as? String
    }

    private static func object(from jsonRepresentation: Data) -> [String: Any]? {
        do {
            return try JSONSerialization.jsonObject(with: jsonRepresentation) as? [String: Any]
        } catch {
            print("Error parsing JSON representation: \(error)")
            return nil
        }
    }
}

@available(iOS 15.0, macOS 13.0, *)
extension StoreKitSubscriptionPeriodUnit {
    init(_ unit: Product.SubscriptionPeriod.Unit) {
        switch unit {
        case .day:
            self = .day
        case .week:
            self = .week
        case .month:
            self = .month
        case .year:
            self = .year
        @unknown default:
            self = .day
        }
    }
}

@available(iOS 15.0, macOS 13.0, *)
extension StoreKitSubscriptionPeriod {
    init(_ period: Product.SubscriptionPeriod) {
        self.init(unit: StoreKitSubscriptionPeriodUnit(period.unit), value: Double(period.value))
    }
}

@available(iOS 15.0, macOS 13.0, *)
extension StoreKitSubscriptionOffer {
    init(_ offer: Product.SubscriptionOffer) {
        self.init(
            id: offer.id,
            period: StoreKitSubscriptionPeriod(offer.period),
            periodCount: Double(offer.period.value),
            paymentMode: offer.paymentMode.rawValue,
            type: offer.type.rawValue,
            price: (offer.price as NSDecimalNumber).doubleValue,
            displayPrice: offer.displayPrice
        )
    }
}

@available(iOS 15.0, macOS 13.0, *)
extension StoreKitSubscriptionInfo {
    init(_ subscription: Product.SubscriptionInfo) {
        self.init(
            introductoryOffer: subscription.introductoryOffer.map(StoreKitSubscriptionOffer.init),
            promotionalOffers: subscription.promotionalOffers.map(StoreKitSubscriptionOffer.init),
            subscriptionGroupID: subscription.subscriptionGroupID,
            subscriptionPeriod: StoreKitSubscriptionPeriod(subscription.subscriptionPeriod)
        )
    }
}

@available(iOS 15.0, macOS 13.0, *)
extension StoreKitProductInfo {
    /// Projects a StoreKit product into plain values.
    public init(product: Product) {
        self.init(
            id: product.id,
            type: product.type.rawValue,
            displayName: product.displayName,
            description: product.description,
            displayPrice: product.displayPrice,
            price: (product.price as NSDecimalNumber).doubleValue,
            currency: product.priceFormatStyle.currencyCode,
            debugDescription: product.debugDescription,
            isFamilyShareable: product.isFamilyShareable,
            subscription: product.subscription.map(StoreKitSubscriptionInfo.init)
        )
    }
}

@available(iOS 15.0, macOS 13.0, *)
extension StoreKitTransactionInfo {
    /// Projects a verified StoreKit transaction into plain values.
    public init(transaction: Transaction) {
        let jsonRepresentation = transaction.jsonRepresentation

        var environment: String?
        if #available(iOS 16.0, *) {
            environment = transaction.environment.rawValue
        }

        var storefrontCountryCode: String?
        var reason: String?
        if #available(iOS 17.0, macOS 14.0, *) {
            storefrontCountryCode = transaction.storefront.countryCode
            reason = transaction.reason.rawValue
        }

        var offer: StoreKitPurchaseOffer?
        if #available(iOS 17.2, macOS 14.4, *), let transactionOffer = transaction.offer {
            offer = StoreKitPurchaseOffer(
                id: transactionOffer.id ?? "",
                type: Double(transactionOffer.type.rawValue),
                paymentMode: transactionOffer.paymentMode?.rawValue ?? ""
            )
        }

        var price: Double?
        var currency: String?
        if #available(iOS 15.4, *) {
            price = StoreKitTransactionJson.price(from: jsonRepresentation)
            currency = StoreKitTransactionJson.currency(from: jsonRepresentation)
        }

        let isSubscription =
            transaction.productType.rawValue.lowercased().contains("renewable")
            || transaction.expirationDate != nil

        self.init(
            id: transaction.productID,
            ids: [transaction.productID],
            transactionId: String(transaction.id),
            transactionDate: transaction.purchaseDate.timeIntervalSince1970 * 1000,
            transactionReceipt: String(data: jsonRepresentation, encoding: .utf8) ?? "",
            quantityIos: Double(transaction.purchasedQuantity),
            originalTransactionDateIos: transaction.originalPurchaseDate.timeIntervalSince1970
                * 1000,
            originalTransactionIdentifierIos: String(transaction.originalID),
            appAccountToken: transaction.appAccountToken?.uuidString,
            appBundleIdIos: transaction.appBundleID,
            productTypeIos: transaction.productType.rawValue,
            subscriptionGroupIdIos: transaction.subscriptionGroupID,
            webOrderLineItemIdIos: StoreKitTransactionJson.webOrderLineItemId(
                from: jsonRepresentation),
            expirationDateIos: transaction.expirationDate.map { $0.timeIntervalSince1970 * 1000 },
            isUpgradedIos: transaction.isUpgraded,
            ownershipTypeIos: transaction.ownershipType.rawValue,
            revocationDateIos: transaction.revocationDate.map { $0.timeIntervalSince1970 * 1000 },
            revocationReasonIos: transaction.revocationReason?.rawValue.description,
            transactionReasonIos: StoreKitTransactionJson.transactionReason(
                from: jsonRepresentation),
            jwsRepresentationIos: nil,
            environmentIos: environment,
            storefrontCountryCodeIos: storefrontCountryCode,
            reasonIos: reason,
            offerIos: offer,
            priceIos: price,
            currencyIos: currency,
            type: isSubscription ? .subscription : .inapp,
            sku: transaction.productID
        )
    }
}
