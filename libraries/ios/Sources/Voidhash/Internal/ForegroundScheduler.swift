import Foundation
import VoidhashCore

/// Runs deferred recovery work, such as the probe of a paused outbound gate, while the app is in
/// the foreground.
///
/// Each ``Purpose`` holds at most one timer, and scheduling it again replaces the one pending.
/// Timers sleep on the injected clock and fire once its monotonic reading reaches their due time,
/// so a change of the device date cannot move them.
///
/// The scheduler starts suspended and arms nothing until ``resume()``. ``suspend()`` cancels
/// every pending timer when the app leaves the foreground, and ``stop()`` does so for good. Work a
/// timer has already started runs to completion; it re-arms through
/// ``schedule(_:at:_:)`` when it still has something to do, which a suspended scheduler ignores,
/// so whoever resumes the scheduler re-arms what is still pending.
final class ForegroundScheduler: @unchecked Sendable {
    /// What a timer is for.
    enum Purpose: Hashable, Sendable {
        /// Probes an outbound gate paused by a rejected publishable key.
        case authProbe
        /// Retries the person writes waiting out their backoff.
        case personWrites
        /// Retries the store receipts waiting out their backoff or an open circuit breaker.
        case receipts
        /// Refreshes the reads an open circuit breaker turned away once it admits a probe.
        case readsAfterCircuit
    }

    private enum State {
        case suspended
        case running
        case stopped
    }

    private struct Timer {
        let id: UInt64
        let task: Task<Void, Never>
    }

    private let clock: any VoidhashClock
    private let lock = NSLock()
    private var state = State.suspended
    private var timers: [Purpose: Timer] = [:]
    private var nextTimerId: UInt64 = 0

    init(clock: any VoidhashClock) {
        self.clock = clock
    }

    /// Runs `work` once the clock's monotonic reading reaches `dueAt`, replacing the timer
    /// pending for `purpose`. Ignored unless the scheduler is running.
    func schedule(
        _ purpose: Purpose, at dueAt: Double, _ work: @escaping @Sendable () async -> Void
    ) {
        let replaced = lock.withLock { () -> Timer? in
            guard state == .running else {
                return nil
            }
            nextTimerId += 1
            let id = nextTimerId
            let task = Task { [clock, weak self] in
                while !Task.isCancelled, clock.monotonicNow() < dueAt {
                    await clock.sleep(milliseconds: dueAt - clock.monotonicNow())
                }
                guard !Task.isCancelled, let self, self.claim(purpose, id: id) else {
                    return
                }
                await work()
            }
            let replaced = timers[purpose]
            timers[purpose] = Timer(id: id, task: task)
            return replaced
        }
        replaced?.task.cancel()
    }

    /// Lets ``schedule(_:at:_:)`` arm timers again after the app returned to the foreground.
    /// A stopped scheduler stays stopped.
    func resume() {
        lock.withLock {
            if state == .suspended {
                state = .running
            }
        }
    }

    /// Cancels every pending timer and arms none until ``resume()``.
    func suspend() {
        cancelAll(then: .suspended)
    }

    /// Cancels every pending timer for good.
    func stop() {
        cancelAll(then: .stopped)
    }

    /// Purposes with a timer pending.
    var pendingPurposes: Set<Purpose> {
        return lock.withLock { Set(timers.keys) }
    }

    /// Whether timers can be armed: the scheduler was resumed and not suspended or stopped since.
    var isRunning: Bool {
        return lock.withLock { state == .running }
    }

    /// Removes the timer `id` as it fires; `false` when it was replaced or cancelled meanwhile.
    private func claim(_ purpose: Purpose, id: UInt64) -> Bool {
        return lock.withLock {
            guard state == .running, timers[purpose]?.id == id else {
                return false
            }
            timers[purpose] = nil
            return true
        }
    }

    private func cancelAll(then next: State) {
        let cancelled = lock.withLock { () -> [Timer] in
            if state != .stopped {
                state = next
            }
            defer { timers.removeAll() }
            return Array(timers.values)
        }
        cancelled.forEach { $0.task.cancel() }
    }
}
