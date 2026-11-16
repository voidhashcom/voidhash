import Foundation
import VoidhashCore

#if canImport(AdServices)
    import AdServices
#endif

/// The once-per-install read of Apple Ads attribution: what is asked and what the answer means.
/// ``VoidhashClient`` decides when it runs (consent, lifetime) and records the touch.
///
/// Only an install this SDK saw from its first launch is read. An install that already held an
/// identity when the state below was first written predates this code, and Apple's answer would
/// describe a tap from long ago, so it is marked done without asking. A fresh install is recorded
/// as pending at once, whatever the consent, as nothing else could tell it from an old one by the
/// time consent arrives on a later launch.
struct InstallAttribution: Sendable {
    /// Cache key of the state. Kept apart from the `analytics:` keys: withdrawing consent does not
    /// make an install fresh again.
    static let cacheKey = "attribution:install-touch"
    /// Reserved event that writes a touch onto the person, as the web SDK sends it.
    static let touchEvent = AutomaticEvents.set
    /// Launches an install keeps asking on, so a device that can never get an answer stops asking.
    static let maxAttempts = 10
    /// Attempts at one token when Apple has no record of it yet, and the wait between them.
    static let maxRequestAttempts = 3
    static let retryDelayMilliseconds: Double = 5000

    static let attributionEndpoint = URL(string: "https://api-adservices.apple.com/api/v1/")!

    /// Where Apple's blocking token call runs, one at a time.
    static let tokenQueue = DispatchQueue(label: "com.voidhash.attribution.token", qos: .utility)

    /// Every value a native touch carries, written under both trait prefixes.
    private static let touchKeys = [
        "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id", "fbclid",
        "gclid", "gbraid", "wbraid", "gad_source", "gad_campaignid", "dclid", "ttclid", "msclkid",
        "twclid", "li_fat_id", "ScCid", "rdt_cid", "epik", "ad_network", "ad_campaign_id",
        "ad_adset_id", "ad_id", "touch_source", "touch_kind", "touch_at",
    ]

    /// What the install's attribution has come to.
    struct State: Codable, Sendable, Equatable {
        enum Status: String, Codable, Sendable {
            case pending
            case done
        }

        var status: Status
        var attempts: Int
    }

    /// How one attempt ended.
    enum Outcome: Sendable, Equatable {
        /// A definitive answer with a touch to record.
        case touch([String: String])
        /// A definitive answer: this install has no touch.
        case noTouch
        /// No answer yet; a later launch asks again.
        case tryLater
    }

    let cacheManager: CacheManager
    /// Fetches the attribution token; blocks its thread on the network, as Apple's call does.
    let fetchToken: @Sendable () throws -> String
    let session: URLSession
    let clock: any VoidhashClock
    let diagnostics: DiagnosticEmitter
    /// Millisecond epoch.
    let now: @Sendable () -> Double

    /// Settles whether this install is ever read, on every launch, before the launch can store an
    /// identity.
    static func prepare(cacheManager: CacheManager, hasStoredIdentity: Bool) async {
        guard await cacheManager.get(cacheKey, as: State.self) == nil else {
            return
        }
        await cacheManager.set(
            cacheKey, value: State(status: hasStoredIdentity ? .done : .pending, attempts: 0))
    }

    /// Claims this launch's attempt; `false` when the install needs none. The attempt counts from
    /// here, so one interrupted by the app being killed counts too.
    func beginAttempt() async -> Bool {
        guard let state = await cacheManager.get(Self.cacheKey, as: State.self)?.value,
            state.status == .pending
        else {
            return false
        }
        guard state.attempts < Self.maxAttempts else {
            diagnostics.emit(
                .transport, code: "INSTALL_ATTRIBUTION_ABANDONED",
                operation: "attribution.install",
                message:
                    "Stopped asking Apple Ads about this install after \(state.attempts) launches without an answer"
            )
            await markDone()
            return false
        }
        await cacheManager.set(
            Self.cacheKey, value: State(status: .pending, attempts: state.attempts + 1))
        return true
    }

    /// The install is settled for good. Call once its touch, if any, is in the queue on disk.
    func markDone() async {
        let attempts = await cacheManager.get(Self.cacheKey, as: State.self)?.value.attempts ?? 0
        await cacheManager.set(Self.cacheKey, value: State(status: .done, attempts: attempts))
    }

    /// Fetches a fresh token and asks Apple what it attributes the install to.
    ///
    /// - Throws: `CancellationError` only.
    func read() async throws -> Outcome {
        let token: String
        do {
            token = try await waitForToken()
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            guard !Self.isPermanentTokenFailure(error) else {
                diagnostics.emit(
                    .transport, code: "INSTALL_ATTRIBUTION_ABANDONED",
                    operation: "attribution.install",
                    message: "This device cannot provide an Apple Ads attribution token")
                return .noTouch
            }
            reportDeferred("The Apple Ads attribution token is not available")
            return .tryLater
        }

        var request = URLRequest(url: Self.attributionEndpoint)
        request.httpMethod = "POST"
        request.setValue("text/plain", forHTTPHeaderField: "Content-Type")
        request.httpBody = Data(token.utf8)

        for attempt in 1...Self.maxRequestAttempts {
            let data: Data
            let response: URLResponse
            do {
                (data, response) = try await session.data(for: request)
            } catch {
                // A cancelled request answers with a `URLError`, not a `CancellationError`.
                try Task.checkCancellation()
                reportDeferred("Apple Ads could not be reached")
                return .tryLater
            }
            let status = (response as? HTTPURLResponse)?.statusCode
            switch status {
            case 200:
                return answer(data: data)
            case 400:
                diagnostics.emit(
                    .transport, code: "INSTALL_ATTRIBUTION_ABANDONED",
                    operation: "attribution.install", httpStatus: status,
                    message: "Apple Ads refused the attribution token")
                return .noTouch
            case 404 where attempt < Self.maxRequestAttempts:
                await clock.sleep(milliseconds: Self.retryDelayMilliseconds)
                try Task.checkCancellation()
            default:
                reportDeferred("Apple Ads did not answer", httpStatus: status)
                return .tryLater
            }
        }
        return .tryLater
    }

    /// Reports that the install stays pending, and why.
    func reportDeferred(_ reason: String, httpStatus: Int? = nil) {
        diagnostics.emit(
            .transport, code: "INSTALL_ATTRIBUTION_DEFERRED", operation: "attribution.install",
            retryable: true, httpStatus: httpStatus, message: "\(reason); a later launch asks again"
        )
    }

    private func answer(data: Data) -> Outcome {
        guard let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let attributed = body["attribution"] as? Bool
        else {
            reportDeferred("Apple Ads sent an answer that could not be read", httpStatus: 200)
            return .tryLater
        }
        return attributed ? .touch(Self.touch(fromAttribution: body, now: now())) : .noTouch
    }

    /// The touch in Apple's attribution record. Every field but `attribution` may be missing.
    static func touch(fromAttribution body: [String: Any], now: Double) -> [String: String] {
        var touch = ["ad_network": "apple_ads", "touch_source": "apple_ads"]
        touch["ad_campaign_id"] = identifier(body["campaignId"])
        touch["ad_adset_id"] = identifier(body["adGroupId"])
        touch["ad_id"] = identifier(body["adId"])
        switch body["claimType"] as? String {
        case "Click":
            touch["touch_kind"] = "click"
        case "Impression":
            touch["touch_kind"] = "view"
        default:
            break
        }
        let touchedAt =
            date(body["clickDate"]) ?? date(body["impressionDate"]) ?? now
        touch["touch_at"] = AnalyticsClient.iso8601(touchedAt)
        return touch
    }

    /// Apple sends ids as numbers; a touch's values are strings.
    private static func identifier(_ value: Any?) -> String? {
        if let text = value as? String {
            return text.isEmpty ? nil : text
        }
        return (value as? NSNumber)?.stringValue
    }

    /// The millisecond epoch of one of Apple's dates, minute precision as in `2021-11-30T19:35Z`.
    private static func date(_ value: Any?) -> Double? {
        guard let text = value as? String else {
            return nil
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        for format in [
            "yyyy-MM-dd'T'HH:mmXXXXX", "yyyy-MM-dd'T'HH:mm:ssXXXXX",
            "yyyy-MM-dd'T'HH:mm:ss.SSSXXXXX",
        ] {
            formatter.dateFormat = format
            if let date = formatter.date(from: text) {
                return date.timeIntervalSince1970 * 1000
            }
        }
        return nil
    }

    /// The properties of a touch's ``touchEvent``: the web SDK's wire format, every key under both
    /// prefixes. A key the touch lacks is written as `null`, since person traits are folded key by
    /// key and a key left out would keep the value of another touch.
    static func touchEventProperties(_ touch: [String: String]) -> [String: JSONValue] {
        func traits(prefix: String) -> JSONValue {
            return .object(
                Dictionary(
                    uniqueKeysWithValues: touchKeys.map { key in
                        (prefix + key, touch[key].map(JSONValue.string) ?? .null)
                    }))
        }
        return [
            "$process_person_profile": .bool(true),
            "$set": traits(prefix: "$latest_"),
            "$set_once": traits(prefix: "$initial_"),
        ]
    }

    /// Runs ``fetchToken`` on a thread of its own and stops waiting for it when the task is
    /// cancelled: Apple's call cannot be cancelled, and a shutdown must not wait on the network.
    private func waitForToken() async throws -> String {
        try Task.checkCancellation()
        let wait = TokenWait()
        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                wait.begin(continuation)
                InstallAttribution.tokenQueue.async { [fetchToken] in
                    wait.finish(Result { try fetchToken() })
                }
            }
        } onCancel: {
            wait.finish(.failure(CancellationError()))
        }
    }

    /// Whether this device will never have a token, rather than not having one right now.
    private static func isPermanentTokenFailure(_ error: any Error) -> Bool {
        #if canImport(AdServices)
            return (error as? AAAttributionError)?.code == .platformNotSupported
        #else
            return false
        #endif
    }

    /// What fetches the token in a real app; `nil` where there is no AdServices, and in an app
    /// extension, which is not the install an ad brought.
    static var systemTokenFetch: (@Sendable () throws -> String)? {
        #if canImport(AdServices)
            guard !Bundle.main.bundlePath.hasSuffix(".appex") else {
                return nil
            }
            return { try AAAttribution.attributionToken() }
        #else
            return nil
        #endif
    }
}

/// A wait for a token that ends with whichever of the token and a cancellation comes first.
private final class TokenWait: @unchecked Sendable {
    private let lock = NSLock()
    private var continuation: CheckedContinuation<String, any Error>?
    private var result: Result<String, any Error>?

    func begin(_ continuation: CheckedContinuation<String, any Error>) {
        let ready = lock.withLock { () -> Result<String, any Error>? in
            if result == nil {
                self.continuation = continuation
            }
            return result
        }
        if let ready {
            continuation.resume(with: ready)
        }
    }

    func finish(_ outcome: Result<String, any Error>) {
        let waiting = lock.withLock { () -> CheckedContinuation<String, any Error>? in
            guard result == nil else {
                return nil
            }
            result = outcome
            defer { continuation = nil }
            return continuation
        }
        waiting?.resume(with: outcome)
    }
}
