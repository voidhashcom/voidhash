import Foundation

/// Error raised by the shared native core.
///
/// The string form is a wire contract: the React Native TypeScript layer branches on the
/// `"CODE: message"` prefix, so codes and messages must stay identical to the ones documented
/// in `libraries/react-native/ERROR_HANDLING.md`.
public struct VoidhashStoreError: Error, Equatable, Sendable, CustomStringConvertible,
    LocalizedError
{
    /// Stable uppercase error code, e.g. `USER_CANCELLED`.
    public let code: String
    /// Human readable message describing the failure.
    public let message: String

    public init(code: String, message: String) {
        self.code = code
        self.message = message
    }

    public var description: String {
        return "\(code): \(message)"
    }

    public var errorDescription: String? {
        return description
    }

    public var localizedDescription: String {
        return description
    }
}

extension VoidhashStoreError {
    public static let storeKitNotInitialized = VoidhashStoreError(
        code: "STOREKIT_NOT_INITIALIZED", message: "StoreKit connection not initialized")

    public static let invalidProductId = VoidhashStoreError(
        code: "INVALID_PRODUCT_ID", message: "Product not found in store")

    public static let emptySkuList = VoidhashStoreError(
        code: "EMPTY_SKU_LIST", message: "No SKUs provided for product query")

    public static let userCancelled = VoidhashStoreError(
        code: "USER_CANCELLED", message: "User cancelled the purchase")

    public static let purchasePending = VoidhashStoreError(
        code: "PURCHASE_PENDING", message: "The payment was deferred")

    /// Purchase initiation is unavailable while the SDK is observing another store owner.
    public static let readOnlyPurchaseNotAllowed = VoidhashStoreError(
        code: "READ_ONLY_PURCHASE_NOT_ALLOWED",
        message: "Read-only mode is enabled. Purchasing is disabled for observer-only operation.")

    public static let purchaseUnknownResult = VoidhashStoreError(
        code: "PURCHASE_UNKNOWN_RESULT", message: "Unknown purchase result")

    public static let transactionNotFound = VoidhashStoreError(
        code: "TRANSACTION_NOT_FOUND", message: "Transaction not found")

    public static let transactionVerificationFailed = VoidhashStoreError(
        code: "TRANSACTION_VERIFICATION_FAILED", message: "Transaction verification failed")

    /// The backend answered the transaction sync with `accepted: false`.
    public static func transactionVerificationRejected(transactionId: String)
        -> VoidhashStoreError
    {
        return VoidhashStoreError(
            code: "TRANSACTION_VERIFICATION_FAILED",
            message: "Transaction verification failed - the backend rejected \(transactionId)")
    }

    public static let windowSceneNotFound = VoidhashStoreError(
        code: "WINDOW_SCENE_NOT_FOUND",
        message: "Could not find window scene for UI presentation")

    public static let paywallPresenterNotAvailable = VoidhashStoreError(
        code: "PAYWALL_PRESENTER_NOT_AVAILABLE",
        message: "Could not resolve active UIViewController")

    /// Wraps an underlying purchase failure, preserving the message shape used by the RN adapter.
    public static func purchaseFailed(_ underlying: String) -> VoidhashStoreError {
        return VoidhashStoreError(
            code: "PURCHASE_FAILED", message: "Purchase operation failed - \(underlying)")
    }

    public static func methodNotAvailableTvOS(_ message: String) -> VoidhashStoreError {
        return VoidhashStoreError(code: "METHOD_NOT_AVAILABLE_TVOS", message: message)
    }

    public static func methodNotAvailableOnPlatform(_ message: String) -> VoidhashStoreError {
        return VoidhashStoreError(code: "METHOD_NOT_AVAILABLE_PLATFORM", message: message)
    }
}
