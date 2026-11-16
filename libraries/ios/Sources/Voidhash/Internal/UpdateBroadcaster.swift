import Foundation

/// Hands every value to each stream made from it so far.
///
/// Each consumer gets a stream of its own: one `AsyncStream` shared by two consumers splits its
/// elements between them, so neither would see every update. A stream ends when its consumer
/// stops iterating, and every stream ends at ``finish()``.
final class UpdateBroadcaster<Value: Sendable>: @unchecked Sendable {
    private let lock = NSLock()
    private var continuations: [UUID: AsyncStream<Value>.Continuation] = [:]
    private let replaysLatest: Bool
    private var latest: Value?
    private var hasLatest = false
    private let unsubscribedLimit: Int
    private var unsubscribed: [Value] = []
    private var isFinished = false

    /// - Parameters:
    ///   - replaysLatest: Whether a new stream starts with the value yielded last.
    ///   - keepsWhileUnsubscribed: How many values yielded while no stream exists are kept for
    ///     the next stream made, the oldest dropped first.
    init(replaysLatest: Bool = false, keepsWhileUnsubscribed: Int = 0) {
        self.replaysLatest = replaysLatest
        self.unsubscribedLimit = keepsWhileUnsubscribed
    }

    func stream() -> AsyncStream<Value> {
        let id = UUID()
        return AsyncStream { continuation in
            // Registered and caught up in one step, so a value yielded meanwhile neither goes
            // missing nor arrives before an older one.
            lock.withLock {
                guard !isFinished else {
                    continuation.finish()
                    return
                }
                continuations[id] = continuation
                if replaysLatest, hasLatest, let latest {
                    continuation.yield(latest)
                }
                for value in unsubscribed {
                    continuation.yield(value)
                }
                unsubscribed = []
            }
            continuation.onTermination = { [weak self] _ in
                self?.lock.withLock { _ = self?.continuations.removeValue(forKey: id) }
            }
        }
    }

    func yield(_ value: Value) {
        lock.withLock {
            guard !isFinished else {
                return
            }
            latest = value
            hasLatest = true
            if continuations.isEmpty, unsubscribedLimit > 0 {
                unsubscribed.append(value)
                if unsubscribed.count > unsubscribedLimit {
                    unsubscribed.removeFirst()
                }
            }
            for continuation in continuations.values {
                continuation.yield(value)
            }
        }
    }

    /// Ends every stream, and makes the ones made later end at once.
    func finish() {
        let ended = lock.withLock { () -> [AsyncStream<Value>.Continuation] in
            isFinished = true
            defer { continuations = [:] }
            return Array(continuations.values)
        }
        for continuation in ended {
            continuation.finish()
        }
    }
}
