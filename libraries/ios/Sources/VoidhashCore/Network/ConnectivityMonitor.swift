import Foundation

#if canImport(Network)
    import Network
#endif

/// Handle returned by ``ConnectivityMonitoring/observe(_:)``; cancelling stops the callbacks.
public protocol ConnectivitySubscription: Sendable {
    /// Stops delivering connectivity changes.
    func cancel()
}

/// Source of connectivity transitions.
///
/// The SDK only reacts to the rising edge (offline → online) by flushing queues and refreshing
/// anything stale, so implementations may report duplicates.
public protocol ConnectivityMonitoring: Sendable {
    /// Starts observing; `handler` receives `true` when the device has a usable path.
    func observe(_ handler: @escaping @Sendable (Bool) -> Void) -> any ConnectivitySubscription
    /// Whether the path the device is on is one to save data on: cellular or a personal hotspot,
    /// or one the user put in Low Data Mode. Work nobody waits for, such as fetching a flow's
    /// images before it is shown, is left out there. `false` while nothing is known of the path.
    var isExpensiveOrConstrained: Bool { get }
}

extension ConnectivityMonitoring {
    public var isExpensiveOrConstrained: Bool {
        return false
    }
}

/// Monitor that never reports anything, used where no connectivity API exists.
public struct NoopConnectivityMonitor: ConnectivityMonitoring {
    private struct Subscription: ConnectivitySubscription {
        func cancel() {}
    }

    public init() {}

    public func observe(_ handler: @escaping @Sendable (Bool) -> Void)
        -> any ConnectivitySubscription
    {
        return Subscription()
    }
}

/// Monitor driven by tests: ``send(_:)`` publishes a transition synchronously.
public final class FakeConnectivityMonitor: ConnectivityMonitoring, @unchecked Sendable {
    private final class Subscription: ConnectivitySubscription, @unchecked Sendable {
        private let onCancel: @Sendable () -> Void

        init(onCancel: @escaping @Sendable () -> Void) {
            self.onCancel = onCancel
        }

        func cancel() {
            onCancel()
        }
    }

    private let lock = NSLock()
    private var handlers: [@Sendable (Bool) -> Void] = []

    public init() {}

    public func observe(_ handler: @escaping @Sendable (Bool) -> Void)
        -> any ConnectivitySubscription
    {
        lock.withLock { handlers.append(handler) }
        return Subscription(onCancel: { [weak self] in
            self?.lock.withLock { self?.handlers.removeAll() }
        })
    }

    /// Publishes a connectivity transition to every observer.
    public func send(_ isOnline: Bool) {
        let current = lock.withLock { handlers }
        for handler in current {
            handler(isOnline)
        }
    }
}

#if canImport(Network)
    /// `NWPathMonitor` backed connectivity source.
    public final class NetworkPathConnectivityMonitor: ConnectivityMonitoring, @unchecked Sendable {
        private final class Subscription: ConnectivitySubscription, @unchecked Sendable {
            private let monitor: NWPathMonitor

            init(monitor: NWPathMonitor) {
                self.monitor = monitor
            }

            func cancel() {
                monitor.cancel()
            }
        }

        private let lock = NSLock()
        private var savesData = false

        public init() {}

        /// As of the latest path an observation reported.
        public var isExpensiveOrConstrained: Bool {
            return lock.withLock { savesData }
        }

        public func observe(_ handler: @escaping @Sendable (Bool) -> Void)
            -> any ConnectivitySubscription
        {
            let monitor = NWPathMonitor()
            monitor.pathUpdateHandler = { [weak self] path in
                self?.lock.withLock {
                    self?.savesData = path.isExpensive || path.isConstrained
                }
                handler(path.status == .satisfied)
            }
            monitor.start(queue: DispatchQueue(label: "com.voidhash.sdk.connectivity"))
            return Subscription(monitor: monitor)
        }
    }
#endif

/// The connectivity monitor to use on this platform.
public enum DefaultConnectivityMonitor {
    /// `NWPathMonitor` where `Network` is available, otherwise a no-op monitor.
    public static var current: any ConnectivityMonitoring {
        #if canImport(Network)
            return NetworkPathConnectivityMonitor()
        #else
            return NoopConnectivityMonitor()
        #endif
    }
}
