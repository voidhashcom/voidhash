import Foundation
import VoidhashCore

/// A product the app sells: a product configured in Studio, with its price and the offers the
/// current user can have in the store.
public struct VoidhashProduct: Sendable, Hashable, Identifiable {
    /// What kind of product it is.
    public enum ProductType: String, Sendable, Hashable {
        /// Renews until canceled; ``VoidhashProduct/subscription`` describes it.
        case subscription
        /// Bought again and again, such as coins.
        case consumable
        /// Bought once and kept, such as a lifetime unlock.
        case nonConsumable
        /// An App Store subscription that does not renew on its own.
        case nonRenewingSubscription
        /// A product type this SDK version does not know.
        case unknown
    }

    /// The Voidhash product id, which ``SdkSubscription/productId`` and the purchase history name.
    public let productId: String
    /// The product's slug in Studio.
    public let slug: String
    public let store: VoidhashStore
    /// The App Store product identifier, or the development store's.
    public let storeProductId: String
    public let type: ProductType
    /// The product's name in Studio.
    public let name: String
    /// The store's localized title.
    public let displayName: String
    /// The store's localized description.
    public let description: String
    /// The regular price.
    public let price: VoidhashPrice
    /// Set exactly when ``type`` is ``ProductType/subscription``.
    public let subscription: VoidhashSubscriptionInfo?
    /// The promotional and win-back offers the user can have right now. A promotional offer is
    /// one Studio exposes, named by its Studio offer id; a win-back offer is named by its App
    /// Store offer identifier. The introductory offer is ``VoidhashSubscriptionInfo/introOffer``.
    public let offers: [VoidhashOffer]
    /// What the App Store says about the product; set exactly when ``store`` is
    /// ``VoidhashStore/appStore``.
    public let appStore: VoidhashAppStoreProductInfo?
    /// The App Store offer identifier of each promotional offer in ``offers``, by its Studio id.
    let appStoreOfferIds: [String: String]
    /// Whether the development store sells the product once because its development
    /// configuration's period is `lifetime`, which flows show as the product's period.
    let isDevelopmentLifetime: Bool

    /// ``slug``, which identifies the product among the app's products.
    public var id: String { slug }

    public init(
        productId: String, slug: String, store: VoidhashStore, storeProductId: String, type: ProductType,
        name: String, displayName: String, description: String, price: VoidhashPrice,
        subscription: VoidhashSubscriptionInfo?, offers: [VoidhashOffer],
        appStore: VoidhashAppStoreProductInfo?
    ) {
        self.init(
            productId: productId, slug: slug, store: store, storeProductId: storeProductId,
            type: type, name: name, displayName: displayName, description: description,
            price: price, subscription: subscription, offers: offers, appStore: appStore,
            appStoreOfferIds: [:], isDevelopmentLifetime: false)
    }

    private init(
        productId: String, slug: String, store: VoidhashStore, storeProductId: String, type: ProductType,
        name: String, displayName: String, description: String, price: VoidhashPrice,
        subscription: VoidhashSubscriptionInfo?, offers: [VoidhashOffer],
        appStore: VoidhashAppStoreProductInfo?, appStoreOfferIds: [String: String],
        isDevelopmentLifetime: Bool
    ) {
        self.productId = productId
        self.slug = slug
        self.store = store
        self.storeProductId = storeProductId
        self.type = type
        self.name = name
        self.displayName = displayName
        self.description = description
        self.price = price
        self.subscription = subscription
        self.offers = offers
        self.appStore = appStore
        self.appStoreOfferIds = appStoreOfferIds
        self.isDevelopmentLifetime = isDevelopmentLifetime
    }

    /// Joins a product configured in Studio with what the App Store sells as it; `nil` when the
    /// App Store product cannot be sold as Studio's type (see ``soldType(studioType:appStoreType:)``).
    ///
    /// Of the promotional offers the user can have, only the ones Studio exposes are kept, in
    /// Studio's order and under their Studio offer ids: Voidhash signs no other. Win-back offers
    /// need no signature and keep their App Store offer identifiers.
    public init?(definition: RuntimeProductDefinition, storeProduct: StoreKitProductInfo) {
        guard
            let type = Self.soldType(
                studioType: definition.type, appStoreType: storeProduct.appStore.productType)
        else {
            return nil
        }
        let promotional = storeProduct.offers.filter { $0.kind == .promotional }
        var offers: [VoidhashOffer] = []
        var appStoreOfferIds: [String: String] = [:]
        for mapped in definition.configuration.providers.appleAppStore?.offers ?? []
        where appStoreOfferIds[mapped.id] == nil {
            guard let offer = promotional.first(where: { $0.id == mapped.offerId }) else {
                continue
            }
            offers.append(
                VoidhashOffer(
                    id: mapped.id, kind: offer.kind, phases: offer.phases, price: offer.price))
            appStoreOfferIds[mapped.id] = mapped.offerId
        }
        offers += storeProduct.offers.filter { $0.kind != .promotional }
        self.init(
            productId: definition.id, slug: definition.slug, store: .appStore,
            storeProductId: storeProduct.id, type: type, name: definition.properties.name,
            displayName: storeProduct.displayName, description: storeProduct.description,
            price: storeProduct.price,
            subscription: type == .subscription ? storeProduct.subscription : nil,
            offers: offers, appStore: storeProduct.appStore, appStoreOfferIds: appStoreOfferIds,
            isDevelopmentLifetime: false)
    }

    /// The type a product of `studioType` in Studio is sold as when the App Store sells it as
    /// `appStoreType`; `nil` when the two contradict, as on Google Play, where the store returns
    /// no product of the other type.
    ///
    /// A Studio subscription needs an auto-renewable subscription and a Studio consumable a
    /// consumable. A Studio one-time product is a non-consumable, or a non-renewing subscription,
    /// which the App Store also sells once. A type either side does not know does not contradict.
    static func soldType(studioType: String, appStoreType: VoidhashAppStoreProductType)
        -> ProductType?
    {
        let studio = type(ofStudioType: studioType)
        let store: ProductType
        switch appStoreType {
        case .autoRenewable: store = .subscription
        case .nonRenewable: store = .nonRenewingSubscription
        case .consumable: store = .consumable
        case .nonConsumable: store = .nonConsumable
        case .unknown: return studio
        }
        switch (studio, store) {
        case (.unknown, _): return store
        case (.nonConsumable, .nonRenewingSubscription): return store
        default: return studio == store ? store : nil
        }
    }

    /// The offer of this product the App Store names `appStoreOfferId`: the introductory offer
    /// for `nil`, which it has no identifier for.
    func offer(appStoreOfferId: String?) -> VoidhashOffer? {
        guard let appStoreOfferId else {
            return subscription?.introOffer
        }
        let studioId = appStoreOfferIds.first { $0.value == appStoreOfferId }?.key
        return offers.first { offer in
            offer.kind == .promotional ? offer.id == studioId : offer.id == appStoreOfferId
        }
    }

    /// A development store product, priced and timed as the project's development
    /// configuration says. It has no offers; a `lifetime` period makes it a non-consumable. A
    /// subscription's group is its development product id, as on Android.
    public init(
        definition: RuntimeProductDefinition,
        development configuration: RuntimeDevelopmentProductConfiguration
    ) {
        let currencyCode = configuration.currencyCode
        let format = VoidhashPrice.formatter(Decimal.FormatStyle.Currency(code: currencyCode))
        let minorUnits: Decimal = pow(Decimal(10), VoidhashPrice.minorUnits(of: currencyCode))
        let amount: Decimal = Decimal(configuration.priceInMinorUnits) / minorUnits
        let price = VoidhashPrice(
            amount: amount, currencyCode: currencyCode, formatted: format(amount))
        var type = Self.type(ofStudioType: definition.type)
        var subscription: VoidhashSubscriptionInfo?
        if let unit = VoidhashPeriod.Unit(rawValue: configuration.period) {
            subscription = VoidhashSubscriptionInfo(
                period: VoidhashPeriod(unit: unit, count: Int(configuration.periodCount)),
                groupId: configuration.productId, introOffer: nil, price: price, format: format)
        } else if type == .subscription {
            // A `lifetime` period: bought once and kept.
            type = .nonConsumable
        }
        self.init(
            productId: definition.id, slug: definition.slug, store: .development,
            storeProductId: configuration.productId, type: type, name: definition.properties.name,
            displayName: definition.properties.name, description: "Development purchase",
            price: price, subscription: type == .subscription ? subscription : nil, offers: [],
            appStore: nil, appStoreOfferIds: [:],
            isDevelopmentLifetime: configuration.period == "lifetime")
    }

    /// The product type a Studio definition type stands for.
    static func type(ofStudioType studioType: String) -> ProductType {
        switch studioType {
        case "subscription": return .subscription
        case "one-time": return .nonConsumable
        case "one-time-consumable": return .consumable
        default: return .unknown
        }
    }
}
