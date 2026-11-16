import Foundation

/// The single switch that stops the SDK from talking to the backend after the publishable key
/// was rejected.
///
/// A rejected key is a configuration error, not an outage, so retrying on every capture only
/// burns the user's battery. The gate is shared by the analytics queue, the transaction outbox
/// and the cache-backed reads so all three stop together and, crucially, resume together: it is
/// not a one-way latch. At most once every ``probeIntervalMilliseconds`` after the pause, exactly
/// one probe request is let through, and a probe that succeeds reopens the gate. The owner asks
/// for the probe on a timer while the app is in the foreground (see ``nextProbeAt``) and on a
/// foreground, connectivity-restored or flush trigger.
///
/// Every window is measured on the clock's monotonic reading, so the users who share one gate
/// agree on it and a change of the device date cannot delay the next probe.
public final class OutboundGate: @unchecked Sendable {
    /// Shortest gap between the pause and the first probe, and between probes.
    public static let probeIntervalMilliseconds: Double = 60_000

    private let clock: any VoidhashClock
    private let lock = NSLock()
    private var pausedAt: Double?
    private var probeInFlight = false
    private var probePermitAvailable = false
    private var lastProbeAt: Double?
    private let onPause: (@Sendable () -> Void)?

    /// - Parameters:
    ///   - clock: Source of the monotonic reading the probe spacing is measured on.
    ///   - onPause: Called outside the gate's lock each time a rejection pauses an open gate, so
    ///     the owner can schedule the probe.
    public init(
        clock: any VoidhashClock = SystemVoidhashClock(), onPause: (@Sendable () -> Void)? = nil
    ) {
        self.clock = clock
        self.onPause = onPause
    }

    /// Whether outbound traffic is currently paused.
    public var isPaused: Bool {
        return lock.withLock { pausedAt != nil }
    }

    /// Pauses outbound traffic. Idempotent: a second rejection does not extend the window.
    ///
    /// - Returns: Whether this call paused an open gate. A rejection that finds the gate paused
    ///   already, such as a failed probe or a request that was in flight when the first one
    ///   landed, returns `false`, so the rejection is reported once per pause.
    @discardableResult
    public func pause() -> Bool {
        let now = clock.monotonicNow()
        let newlyPaused = lock.withLock { () -> Bool in
            let wasOpen = pausedAt == nil
            if wasOpen {
                pausedAt = now
            }
            probeInFlight = false
            probePermitAvailable = false
            return wasOpen
        }
        if newlyPaused {
            onPause?()
        }
        return newlyPaused
    }

    /// Monotonic reading from which ``beginProbe()`` grants the next probe; `nil` while the gate
    /// is open or a probe is in flight, whose outcome decides the next one.
    public var nextProbeAt: Double? {
        return lock.withLock {
            guard let pausedAt, !probeInFlight else {
                return nil
            }
            return (lastProbeAt ?? pausedAt) + OutboundGate.probeIntervalMilliseconds
        }
    }

    /// Resumes outbound traffic, clearing the probe state.
    public func resume() {
        lock.withLock {
            pausedAt = nil
            probeInFlight = false
            probePermitAvailable = false
            lastProbeAt = nil
        }
    }

    /// Claims permission for one outbound request.
    ///
    /// Normal requests are refused while paused. The caller that started a recovery probe passes
    /// `true`; exactly one such call consumes the probe permit.
    public func allowsOutbound(probe: Bool = false) -> Bool {
        return lock.withLock {
            guard pausedAt != nil else {
                return true
            }
            guard probe, probeInFlight, probePermitAvailable else {
                return false
            }
            probePermitAvailable = false
            return true
        }
    }

    /// Grants one probe when the pause has lasted long enough, otherwise `false`.
    ///
    /// Call from the probe timer and the foreground, connectivity-restored and flush triggers;
    /// report the outcome through ``endProbe(succeeded:)`` so a failed probe does not hold the
    /// slot.
    public func beginProbe() -> Bool {
        let now = clock.monotonicNow()
        return lock.withLock {
            guard pausedAt != nil, !probeInFlight else {
                return false
            }
            let since = lastProbeAt ?? pausedAt ?? now
            // The same sum as `nextProbeAt`, so a timer that fires at that reading always gets
            // its probe.
            guard now >= since + OutboundGate.probeIntervalMilliseconds else {
                return false
            }
            probeInFlight = true
            probePermitAvailable = true
            lastProbeAt = now
            return true
        }
    }

    /// Reports a probe outcome. A success reopens the gate; a failure schedules the next probe.
    public func endProbe(succeeded: Bool) {
        let now = clock.monotonicNow()
        lock.withLock {
            probeInFlight = false
            probePermitAvailable = false
            lastProbeAt = now
            if succeeded {
                pausedAt = nil
                lastProbeAt = nil
            }
        }
    }
}
