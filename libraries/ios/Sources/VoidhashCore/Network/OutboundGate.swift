import Foundation

/// The single switch that stops the SDK from talking to the backend after the publishable key
/// was rejected.
///
/// A rejected key is a configuration error, not an outage, so retrying on every capture only
/// burns the user's battery. The gate is shared by the analytics queue, the transaction outbox
/// and the cache-backed reads so all three stop together and, crucially, resume together: it is
/// not a one-way latch. A foreground or connectivity-restored event at least ``probeInterval``
/// after the pause releases exactly one probe request, and a probe that succeeds reopens the gate.
public final class OutboundGate: @unchecked Sendable {
    /// Shortest gap between the pause and the first probe, and between probes.
    public static let probeIntervalMilliseconds: Double = 60_000

    private let lock = NSLock()
    private var pausedAt: Double?
    private var probeInFlight = false
    private var probePermitAvailable = false
    private var lastProbeAt: Double?

    public init() {}

    /// Whether outbound traffic is currently paused.
    public var isPaused: Bool {
        return lock.withLock { pausedAt != nil }
    }

    /// Pauses outbound traffic. Idempotent: a second rejection does not extend the window.
    public func pause(now: Double) {
        lock.withLock {
            if pausedAt == nil {
                pausedAt = now
            }
            probeInFlight = false
            probePermitAvailable = false
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
    /// Call from the foreground and connectivity-restored triggers; report the outcome through
    /// ``endProbe(succeeded:now:)`` so a failed probe does not hold the slot.
    public func beginProbe(now: Double) -> Bool {
        return lock.withLock {
            guard pausedAt != nil, !probeInFlight else {
                return false
            }
            let since = lastProbeAt ?? pausedAt ?? now
            guard now - since >= OutboundGate.probeIntervalMilliseconds else {
                return false
            }
            probeInFlight = true
            probePermitAvailable = true
            lastProbeAt = now
            return true
        }
    }

    /// Reports a probe outcome. A success reopens the gate; a failure schedules the next probe.
    public func endProbe(succeeded: Bool, now: Double) {
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
