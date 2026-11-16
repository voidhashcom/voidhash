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
/// Transient failures (see ``NetworkPolicy/classify(statusCode:tag:)``: transport errors,
/// throttling, every `5xx`, and a `4xx` that is not a tagged Voidhash error) postpone a batch
/// with jittered exponential backoff, or the server's `Retry-After`, and never drop it: the only
/// reasons an event is lost are the queue cap and a tagged server verdict. A `413`, or a tagged
/// `400`/`422` refusing the batch as invalid, splits the batch in half until the event the server
/// refuses is alone, so only that event is dropped; a tagged `401`/`403` pauses outbound traffic,
/// without touching the queue, until a probe finds the key accepted again.
///
/// While analytics consent is not granted nothing is queued, written or sent;
/// ``discardQueuedEvents()`` drops what was collected before.
public actor AnalyticsClient {
    /// Maximum number of events sent in one request.
    public static let batchSize = 20
    /// Interval of the background flush loop.
    public static let flushIntervalMilliseconds: Double = 5000
    /// Network attempts per flush before a batch is postponed for a later trigger.
    public static let maxSendAttempts = 1
    /// Upper bound of the computed exponential backoff between queue retries. A server's
    /// `Retry-After` is honoured up to ``NetworkPolicy/maxRetryAfterMilliseconds``.
    public static let maxRetryDelayMilliseconds: Double = 30_000
    /// Events retained before the oldest are evicted.
    public static let maxQueuedEvents = 1000
    /// Batches one flush sends at most. After an outage the backlog drains over a few flush
    /// intervals rather than every device sending all of it the moment the backend is back.
    public static let maxBatchesPerFlush = 10
    /// Shortest gap between two reports of events the cap evicted.
    public static let evictionReportIntervalMilliseconds: Double = 60_000
    /// Captures buffered in memory before the queue is written through.
    public static let persistBehindEventCount = 20
    /// Longest a capture waits before the queue is written through.
    public static let persistBehindDelayMilliseconds: Double = 250
    /// The event property naming the groups an event happened in, by group type.
    public static let groupsProperty = "$groups"
    /// The event that sets a group's properties. It describes a group, not something the end user
    /// did, so it carries no `$groups` of its own.
    public static let groupIdentifyEvent = "$groupidentify"
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
        /// Whether the properties already hold everything the backend needs, the standardized
        /// `$`-properties included, and are sent exactly as stored: an event imported from the
        /// React Native SDK's own queue, stamped by it at capture.
        var sendsPropertiesAsIs = false

        private enum CodingKeys: String, CodingKey {
            case id, name, properties, timestamp, sessionId, distinctId, attempts, availableAt
            case sequence, sendsPropertiesAsIs
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
            sendsPropertiesAsIs =
                try container.decodeIfPresent(Bool.self, forKey: .sendsPropertiesAsIs) ?? false
        }

        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(id, forKey: .id)
            try container.encode(name, forKey: .name)
            try container.encode(properties, forKey: .properties)
            try container.encode(timestamp, forKey: .timestamp)
            try container.encode(sessionId, forKey: .sessionId)
            try container.encodeIfPresent(distinctId, forKey: .distinctId)
            try container.encode(attempts, forKey: .attempts)
            try container.encode(availableAt, forKey: .availableAt)
            try container.encode(sequence, forKey: .sequence)
            if sendsPropertiesAsIs {
                try container.encode(true, forKey: .sendsPropertiesAsIs)
            }
        }
    }

    private struct SendFailure: Error {
        let message: String
        let retryable: Bool
        let retryAfterMilliseconds: Double?
        let statusCode: Int?
        /// `_tag` of the error body, when the response was a Voidhash API error.
        var tag: String?
        /// The batch could not be turned into JSON at all, so no status code was ever involved.
        var isUnencodable = false
        /// The device had no usable network, which says nothing about the backend.
        var isDeviceOffline = false
    }

    private struct InFlightFlush {
        let id: Int
        let task: Task<FlushStatus, Never>
    }

    private enum QueueLifecycle {
        case active
        case retiring
        case retired
    }

    private static let outboundPausedMessage =
        "Outbound traffic is paused: the publishable key was rejected"

    private let publishableKey: String
    private let ingestUrl: URL
    private let session: URLSession
    private let distinctIdProvider: @Sendable () async -> String
    private let groupsProvider: @Sendable () -> [String: String]
    private let sessionIdProvider: @Sendable () async -> String
    private let analyticsConsent: @Sendable () -> AnalyticsConsent
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
    /// The batch a flush took off the queue and has not settled yet. A rewrite of the file while
    /// it is in flight keeps it, so a process killed before the answer arrives sends it again
    /// rather than losing it.
    private var inFlightBatch: [QueuedEvent] = []
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
    /// Where the client is in handing its store over to a replacement, see ``retire()``.
    private var lifecycle = QueueLifecycle.active
    /// Millisecond epoch before which the server asked, through `Retry-After`, to be sent nothing.
    /// ``endBackoff()`` ends the SDK's own backoff early, never this.
    private var retryAfterDeadline: Double = 0
    /// Millisecond epoch from which a store that could not be read is read again: an unreadable
    /// file is not read, and reported, on every flush.
    private var reloadAllowedAt: Double = 0
    /// Events the cap evicted that no diagnostic has reported yet.
    private var evictedSinceReport = 0
    /// Records in the file that are no longer in the queue: heads the cap evicted since the file
    /// was last rewritten. Past the cap a capture rewrites the file itself, so it stays under
    /// twice the cap when nothing flushes (a rejected key, the app in the background). A file
    /// that cannot be rewritten (its read failed, or the client was retired) grows by what is
    /// captured until a load succeeds or the replacing client rewrites it.
    private var evictedSinceRewrite = 0
    /// When evictions were last reported, so a backed-up queue reports them once a minute.
    private var lastEvictionReportAt: Double?

    /// - Parameters:
    ///   - publishableKey: Project publishable key, sent as `token` in the batch body.
    ///   - ingestUrl: Origin of the ingest endpoint (`ingestUrl ?? baseUrl`).
    ///   - session: URLSession used for the batch requests.
    ///   - distinctIdProvider: Returns the distinct id stamped on an event as it is queued.
    ///   - groupsProvider: Returns the groups the end user belongs to, by group type, added to an
    ///     event's `$groups` as it is queued, see ``groupsProperty``. Defaults to none.
    ///   - sessionIdProvider: Returns the session id stamped on an event as it is queued.
    ///     Defaults to one id per client instance.
    ///   - analyticsConsent: Returns the end user's analytics consent, read on every capture and
    ///     before every batch. Defaults to `granted`.
    ///   - standardProperties: `$`-prefixed properties stamped on every event as it is captured,
    ///     see ``standardProperties(device:sdkVersion:timezone:)``.
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
        groupsProvider: @escaping @Sendable () -> [String: String] = { [:] },
        sessionIdProvider: (@Sendable () async -> String)? = nil,
        analyticsConsent: @escaping @Sendable () -> AnalyticsConsent = { .granted },
        standardProperties: [String: JSONValue] = [:],
        now: @escaping @Sendable () -> Double = { Date().timeIntervalSince1970 * 1000 },
        sleep: @escaping @Sendable (Double) async -> Void = { milliseconds in
            await NetworkPolicy.sleep(milliseconds: milliseconds)
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
        self.groupsProvider = groupsProvider
        let instanceSessionId = UUID().uuidString.lowercased()
        self.sessionIdProvider = sessionIdProvider ?? { instanceSessionId }
        self.analyticsConsent = analyticsConsent
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

    /// One line of the persisted queue holding an event imported from another SDK's queue, sent
    /// with its properties exactly as given: that SDK stamped the standardized properties at
    /// capture. `sequence` orders the event in the queue.
    @_spi(VoidhashHost)
    public static func importedQueueLine(
        id: String, name: String, properties: [String: JSONValue], timestamp: String,
        sessionId: String, distinctId: String, attempts: Int, availableAt: Double, sequence: Int
    ) -> String? {
        var event = QueuedEvent(
            id: id, name: name, properties: properties, timestamp: timestamp,
            sessionId: sessionId, distinctId: distinctId, attempts: attempts,
            availableAt: availableAt, sequence: sequence)
        event.sendsPropertiesAsIs = true
        return encodeLine(event)
    }

    /// Builds the standardized `$`-properties stamped on every event.
    ///
    /// Port of `src/core/analytics/utils.ts`: the same keys, with `$sdk`/`$platform` reporting
    /// this platform. They are merged over the caller's properties, so a caller cannot shadow
    /// them. Voidhash adds `$environment`, the publishable key's environment, when the event
    /// arrives.
    ///
    /// - Parameter sdkName: `$sdk`; this SDK's name unless a host SDK drives it.
    public static func standardProperties(
        device: SdkDeviceInfo,
        sdkVersion: String,
        timezone: String? = TimeZone.current.identifier,
        sdkName: String = SdkHeaders.sdkName
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
            "$locale": text(device.locales.first),
            "$platform": .string(SdkHeaders.platformName),
            "$platform_version": text(device.systemVersion),
            "$sdk": .string(sdkName),
            "$sdk_version": .string(sdkVersion),
            "$timezone": text(timezone),
        ]
    }

    /// Queues an event. Every event is ignored while analytics consent is not granted. The name
    /// is trimmed, and a blank one is ignored and reported as `ANALYTICS_EVENT_INVALID`. A full
    /// batch of due events starts a flush.
    ///
    /// Non-finite numbers in `properties` are replaced with `null` (with a warning and an
    /// `NON_FINITE_NUMBER_REPLACED` diagnostic), so every queued event can be written to disk and
    /// sent.
    ///
    /// The session and distinct ids are resolved here, when the event enters the queue, so a
    /// batch that sits in the queue across a session boundary or an `identify` still reports
    /// the session and identity it happened under. So are the end user's groups, added to the
    /// event's `$groups`, where a group the event names itself wins for its type. The flush a
    /// full batch triggers runs off the caller's task: a capture never waits on the network.
    /// Events postponed by a failed send do not count towards the batch, so a backlog held on
    /// backoff does not turn every capture into a request of its own.
    public func capture(_ eventName: String, properties: [String: JSONValue] = [:]) async {
        await capture(eventName, properties: properties, capturedAt: now())
    }

    /// ``capture(_:properties:)`` for an event that happened at `capturedAt` (millisecond epoch),
    /// which a host that held it back queues late.
    ///
    /// - Parameters:
    ///   - distinctId: The identity the event happened under, when the caller stamped it already;
    ///     `nil` takes the current one.
    ///   - sessionId: Likewise for the analytics session.
    ///   - groups: Likewise for the end user's groups.
    ///   - appVersion: The `$app_version` of an event an earlier release made, which a later one
    ///     reports; `nil` takes the running version.
    func capture(
        _ eventName: String, properties: [String: JSONValue], capturedAt: Double,
        distinctId stampedDistinctId: String? = nil, sessionId stampedSessionId: String? = nil,
        groups stampedGroups: [String: String]? = nil, appVersion: String? = nil
    ) async {
        guard analyticsConsent() == .granted else {
            return
        }
        let normalized = eventName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else {
            let message = "Ignored an analytics event with a blank name"
            diagnostics.emit(
                .eviction, code: "ANALYTICS_EVENT_INVALID", operation: "analytics.capture",
                message: message)
            warn(message)
            return
        }

        let sanitized = JSONValue.replacingNonFiniteNumbers(in: properties)
        if !sanitized.nonFiniteKeyPaths.isEmpty {
            for keyPath in sanitized.nonFiniteKeyPaths {
                warn(
                    "Replacing the non-finite analytics property \"\(keyPath)\" of event \"\(normalized)\" with null"
                )
            }
            diagnostics.emit(
                .eviction, code: "NON_FINITE_NUMBER_REPLACED", operation: "analytics.capture",
                message:
                    "Replaced non-finite numbers with null in event \"\(normalized)\": \(sanitized.nonFiniteKeyPaths.joined(separator: ", "))"
            )
        }

        // Stamped as the event is queued, so an event that waits across an app update reports the
        // release, locale and OS it happened under. The caller cannot shadow these keys.
        var properties = sanitized.properties
        for (key, value) in standardProperties {
            properties[key] = value
        }
        if let appVersion, !appVersion.isEmpty {
            properties["$app_version"] = .string(appVersion)
        }

        // Consent can be withdrawn while the capture waits on the load or the providers; the event
        // is then dropped, and no session is started for it.
        await loadQueueIfNeeded()
        guard analyticsConsent() == .granted else {
            return
        }
        let sessionId: String
        if let stampedSessionId {
            sessionId = stampedSessionId
        } else {
            sessionId = await sessionIdProvider()
        }
        let distinctId: String
        if let stampedDistinctId {
            distinctId = stampedDistinctId
        } else {
            distinctId = await distinctIdProvider()
        }
        guard analyticsConsent() == .granted else {
            return
        }
        let groups = stampedGroups ?? groupsProvider()
        if normalized != AnalyticsClient.groupIdentifyEvent, !groups.isEmpty {
            var merged = groups.mapValues(JSONValue.string)
            if case .object(let own) = properties[AnalyticsClient.groupsProperty] {
                merged.merge(own) { _, named in named }
            }
            properties[AnalyticsClient.groupsProperty] = .object(merged)
        }
        nextSequence += 1
        let event = QueuedEvent(
            id: makeEventId(),
            name: normalized,
            properties: properties,
            timestamp: AnalyticsClient.iso8601(capturedAt),
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
            // An evicted head already on disk stays there until the next rewrite instead of
            // costing one per capture: a load keeps only the newest `maxQueuedEvents` records.
            queue.removeFirst(overflow)
            unpersistedCount = min(unpersistedCount, queue.count)
            queueDirty = true
            evictedSinceReport += overflow
            evictedSinceRewrite += overflow
        }
        // A file whose read failed, or that belongs to a replacing client, cannot be rewritten:
        // there the captures keep being appended in batches like any others.
        if evictedSinceRewrite >= AnalyticsClient.maxQueuedEvents, !storeReadFailed,
            lifecycle != .retired
        {
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

    /// Whether a flush would find a full batch to send: the same contiguous run of due events
    /// from the head that ``takeDueBatch()`` takes, and nothing while the key is rejected.
    /// Otherwise a backlog held on backoff would turn every capture into a flush that sends
    /// nothing and only writes the capture through on its own.
    private func hasDueBatch() -> Bool {
        guard !gate.isPaused else {
            return false
        }
        let timestamp = now()
        var due = 0
        for event in queue {
            guard NetworkPolicy.isDue(event.availableAt, now: timestamp) else {
                return false
            }
            due += 1
            if due >= AnalyticsClient.batchSize {
                return true
            }
        }
        return false
    }

    /// Reports the events the cap evicted since the last report as one diagnostic and warning, at
    /// the end of a flush or a persist at least ``evictionReportIntervalMilliseconds`` after the
    /// previous report, and on retirement.
    ///
    /// - Parameter final: Reports what is left regardless of the interval, as the client
    ///   retires.
    private func reportEvictions(final: Bool = false) {
        guard evictedSinceReport > 0 else {
            return
        }
        let timestamp = now()
        if !final, let lastEvictionReportAt,
            timestamp - lastEvictionReportAt < AnalyticsClient.evictionReportIntervalMilliseconds,
            timestamp >= lastEvictionReportAt
        {
            return
        }
        lastEvictionReportAt = timestamp
        let message =
            "Dropped \(evictedSinceReport) oldest analytics event(s); the queue is at its cap of \(AnalyticsClient.maxQueuedEvents)"
        evictedSinceReport = 0
        diagnostics.emit(
            .eviction, code: "ANALYTICS_EVENT_DROPPED", operation: "analytics.capture",
            message: message)
        // Also a warning, so the loss shows up with the default options too.
        warn(message)
    }

    /// Number of events the backend has not acknowledged yet: those waiting in the queue and the
    /// batch in flight.
    public func queueLength() async -> Int {
        await loadQueueIfNeeded()
        return queue.count + inFlightBatch.count
    }

    /// Snapshot of the events not acknowledged yet, the batch in flight included, in capture
    /// order, for tests that assert on what was captured.
    func queuedEvents() async -> [QueuedEvent] {
        await loadQueueIfNeeded()
        return (queue + inFlightBatch).sorted { $0.sequence < $1.sequence }
    }

    /// Sends the due batches, at most ``maxBatchesPerFlush`` of them; the periodic flush sends
    /// the rest.
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
        guard analyticsConsent() == .granted else {
            return FlushStatus(flushed: 0, pending: 0)
        }
        var flushed = 0
        defer { reportEvictions() }
        await loadQueueIfNeeded()
        if storeReadFailed, NetworkPolicy.isDue(reloadAllowedAt, now: now()) {
            await performQueueLoad()
        }
        await appendPendingEvents()

        guard lifecycle == .active else {
            return FlushStatus(flushed: 0, pending: queue.count)
        }
        guard gate.allowsOutbound() else {
            // Captures at the cap keep appending while the key is rejected; this is where the
            // file drops the heads they evicted, once per flush rather than once per capture.
            // With no flush running, a capture does it once they add up to the cap.
            await persistQueue()
            return FlushStatus(
                flushed: 0, pending: queue.count,
                lastError: AnalyticsClient.outboundPausedMessage)
        }

        var lastError: String?
        var batch = takeDueBatch()
        var batchesSent = 0
        while !batch.isEmpty {
            batchesSent += 1
            inFlightBatch = batch
            let outcome = await processBatch(batch)
            inFlightBatch = []
            // Delivered, dropped or back in the queue: a rewrite that kept the batch meanwhile
            // no longer matches the file.
            queueDirty = true
            flushed += outcome.delivered
            if let failure = outcome.failure {
                lastError = failure
            }
            // A cancelled flush puts its batch straight back as due; taking it again would spin.
            if !gate.allowsOutbound() || Task.isCancelled || analyticsConsent() != .granted
                || batchesSent >= AnalyticsClient.maxBatchesPerFlush
            {
                break
            }
            // An event captured while that batch was in flight may still be inside its
            // write-behind window; taken from there it would be in memory alone while it is sent.
            await appendPendingEvents()
            batch = takeDueBatch()
        }
        // Postponed batches went back in at the head, and a `413` split can postpone the halves
        // in the wrong order; restoring capture order here keeps the queue FIFO.
        queue.sort { $0.sequence < $1.sequence }
        await persistQueue()
        return FlushStatus(flushed: flushed, pending: queue.count, lastError: lastError)
    }

    /// Makes every event postponed by the SDK's own backoff due now, for a caller with fresh
    /// evidence that the backend may be reachable again (a flush, a foreground, connectivity
    /// coming back). Events the server asked to hold back through `Retry-After` stay held until
    /// the time it gave.
    public func endBackoff() async {
        await loadQueueIfNeeded()
        for index in queue.indices where queue[index].availableAt > retryAfterDeadline {
            queue[index].availableAt = retryAfterDeadline
            queueDirty = true
        }
    }

    // MARK: - Persistence

    /// Writes the queue through to the store. Called on flush and on backgrounding.
    ///
    /// Buffered captures are appended; a queue whose last rewrite failed is rewritten.
    ///
    /// - Returns: Whether every event queued when it was called is in the store. On `false` the
    ///   events stay queued in memory, and a later write carries them.
    @discardableResult
    public func persist() async -> Bool {
        persistTask?.cancel()
        persistTask = nil
        let written: Bool
        if queueDirty {
            written = await persistQueue()
        } else {
            written = await appendPendingEvents()
        }
        reportEvictions()
        return written
    }

    /// Hands the store over to a replacing client for good.
    ///
    /// Stops the flush loop, cancels an in-flight flush and waits for it to put its batch back,
    /// then writes the queue through. Afterwards nothing is sent and the store is never
    /// rewritten, only appended to, so a replacement that has loaded it keeps what it holds.
    public func retire() async {
        guard lifecycle == .active else {
            return
        }
        lifecycle = .retiring
        stopAutoFlush()
        if let running = inFlightFlush {
            running.task.cancel()
            _ = await running.task.value
        }
        await persist()
        reportEvictions(final: true)
        lifecycle = .retired
    }

    /// Drops every collected event, in memory and on disk, for an end user who withdrew analytics
    /// consent.
    ///
    /// A flush in flight is cancelled and awaited first, so it cannot put its batch back or write
    /// it to the store afterwards. A retired client leaves the store to its replacement.
    public func discardQueuedEvents() async {
        persistTask?.cancel()
        persistTask = nil
        if let running = inFlightFlush {
            running.task.cancel()
            _ = await running.task.value
        }
        await loadQueueIfNeeded()
        // Yields on every lap, for the same reason as in `appendPendingEvents`.
        while let appendTask {
            await Task.yield()
            _ = await appendTask.value
        }
        queue = []
        inFlightBatch = []
        unpersistedCount = 0
        queueDirty = false
        evictedSinceReport = 0
        guard lifecycle != .retired else {
            return
        }
        await store.clear()
        storeReadFailed = false
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
        if loaded.readFailed {
            reloadAllowedAt = now() + NetworkPolicy.queueBackoffCapMilliseconds
        }
        let decoder = JSONDecoder()
        // A record written twice (an append that reported a failure but landed) keeps its first
        // place with its latest state.
        var persisted: [QueuedEvent] = []
        var positions: [String: Int] = [:]
        for line in loaded.lines {
            guard let event = try? decoder.decode(QueuedEvent.self, from: Data(line.utf8)) else {
                continue
            }
            if let position = positions[event.id] {
                persisted[position] = event
            } else {
                positions[event.id] = persisted.count
                persisted.append(event)
            }
        }
        // Heads evicted at the cap stay in the file until its next rewrite; the newest
        // `maxQueuedEvents` records are the queue.
        let stale = persisted.count - AnalyticsClient.maxQueuedEvents
        if stale > 0 {
            persisted.removeFirst(stale)
            evictedSinceRewrite += stale
        }
        if stale > 0 || persisted.count < loaded.lines.count {
            queueDirty = true
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
    @discardableResult
    private func appendPendingEvents() async -> Bool {
        // Yields on every lap: awaiting an already-completed task continues inline without
        // yielding the actor, so a bare re-read loop would starve the very continuation that
        // nils the handle and spin forever.
        while let appendTask {
            await Task.yield()
            _ = await appendTask.value
        }
        guard unpersistedCount > 0 else {
            return true
        }
        let pending = Array(queue.suffix(unpersistedCount))
        let lines = encodeLines(pending)
        // Events that could not be encoded left the queue, so they no longer wait for a write.
        unpersistedCount -= pending.count - lines.count
        let task = Task { await self.store.append(lines) }
        appendTask = task
        let succeeded = await task.value
        appendTask = nil
        if succeeded {
            unpersistedCount = max(unpersistedCount - lines.count, 0)
        }
        return succeeded
    }

    // Slow path: the queue changed somewhere other than its tail (a send, a postponement, an
    // eviction), so the file is rewritten from the in-memory state. Skipped when the queue is
    // already on disk, so an idle periodic flush costs no write.
    @discardableResult
    private func persistQueue() async -> Bool {
        // Yields on every lap (see `appendPendingEvents`): without it the loop can starve the
        // continuation that nils the handle and spin on a completed task forever.
        while let appendTask {
            await Task.yield()
            _ = await appendTask.value
        }
        // Rewriting the file off a failed read would delete events the load never saw; new
        // captures keep being appended and the rewrite waits for a load that succeeds. A retired
        // client's file belongs to its replacement.
        guard !storeReadFailed, lifecycle != .retired else {
            return await appendPendingEvents()
        }
        guard queueDirty || unpersistedCount > 0 else {
            return true
        }
        // Reset before the write: captures landing while it is in flight are not part of it and
        // count again. A failed write leaves the file behind the queue, so the next persist
        // rewrites it.
        unpersistedCount = 0
        queueDirty = false
        evictedSinceRewrite = 0
        let events = (queue + inFlightBatch).sorted { $0.sequence < $1.sequence }
        let written = await store.replace(with: encodeLines(events))
        if !written {
            queueDirty = true
        }
        return written
    }

    // Capture replaces what JSON cannot represent, so every event encodes. One that still does
    // not is dropped from the queue with a diagnostic, rather than left out of the file while
    // being counted as written.
    private func encodeLines(_ events: [QueuedEvent]) -> [String] {
        var lines: [String] = []
        var unencodable: Set<Int> = []
        for event in events {
            if let line = AnalyticsClient.encodeLine(event) {
                lines.append(line)
            } else {
                unencodable.insert(event.sequence)
            }
        }
        guard !unencodable.isEmpty else {
            return lines
        }
        queue.removeAll { unencodable.contains($0.sequence) }
        diagnostics.emit(
            .eviction, code: "ANALYTICS_EVENT_DROPPED", operation: "analytics.persist",
            message: "Dropped \(unencodable.count) analytics event(s) that could not be encoded")
        return lines
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

    /// Starts the periodic flush loop. Idempotent, and a no-op once the client was retired.
    public func startAutoFlush() {
        guard flushTask == nil, lifecycle == .active else {
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
            if !NetworkPolicy.isDue(event.availableAt, now: timestamp) {
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
        /// Set when the batch went back to the queue to wait (an outage, an open circuit, a
        /// rejected key, a cancelled flush): the time it becomes due again.
        var postponedUntil: Double?
    }

    private func processBatch(_ batch: [QueuedEvent]) async -> BatchOutcome {
        let permit: CircuitBreakerPermit?
        if let breaker {
            guard let acquired = await breaker.acquire(host: breakerHost) else {
                let delay = NetworkPolicy.backoffMilliseconds(
                    attempt: (batch.first?.attempts ?? 0) + 1,
                    cap: AnalyticsClient.maxRetryDelayMilliseconds)
                let availableAt = now() + delay
                postpone(batch, availableAt: availableAt)
                return BatchOutcome(
                    failure: "The analytics circuit is open", postponedUntil: availableAt)
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
            return BatchOutcome(failure: "The flush was cancelled", postponedUntil: 0)
        } catch let failure as SendFailure {
            if let breaker, let permit {
                await breaker.release(
                    permit,
                    retryableFailure: failure.isUnencodable || failure.isDeviceOffline
                        ? false
                        : NetworkPolicy.countsTowardsCircuitBreaker(
                            statusCode: failure.statusCode, tag: failure.tag))
            }
            // The ingest endpoint validates a batch as a whole, so one event it refuses (as
            // invalid, or as too large) fails every event sent with it, as does one that cannot
            // be represented as JSON. The batch is halved until the offender is alone and only
            // it is dropped; the halving ends because a batch of one is never split.
            let isInvalidEventVerdict =
                (failure.statusCode == 400 || failure.statusCode == 422)
                && NetworkPolicy.classify(statusCode: failure.statusCode, tag: failure.tag)
                    == .verdict
            if failure.isUnencodable || failure.statusCode == 413 || isInvalidEventVerdict,
                batch.count > 1
            {
                let midpoint = (batch.count + 1) / 2
                let head = await processBatch(Array(batch[..<midpoint]))
                // A half that went back to wait would only send the other into the same outage,
                // or past a rejected key; it waits with it.
                if let postponedUntil = head.postponedUntil {
                    postpone(Array(batch[midpoint...]), availableAt: postponedUntil)
                    return head
                }
                let tail = await processBatch(Array(batch[midpoint...]))
                return BatchOutcome(
                    delivered: head.delivered + tail.delivered,
                    failure: tail.failure ?? head.failure,
                    postponedUntil: tail.postponedUntil)
            }

            if failure.isUnencodable {
                let name = batch.first?.name ?? "?"
                warn("Dropping the analytics event \"\(name)\": it cannot be encoded as JSON")
                diagnostics.emit(
                    .eviction, code: "ANALYTICS_EVENT_DROPPED", operation: "analytics.flush",
                    message: "Dropped the event \"\(name)\": it cannot be encoded as JSON")
                return BatchOutcome(failure: failure.message)
            }

            if isInvalidEventVerdict {
                let name = batch.first?.name ?? "?"
                let message = "Dropped the analytics event \"\(name)\": \(failure.message)"
                warn(message)
                diagnostics.emit(
                    .eviction, code: "ANALYTICS_EVENT_DROPPED", operation: "analytics.flush",
                    httpStatus: failure.statusCode, message: message)
                return BatchOutcome(failure: failure.message)
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
            // sending for now and report it once per pause. The gate reopens on a successful
            // probe. Only ingest's own tagged rejection counts: a 401 or 403 from something in
            // front of it is about this batch at most, and is retried below like any outage.
            if NetworkPolicy.classify(statusCode: failure.statusCode, tag: failure.tag)
                == .authentication
            {
                let availableAt = now()
                postpone(batch, availableAt: availableAt)
                if gate.pause() {
                    diagnostics.emit(
                        .auth, code: "AUTHENTICATION_FAILED", operation: "analytics.flush",
                        httpStatus: failure.statusCode,
                        message:
                            "The publishable key was rejected; queued analytics are kept and sending is paused"
                    )
                    warn("Pausing analytics: \(failure.message)")
                }
                return BatchOutcome(failure: failure.message, postponedUntil: availableAt)
            }

            if failure.retryable {
                if let retryAfter = failure.retryAfterMilliseconds {
                    retryAfterDeadline = max(retryAfterDeadline, now() + retryAfter)
                }
                let delay =
                    failure.retryAfterMilliseconds
                    ?? NetworkPolicy.backoffMilliseconds(
                        attempt: (batch.first?.attempts ?? 0) + 1,
                        cap: AnalyticsClient.maxRetryDelayMilliseconds)
                let availableAt = now() + delay
                postpone(batch, availableAt: availableAt)
                diagnostics.emit(
                    .transport, code: "ANALYTICS_SEND_FAILED", operation: "analytics.flush",
                    retryable: true, httpStatus: failure.statusCode, message: failure.message)
                return BatchOutcome(failure: failure.message, postponedUntil: availableAt)
            }

            // The backend rejected the batch with a tagged verdict it will repeat. Identity writes
            // never ride this queue: they have a durable queue of their own.
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
            let availableAt = now() + delay
            postpone(batch, availableAt: availableAt)
            warn(message)
            diagnostics.emit(
                .transport, code: "ANALYTICS_SEND_FAILED", operation: "analytics.flush",
                retryable: true, message: message)
            return BatchOutcome(failure: String(describing: error), postponedUntil: availableAt)
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
        try await post(body)
        log("Sent \(batch.count) analytics events")
    }

    /// Sends one `$groupidentify` in a request of its own, for a group described without
    /// analytics consent: a group and its properties are what the app says about the end user,
    /// which consent does not cover. The event carries its name, id, time and distinct id and
    /// `properties` alone: no session, no `$groups` and none of the standardized device
    /// properties. Nothing is stored and a failure is not retried.
    ///
    /// - Returns: Whether Voidhash accepted the request. `false` as well while the publishable
    ///   key is rejected, when nothing is sent.
    func sendGroupIdentify(
        properties: [String: JSONValue], distinctId: String, capturedAt: Double
    ) async -> Bool {
        guard gate.allowsOutbound() else {
            return false
        }
        let body: [String: Any] = [
            "events": [
                [
                    "context": [String: Any](),
                    "distinct_id": distinctId,
                    "event": AnalyticsClient.groupIdentifyEvent,
                    "properties": AnalyticsClient.jsonObject(properties),
                    "timestamp": AnalyticsClient.iso8601(capturedAt),
                    "uuid": makeEventId(),
                ]
            ],
            "sent_at": AnalyticsClient.iso8601(now()),
            "token": publishableKey,
        ]
        do {
            try await post(body)
            return true
        } catch let failure as SendFailure {
            // Any 2xx means the request arrived; only the queue insists on 202 before it lets
            // go of events it could send again.
            return failure.statusCode.map((200..<300).contains) == true
        } catch {
            return false
        }
    }

    /// Posts `body` to the ingest batch endpoint, with the consent header while consent is not
    /// granted. Returns on `202`.
    private func post(_ body: [String: Any]) async throws {
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
        // A batch taken off the queue just before consent was withdrawn says so, and the server
        // drops it.
        let consent = analyticsConsent()
        if consent != .granted {
            request.setValue(
                consent.rawValue, forHTTPHeaderField: SdkHeaders.analyticsConsentHeader)
        }
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
                statusCode: nil,
                isDeviceOffline: NetworkPolicy.isDeviceOffline(error)
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

        let failure = VoidhashApiError.http(
            statusCode: status,
            body: data,
            retryAfterMilliseconds: NetworkPolicy.retryAfterMilliseconds(
                header: httpResponse.value(forHTTPHeaderField: "retry-after"), body: data,
                now: now()))
        throw SendFailure(
            message: failure.tag.map {
                "Analytics ingest request failed: \(status) \($0): \(failure.message)"
            } ?? "Analytics ingest request failed: \(status)",
            retryable: failure.isRetryable,
            retryAfterMilliseconds: failure.retryAfterMilliseconds,
            statusCode: status,
            tag: failure.tag
        )
    }

    /// The event's properties as sent, with non-finite numbers — which `JSONSerialization` cannot
    /// represent — replaced with `null`.
    ///
    /// The standardized `$`-properties were stamped at capture; this client's values only fill
    /// the keys a record queued by an earlier SDK version lacks.
    private func properties(of event: QueuedEvent) -> [String: Any] {
        var merged = event.properties
        for (key, value) in standardProperties where merged[key] == nil && !event.sendsPropertiesAsIs {
            merged[key] = value
        }
        // Earlier releases queued a deferred identify as `$identify` naming its alias
        // `$anon_distinct_id`; ingest links only `$previous_distinct_id`.
        if event.name == AutomaticEvents.identify, merged["$previous_distinct_id"] == nil,
            let alias = merged["$anon_distinct_id"]
        {
            merged["$previous_distinct_id"] = alias
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
