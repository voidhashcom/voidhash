import Foundation
import NitroModules
import VoidhashCore

class HybridStorekitProductOffer: HybridStorekitProductOfferSpec {
    private let offer: StoreKitSubscriptionOffer

    init(offer: StoreKitSubscriptionOffer) {
        self.offer = offer
    }

    // MARK: - HybridStorekitProductOfferSpec Properties

    var id: String? {
        return offer.id
    }

    var period: (any HybridStorekitProductSubscriptionPeriodSpec) {
        return HybridStorekitProductSubscriptionPeriod(period: offer.period)
    }

    var periodCount: Double {
        return offer.periodCount
    }

    var paymentMode: String {
        return offer.paymentMode
    }

    var type: String {
        return offer.type
    }

    var price: Double {
        return offer.price
    }

    var displayPrice: String {
        return offer.displayPrice
    }
}
