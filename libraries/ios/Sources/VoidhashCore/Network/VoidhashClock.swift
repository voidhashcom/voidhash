import Foundation

/// Time source used by every backoff, TTL and breaker decision in the SDK.
///
/// Injected so tests can advance time without real sleeps.
public protocol VoidhashClock: Sendable {
    /// Current time as a millisecond epoch timestamp.
    ///
    /// Wall-clock time: use it for values that are persisted or compared with server time.
    func now() -> Double
    /// Milliseconds on a clock that never moves backwards, for windows that live only inside the
    /// process (breaker cooldowns, probe spacing, debounces, refresh backoff).
    ///
    /// Unlike ``now()`` it is unaffected by the user changing the device date, so such a window
    /// can never be stretched to hours by a clock correction. It keeps counting while the device
    /// sleeps, so a window is not stretched by a locked phone either.
    func monotonicNow() -> Double
    /// Suspends for `milliseconds`. Implementations may return early on cancellation.
    func sleep(milliseconds: Double) async
}

extension VoidhashClock {
    // `CLOCK_MONOTONIC` rather than `ProcessInfo.systemUptime`, `CLOCK_UPTIME_RAW` or
    // `mach_absolute_time()`, which all stop while the device sleeps: a phone locked for ten
    // minutes would otherwise count as a few seconds, and skip the recovery on its return.
    public func monotonicNow() -> Double {
        return Double(clock_gettime_nsec_np(CLOCK_MONOTONIC)) / 1_000_000
    }
}

/// Wall-clock implementation backed by `Date` and `Task.sleep`.
public struct SystemVoidhashClock: VoidhashClock {
    public init() {}

    public func now() -> Double {
        return Date().timeIntervalSince1970 * 1000
    }

    public func sleep(milliseconds: Double) async {
        await NetworkPolicy.sleep(milliseconds: milliseconds)
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

    /// The same reading as ``now()``: tests move one clock and expect every window to follow.
    public func monotonicNow() -> Double {
        return now()
    }

    /// Milliseconds passed to every ``sleep(milliseconds:)`` call so far.
    public var recordedSleeps: [Double] {
        return lock.withLock { sleeps }
    }

    /// Moves the clock by `milliseconds` without suspending; a negative value moves it back.
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
