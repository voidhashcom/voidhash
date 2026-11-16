import Foundation

/// Whether the end user agreed to usage analytics.
///
/// Analytics consent covers what the SDK observes: events (custom, screen, lifecycle and paywall
/// events), sessions and install attribution. What the app says about the end user is not
/// covered: purchases, restores, entitlements, identity, person traits, groups, feature flags
/// and paywalls work the same whatever its value. Under `denied` and `pending` no event is
/// collected, queued or sent until consent is `granted`; the two differ only when the SDK is
/// configured to hold events while consent is `pending` (``PendingAnalytics/buffer``).
public enum AnalyticsConsent: String, Sendable, Equatable, CaseIterable {
    /// The end user agreed to usage analytics.
    case granted
    /// The end user declined usage analytics.
    case denied
    /// The end user has not decided yet.
    case pending
}

/// What happens to analytics events that occur while analytics consent is `pending`.
public enum PendingAnalytics: String, Sendable, Equatable, CaseIterable {
    /// The events are dropped.
    case drop
    /// The events are held in memory, at most 100 of them, and recorded once consent is
    /// `granted`; a `denied` decision discards them.
    case buffer
}
