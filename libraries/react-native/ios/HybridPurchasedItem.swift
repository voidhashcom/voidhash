import Foundation
import NitroModules

class HybridPurchasedItem: HybridPurchasedItemSpec {
    var type: PurchasedItemType
    var sku: String
    
    init(type: PurchasedItemType = .inapp, sku: String = "") {
        self.type = type
        self.sku = sku
    }
}
