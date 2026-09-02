import Foundation
import VoidhashCore

/// Persisted analytics session, shared byte-for-byte with the React Native and Android SDKs.
struct AnalyticsSessionRecord: Codable, Sendable, Equatable {
    /// Lowercase UUID string.
    let id: String
    /// Millisecond epoch timestamp of the last event captured in this session.
    let lastEventAt: Double
}

/// Owns the analytics session id stamped on every captured event.
///
/// A session ends after 30 minutes without a capture; the next capture starts a new one. The
/// record is persisted on every capture, so a session survives a process restart as long as
/// the app comes back within the timeout.
actor AnalyticsSessionManager {
    /// Cache key of the persisted ``AnalyticsSessionRecord``.
    static let cacheKey = "voidhash:analytics:session"
    /// Inactivity after which the next capture starts a new session.
    static let inactivityTimeoutMilliseconds: Double = 30 * 60 * 1000

    private let cacheManager: CacheManager
    private let now: @Sendable () -> Double
    private let makeSessionId: @Sendable () -> String
    private var record: AnalyticsSessionRecord?
    private var hasLoaded = false

    /// - Parameters:
    ///   - cacheManager: Storage of the session record.
    ///   - now: Millisecond epoch clock, injectable for tests.
    ///   - makeSessionId: Session id factory, injectable for tests.
    init(
        cacheManager: CacheManager,
        now: @escaping @Sendable () -> Double = { Date().timeIntervalSince1970 * 1000 },
        makeSessionId: @escaping @Sendable () -> String = { UUID().uuidString.lowercased() }
    ) {
        self.cacheManager = cacheManager
        self.now = now
        self.makeSessionId = makeSessionId
    }

    /// Returns the session id for an event captured now, starting a new session when the
    /// previous one timed out, and records the capture time.
    func current() async -> String {
        let timestamp = now()
        let active = await activeRecord(at: timestamp)
        let next = AnalyticsSessionRecord(id: active?.id ?? makeSessionId(), lastEventAt: timestamp)
        await persist(next)
        return next.id
    }

    /// Returns the id the next capture will carry without counting as activity. A timed-out
    /// session is replaced, so the returned id is never stale.
    func peek() async -> String {
        let timestamp = now()
        if let active = await activeRecord(at: timestamp) {
            return active.id
        }
        return await rotate()
    }

    /// Starts a new session unconditionally and returns its id.
    @discardableResult
    func rotate() async -> String {
        let next = AnalyticsSessionRecord(id: makeSessionId(), lastEventAt: now())
        await persist(next)
        return next.id
    }

    private func activeRecord(at timestamp: Double) async -> AnalyticsSessionRecord? {
        if !hasLoaded {
            record = await cacheManager.get(
                AnalyticsSessionManager.cacheKey, as: AnalyticsSessionRecord.self)?.value
            hasLoaded = true
        }
        guard let record,
            timestamp - record.lastEventAt <= AnalyticsSessionManager.inactivityTimeoutMilliseconds
        else {
            return nil
        }
        return record
    }

    private func persist(_ next: AnalyticsSessionRecord) async {
        record = next
        hasLoaded = true
        await cacheManager.set(AnalyticsSessionManager.cacheKey, value: next)
    }
}
