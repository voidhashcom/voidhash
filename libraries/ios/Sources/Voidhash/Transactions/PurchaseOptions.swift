import Foundation
import VoidhashCore

/// Which price a purchase is made at.
public enum VoidhashOfferSelection: Sendable, Hashable {
    /// The subscription's introductory offer when the user can have it, the regular price
    /// otherwise.
    case automatic
    /// The regular price. The App Store still applies an introductory offer the user is
    /// eligible for: StoreKit gives no way to decline it.
    case none
    /// One of the product's ``VoidhashProduct/offers``, or its
    /// ``VoidhashSubscriptionInfo/introOffer``.
    case offer(VoidhashOffer)
    /// The offer with this id among the product's offers and its introductory offer: a
    /// promotional offer's Studio offer id, which paywalls name it by, or its App Store offer
    /// identifier; a win-back offer's App Store offer identifier.
    case id(String)
}

/// How to buy a product.
public struct VoidhashPurchaseOptions: Sendable {
    /// App Store options.
    public struct AppStore: Sendable {
        /// Makes a sandbox purchase wait for approval, as Ask to Buy does.
        public var simulatesAskToBuyInSandbox: Bool
        #if canImport(UIKit)
            /// Where StoreKit shows the purchase confirmation; `nil` lets the SDK find the scene
            /// the user is looking at. A view controller is honoured from iOS 18.2, before that
            /// its window's scene.
            public var confirmIn: StoreKitConfirmationTarget?

            public init(
                simulatesAskToBuyInSandbox: Bool = false,
                confirmIn: StoreKitConfirmationTarget? = nil
            ) {
                self.simulatesAskToBuyInSandbox = simulatesAskToBuyInSandbox
                self.confirmIn = confirmIn
            }
        #else
            public init(simulatesAskToBuyInSandbox: Bool = false) {
                self.simulatesAskToBuyInSandbox = simulatesAskToBuyInSandbox
            }
        #endif
    }

    public var offer: VoidhashOfferSelection
    /// How many units to buy; more than 1 only for a consumable.
    public var quantity: Int
    public var appStore: AppStore

    public init(
        offer: VoidhashOfferSelection = .automatic, quantity: Int = 1,
        appStore: AppStore = AppStore()
    ) {
        self.offer = offer
        self.quantity = quantity
        self.appStore = appStore
    }

    /// An App Store offer a purchase applies; StoreKit applies an introductory offer itself.
    enum AppStoreOffer: Sendable, Equatable {
        /// Signed by the backend for the purchase, which knows the offer by its Studio id.
        case promotional(offerId: String)
        case winBack(offerId: String)
    }

    /// The App Store offer buying `product` with these options applies; `nil` leaves the price
    /// to StoreKit, which applies the introductory offer to a user who can have it.
    ///
    /// - Throws: `INVALID_ARGUMENT` for a quantity below 1, or above 1 for a product that is not
    ///   a consumable; `OFFER_UNAVAILABLE` for an offer the product does not have for this user.
    func appStoreOffer(for product: VoidhashProduct) throws -> AppStoreOffer? {
        guard quantity >= 1 else {
            throw VoidhashStoreError.invalidArgument("\(quantity) is not a quantity to buy")
        }
        guard quantity == 1 || product.type == .consumable else {
            throw VoidhashStoreError.invalidArgument(
                "Only a consumable can be bought in a quantity; \(product.slug) is not one")
        }
        let available = product.offers + [product.subscription?.introOffer].compactMap { $0 }
        let selected: VoidhashOffer
        switch offer {
        case .automatic, .none:
            return nil
        case .offer(let offer):
            guard let match = available.first(where: { $0.id == offer.id && $0.kind == offer.kind })
            else {
                throw VoidhashStoreError.offerUnavailable(
                    "\(product.slug) has no \(offer.kind.rawValue) offer \"\(offer.id)\" for this user")
            }
            selected = match
        case .id(let id):
            guard
                let match = available.first(where: { $0.id == id })
                    ?? product.offer(appStoreOfferId: id)
            else {
                throw VoidhashStoreError.offerUnavailable(
                    "\(product.slug) has no offer \"\(id)\" for this user")
            }
            selected = match
        }
        switch selected.kind {
        case .introductory:
            return nil
        case .promotional:
            return .promotional(offerId: selected.id)
        case .winBack:
            return .winBack(offerId: selected.id)
        case .oneTime, .code, .unknown:
            throw VoidhashStoreError.offerUnavailable(
                "The App Store cannot apply the \(selected.kind.rawValue) offer \"\(selected.id)\"")
        }
    }
}

/// How a purchase ended.
public enum VoidhashPurchaseResult: Sendable, Equatable {
    /// The store charged the user. `synced` is `false` when Voidhash has not accepted the receipt
    /// yet: it is queued and delivered in the background, and the person refreshed once it is.
    case purchased(transaction: VoidhashTransaction, synced: Bool)
    /// The purchase waits for approval, such as Ask to Buy. It completes later and arrives
    /// through ``VoidhashClient/transactionUpdates()``.
    case pending
    /// The user closed the purchase sheet.
    case cancelled
    /// The client is disabled (``VoidhashOptions/enabled`` off, no publishable key, shut down);
    /// nothing was bought.
    case disabled
}
