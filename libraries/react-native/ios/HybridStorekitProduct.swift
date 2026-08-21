import Foundation
import NitroModules
import StoreKit

class HybridStorekitProduct: HybridStorekitProductSpec {
    private let product: Product

    init(product: Product) {
        self.product = product
    }

    // MARK: - HybridStorekitProductSpec Properties
    
    var id: String {
        return product.id
    }
    
    var type: String {
        return product.type.rawValue
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
        return (product.price as NSDecimalNumber).doubleValue
    }
    
    var currency: String {
        return product.priceFormatStyle.currencyCode
    }

    var debugDescription: Variant_NullType_String? {
        return .second(product.debugDescription)
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
