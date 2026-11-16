import Foundation

/// What a queued ``PersonWrite`` asks the backend to do.
public enum PersonWriteKind: String, Codable, Sendable {
    /// Links an alias onto an identified person: `POST /api/v1/sdk/identify`.
    case identify
    /// Sets traits on one person: `POST /api/v1/sdk/person/traits`.
    case traits
    /// Takes one person's agreement to sharing with ad platforms back, on the same endpoint.
    /// Analytics consent neither blocks nor discards it, and it carries nothing else.
    case adDataSharingRevocation
}

/// One write against the person record, kept until the backend applies it.
public struct PersonWrite: Codable, Sendable, Equatable {
    /// What the write asks for.
    public let kind: PersonWriteKind
    /// The person the write describes: the id an identify links onto, or the id traits are
    /// written for, which the traits request is also made as.
    public let target: String
    /// The id an identify links onto ``target``, sent as `x-distinct-id`; `nil` for traits.
    public let alias: String?
    /// Email an identify sets on the person.
    public var email: String?
    /// Name an identify sets on the person.
    public var name: String?
    /// Traits to set, the newest value per key.
    public var traits: [String: JSONValue]
    /// Failed deliveries so far, driving the backoff.
    public var attempts: Int
    /// Millisecond epoch before which the write is not retried.
    public var availableAt: Double
    /// Changes every time the write is queued or merged into. A delivery settles the queued write
    /// only while it still carries the sequence that was sent, so data merged in while the
    /// request was in flight is never lost.
    public var sequence: Int
    /// Millisecond epoch a revocation was first queued, which its lifetime counts from.
    public var queuedAt: Double?
    /// Whether a revocation waits out ``availableAt`` because Voidhash has no such person yet,
    /// which asking sooner would not change, rather than because of a failure.
    public var waitsForPerson: Bool?

    /// The person trait that holds the agreement to sharing with ad platforms.
    public static let adDataSharingTrait = "$ad_data_sharing"

    /// An identify linking `alias` onto `target`.
    public static func identify(
        alias: String, target: String, email: String? = nil, name: String? = nil
    ) -> PersonWrite {
        return PersonWrite(
            kind: .identify, target: target, alias: alias, email: email, name: name, traits: [:],
            attempts: 0, availableAt: 0, sequence: 0)
    }

    /// Traits for the person `target`.
    public static func traits(_ traits: [String: JSONValue], for target: String) -> PersonWrite {
        return PersonWrite(
            kind: .traits, target: target, alias: nil, email: nil, name: nil, traits: traits,
            attempts: 0, availableAt: 0, sequence: 0)
    }

    /// Takes the agreement of the person `target` back, as first asked for at `queuedAt`.
    static func adDataSharingRevocation(for target: String, queuedAt: Double) -> PersonWrite {
        return PersonWrite(
            kind: .adDataSharingRevocation, target: target, alias: nil, email: nil, name: nil,
            traits: [adDataSharingTrait: .bool(false)], attempts: 0, availableAt: queuedAt,
            sequence: 0, queuedAt: queuedAt)
    }

    /// Identifies the write for merging. Traits merge per person. An identify merges only with one
    /// linking the same alias onto the same target: two aliases of one user are two merges the
    /// backend has to make, and collapsing them would orphan the older alias's purchases. The
    /// alias is length-prefixed because distinct ids may themselves contain colons.
    var key: String {
        switch kind {
        case .identify:
            let alias = alias ?? ""
            return "identify:\(alias.utf8.count):\(alias):\(target)"
        case .traits:
            return "traits:\(target)"
        case .adDataSharingRevocation:
            return "ad-data-sharing-revocation:\(target)"
        }
    }
}

/// Outcome of ``PersonWriteOutbox/drain(identify:setTraits:)``.
public struct PersonWriteDrainResult: Sendable, Equatable {
    /// Writes the backend applied during this drain.
    public let delivered: Int
    /// Writes still queued.
    public let pending: Int
    /// Whether the drain stopped because the SDK refuses traffic for now: a rejected publishable
    /// key paused it, or the host's circuit is open. The writes it did not reach keep their retry
    /// state.
    public let stoppedByRefusal: Bool
    /// Targets of the identifies the API refused during this drain; their merges never happen.
    public let rejectedIdentifyTargets: Set<String>

    public init(
        delivered: Int = 0, pending: Int, stoppedByRefusal: Bool = false,
        rejectedIdentifyTargets: Set<String> = []
    ) {
        self.delivered = delivered
        self.pending = pending
        self.stoppedByRefusal = stoppedByRefusal
        self.rejectedIdentifyTargets = rejectedIdentifyTargets
    }
}

/// Durable queue of `identify` and person-trait writes waiting for the backend.
///
/// Both describe something the app already knows to be true about its user, so the SDK applies
/// them locally and delivers the server call from here, across outages and relaunches: an
/// identify as `POST /api/v1/sdk/identify` made as its alias, traits as
/// `POST /api/v1/sdk/person/traits` made as their person, strictly after any identify still
/// queued for that person. The backend applies both idempotently, so a redelivery is free.
///
/// Writes are never evicted for capacity or for a transient failure. Traits for one person merge
/// into one write, the newest value per key, which bounds the queue; an identify merges only
/// with one for the same alias and target. Only a verdict the API will repeat drops a write,
/// with a `PERSON_WRITE_REJECTED` diagnostic.
///
/// A revocation of the agreement to sharing with ad platforms goes last in each pass, after any
/// link or traits for its person, whom Voidhash may not have until those arrive. It is dropped
/// when Voidhash has still no such person 48 hours after it was first queued, and only then: an
/// outage must not leave sharing on.
public actor PersonWriteOutbox {
    /// Delivers one write, throwing what the request failed with.
    public typealias Send = @Sendable (PersonWrite) async throws -> Void

    /// How long a revocation is asked again for a person Voidhash does not have.
    public static let revocationLifetimeMilliseconds: Double = 48 * 60 * 60 * 1000
    /// The shortest wait before asking again. Each wait then lasts as long as the revocation has
    /// waited so far, as most people who decline never had a person: about 15 requests over its
    /// lifetime at most.
    public static let revocationMinWaitMilliseconds: Double = 30_000

    /// Where the outbox is in handing its file over to a replacement, see ``retire()``.
    private enum Lifecycle {
        case active
        case retiring
        case retired
    }

    private let store: any RecordStore
    private let clock: any VoidhashClock
    private let diagnostics: DiagnosticEmitter

    private var records: [PersonWrite] = []
    private var loadTask: Task<Void, Never>?
    private var inFlightDrain: Task<PersonWriteDrainResult, Never>?
    /// The last load could not read the store, so `records` is not the whole truth and the file
    /// must not be rewritten. Cleared by a later successful load.
    private var storeReadFailed = false
    /// Monotonic reading before which a drain does not read an unreadable store again, so a
    /// store that stays unreadable is not re-read, and reported, on every drain.
    private var reloadAllowedAt: Double = 0
    /// The last write failed, so the file lags behind `records`.
    private var needsPersist = false
    private var lifecycle = Lifecycle.active
    private var lastSequence = 0
    /// Writes their caller is sending itself; a drain leaves them, and the traits behind them,
    /// alone until the caller settles them.
    private var claimedKeys: Set<String> = []
    private var activeEnqueues = 0
    private var enqueueWaiters: [CheckedContinuation<Void, Never>] = []
    /// Millisecond epoch before which the server asked, through `Retry-After`, to be sent nothing.
    /// ``endBackoff()`` ends the outbox's own backoff early, never this.
    private var retryAfterDeadline: Double = 0
    /// Counts the calls to ``endBackoff()``. A drain whose count is behind started before the
    /// caller's evidence that the backend may be reachable again.
    private var backoffEndings = 0

    /// - Parameters:
    ///   - store: Durable backing store; survives process death.
    ///   - clock: Time source for the backoff.
    ///   - diagnostics: Receives `PERSON_WRITE_REJECTED` when a write is dropped.
    public init(
        store: any RecordStore,
        clock: any VoidhashClock = SystemVoidhashClock(),
        diagnostics: DiagnosticEmitter = DiagnosticEmitter(nil)
    ) {
        self.store = store
        self.clock = clock
        self.diagnostics = diagnostics
    }

    /// Queues `write`, due immediately, and persists it before returning.
    ///
    /// A write queued under the key of one already waiting is merged into it and keeps its place:
    /// traits take the newer value per key, an identify the newer email and name.
    ///
    /// - Parameter claim: The caller sends the write itself and settles it with
    ///   ``remove(_:)`` or ``release(_:after:)``; until then a drain skips it.
    /// - Returns: The write as queued, to settle it with.
    @discardableResult
    public func enqueue(_ write: PersonWrite, claim: Bool = false) async -> PersonWrite {
        return await enqueue(write, claimIf: { _ in claim }).queued
    }

    /// Queues `write` and claims it for the caller to send, unless a write describing the same
    /// person is queued or being sent already: then `write` queues behind it, for the drain to
    /// deliver in order.
    ///
    /// Deciding and queuing in one step is what keeps two quick writes for one person from both
    /// being sent directly, where the older could land last.
    ///
    /// - Returns: The claimed write to send and settle with ``remove(_:)`` or
    ///   ``release(_:after:)``, or `nil` when the drain delivers it.
    public func enqueueClaimingIfFirst(_ write: PersonWrite) async -> PersonWrite? {
        let target = write.target
        // A revocation goes after every other write for its person anyway, and may wait for days.
        let result = await enqueue(
            write,
            claimIf: { records in
                !records.contains { $0.target == target && $0.kind != .adDataSharingRevocation }
            })
        return result.claimed ? result.queued : nil
    }

    private func enqueue(
        _ write: PersonWrite, claimIf shouldClaim: ([PersonWrite]) -> Bool
    ) async -> (queued: PersonWrite, claimed: Bool) {
        activeEnqueues += 1
        defer { finishEnqueue() }
        await loadIfNeeded()
        await persistIfNeeded()
        let claim = shouldClaim(records)
        let index = records.firstIndex { $0.key == write.key }
        var queued = index.map { PersonWriteOutbox.merge(records[$0], into: write) } ?? write
        lastSequence += 1
        queued.attempts = 0
        queued.availableAt = clock.now()
        queued.sequence = lastSequence
        if let index {
            records[index] = queued
        } else {
            records.append(queued)
        }
        if claim {
            claimedKeys.insert(queued.key)
        }
        if storeReadFailed || lifecycle == .retired {
            // The file cannot be rewritten without seeing it, and after retirement it belongs to
            // the replacement, but appending is safe either way: a load keeps the last line per
            // key.
            if let line = PersonWriteOutbox.encodeLine(queued),
                !(await store.append([line]))
            {
                needsPersist = true
            }
        } else {
            await persist()
        }
        return (queued, claim)
    }

    /// Queues taking the agreement of the person `target` back, due immediately, and persists it
    /// before returning. One already queued keeps its age and its wait.
    ///
    /// An agreement still queued for the person goes: sent after the revocation, it would undo it.
    public func enqueueAdDataSharingRevocation(for target: String) async {
        activeEnqueues += 1
        defer { finishEnqueue() }
        await loadIfNeeded()
        await persistIfNeeded()
        let timestamp = clock.now()
        for index in records.indices.reversed()
        where records[index].kind == .traits && records[index].target == target {
            records[index].traits[PersonWrite.adDataSharingTrait] = nil
            if records[index].traits.isEmpty {
                records.remove(at: index)
            }
        }
        var revocation = PersonWrite.adDataSharingRevocation(for: target, queuedAt: timestamp)
        let isQueued = records.contains { $0.key == revocation.key }
        if !isQueued {
            lastSequence += 1
            revocation.sequence = lastSequence
            records.append(revocation)
        }
        if storeReadFailed || lifecycle == .retired {
            if !isQueued, let line = PersonWriteOutbox.encodeLine(revocation),
                !(await store.append([line]))
            {
                needsPersist = true
            }
        } else {
            await persist()
        }
    }

    /// Drops the revocation queued for the person `target`, who agreed again; it would otherwise
    /// take the new agreement back. It does not wait for a drain in flight, which can take as
    /// long as its requests do: a drain that reaches the revocation afterwards finds it gone.
    ///
    /// - Returns: Whether a drain in flight may be sending the revocation right now. The
    ///   agreement then has to be queued for the drain, which delivers it once that send is
    ///   over: sent by its caller meanwhile, it could land first and be taken back.
    @discardableResult
    public func cancelAdDataSharingRevocation(for target: String) async -> Bool {
        await loadIfNeeded()
        let count = records.count
        records.removeAll { $0.kind == .adDataSharingRevocation && $0.target == target }
        guard records.count != count else {
            return false
        }
        let mayBeInFlight = inFlightDrain != nil
        await persist()
        return mayBeInFlight
    }

    /// Settles `sent`, a claimed or drained write its caller delivered, or that the API refused
    /// with a verdict the caller reports itself.
    ///
    /// What was merged into the queued write while `sent` was in flight stays queued.
    public func remove(_ sent: PersonWrite) async {
        claimedKeys.remove(sent.key)
        await loadIfNeeded()
        if removeSent(sent) {
            await persist()
        }
    }

    /// Hands `sent`, a write its caller claimed, back to the drain after the caller's send
    /// failed without a verdict.
    ///
    /// A failure the backend answered, or that says it is struggling, backs the write off. One
    /// that sent nothing (a cancelled caller, a paused gate, an open circuit) or a rejected key
    /// leaves it due for whichever trigger comes next.
    public func release(_ sent: PersonWrite, after error: any Error) async {
        claimedKeys.remove(sent.key)
        if error is CancellationError {
            return
        }
        if let apiError = error as? VoidhashApiError,
            apiError.isAuthFailure || apiError.isRefusedLocally
        {
            return
        }
        postpone(sent, after: error)
        await persist()
    }

    /// The first queued identify linking an alias onto `target`.
    public func pendingIdentify(target: String) async -> PersonWrite? {
        await loadIfNeeded()
        return records.first { $0.kind == .identify && $0.target == target }
    }

    /// Whether a write describing `target` is queued: an identify linking onto it, or traits for
    /// it. A new write for that person has to queue behind it.
    public func hasPendingWrite(for target: String) async -> Bool {
        await loadIfNeeded()
        return records.contains { $0.target == target && $0.kind != .adDataSharingRevocation }
    }

    /// Whether a write could be sent now: one is due and nobody is sending it already.
    public func hasDueWrites() async -> Bool {
        guard let nextAttemptAt = await nextAttemptAt() else {
            return false
        }
        return nextAttemptAt <= clock.now()
    }

    /// Millisecond epoch from which a drain has something to send, or `nil` when nothing it
    /// could send is queued, or the store cannot be read: a drain sends nothing until a load
    /// succeeds, which a foreground, connectivity coming back or a flush retries.
    ///
    /// Traits waiting for an identify of their person are covered by that identify's time.
    public func nextAttemptAt() async -> Double? {
        await loadIfNeeded()
        guard !storeReadFailed, lifecycle == .active else {
            return nil
        }
        let timestamp = clock.now()
        let identifyTargets = Set(records.filter { $0.kind == .identify }.map(\.target))
        return
            records
            .filter { write in
                !claimedKeys.contains(write.key) && !waitsForSentTraits(write)
                    && (write.kind == .identify || !identifyTargets.contains(write.target))
            }
            .map { isDue($0, now: timestamp) ? timestamp : $0.availableAt }
            .min()
    }

    /// Every queued write, in queue order.
    public func pendingWrites() async -> [PersonWrite] {
        await loadIfNeeded()
        return records
    }

    /// Makes every write waiting out the retry backoff due now, for a caller with fresh evidence
    /// that the backend may be reachable again (a flush, a foreground, connectivity coming back).
    /// One the server asked to hold back through `Retry-After` waits until the time it gave.
    ///
    /// It does not wait for a drain in flight, which can take as long as its requests do. That
    /// drain's sends predate the evidence, so a failure it records afterwards leaves the write
    /// due instead of backing it off again, or the caller's drain would skip it.
    ///
    /// A revocation waiting for its person keeps its wait: that evidence does not make the person
    /// exist.
    public func endBackoff() async {
        backoffEndings += 1
        await loadIfNeeded()
        for index in records.indices
        where records[index].availableAt > retryAfterDeadline
            && records[index].waitsForPerson != true
        {
            records[index].availableAt = retryAfterDeadline
        }
    }

    /// Takes every queued agreement to sharing with ad platforms (`$ad_data_sharing` other than
    /// `false`) out of the queue, for an end user who withdrew the analytics consent it needs.
    /// The other traits queued with it stay; a write holding nothing else is dropped.
    ///
    /// A traits request already in flight still settles; one the store cannot be rewritten
    /// without yet stays on disk until a load succeeds, and its sender decides what to send.
    public func discardAdDataSharingAgreements() async {
        await loadIfNeeded()
        var changed = false
        for index in records.indices.reversed() where records[index].kind == .traits {
            guard let sharing = records[index].traits[PersonWrite.adDataSharingTrait],
                sharing != .bool(false)
            else {
                continue
            }
            changed = true
            records[index].traits[PersonWrite.adDataSharingTrait] = nil
            if records[index].traits.isEmpty {
                records.remove(at: index)
            }
        }
        if changed {
            await persist()
        }
    }

    /// Hands the file over to a replacing outbox over the same store.
    ///
    /// Cancels an in-flight drain, waits for it and for writes being queued, and writes anything
    /// still unwritten. Afterwards the outbox sends nothing and never rewrites the store: a later
    /// write only appends, so a replacement that has loaded the file keeps what it holds.
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
        if activeEnqueues > 0 {
            await withCheckedContinuation { enqueueWaiters.append($0) }
        }
        await persistIfNeeded()
        lifecycle = .retired
    }

    /// Sends every due write, identifies first, removing the ones the backend applies.
    ///
    /// Traits for a person go only after every identify linking onto that person was delivered
    /// in the same pass, so the merge lands before them; traits that have to wait keep their
    /// retry state. A transient failure backs the write off and keeps it. A rejected key or an
    /// open circuit stops the drain without spending an attempt. A verdict the API will repeat
    /// drops the write with a diagnostic, except its "no such person" answer to traits, which is
    /// backed off like a transient failure: an identify, an event or a receipt can still create
    /// that person.
    ///
    /// One drain runs at a time. A caller arriving while one is in flight waits for it and then
    /// runs its own, so a write queued after the running drain took its snapshot is attempted.
    @discardableResult
    public func drain(identify: @escaping Send, setTraits: @escaping Send) async
        -> PersonWriteDrainResult
    {
        // Yields on every lap: awaiting an already-completed task continues inline without
        // yielding the actor, which would starve the continuation that nils the handle.
        while let inFlightDrain {
            await Task.yield()
            _ = await inFlightDrain.value
        }
        let task = Task { await self.runDrain(identify: identify, setTraits: setTraits) }
        inFlightDrain = task
        defer { inFlightDrain = nil }
        return await task.value
    }

    private func runDrain(identify: Send, setTraits: Send) async -> PersonWriteDrainResult {
        await loadIfNeeded()
        if storeReadFailed, clock.monotonicNow() >= reloadAllowedAt {
            await performLoad()
        }
        await persistIfNeeded()
        guard !storeReadFailed, lifecycle == .active else {
            return PersonWriteDrainResult(pending: records.count)
        }

        let timestamp = clock.now()
        let backoffEndingsAtStart = backoffEndings
        let queued =
            records.filter { $0.kind == .identify } + records.filter { $0.kind == .traits }
            + records.filter { $0.kind == .adDataSharingRevocation }
        var awaitingIdentify: Set<String> = []
        var delivered = 0
        var stoppedByRefusal = false
        var rejectedIdentifyTargets: Set<String> = []
        var mutated = false
        for write in queued {
            if claimedKeys.contains(write.key) || waitsForSentTraits(write)
                || !isDue(write, now: timestamp)
                || (write.kind != .identify && awaitingIdentify.contains(write.target))
            {
                if write.kind == .identify {
                    awaitingIdentify.insert(write.target)
                }
                continue
            }
            // Send what is queued now: a merge since the pass started makes it newer.
            guard let record = records.first(where: { $0.key == write.key }) else {
                continue
            }
            do {
                switch record.kind {
                case .identify:
                    try await identify(record)
                case .traits, .adDataSharingRevocation:
                    try await setTraits(record)
                }
                removeSent(record)
                delivered += 1
                mutated = true
            } catch is CancellationError {
                // Not evidence about the backend: the write keeps its slot untouched.
                break
            } catch let error as VoidhashApiError
                where error.isAuthFailure || error.isRefusedLocally
            {
                stoppedByRefusal = true
                break
            } catch {
                mutated = true
                if isRejection(error, of: record) {
                    reject(record, error: error)
                    if record.kind == .identify {
                        rejectedIdentifyTargets.insert(record.target)
                    }
                } else {
                    postpone(
                        record, after: error,
                        predatingBackoffEnd: backoffEndings != backoffEndingsAtStart)
                    if record.kind == .identify {
                        awaitingIdentify.insert(record.target)
                    }
                }
            }
        }

        if mutated {
            await persist()
        }
        return PersonWriteDrainResult(
            delivered: delivered, pending: records.count, stoppedByRefusal: stoppedByRefusal,
            rejectedIdentifyTargets: rejectedIdentifyTargets)
    }

    /// Whether `error` is the API's verdict that `write` can never apply as sent.
    ///
    /// A request that could not even be built is one too. "No such person" is not one for
    /// traits, whose person can still be created.
    private func isRejection(_ error: any Error, of write: PersonWrite) -> Bool {
        guard let apiError = error as? VoidhashApiError else {
            return false
        }
        if apiError.isLocal {
            return true
        }
        return apiError.isVerdict
            && !(write.kind != .identify && apiError.tag == VoidhashApiError.personNotFoundTag)
    }

    /// Whether `write` is due at `now`. A revocation waiting for its person legitimately waits for
    /// up to a day, longer than the ceiling other writes are held to.
    private func isDue(_ write: PersonWrite, now: Double) -> Bool {
        return write.kind == .adDataSharingRevocation
            ? NetworkPolicy.isDue(
                write.availableAt, now: now,
                ceiling: PersonWriteOutbox.revocationLifetimeMilliseconds)
            : NetworkPolicy.isDue(write.availableAt, now: now)
    }

    /// Whether `write` is a revocation whose person has traits being sent by their caller: an
    /// agreement among them has to land first.
    private func waitsForSentTraits(_ write: PersonWrite) -> Bool {
        return write.kind == .adDataSharingRevocation
            && claimedKeys.contains(PersonWrite.traits([:], for: write.target).key)
    }

    private func reject(_ write: PersonWrite, error: any Error) {
        guard removeSent(write) else {
            return
        }
        let apiError = error as? VoidhashApiError
        diagnostics.emit(
            .eviction, code: "PERSON_WRITE_REJECTED", operation: "person.drain",
            httpStatus: apiError?.statusCode,
            message: "Dropped a queued \(write.kind.rawValue) write for \(write.target): \(error)")
    }

    /// Removes what `sent` carried from the queue. The write is removed outright only while it
    /// still carries the sequence that was sent. One merged into since keeps whatever the send
    /// did not cover: traits whose value changed or that were added, or an identify whose email
    /// or name changed. Returns whether anything was removed.
    @discardableResult
    private func removeSent(_ sent: PersonWrite) -> Bool {
        guard let index = records.firstIndex(where: { $0.key == sent.key }) else {
            return false
        }
        let live = records[index]
        if live.sequence == sent.sequence {
            records.remove(at: index)
            return true
        }
        switch live.kind {
        case .traits:
            let unsent = live.traits.filter { key, value in sent.traits[key] != value }
            if unsent.count == live.traits.count {
                return false
            }
            if unsent.isEmpty {
                records.remove(at: index)
            } else {
                records[index].traits = unsent
            }
            return true
        case .identify:
            guard live.email == sent.email, live.name == sent.name else {
                return false
            }
            records.remove(at: index)
            return true
        case .adDataSharingRevocation:
            records.remove(at: index)
            return true
        }
    }

    /// Backs off the queued write `sent` was taken from, by the server's `Retry-After` when it
    /// sent one. A write merged into since the send started carries newer data and stays due.
    ///
    /// - Parameter predatingBackoffEnd: The send started before a call to ``endBackoff()``, so
    ///   its failure is older than that caller's evidence: the write is left as that call would
    ///   have left it, due unless the server asked for a wait.
    private func postpone(
        _ sent: PersonWrite, after error: any Error, predatingBackoffEnd: Bool = false
    ) {
        guard let index = records.firstIndex(where: { $0.key == sent.key }),
            records[index].sequence == sent.sequence
        else {
            return
        }
        records[index].attempts += 1
        let timestamp = clock.now()
        if records[index].kind == .adDataSharingRevocation,
            (error as? VoidhashApiError)?.tag == VoidhashApiError.personNotFoundTag
        {
            let queuedAt = records[index].queuedAt ?? timestamp
            let lastAttemptAt = queuedAt + PersonWriteOutbox.revocationLifetimeMilliseconds
            guard timestamp < lastAttemptAt else {
                records.remove(at: index)
                return
            }
            let wait = max(PersonWriteOutbox.revocationMinWaitMilliseconds, timestamp - queuedAt)
            records[index].availableAt = min(timestamp + wait, lastAttemptAt)
            records[index].waitsForPerson = true
            return
        }
        records[index].waitsForPerson = nil
        let retryAfter = (error as? VoidhashApiError)?.retryAfterMilliseconds
        if let retryAfter {
            retryAfterDeadline = max(retryAfterDeadline, timestamp + retryAfter)
        }
        records[index].availableAt =
            timestamp
            + (retryAfter
                ?? NetworkPolicy.backoffMilliseconds(
                    attempt: records[index].attempts,
                    cap: NetworkPolicy.queueBackoffCapMilliseconds))
        if predatingBackoffEnd, records[index].availableAt > retryAfterDeadline {
            records[index].availableAt = retryAfterDeadline
        }
    }

    /// `newer`, queued under the key of `older`, with what it leaves unset taken from `older`.
    private static func merge(_ older: PersonWrite, into newer: PersonWrite) -> PersonWrite {
        var merged = newer
        switch newer.kind {
        case .traits:
            merged.traits = older.traits.merging(newer.traits) { _, newest in newest }
        case .identify:
            merged.email = newer.email ?? older.email
            merged.name = newer.name ?? older.name
        case .adDataSharingRevocation:
            break
        }
        return merged
    }

    // The load is held as a task rather than guarded by a flag: awaiting the store suspends the
    // actor, and a write queued in that window would otherwise be overwritten by the load.
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
        if loaded.readFailed {
            reloadAllowedAt = clock.monotonicNow() + NetworkPolicy.queueBackoffCapMilliseconds
        }
        let decoder = JSONDecoder()
        var persisted: [PersonWrite] = []
        for line in loaded.lines {
            guard let write = try? decoder.decode(PersonWrite.self, from: Data(line.utf8)) else {
                diagnostics.emit(
                    .eviction, code: "QUEUE_RECORD_DROPPED", operation: "person.load",
                    message: "Dropped a persisted person write that could not be decoded")
                continue
            }
            // Appended after a failed read, a later line for the same key is the newer write.
            if let index = persisted.firstIndex(where: { $0.key == write.key }) {
                persisted[index] = write
            } else {
                persisted.append(write)
            }
        }
        lastSequence = max(lastSequence, persisted.map(\.sequence).max() ?? 0)
        // Writes queued in memory after a failed read are newer than the file. A merged write gets
        // a new sequence, so a send of the in-memory one still in flight cannot settle away what
        // came from disk.
        for live in records {
            if let index = persisted.firstIndex(where: { $0.key == live.key }) {
                lastSequence += 1
                var merged = PersonWriteOutbox.merge(persisted[index], into: live)
                merged.sequence = lastSequence
                persisted[index] = merged
            } else {
                persisted.append(live)
            }
        }
        records = persisted
    }

    /// Rewrites the store from `records`.
    private func persist() async {
        // Rewriting the file off a failed read would delete writes the load never saw; they stay
        // in memory (and on disk) until a later load succeeds. A retired outbox's file belongs to
        // its replacement.
        guard !storeReadFailed, lifecycle != .retired else {
            return
        }
        let lines = records.compactMap(PersonWriteOutbox.encodeLine)
        needsPersist = !(await store.replace(with: lines))
    }

    private func persistIfNeeded() async {
        if needsPersist {
            await persist()
        }
    }

    private func finishEnqueue() {
        activeEnqueues -= 1
        guard activeEnqueues == 0 else {
            return
        }
        let waiters = enqueueWaiters
        enqueueWaiters.removeAll()
        waiters.forEach { $0.resume() }
    }

    private static func encodeLine(_ write: PersonWrite) -> String? {
        guard let data = try? JSONEncoder().encode(write) else {
            return nil
        }
        return String(decoding: data, as: UTF8.self)
    }
}
