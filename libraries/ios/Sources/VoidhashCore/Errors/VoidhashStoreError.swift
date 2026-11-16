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
    /// Why the store refused a purchase, when it said; `nil` for every other failure.
    public let reason: VoidhashPurchaseFailureReason?

    public init(code: String, message: String, reason: VoidhashPurchaseFailureReason? = nil) {
        self.code = code
        self.message = message
        self.reason = reason
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

/// Why the store refused a purchase, on top of the failure's code. The other Voidhash SDKs report
/// the same reasons under the same names.
public enum VoidhashPurchaseFailureReason: String, Sendable, Hashable {
    /// The payment was declined, as for insufficient funds. Google Play only: StoreKit reports no
    /// declined payment.
    case paymentDeclined
    /// The user's store account is not eligible for the offer, such as a promotional offer the
    /// App Store does not give them. Eligibility belongs to the store account, not to the Voidhash
    /// user; the product is never bought at its regular price instead.
    case ineligibleForOffer
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

    /// A purchase was started while another one was still in flight. Nothing was bought.
    public static let purchaseInProgress = VoidhashStoreError(
        code: "PURCHASE_IN_PROGRESS", message: "Another purchase is in progress")

    /// A call was made with an argument it cannot take, as `reason` says. A programmer error;
    /// nothing was done.
    public static func invalidArgument(_ reason: String) -> VoidhashStoreError {
        return VoidhashStoreError(code: "INVALID_ARGUMENT", message: reason)
    }

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

    /// `identify` was called with an empty or whitespace-only id, which no request can be
    /// scoped to. A programmer error; the identity is left unchanged.
    public static let invalidDistinctId = invalidDistinctId(
        reason: "must contain at least one non-whitespace character")

    /// `identify` was called with an id the API refuses for the `reason` given, see
    /// ``IdentityStore/invalidDistinctIdReason(_:)``. A programmer error; the identity is left
    /// unchanged.
    public static func invalidDistinctId(reason: String) -> VoidhashStoreError {
        return invalidArgument("A distinct id \(reason)")
    }

    /// `setPersonAttributes` received trait values that are objects or arrays under `keys`. Traits
    /// are flat: strings, numbers, booleans or `null`. A programmer error; nothing is sent or
    /// queued.
    public static func invalidPersonTraits(keys: [String]) -> VoidhashStoreError {
        return VoidhashStoreError(
            code: "INVALID_ARGUMENT",
            message:
                "Person traits must be strings, numbers, booleans or null: \(keys.joined(separator: ", ")) is not"
        )
    }

    public static let windowSceneNotFound = VoidhashStoreError(
        code: "WINDOW_SCENE_NOT_FOUND",
        message: "Could not find window scene for UI presentation")

    public static let paywallPresenterNotAvailable = VoidhashStoreError(
        code: "PAYWALL_PRESENTER_NOT_AVAILABLE",
        message: "Could not resolve active UIViewController")

    /// A purchase named an offer that cannot be bought now: the store does not offer it to this
    /// user, the product's mapping has no such offer, or Voidhash could not sign it. The product
    /// was not bought at its regular price instead.
    public static func offerUnavailable(_ reason: String) -> VoidhashStoreError {
        return VoidhashStoreError(code: "OFFER_UNAVAILABLE", message: reason)
    }

    /// The App Store refused the offer a purchase named, as `message` says, because the user's
    /// account is not eligible for it: `OFFER_UNAVAILABLE` with the reason
    /// ``VoidhashPurchaseFailureReason/ineligibleForOffer``. Nothing was bought.
    public static func ineligibleForOffer(_ message: String) -> VoidhashStoreError {
        return VoidhashStoreError(
            code: "OFFER_UNAVAILABLE", message: message, reason: .ineligibleForOffer)
    }

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
