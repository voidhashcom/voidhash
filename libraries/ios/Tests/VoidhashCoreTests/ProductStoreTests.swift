import Testing

@testable import VoidhashCore

@Suite("Product store")
struct ProductStoreTests {
    @Test("an empty store resolves no products")
    func emptyStore() async {
        let store = ProductStore()

        #expect(await store.getAllProducts().isEmpty)
        #expect(await store.getProduct(productID: "com.voidhash.pro") == nil)
    }

    @Test("removeAll is safe on an empty store")
    func removeAllOnEmptyStore() async {
        let store = ProductStore()

        await store.removeAll()

        #expect(await store.getAllProducts().isEmpty)
    }

    @Test("the backing dictionary starts empty")
    func productsStartEmpty() async {
        let store = ProductStore()

        #expect(await store.products.isEmpty)
    }
}
