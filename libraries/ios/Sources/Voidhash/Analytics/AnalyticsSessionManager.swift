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
///
/// Once loaded, the session can also be read and advanced synchronously (``stampNow(at:)``,
/// ``activeIdNow(at:)``), for a capture stamped at call time outside any actor. The state lives
/// behind a lock for that, and every persist goes through one serial queue, so the record on disk
/// is always the latest whichever path wrote it.
actor AnalyticsSessionManager {
    /// Cache key of the persisted ``AnalyticsSessionRecord``.
    static let cacheKey = "voidhash:analytics:session"
    /// Inactivity after which the next capture starts a new session.
    static let inactivityTimeoutMilliseconds: Double = 30 * 60 * 1000

    private final class State: @unchecked Sendable {
        let lock = NSLock()
        var record: AnalyticsSessionRecord?
        var hasLoaded = false
    }

    private let cacheManager: CacheManager
    private let now: @Sendable () -> Double
    private let makeSessionId: @Sendable () -> String
    private nonisolated let state = State()
    private nonisolated let persists = SerialTaskQueue()

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
        await load()
        let (next, persisted) = advance(at: now())
        await persisted.value
        return next.id
    }

    /// Returns the id the next capture will carry without counting as activity. A timed-out
    /// session is replaced, so the returned id is never stale.
    func peek() async -> String {
        await load()
        if let active = activeIdNow(at: now()) {
            return active
        }
        return await rotate()
    }

    /// Starts a new session unconditionally and returns its id.
    @discardableResult
    func rotate() async -> String {
        let next = AnalyticsSessionRecord(id: makeSessionId(), lastEventAt: now())
        let persisted = state.lock.withLock { () -> Task<Void, any Error> in
            state.record = next
            state.hasLoaded = true
            return write(next)
        }
        _ = try? await persisted.value
        return next.id
    }

    /// Ends the session and removes its persisted record, for an end user who withdrew analytics
    /// consent. The next capture after consent is granted again starts a new session.
    func discard() async {
        // The delete is queued under the same lock a capture advances the session under, so a
        // capture racing the withdrawal is either before it and deleted, or after it.
        let deleted = state.lock.withLock { () -> Task<Void, any Error> in
            state.record = nil
            state.hasLoaded = true
            return persists.submit { [cacheManager] in
                await cacheManager.delete(AnalyticsSessionManager.cacheKey)
            }
        }
        _ = try? await deleted.value
    }

    /// Reads the persisted record once, so the synchronous accessors can answer.
    func load() async {
        guard !state.lock.withLock({ state.hasLoaded }) else {
            return
        }
        let persisted = await cacheManager.get(
            AnalyticsSessionManager.cacheKey, as: AnalyticsSessionRecord.self)?.value
        state.lock.withLock {
            // A session started while the read was in flight is newer than the one on disk.
            if !state.hasLoaded {
                state.record = persisted
                state.hasLoaded = true
            }
        }
    }

    /// ``current()`` without suspending: the session id of a capture made at `timestamp`, which
    /// counts as activity. `nil` until the record was loaded.
    nonisolated func stampNow(at timestamp: Double) -> String? {
        guard state.lock.withLock({ state.hasLoaded }) else {
            return nil
        }
        return advance(at: timestamp).record.id
    }

    /// The id of the session still active at `timestamp`, without counting as activity; `nil`
    /// when there is none or the record was not loaded yet.
    nonisolated func activeIdNow(at timestamp: Double) -> String? {
        return state.lock.withLock {
            guard state.hasLoaded, let record = state.record,
                timestamp - record.lastEventAt
                    <= AnalyticsSessionManager.inactivityTimeoutMilliseconds
            else {
                return nil
            }
            return record.id
        }
    }

    /// The record after a capture at `timestamp`, the active session's id or a new one, and its
    /// write, queued under the lock so the writes land in the order the state changed.
    private nonisolated func advance(at timestamp: Double) -> (
        record: AnalyticsSessionRecord, persisted: Task<Void, Never>
    ) {
        return state.lock.withLock {
            let active = state.record.flatMap { record in
                timestamp - record.lastEventAt
                    <= AnalyticsSessionManager.inactivityTimeoutMilliseconds ? record : nil
            }
            let next = AnalyticsSessionRecord(
                id: active?.id ?? makeSessionId(), lastEventAt: timestamp)
            state.record = next
            state.hasLoaded = true
            let written = write(next)
            return (next, Task { _ = try? await written.value })
        }
    }

    private nonisolated func write(_ record: AnalyticsSessionRecord) -> Task<Void, any Error> {
        return persists.submit { [cacheManager] in
            await cacheManager.set(AnalyticsSessionManager.cacheKey, value: record)
        }
    }
}
