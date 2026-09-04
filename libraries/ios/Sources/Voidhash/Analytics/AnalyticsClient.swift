import Foundation
import VoidhashCore

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

/// Outcome of an ``AnalyticsClient/flush()``.
public struct FlushStatus: Sendable, Equatable {
    /// Events the backend acknowledged during this flush.
    public let flushed: Int
    /// Events still waiting in the queue, including postponed ones.
    public let pending: Int
    /// Description of the last failure, when the flush did not fully drain the queue.
    public let lastError: String?

    public init(flushed: Int, pending: Int, lastError: String? = nil) {
        self.flushed = flushed
        self.pending = pending
        self.lastError = lastError
    }
}

/// Durable, batching analytics capture queue.
///
/// Events are appended to a persistent newline-delimited store as they are captured, batched (20
/// per request, flushed every 5 seconds) and removed only once the backend acknowledges them.
/// Transport failures postpone a batch with jittered exponential backoff and never drop it: the
/// only reasons an event is lost are the queue cap and a non-retryable server verdict. A `413`
/// splits the batch in half; a `401`/`403` pauses outbound traffic for the process without
/// touching the queue.
public actor AnalyticsClient {
    /// Maximum number of events sent in one request.
    public static let batchSize = 20
    /// Interval of the background flush loop.
    public static let flushIntervalMilliseconds: Double = 5000
    /// Network attempts per flush before a batch is postponed for a later trigger.
    public static let maxSendAttempts = 1
    /// Upper bound of the exponential backoff between queue retries.
    public static let maxRetryDelayMilliseconds: Double = 30_000
    /// Events retained before the oldest are evicted.
    public static let maxQueuedEvents = 1000
    /// Captures buffered in memory before the queue is written through.
    public static let persistBehindEventCount = 20
    /// Longest a capture waits before the queue is written through.
    public static let persistBehindDelayMilliseconds: Double = 250
    struct QueuedEvent: Sendable, Equatable, Codable {
        let id: String
        let name: String
        let properties: [String: JSONValue]
        let timestamp: String
        let sessionId: String
        /// Distinct id at capture time, so an event queued before an `identify` or `reset` is
        /// still attributed to the identity it happened under. `nil` only for records written
        /// before the id was persisted, which take the current id when sent.
        let distinctId: String?
        var attempts: Int
        var availableAt: Double
        /// Capture order. Postponing a batch puts it back at the head of the queue, and a `413`
        /// split postpones the halves out of order, so FIFO is restored from this rather than
        /// from the position events happen to land in.
        var sequence: Int

        private enum CodingKeys: String, CodingKey {
            case id, name, properties, timestamp, sessionId, distinctId, attempts, availableAt
            case sequence
        }

        init(
            id: String, name: String, properties: [String: JSONValue], timestamp: String,
            sessionId: String, distinctId: String?, attempts: Int, availableAt: Double,
            sequence: Int
        ) {
            self.id = id
            self.name = name
            self.properties = properties
            self.timestamp = timestamp
            self.sessionId = sessionId
            self.distinctId = distinctId
            self.attempts = attempts
            self.availableAt = availableAt
            self.sequence = sequence
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            id = try container.decode(String.self, forKey: .id)
            name = try container.decode(String.self, forKey: .name)
            properties = try container.decode([String: JSONValue].self, forKey: .properties)
            timestamp = try container.decode(String.self, forKey: .timestamp)
            sessionId = try container.decode(String.self, forKey: .sessionId)
            distinctId = try container.decodeIfPresent(String.self, forKey: .distinctId)
            attempts = try container.decode(Int.self, forKey: .attempts)
            availableAt = try container.decode(Double.self, forKey: .availableAt)
            // Queues written before ordering was explicit fall back to file order.
            sequence = try container.decodeIfPresent(Int.self, forKey: .sequence) ?? 0
        }
    }

    private struct SendFailure: Error {
        let message: String
        let retryable: Bool
        let retryAfterMilliseconds: Double?
        let statusCode: Int?
        /// The batch could not be turned into JSON at all, so no status code was ever involved.
        var isUnencodable = false
    }

    private struct InFlightFlush {
        let id: Int
        let task: Task<FlushStatus, Never>
    }

    private static let outboundPausedMessage =
        "Outbound traffic is paused: the publishable key was rejected"

    private let publishableKey: String
    private let ingestUrl: URL
    private let session: URLSession
    private let distinctIdProvider: @Sendable () async -> String
    private let sessionIdProvider: @Sendable () async -> String
    private let standardProperties: [String: JSONValue]
    private let now: @Sendable () -> Double
    private let sleep: @Sendable (Double) async -> Void
    private let makeEventId: @Sendable () -> String
    private let debug: Bool
    private let warn: VoidhashWarningHandler

    private let store: any RecordStore
    private let diagnostics: DiagnosticEmitter
    private let gate: OutboundGate
    private let breaker: CircuitBreaker?
    private let breakerHost: String

    private var queue: [QueuedEvent] = []
    private var flushTask: Task<Void, Never>?
    private var inFlightFlush: InFlightFlush?
    private var nextFlushId = 0
    private var persistTask: Task<Void, Never>?
    private var loadTask: Task<Void, Never>?
    private var appendTask: Task<Bool, Never>?
    private var unpersistedCount = 0
    private var nextSequence = 0
    /// Whether the in-memory queue has diverged from the file in a way an append cannot fix
    /// (a send removed events, a postponement moved them, an eviction dropped the head). While
    /// clear and nothing is unpersisted, the file already holds the queue and the periodic
    /// flush must not rewrite it every 5 seconds.
    private var queueDirty = false
    /// The last load could not read the store, so the file must not be rewritten: doing so would
    /// delete events the load never saw. Cleared by a later successful load.
    private var storeReadFailed = false

    /// - Parameters:
    ///   - publishableKey: Project publishable key, sent as `token` in the batch body.
    ///   - ingestUrl: Origin of the ingest endpoint (`ingestUrl ?? baseUrl`).
    ///   - session: URLSession used for the batch requests.
    ///   - distinctIdProvider: Returns the distinct id stamped on an event as it is queued.
    ///   - sessionIdProvider: Returns the session id stamped on an event as it is queued.
    ///     Defaults to one id per client instance.
    ///   - standardProperties: `$`-prefixed properties merged into every event, see
    ///     ``standardProperties(device:sdkVersion:)``.
    ///   - now: Millisecond epoch clock, injectable for tests.
    ///   - sleep: Suspends for a number of milliseconds, injectable for tests.
    ///   - makeEventId: Event uuid factory, injectable for tests.
    ///   - store: Persistence for the queue. Defaults to memory only, which is what an embedded
    ///     host that owns its own durability wants.
    ///   - gate: Shared outbound switch, closed when the publishable key is rejected; while it is
    ///     closed the queue is kept but nothing is sent.
    ///   - breaker: Shared host circuit breaker. Omit only for a standalone embedded client.
    ///   - diagnostics: Receives eviction, transport and auth diagnostics.
    ///   - debug: Whether to print verbose diagnostics. Dropped batches warn either way.
    ///   - warn: Receives the dropped-batch diagnostics.
    public init(
        publishableKey: String,
        ingestUrl: URL,
        session: URLSession = NetworkPolicy.defaultSession,
        distinctIdProvider: @escaping @Sendable () async -> String,
        sessionIdProvider: (@Sendable () async -> String)? = nil,
        standardProperties: [String: JSONValue] = [:],
        now: @escaping @Sendable () -> Double = { Date().timeIntervalSince1970 * 1000 },
        sleep: @escaping @Sendable (Double) async -> Void = { milliseconds in
            try? await Task.sleep(nanoseconds: UInt64(milliseconds * 1_000_000))
        },
        makeEventId: @escaping @Sendable () -> String = { UUID().uuidString.lowercased() },
        store: (any RecordStore)? = nil,
        gate: OutboundGate = OutboundGate(),
        breaker: CircuitBreaker? = nil,
        diagnostics: DiagnosticEmitter = DiagnosticEmitter(nil),
        debug: Bool = false,
        warn: @escaping VoidhashWarningHandler = VoidhashWarnings.standard
    ) {
        self.publishableKey = publishableKey
        self.ingestUrl = ingestUrl
        self.session = session
        self.distinctIdProvider = distinctIdProvider
        let instanceSessionId = UUID().uuidString.lowercased()
        self.sessionIdProvider = sessionIdProvider ?? { instanceSessionId }
        self.standardProperties = standardProperties
        self.now = now
        self.sleep = sleep
        self.makeEventId = makeEventId
        self.store = store ?? InMemoryRecordStore()
        self.gate = gate
        self.breaker = breaker
        breakerHost = "ingest:\(ingestUrl.host ?? ingestUrl.absoluteString)"
        self.diagnostics = diagnostics
        self.debug = debug
        self.warn = warn
    }

    /// Builds the standardized `$`-properties stamped on every event.
    ///
    /// Port of `src/core/analytics/utils.ts`: the same keys, with `$sdk`/`$platform` reporting
    /// this platform. They are merged over the caller's properties, so a caller cannot shadow
    /// them. `environment` is the SDK's environment mode, the same value sent as the
    /// `x-environment` header.
    public static func standardProperties(
        device: SdkDeviceInfo,
        sdkVersion: String,
        environment: String = "production",
        timezone: String? = TimeZone.current.identifier
    ) -> [String: JSONValue] {
        func text(_ value: String?) -> JSONValue {
            guard let value, !value.isEmpty else {
                return .null
            }
            return .string(value)
        }

        return [
            "$app_build": text(device.appBuild),
            "$app_name": text(device.appName ?? device.bundleId),
            "$app_version": text(device.appVersion),
            "$bundle_id": text(device.bundleId),
            "$device_brand": text(device.deviceBrand),
            "$device_name": text(device.deviceName),
            "$environment": .string(environment),
            "$locale": text(device.locales.first),
            "$platform": .string(SdkHeaders.platformName),
            "$platform_version": text(device.systemVersion),
            "$sdk": .string(SdkHeaders.sdkName),
            "$sdk_version": .string(sdkVersion),
            "$timezone": text(timezone),
        ]
    }

    /// Queues an event. Empty names are ignored and a full batch of due events starts a flush.
    ///
    /// The session and distinct ids are resolved here, when the event enters the queue, so a
    /// batch that sits in the queue across a session boundary or an `identify` still reports
    /// the session and identity it happened under. The flush a full batch triggers runs off the
    /// caller's task: a capture never waits on the network. Events postponed by a failed send do
    /// not count towards the batch, so a backlog held on backoff does not turn every capture
    /// into a request of its own.
    public func capture(_ eventName: String, properties: [String: JSONValue] = [:]) async {
        let normalized = eventName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else {
            return
        }

        await loadQueueIfNeeded()
        let sessionId = await sessionIdProvider()
        let distinctId = await distinctIdProvider()
        nextSequence += 1
        let event = QueuedEvent(
            id: makeEventId(),
            name: normalized,
            properties: properties,
            timestamp: AnalyticsClient.iso8601(now()),
            sessionId: sessionId,
            distinctId: distinctId,
            attempts: 0,
            availableAt: 0,
            sequence: nextSequence
        )
        queue.append(event)
        unpersistedCount += 1

        let overflow = queue.count - AnalyticsClient.maxQueuedEvents
        if overflow > 0 {
            queue.removeFirst(overflow)
            queueDirty = true
            diagnostics.emit(
                .eviction, code: "ANALYTICS_EVENT_DROPPED", operation: "analytics.capture",
                message:
                    "Dropped \(overflow) oldest analytics event(s); the queue is at its cap of \(AnalyticsClient.maxQueuedEvents)"
            )
            warn(
                "Dropped \(overflow) oldest analytics event(s) after reaching the queue cap")
            // The evicted head is still on disk, so the whole queue has to be rewritten.
            await persistQueue()
        } else if unpersistedCount >= AnalyticsClient.persistBehindEventCount {
            await appendPendingEvents()
        } else {
            schedulePersist()
        }

        if hasDueBatch() {
            Task { await self.flush() }
        }
    }

    private func hasDueBatch() -> Bool {
        let timestamp = now()
        var due = 0
        for event in queue where event.availableAt <= timestamp {
            due += 1
            if due >= AnalyticsClient.batchSize {
                return true
            }
        }
        return false
    }

    /// Number of events waiting in the queue.
    public func queueLength() async -> Int {
        await loadQueueIfNeeded()
        return queue.count
    }

    /// Snapshot of the queue, for tests that assert on what was captured.
    func queuedEvents() async -> [QueuedEvent] {
        await loadQueueIfNeeded()
        return queue
    }

    /// Drains the queue, sending every due batch.
    ///
    /// Only one flush ever runs at a time: a concurrent caller joins the running one instead of
    /// re-sending batches that are already in flight.
    @discardableResult
    public func flush() async -> FlushStatus {
        if let running = inFlightFlush {
            let result = await running.task.value
            if !gate.isPaused,
                result.pending > 0,
                result.lastError == AnalyticsClient.outboundPausedMessage
            {
                if inFlightFlush?.id == running.id {
                    inFlightFlush = nil
                }
                return await flush()
            }
            return result
        }
        nextFlushId += 1
        let id = nextFlushId
        let task = Task { await self.drain() }
        inFlightFlush = InFlightFlush(id: id, task: task)
        let result = await task.value
        if inFlightFlush?.id == id {
            inFlightFlush = nil
        }
        return result
    }

    private func drain() async -> FlushStatus {
        await loadQueueIfNeeded()
        if storeReadFailed {
            await performQueueLoad()
        }
        await appendPendingEvents()

        guard gate.allowsOutbound() else {
            return FlushStatus(
                flushed: 0, pending: queue.count,
                lastError: AnalyticsClient.outboundPausedMessage)
        }

        var flushed = 0
        var lastError: String?
        var batch = takeDueBatch()
        while !batch.isEmpty {
            let outcome = await processBatch(batch)
            flushed += outcome.delivered
            if let failure = outcome.failure {
                lastError = failure
            }
            if !gate.allowsOutbound() {
                break
            }
            batch = takeDueBatch()
        }
        // Postponed batches went back in at the head, and a `413` split can postpone the halves
        // in the wrong order; restoring capture order here keeps the queue FIFO.
        queue.sort { $0.sequence < $1.sequence }
        await persistQueue()
        return FlushStatus(flushed: flushed, pending: queue.count, lastError: lastError)
    }

    // MARK: - Persistence

    /// Writes any buffered captures through to the store. Called on flush and on backgrounding.
    public func persist() async {
        persistTask?.cancel()
        persistTask = nil
        await appendPendingEvents()
    }

    // The load is held as a task rather than guarded by a flag: awaiting the store suspends the
    // actor, and a capture arriving in that window would otherwise append to an empty queue that
    // the finishing load then overwrites, losing the event outright.
    private func loadQueueIfNeeded() async {
        if let loadTask {
            await loadTask.value
            return
        }
        let task = Task { await self.performQueueLoad() }
        loadTask = task
        await task.value
    }

    private func performQueueLoad() async {
        let loaded = await store.load()
        storeReadFailed = loaded.readFailed
        let decoder = JSONDecoder()
        var persisted = loaded.lines.compactMap { line in
            try? decoder.decode(QueuedEvent.self, from: Data(line.utf8))
        }
        if loaded.droppedPartialRecord {
            diagnostics.emit(
                .eviction, code: "ANALYTICS_EVENT_DROPPED", operation: "analytics.load",
                message: "Dropped a partially written event at the end of the persisted queue")
        }

        // Captures that landed while the read was in flight are newer than anything on disk and
        // are already counted in `unpersistedCount`, so they keep their place at the tail. After
        // a failed read the in-memory queue may already have been appended to the file, so the
        // same event can come back from disk; the in-memory copy wins.
        let staged = queue
        let stagedIds = Set(staged.map(\.id))
        persisted.removeAll { stagedIds.contains($0.id) }
        var sequence = 0
        persisted = persisted.map { event in
            sequence += 1
            var renumbered = event
            renumbered.sequence = sequence
            return renumbered
        }
        queue =
            persisted
            + staged.map { event in
                sequence += 1
                var renumbered = event
                renumbered.sequence = sequence
                return renumbered
            }
        nextSequence = sequence
    }

    // Fast path: only the captures not yet on disk are appended, so the capture path never
    // rewrites the whole file. Single-flighted, and the counter is only lowered once the store
    // confirms the write: a failed append leaves the events counted, so the next append (or the
    // next rewrite) carries them instead of losing them.
    private func appendPendingEvents() async {
        // Yields on every lap: awaiting an already-completed task continues inline without
        // yielding the actor, so a bare re-read loop would starve the very continuation that
        // nils the handle and spin forever.
        while let appendTask {
            await Task.yield()
            _ = await appendTask.value
        }
        guard unpersistedCount > 0 else {
            return
        }
        let pending = Array(queue.suffix(unpersistedCount))
        let lines = pending.compactMap(AnalyticsClient.encodeLine)
        let task = Task { await self.store.append(lines) }
        appendTask = task
        let succeeded = await task.value
        appendTask = nil
        if succeeded {
            unpersistedCount = max(unpersistedCount - pending.count, 0)
        }
    }

    // Slow path: the queue changed somewhere other than its tail (a send, a postponement, an
    // eviction), so the file is rewritten from the in-memory state. Skipped when the queue is
    // already on disk, so an idle periodic flush costs no write.
    private func persistQueue() async {
        // Yields on every lap (see `appendPendingEvents`): without it the loop can starve the
        // continuation that nils the handle and spin on a completed task forever.
        while let appendTask {
            await Task.yield()
            _ = await appendTask.value
        }
        // Rewriting the file off a failed read would delete events the load never saw; new
        // captures keep being appended and the rewrite waits for a load that succeeds.
        guard !storeReadFailed else {
            await appendPendingEvents()
            return
        }
        guard queueDirty || unpersistedCount > 0 else {
            return
        }
        unpersistedCount = 0
        queueDirty = false
        await store.replace(with: queue.compactMap(AnalyticsClient.encodeLine))
    }

    private func schedulePersist() {
        guard persistTask == nil else {
            return
        }
        // Deliberately not the injected `sleep`: that one exists to make retry backoff
        // deterministic in tests, and the write-behind window is not part of any assertion.
        persistTask = Task { [weak self] in
            try? await Task.sleep(
                nanoseconds: UInt64(AnalyticsClient.persistBehindDelayMilliseconds * 1_000_000))
            guard let self, !Task.isCancelled else {
                return
            }
            await self.completeScheduledPersist()
        }
    }

    private func completeScheduledPersist() async {
        persistTask = nil
        await appendPendingEvents()
    }

    private static func encodeLine(_ event: QueuedEvent) -> String? {
        guard let data = try? JSONEncoder().encode(event) else {
            return nil
        }
        return String(decoding: data, as: UTF8.self)
    }

    /// Starts the periodic flush loop. Idempotent.
    public func startAutoFlush() {
        guard flushTask == nil else {
            return
        }
        flushTask = Task { [weak self] in
            while !Task.isCancelled {
                guard let self else { return }
                await self.sleepForFlushInterval()
                if Task.isCancelled { return }
                await self.flush()
            }
        }
    }

    /// Whether the periodic flush loop is running.
    public func isAutoFlushing() -> Bool {
        return flushTask != nil
    }

    /// Stops the periodic flush loop.
    public func stopAutoFlush() {
        flushTask?.cancel()
        flushTask = nil
    }

    private func sleepForFlushInterval() async {
        await sleep(AnalyticsClient.flushIntervalMilliseconds)
    }

    private func takeDueBatch() -> [QueuedEvent] {
        let timestamp = now()
        var batch: [QueuedEvent] = []
        var cutoff = 0

        for event in queue {
            if event.availableAt > timestamp {
                break
            }
            batch.append(event)
            cutoff += 1
            if batch.count >= AnalyticsClient.batchSize {
                break
            }
        }

        if !batch.isEmpty {
            queue.removeFirst(cutoff)
            queueDirty = true
        }
        return batch
    }

    private struct BatchOutcome {
        var delivered = 0
        var failure: String?
    }

    private func processBatch(_ batch: [QueuedEvent]) async -> BatchOutcome {
        let permit: CircuitBreakerPermit?
        if let breaker {
            guard let acquired = await breaker.acquire(host: breakerHost) else {
                let delay = NetworkPolicy.backoffMilliseconds(
                    attempt: (batch.first?.attempts ?? 0) + 1,
                    cap: AnalyticsClient.maxRetryDelayMilliseconds)
                postpone(batch, availableAt: now() + delay)
                return BatchOutcome(failure: "The analytics circuit is open")
            }
            permit = acquired
        } else {
            permit = nil
        }

        do {
            try await sendWithInlineRetry(batch)
            if let breaker, let permit {
                await breaker.release(permit, retryableFailure: nil)
            }
            return BatchOutcome(delivered: batch.count)
        } catch is CancellationError {
            if let breaker, let permit {
                await breaker.abandon(permit)
            }
            // Shutdown is not a verdict on the batch: put it straight back so the next flush,
            // in this process or the next, picks it up.
            postpone(batch, availableAt: 0)
            return BatchOutcome(failure: "The flush was cancelled")
        } catch let failure as SendFailure {
            if let breaker, let permit {
                await breaker.release(
                    permit,
                    retryableFailure: failure.isUnencodable
                        ? false
                        : NetworkPolicy.countsTowardsCircuitBreaker(
                            statusCode: failure.statusCode))
            }
            // An event that cannot be represented as JSON poisons whatever batch it is in, so
            // the batch is halved until the offender is alone and only it is dropped.
            if failure.isUnencodable && batch.count > 1 {
                let midpoint = (batch.count + 1) / 2
                let head = await processBatch(Array(batch[..<midpoint]))
                let tail = await processBatch(Array(batch[midpoint...]))
                return BatchOutcome(
                    delivered: head.delivered + tail.delivered,
                    failure: tail.failure ?? head.failure)
            }

            if failure.isUnencodable {
                let name = batch.first?.name ?? "?"
                warn("Dropping the analytics event \"\(name)\": it cannot be encoded as JSON")
                diagnostics.emit(
                    .eviction, code: "ANALYTICS_EVENT_DROPPED", operation: "analytics.flush",
                    message: "Dropped the event \"\(name)\": it cannot be encoded as JSON")
                return BatchOutcome(failure: failure.message)
            }

            if failure.statusCode == 413 && batch.count > 1 {
                let midpoint = (batch.count + 1) / 2
                let head = await processBatch(Array(batch[..<midpoint]))
                let tail = await processBatch(Array(batch[midpoint...]))
                return BatchOutcome(
                    delivered: head.delivered + tail.delivered,
                    failure: tail.failure ?? head.failure)
            }

            if failure.statusCode == 413 {
                warn("Dropping analytics event after 413 response")
                diagnostics.emit(
                    .eviction, code: "ANALYTICS_EVENT_DROPPED", operation: "analytics.flush",
                    httpStatus: 413,
                    message: "Dropped a single analytics event the server refused as too large")
                return BatchOutcome(failure: failure.message)
            }

            // A rejected key is a configuration error, not an outage: keep every event, stop
            // sending for now and let the next foreground read surface it. The gate reopens on a
            // successful probe, so a transient 403 recovers on its own.
            if NetworkPolicy.isAuthFailure(statusCode: failure.statusCode) {
                gate.pause(now: now())
                postpone(batch, availableAt: now())
                diagnostics.emit(
                    .auth, code: "AUTHENTICATION_FAILED", operation: "analytics.flush",
                    httpStatus: failure.statusCode,
                    message:
                        "The publishable key was rejected; queued analytics are kept and sending is paused"
                )
                warn("Pausing analytics: \(failure.message)")
                return BatchOutcome(failure: failure.message)
            }

            if failure.retryable {
                let delay =
                    NetworkPolicy.clampRetryAfter(
                        failure.retryAfterMilliseconds,
                        cap: AnalyticsClient.maxRetryDelayMilliseconds)
                    ?? NetworkPolicy.backoffMilliseconds(
                        attempt: (batch.first?.attempts ?? 0) + 1,
                        cap: AnalyticsClient.maxRetryDelayMilliseconds)
                postpone(batch, availableAt: now() + delay)
                diagnostics.emit(
                    .transport, code: "ANALYTICS_SEND_FAILED", operation: "analytics.flush",
                    retryable: true, httpStatus: failure.statusCode, message: failure.message)
                return BatchOutcome(failure: failure.message)
            }

            // The server rejected the batch with a verdict it will repeat. Identity writes are
            // ordinary FIFO queue members and follow the same rule on every SDK.
            let message =
                "Dropping \(batch.count) analytics event(s): \(failure.statusCode.map { "non-retryable response: \($0)" } ?? failure.message)"
            warn(message)
            diagnostics.emit(
                .eviction, code: "ANALYTICS_EVENT_DROPPED", operation: "analytics.flush",
                httpStatus: failure.statusCode, message: message)
            return BatchOutcome(failure: failure.message)
        } catch {
            if let breaker, let permit {
                await breaker.abandon(permit)
            }
            let message = "Postponing analytics batch after an unexpected send failure: \(error)"
            let delay = NetworkPolicy.backoffMilliseconds(
                attempt: (batch.first?.attempts ?? 0) + 1,
                cap: AnalyticsClient.maxRetryDelayMilliseconds)
            postpone(batch, availableAt: now() + delay)
            warn(message)
            diagnostics.emit(
                .transport, code: "ANALYTICS_SEND_FAILED", operation: "analytics.flush",
                retryable: true, message: message)
            return BatchOutcome(failure: String(describing: error))
        }
    }

    // Re-inserts a failed batch with a bumped `availableAt`, so the next due-check skips it until
    // the cool-down has elapsed. The batch is never dropped, and `drain` restores capture order
    // from `sequence` afterwards.
    private func postpone(_ batch: [QueuedEvent], availableAt: Double) {
        let postponed = batch.map { event in
            var next = event
            next.attempts += 1
            next.availableAt = availableAt
            return next
        }
        queue.insert(contentsOf: postponed, at: 0)
        queueDirty = true
    }

    private func sendWithInlineRetry(_ batch: [QueuedEvent]) async throws {
        var attempt = 1
        while true {
            do {
                try await send(batch)
                return
            } catch let failure as SendFailure {
                guard failure.retryable, failure.retryAfterMilliseconds == nil,
                    attempt < AnalyticsClient.maxSendAttempts
                else {
                    throw failure
                }
                await sleep(AnalyticsClient.retryDelayMilliseconds(attempts: attempt))
                attempt += 1
            }
        }
    }

    private func send(_ batch: [QueuedEvent]) async throws {
        guard !batch.isEmpty else {
            return
        }

        // Only records persisted before the id was stamped at capture time need the fallback.
        let fallbackDistinctId =
            batch.contains { $0.distinctId == nil } ? await distinctIdProvider() : ""
        let body: [String: Any] = [
            "events": batch.map { event in
                [
                    "context": [String: Any](),
                    "distinct_id": event.distinctId ?? fallbackDistinctId,
                    "event": event.name,
                    "properties": properties(of: event),
                    "session_id": event.sessionId,
                    "timestamp": event.timestamp,
                    "uuid": event.id,
                ]
            },
            "sent_at": AnalyticsClient.iso8601(now()),
            "token": publishableKey,
        ]

        // A batch that cannot be encoded is dropped rather than posted with an empty body.
        guard let httpBody = AnalyticsClient.encodedBody(body) else {
            throw SendFailure(
                message: "Analytics batch could not be encoded",
                retryable: false,
                retryAfterMilliseconds: nil,
                statusCode: nil,
                isUnencodable: true
            )
        }

        var request = URLRequest(url: AnalyticsClient.batchUrl(ingestUrl))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = httpBody

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            // A cancelled flush surfaces as `URLError.cancelled`; as a transport failure it would
            // count against the breaker and push the batch out on backoff for a shutdown that
            // said nothing about the backend.
            if Task.isCancelled || (error as? URLError)?.code == .cancelled {
                throw CancellationError()
            }
            throw SendFailure(
                message: "Analytics request failed: \(error.localizedDescription)",
                retryable: true,
                retryAfterMilliseconds: nil,
                statusCode: nil
            )
        }
        guard let httpResponse = response as? HTTPURLResponse else {
            throw SendFailure(
                message: "Analytics response was not an HTTP response",
                retryable: true,
                retryAfterMilliseconds: nil,
                statusCode: nil
            )
        }

        let status = httpResponse.statusCode
        if status == 202 {
            log("Sent \(batch.count) analytics events")
            return
        }

        if (200..<300).contains(status) {
            throw SendFailure(
                message: "Analytics ingest returned \(status); only 202 confirms delivery",
                retryable: true,
                retryAfterMilliseconds: nil,
                statusCode: status
            )
        }

        let retryAfter = NetworkPolicy.retryAfterMilliseconds(
            header: httpResponse.value(forHTTPHeaderField: "retry-after"), body: data, now: now(),
            cap: AnalyticsClient.maxRetryDelayMilliseconds)

        throw SendFailure(
            message: "Analytics ingest request failed: \(status)",
            retryable: NetworkPolicy.retryableStatusCodes.contains(status),
            retryAfterMilliseconds: retryAfter,
            statusCode: status
        )
    }

    /// Merges the standardized `$`-properties over the event's own, mirroring `utils.ts`, and
    /// replaces non-finite numbers — which `JSONSerialization` cannot represent — with `null`.
    private func properties(of event: QueuedEvent) -> [String: Any] {
        var merged = event.properties
        for (key, value) in standardProperties {
            merged[key] = value
        }

        return AnalyticsClient.jsonObject(merged) { [warn] key in
            warn(
                "Replacing the non-finite analytics property \"\(key)\" of event \"\(event.name)\" with null"
            )
        }
    }

    private func log(_ message: String) {
        guard debug else {
            return
        }
        print("[voidhash] \(message)")
    }

    /// Encodes a batch body, returning `nil` when it cannot be represented as JSON.
    ///
    /// `JSONSerialization.data` raises an Objective-C exception — uncatchable from Swift — for
    /// values such as `NaN`, so the body is validated before it is encoded.
    static func encodedBody(_ body: [String: Any]) -> Data? {
        guard JSONSerialization.isValidJSONObject(body) else {
            return nil
        }
        return try? JSONSerialization.data(withJSONObject: body, options: [])
    }

    static func batchUrl(_ ingestUrl: URL) -> URL {
        let origin =
            ingestUrl.absoluteString.hasSuffix("/")
            ? String(ingestUrl.absoluteString.dropLast()) : ingestUrl.absoluteString
        return URL(string: origin + "/i/v1/batch") ?? ingestUrl
    }

    static func retryDelayMilliseconds(attempts: Int) -> Double {
        let exponent = Double(max(attempts - 1, 0))
        return min(1000 * pow(2, exponent), maxRetryDelayMilliseconds)
    }

    static func iso8601(_ milliseconds: Double) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"
        return formatter.string(from: Date(timeIntervalSince1970: milliseconds / 1000))
    }

    /// Converts properties into a `JSONSerialization`-safe object graph.
    ///
    /// - Parameter onNonFiniteNumber: Called with the key path of every `NaN`/infinite number,
    ///   which is replaced with `null` so one bad property cannot poison a whole batch.
    static func jsonObject(
        _ properties: [String: JSONValue],
        keyPath: String = "",
        onNonFiniteNumber: ((String) -> Void)? = nil
    ) -> [String: Any] {
        var result: [String: Any] = [:]
        for (key, value) in properties {
            result[key] = plainValue(
                value,
                keyPath: keyPath.isEmpty ? key : "\(keyPath).\(key)",
                onNonFiniteNumber: onNonFiniteNumber
            )
        }
        return result
    }

    private static func plainValue(
        _ value: JSONValue, keyPath: String, onNonFiniteNumber: ((String) -> Void)?
    ) -> Any {
        switch value {
        case .null:
            return NSNull()
        case .bool(let bool):
            return bool
        case .number(let number):
            guard number.isFinite else {
                onNonFiniteNumber?(keyPath)
                return NSNull()
            }
            return number
        case .string(let string):
            return string
        case .array(let array):
            return array.enumerated().map { index, element in
                plainValue(
                    element, keyPath: "\(keyPath)[\(index)]",
                    onNonFiniteNumber: onNonFiniteNumber)
            }
        case .object(let object):
            return jsonObject(object, keyPath: keyPath, onNonFiniteNumber: onNonFiniteNumber)
        }
    }
}
