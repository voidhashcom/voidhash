import Foundation

#if canImport(UIKit)
    import UIKit
#endif

/// Handle returned by ``AppLifecycleObserving/subscribe(_:)``; cancelling stops the callbacks.
protocol AppLifecycleSubscription: Sendable {
    func cancel()
}

/// Source of application state transitions, injectable so tests can drive them by hand.
///
/// States are the ``LifecycleTracker`` strings: `active`, `inactive`, `background`.
protocol AppLifecycleObserving: Sendable {
    func subscribe(_ handler: @escaping @Sendable (String) -> Void) -> any AppLifecycleSubscription
}

/// Observer that never reports anything, used where no application lifecycle exists.
struct NoopAppLifecycleObserver: AppLifecycleObserving {
    private struct Subscription: AppLifecycleSubscription {
        func cancel() {}
    }

    func subscribe(_ handler: @escaping @Sendable (String) -> Void) -> any AppLifecycleSubscription {
        return Subscription()
    }
}

#if canImport(UIKit)
    /// Forwards `UIApplication` state notifications.
    struct NotificationCenterLifecycleObserver: AppLifecycleObserving {
        private final class Subscription: AppLifecycleSubscription, @unchecked Sendable {
            private let center: NotificationCenter
            private let tokens: [NSObjectProtocol]

            init(center: NotificationCenter, tokens: [NSObjectProtocol]) {
                self.center = center
                self.tokens = tokens
            }

            func cancel() {
                for token in tokens {
                    center.removeObserver(token)
                }
            }
        }

        private let center: NotificationCenter

        init(center: NotificationCenter = .default) {
            self.center = center
        }

        func subscribe(_ handler: @escaping @Sendable (String) -> Void)
            -> any AppLifecycleSubscription
        {
            let transitions: [(Notification.Name, String)] = [
                (UIApplication.didBecomeActiveNotification, LifecycleTracker.active),
                (UIApplication.willResignActiveNotification, LifecycleTracker.inactive),
                (UIApplication.didEnterBackgroundNotification, LifecycleTracker.background),
            ]
            let tokens = transitions.map { name, state in
                center.addObserver(forName: name, object: nil, queue: nil) { _ in
                    handler(state)
                }
            }
            return Subscription(center: center, tokens: tokens)
        }
    }
#endif

/// Keeps the process alive while work started on backgrounding finishes.
///
/// Injectable so tests can observe the work without a `UIApplication`.
protocol BackgroundTaskRunning: Sendable {
    /// Runs `work`, holding an execution grant for its duration where the platform offers one.
    /// The work is cancelled if the grant expires first.
    func run(_ name: String, _ work: @escaping @Sendable () async -> Void) async
}

/// Runner that offers no grant; the work runs as it would in the foreground.
struct NoopBackgroundTaskRunner: BackgroundTaskRunning {
    func run(_ name: String, _ work: @escaping @Sendable () async -> Void) async {
        await work()
    }
}

#if canImport(UIKit)
    /// Wraps the work in a `UIApplication` background task.
    struct UIApplicationBackgroundTaskRunner: BackgroundTaskRunning {
        private final class Grant: @unchecked Sendable {
            private let lock = NSLock()
            private var identifier: UIBackgroundTaskIdentifier = .invalid
            private var ended = false

            func begin(_ identifier: UIBackgroundTaskIdentifier) {
                lock.withLock { self.identifier = identifier }
            }

            /// Ends the grant exactly once; the expiration handler and the normal path race.
            @MainActor
            func end() {
                let identifier: UIBackgroundTaskIdentifier? = lock.withLock {
                    guard !ended else {
                        return nil
                    }
                    ended = true
                    return self.identifier
                }
                if let identifier, identifier != .invalid {
                    UIApplication.shared.endBackgroundTask(identifier)
                }
            }
        }

        func run(_ name: String, _ work: @escaping @Sendable () async -> Void) async {
            let grant = Grant()
            let task = Task { await work() }
            let identifier = await MainActor.run {
                UIApplication.shared.beginBackgroundTask(withName: name) {
                    task.cancel()
                    grant.end()
                }
            }
            grant.begin(identifier)
            await task.value
            await grant.end()
        }
    }
#endif
