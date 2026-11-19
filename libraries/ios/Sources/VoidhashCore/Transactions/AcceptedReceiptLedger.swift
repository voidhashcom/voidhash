import Foundation

/// What the device knows about a store receipt beyond its sync body: enough to tell whether the
/// backend has already accepted it.
public struct ReceiptReference: Codable, Sendable, Equatable {
    /// Store transaction id.
    public let transactionId: String
    /// Original transaction id of the series the transaction belongs to, which every renewal of a
    /// subscription shares; `nil` when unknown.
    public let originalTransactionId: String?
    /// Purchase date in milliseconds since the epoch; `nil` when unknown.
    public let purchaseDate: Double?
    /// Whether the store reported the transaction revoked: refunded, or removed from Family
    /// Sharing.
    public let isRevoked: Bool
    /// The store's product identifier; `nil` when unknown, as for a receipt reported by its
    /// transaction id alone.
    public let productId: String?

    /// - Parameters:
    ///   - purchaseDate: A date that is not a positive finite number counts as unknown.
    ///   - productId: An empty identifier counts as unknown.
    public init(
        transactionId: String,
        originalTransactionId: String? = nil,
        purchaseDate: Double? = nil,
        isRevoked: Bool = false,
        productId: String? = nil
    ) {
        self.transactionId = transactionId
        self.originalTransactionId = originalTransactionId
        self.purchaseDate = purchaseDate.flatMap { $0.isFinite && $0 > 0 ? $0 : nil }
        self.isRevoked = isRevoked
        self.productId = productId.flatMap { $0.isEmpty ? nil : $0 }
    }

    /// The series the receipt belongs to: its original transaction, or itself when that is
    /// unknown.
    var seriesId: String {
        return originalTransactionId ?? transactionId
    }
}

/// Durable record of the store receipts the backend has accepted, so recovery scans, store
/// observations and host reports do not send them again, and of the transactions the host
/// reported as its own to finish.
///
/// It keeps one entry per series (the original transaction id, or the transaction id when that
/// is unknown): the latest transaction of the series the backend accepted, the latest accepted
/// date of each of its products, and the revocations it accepted. A receipt is covered when it
/// is a transaction the backend accepted itself, or an older one of the same series and product,
/// since the backend resolves the whole series from any of its transactions. A renewal is newer
/// and is not covered, and neither is a revocation the backend has not accepted yet.
///
/// An upgrade or crossgrade shares its series with the subscription it replaces, under another
/// product, and can be dated before a renewal of that subscription the backend already accepted.
/// So a date covers a transaction only against an accepted transaction of its own product: both
/// products have to be known and equal. An entry written before products were recorded names
/// none and covers nothing by date. A transaction of its series is then sent once more, which
/// costs one request the backend answers the same way, and on acceptance the entry learns that
/// product's date, so it is not sent again; an upgrade that never reached the backend would be
/// a wrong entitlement.
///
/// A receipt without a date, reported by its id alone, never becomes the latest of a series
/// that has a dated one: the entry remembers its id next to the latest instead.
///
/// The ledger lives in its own record store rather than `UserDefaults` and holds at most
/// ``capacity`` series. The series accepted longest ago is forgotten first, which costs at most
/// one redundant sync of it. An explicit restore does not consult the ledger.
///
/// The host's claims are kept in the same store: the ids of the transactions the host reported,
/// which the SDK then never finishes with the store, whatever mode it is in and however long
/// ago the report was. The latest ``hostClaimCapacity`` are remembered.
///
/// So are the transactions this device sent as a purchase, which gives a purchase to the person
/// it is sent for: each goes out as one once, so a purchase reported again after another person
/// signed in stays with the first. The latest ``purchaseClaimCapacity`` are remembered.
public actor AcceptedReceiptLedger {
    /// Most series the ledger remembers.
    public static let capacity = 500
    /// Most revocations remembered per series.
    static let revocationsPerSeries = 20
    /// Most other accepted transactions remembered per series.
    static let othersPerSeries = 20
    /// Most transactions the host claimed that are remembered; the one claimed longest ago is
    /// forgotten first.
    public static let hostClaimCapacity = 500
    /// Most transactions sent as a purchase that are remembered; the one claimed longest ago is
    /// forgotten first. The backend counts a purchase claim for a day only.
    public static let purchaseClaimCapacity = 500

    /// The line of the store that holds the host's claims, next to the entries.
    private struct HostClaims: Codable {
        let hostClaimedTransactionIds: [String]
    }

    /// The line of the store that holds the transactions sent as a purchase.
    private struct PurchaseClaims: Codable {
        let purchaseClaimedTransactionIds: [String]
    }

    private struct Entry: Codable, Equatable {
        let seriesId: String
        /// Latest transaction of the series the backend accepted.
        var transactionId: String
        /// Purchase date of ``transactionId``, when known.
        var purchaseDate: Double?
        /// Product of ``transactionId``, when known.
        var productId: String?
        /// Latest purchase date the backend accepted of each product of the series. Absent from
        /// entries written before it was kept, where ``productId`` and ``purchaseDate`` stand
        /// for the one product known.
        var acceptedDates: [String: Double]?
        /// Transactions of the series the backend accepted besides ``transactionId``, by id: the
        /// latest of each other product, and those no date stands for because they name no
        /// product or carry no date.
        var otherTransactionIds: [String]?
        /// Revoked transactions of the series whose revocation the backend accepted.
        var revokedTransactionIds: [String]
        /// When the backend last accepted a receipt of the series.
        var acceptedAt: Double

        mutating func rememberOther(_ transactionId: String) {
            otherTransactionIds = Array(
                ((otherTransactionIds ?? []).filter { $0 != transactionId } + [transactionId])
                    .suffix(AcceptedReceiptLedger.othersPerSeries))
        }

        /// Whether what the backend accepted stands for a transaction of `productId` dated
        /// `purchaseDate`: it accepted one of that product dated no earlier. Never for a
        /// transaction whose product or date is unknown, nor for a product the entry has no
        /// accepted date of.
        func standsFor(purchaseDate: Double?, productId: String?) -> Bool {
            guard let purchaseDate, let productId,
                let accepted = acceptedDates?[productId]
                    ?? (productId == self.productId ? self.purchaseDate : nil)
            else {
                return false
            }
            return purchaseDate <= accepted
        }

        /// Records that the backend accepted a transaction of `productId` dated `purchaseDate`.
        /// Returns whether that is later than what was known of the product.
        mutating func noteAccepted(purchaseDate: Double?, productId: String?) -> Bool {
            guard let purchaseDate, let productId,
                !standsFor(purchaseDate: purchaseDate, productId: productId)
            else {
                return false
            }
            acceptedDates = (acceptedDates ?? [:]).merging([productId: purchaseDate]) { $1 }
            return true
        }
    }

    private let store: any RecordStore
    private let clock: any VoidhashClock
    private var entries: [String: Entry] = [:]
    /// The transactions the host claimed, the one claimed last at the end.
    private var hostClaimed: [String] = []
    /// The transactions sent as a purchase, the one claimed last at the end.
    private var purchaseClaimed: [String] = []
    private var loadTask: Task<Void, Never>?
    /// The last load could not read the store, so the file must not be rewritten from memory.
    private var storeReadFailed = false
    private var retired = false

    /// - Parameters:
    ///   - store: Durable backing store; survives process death.
    ///   - clock: Stamps each acceptance, deciding which series is forgotten first.
    public init(store: any RecordStore, clock: any VoidhashClock = SystemVoidhashClock()) {
        self.store = store
        self.clock = clock
    }

    /// Whether the backend has already accepted `receipt` as it is now: the same transaction, or
    /// an older one of its series and product, and a revocation only once the backend accepted
    /// that too. A receipt that names no product, or whose series names none for it yet, is
    /// covered only as the same transaction.
    ///
    /// - Parameter olderOfSeries: `false` counts the same transaction only. A purchase just made
    ///   is news whatever its date: an upgrade shares its series with the subscription it
    ///   replaces, and can be dated before a renewal of it the backend already accepted.
    public func covers(_ receipt: ReceiptReference, olderOfSeries: Bool = true) async -> Bool {
        await loadIfNeeded()
        var isCovered = false
        var learnedProduct = false
        // A receipt reported by transaction id alone was recorded under that id.
        for key in Set([receipt.seriesId, receipt.transactionId]) {
            guard let entry = entries[key] else {
                continue
            }
            if receipt.isRevoked {
                if entry.revokedTransactionIds.contains(receipt.transactionId) {
                    isCovered = true
                }
            } else if entry.transactionId == receipt.transactionId {
                isCovered = true
                // An entry from before products were recorded covers nothing by date. Its own
                // transaction, asked about again, names its product.
                if entry.productId == nil, let productId = receipt.productId {
                    entries[key]?.productId = productId
                    learnedProduct = true
                }
            } else if entry.otherTransactionIds?.contains(receipt.transactionId) == true {
                isCovered = true
            } else if olderOfSeries,
                entry.standsFor(purchaseDate: receipt.purchaseDate, productId: receipt.productId)
            {
                isCovered = true
            }
        }
        if learnedProduct {
            await persist()
        }
        return isCovered
    }

    /// Records that the backend accepted `receipt`.
    ///
    /// - Returns: Whether the ledger learned something new: a series, a newer transaction or a
    ///   revocation.
    @discardableResult
    public func recordAcceptance(_ receipt: ReceiptReference) async -> Bool {
        await loadIfNeeded()
        guard apply(receipt) else {
            return false
        }
        await persist()
        return true
    }

    /// Records every receipt in `receipts` as accepted and writes the ledger once, for an
    /// importer carrying another SDK's ledger over.
    ///
    /// - Returns: Whether the ledger is on disk with them: `false` when the store could not be
    ///   read, so writing it would forget what the read never saw, or the write failed.
    @_spi(VoidhashHost)
    public func recordAcceptances(_ receipts: [ReceiptReference]) async -> Bool {
        await loadIfNeeded()
        guard !storeReadFailed, !retired else {
            return false
        }
        var changed = false
        for receipt in receipts where apply(receipt) {
            changed = true
        }
        guard changed else {
            return true
        }
        return await persist()
    }

    /// Records `receipt` in memory. Returns whether the ledger learned something new.
    private func apply(_ receipt: ReceiptReference) -> Bool {
        let key = receipt.seriesId
        var entry =
            entries[key]
            ?? Entry(
                seriesId: key, transactionId: receipt.transactionId,
                purchaseDate: receipt.purchaseDate, revokedTransactionIds: [], acceptedAt: 0)
        var changed = entries[key] == nil
        if entry.transactionId == receipt.transactionId {
            if entry.purchaseDate == nil, receipt.purchaseDate != nil {
                entry.purchaseDate = receipt.purchaseDate
                changed = true
            }
            if entry.productId == nil, receipt.productId != nil {
                entry.productId = receipt.productId
                changed = true
            }
        } else if AcceptedReceiptLedger.isNewer(receipt, than: entry) {
            let displaced = entry
            // What the latest stood for, it keeps standing for once it is no longer the latest.
            _ = entry.noteAccepted(
                purchaseDate: displaced.purchaseDate, productId: displaced.productId)
            entry.transactionId = receipt.transactionId
            entry.purchaseDate = receipt.purchaseDate
            entry.productId = receipt.productId
            entry.otherTransactionIds?.removeAll { $0 == receipt.transactionId }
            // The transaction it displaces stays accepted. A later one of its own product
            // says so; otherwise its id does.
            if displaced.productId == nil || displaced.purchaseDate == nil
                || displaced.productId != receipt.productId
            {
                entry.rememberOther(displaced.transactionId)
            }
            changed = true
        } else {
            // Not the latest of its series. As the latest of its product so far, or one that
            // names no product or no date, it is remembered by its id; its product's accepted
            // date covers the older ones.
            let isLatestOfProduct = entry.noteAccepted(
                purchaseDate: receipt.purchaseDate, productId: receipt.productId)
            let isStoodFor = entry.standsFor(
                purchaseDate: receipt.purchaseDate, productId: receipt.productId)
            if isLatestOfProduct || !isStoodFor,
                entry.otherTransactionIds?.contains(receipt.transactionId) != true
            {
                entry.rememberOther(receipt.transactionId)
                changed = true
            }
            changed = changed || isLatestOfProduct
        }
        if receipt.isRevoked, !entry.revokedTransactionIds.contains(receipt.transactionId) {
            entry.revokedTransactionIds = Array(
                (entry.revokedTransactionIds + [receipt.transactionId])
                    .suffix(AcceptedReceiptLedger.revocationsPerSeries))
            changed = true
        }
        guard changed else {
            return false
        }
        entry.acceptedAt = clock.now()
        entries[key] = entry
        if entries.count > AcceptedReceiptLedger.capacity,
            let oldest = entries.values.min(by: { $0.acceptedAt < $1.acceptedAt })
        {
            entries[oldest.seriesId] = nil
        }
        return true
    }

    /// Records that the host reported `transactionId` as its own to finish, durably: the SDK
    /// does not finish it from then on. Claimed again, it counts as claimed last.
    public func claimForHost(_ transactionId: String) async {
        await loadIfNeeded()
        guard hostClaimed.last != transactionId else {
            return
        }
        hostClaimed.removeAll { $0 == transactionId }
        hostClaimed.append(transactionId)
        hostClaimed.removeFirst(
            max(hostClaimed.count - AcceptedReceiptLedger.hostClaimCapacity, 0))
        await persist()
    }

    /// Whether the host reported `transactionId` as its own to finish.
    public func isHostClaimed(_ transactionId: String) async -> Bool {
        await loadIfNeeded()
        return hostClaimed.contains(transactionId)
    }

    /// Whether `transactionId` was sent as a purchase from this device.
    public func isPurchaseClaimed(_ transactionId: String) async -> Bool {
        await loadIfNeeded()
        return purchaseClaimed.contains(transactionId)
    }

    /// Records, durably, that `transactionId` is sent as a purchase from this device, unless it
    /// was before.
    ///
    /// - Returns: Whether this is the transaction's first purchase claim, which the caller then
    ///   sends; `false` leaves it a sync.
    public func claimPurchase(_ transactionId: String) async -> Bool {
        await loadIfNeeded()
        guard !purchaseClaimed.contains(transactionId) else {
            return false
        }
        purchaseClaimed.append(transactionId)
        purchaseClaimed.removeFirst(
            max(purchaseClaimed.count - AcceptedReceiptLedger.purchaseClaimCapacity, 0))
        await persist()
        return true
    }

    /// Hands the file over to a replacing ledger over the same store: afterwards acceptances and
    /// claims are only remembered in memory.
    public func retire() {
        retired = true
    }

    // Among undated receipts the one just accepted is the latest. Against a dated entry an
    // undated receipt is not: it would take the date the older transactions are covered by.
    private static func isNewer(_ receipt: ReceiptReference, than entry: Entry) -> Bool {
        guard let latest = entry.purchaseDate else {
            return true
        }
        guard let purchaseDate = receipt.purchaseDate else {
            return false
        }
        return purchaseDate >= latest
    }

    // Held as a task: awaiting the store suspends the actor, and an acceptance recorded in that
    // window would otherwise be overwritten by the load.
    private func loadIfNeeded() async {
        if let loadTask {
            return await loadTask.value
        }
        let task = Task { await self.performLoad() }
        loadTask = task
        await task.value
    }

    private func performLoad() async {
        let loaded = await store.load()
        storeReadFailed = loaded.readFailed
        let decoder = JSONDecoder()
        for line in loaded.lines {
            if let entry = try? decoder.decode(Entry.self, from: Data(line.utf8)) {
                entries[entry.seriesId] = entry
            } else if let claims = try? decoder.decode(HostClaims.self, from: Data(line.utf8)) {
                // Claims made while the store was being read are the more recent ones.
                let claimedMeanwhile = Set(hostClaimed)
                hostClaimed =
                    claims.hostClaimedTransactionIds.filter { !claimedMeanwhile.contains($0) }
                    + hostClaimed
            } else if let claims = try? decoder.decode(
                PurchaseClaims.self, from: Data(line.utf8))
            {
                let claimedMeanwhile = Set(purchaseClaimed)
                purchaseClaimed =
                    claims.purchaseClaimedTransactionIds.filter { !claimedMeanwhile.contains($0) }
                    + purchaseClaimed
            }
            // A line that cannot be decoded costs one redundant sync of its series, no more.
        }
    }

    @discardableResult
    private func persist() async -> Bool {
        // Rewriting the file off a failed read would forget the series the read never saw; this
        // process remembers its acceptances in memory instead.
        guard !storeReadFailed, !retired else {
            return false
        }
        let encoder = JSONEncoder()
        var lines = entries.values.sorted { $0.acceptedAt < $1.acceptedAt }.compactMap { entry in
            (try? encoder.encode(entry)).map { String(decoding: $0, as: UTF8.self) }
        }
        if !hostClaimed.isEmpty,
            let claims = try? encoder.encode(HostClaims(hostClaimedTransactionIds: hostClaimed))
        {
            lines.append(String(decoding: claims, as: UTF8.self))
        }
        if !purchaseClaimed.isEmpty,
            let claims = try? encoder.encode(
                PurchaseClaims(purchaseClaimedTransactionIds: purchaseClaimed))
        {
            lines.append(String(decoding: claims, as: UTF8.self))
        }
        return await store.replace(with: lines)
    }
}
