import Foundation
import VoidhashCore

/// Lifecycle state of a store transaction.
public enum VoidhashPurchaseState: String, Sendable, Equatable {
    case purchased
    case pending
    case unspecified
}

/// A store transaction projected into the fields the backend sync needs.
///
/// Mirrors the React Native `Transaction` entity as produced by the App Store adapter:
/// `productId` is the StoreKit product identifier and `isAcknowledged` is always `false`
/// because StoreKit finishes transactions rather than acknowledging them.
public struct VoidhashTransaction: Sendable, Equatable {
    /// Store transaction identifier.
    public let transactionId: String
    /// App Store product identifier the transaction belongs to.
    public let productId: String
    /// Purchase timestamp in milliseconds since the epoch.
    public let purchaseDate: Double
    /// Purchased quantity.
    public let quantity: Double
    /// Whether the store already considers the transaction finished.
    public let isAcknowledged: Bool
    /// Deterministic account token attached to the purchase, when present.
    public let appAccountToken: String?
    /// Signed transaction payload forwarded to the backend.
    public let receipt: String?
    /// Lifecycle state; only `purchased` transactions are synced.
    public let purchaseState: VoidhashPurchaseState
    /// True when the transaction came from the development (mock) store and must be
    /// recorded through the development gateway instead of `sync-transaction`.
    public let isDevelopment: Bool

    public init(
        transactionId: String,
        productId: String,
        purchaseDate: Double,
        quantity: Double,
        isAcknowledged: Bool = false,
        appAccountToken: String? = nil,
        receipt: String? = nil,
        purchaseState: VoidhashPurchaseState = .purchased,
        isDevelopment: Bool = false
    ) {
        self.transactionId = transactionId
        self.productId = productId
        self.purchaseDate = purchaseDate
        self.quantity = quantity
        self.isAcknowledged = isAcknowledged
        self.appAccountToken = appAccountToken
        self.receipt = receipt
        self.purchaseState = purchaseState
        self.isDevelopment = isDevelopment
    }

    /// Projects a StoreKit transaction, matching the React Native App Store adapter mapping.
    public init(
        storeTransaction: StoreKitTransactionInfo,
        isDevelopment: Bool = false,
        isAcknowledgedOverride: Bool? = nil
    ) {
        self.init(
            transactionId: storeTransaction.transactionId,
            productId: storeTransaction.id,
            purchaseDate: storeTransaction.transactionDate,
            quantity: storeTransaction.quantityIos,
            isAcknowledged: isAcknowledgedOverride ?? false,
            appAccountToken: storeTransaction.appAccountToken,
            receipt: storeTransaction.transactionReceipt,
            purchaseState: .purchased,
            isDevelopment: isDevelopment
        )
    }
}
