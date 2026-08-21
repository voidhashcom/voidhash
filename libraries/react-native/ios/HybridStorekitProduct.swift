import Foundation
import NitroModules
import VoidhashCore

class HybridStorekitProduct: HybridStorekitProductSpec {
    private let product: StoreKitProductInfo

    init(product: StoreKitProductInfo) {
        self.product = product
    }

    // MARK: - HybridStorekitProductSpec Properties

    var id: String {
        return product.id
    }

    var type: String {
        return product.type
    }

    var displayName: String {
        return product.displayName
    }

    var description: String {
        return product.description
    }

    var displayPrice: String {
        return product.displayPrice
    }

    var price: Double {
        return product.price
    }

    var currency: String {
        return product.currency
    }

    var debugDescription: Variant_NullType_String? {
        guard let debugDescription = product.debugDescription else {
            return nil
        }
        return .second(debugDescription)
    }

    var isFamilyShareable: Bool {
        return product.isFamilyShareable
    }

    var subscription: Variant_NullType__any_HybridStorekitProductSubscriptionSpec_? {
        guard let subscription = product.subscription else {
            return nil
        }
        return .second(HybridStorekitProductSubscription(subscription: subscription))
    }
}
