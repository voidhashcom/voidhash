import Foundation
import NitroModules
import StoreKit

class HybridStorekitProductSubscription: HybridStorekitProductSubscriptionSpec {
    private let subscription: Product.SubscriptionInfo

    init(subscription: Product.SubscriptionInfo) {
        self.subscription = subscription
    }

    // MARK: - HybridStorekitProductSubscriptionSpec Properties

    var introductoryOffer: (any HybridStorekitProductOfferSpec)? {
        guard let offer = subscription.introductoryOffer else {
            return nil
        }
        return HybridStorekitProductOffer(offer: offer)
    }

    var promotionalOffers: [(any HybridStorekitProductOfferSpec)] {
        return subscription.promotionalOffers.map { offer in
            HybridStorekitProductOffer(offer: offer)
        }
    }

    var subscriptionGroupID: String {
        return subscription.subscriptionGroupID
    }

    var subscriptionPeriod: (any HybridStorekitProductSubscriptionPeriodSpec) {
        return HybridStorekitProductSubscriptionPeriod(period: subscription.subscriptionPeriod)
    }
}
