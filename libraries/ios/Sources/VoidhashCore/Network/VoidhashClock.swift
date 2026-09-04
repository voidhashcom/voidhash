import Foundation

/// Time source used by every backoff, TTL and breaker decision in the SDK.
///
/// Injected so tests can advance time without real sleeps.
public protocol VoidhashClock: Sendable {
    /// Current time as a millisecond epoch timestamp.
    func now() -> Double
    /// Suspends for `milliseconds`. Implementations may return early on cancellation.
    func sleep(milliseconds: Double) async
}

/// Wall-clock implementation backed by `Date` and `Task.sleep`.
public struct SystemVoidhashClock: VoidhashClock {
    public init() {}

    public func now() -> Double {
        return Date().timeIntervalSince1970 * 1000
    }

    public func sleep(milliseconds: Double) async {
        guard milliseconds > 0 else {
            return
        }
        try? await Task.sleep(nanoseconds: UInt64(milliseconds * 1_000_000))
    }
}

/// Deterministic clock: `sleep` advances the reported time instead of suspending.
///
/// Every scheduled sleep resolves immediately, so a test can exercise unbounded retry loops and
/// multi-minute breaker windows without wall-clock cost.
public final class FakeVoidhashClock: VoidhashClock, @unchecked Sendable {
    private let lock = NSLock()
    private var current: Double
    private var sleeps: [Double] = []

    public init(now: Double = 1_700_000_000_000) {
        current = now
    }

    public func now() -> Double {
        return lock.withLock { current }
    }

    /// Milliseconds passed to every ``sleep(milliseconds:)`` call so far.
    public var recordedSleeps: [Double] {
        return lock.withLock { sleeps }
    }

    /// Moves the clock forward without suspending.
    public func advance(milliseconds: Double) {
        lock.withLock { current += milliseconds }
    }

    public func sleep(milliseconds: Double) async {
        lock.withLock {
            sleeps.append(milliseconds)
            current += max(milliseconds, 0)
        }
        // Yield so cooperating tasks observe the advanced time in submission order.
        await Task.yield()
    }
}
