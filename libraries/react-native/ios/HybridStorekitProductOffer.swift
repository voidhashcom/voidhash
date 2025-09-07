import Foundation
import NitroModules
import StoreKit

class HybridStorekitProductOffer: HybridStorekitProductOfferSpec {
    private let offer: Product.SubscriptionOffer

    init(offer: Product.SubscriptionOffer) {
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
        return Double(offer.period.value)
    }

    var paymentMode: String {
        return offer.paymentMode.rawValue
    }

    var type: String {
        return offer.type.rawValue
    }

    var price: Double {
        return (offer.price as NSDecimalNumber).doubleValue
    }

    var displayPrice: String {
        return offer.displayPrice
    }
}
