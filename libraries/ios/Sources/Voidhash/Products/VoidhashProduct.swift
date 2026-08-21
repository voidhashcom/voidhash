import Foundation
import VoidhashCore

/// A purchasable product: a dashboard product definition joined with its App Store metadata.
///
/// Mirrors the React Native `Product` entity so both SDKs expose the same fields; `interval` is
/// only present for subscriptions.
public struct VoidhashProduct: Sendable, Equatable {
    /// App Store product identifier.
    public let id: String
    /// Store product identifier configured for this product in the dashboard. Equal to ``id`` for
    /// every product that resolved in the store; kept separate so bridge lookups can match the
    /// configured id as well, exactly like the React Native `Product`.
    public let providerProductId: String
    /// Dashboard product slug.
    public let slug: String
    /// Dashboard product name.
    public let name: String
    /// Store description.
    public let description: String
    /// Store display name.
    public let displayName: String
    /// Locale-formatted price string from the store.
    public let displayPrice: String
    /// Numeric price in `currency`.
    public let price: Double
    /// ISO currency code of `price`.
    public let currency: String
    /// Store product type (`autoRenewable`, `consumable`, …).
    public let type: String
    /// Dashboard product type (`subscription`, `one-time-consumable`, …).
    public let productType: String
    /// Subscription billing interval (`month`, `year`, `week`, `day`), when the product renews.
    public let interval: String?

    public init(
        id: String,
        slug: String,
        name: String,
        description: String,
        displayName: String,
        displayPrice: String,
        price: Double,
        currency: String,
        type: String,
        productType: String,
        interval: String? = nil,
        providerProductId: String? = nil
    ) {
        self.id = id
        self.providerProductId = providerProductId ?? id
        self.slug = slug
        self.name = name
        self.description = description
        self.displayName = displayName
        self.displayPrice = displayPrice
        self.price = price
        self.currency = currency
        self.type = type
        self.productType = productType
        self.interval = interval
    }

    /// Joins a dashboard product definition with the store metadata fetched for it.
    public init(definition: RuntimeProductDefinition, storeProduct: StoreKitProductInfo) {
        self.init(
            id: storeProduct.id,
            slug: definition.slug,
            name: definition.properties.name,
            description: storeProduct.description,
            displayName: storeProduct.displayName,
            displayPrice: storeProduct.displayPrice,
            price: storeProduct.price,
            currency: storeProduct.currency,
            type: storeProduct.type,
            productType: definition.type,
            interval: storeProduct.subscription?.subscriptionPeriod.unit.rawValue,
            providerProductId: definition.configuration.providers.appleAppStore?.productId
        )
    }
}
