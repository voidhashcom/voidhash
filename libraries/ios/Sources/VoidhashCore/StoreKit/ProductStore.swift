
import Foundation
import StoreKit

@available(iOS 15.0, *)
public actor ProductStore {
  private(set) var products: [String: Product] = [:]

  public init() {}

  public func addProduct(_ product: Product) {
    self.products[product.id] = product
  }

  public func getAllProducts() -> [Product] {
    return Array(self.products.values)
  }

  public func getProduct(productID: String) -> Product? {
    return self.products[productID]
  }

  public func removeAll() {
    products.removeAll()
  }

  public func performOnActor(_ action: @escaping (isolated ProductStore) -> Void) async {
    action(self)
  }
}
