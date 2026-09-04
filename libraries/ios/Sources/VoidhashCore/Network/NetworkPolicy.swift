import Foundation

/// The shared transport policy: what is worth retrying, how long to wait and how to read
/// `Retry-After`.
///
/// Every queue, refresh and outbox in the SDK uses these values so behaviour under an outage is
/// identical no matter which subsystem issued the request.
public enum NetworkPolicy {
    /// Per-request timeout applied to every SDK `URLSession`.
    public static let requestTimeoutSeconds: TimeInterval = 10
    /// Whole-resource timeout applied to every SDK `URLSession`.
    public static let resourceTimeoutSeconds: TimeInterval = 30
    /// Backoff ceiling for queue and outbox retries.
    public static let queueBackoffCapMilliseconds: Double = 30_000
    /// Backoff ceiling for background config refreshes.
    public static let configBackoffCapMilliseconds: Double = 60_000
    /// Longest an interactive read waits on an in-flight refresh before serving a stale value.
    public static let freshnessBudgetMilliseconds: Double = 500

    /// Statuses that mean "try again later" rather than "this request was wrong".
    public static let retryableStatusCodes: Set<Int> = [408, 429, 500, 502, 503, 504]

    private static let breakerFailureStatusCodes: Set<Int> = [408, 500, 502, 503, 504]

    /// Whether a response indicates host unavailability rather than a client verdict or throttle.
    public static func countsTowardsCircuitBreaker(statusCode: Int?) -> Bool {
        guard let statusCode else {
            return true
        }
        return breakerFailureStatusCodes.contains(statusCode)
    }

    /// Whether `statusCode` should be retried. A transport failure (no status) always is.
    public static func isRetryable(statusCode: Int?) -> Bool {
        guard let statusCode else {
            return true
        }
        return retryableStatusCodes.contains(statusCode)
    }

    /// Whether `statusCode` means the publishable key was rejected.
    public static func isAuthFailure(statusCode: Int?) -> Bool {
        return statusCode == 401 || statusCode == 403
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
    /// - Parameters:
    ///   - header: Raw `Retry-After` header value.
    ///   - body: Response body, searched for `retry_after_ms` when the header is absent.
    ///   - now: Millisecond epoch used to turn an HTTP date into a delay.
    ///   - cap: Ceiling applied to the parsed delay, so a server asking for an hour cannot park a
    ///     queue past the backoff ceiling its owner chose. `nil` returns the raw value.
    public static func retryAfterMilliseconds(
        header: String?,
        body: Data? = nil,
        now: Double,
        cap: Double? = nil
    ) -> Double? {
        return clampRetryAfter(rawRetryAfterMilliseconds(header: header, body: body, now: now), cap: cap)
    }

    /// Clamps an already parsed `Retry-After` delay to `cap`; `nil` passes through.
    public static func clampRetryAfter(_ milliseconds: Double?, cap: Double?) -> Double? {
        guard let milliseconds else {
            return nil
        }
        guard let cap else {
            return milliseconds
        }
        return min(milliseconds, cap)
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
            milliseconds >= 0
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

        if let seconds = Double(trimmed), seconds >= 0 {
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

    /// Process-wide session carrying the SDK timeouts, used wherever `.shared` used to be.
    public static let defaultSession: URLSession = makeSession()

    /// Builds a `URLSession` carrying the SDK timeouts.
    public static func makeSession() -> URLSession {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = requestTimeoutSeconds
        configuration.timeoutIntervalForResource = resourceTimeoutSeconds
        return URLSession(configuration: configuration)
    }
}
