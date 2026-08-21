import Foundation
import Testing

@testable import VoidhashCore

@Suite("Voidhash store error formatting")
struct VoidhashStoreErrorTests {
    @Test("description is CODE: message")
    func descriptionFormat() {
        let error = VoidhashStoreError(code: "USER_CANCELLED", message: "User cancelled the purchase")

        #expect(error.description == "USER_CANCELLED: User cancelled the purchase")
        #expect(error.localizedDescription == "USER_CANCELLED: User cancelled the purchase")
        #expect(error.errorDescription == "USER_CANCELLED: User cancelled the purchase")
    }

    @Test("localizedDescription of the boxed error keeps the contract prefix")
    func boxedErrorDescription() {
        let error: Error = VoidhashStoreError.storeKitNotInitialized

        #expect(error.localizedDescription == "STOREKIT_NOT_INITIALIZED: StoreKit connection not initialized")
    }

    @Test("shared codes match ERROR_HANDLING.md")
    func sharedCodes() {
        #expect(
            VoidhashStoreError.invalidProductId.description
                == "INVALID_PRODUCT_ID: Product not found in store")
        #expect(
            VoidhashStoreError.emptySkuList.description
                == "EMPTY_SKU_LIST: No SKUs provided for product query")
        #expect(
            VoidhashStoreError.purchasePending.description
                == "PURCHASE_PENDING: The payment was deferred")
        #expect(
            VoidhashStoreError.purchaseUnknownResult.description
                == "PURCHASE_UNKNOWN_RESULT: Unknown purchase result")
        #expect(
            VoidhashStoreError.transactionNotFound.description
                == "TRANSACTION_NOT_FOUND: Transaction not found")
        #expect(
            VoidhashStoreError.transactionVerificationFailed.description
                == "TRANSACTION_VERIFICATION_FAILED: Transaction verification failed")
        #expect(
            VoidhashStoreError.windowSceneNotFound.description
                == "WINDOW_SCENE_NOT_FOUND: Could not find window scene for UI presentation")
        #expect(
            VoidhashStoreError.paywallPresenterNotAvailable.description
                == "PAYWALL_PRESENTER_NOT_AVAILABLE: Could not resolve active UIViewController")
    }

    @Test("purchase failures append the underlying description")
    func purchaseFailedFormat() {
        #expect(
            VoidhashStoreError.purchaseFailed("network down").description
                == "PURCHASE_FAILED: Purchase operation failed - network down")
    }
}
