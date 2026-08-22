import Foundation
import VoidhashCore

/// Backend sync surface used by ``PurchaseOrchestrator``; implemented by ``VoidhashApiClient``.
public protocol TransactionSyncing: Sendable {
    /// `POST /api/v1/sdk/sync-transaction`
    func syncTransaction(headers: [String: String], body: SdkSyncTransactionBody) async throws
        -> SdkSyncTransactionResponse
}

extension VoidhashApiClient: TransactionSyncing {}

/// Development-gateway sync surface; implemented by ``VoidhashApiClient``.
public protocol DevelopmentPurchasing: Sendable {
    /// `POST /api/v1/sdk/development/purchase`
    func developmentPurchase(headers: [String: String], body: SdkDevelopmentPurchaseBody)
        async throws
}

extension VoidhashApiClient: DevelopmentPurchasing {}

/// Raised when one or more observed transactions could not be reconciled.
public struct ReconcileTransactionsError: Error, Sendable, CustomStringConvertible, LocalizedError {
    /// Stable error code.
    public let code = "RECONCILE_TRANSACTIONS_FAILED"
    /// Human readable message.
    public let message: String
    /// Identifiers of the transactions that failed.
    public let transactionIds: [String]

    public init(transactionIds: [String]) {
        self.transactionIds = transactionIds
        self.message = "Failed to restore \(transactionIds.count) transactions"
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

/// Owns the transaction lifecycle: deduplicated backend sync, store finalization and
/// reconciliation of transactions observed outside a purchase this SDK started.
///
/// Ported from `src/core/transactions/transaction-service.ts`; the in-flight map coalesces
/// concurrent processing of the same transaction and the processed-transaction cache
/// (`{backendAccepted, storeFinalized}`, 30 minute TTL) catches duplicates across launches.
public actor PurchaseOrchestrator {
    /// Lifetime of a processed-transaction cache entry.
    public static let processedTransactionTtlMilliseconds: Double = 1000 * 60 * 30

    struct TransactionProcessingState: Codable, Sendable, Equatable {
        let backendAccepted: Bool
        let storeFinalized: Bool
    }

    /// Coalescing entry for one transaction being processed right now.
    ///
    /// `ownerClaimed` is the strongest claim any joined caller made: a purchase this SDK started
    /// pins owner mode and must win over the live read-only flag. `storeFinalizationPending`
    /// records that the running processing synced the transaction but skipped the store finish
    /// because it read read-only mode, so an owner caller that joined too late can finish it
    /// afterwards without re-syncing.
    // Only ever mutated from inside the actor; the `@unchecked` conformance exists so it can be
    // captured by the actor-isolated processing task.
    private final class InFlightTransaction: @unchecked Sendable {
        var ownerClaimed: Bool
        var storeFinalizationPending = false
        var task: Task<Void, any Error>?

        init(ownerClaimed: Bool) {
            self.ownerClaimed = ownerClaimed
        }
    }

    private let engine: any StoreKitEngineProtocol
    private let api: any TransactionSyncing
    private let developmentApi: (any DevelopmentPurchasing)?
    /// When true purchases run against the mock store and are recorded through the
    /// development gateway instead of `sync-transaction`.
    private let isDevelopmentMode: Bool
    private let cacheManager: CacheManager
    private let headersProvider: @Sendable () async -> [String: String]
    private let distinctIdProvider: @Sendable () async -> String
    private let isReadOnly: @Sendable () -> Bool
    private let refreshPerson: @Sendable () async -> Void

    private var inFlightTransactions: [String: InFlightTransaction] = [:]

    /// - Parameters:
    ///   - engine: Store engine used to buy and finish transactions.
    ///   - api: Backend sync client.
    ///   - developmentApi: Development-gateway client; required in development mode.
    ///   - isDevelopmentMode: Routes purchases through the mock store and dev endpoint.
    ///   - cacheManager: Cache holding the processed-transaction states.
    ///   - headersProvider: Builds the common SDK headers for the current identity.
    ///   - distinctIdProvider: Returns the current distinct id.
    ///   - isReadOnly: Reads the live read-only (observer mode) flag.
    ///   - refreshPerson: Refreshes the cached person snapshot after a purchase or restore.
    public init(
        engine: any StoreKitEngineProtocol,
        api: any TransactionSyncing,
        developmentApi: (any DevelopmentPurchasing)? = nil,
        isDevelopmentMode: Bool = false,
        cacheManager: CacheManager,
        headersProvider: @escaping @Sendable () async -> [String: String],
        distinctIdProvider: @escaping @Sendable () async -> String,
        isReadOnly: @escaping @Sendable () -> Bool,
        refreshPerson: @escaping @Sendable () async -> Void
    ) {
        self.engine = engine
        self.api = api
        self.developmentApi = developmentApi
        self.isDevelopmentMode = isDevelopmentMode
        self.cacheManager = cacheManager
        self.headersProvider = headersProvider
        self.distinctIdProvider = distinctIdProvider
        self.isReadOnly = isReadOnly
        self.refreshPerson = refreshPerson
    }

    /// Buys `product`, syncs the resulting transaction and finishes it with the store.
    ///
    /// The read-only flag is pinned when the purchase starts: a purchase this SDK owns is still
    /// finished even if the host app flips to observer mode while the store sheet is open.
    public func purchase(product: VoidhashProduct, schema: RuntimeSchema) async throws {
        let readOnlyAtPurchaseStart = isReadOnly()
        let distinctId = await distinctIdProvider()
        let storeTransaction = try await engine.buyProduct(
            sku: product.id,
            appAccountToken: AccountToken.derive(distinctId: distinctId),
            quantity: 1
        )
        // Dev purchases have nothing to acknowledge — the backend records them directly.
        let transaction = VoidhashTransaction(
            storeTransaction: storeTransaction,
            isDevelopment: isDevelopmentMode,
            isAcknowledgedOverride: isDevelopmentMode
        )
        try await processTransaction(
            transaction, schema: schema, readOnlyOverride: readOnlyAtPurchaseStart)
        await refreshPerson()
    }

    /// Reconciles every observed transaction and refreshes the person snapshot.
    public func restorePurchases(schema: RuntimeSchema) async throws {
        try await reconcileObservedTransactions(schema: schema)
        await refreshPerson()
    }

    /// Syncs pending and still-owned transactions the SDK has not processed yet.
    ///
    /// One-time consumables are skipped: they are finished by the purchase flow that bought them
    /// and must not be re-synced from the entitlement stream. A store read that fails fails the
    /// whole reconciliation — reporting "restored nothing" off an unreadable store would hide a
    /// customer's purchases.
    public func reconcileObservedTransactions(schema: RuntimeSchema) async throws {
        let pending = try engine.getPendingTransactions()
        let purchased = try await engine.getPurchasedItems(onlyIncludeActiveItems: true)

        var observedByKey: [String: VoidhashTransaction] = [:]
        var orderedKeys: [String] = []
        for storeTransaction in pending + purchased {
            let transaction = VoidhashTransaction(storeTransaction: storeTransaction)
            let key = PurchaseOrchestrator.processingKey(transaction)
            if observedByKey[key] == nil {
                orderedKeys.append(key)
            }
            observedByKey[key] = transaction
        }

        var failedTransactionIds: [String] = []
        for key in orderedKeys {
            guard let transaction = observedByKey[key] else {
                continue
            }
            let definition = PurchaseOrchestrator.resolveProductDefinition(
                transaction, products: schema.products)
            if definition?.type == "one-time-consumable" {
                continue
            }
            do {
                try await processTransaction(transaction, schema: schema)
            } catch {
                failedTransactionIds.append(transaction.transactionId)
            }
        }

        if !failedTransactionIds.isEmpty {
            throw ReconcileTransactionsError(transactionIds: failedTransactionIds)
        }
    }

    /// Processes a transaction reported by the store observer and refreshes the person snapshot.
    public func processObservedTransaction(
        _ transaction: VoidhashTransaction, schema: RuntimeSchema
    ) async throws {
        try await processTransaction(transaction, schema: schema)
        await refreshPerson()
    }

    /// Syncs one transaction to the backend and — unless the SDK is read-only — finishes it.
    ///
    /// - Parameter readOnlyOverride: Pins the ownership decision for a purchase this SDK started.
    ///   Every other caller omits it and reads the live flag when the decision is made.
    public func processTransaction(
        _ transaction: VoidhashTransaction,
        schema: RuntimeSchema,
        readOnlyOverride: Bool? = nil
    ) async throws {
        guard transaction.purchaseState == .purchased else {
            return
        }

        let key = PurchaseOrchestrator.processingKey(transaction)
        let processedCacheKey = PurchaseOrchestrator.processedCacheKey(key)

        if let existing = inFlightTransactions[key] {
            guard readOnlyOverride == false else {
                try await existing.task?.value
                return
            }

            existing.ownerClaimed = true
            try await existing.task?.value
            try await finalizeSkippedStoreFinalization(
                transaction, schema: schema, entry: existing, processedCacheKey: processedCacheKey)
            return
        }

        let entry = InFlightTransaction(ownerClaimed: readOnlyOverride == false)
        inFlightTransactions[key] = entry
        let task = Task { [entry] in
            try await self.runProcessing(
                transaction,
                schema: schema,
                entry: entry,
                readOnlyOverride: readOnlyOverride,
                processedCacheKey: processedCacheKey
            )
        }
        entry.task = task

        defer { inFlightTransactions[key] = nil }
        try await task.value
    }

    private func runProcessing(
        _ transaction: VoidhashTransaction,
        schema: RuntimeSchema,
        entry: InFlightTransaction,
        readOnlyOverride: Bool?,
        processedCacheKey: String
    ) async throws {
        let cachedState = await cacheManager.get(
            processedCacheKey, as: TransactionProcessingState.self)?.value

        if cachedState?.storeFinalized == true {
            return
        }

        if cachedState?.backendAccepted != true {
            var headers = await headersProvider()
            headers["x-distinct-id"] = await distinctIdProvider()

            if transaction.isDevelopment {
                guard let developmentApi else {
                    throw VoidhashStoreError(
                        code: "CONFIGURATION_MISSING",
                        message: "Development purchases need a development gateway client")
                }
                try await developmentApi.developmentPurchase(
                    headers: headers,
                    body: SdkDevelopmentPurchaseBody(
                        devTransactionId: transaction.transactionId,
                        productSlug: PurchaseOrchestrator.resolveProductSlug(
                            transaction, products: schema.products),
                        purchaseDate: transaction.purchaseDate,
                        quantity: transaction.quantity
                    ))
            } else {
                let response = try await api.syncTransaction(
                    headers: headers,
                    body: PurchaseOrchestrator.syncPayload(transaction, products: schema.products)
                )

                // Fail-safe: a backend that answers `accepted: false` did not record the
                // purchase, so the transaction stays unfinished (the store re-delivers it)
                // and nothing is cached.
                guard response.accepted else {
                    throw VoidhashStoreError.transactionVerificationRejected(
                        transactionId: transaction.transactionId)
                }
            }

            await cacheManager.set(
                processedCacheKey,
                value: TransactionProcessingState(
                    backendAccepted: true, storeFinalized: transaction.isAcknowledged),
                ttl: PurchaseOrchestrator.processedTransactionTtlMilliseconds
            )
        }

        if !entry.ownerClaimed && (readOnlyOverride ?? isReadOnly()) {
            entry.storeFinalizationPending = true
            return
        }

        try await finalizeWithStore(transaction, processedCacheKey: processedCacheKey)
    }

    /// Runs the store finish that an already-completed processing skipped because it read
    /// read-only mode. The pending flag is cleared in the same isolated step that claims it, so
    /// concurrent owner callers can never both finish the transaction.
    private func finalizeSkippedStoreFinalization(
        _ transaction: VoidhashTransaction,
        schema: RuntimeSchema,
        entry: InFlightTransaction,
        processedCacheKey: String
    ) async throws {
        guard entry.storeFinalizationPending else {
            return
        }
        entry.storeFinalizationPending = false
        try await finalizeWithStore(transaction, processedCacheKey: processedCacheKey)
    }

    private func finalizeWithStore(
        _ transaction: VoidhashTransaction, processedCacheKey: String
    ) async throws {
        if !transaction.isAcknowledged {
            try await engine.finishTransaction(transactionId: transaction.transactionId)
        }

        await cacheManager.set(
            processedCacheKey,
            value: TransactionProcessingState(backendAccepted: true, storeFinalized: true),
            ttl: PurchaseOrchestrator.processedTransactionTtlMilliseconds
        )
    }

    static func processingKey(_ transaction: VoidhashTransaction) -> String {
        return "ios:\(transaction.transactionId):\(formatNumber(transaction.purchaseDate))"
    }

    static func processedCacheKey(_ processingKey: String) -> String {
        return "processed-transaction:\(processingKey)"
    }

    /// Resolves the dashboard product definition a store transaction belongs to.
    static func resolveProductDefinition(
        _ transaction: VoidhashTransaction,
        products: [String: RuntimeProductDefinition]
    ) -> RuntimeProductDefinition? {
        return products.values.first { definition in
            if definition.slug == transaction.productId {
                return true
            }
            if definition.configuration.providers.appleAppStore?.productId
                == transaction.productId
            {
                return true
            }
            return definition.configuration.providers.development?.productId
                == transaction.productId
        }
    }

    static func resolveProductSlug(
        _ transaction: VoidhashTransaction,
        products: [String: RuntimeProductDefinition]
    ) -> String {
        return resolveProductDefinition(transaction, products: products)?.slug
            ?? transaction.productId
    }

    /// Builds the iOS `sync-transaction` payload, mirroring `transaction-service.ts`.
    static func syncPayload(
        _ transaction: VoidhashTransaction,
        products: [String: RuntimeProductDefinition]
    ) -> SdkSyncTransactionBody {
        return SdkSyncTransactionBody(
            appAccountToken: transaction.appAccountToken,
            platform: "ios",
            providerProductId: transaction.productId,
            productSlug: resolveProductSlug(transaction, products: products),
            purchaseDate: transaction.purchaseDate,
            purchaseToken: nil,
            quantity: transaction.quantity,
            receipt: transaction.receipt,
            transactionId: transaction.transactionId
        )
    }

    // The processing key is compared against the TypeScript SDK's, which formats whole numbers
    // without a fractional part.
    private static func formatNumber(_ value: Double) -> String {
        if value.rounded() == value && abs(value) < 1e15 {
            return String(Int64(value))
        }
        return String(value)
    }
}
