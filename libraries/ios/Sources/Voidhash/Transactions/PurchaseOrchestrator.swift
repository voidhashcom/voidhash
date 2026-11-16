import Foundation
import VoidhashCore

/// Backend sync surface used by ``PurchaseOrchestrator``; implemented by ``VoidhashApiClient``.
public protocol TransactionSyncing: Sendable {
    /// `POST /api/v1/sdk/sync-transaction`
    func syncTransaction(headers: [String: String], body: SdkSyncTransactionBody) async throws
        -> SdkSyncTransactionResponse
    /// Revalidates a transaction for the requesting identity after delivering any older capture.
    func restoreTransaction(headers: [String: String], body: SdkSyncTransactionBody) async throws
        -> SdkSyncTransactionResponse
    /// ``syncTransaction(headers:body:)`` for `receipt`, which an implementation that queues the
    /// receipt keeps with it, to record the backend's acceptance whenever it arrives.
    func syncTransaction(
        headers: [String: String], body: SdkSyncTransactionBody, receipt: ReceiptReference
    ) async throws -> SdkSyncTransactionResponse
    /// ``restoreTransaction(headers:body:)`` for `receipt`, as
    /// ``syncTransaction(headers:body:receipt:)``.
    func restoreTransaction(
        headers: [String: String], body: SdkSyncTransactionBody, receipt: ReceiptReference
    ) async throws -> SdkSyncTransactionResponse
    /// Keeps `body` for `receipt` for a later ``syncTransaction(headers:body:receipt:)`` to send,
    /// without sending it now.
    func captureTransaction(
        headers: [String: String], body: SdkSyncTransactionBody, receipt: ReceiptReference
    ) async
}

extension TransactionSyncing {
    /// Revalidates directly when the implementation has no delivery outbox.
    public func restoreTransaction(headers: [String: String], body: SdkSyncTransactionBody) async throws
        -> SdkSyncTransactionResponse
    {
        try await syncTransaction(headers: headers, body: body)
    }

    /// Sends without keeping `receipt` when the implementation has no delivery outbox.
    public func syncTransaction(
        headers: [String: String], body: SdkSyncTransactionBody, receipt: ReceiptReference
    ) async throws -> SdkSyncTransactionResponse {
        try await syncTransaction(headers: headers, body: body)
    }

    /// Restores without keeping `receipt` when the implementation has no delivery outbox.
    public func restoreTransaction(
        headers: [String: String], body: SdkSyncTransactionBody, receipt: ReceiptReference
    ) async throws -> SdkSyncTransactionResponse {
        try await restoreTransaction(headers: headers, body: body)
    }

    /// Keeps nothing when the implementation has no delivery outbox: the send delivers it.
    public func captureTransaction(
        headers: [String: String], body: SdkSyncTransactionBody, receipt: ReceiptReference
    ) async {}
}

extension VoidhashApiClient: TransactionSyncing {}

/// Development-gateway sync surface; implemented by ``VoidhashApiClient``.
public protocol DevelopmentPurchasing: Sendable {
    /// `POST /api/v1/sdk/development/purchase`
    func developmentPurchase(headers: [String: String], body: SdkDevelopmentPurchaseBody)
        async throws -> Bool
}

extension VoidhashApiClient: DevelopmentPurchasing {}

/// Obtains App Store promotional offer signatures, which only the backend can make.
public protocol PromotionalOfferSigning: Sendable {
    /// `POST /api/v1/sdk/promotional-offer-signature`
    func signPromotionalOffer(headers: [String: String], body: SdkPromotionalOfferSignatureBody)
        async throws -> SdkPromotionalOfferSignature
}

extension VoidhashApiClient: PromotionalOfferSigning {}

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
/// Ported from `src/core/transactions/transaction-service.ts`. The in-flight map coalesces
/// concurrent processing of the same transaction. The ``AcceptedReceiptLedger`` keeps a receipt
/// the backend accepted from being sent again by a recovery scan, a store observation or a host
/// report, across launches; renewals and revocations are new news and are sent. The
/// processed-transaction cache (`{backendAccepted, storeFinalized, externallyManaged}`, 30 minute
/// TTL) keeps the store-finalization bookkeeping.
///
/// A receipt is sent with the intent ``SdkSyncTransactionIntent/restore`` only from
/// ``restorePurchases(schema:distinctId:deliveryDeadline:)``, or for a transaction the host's own
/// restore returned (``reportTransaction(_:schema:restoreDistinctId:)``). Everything else is a
/// ``SdkSyncTransactionIntent/sync``, which the backend never answers by moving a purchase to
/// another person.
public actor PurchaseOrchestrator {
    /// Lifetime of a processed-transaction cache entry.
    public static let processedTransactionTtlMilliseconds: Double = 1000 * 60 * 30
    /// Lifetime of the identity a restored series was restored for, which its renewals are sent
    /// under; long enough for the outbox to deliver a restore through an outage.
    static let restoredIdentityTtlMilliseconds: Double = 1000 * 60 * 60 * 24 * 30

    struct TransactionProcessingState: Codable, Sendable, Equatable {
        let backendAccepted: Bool
        let storeFinalized: Bool
        let externallyManaged: Bool?

        init(
            backendAccepted: Bool,
            storeFinalized: Bool,
            externallyManaged: Bool? = nil
        ) {
            self.backendAccepted = backendAccepted
            self.storeFinalized = storeFinalized
            self.externallyManaged = externallyManaged
        }
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
        var hostClaimed = false
        var ownerClaimed: Bool
        var storeFinalizationPending = false
        var task: Task<ProcessingOutcome, any Error>?

        init(ownerClaimed: Bool) {
            self.ownerClaimed = ownerClaimed
        }
    }

    private let engine: any StoreKitEngineProtocol
    private let api: any TransactionSyncing
    private let developmentApi: (any DevelopmentPurchasing)?
    private let offerSigner: (any PromotionalOfferSigning)?
    /// When true purchases run against the mock store and are recorded through the
    /// development gateway instead of `sync-transaction`.
    private let isDevelopmentMode: Bool
    private let cacheManager: CacheManager
    private let headersProvider: @Sendable () async -> [String: String]
    private let distinctIdProvider: @Sendable () async -> String
    private let isReadOnly: @Sendable () -> Bool
    private let refreshPerson: @Sendable () async -> Void
    private let schedulePersonRefresh: @Sendable () async -> Void
    private let acceptedReceipts: AcceptedReceiptLedger
    private let diagnostics: DiagnosticEmitter

    private var inFlightTransactions: [String: InFlightTransaction] = [:]
    /// Purchases waiting on the store sheet. The store observer can report the transaction of
    /// one before the purchase call has it, so while any is open no transaction is taken for an
    /// older one of an accepted series.
    private var purchasesInStoreSheet = 0
    /// The transactions bought here this session, with the read-only flag pinned when each
    /// purchase started.
    private var purchasedHere: [String: Bool] = [:]
    private var restoreTask: (id: UUID, task: Task<Void, any Error>)?
    private var didReportLocalTesting = false

    /// - Parameters:
    ///   - engine: Store engine used to buy and finish transactions.
    ///   - api: Backend sync client.
    ///   - developmentApi: Development-gateway client; required in development mode.
    ///   - offerSigner: Signs promotional offers; without one, purchases of an offer fail.
    ///   - isDevelopmentMode: Routes purchases through the mock store and dev endpoint.
    ///   - cacheManager: Cache holding the processed-transaction states.
    ///   - headersProvider: Builds the common SDK headers for the current identity.
    ///   - distinctIdProvider: Returns the current distinct id.
    ///   - isReadOnly: Reads the live read-only (observer mode) flag.
    ///   - refreshPerson: Refreshes the cached person snapshot, awaited by the calls the host
    ///     waits on before it reads entitlements: a purchase, a restore, a sync.
    ///   - schedulePersonRefresh: Starts a refresh of the person snapshot without waiting for it,
    ///     after the backend accepted a transaction the store observer or the host reported;
    ///     `nil` awaits `refreshPerson` instead.
    ///   - acceptedReceipts: The receipts the backend accepted and the transactions the host
    ///     claimed; `nil` keeps them in memory.
    ///   - diagnostics: Receives `STOREKIT_TESTING_TRANSACTION_SKIPPED`.
    public init(
        engine: any StoreKitEngineProtocol,
        api: any TransactionSyncing,
        developmentApi: (any DevelopmentPurchasing)? = nil,
        offerSigner: (any PromotionalOfferSigning)? = nil,
        isDevelopmentMode: Bool = false,
        cacheManager: CacheManager,
        headersProvider: @escaping @Sendable () async -> [String: String],
        distinctIdProvider: @escaping @Sendable () async -> String,
        isReadOnly: @escaping @Sendable () -> Bool,
        refreshPerson: @escaping @Sendable () async -> Void,
        schedulePersonRefresh: (@Sendable () async -> Void)? = nil,
        acceptedReceipts: AcceptedReceiptLedger? = nil,
        diagnostics: DiagnosticEmitter = DiagnosticEmitter(nil)
    ) {
        self.engine = engine
        self.api = api
        self.developmentApi = developmentApi
        self.offerSigner = offerSigner
        self.isDevelopmentMode = isDevelopmentMode
        self.cacheManager = cacheManager
        self.headersProvider = headersProvider
        self.distinctIdProvider = distinctIdProvider
        self.isReadOnly = isReadOnly
        self.refreshPerson = refreshPerson
        self.schedulePersonRefresh = schedulePersonRefresh ?? refreshPerson
        self.acceptedReceipts =
            acceptedReceipts ?? AcceptedReceiptLedger(store: InMemoryRecordStore())
        self.diagnostics = diagnostics
    }

    /// How a purchase this SDK started ended.
    enum PurchaseOutcome: Sendable, Equatable {
        /// The store charged the user; `synced` says whether Voidhash accepted the receipt
        /// before the call returned.
        case purchased(StoreKitTransactionInfo, synced: Bool)
        case pending
        case cancelled
    }

    /// Buys `product`, syncs the resulting transaction and finishes it with the store.
    ///
    /// The read-only flag is pinned when the purchase starts: a purchase this SDK owns is still
    /// finished even if the host app flips to observer mode while the store sheet is open.
    ///
    /// A promotional offer is signed by the backend for this person and applied by StoreKit; a
    /// win-back offer is applied by StoreKit. Any failure to get or apply an offer fails the
    /// purchase; the product is never bought at its regular price instead. The development
    /// store simulates the purchase without the offer.
    ///
    /// With `paywallContext`, the receipt names the paywall the purchase was started from. A
    /// transaction the store observer is already reporting keeps that report, which has none.
    ///
    /// - Parameter deliveryDeadline: Returns once the caller has waited on Voidhash for the
    ///   receipt long enough, counted from when the store handed the transaction over. The call
    ///   then returns; the receipt stays queued, the transaction unfinished until Voidhash accepts
    ///   it, and the person is refreshed once it does. The person refresh after an accepted
    ///   receipt is bounded by the same deadline and finishes in the background past it.
    ///   Cancelling the caller ends the wait the same way. A failure after the call returned is
    ///   reported as `TRANSACTION_SYNC_DEFERRED`. `nil` waits for Voidhash's answer.
    /// - Parameter bought: Receives the id of the transaction the store handed over, before it
    ///   is processed.
    /// - Throws: What ``VoidhashPurchaseOptions/appStoreOffer(for:)`` throws for options the
    ///   product cannot be bought with, before any sheet shows.
    @discardableResult
    func purchase(
        product: VoidhashProduct, schema: RuntimeSchema,
        options: VoidhashPurchaseOptions = VoidhashPurchaseOptions(),
        paywallContext: SdkPurchasePaywallContext? = nil,
        deliveryDeadline: (@Sendable () async -> Void)? = nil,
        bought: @Sendable (String) -> Void = { _ in }
    ) async throws -> PurchaseOutcome {
        // The development store sells no offers: it simulates the purchase at the product's price.
        var effectiveOptions = options
        if isDevelopmentMode {
            effectiveOptions.offer = .automatic
        }
        let offer = try effectiveOptions.appStoreOffer(for: product)
        let readOnlyAtPurchaseStart = isReadOnly()
        let distinctId = await distinctIdProvider()
        let appAccountToken = AccountToken.derive(distinctId: distinctId)
        await cacheManager.set("transaction-identity:\(appAccountToken)", value: distinctId)
        let result: StoreKitPurchaseResult
        purchasesInStoreSheet += 1
        do {
            var request = StoreKitPurchaseRequest(
                appAccountToken: appAccountToken, quantity: options.quantity,
                simulatesAskToBuyInSandbox: options.appStore.simulatesAskToBuyInSandbox)
            #if canImport(UIKit)
                request.confirmIn = options.appStore.confirmIn
            #endif
            switch offer {
            case nil:
                break
            case .promotional(let offerId)?:
                request.offer = .promotional(
                    try await signedOffer(offerId, of: product, appAccountToken: appAccountToken))
            case .winBack(let offerId)?:
                request.offer = .winBack(offerId: offerId)
            }
            result = try await engine.buyProduct(sku: product.storeProductId, request: request)
        } catch {
            purchasesInStoreSheet -= 1
            throw error
        }
        // In one step with the sheet closing, so the transaction is known as bought here from
        // the moment the open sheet stops vouching for it.
        purchasesInStoreSheet -= 1
        let storeTransaction: StoreKitTransactionInfo
        switch result {
        case .purchased(let purchased):
            storeTransaction = purchased
        case .pending:
            return .pending
        case .cancelled:
            return .cancelled
        }
        purchasedHere[storeTransaction.transactionId] = readOnlyAtPurchaseStart
        bought(storeTransaction.transactionId)
        // Dev purchases have nothing to acknowledge — the backend records them directly.
        let transaction = ReceiptTransaction(
            storeTransaction: storeTransaction,
            isDevelopment: isDevelopmentMode,
            isAcknowledgedOverride: isDevelopmentMode
        )
        let processing = Task {
            try await self.process(
                transaction, schema: schema, readOnlyOverride: readOnlyAtPurchaseStart,
                distinctIdOverride: distinctId, paywallContext: paywallContext)
        }
        if let deliveryDeadline {
            let deadline = Task { await deliveryDeadline() }
            defer { deadline.cancel() }
            // A cancelled caller stops waiting at once, as one past the deadline does.
            let result = await withTaskCancellationHandler {
                await firstOutcome(of: processing, before: deadline)
            } onCancel: {
                deadline.cancel()
            }
            guard let result else {
                Task { [schedulePersonRefresh, diagnostics] in
                    do {
                        if try await processing.value != .pending {
                            await schedulePersonRefresh()
                        }
                    } catch {
                        diagnostics.emit(
                            .transport, code: "TRANSACTION_SYNC_DEFERRED", operation: "purchase",
                            retryable: true,
                            message:
                                "Processing transaction \(transaction.transactionId) failed after the purchase returned; it is retried: \(error)"
                        )
                    }
                }
                return .purchased(storeTransaction, synced: false)
            }
            guard try result.get() != .pending else {
                return .purchased(storeTransaction, synced: false)
            }
            // The person refresh shares the deadline, so the whole call stays within it. Past
            // it the refresh finishes in the background; the receipt's acceptance already made
            // the cached person read as stale, so a read meanwhile revalidates it.
            let refresh = Task<Void, any Error> { [refreshPerson] in await refreshPerson() }
            _ = await withTaskCancellationHandler {
                await firstOutcome(of: refresh, before: deadline)
            } onCancel: {
                deadline.cancel()
            }
            return .purchased(storeTransaction, synced: true)
        }
        guard try await processing.value != .pending else {
            return .purchased(storeTransaction, synced: false)
        }
        await refreshPerson()
        return .purchased(storeTransaction, synced: true)
    }

    /// The backend's signature of the promotional offer with the Studio id `offerId` of `product`, for
    /// `appAccountToken`, in the form ``promotionalOffer(_:jwsCheckedByStoreKit:)`` picks. A refusal, a signature that cannot be had
    /// (Voidhash is unreachable or answers with an error) and one that does not fit this
    /// purchase are `OFFER_UNAVAILABLE`.
    private func signedOffer(
        _ offerId: String, of product: VoidhashProduct, appAccountToken: String
    ) async throws -> StoreKitPromotionalOffer {
        guard let offerSigner else {
            throw VoidhashStoreError.offerUnavailable("This client cannot sign promotional offers")
        }
        let signed: SdkPromotionalOfferSignature
        do {
            signed = try await offerSigner.signPromotionalOffer(
                headers: await headersProvider(),
                body: SdkPromotionalOfferSignatureBody(
                    productId: product.storeProductId, offerId: offerId,
                    transactionId: await customerTransactionId(
                        of: product, appAccountToken: appAccountToken)))
        } catch let error as VoidhashApiError {
            throw VoidhashStoreError.offerUnavailable(
                error.tag == VoidhashApiError.promotionalOfferUnavailableTag
                    ? error.message
                    : "Voidhash could not sign the promotional offer: \(error.message)")
        }
        guard signed.appAccountToken.lowercased() == appAccountToken.lowercased() else {
            throw VoidhashStoreError.offerUnavailable(
                "The promotional offer signature does not match this purchase")
        }
        return try Self.promotionalOffer(signed)
    }

    /// A transaction id of the customer, which Apple recommends a promotional offer's JWS name:
    /// the app transaction's (iOS 16), else the latest transaction of the product's subscription
    /// group; `nil` when StoreKit has neither.
    private func customerTransactionId(of product: VoidhashProduct, appAccountToken: String) async
        -> String?
    {
        if let appTransactionId = try? await engine.appTransaction().appTransactionId,
            !appTransactionId.isEmpty
        {
            return appTransactionId
        }
        guard let groupId = product.appStore?.subscriptionGroupId,
            let status = try? await engine.subscriptionStatuses(
                groupId: groupId, appAccountToken: appAccountToken
            ).first
        else {
            return nil
        }
        return status.transaction.transactionId
    }

    /// Whether StoreKit itself checks a promotional offer's compact JWS on this OS.
    ///
    /// `Product.PurchaseOption.promotionalOffer(_:compactJWS:)` is back-deployed to iOS 15, but
    /// below iOS 26 it only forwards the JWS as the legacy ad hoc signature parameters, and the
    /// StoreKit there has no code to check a JWS: StoreKit Testing on iOS 18.5 sells the product at
    /// its regular price whatever the JWS says, even one signed with another key. The legacy
    /// signature, which Apple deprecated in iOS 26, is proven on those versions, so it is used there.
    /// An app built with an Xcode older than 26 (Swift 6.2) cannot apply a JWS at all.
    static var storeKitChecksOfferJWS: Bool {
        #if compiler(>=6.2)
            if #available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, visionOS 26.0, *) {
                return true
            }
        #endif
        return false
    }

    /// The offer StoreKit applies for `signed`: where StoreKit checks a JWS (iOS 26 and later) the
    /// backend's JWS, else its legacy signature; below iOS 26 the legacy signature, and the JWS only
    /// when the legacy one cannot be read. The backend always sends the legacy signature and adds
    /// the JWS when it can sign one, so neither OS buys an offer with a signature StoreKit ignores.
    static func promotionalOffer(
        _ signed: SdkPromotionalOfferSignature,
        jwsCheckedByStoreKit: Bool = storeKitChecksOfferJWS
    ) throws -> StoreKitPromotionalOffer {
        let jws = signed.signatureJws.flatMap { $0.isEmpty ? nil : $0 }
        if jwsCheckedByStoreKit, let jws {
            return StoreKitPromotionalOffer(
                offerIdentifier: signed.offerIdentifier, signature: .compactJWS(jws))
        }
        if let nonce = UUID(uuidString: signed.nonce),
            let signature = Data(base64Encoded: signed.signature), !signature.isEmpty,
            !signed.keyIdentifier.isEmpty,
            let timestamp = Int(exactly: signed.timestamp.rounded())
        {
            return StoreKitPromotionalOffer(
                offerIdentifier: signed.offerIdentifier,
                signature: .legacy(
                    keyIdentifier: signed.keyIdentifier, nonce: nonce, signature: signature,
                    timestamp: timestamp))
        }
        if let jws {
            return StoreKitPromotionalOffer(
                offerIdentifier: signed.offerIdentifier, signature: .compactJWS(jws))
        }
        throw VoidhashStoreError.offerUnavailable(
            "The promotional offer signature does not match this purchase")
    }

    /// Refreshes App Store history and revalidates it for the requesting identity, then refreshes
    /// the person. May prompt for authentication; deferred delivery fails the explicit restore.
    ///
    /// Besides a host-reported restore, the only path that sends receipts with the intent
    /// ``SdkSyncTransactionIntent/restore``, or receipts the backend accepted before. It sends one
    /// receipt per series, the latest: the backend resolves a series from any of its
    /// transactions, so a long-running subscription costs one request rather than one per renewal.
    ///
    /// - Parameter deliveryDeadline: Returns once the restore has waited on Voidhash long enough,
    ///   counted from when the store handed its history over, so a user's sign-in prompt is not
    ///   held against it. The receipts not accepted by then fail the restore and stay queued.
    ///   The first receipt that fails in transit fails the ones after it as well, rather than
    ///   sending each into the same outage. `nil` waits for Voidhash's answer to every receipt.
    public func restorePurchases(
        schema: RuntimeSchema, distinctId: String? = nil,
        deliveryDeadline: (@Sendable () async -> Void)? = nil
    ) async throws {
        let requestedDistinctId: String
        if let distinctId {
            requestedDistinctId = distinctId
        } else {
            requestedDistinctId = await distinctIdProvider()
        }
        let previous = restoreTask?.task
        let id = UUID()
        let task = Task {
            _ = try? await previous?.value
            try Task.checkCancellation()
            try await self.engine.syncStore()
            let transactions = try await self.observedTransactions(schema: schema, restoring: true)
            let deadline = deliveryDeadline.map { deadline in Task { await deadline() } }
            defer { deadline?.cancel() }
            try await self.deliver(
                transactions, schema: schema, restoreDistinctId: requestedDistinctId,
                deadline: deadline)
            await self.refreshPerson()
        }
        restoreTask = (id, task)
        defer { if restoreTask?.id == id { restoreTask = nil } }
        try await withTaskCancellationHandler {
            try await task.value
        } onCancel: {
            task.cancel()
        }
    }

    /// Silently reconciles current purchases, then refreshes the person; deferred delivery
    /// remains queued.
    ///
    /// Every receipt the scan finds is written to the outbox before the first is sent.
    ///
    /// - Parameter deliveryDeadline: Returns once the caller has waited on Voidhash long enough.
    ///   Delivery then carries on in the background, and the person is refreshed once it is
    ///   done. `nil` waits for Voidhash's answer to every receipt.
    public func syncPurchases(
        schema: RuntimeSchema, deliveryDeadline: (@Sendable () async -> Void)? = nil
    ) async throws {
        let transactions = try await observedTransactions(schema: schema, restoring: false)
        for transaction in transactions {
            await capture(transaction, schema: schema)
        }
        guard let deliveryDeadline else {
            try await deliver(transactions, schema: schema, restoreDistinctId: nil)
            await refreshPerson()
            return
        }
        let delivery = Task {
            try await self.deliver(transactions, schema: schema, restoreDistinctId: nil)
        }
        let deadline = Task { await deliveryDeadline() }
        defer { deadline.cancel() }
        guard let outcome = await firstOutcome(of: delivery, before: deadline) else {
            Task { [schedulePersonRefresh] in
                _ = try? await delivery.value
                await schedulePersonRefresh()
            }
            return
        }
        try outcome.get()
        await refreshPerson()
    }

    /// Syncs pending and still-owned transactions the backend has not accepted yet.
    ///
    /// One-time consumables are captured without finalization in observer mode and skipped in
    /// owner mode, where the purchase flow is responsible for granting and finishing them. A store read that fails fails the
    /// whole reconciliation — reporting "restored nothing" off an unreadable store would hide a
    /// customer's purchases. Transactions from a local StoreKit configuration are skipped: the
    /// App Store cannot verify them.
    ///
    /// A scan writes every receipt it finds to the outbox before it sends the first, so a backend
    /// that stalls on one leaves the others captured. A restore sends the latest receipt of each
    /// series only.
    public func reconcileObservedTransactions(
        schema: RuntimeSchema, restoreDistinctId: String? = nil
    ) async throws {
        let transactions = try await observedTransactions(
            schema: schema, restoring: restoreDistinctId != nil)
        if restoreDistinctId == nil {
            for transaction in transactions {
                await capture(transaction, schema: schema)
            }
        }
        try await deliver(transactions, schema: schema, restoreDistinctId: restoreDistinctId)
    }

    /// The transactions a scan sends: pending and currently owned ones, or for a restore the
    /// latest of each series in the store's history, less the ones never sent (not purchased yet,
    /// from a local StoreKit configuration, or consumables the scan must leave alone).
    private func observedTransactions(
        schema: RuntimeSchema, restoring: Bool
    ) async throws -> [ReceiptTransaction] {
        let pending = restoring ? [] : try engine.getPendingTransactions()
        let purchased = try await engine.getPurchasedItems(onlyIncludeActiveItems: !restoring)

        var observedByKey: [String: ReceiptTransaction] = [:]
        var orderedKeys: [String] = []
        for storeTransaction in pending + purchased {
            let transaction = ReceiptTransaction(storeTransaction: storeTransaction)
            let key =
                restoring
                ? "series:\(transaction.originalTransactionId ?? transaction.transactionId)"
                : PurchaseOrchestrator.processingKey(transaction)
            if let kept = observedByKey[key] {
                if restoring && transaction.purchaseDate < kept.purchaseDate {
                    continue
                }
            } else {
                orderedKeys.append(key)
            }
            observedByKey[key] = transaction
        }

        return orderedKeys.compactMap { key -> ReceiptTransaction? in
            guard let transaction = observedByKey[key], transaction.purchaseState == .purchased,
                !skipsLocalTesting(transaction)
            else {
                return nil
            }
            let isConsumable = PurchaseOrchestrator.isConsumable(transaction, schema: schema)
            if isConsumable && (restoring || !isReadOnly()) {
                return nil
            }
            return transaction
        }
    }

    /// Sends `transactions` one at a time, throwing ``ReconcileTransactionsError`` for those that
    /// failed, and for a restore those the backend did not accept.
    ///
    /// A restore stops at the first receipt that stalls, failing in transit or outlasting
    /// `deadline`, and fails every receipt after it without sending it. The stalled delivery
    /// carries on in the background, and the receipts after it are queued as restores, which the
    /// outbox sends once Voidhash can be reached.
    private func deliver(
        _ transactions: [ReceiptTransaction], schema: RuntimeSchema, restoreDistinctId: String?,
        deadline: Task<Void, Never>? = nil
    ) async throws {
        let restoring = restoreDistinctId != nil
        var failedTransactionIds: [String] = []
        var stalled = false
        for transaction in transactions {
            guard !stalled else {
                if let restoreDistinctId {
                    await queueRestore(transaction, schema: schema, distinctId: restoreDistinctId)
                }
                failedTransactionIds.append(transaction.transactionId)
                continue
            }
            let isConsumable = PurchaseOrchestrator.isConsumable(transaction, schema: schema)
            let submit: @Sendable () async throws -> Bool = {
                try await self.processTransaction(
                    transaction, schema: schema, readOnlyOverride: isConsumable ? true : nil,
                    distinctIdOverride: restoreDistinctId, restoring: restoring)
            }
            let outcome: Result<Bool, any Error>?
            if let deadline {
                outcome = await firstOutcome(of: Task { try await submit() }, before: deadline)
            } else {
                do {
                    outcome = .success(try await submit())
                } catch {
                    outcome = .failure(error)
                }
            }
            switch outcome {
            case nil:
                stalled = true
                failedTransactionIds.append(transaction.transactionId)
            case .success(let accepted)?:
                if restoring && !accepted {
                    failedTransactionIds.append(transaction.transactionId)
                }
            case .failure(let error)? where error is CancellationError:
                throw CancellationError()
            case .failure(let error)?:
                if restoring, (error as? VoidhashApiError)?.isRetryable == true {
                    stalled = true
                }
                failedTransactionIds.append(transaction.transactionId)
            }
            if restoring {
                try Task.checkCancellation()
            }
        }

        if !failedTransactionIds.isEmpty {
            throw ReconcileTransactionsError(transactionIds: failedTransactionIds)
        }
    }

    /// Writes `transaction`'s receipt to the outbox without sending it, unless the backend
    /// accepted it before.
    private func capture(_ transaction: ReceiptTransaction, schema: RuntimeSchema) async {
        let key = PurchaseOrchestrator.processingKey(transaction)
        guard !transaction.isDevelopment, inFlightTransactions[key] == nil,
            !(await wasAccepted(
                transaction,
                marker: await processingState(
                    transaction, processedCacheKey: Self.processedCacheKey(key))))
        else {
            return
        }
        var headers = await headersProvider()
        headers["x-distinct-id"] = await reportingIdentity(for: transaction, override: nil)
        await api.captureTransaction(
            headers: headers,
            body: PurchaseOrchestrator.syncPayload(
                transaction, products: schema.products, intent: .sync),
            receipt: transaction.receiptReference)
    }

    /// Writes `transaction`'s receipt to the outbox as an explicit restore for `distinctId`,
    /// without sending it, and remembers the identity its series is restored for, as sending the
    /// restore would.
    private func queueRestore(
        _ transaction: ReceiptTransaction, schema: RuntimeSchema, distinctId: String
    ) async {
        guard !transaction.isDevelopment else {
            return
        }
        await cacheManager.set(
            Self.restoredIdentityCacheKey(transaction), value: distinctId,
            ttl: Self.restoredIdentityTtlMilliseconds)
        var headers = await headersProvider()
        headers["x-distinct-id"] = distinctId
        await api.captureTransaction(
            headers: headers,
            body: PurchaseOrchestrator.syncPayload(
                transaction, products: schema.products, intent: .restore),
            receipt: transaction.receiptReference)
    }

    /// Reports a host-owned transaction without connecting to or finishing in the store, and
    /// refreshes the person snapshot when the backend accepted it just now.
    ///
    /// The report is the host's claim on the transaction, kept durably: nothing here finishes it
    /// afterwards, on this launch or a later one.
    ///
    /// - Parameter restoreDistinctId: Sends the receipt as an explicit restore for this identity,
    ///   for a transaction the host's own restore flow returned.
    func reportTransaction(
        _ transaction: ReceiptTransaction, schema: RuntimeSchema, restoreDistinctId: String? = nil
    ) async throws {
        await acceptedReceipts.claimForHost(transaction.transactionId)
        let outcome = try await process(
            transaction, schema: schema, readOnlyOverride: true,
            distinctIdOverride: restoreDistinctId, restoring: restoreDistinctId != nil)
        if outcome == .accepted {
            await schedulePersonRefresh()
        }
    }

    /// Preserves host ownership when reporting joins an observed transaction already in flight.
    func retainHostOwnership(_ transaction: ReceiptTransaction) {
        inFlightTransactions[PurchaseOrchestrator.processingKey(transaction)]?.hostClaimed = true
    }

    /// Processes a transaction reported by the store observer, and refreshes the person snapshot
    /// when the backend accepted it just now.
    ///
    /// - Returns: `true` once the backend has accepted the receipt, now or before; `false` leaves
    ///   it queued.
    @discardableResult
    func processObservedTransaction(
        _ transaction: ReceiptTransaction, schema: RuntimeSchema
    ) async throws -> Bool {
        let outcome = try await process(transaction, schema: schema)
        if outcome == .accepted {
            await schedulePersonRefresh()
        }
        return outcome != .pending
    }

    /// Finishes the store transactions whose receipts the outbox delivered on a retry, after the
    /// call that handed them over had returned: a purchase made while Voidhash could not be
    /// reached ends deferred, and the drain that delivers its receipt later is the first to know
    /// the backend has it. Without this a subscription waited for the next scan and a consumable,
    /// which scans leave alone, for the next launch.
    ///
    /// Each pending store transaction among `transactionIds` is processed as the store
    /// observer's report of it is, except that its receipt counts as accepted because the drain
    /// says so, whatever the ledger makes of it: nothing is sent again. Observer mode and a
    /// host's claim leave it unfinished. A purchase started here in owner mode is finished even
    /// if the host has turned to observer mode since; any other transaction follows the mode as
    /// it is now.
    func finishDelivered(_ transactionIds: Set<String>, schema: RuntimeSchema) async {
        guard let pending = try? engine.getPendingTransactions() else {
            return
        }
        for storeTransaction in pending
        where transactionIds.contains(storeTransaction.transactionId) {
            let transaction = ReceiptTransaction(storeTransaction: storeTransaction)
            do {
                _ = try await process(
                    transaction, schema: schema,
                    readOnlyOverride: purchasedHere[transaction.transactionId] == false
                        ? false : nil,
                    delivered: true)
            } catch {
                diagnostics.emit(
                    .transport, code: "TRANSACTION_SYNC_DEFERRED",
                    operation: "transactions.finish", retryable: true,
                    message:
                        "Processing transaction \(transaction.transactionId) failed after its receipt was delivered; it is retried: \(error)"
                )
            }
        }
    }

    /// Whether `transaction` comes from a local StoreKit configuration, which the App Store cannot
    /// verify, so it is never sent; the first one this session is reported.
    func skipsLocalTesting(_ transaction: ReceiptTransaction) -> Bool {
        guard transaction.environment == .xcode else {
            return false
        }
        if !didReportLocalTesting {
            didReportLocalTesting = true
            diagnostics.emit(
                .transport, code: "STOREKIT_TESTING_TRANSACTION_SKIPPED",
                operation: "transactions.sync",
                message:
                    "Transaction \(transaction.transactionId) comes from a local StoreKit configuration in Xcode, which the App Store cannot verify, so it is not sent to Voidhash. Test purchases in the sandbox instead."
            )
        }
        return true
    }

    /// Syncs one transaction to the backend and — unless the SDK is read-only — finishes it.
    ///
    /// - Parameter readOnlyOverride: Pins the ownership decision for a purchase this SDK started.
    ///   Every other caller omits it and reads the live flag when the decision is made.
    /// - Parameter distinctIdOverride: Identity that started a purchase. Observations use the
    ///   stored account-token identity, or the identity at observation when no mapping exists.
    /// - Parameter restoring: Sends the receipt as an explicit restore, even one the backend
    ///   accepted before.
    /// - Returns: `true` once the backend has accepted the receipt, now or before. `false` leaves
    ///   the receipt queued and the store transaction unfinished.
    @discardableResult
    func processTransaction(
        _ transaction: ReceiptTransaction,
        schema: RuntimeSchema,
        readOnlyOverride: Bool? = nil,
        distinctIdOverride: String? = nil,
        restoring: Bool = false
    ) async throws -> Bool {
        return try await process(
            transaction, schema: schema, readOnlyOverride: readOnlyOverride,
            distinctIdOverride: distinctIdOverride, restoring: restoring) != .pending
    }

    /// What processing a transaction established about its receipt.
    enum ProcessingOutcome: Sendable {
        /// The backend has not accepted the receipt; it stays queued.
        case pending
        /// The backend had accepted the receipt before, so nothing was sent.
        case alreadyAccepted
        /// The backend accepted the receipt just now.
        case accepted
    }

    /// ``processTransaction(_:schema:readOnlyOverride:distinctIdOverride:restoring:)``, telling
    /// whether the backend learned something from it.
    ///
    /// - Parameter delivered: The outbox just delivered the receipt, so the backend has it and
    ///   nothing is sent.
    private func process(
        _ transaction: ReceiptTransaction,
        schema: RuntimeSchema,
        readOnlyOverride: Bool? = nil,
        distinctIdOverride: String? = nil,
        restoring: Bool = false,
        paywallContext: SdkPurchasePaywallContext? = nil,
        delivered: Bool = false
    ) async throws -> ProcessingOutcome {
        guard transaction.purchaseState == .purchased, !skipsLocalTesting(transaction) else {
            return .pending
        }

        let capturedDistinctId = await reportingIdentity(
            for: transaction, override: distinctIdOverride)
        let key = PurchaseOrchestrator.processingKey(transaction)
        let processedCacheKey = PurchaseOrchestrator.processedCacheKey(key)

        if let existing = inFlightTransactions[key] {
            if restoring {
                // A restore needs its own submission after the shared scan releases the receipt.
                _ = try await existing.task?.value
                await Task.yield()
                return try await process(
                    transaction, schema: schema, readOnlyOverride: readOnlyOverride,
                    distinctIdOverride: capturedDistinctId, restoring: true)
            }
            if readOnlyOverride == true { existing.hostClaimed = true }
            if readOnlyOverride == false { existing.ownerClaimed = true }
            let outcome = try await existing.task?.value ?? .pending
            if delivered, outcome == .pending {
                // The run it joined sent the receipt before another drain delivered it, and
                // ended without knowing. This one knows, and runs once that one is out of the way.
                await Task.yield()
                return try await process(
                    transaction, schema: schema, readOnlyOverride: readOnlyOverride,
                    distinctIdOverride: capturedDistinctId, delivered: true)
            }
            if readOnlyOverride == false, outcome != .pending {
                try await finalizeSkippedStoreFinalization(
                    transaction, schema: schema, entry: existing,
                    processedCacheKey: processedCacheKey)
            }
            return outcome
        }

        let entry = InFlightTransaction(ownerClaimed: readOnlyOverride == false)
        entry.hostClaimed = readOnlyOverride == true
        inFlightTransactions[key] = entry
        let task = Task { [entry] in
            try await self.runProcessing(
                transaction,
                schema: schema,
                entry: entry,
                readOnlyOverride: readOnlyOverride,
                processedCacheKey: processedCacheKey,
                distinctId: capturedDistinctId,
                restoring: restoring,
                paywallContext: paywallContext,
                delivered: delivered
            )
        }
        entry.task = task

        defer { inFlightTransactions[key] = nil }
        return try await task.value
    }

    private func runProcessing(
        _ transaction: ReceiptTransaction,
        schema: RuntimeSchema,
        entry: InFlightTransaction,
        readOnlyOverride: Bool?,
        processedCacheKey: String,
        distinctId: String,
        restoring: Bool,
        paywallContext: SdkPurchasePaywallContext?,
        delivered: Bool
    ) async throws -> ProcessingOutcome {
        let cachedState = await processingState(transaction, processedCacheKey: processedCacheKey)
        entry.hostClaimed = entry.hostClaimed || cachedState?.externallyManaged == true

        // An explicit restore always asks the backend.
        let receipt = transaction.receiptReference
        // A purchase made here, or one that may turn out to be, is not taken for an older
        // transaction of its series. Read in one step with the check: a sheet still open and
        // the purchase it produced being known leave no gap between them.
        let mayBeNewPurchase =
            purchasesInStoreSheet > 0 || purchasedHere[transaction.transactionId] != nil
        let alreadyAccepted: Bool
        if restoring {
            alreadyAccepted = false
        } else if delivered {
            alreadyAccepted = true
        } else {
            alreadyAccepted = await wasAccepted(
                transaction, marker: cachedState, olderOfSeries: !mayBeNewPurchase)
        }

        if alreadyAccepted && cachedState?.storeFinalized == true {
            return .alreadyAccepted
        }

        var outcome = ProcessingOutcome.alreadyAccepted
        if !alreadyAccepted {
            if restoring {
                await cacheManager.set(
                    processedCacheKey,
                    value: TransactionProcessingState(
                        backendAccepted: false, storeFinalized: cachedState?.storeFinalized ?? false,
                        externallyManaged: cachedState?.externallyManaged),
                    ttl: Self.processedTransactionTtlMilliseconds)
                await cacheManager.set(
                    Self.restoredIdentityCacheKey(transaction), value: distinctId,
                    ttl: Self.restoredIdentityTtlMilliseconds)
            }
            var headers = await headersProvider()
            headers["x-distinct-id"] = distinctId

            if transaction.isDevelopment {
                guard let developmentApi else {
                    throw VoidhashStoreError(
                        code: "CONFIGURATION_MISSING",
                        message: "Development purchases need a development gateway client")
                }
                do {
                    let accepted = try await developmentApi.developmentPurchase(
                        headers: headers,
                        body: SdkDevelopmentPurchaseBody(
                            devTransactionId: transaction.transactionId,
                            productSlug: PurchaseOrchestrator.resolveProductSlug(
                                transaction, products: schema.products),
                            purchaseDate: transaction.purchaseDate,
                            quantity: transaction.quantity
                        ))
                    guard accepted else {
                        return .pending
                    }
                } catch is VoidhashApiError {
                    return .pending
                }
            } else {
                let response: SdkSyncTransactionResponse
                do {
                    // A restore is not a sale, so it never names a paywall.
                    let body = PurchaseOrchestrator.syncPayload(
                        transaction, products: schema.products,
                        intent: restoring ? .restore : .sync,
                        paywallContext: restoring ? nil : paywallContext)
                    response = restoring
                        ? try await api.restoreTransaction(
                            headers: headers, body: body, receipt: receipt)
                        : try await api.syncTransaction(
                            headers: headers, body: body, receipt: receipt)
                } catch let error as VoidhashApiError {
                    // The user waits on a restore: a delivery that failed in transit is reported,
                    // so the receipts after it are not sent into the same outage one by one.
                    if restoring, error.isRetryable {
                        throw error
                    }
                    return .pending
                }

                guard response.accepted else {
                    return .pending
                }
            }

            await acceptedReceipts.recordAcceptance(receipt)
            await cacheManager.set(
                processedCacheKey,
                value: TransactionProcessingState(
                    backendAccepted: true,
                    storeFinalized: cachedState?.storeFinalized == true || transaction.isAcknowledged,
                    externallyManaged: entry.hostClaimed
                ),
                ttl: PurchaseOrchestrator.processedTransactionTtlMilliseconds
            )
            outcome = .accepted
        }

        if cachedState?.storeFinalized == true { return outcome }

        if !entry.ownerClaimed && (entry.hostClaimed || (readOnlyOverride ?? isReadOnly())) {
            entry.storeFinalizationPending = true
            return outcome
        }

        try await finalizeWithStore(transaction, processedCacheKey: processedCacheKey)
        return outcome
    }

    /// The identity a transaction is reported under: `override` when given (the identity that
    /// started a purchase or asked for a restore), otherwise the one its series was restored for,
    /// the one its account token was issued to, or the current identity.
    private func reportingIdentity(
        for transaction: ReceiptTransaction, override: String?
    ) async -> String {
        if let override {
            return override
        }
        if let restored = await cacheManager.get(
            Self.restoredIdentityCacheKey(transaction), as: String.self), !restored.isExpired
        {
            return restored.value
        }
        if let token = transaction.appAccountToken,
            let cached = await cacheManager.get(
                "transaction-identity:\(token.lowercased())", as: String.self)
        {
            return cached.value
        }
        return await distinctIdProvider()
    }

    /// The processed-transaction marker of `transaction`, falling back to the key older versions
    /// wrote.
    ///
    /// An expired marker is a miss, and is deleted once read: the cache serves expired entries
    /// for offline reads, but a processed-transaction record past its lifetime means nothing and
    /// would otherwise stay in the host's defaults for good.
    private func processingState(
        _ transaction: ReceiptTransaction, processedCacheKey: String
    ) async -> TransactionProcessingState? {
        let legacyKey = Self.processedCacheKey(
            "ios:\(transaction.transactionId):\(Self.formatNumber(transaction.purchaseDate))")
        for key in [processedCacheKey, legacyKey] {
            guard let hit = await cacheManager.get(key, as: TransactionProcessingState.self) else {
                continue
            }
            guard !hit.isExpired else {
                await cacheManager.delete(key)
                continue
            }
            return hit.value
        }
        return nil
    }

    /// Whether the backend accepted `transaction`'s receipt before, so that nothing but an
    /// explicit restore sends it again. A revocation counts only once the backend accepted it.
    ///
    /// - Parameter olderOfSeries: Whether a later accepted transaction of the same series covers
    ///   it, see ``AcceptedReceiptLedger/covers(_:olderOfSeries:)``.
    private func wasAccepted(
        _ transaction: ReceiptTransaction, marker: TransactionProcessingState?,
        olderOfSeries: Bool = true
    ) async -> Bool {
        if marker?.backendAccepted == true && transaction.revocationDate == nil {
            return true
        }
        return await acceptedReceipts.covers(
            transaction.receiptReference, olderOfSeries: olderOfSeries)
    }

    /// Runs the store finish that an already-completed processing skipped because it read
    /// read-only mode. The pending flag is cleared in the same isolated step that claims it, so
    /// concurrent owner callers can never both finish the transaction.
    private func finalizeSkippedStoreFinalization(
        _ transaction: ReceiptTransaction,
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

    /// Finishes `transaction` with the store. Every path that finishes one ends here: a
    /// purchase, an observation, a scan, a delivered receipt, a purchase taken over.
    ///
    /// A transaction the host reported as its own is left alone on all of them, in whatever
    /// mode the SDK runs and however long ago the report was: the host finishes it, and one the
    /// SDK finished would be gone from the unfinished transactions the host's own code delivers
    /// purchases from.
    private func finalizeWithStore(
        _ transaction: ReceiptTransaction, processedCacheKey: String
    ) async throws {
        guard !(await acceptedReceipts.isHostClaimed(transaction.transactionId)) else {
            return
        }
        if !transaction.isAcknowledged {
            try await engine.finishTransaction(transactionId: transaction.transactionId)
        }

        await cacheManager.set(
            processedCacheKey,
            value: TransactionProcessingState(backendAccepted: true, storeFinalized: true),
            ttl: PurchaseOrchestrator.processedTransactionTtlMilliseconds
        )
        purchasedHere[transaction.transactionId] = nil
    }

    /// Prefix of the entries holding the identity a series was restored for.
    static let restoredIdentityCacheKeyPrefix = "restored-transaction-identity:"

    private static func restoredIdentityCacheKey(_ transaction: ReceiptTransaction) -> String {
        let series = transaction.originalTransactionId ?? transaction.transactionId
        return "\(restoredIdentityCacheKeyPrefix)ios:\(series)"
    }

    static func processingKey(_ transaction: ReceiptTransaction) -> String {
        return transaction.isDevelopment
            ? "ios:\(transaction.transactionId):\(formatNumber(transaction.purchaseDate))"
            : "ios:\(transaction.transactionId)"
    }

    static func processedCacheKey(_ processingKey: String) -> String {
        return "processed-transaction:\(processingKey)"
    }

    /// Whether `transaction` buys a one-time consumable, which scans leave to the purchase flow.
    static func isConsumable(_ transaction: ReceiptTransaction, schema: RuntimeSchema) -> Bool {
        return resolveProductDefinition(transaction, products: schema.products)?.type
            == "one-time-consumable"
    }

    /// Resolves the dashboard product definition a store transaction belongs to.
    static func resolveProductDefinition(
        _ transaction: ReceiptTransaction,
        products: [String: RuntimeProductDefinition]
    ) -> RuntimeProductDefinition? {
        return resolveProductDefinition(storeProductId: transaction.productId, products: products)
    }

    /// Resolves the dashboard product definition sold as `storeProductId`. When several products
    /// answer to it, the one whose slug sorts first does, as in the development store's
    /// catalogue.
    static func resolveProductDefinition(
        storeProductId: String, products: [String: RuntimeProductDefinition]
    ) -> RuntimeProductDefinition? {
        return products.values.filter { definition in
            if definition.slug == storeProductId {
                return true
            }
            if definition.configuration.providers.appleAppStore?.productId == storeProductId {
                return true
            }
            return definition.configuration.providers.development?.productId == storeProductId
        }.min { $0.slug < $1.slug }
    }

    static func resolveProductSlug(
        _ transaction: ReceiptTransaction,
        products: [String: RuntimeProductDefinition]
    ) -> String {
        return resolveProductDefinition(transaction, products: products)?.slug
            ?? transaction.productId
    }

    /// Builds the iOS `sync-transaction` payload, mirroring `transaction-service.ts`.
    ///
    /// - Parameter intent: `nil` leaves it to the outbox, which sends the intent of the record the
    ///   payload is queued in.
    static func syncPayload(
        _ transaction: ReceiptTransaction,
        products: [String: RuntimeProductDefinition],
        intent: SdkSyncTransactionIntent? = nil,
        paywallContext: SdkPurchasePaywallContext? = nil
    ) -> SdkSyncTransactionBody {
        return SdkSyncTransactionBody(
            platform: "ios", transactionId: transaction.transactionId, intent: intent,
            paywallContext: paywallContext)
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
