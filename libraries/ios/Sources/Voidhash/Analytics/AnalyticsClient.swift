import Foundation
import VoidhashCore

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

/// Batching analytics capture queue.
///
/// Mirrors `src/core/analytics/service.ts`: events are batched (20 per request, flushed every 5
/// seconds), a failed send is retried inline up to three attempts with exponential backoff,
/// `Retry-After` postpones the batch in the queue instead of retrying inline, a `413` splits the
/// batch in half, and non-retryable failures drop the batch with a warning.
public actor AnalyticsClient {
    /// Maximum number of events sent in one request.
    public static let batchSize = 20
    /// Interval of the background flush loop.
    public static let flushIntervalMilliseconds: Double = 5000
    /// Total inline send attempts, including the first one.
    public static let maxSendAttempts = 3
    /// Upper bound of the exponential backoff between queue retries.
    public static let maxRetryDelayMilliseconds: Double = 30_000

    struct QueuedEvent: Sendable, Equatable {
        let id: String
        let name: String
        let properties: [String: JSONValue]
        let timestamp: String
        var attempts: Int
        var availableAt: Double
    }

    private struct SendFailure: Error {
        let message: String
        let retryable: Bool
        let retryAfterMilliseconds: Double?
        let statusCode: Int?
    }

    // 408/429/500/502/503/504 are worth another attempt; anything else is a client error.
    private static let retryableStatusCodes: Set<Int> = [408, 429, 500, 502, 503, 504]

    private let publishableKey: String
    private let ingestUrl: URL
    private let session: URLSession
    private let distinctIdProvider: @Sendable () async -> String
    private let standardProperties: [String: JSONValue]
    private let now: @Sendable () -> Double
    private let sleep: @Sendable (Double) async -> Void
    private let makeEventId: @Sendable () -> String
    private let debug: Bool
    private let warn: VoidhashWarningHandler

    private var queue: [QueuedEvent] = []
    private var flushTask: Task<Void, Never>?

    /// - Parameters:
    ///   - publishableKey: Project publishable key, sent as `token` in the batch body.
    ///   - ingestUrl: Origin of the ingest endpoint (`ingestUrl ?? baseUrl`).
    ///   - session: URLSession used for the batch requests.
    ///   - distinctIdProvider: Returns the distinct id stamped on every event.
    ///   - standardProperties: `$`-prefixed properties merged into every event, see
    ///     ``standardProperties(device:sdkVersion:)``.
    ///   - now: Millisecond epoch clock, injectable for tests.
    ///   - sleep: Suspends for a number of milliseconds, injectable for tests.
    ///   - makeEventId: Event uuid factory, injectable for tests.
    ///   - debug: Whether to print verbose diagnostics. Dropped batches warn either way.
    ///   - warn: Receives the dropped-batch diagnostics.
    public init(
        publishableKey: String,
        ingestUrl: URL,
        session: URLSession = .shared,
        distinctIdProvider: @escaping @Sendable () async -> String,
        standardProperties: [String: JSONValue] = [:],
        now: @escaping @Sendable () -> Double = { Date().timeIntervalSince1970 * 1000 },
        sleep: @escaping @Sendable (Double) async -> Void = { milliseconds in
            try? await Task.sleep(nanoseconds: UInt64(milliseconds * 1_000_000))
        },
        makeEventId: @escaping @Sendable () -> String = { UUID().uuidString.lowercased() },
        debug: Bool = false,
        warn: @escaping VoidhashWarningHandler = VoidhashWarnings.standard
    ) {
        self.publishableKey = publishableKey
        self.ingestUrl = ingestUrl
        self.session = session
        self.distinctIdProvider = distinctIdProvider
        self.standardProperties = standardProperties
        self.now = now
        self.sleep = sleep
        self.makeEventId = makeEventId
        self.debug = debug
        self.warn = warn
    }

    /// Builds the standardized `$`-properties stamped on every event.
    ///
    /// Port of `src/core/analytics/utils.ts`: the same keys, with `$sdk`/`$platform` reporting
    /// this platform. They are merged over the caller's properties, so a caller cannot shadow
    /// them.
    public static func standardProperties(device: SdkDeviceInfo, sdkVersion: String)
        -> [String: JSONValue]
    {
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
            "$sdk": .string(SdkHeaders.sdkName),
            "$sdk_version": .string(sdkVersion),
        ]
    }

    /// Queues an event. Empty names are ignored and a full batch flushes immediately.
    public func capture(_ eventName: String, properties: [String: JSONValue] = [:]) async {
        let normalized = eventName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else {
            return
        }

        queue.append(
            QueuedEvent(
                id: makeEventId(),
                name: normalized,
                properties: properties,
                timestamp: AnalyticsClient.iso8601(now()),
                attempts: 0,
                availableAt: 0
            ))

        if queue.count >= AnalyticsClient.batchSize {
            await flush()
        }
    }

    /// Number of events waiting in the queue.
    public func queueLength() -> Int {
        return queue.count
    }

    /// Drains the queue, sending every due batch.
    public func flush() async {
        var batch = takeDueBatch()
        while !batch.isEmpty {
            await processBatch(batch)
            batch = takeDueBatch()
        }
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
        }
        return batch
    }

    private func processBatch(_ batch: [QueuedEvent]) async {
        do {
            try await sendWithInlineRetry(batch)
        } catch let failure as SendFailure {
            if failure.statusCode == 413 && batch.count > 1 {
                let midpoint = (batch.count + 1) / 2
                await processBatch(Array(batch[..<midpoint]))
                await processBatch(Array(batch[midpoint...]))
                return
            }

            if failure.statusCode == 413 {
                warn("Dropping analytics event after 413 response")
                return
            }

            if failure.retryable {
                let delay =
                    failure.retryAfterMilliseconds
                    ?? AnalyticsClient.retryDelayMilliseconds(
                        attempts: (batch.first?.attempts ?? 0) + 1)
                postpone(batch, availableAt: now() + delay)
                return
            }

            warn(
                "Dropping analytics batch: \(failure.statusCode.map { "non-retryable response: \($0)" } ?? failure.message)"
            )
        } catch {
            warn("Dropping analytics batch: \(error)")
        }
    }

    // Re-inserts a failed batch at the head of the queue with a bumped `availableAt`, so the next
    // due-check skips it until the cool-down has elapsed.
    private func postpone(_ batch: [QueuedEvent], availableAt: Double) {
        let postponed = batch.map { event in
            var next = event
            next.attempts += 1
            next.availableAt = availableAt
            return next
        }
        queue.insert(contentsOf: postponed, at: 0)
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

        let distinctId = await distinctIdProvider()
        let body: [String: Any] = [
            "events": batch.map { event in
                [
                    "context": [String: Any](),
                    "distinct_id": distinctId,
                    "event": event.name,
                    "properties": properties(of: event),
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
                statusCode: nil
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
            throw SendFailure(
                message: "Analytics request failed: \(error.localizedDescription)",
                retryable: true,
                retryAfterMilliseconds: nil,
                statusCode: nil
            )
        }
        _ = data

        guard let httpResponse = response as? HTTPURLResponse else {
            throw SendFailure(
                message: "Analytics response was not an HTTP response",
                retryable: true,
                retryAfterMilliseconds: nil,
                statusCode: nil
            )
        }

        let status = httpResponse.statusCode
        if (200..<300).contains(status) {
            log("Sent \(batch.count) analytics events")
            return
        }

        let retryAfter = AnalyticsClient.parseRetryAfterMilliseconds(
            httpResponse.value(forHTTPHeaderField: "retry-after"), now: now())

        throw SendFailure(
            message: "Analytics ingest request failed: \(status)",
            retryable: AnalyticsClient.retryableStatusCodes.contains(status),
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

    /// Parses `Retry-After`, accepting both a delay in seconds and an HTTP date.
    static func parseRetryAfterMilliseconds(_ value: String?, now: Double) -> Double? {
        guard let value, !value.isEmpty else {
            return nil
        }

        if let seconds = Double(value), seconds >= 0 {
            return (seconds * 1000).rounded(.up)
        }

        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "GMT")
        formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss zzz"
        guard let date = formatter.date(from: value) else {
            return nil
        }
        return max(date.timeIntervalSince1970 * 1000 - now, 0)
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
