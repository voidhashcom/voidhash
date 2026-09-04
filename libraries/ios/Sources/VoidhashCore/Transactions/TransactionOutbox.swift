import Foundation

/// One receipt waiting to be acknowledged by the backend.
public struct OutboxRecord: Codable, Sendable, Equatable {
    /// Store transaction id; also the deduplication key inside the outbox.
    public let transactionId: String
    /// Distinct id the receipt was captured under.
    public let distinctId: String
    /// The sync payload, persisted verbatim so a relaunch needs nothing from the store.
    public let body: SdkSyncTransactionBody
    /// Send attempts so far, driving the backoff.
    public var attempts: Int
    /// Millisecond epoch before which the record is not retried.
    public var availableAt: Double
    private enum CodingKeys: String, CodingKey {
        case transactionId, distinctId, body, attempts, availableAt
    }

    public init(
        transactionId: String,
        distinctId: String,
        body: SdkSyncTransactionBody,
        attempts: Int = 0,
        availableAt: Double = 0
    ) {
        self.transactionId = transactionId
        self.distinctId = distinctId
        self.body = body
        self.attempts = attempts
        self.availableAt = availableAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        transactionId = try container.decode(String.self, forKey: .transactionId)
        distinctId = try container.decode(String.self, forKey: .distinctId)
        body = try container.decode(SdkSyncTransactionBody.self, forKey: .body)
        attempts = try container.decode(Int.self, forKey: .attempts)
        availableAt = try container.decode(Double.self, forKey: .availableAt)
    }
}

/// Result of draining the outbox.
public struct OutboxDrainResult: Sendable, Equatable {
    /// Transaction ids the backend accepted during this drain.
    public let acknowledgedIds: Set<String>
    /// Receipts still waiting, including postponed ones.
    public let pending: Int

    public init(acknowledgedIds: Set<String> = [], pending: Int) {
        self.acknowledgedIds = acknowledgedIds
        self.pending = pending
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
/// pressure.
public actor TransactionOutbox {
    /// Sends one receipt, returning whether the backend accepted it.
    public typealias Sync = @Sendable (SdkSyncTransactionBody, String) async throws -> Bool

    /// Backoff ceiling between retries of one receipt, also the ceiling for `Retry-After`.
    public static let maxRetryDelayMilliseconds = NetworkPolicy.queueBackoffCapMilliseconds

    private let store: any RecordStore
    private let clock: any VoidhashClock
    private let diagnostics: DiagnosticEmitter
    private let gate: OutboundGate
    private let breaker: CircuitBreaker?
    private let breakerHost: String?
    private let sync: Sync

    private var records: [OutboxRecord] = []
    private var loadTask: Task<Void, Never>?
    private var inFlightDrain: Task<OutboxDrainResult, Never>?
    /// The last load could not read the store, so `records` is not the whole truth and the file
    /// must not be rewritten. Cleared by a later successful load.
    private var storeReadFailed = false

    /// - Parameters:
    ///   - store: Durable backing store; survives process death.
    ///   - sync: Performs the backend call for one record.
    ///   - clock: Time source for the backoff.
    ///   - gate: While paused, records are kept but nothing is sent.
    ///   - breaker: Shared circuit breaker guarding receipt delivery.
    ///   - breakerHost: Host key used by `breaker`.
    ///   - diagnostics: Receives transport diagnostics for failed sends.
    public init(
        store: any RecordStore,
        sync: @escaping Sync,
        clock: any VoidhashClock = SystemVoidhashClock(),
        gate: OutboundGate = OutboundGate(),
        breaker: CircuitBreaker? = nil,
        breakerHost: String? = nil,
        diagnostics: DiagnosticEmitter = DiagnosticEmitter(nil)
    ) {
        self.store = store
        self.sync = sync
        self.clock = clock
        self.gate = gate
        self.breaker = breaker
        self.breakerHost = breakerHost
        self.diagnostics = diagnostics
    }

    /// Persists `body` and immediately attempts to deliver it.
    ///
    /// Enqueuing the same transaction id twice replaces the pending record rather than adding a
    /// second one; the backend deduplicates redeliveries anyway.
    @discardableResult
    public func enqueue(_ body: SdkSyncTransactionBody, distinctId: String) async
        -> OutboxDrainResult
    {
        await stage(body, distinctId: distinctId)
        return await drain()
    }

    /// Enqueues `body` without attempting delivery. Used by launch reconciliation, which enqueues
    /// a batch and drains once.
    public func stage(_ body: SdkSyncTransactionBody, distinctId: String) async {
        await loadIfNeeded()
        let record = OutboxRecord(
            transactionId: body.transactionId, distinctId: distinctId, body: body)
        records.removeAll { $0.transactionId == body.transactionId }
        records.append(record)
        if storeReadFailed {
            // The file cannot be rewritten without seeing it, but appending is still safe; the
            // duplicate of an already-present record is collapsed by the next successful load.
            await store.append([record].compactMap(TransactionOutbox.encodeLine))
            return
        }
        await persist()
    }

    /// Receipts still waiting for an acknowledgement.
    public func pendingCount() async -> Int {
        await loadIfNeeded()
        return records.count
    }

    /// Transaction ids still waiting for an acknowledgement.
    public func pendingTransactionIds() async -> [String] {
        await loadIfNeeded()
        return records.map(\.transactionId)
    }

    /// Sends every due record, removing the ones the backend accepts.
    ///
    /// One drain runs at a time. A caller arriving while one is in flight waits for it and then
    /// runs its own rather than adopting the running one's verdict: a receipt staged after the
    /// running drain took its snapshot has not been attempted yet, and reporting it as "not
    /// acknowledged" off a drain that never sent it would leave the purchase waiting for the
    /// next trigger.
    @discardableResult
    public func drain() async -> OutboxDrainResult {
        // Yields on every lap: awaiting an already-completed task continues inline without
        // yielding the actor, which would starve the continuation that nils the handle.
        while let inFlightDrain {
            await Task.yield()
            _ = await inFlightDrain.value
        }
        let task = Task { await self.runDrain() }
        inFlightDrain = task
        defer { inFlightDrain = nil }
        return await task.value
    }

    private func runDrain() async -> OutboxDrainResult {
        await loadIfNeeded()
        if storeReadFailed {
            await performLoad()
        }
        guard gate.allowsOutbound() else {
            return OutboxDrainResult(pending: records.count)
        }

        var acknowledgedIds: Set<String> = []
        let timestamp = clock.now()
        // Whether the drain changed what the file should hold. An idle drain — or one that
        // only probed a paused gate or an open breaker — must not rewrite the file.
        var mutated = false
        for record in records where record.availableAt <= timestamp {
            let permit: CircuitBreakerPermit?
            if let breaker, let breakerHost {
                guard let acquired = await breaker.acquire(host: breakerHost) else {
                    break
                }
                permit = acquired
            } else {
                permit = nil
            }
            let accepted: Bool
            do {
                accepted = try await sync(record.body, record.distinctId)
                if let breaker, let permit {
                    await breaker.release(permit, retryableFailure: nil)
                }
            } catch let error as VoidhashApiError where error.isAuthFailure {
                if let breaker, let permit {
                    await breaker.release(permit, retryableFailure: false)
                }
                gate.pause(now: clock.now())
                diagnostics.emit(
                    .auth, code: "AUTHENTICATION_FAILED", operation: "transactions.sync",
                    httpStatus: error.statusCode,
                    message:
                        "The publishable key was rejected; \(records.count) receipt(s) stay queued")
                break
            } catch is CancellationError {
                if let breaker, let permit {
                    await breaker.abandon(permit)
                }
                // The record keeps its slot untouched: a cancelled send is not evidence about
                // the backend and must not push the retry further out.
                break
            } catch {
                if let breaker, let permit {
                    await breaker.release(
                        permit,
                        retryableFailure: NetworkPolicy.countsTowardsCircuitBreaker(
                            statusCode: (error as? VoidhashApiError)?.statusCode))
                }
                postpone(record, error: error)
                mutated = true
                continue
            }

            if accepted {
                records.removeAll { $0.transactionId == record.transactionId }
                acknowledgedIds.insert(record.transactionId)
                mutated = true
            } else {
                postpone(record, error: nil)
                mutated = true
            }
        }

        if mutated {
            await persist()
        }
        return OutboxDrainResult(acknowledgedIds: acknowledgedIds, pending: records.count)
    }

    private func postpone(_ record: OutboxRecord, error: (any Error)?) {
        guard let index = records.firstIndex(where: { $0.transactionId == record.transactionId })
        else {
            return
        }
        records[index].attempts += 1
        records[index].availableAt =
            clock.now()
            + (NetworkPolicy.clampRetryAfter(
                (error as? VoidhashApiError)?.retryAfterMilliseconds,
                cap: TransactionOutbox.maxRetryDelayMilliseconds)
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
            return record
        }
        // Anything staged while the read was in flight is newer than what is on disk. A record
        // appended twice while the store was unreadable collapses onto its last copy.
        let stagedIds = Set(records.map(\.transactionId))
        var seen: Set<String> = []
        let fromDisk = persisted.reversed().filter {
            !stagedIds.contains($0.transactionId) && seen.insert($0.transactionId).inserted
        }
        records = Array(fromDisk.reversed()) + records
    }

    private func persist() async {
        // Rewriting the file off a failed read would delete receipts the load never saw; the
        // records stay in memory (and on disk) until a later load succeeds.
        guard !storeReadFailed else {
            return
        }
        await store.replace(with: records.compactMap(TransactionOutbox.encodeLine))
    }

    private static func encodeLine(_ record: OutboxRecord) -> String? {
        guard let data = try? JSONEncoder().encode(record) else {
            return nil
        }
        return String(decoding: data, as: UTF8.self)
    }
}
