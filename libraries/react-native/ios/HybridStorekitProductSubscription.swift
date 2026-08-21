import Foundation
import NitroModules
import VoidhashCore

class HybridStorekitProductSubscription: HybridStorekitProductSubscriptionSpec {
    private let subscription: StoreKitSubscriptionInfo

    init(subscription: StoreKitSubscriptionInfo) {
        self.subscription = subscription
    }

    // MARK: - HybridStorekitProductSubscriptionSpec Properties

    var introductoryOffer: Variant_NullType__any_HybridStorekitProductOfferSpec_? {
        guard let offer = subscription.introductoryOffer else {
            return nil
        }
        return .second(HybridStorekitProductOffer(offer: offer))
    }

    var promotionalOffers: [Variant_NullType__any_HybridStorekitProductOfferSpec_] {
        return subscription.promotionalOffers.map { offer in
            Variant_NullType__any_HybridStorekitProductOfferSpec_.second(
                HybridStorekitProductOffer(offer: offer)
            )
        }
    }

    var subscriptionGroupID: String {
        return subscription.subscriptionGroupID
    }

    var subscriptionPeriod: (any HybridStorekitProductSubscriptionPeriodSpec) {
        return HybridStorekitProductSubscriptionPeriod(period: subscription.subscriptionPeriod)
    }
}
