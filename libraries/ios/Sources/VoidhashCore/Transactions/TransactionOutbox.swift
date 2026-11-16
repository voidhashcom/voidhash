import Foundation

/// One receipt waiting to be acknowledged by the backend.
public struct OutboxRecord: Codable, Sendable, Equatable {
    /// Store transaction id; also the deduplication key inside the outbox.
    public let transactionId: String
    /// Distinct id the receipt was captured under.
    public let distinctId: String
    /// Explicit restore waiting behind this capture; retained until that identity is accepted.
    public var restoreDistinctId: String?
    /// The sync payload, persisted verbatim so a relaunch needs nothing from the store.
    public let body: SdkSyncTransactionBody
    /// Send attempts so far, driving the backoff.
    public var attempts: Int
    /// Millisecond epoch before which the record is not retried.
    public var availableAt: Double
    /// Whether the record waits out a verdict that retrying cannot change, rather than a backoff.
    /// ``TransactionOutbox/endBackoff()`` leaves a parked record waiting.
    public var parked: Bool
    /// Whether the backend's refusal of the receipt was reported already, so a receipt refused on
    /// every launch is reported once.
    public var rejectionReported: Bool
    /// What the device knows about the receipt beyond the body, kept on the device only: the
    /// accepted-receipt ledger records it when the backend accepts the receipt.
    public var receipt: ReceiptReference?
    /// Whether the host reported the transaction as its own to finish. It stays the host's
    /// whenever the receipt is delivered: now, after a long outage or by a later launch.
    public var hostClaimed: Bool
    private enum CodingKeys: String, CodingKey {
        case transactionId, distinctId, restoreDistinctId, body, attempts, availableAt, parked,
            rejectionReported, receipt, hostClaimed
    }

    public init(
        transactionId: String,
        distinctId: String,
        body: SdkSyncTransactionBody,
        attempts: Int = 0,
        availableAt: Double = 0,
        restoreDistinctId: String? = nil,
        parked: Bool = false,
        rejectionReported: Bool = false,
        receipt: ReceiptReference? = nil,
        hostClaimed: Bool = false
    ) {
        self.transactionId = transactionId
        self.distinctId = distinctId
        self.restoreDistinctId = restoreDistinctId
        self.body = body
        self.attempts = attempts
        self.availableAt = availableAt
        self.parked = parked
        self.rejectionReported = rejectionReported
        self.receipt = receipt
        self.hostClaimed = hostClaimed
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        transactionId = try container.decode(String.self, forKey: .transactionId)
        distinctId = try container.decode(String.self, forKey: .distinctId)
        restoreDistinctId = try container.decodeIfPresent(String.self, forKey: .restoreDistinctId)
        body = try container.decode(SdkSyncTransactionBody.self, forKey: .body)
        attempts = try container.decode(Int.self, forKey: .attempts)
        availableAt = try container.decode(Double.self, forKey: .availableAt)
        parked = try container.decodeIfPresent(Bool.self, forKey: .parked) ?? false
        rejectionReported =
            try container.decodeIfPresent(Bool.self, forKey: .rejectionReported) ?? false
        receipt = try container.decodeIfPresent(ReceiptReference.self, forKey: .receipt)
        hostClaimed = try container.decodeIfPresent(Bool.self, forKey: .hostClaimed) ?? false
    }

    /// The intent the record's next send carries: a restore once the explicit restore waiting
    /// behind the capture is the one being sent, a sync until then.
    ///
    /// Derived from the persisted identities, so a restore queued by a previous launch, or by
    /// a version that predates intents, is still sent as one.
    public var intent: SdkSyncTransactionIntent {
        return restoreDistinctId != nil && restoreDistinctId == distinctId ? .restore : .sync
    }
}

/// Result of draining the outbox.
public struct OutboxDrainResult: Sendable, Equatable {
    /// Transaction ids the backend accepted during this drain.
    public let acknowledgedIds: Set<String>
    /// Receipts still waiting, including postponed ones.
    public let pending: Int
    /// Transaction ids whose send failed during this drain for a reason that says nothing about
    /// the receipt: no answer, a timeout, throttling, a `5xx`. They stay queued on backoff.
    public let transientFailureIds: Set<String>

    public init(
        acknowledgedIds: Set<String> = [], pending: Int, transientFailureIds: Set<String> = []
    ) {
        self.acknowledgedIds = acknowledgedIds
        self.pending = pending
        self.transientFailureIds = transientFailureIds
    }

    /// Number of receipts the backend accepted during this drain.
    public var acknowledged: Int {
        return acknowledgedIds.count
    }

    /// Whether `transactionId` was acknowledged during this drain.
    public func didAcknowledge(_ transactionId: String) -> Bool {
        return acknowledgedIds.contains(transactionId)
    }
}

/// Durable queue of store receipts waiting to reach the backend.
///
/// A receipt is written to disk *before* any network call, so a crash, a kill or an outage
/// between the store handing over a transaction and the backend recording it cannot lose the
/// purchase. Records leave the outbox only on `accepted: true`. Every other response is retained
/// and retried with the shared backoff, and unacknowledged records are never evicted for storage
/// pressure. A write that fails is retried before the next stage, drain or count.
///
/// A receipt the backend refuses with a verdict retrying cannot change (a tagged `4xx`, such as
/// `Api/SdkTransactionRejectedError` for a store that is not configured) is parked rather than
/// dropped: it is retried on the next launch, after ``rejectionParkMilliseconds`` or when the user
/// explicitly restores it, whichever comes first.
public actor TransactionOutbox {
    /// Sends one receipt, returning whether the backend accepted it.
    public typealias Sync = @Sendable (SdkSyncTransactionBody, String) async throws -> Bool

    /// Ceiling of the computed backoff between retries of one receipt. A server's `Retry-After`
    /// is honoured up to ``NetworkPolicy/maxRetryAfterMilliseconds``.
    public static let maxRetryDelayMilliseconds = NetworkPolicy.queueBackoffCapMilliseconds

    /// How long a receipt refused with a verdict waits before it is sent again, unless the app is
    /// launched again or the user restores it first.
    public static let rejectionParkMilliseconds: Double = 6 * 60 * 60 * 1000

    private let store: any RecordStore
    private let clock: any VoidhashClock
    private let diagnostics: DiagnosticEmitter
    private let gate: OutboundGate
    private let breaker: CircuitBreaker?
    private let breakerHost: String?
    private let sync: Sync
    private let currentDistinctId: (@Sendable () async -> String)?
    private let acceptedReceipts: AcceptedReceiptLedger?
    private let beforeDrain: (@Sendable (Set<String>) async -> Void)?
    /// Most acknowledgements remembered for ``acknowledged(since:)``.
    private static let rememberedAcknowledgements = 128
    private let onDrainFinished: (@Sendable (Set<String>) -> Void)?

    /// Where the outbox is in handing its file over to a replacement, see ``retire()``.
    private enum Lifecycle {
        case active
        case retiring
        case retired
    }

    private var records: [OutboxRecord] = []
    private var loadTask: Task<Void, Never>?
    private var inFlightDrain:
        Task<(result: OutboxDrainResult, finishableIds: Set<String>), Never>?
    /// The last load could not read the store, so `records` is not the whole truth and the file
    /// must not be rewritten. Cleared by a later successful load.
    private var storeReadFailed = false
    /// Whether a load has read the store yet. The first one is this outbox's launch: the receipts
    /// a previous launch parked are due again.
    private var hasReadStore = false
    /// The last write failed, so the file lags behind `records`.
    private var needsPersist = false
    private var lifecycle = Lifecycle.active
    private var activeStages = 0
    private var stageWaiters: [CheckedContinuation<Void, Never>] = []
    /// Millisecond epoch before which the server asked, through `Retry-After`, to be sent nothing.
    /// No drain sends a receipt before it but the one an explicit restore asks for, and
    /// ``endBackoff()`` ends the outbox's own backoff early, never this.
    private var retryAfterDeadline: Double = 0
    /// The latest acknowledgements, numbered in the order they arrived, whichever drain they
    /// arrived in: a caller whose receipt another drain delivered still hears of it.
    private var acknowledgements: [(order: Int, transactionId: String)] = []
    private var acknowledgementCount = 0

    /// - Parameters:
    ///   - store: Durable backing store; survives process death.
    ///   - sync: Performs the backend call for one record.
    ///   - clock: Time source for the backoff.
    ///   - gate: While paused, records are kept but nothing is sent.
    ///   - breaker: Shared circuit breaker guarding receipt delivery.
    ///   - breakerHost: Host key used by `breaker`.
    ///   - diagnostics: Receives transport diagnostics for failed sends.
    ///   - currentDistinctId: The current identity, which a receipt staged with a distinct id the
    ///     API refuses (a blank one, for instance) is captured under instead: no request can be
    ///     scoped to such an id.
    ///   - acceptedReceipts: Records every receipt the backend accepts, whichever drain delivers
    ///     it, and the host's claim on one that was queued with it.
    ///   - beforeDrain: Awaited at the start of every drain, before any receipt is sent, so the
    ///     owner can deliver what has to reach the backend first: an identify merging the identity
    ///     a receipt was captured under, for instance. Receives the identities the queued
    ///     receipts are sent under, and is awaited again for those of receipts queued meanwhile.
    ///   - onDrainFinished: Called after every drain with the transaction ids it delivered that
    ///     the host did not claim, so the owner can finish them with the store and schedule the
    ///     next drain for the receipts still waiting.
    public init(
        store: any RecordStore,
        sync: @escaping Sync,
        clock: any VoidhashClock = SystemVoidhashClock(),
        gate: OutboundGate = OutboundGate(),
        breaker: CircuitBreaker? = nil,
        breakerHost: String? = nil,
        diagnostics: DiagnosticEmitter = DiagnosticEmitter(nil),
        currentDistinctId: (@Sendable () async -> String)? = nil,
        acceptedReceipts: AcceptedReceiptLedger? = nil,
        beforeDrain: (@Sendable (Set<String>) async -> Void)? = nil,
        onDrainFinished: (@Sendable (Set<String>) -> Void)? = nil
    ) {
        self.store = store
        self.sync = sync
        self.clock = clock
        self.gate = gate
        self.breaker = breaker
        self.breakerHost = breakerHost
        self.diagnostics = diagnostics
        self.currentDistinctId = currentDistinctId
        self.acceptedReceipts = acceptedReceipts
        self.beforeDrain = beforeDrain
        self.onDrainFinished = onDrainFinished
    }

    /// Persists `body` and immediately attempts to deliver it.
    ///
    /// Redelivery preserves the original identity and retry state of a pending transaction.
    ///
    /// - Parameter receipt: What the device knows about the receipt, recorded in the
    ///   accepted-receipt ledger once the backend accepts it.
    @discardableResult
    public func enqueue(
        _ body: SdkSyncTransactionBody, distinctId: String, receipt: ReceiptReference? = nil
    ) async -> OutboxDrainResult {
        let staged = acknowledgementCount
        await stage(body, distinctId: distinctId, receipt: receipt)
        return await drain(restoring: nil, since: staged)
    }

    /// Delivers an older capture before submitting an explicit restore for `distinctId`.
    /// A failed older delivery keeps its original identity and postpones the restore.
    ///
    /// The user asked for it, so the receipt is sent now: the retry backoff, a park after a
    /// refusal and a pause the server asked for through `Retry-After` are over for it. The other
    /// receipts keep waiting out that pause.
    public func restore(
        _ body: SdkSyncTransactionBody, distinctId: String, receipt: ReceiptReference? = nil
    ) async -> OutboxDrainResult {
        let staged = acknowledgementCount
        await stage(body, distinctId: distinctId, restoreDistinctId: distinctId, receipt: receipt)
        return await drain(restoring: body.transactionId, since: staged)
    }

    /// Enqueues `body` without attempting delivery. Used by launch reconciliation, which enqueues
    /// a batch and drains once.
    ///
    /// A body whose intent is ``SdkSyncTransactionIntent/restore`` is staged as an explicit
    /// restore for `distinctId`, as ``restore(_:distinctId:receipt:)`` does.
    ///
    /// - Parameter hostClaimed: The host reported the transaction as its own to finish. The
    ///   claim is kept with the receipt, also when it joins one already queued without it.
    /// - Returns: Whether the receipt reached the store. `false` leaves it in memory, and the
    ///   write is retried before the next stage, drain or count.
    @discardableResult
    public func stage(
        _ body: SdkSyncTransactionBody, distinctId: String, restoreDistinctId: String? = nil,
        receipt: ReceiptReference? = nil, hostClaimed: Bool = false
    ) async -> Bool {
        activeStages += 1
        defer { finishStage() }
        let distinctId = await capturingIdentity(distinctId)
        var restoreDistinctId = restoreDistinctId ?? (body.intent == .restore ? distinctId : nil)
        if let requested = restoreDistinctId {
            restoreDistinctId = await capturingIdentity(requested)
        }
        await loadIfNeeded()
        await persistIfNeeded()
        let record: OutboxRecord
        if let index = records.firstIndex(where: { $0.transactionId == body.transactionId }) {
            let known = records[index].receipt
            // A report carrying more than the id completes one that carried the id alone, and a
            // revocation replaces what was known before it.
            let learnsReceipt =
                receipt != nil && receipt != known && (known == nil || receipt?.isRevoked == true)
            let claims = hostClaimed && !records[index].hostClaimed
            guard restoreDistinctId != nil || learnsReceipt || claims else {
                return !needsPersist
            }
            if learnsReceipt {
                records[index].receipt = receipt
            }
            if claims {
                records[index].hostClaimed = true
            }
            if let restoreDistinctId {
                records[index].restoreDistinctId = restoreDistinctId
                records[index].availableAt = 0
                records[index].parked = false
            }
            record = records[index]
        } else {
            record = OutboxRecord(
                transactionId: body.transactionId, distinctId: distinctId, body: body,
                restoreDistinctId: restoreDistinctId, receipt: receipt, hostClaimed: hostClaimed)
            records.append(record)
        }
        if storeReadFailed || lifecycle == .retired {
            // The file cannot be rewritten without seeing it, and after retirement it belongs to
            // the replacement, but appending is safe either way; the duplicate of an
            // already-present record is collapsed by the next successful load.
            let appended = await store.append([record].compactMap(TransactionOutbox.encodeLine))
            if !appended {
                needsPersist = true
            }
            return appended
        }
        return await persist()
    }

    /// Receipts still waiting for an acknowledgement.
    public func pendingCount() async -> Int {
        await loadIfNeeded()
        await persistIfNeeded()
        return records.count
    }

    /// Hands the file over to a replacing outbox over the same store.
    ///
    /// Cancels an in-flight drain, waits for it and for stages already under way, and writes
    /// anything still unwritten. Afterwards the outbox sends nothing and never rewrites the
    /// store: a later stage only appends its record, so a replacement that has loaded the file
    /// keeps what it holds.
    public func retire() async {
        guard lifecycle == .active else {
            return
        }
        lifecycle = .retiring
        inFlightDrain?.cancel()
        while let inFlightDrain {
            await Task.yield()
            _ = await inFlightDrain.value
        }
        if activeStages > 0 {
            await withCheckedContinuation { stageWaiters.append($0) }
        }
        await persistIfNeeded()
        lifecycle = .retired
    }

    /// Makes every receipt waiting out the retry backoff due now, for a caller with fresh
    /// evidence that the backend may be reachable again (a flush, a foreground, connectivity
    /// coming back). A ``OutboxRecord/parked`` receipt keeps waiting, and so does one the server
    /// asked to hold back through `Retry-After`, until the time it gave.
    ///
    /// Waits for a drain in flight first: its sends predate the evidence, and a failure it records
    /// afterwards would otherwise back the receipt off again, so the caller's drain skipped it.
    public func endBackoff() async {
        // Yields on every lap, for the same reason as in `drain`.
        while let inFlightDrain {
            await Task.yield()
            _ = await inFlightDrain.value
        }
        await loadIfNeeded()
        for index in records.indices
        where !records[index].parked && records[index].availableAt > retryAfterDeadline {
            records[index].availableAt = retryAfterDeadline
        }
    }

    /// Transaction ids still waiting for an acknowledgement.
    public func pendingTransactionIds() async -> [String] {
        await loadIfNeeded()
        return records.map(\.transactionId)
    }

    /// Millisecond epoch from which a drain has a receipt it may send, or `nil` when it has none:
    /// nothing is queued but parked receipts, or the store cannot be read.
    ///
    /// Whether the circuit breaker lets the receipt through then is the caller's to check.
    public func nextAttemptAt() async -> Double? {
        await loadIfNeeded()
        guard !storeReadFailed, lifecycle == .active else {
            return nil
        }
        let timestamp = clock.now()
        let earliest = isHeldByServer(at: timestamp) ? retryAfterDeadline : timestamp
        return
            records
            .filter { !$0.parked }
            .map {
                NetworkPolicy.isDue($0.availableAt, now: timestamp)
                    ? earliest : max($0.availableAt, earliest)
            }
            .min()
    }

    /// Whether the server asked, through `Retry-After`, to be sent nothing at `timestamp`. A
    /// deadline further away than any server can ask for was recorded under a clock that has
    /// moved back since, and holds nothing.
    private func isHeldByServer(at timestamp: Double) -> Bool {
        return !NetworkPolicy.isDue(
            retryAfterDeadline, now: timestamp, ceiling: NetworkPolicy.maxRetryAfterMilliseconds)
    }

    /// Sends every due record, removing the ones the backend accepts. While the server asks,
    /// through `Retry-After`, to be sent nothing, no record is due, and a send answered with one
    /// ends the drain.
    ///
    /// One drain runs at a time. A caller arriving while one is in flight waits for it and then
    /// runs its own rather than adopting the running one's verdict: a receipt staged after the
    /// running drain took its snapshot has not been attempted yet, and reporting it as "not
    /// acknowledged" off a drain that never sent it would leave the purchase waiting for the
    /// next trigger. What other drains delivered since the call began is reported as
    /// acknowledged too, whether this one waited for them or they came and went while it was
    /// still preparing, unless it is queued again: a restore staged onto a receipt such a drain
    /// was sending is sent as a restore before it leaves the outbox.
    @discardableResult
    public func drain() async -> OutboxDrainResult {
        return await drain(restoring: nil, since: acknowledgementCount)
    }

    /// - Parameters:
    ///   - restoring: The transaction an explicit restore asks for, sent even while the server's
    ///     `Retry-After` holds the others back.
    ///   - since: The acknowledgement count when the caller's receipt was not staged yet: what
    ///     was acknowledged from then on counts for the caller.
    private func drain(restoring: String?, since: Int) async -> OutboxDrainResult {
        var prepared: Set<String> = []
        if let beforeDrain {
            await loadIfNeeded()
            prepared = sendingIdentities()
            await beforeDrain(prepared)
        }
        var failedMeanwhile: Set<String> = []
        // Yields on every lap: awaiting an already-completed task continues inline without
        // yielding the actor, which would starve the continuation that nils the handle.
        while let inFlightDrain {
            await Task.yield()
            failedMeanwhile.formUnion(await inFlightDrain.value.result.transientFailureIds)
        }
        let task = Task { await self.runDrain(restoring: restoring, prepared: prepared) }
        inFlightDrain = task
        let (result, finishableIds) = await task.value
        inFlightDrain = nil
        onDrainFinished?(finishableIds)
        let pendingIds = Set(records.map(\.transactionId))
        return OutboxDrainResult(
            acknowledgedIds: result.acknowledgedIds.union(
                acknowledged(since: since).subtracting(pendingIds)),
            pending: result.pending,
            transientFailureIds: result.transientFailureIds.union(
                failedMeanwhile.intersection(pendingIds)))
    }

    /// The identities the queued receipts are, or will be, sent under.
    private func sendingIdentities() -> Set<String> {
        return Set(records.flatMap { [$0.distinctId, $0.restoreDistinctId].compactMap { $0 } })
    }

    /// The transactions acknowledged after the first `since` acknowledgements, as far back as
    /// the outbox remembers.
    private func acknowledged(since: Int) -> Set<String> {
        return Set(acknowledgements.filter { $0.order > since }.map(\.transactionId))
    }

    /// - Returns: The drain's result, and the transactions it delivered that the host did not
    ///   claim: the ones left for the SDK to finish with the store.
    private func runDrain(restoring: String?, prepared: Set<String>) async -> (
        result: OutboxDrainResult, finishableIds: Set<String>
    ) {
        await loadIfNeeded()
        if storeReadFailed {
            await performLoad()
        }
        await persistIfNeeded()
        guard !storeReadFailed, lifecycle == .active, gate.allowsOutbound() else {
            return (OutboxDrainResult(pending: records.count), [])
        }
        // A receipt queued while the owner prepared this drain is sent under an identity the
        // owner has not heard of yet. It hears of it here, before anything is sent, so that
        // receipt too goes after the identify that merges its identity.
        var prepared = prepared
        while let beforeDrain {
            let added = sendingIdentities().subtracting(prepared)
            guard !added.isEmpty else {
                break
            }
            prepared.formUnion(added)
            await beforeDrain(added)
        }
        guard lifecycle == .active else {
            return (OutboxDrainResult(pending: records.count), [])
        }

        var acknowledgedIds: Set<String> = []
        var finishableIds: Set<String> = []
        var transientFailureIds: Set<String> = []
        let timestamp = clock.now()
        // Whether the drain changed what the file should hold. An idle drain — or one that
        // only probed a paused gate or an open breaker — must not rewrite the file.
        var mutated = false
        let heldByServer = isHeldByServer(at: timestamp)
        var due = records.filter { record in
            (!heldByServer || record.transactionId == restoring)
                && NetworkPolicy.isDue(
                record.availableAt, now: timestamp,
                ceiling: record.parked
                    ? TransactionOutbox.rejectionParkMilliseconds
                    : NetworkPolicy.maxPostponementMilliseconds)
        }.map(\.transactionId)
        var next = 0
        while next < due.count {
            // Sends what is queued now: a restore staged since the drain started makes the send a
            // restore.
            guard let record = records.first(where: { $0.transactionId == due[next] }) else {
                next += 1
                continue
            }
            next += 1
            let permit: CircuitBreakerPermit?
            if let breaker, let breakerHost {
                guard let acquired = await breaker.acquire(host: breakerHost) else {
                    break
                }
                permit = acquired
            } else {
                permit = nil
            }
            let sentIntent = record.intent
            var body = record.body
            body.intent = sentIntent
            let accepted: Bool
            do {
                accepted = try await sync(body, record.distinctId)
                if let breaker, let permit {
                    await breaker.release(permit, retryableFailure: nil)
                }
            } catch let error as VoidhashApiError where error.isAuthFailure {
                if let breaker, let permit {
                    await breaker.release(permit, retryableFailure: false)
                }
                if gate.pause() {
                    diagnostics.emit(
                        .auth, code: "AUTHENTICATION_FAILED", operation: "transactions.sync",
                        httpStatus: error.statusCode,
                        message:
                            "The publishable key was rejected; \(records.count) receipt(s) stay queued"
                    )
                }
                break
            } catch is CancellationError {
                if let breaker, let permit {
                    await breaker.abandon(permit)
                }
                // The record keeps its slot untouched: a cancelled send is not evidence about
                // the backend and must not push the retry further out.
                break
            } catch let error as VoidhashApiError where error.isVerdict {
                if let breaker, let permit {
                    await breaker.release(permit, retryableFailure: false)
                }
                park(record, error: error)
                mutated = true
                continue
            } catch {
                // Failed in transit, the device's network included, as opposed to whether the
                // failure is evidence against the host.
                let apiError = error as? VoidhashApiError
                let transient = apiError?.isRetryable ?? true
                if let breaker, let permit {
                    await breaker.release(
                        permit, retryableFailure: apiError?.countsTowardsCircuitBreaker ?? true)
                }
                if transient {
                    transientFailureIds.insert(record.transactionId)
                }
                postpone(record, error: error)
                mutated = true
                // The server said when to come back: the receipts behind this one wait as well.
                if apiError?.retryAfterMilliseconds != nil {
                    break
                }
                continue
            }

            mutated = true
            guard accepted else {
                postpone(record, error: nil)
                continue
            }
            guard
                let index = records.firstIndex(where: {
                    $0.transactionId == record.transactionId
                })
            else {
                continue
            }
            // A restore staged while the capture was in flight still has to be sent as one, under
            // the identity that asked for it, before the receipt may leave.
            if let restoreId = records[index].restoreDistinctId,
                restoreId != record.distinctId || sentIntent != .restore
            {
                let captured = records[index]
                let restored = OutboxRecord(
                    transactionId: captured.transactionId, distinctId: restoreId,
                    body: captured.body, restoreDistinctId: restoreId,
                    rejectionReported: captured.rejectionReported, receipt: captured.receipt,
                    hostClaimed: captured.hostClaimed)
                records[index] = restored
                // Persist the promotion before attempting it, including across process death.
                await persist()
                due.append(restored.transactionId)
            } else {
                let receipt = records[index].receipt
                if records[index].hostClaimed {
                    // A claim queued by a client that could not record it itself, a retired
                    // one, is recorded by the one that delivers its receipt.
                    await acceptedReceipts?.claimForHost(record.transactionId)
                } else {
                    finishableIds.insert(record.transactionId)
                }
                records.remove(at: index)
                acknowledgedIds.insert(record.transactionId)
                acknowledgementCount += 1
                acknowledgements.append((acknowledgementCount, record.transactionId))
                acknowledgements.removeFirst(
                    max(acknowledgements.count - TransactionOutbox.rememberedAcknowledgements, 0))
                await acceptedReceipts?.recordAcceptance(
                    receipt ?? ReceiptReference(transactionId: record.transactionId))
            }
        }

        if mutated {
            await persist()
        }
        return (
            OutboxDrainResult(
                acknowledgedIds: acknowledgedIds, pending: records.count,
                transientFailureIds: transientFailureIds.subtracting(acknowledgedIds)),
            finishableIds
        )
    }

    // No request can be scoped to an id the API refuses, such as a blank one: such a capture
    // belongs to the current identity.
    private func capturingIdentity(_ distinctId: String) async -> String {
        guard IdentityStore.invalidDistinctIdReason(distinctId) != nil, let currentDistinctId
        else {
            return distinctId
        }
        return await currentDistinctId()
    }

    private func postpone(_ record: OutboxRecord, error: (any Error)?) {
        guard let index = records.firstIndex(where: { $0.transactionId == record.transactionId })
        else {
            return
        }
        records[index].attempts += 1
        // A receipt refused before and now failing transiently waits out a backoff, not a park.
        records[index].parked = false
        let retryAfter = (error as? VoidhashApiError)?.retryAfterMilliseconds
        if let retryAfter {
            retryAfterDeadline = max(retryAfterDeadline, clock.now() + retryAfter)
        }
        records[index].availableAt =
            clock.now()
            + (retryAfter
                ?? NetworkPolicy.backoffMilliseconds(
                    attempt: records[index].attempts,
                    cap: TransactionOutbox.maxRetryDelayMilliseconds))
        diagnostics.emit(
            .transport, code: "TRANSACTION_SYNC_DEFERRED", operation: "transactions.sync",
            retryable: true, httpStatus: (error as? VoidhashApiError)?.statusCode,
            message:
                "Receipt \(record.transactionId) was not acknowledged; retrying (attempt \(records[index].attempts))"
        )
    }

    /// Parks a receipt the backend refused with a verdict retrying cannot change, reporting the
    /// refusal the first time it arrives for this receipt.
    private func park(_ record: OutboxRecord, error: VoidhashApiError) {
        guard let index = records.firstIndex(where: { $0.transactionId == record.transactionId })
        else {
            return
        }
        records[index].attempts += 1
        records[index].parked = true
        records[index].availableAt = clock.now() + TransactionOutbox.rejectionParkMilliseconds
        guard !records[index].rejectionReported else {
            return
        }
        records[index].rejectionReported = true
        diagnostics.emit(
            .transport, code: "TRANSACTION_REJECTED", operation: "transactions.sync",
            retryable: true, httpStatus: error.statusCode,
            message:
                "Voidhash cannot accept receipt \(record.transactionId) as sent: \(error.message). It stays queued and is sent again on the next launch, in 6 hours or when the user restores purchases"
        )
    }

    // The load is held as a task rather than guarded by a flag: awaiting the store suspends the
    // actor, and a second caller arriving in that window would otherwise see an empty outbox,
    // stage its receipt into it and have the load overwrite the receipt on completion.
    private func loadIfNeeded() async {
        if let loadTask {
            await loadTask.value
            return
        }
        let task = Task { await self.performLoad() }
        loadTask = task
        await task.value
    }

    private func performLoad() async {
        let loaded = await store.load()
        storeReadFailed = loaded.readFailed
        let decoder = JSONDecoder()
        let persisted = loaded.lines.compactMap { line -> OutboxRecord? in
            guard let record = try? decoder.decode(OutboxRecord.self, from: Data(line.utf8))
            else {
                diagnostics.emit(
                    .eviction, code: "QUEUE_RECORD_DROPPED", operation: "transactions.load",
                    message: "Dropped a persisted receipt that could not be decoded")
                return nil
            }
            // A park lasts until the next launch at the longest, and this is the next launch.
            guard !hasReadStore, record.parked else {
                return record
            }
            var due = record
            due.parked = false
            due.availableAt = 0
            return due
        }
        if !loaded.readFailed {
            hasReadStore = true
        }
        // Retry snapshots may be newer, but ownership belongs to the first capture.
        var orderedIds: [String] = []
        var merged: [String: OutboxRecord] = [:]
        for record in persisted + records {
            if var first = merged[record.transactionId] {
                first.attempts = max(first.attempts, record.attempts)
                first.availableAt = max(first.availableAt, record.availableAt)
                first.parked = first.parked || record.parked
                first.rejectionReported = first.rejectionReported || record.rejectionReported
                first.restoreDistinctId = record.restoreDistinctId ?? first.restoreDistinctId
                first.receipt = first.receipt ?? record.receipt
                first.hostClaimed = first.hostClaimed || record.hostClaimed
                merged[record.transactionId] = first
            } else {
                orderedIds.append(record.transactionId)
                merged[record.transactionId] = record
            }
        }
        records = orderedIds.compactMap { merged[$0] }
    }

    /// Rewrites the store from `records`, returning whether it now holds them.
    @discardableResult
    private func persist() async -> Bool {
        // Rewriting the file off a failed read would delete receipts the load never saw; the
        // records stay in memory (and on disk) until a later load succeeds. A retired outbox's
        // file belongs to its replacement.
        guard !storeReadFailed, lifecycle != .retired else {
            return false
        }
        let written = await store.replace(with: records.compactMap(TransactionOutbox.encodeLine))
        needsPersist = !written
        return written
    }

    private func persistIfNeeded() async {
        if needsPersist {
            await persist()
        }
    }

    private func finishStage() {
        activeStages -= 1
        guard activeStages == 0 else {
            return
        }
        let waiters = stageWaiters
        stageWaiters.removeAll()
        waiters.forEach { $0.resume() }
    }

    private static func encodeLine(_ record: OutboxRecord) -> String? {
        guard let data = try? JSONEncoder().encode(record) else {
            return nil
        }
        return String(decoding: data, as: UTF8.self)
    }
}
