import Foundation

/// Lock-guarded boolean shared between components that read it live: the observer-mode flag the
/// header builder and the purchase orchestrator consult, and the outbound-paused flag set when
/// the publishable key is rejected.
public final class AtomicBool: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: Bool

    public init(_ value: Bool) {
        storage = value
    }

    public var value: Bool {
        get { lock.withLock { storage } }
        set { lock.withLock { storage = newValue } }
    }
}
