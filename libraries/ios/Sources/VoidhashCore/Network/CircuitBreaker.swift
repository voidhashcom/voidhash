import Foundation

/// State of a ``CircuitBreaker`` host entry.
public enum CircuitBreakerState: String, Sendable, Equatable {
    /// Requests flow normally.
    case closed
    /// Requests are refused; the SDK serves cached state instead.
    case open
    /// One probe request is allowed through to test whether the host recovered.
    case halfOpen
}

/// Permission to issue one request, which must be handed back through
/// ``CircuitBreaker/release(_:retryableFailure:)``.
///
/// A half-open breaker grants exactly one of these, so losing one would wedge the breaker shut
/// forever. Releasing is therefore the caller's obligation on *every* exit, including the paths
/// where the work was never started.
public struct CircuitBreakerPermit: Sendable, Equatable {
    let host: String
    let identifier: UInt64
    /// Whether this permit is the single probe of a half-open breaker.
    public let isProbe: Bool
}

/// Per-host breaker guarding the SDK against hammering an origin that is down.
///
/// Opens after ``failureThreshold`` consecutive retryable failures. The first cooldown is 30 s
/// and doubles on every re-open up to 5 minutes. Foreground and connectivity-restored events
/// half-open the breaker rather than resetting it, so a genuinely dead host still gets exactly
/// one probe. Authentication failures and other 4xx never count.
public actor CircuitBreaker {
    /// Consecutive retryable failures that open the breaker.
    public static let failureThreshold = 5
    /// First cooldown before a probe is allowed through.
    public static let initialCooldownMilliseconds: Double = 30_000
    /// Ceiling the doubling cooldown stops at.
    public static let maxCooldownMilliseconds: Double = 300_000
    /// How long an outstanding probe is honoured before it is treated as abandoned.
    ///
    /// A caller that is cancelled, deallocated or hung mid-probe would otherwise hold the only
    /// slot for the lifetime of the process; the timeout matches the request timeout, so a probe
    /// that could still be in flight is never stolen.
    public static let probeTimeoutMilliseconds: Double =
        NetworkPolicy.requestTimeoutSeconds * 1000

    private struct HostState {
        var consecutiveFailures = 0
        var state: CircuitBreakerState = .closed
        var cooldownMilliseconds = CircuitBreaker.initialCooldownMilliseconds
        var openedAt: Double = 0
        var probeIdentifier: UInt64?
        var probeStartedAt: Double = 0
    }

    private let clock: any VoidhashClock
    private let diagnostics: DiagnosticEmitter
    private var hosts: [String: HostState] = [:]
    private var nextIdentifier: UInt64 = 1

    public init(clock: any VoidhashClock, diagnostics: DiagnosticEmitter = DiagnosticEmitter(nil)) {
        self.clock = clock
        self.diagnostics = diagnostics
    }

    /// Whether a request to `host` would be admitted, without consuming anything.
    ///
    /// Use it to decide whether a read is worth attempting; ``acquire(host:)`` is what actually
    /// admits it.
    public func shouldAttempt(host: String) -> Bool {
        guard let entry = hosts[host] else {
            return true
        }
        switch entry.state {
        case .closed:
            return true
        case .open:
            return clock.now() - entry.openedAt >= entry.cooldownMilliseconds
        case .halfOpen:
            return true
        }
    }

    /// Admits one request, or returns `nil` when the breaker is holding the host shut.
    public func acquire(host: String) -> CircuitBreakerPermit? {
        var entry = hosts[host] ?? HostState()
        let timestamp = clock.now()

        if entry.state == .open {
            guard timestamp - entry.openedAt >= entry.cooldownMilliseconds else {
                hosts[host] = entry
                return nil
            }
            entry.state = .halfOpen
            entry.probeIdentifier = nil
        }

        if entry.state == .halfOpen {
            // An outstanding probe that has outlived the request timeout is treated as lost,
            // which is what keeps a cancelled caller from wedging the breaker permanently.
            if entry.probeIdentifier != nil,
                timestamp - entry.probeStartedAt < CircuitBreaker.probeTimeoutMilliseconds
            {
                hosts[host] = entry
                return nil
            }
            let identifier = takeIdentifier()
            entry.probeIdentifier = identifier
            entry.probeStartedAt = timestamp
            hosts[host] = entry
            return CircuitBreakerPermit(host: host, identifier: identifier, isProbe: true)
        }

        hosts[host] = entry
        return CircuitBreakerPermit(host: host, identifier: takeIdentifier(), isProbe: false)
    }

    /// Hands a permit back.
    ///
    /// - Parameter retryableFailure: `nil` when the request succeeded, `true` for a transport or
    ///   retryable-status failure, `false` for a client error the host is not to blame for.
    public func release(_ permit: CircuitBreakerPermit, retryableFailure: Bool?) {
        guard var entry = hosts[permit.host] else {
            return
        }
        // Only the permit that still owns the probe slot may clear it: a late release from an
        // abandoned probe must not free the slot the replacement probe is using.
        let ownsProbe = permit.isProbe && entry.probeIdentifier == permit.identifier
        if ownsProbe {
            entry.probeIdentifier = nil
        }

        guard let retryableFailure else {
            let wasOpen = entry.state != .closed
            entry.consecutiveFailures = 0
            entry.state = .closed
            entry.cooldownMilliseconds = CircuitBreaker.initialCooldownMilliseconds
            entry.probeIdentifier = nil
            hosts[permit.host] = entry
            if wasOpen {
                diagnostics.emit(
                    .breaker, code: "CIRCUIT_CLOSED", operation: "network.breaker",
                    message: "Requests to \(permit.host) resumed")
            }
            return
        }

        guard retryableFailure else {
            // A client error says nothing about the host's health, so it neither counts towards
            // opening the breaker nor closes it.
            hosts[permit.host] = entry
            return
        }

        entry.consecutiveFailures += 1

        if ownsProbe || entry.state == .halfOpen {
            entry.cooldownMilliseconds = min(
                entry.cooldownMilliseconds * 2, CircuitBreaker.maxCooldownMilliseconds)
            open(&entry, host: permit.host, reason: "the probe failed")
            hosts[permit.host] = entry
            return
        }

        if entry.state == .closed, entry.consecutiveFailures >= CircuitBreaker.failureThreshold {
            open(
                &entry, host: permit.host,
                reason: "\(entry.consecutiveFailures) consecutive failures")
        }
        hosts[permit.host] = entry
    }

    /// Releases a permit for work that never ran, without judging the host.
    public func abandon(_ permit: CircuitBreakerPermit) {
        release(permit, retryableFailure: false)
    }

    /// Reported state of `host`.
    public func state(host: String) -> CircuitBreakerState {
        return hosts[host]?.state ?? .closed
    }

    /// Moves every non-closed breaker to half-open so the next request probes immediately.
    ///
    /// Called on app foreground and on connectivity-restored. Does not reset the cooldown ladder.
    /// A probe that has outlived ``probeTimeoutMilliseconds`` is treated as lost so a wedged
    /// half-open host gets another chance; one still inside the timeout keeps its slot, so a
    /// foreground during an in-flight probe cannot hand out a second one.
    public func halfOpenAll() {
        let timestamp = clock.now()
        for (host, var entry) in hosts where entry.state != .closed {
            entry.state = .halfOpen
            if entry.probeIdentifier != nil,
                timestamp - entry.probeStartedAt >= CircuitBreaker.probeTimeoutMilliseconds
            {
                entry.probeIdentifier = nil
            }
            hosts[host] = entry
        }
    }

    /// Drops all breaker state.
    public func reset() {
        hosts = [:]
    }

    // One diagnostic per transition into `.open`: a breaker that flaps would otherwise emit on
    // every refused request.
    private func open(_ entry: inout HostState, host: String, reason: String) {
        let wasOpen = entry.state == .open
        entry.state = .open
        entry.openedAt = clock.now()
        entry.probeIdentifier = nil
        guard !wasOpen else {
            return
        }
        diagnostics.emit(
            .breaker, code: "CIRCUIT_OPEN", operation: "network.breaker", retryable: true,
            message:
                "Requests to \(host) paused after \(reason); retrying in \(Int(entry.cooldownMilliseconds)) ms"
        )
    }

    private func takeIdentifier() -> UInt64 {
        defer { nextIdentifier += 1 }
        return nextIdentifier
    }
}
