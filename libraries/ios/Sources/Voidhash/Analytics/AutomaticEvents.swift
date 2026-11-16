import Foundation

/// Names of the analytics events the SDK captures on the app's behalf.
///
/// The leading `$` marks them as reserved, next to the standardized `$app_version`-style
/// properties every event carries. Mirrors `AUTOMATIC_EVENTS` in the React Native SDK.
public enum AutomaticEvents {
    /// First launch the SDK has seen on this install (no cached release).
    public static let appInstalled = "$app_installed"
    /// Launch where the app build or version differs from the last seen one.
    public static let appUpdated = "$app_updated"
    /// Every SDK startup, after install/update has been resolved.
    public static let appOpened = "$app_opened"
    /// App moved to the background.
    public static let appBackgrounded = "$app_backgrounded"
    /// App returned to the foreground from a non-active state.
    public static let appBecameActive = "$app_became_active"
    /// The app ended in a crash the operating system recorded, reported at a later launch.
    public static let appCrashed = "$app_crashed"
    /// The identity was reset through ``VoidhashClient/reset()``.
    public static let signOut = "$sign_out"
    /// The user arrived on a screen (view controller, SwiftUI view, manual call).
    public static let screen = "$screen"
    /// The user opened a notification sent through Voidhash, reported by the app through
    /// ``VoidhashClient/trackPushOpened(userInfo:)``.
    public static let pushOpened = "$push_opened"
    /// An `identify` earlier releases queued as an event when the backend could not confirm it.
    /// The SDK now queues identifies as person writes; an `$identify` still waiting in the queue
    /// is sent with its alias as `$previous_distinct_id`.
    public static let identify = "$identify"
    /// A `setPersonAttributes` earlier releases queued as an event when the backend could not
    /// confirm it. The SDK now queues traits as person writes.
    public static let set = "$set"
}

/// What ``VoidhashClient/trackPushOpened(userInfo:)`` reads and records.
enum PushOpened {
    /// The custom data key Voidhash adds to every notification it sends, holding its send's id.
    static let sendIdDataKey = "voidhash_send_id"
    /// The `$push_opened` property naming the send.
    static let sendIdProperty = "push_notification_send_id"
}

/// Property names stamped on the built-in `$screen` event.
public enum ScreenProperties {
    /// Stable, low-cardinality identity of the screen (class name, route name).
    public static let name = "$screen_name"
    /// Concrete location, for example the controller chain the screen sits in.
    public static let path = "$screen_path"
    /// Human title when the platform exposes one.
    public static let title = "$screen_title"
    /// `$screen_name` of the screen the user came from; `null` for the first screen.
    public static let previousName = "$previous_screen_name"
    /// `$screen_path` of the screen the user came from; `null` for the first screen.
    public static let previousPath = "$previous_screen_path"
    /// Wall-clock milliseconds spent on the previous screen; `null` for the first screen.
    public static let previousDurationMs = "$previous_screen_duration_ms"
    /// Integration that produced the event (`uikit`, `swiftui`, `manual`).
    public static let source = "$screen_source"
    /// Screen params, string-coerced and capped at 20 keys. Only with `includeParams`.
    public static let params = "$screen_params"
}
