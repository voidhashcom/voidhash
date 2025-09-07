import Foundation
import NitroModules
import StoreKit

class HybridVoidhash: HybridVoidhashSpec {
    func purchase(sku: String) throws -> Promise<(any HybridPurchasedItemSpec)> {
        // 1. synchronous part - quick validation
        guard !sku.isEmpty else {
            throw RuntimeError.error(withMessage: "INVALID_SKU: SKU cannot be empty")
        }

        // 2. return async promise for the heavy lifting
        return Promise.async {
            let products = try await Product.products(for: [sku])
            guard let product = products.first else {
                throw RuntimeError.error(withMessage: "NOT_FOUND: Product not found")
            }

            let result = try await product.purchase()

            switch result {
            case .success(_):
                let purchasedItem = HybridPurchasedItem()
                purchasedItem.type = .inapp
                purchasedItem.sku = sku
                return purchasedItem

            case .pending:
                throw RuntimeError.error(withMessage: "PENDING: Purchase is pending")

            case .userCancelled:
                throw RuntimeError.error(withMessage: "CANCELLED: Purchase was cancelled by user")

            @unknown default:
                throw RuntimeError.error(withMessage: "UNKNOWN: Unknown purchase result")
            }
        }
    }
}
