import Foundation

/// Turns raw application state transitions into `$app_backgrounded` / `$app_became_active`.
///
/// Pure so it can be unit tested without UIKit. Mirrors the React Native `LifecycleService`:
/// entering the background always emits, while becoming active only emits when a prior
/// non-active state was observed, so the launch-time activation is silent.
struct LifecycleTracker: Sendable, Equatable {
    static let active = "active"
    static let inactive = "inactive"
    static let background = "background"

    private(set) var previousState: String?

    init(previousState: String? = nil) {
        self.previousState = previousState
    }

    /// Records `state` and returns the automatic event it triggers, if any.
    mutating func transition(to state: String) -> String? {
        defer { previousState = state }

        if state == LifecycleTracker.background {
            return previousState == LifecycleTracker.background
                ? nil : AutomaticEvents.appBackgrounded
        }

        if state == LifecycleTracker.active, let previousState,
            previousState != LifecycleTracker.active
        {
            return AutomaticEvents.appBecameActive
        }

        return nil
    }
}
