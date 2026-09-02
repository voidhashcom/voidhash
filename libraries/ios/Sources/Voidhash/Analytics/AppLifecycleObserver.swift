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
