import Foundation
import VoidhashCore

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
    /// The state the application is in right now; `nil` where there is no application to ask.
    func currentState() async -> String?
}

/// Observer that never reports anything, used where no application lifecycle exists.
struct NoopAppLifecycleObserver: AppLifecycleObserving {
    private struct Subscription: AppLifecycleSubscription {
        func cancel() {}
    }

    func subscribe(_ handler: @escaping @Sendable (String) -> Void) -> any AppLifecycleSubscription {
        return Subscription()
    }

    func currentState() async -> String? {
        return nil
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

        func currentState() async -> String? {
            return await MainActor.run { () -> String? in
                guard let state = ExtensionSafeApplication.shared?.applicationState else {
                    return nil
                }
                switch state {
                case .active:
                    return LifecycleTracker.active
                case .inactive:
                    return LifecycleTracker.inactive
                case .background:
                    return LifecycleTracker.background
                @unknown default:
                    return nil
                }
            }
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

/// One background execution grant, ended exactly once.
///
/// The expiration handler and the normal completion both end the grant, and the expiration
/// handler can run before the identifier the grant began with is recorded. An end requested that
/// early is remembered and applied as soon as the identifier arrives, so the grant never outlives
/// its expiry.
@MainActor
final class BackgroundTaskGrant<Identifier: Sendable> {
    private let endTask: (Identifier) -> Void
    private var identifier: Identifier?
    private var endRequested = false
    private var ended = false

    /// - Parameter endTask: Ends the platform task `identifier` names; called at most once.
    init(endTask: @escaping (Identifier) -> Void) {
        self.endTask = endTask
    }

    /// Records the identifier the grant began with, ending it at once when an end was requested
    /// before it arrived.
    func begin(_ identifier: Identifier) {
        guard self.identifier == nil, !ended else {
            return
        }
        self.identifier = identifier
        if endRequested {
            end()
        }
    }

    /// Ends the grant, or asks for it to end as soon as it has begun.
    func end() {
        guard !ended else {
            return
        }
        guard let identifier else {
            endRequested = true
            return
        }
        ended = true
        endTask(identifier)
    }
}

#if canImport(UIKit)
    /// Wraps the work in a `UIApplication` background task. Inside an app extension, which has
    /// no application to grant one, the work runs without it.
    struct UIApplicationBackgroundTaskRunner: BackgroundTaskRunning {
        func run(_ name: String, _ work: @escaping @Sendable () async -> Void) async {
            let task = Task { await work() }
            // The task begins and its identifier is recorded in one main-actor step: the
            // expiration handler also runs on the main actor, so it cannot land in between.
            let grant: BackgroundTaskGrant<UIBackgroundTaskIdentifier>? = await MainActor.run {
                guard let application = ExtensionSafeApplication.shared else {
                    return nil
                }
                let grant = BackgroundTaskGrant<UIBackgroundTaskIdentifier> { identifier in
                    if identifier != .invalid {
                        application.endBackgroundTask(identifier)
                    }
                }
                let identifier = application.beginBackgroundTask(withName: name) {
                    task.cancel()
                    grant.end()
                }
                grant.begin(identifier)
                return grant
            }
            await task.value
            await grant?.end()
        }
    }
#endif
