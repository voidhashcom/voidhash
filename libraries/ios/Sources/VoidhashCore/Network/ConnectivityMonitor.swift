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

        public init() {}

        public func observe(_ handler: @escaping @Sendable (Bool) -> Void)
            -> any ConnectivitySubscription
        {
            let monitor = NWPathMonitor()
            monitor.pathUpdateHandler = { path in
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
