import Foundation

/// The shared transport policy: what is worth retrying, how long to wait and how to read
/// `Retry-After`.
///
/// Every queue, refresh and outbox in the SDK uses these values so behaviour under an outage is
/// identical no matter which subsystem issued the request.
public enum NetworkPolicy {
    /// Per-request timeout applied to every SDK `URLSession`.
    public static let requestTimeoutSeconds: TimeInterval = 10
    /// Whole-request timeout applied to every SDK API `URLSession`, so a response that trickles
    /// in cannot hold a request for longer than the gap timeout allows between packets.
    public static let resourceTimeoutSeconds: TimeInterval = 10
    /// Whole-request timeout of the session that downloads flow packages and paywall images,
    /// which can be large enough to need more than ``resourceTimeoutSeconds`` on a slow network.
    public static let downloadResourceTimeoutSeconds: TimeInterval = 60
    /// Longest a flow may take from the call that presents it until it is handed to the renderer:
    /// resolving the placement, downloading the package and waiting for a flow before it to
    /// leave the screen. Past it nothing is shown; the package is still downloaded for the next
    /// presentation.
    public static let flowPresentationDeadlineSeconds: TimeInterval = 15
    /// Backoff ceiling for queue and outbox retries.
    public static let queueBackoffCapMilliseconds: Double = 30_000
    /// Backoff ceiling for config refreshes (person, flags, paywalls, schema) after a failure.
    public static let configBackoffCapMilliseconds: Double = 60_000
    /// Longest an interactive read waits on an in-flight refresh before serving a stale value.
    public static let freshnessBudgetMilliseconds: Double = 500
    /// Longest a call the app awaits (a flush, an identify, a trait write) waits on Voidhash
    /// before returning; the work it started carries on in the background.
    public static let awaitedCallBudgetMilliseconds: Double = 2000

    /// Shortest delay a `Retry-After` can impose, so `0` or a date in the past never turns into a
    /// zero-delay retry loop.
    public static let minRetryAfterMilliseconds: Double = 1000
    /// Longest delay a `Retry-After` can impose, as in the other Voidhash SDKs.
    public static let maxRetryAfterMilliseconds: Double = 30_000
    /// Longest postponement the SDK ever persists or arms a timer for, above every backoff and
    /// `Retry-After`. It is what lets ``isDue(_:now:ceiling:)`` recognise a due time left behind
    /// by a clock that moved backwards.
    public static let maxPostponementMilliseconds: Double = 3_600_000

    /// How the SDK treats a failed request.
    public enum FailureClass: Sendable, Equatable {
        /// Worth another attempt later: a transport failure, `408`, `425`, `429`, any `5xx`, a
        /// `4xx` whose body is not a Voidhash API error (an edge or proxy page), `401` and `403`
        /// included, or a `2xx` body that could not be decoded. Keeps the data, backs off and
        /// counts against the host.
        case transient
        /// A tagged `401`/`403`: the backend rejected the publishable key. Pauses outbound
        /// traffic, keeps queues.
        case authentication
        /// Any other tagged Voidhash API error, which the server will give again for the same
        /// request.
        case verdict
    }

    /// Classifies a failure from its status (`nil` when no response arrived) and the `_tag` of
    /// its error body (`nil` when the body was not a Voidhash API error).
    ///
    /// Only the backend tags its errors, so an untagged `4xx` comes from something in front of
    /// it — a proxy, an edge, a firewall rule, a routing mistake during a deploy — and says
    /// nothing about whether the request or the publishable key was valid.
    public static func classify(statusCode: Int?, tag: String?) -> FailureClass {
        guard let statusCode, tag?.isEmpty == false else {
            return .transient
        }
        switch statusCode {
        case 401, 403:
            return .authentication
        case 408, 425, 429:
            return .transient
        case 400..<500:
            return .verdict
        default:
            return .transient
        }
    }

    /// Whether a response indicates host unavailability: every transient failure, including
    /// throttling. Authentication failures and tagged verdicts never count.
    public static func countsTowardsCircuitBreaker(statusCode: Int?, tag: String? = nil) -> Bool {
        return classify(statusCode: statusCode, tag: tag) == .transient
    }

    /// Whether a request that failed with `statusCode` and error `tag` should be retried later.
    /// A transport failure (no status) always is.
    public static func isRetryable(statusCode: Int?, tag: String? = nil) -> Bool {
        return classify(statusCode: statusCode, tag: tag) == .transient
    }

    /// Whether a transport failure means the device has no usable network, rather than that the
    /// backend failed to answer. Such a failure says nothing about the backend, so it never counts
    /// towards opening a circuit breaker.
    public static func isDeviceOffline(_ error: any Error) -> Bool {
        guard let code = (error as? URLError)?.code else {
            return false
        }
        switch code {
        case .notConnectedToInternet, .dataNotAllowed, .internationalRoamingOff, .callIsActive:
            return true
        default:
            return false
        }
    }

    /// Whether a persisted wall-clock due time has arrived.
    ///
    /// A due time further in the future than `ceiling` — the longest postponement the queue ever
    /// schedules — can only have been written while the device clock was ahead, so it counts as
    /// due now instead of parking the record until the wall clock catches up.
    ///
    /// - Parameter ceiling: Longest legitimate postponement. Defaults to
    ///   ``maxPostponementMilliseconds``; a queue that parks records for longer passes its own.
    public static func isDue(
        _ availableAt: Double, now: Double, ceiling: Double = maxPostponementMilliseconds
    ) -> Bool {
        return availableAt <= now || availableAt - now > ceiling
    }

    /// Jittered exponential backoff: `min(cap, 1s · 2^(attempt-1))` plus up to 25 % jitter.
    ///
    /// - Parameters:
    ///   - attempt: 1 for the first retry.
    ///   - cap: Ceiling before jitter.
    ///   - jitter: Fraction of the base delay added on top, injectable for deterministic tests.
    public static func backoffMilliseconds(
        attempt: Int,
        cap: Double = queueBackoffCapMilliseconds,
        jitter: Double = Double.random(in: 0..<0.25)
    ) -> Double {
        let exponent = Double(max(attempt - 1, 0))
        // pow overflows to infinity well before the cap matters; clamp the exponent first.
        let base = min(1000 * pow(2, min(exponent, 32)), cap)
        return base + base * max(jitter, 0)
    }

    /// Parses `Retry-After`, accepting a delay in seconds and an HTTP date, header first and the
    /// body's `retry_after_ms` second.
    ///
    /// The result is clamped to ``minRetryAfterMilliseconds``...``maxRetryAfterMilliseconds``: `0`
    /// or a date in the past waits a second rather than retrying in a tight loop, and no server
    /// can park a queue for longer than 30 seconds.
    ///
    /// - Parameters:
    ///   - header: Raw `Retry-After` header value.
    ///   - body: Response body, searched for `retry_after_ms` when the header is absent.
    ///   - now: Millisecond epoch used to turn an HTTP date into a delay.
    public static func retryAfterMilliseconds(
        header: String?,
        body: Data? = nil,
        now: Double
    ) -> Double? {
        guard let milliseconds = rawRetryAfterMilliseconds(header: header, body: body, now: now)
        else {
            return nil
        }
        return min(max(milliseconds, minRetryAfterMilliseconds), maxRetryAfterMilliseconds)
    }

    private static func rawRetryAfterMilliseconds(
        header: String?, body: Data?, now: Double
    ) -> Double? {
        if let fromHeader = parseRetryAfterHeader(header, now: now) {
            return fromHeader
        }
        guard let body, !body.isEmpty,
            let object = try? JSONSerialization.jsonObject(with: body) as? [String: Any]
        else {
            return nil
        }
        guard let milliseconds = (object["retry_after_ms"] as? NSNumber)?.doubleValue,
            milliseconds.isFinite, milliseconds >= 0
        else {
            return nil
        }
        return milliseconds
    }

    private static func parseRetryAfterHeader(_ value: String?, now: Double) -> Double? {
        guard let value else {
            return nil
        }
        let trimmed = value.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else {
            return nil
        }

        if let seconds = Double(trimmed), seconds.isFinite, seconds >= 0 {
            return (seconds * 1000).rounded(.up)
        }

        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "GMT")
        formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss zzz"
        guard let date = formatter.date(from: trimmed) else {
            return nil
        }
        return max(date.timeIntervalSince1970 * 1000 - now, 0)
    }

    /// Longest single suspension ``sleep(milliseconds:)`` performs.
    public static let maxSleepMilliseconds: Double = 86_400_000

    /// Suspends for `milliseconds`, returning at once for a delay that is not finite and positive
    /// and waiting at most ``maxSleepMilliseconds``, so no configured or computed delay can trap
    /// converting to nanoseconds. Returns early when the task is cancelled.
    public static func sleep(milliseconds: Double) async {
        guard milliseconds.isFinite, milliseconds > 0 else {
            return
        }
        try? await Task.sleep(
            nanoseconds: UInt64(min(milliseconds, maxSleepMilliseconds) * 1_000_000))
    }

    /// Process-wide session for API and ingest requests, see
    /// ``makeSession(resourceTimeout:urlCache:)``.
    public static let defaultSession: URLSession = makeSession()

    /// Memory capacity of the download session's cache.
    public static let downloadCacheMemoryBytes = 4 * 1024 * 1024
    /// Disk capacity of the download session's cache.
    public static let downloadCacheDiskBytes = 50 * 1024 * 1024

    /// Process-wide session for downloading paywall assets such as images, bounded by
    /// ``downloadResourceTimeoutSeconds``.
    ///
    /// Responses are cached under the usual HTTP rules in a cache of its own, in
    /// `Caches/voidhash/downloads`: the host app's `URLCache.shared` may be shrunk or disabled,
    /// and a paywall's images must not depend on it.
    public static let downloadSession: URLSession = makeSession(
        resourceTimeout: downloadResourceTimeoutSeconds,
        urlCache: URLCache(
            memoryCapacity: downloadCacheMemoryBytes, diskCapacity: downloadCacheDiskBytes,
            directory: FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?
                .appendingPathComponent("voidhash/downloads", isDirectory: true)))

    /// Builds a `URLSession` carrying the SDK timeouts that shares nothing with the host app's
    /// own networking: no cookie is stored or sent, no stored credential is used, and nothing
    /// reaches `URLCache.shared`. A cookie set by something in front of the backend would
    /// otherwise persist in the app's jar and be replayed, and responses carrying personal data
    /// would sit in the app's cache on disk, out of reach of a sign-out.
    ///
    /// - Parameters:
    ///   - resourceTimeout: Whole-request timeout; pass ``downloadResourceTimeoutSeconds`` for
    ///     a session that downloads assets.
    ///   - urlCache: Where responses are cached under the usual HTTP rules; `nil`, as for API
    ///     requests, caches nothing and always asks the server.
    public static func makeSession(
        resourceTimeout: TimeInterval = resourceTimeoutSeconds,
        urlCache: URLCache? = nil
    ) -> URLSession {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = requestTimeoutSeconds
        configuration.timeoutIntervalForResource = resourceTimeout
        configuration.httpCookieStorage = nil
        configuration.httpShouldSetCookies = false
        configuration.urlCredentialStorage = nil
        configuration.urlCache = urlCache
        configuration.requestCachePolicy =
            urlCache == nil ? .reloadIgnoringLocalCacheData : .useProtocolCachePolicy
        return URLSession(configuration: configuration)
    }
}
