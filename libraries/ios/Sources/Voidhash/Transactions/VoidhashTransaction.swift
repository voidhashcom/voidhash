import Foundation
import VoidhashCore

/// The store a product is sold in, or a transaction was made in.
public enum VoidhashStore: String, Sendable, Hashable {
    case appStore
    /// Voidhash's development store, which charges nothing; debug builds only.
    case development
}

/// A purchase the store completed: a new purchase, a renewal, a redeemed offer code.
public struct VoidhashTransaction: Sendable, Hashable, Identifiable {
    /// The App Store transaction id.
    public let id: String
    /// The first transaction of its subscription series, the same for every renewal.
    public let originalId: String?
    /// The slug of the product bought; `nil` for a store product no product in Studio sells.
    public let productSlug: String?
    /// The App Store product identifier.
    public let storeProductId: String
    public let store: VoidhashStore
    public let purchasedAt: Date
    /// When the subscription period it bought ends; `nil` for a product that does not expire.
    public let expiresAt: Date?
    /// How many units the store charged for.
    public let quantity: Int
    /// Whether it renews a subscription; `nil` before iOS 17.
    public let isRenewal: Bool?
    /// The offer it was bought with.
    public let offer: VoidhashTransactionOffer?
    public let environment: VoidhashEnvironment
    /// What the App Store says about it; set exactly when ``store`` is ``VoidhashStore/appStore``.
    public let appStore: VoidhashAppStoreTransactionInfo?

    public init(
        id: String, originalId: String?, productSlug: String?, storeProductId: String,
        store: VoidhashStore, purchasedAt: Date, expiresAt: Date?, quantity: Int,
        isRenewal: Bool?, offer: VoidhashTransactionOffer?, environment: VoidhashEnvironment,
        appStore: VoidhashAppStoreTransactionInfo?
    ) {
        self.id = id
        self.originalId = originalId
        self.productSlug = productSlug
        self.storeProductId = storeProductId
        self.store = store
        self.purchasedAt = purchasedAt
        self.expiresAt = expiresAt
        self.quantity = quantity
        self.isRenewal = isRenewal
        self.offer = offer
        self.environment = environment
        self.appStore = appStore
    }

    /// A transaction of the store engine, named after the product it resolves to in `schema`.
    init(_ storeTransaction: StoreKitTransactionInfo, schema: RuntimeSchema) {
        let isDevelopment = storeTransaction.environment == .development
        self.init(
            id: storeTransaction.transactionId,
            originalId: storeTransaction.originalTransactionId,
            productSlug: PurchaseOrchestrator.resolveProductDefinition(
                storeProductId: storeTransaction.productId, products: schema.products)?.slug,
            storeProductId: storeTransaction.productId,
            store: isDevelopment ? .development : .appStore,
            purchasedAt: storeTransaction.purchaseDate,
            expiresAt: storeTransaction.expirationDate,
            quantity: storeTransaction.quantity,
            isRenewal: storeTransaction.isRenewal,
            offer: storeTransaction.offer,
            environment: storeTransaction.environment,
            appStore: isDevelopment ? nil : storeTransaction.appStore)
    }
}

/// A purchase that completed outside ``VoidhashClient/purchase(_:options:)``, as
/// ``VoidhashClient/transactionUpdates()`` reports it once the SDK has handled it.
public struct VoidhashTransactionUpdate: Sendable, Hashable {
    public let transaction: VoidhashTransaction
    /// `true` once Voidhash accepted the receipt. `false` while it is queued on the device: it is
    /// delivered in the background, and the person refreshed once it is.
    public let synced: Bool

    public init(transaction: VoidhashTransaction, synced: Bool) {
        self.transaction = transaction
        self.synced = synced
    }
}

/// A store transaction as the receipt pipeline processes it: what it sends, finishes and
/// remembers having sent.
struct ReceiptTransaction: Sendable, Equatable {
    enum State: String, Sendable, Equatable {
        case purchased
        case pending
    }

    /// Store transaction identifier.
    let transactionId: String
    /// Original transaction identifying the subscription series across renewals.
    let originalTransactionId: String?
    /// App Store product identifier the transaction belongs to; empty when a host reported only
    /// the transaction id.
    let productId: String
    /// Purchase timestamp in milliseconds since the epoch.
    let purchaseDate: Double
    let quantity: Double
    /// Whether nothing is left to finish with the store, as for a development purchase.
    let isAcknowledged: Bool
    /// The account token the purchase was made with, when present.
    let appAccountToken: String?
    /// Only `purchased` transactions are synced.
    let purchaseState: State
    /// True when the transaction came from the development store and must be recorded through
    /// the development gateway instead of `sync-transaction`.
    let isDevelopment: Bool
    /// When the App Store revoked the transaction (a refund, or removal from Family Sharing), in
    /// milliseconds since the epoch; `nil` while it stands.
    let revocationDate: Double?
    /// `nil` when unknown, as for a transaction a host reported by id.
    let environment: VoidhashEnvironment?

    init(
        transactionId: String,
        productId: String = "",
        purchaseDate: Double = 0,
        quantity: Double = 1,
        isAcknowledged: Bool = false,
        appAccountToken: String? = nil,
        purchaseState: State = .purchased,
        isDevelopment: Bool = false,
        originalTransactionId: String? = nil,
        revocationDate: Double? = nil,
        environment: VoidhashEnvironment? = nil
    ) {
        self.transactionId = transactionId
        self.originalTransactionId = originalTransactionId
        self.productId = productId
        self.purchaseDate = purchaseDate
        self.quantity = quantity
        self.isAcknowledged = isAcknowledged
        self.appAccountToken = appAccountToken
        self.purchaseState = purchaseState
        self.isDevelopment = isDevelopment
        self.revocationDate = revocationDate
        self.environment = environment
    }

    /// A transaction the store engine handed over.
    init(
        storeTransaction: StoreKitTransactionInfo,
        isDevelopment: Bool = false,
        isAcknowledgedOverride: Bool? = nil
    ) {
        self.init(
            transactionId: storeTransaction.transactionId,
            productId: storeTransaction.productId,
            purchaseDate: storeTransaction.purchaseDate.timeIntervalSince1970 * 1000,
            quantity: Double(storeTransaction.quantity),
            isAcknowledged: isAcknowledgedOverride ?? false,
            appAccountToken: storeTransaction.appAccountToken,
            purchaseState: .purchased,
            isDevelopment: isDevelopment,
            originalTransactionId: storeTransaction.originalTransactionId,
            revocationDate: storeTransaction.appStore.revocationDate.map {
                $0.timeIntervalSince1970 * 1000
            },
            environment: storeTransaction.environment
        )
    }

    /// What the device keeps about the transaction to recognise it once Voidhash accepted it.
    ///
    /// A transaction that names no product, as a host can report one, is recognised by its id
    /// alone. By its date and series a later transaction Voidhash accepted would stand for it,
    /// and it cannot be told from an upgrade, which no later renewal of the subscription it
    /// replaced stands for. So it is sent once and remembered under its own id.
    var receiptReference: ReceiptReference {
        guard !productId.isEmpty else {
            return ReceiptReference(transactionId: transactionId, isRevoked: revocationDate != nil)
        }
        return ReceiptReference(
            transactionId: transactionId, originalTransactionId: originalTransactionId,
            purchaseDate: purchaseDate, isRevoked: revocationDate != nil, productId: productId)
    }
}
