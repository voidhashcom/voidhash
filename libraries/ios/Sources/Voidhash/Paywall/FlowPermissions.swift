import Foundation
import VoidhashCore

#if os(iOS)
    import UserNotifications
#endif

/// Whether the user allowed a permission, as a flow reads it without asking.
public enum FlowPermissionStatus: String, Sendable, Equatable {
    case granted
    case denied
    /// Not asked yet: asking shows the system prompt.
    case notDetermined
    /// The platform has no such permission, or the app is not set up to ask for it.
    case unavailable
}

/// How the user answered a flow's request for a permission.
public enum FlowPermissionResult: String, Sendable, Equatable {
    case granted
    case denied
    /// The app could not ask: the platform has no such permission, or the app is not set up to
    /// ask for it.
    case unavailable
}

/// How the app reads and asks for one permission a flow requests, in place of the SDK's own
/// prompt, registered in ``VoidhashOptions/flowPermissionHandlers`` under the permission's
/// name: ``FlowCapability/notifications`` or ``FlowCapability/tracking``'s `rawValue`.
///
/// - The SDK calls both off the main actor, from its own tasks; hop to the main actor yourself
///   for UI work.
/// - `status` runs whenever a flow is configured and whenever the app becomes active while a
///   flow is shown, for each permission the app grants flows: keep it cheap, and never prompt
///   from it.
/// - `request` must return once the user answered, or at once when they decided before. Until
///   it returns, that flow's request waits, and so does any other flow's request for the same
///   permission. A presentation that ends stops waiting; once no presentation waits, the next
///   request calls `request` again.
/// - A handler cannot throw; answer ``FlowPermissionResult/unavailable`` for a failure.
///
/// The SDK asks for notifications itself (alert, badge and sound). It has no handler of its own
/// for tracking: register one to let flows ask for App Tracking Transparency; without one,
/// flows hear that tracking is unavailable.
public struct FlowPermissionHandler: Sendable {
    /// The permission's status, without asking.
    public var status: @Sendable () async -> FlowPermissionStatus
    /// Asks the user, or answers at once when they already decided.
    public var request: @Sendable () async -> FlowPermissionResult

    public init(
        status: @escaping @Sendable () async -> FlowPermissionStatus,
        request: @escaping @Sendable () async -> FlowPermissionResult
    ) {
        self.status = status
        self.request = request
    }
}

/// The handlers of the permissions flows ask for.
enum FlowPermissions {
    /// The app's handler of `permission`, else the SDK's own; `nil` when neither knows it, which
    /// flows read as unavailable.
    static func handler(
        of permission: String, app: [String: FlowPermissionHandler],
        warn: @escaping VoidhashWarningHandler
    ) -> FlowPermissionHandler? {
        return app[permission] ?? builtIn(permission, warn: warn)
    }

    /// The SDK's handler of `permission`: notifications only.
    static func builtIn(_ permission: String, warn: @escaping VoidhashWarningHandler)
        -> FlowPermissionHandler?
    {
        guard permission == FlowCapability.notifications.rawValue else {
            return nil
        }
        return FlowPermissionHandler(
            status: { await notificationStatus() },
            request: { await requestNotifications(warn: warn) })
    }

    private static func notificationStatus() async -> FlowPermissionStatus {
        #if os(iOS)
            switch await UNUserNotificationCenter.current().notificationSettings()
                .authorizationStatus
            {
            case .authorized, .ephemeral:
                return .granted
            case .denied:
                return .denied
            // Quiet notifications the user never chose: asking still shows the prompt.
            case .notDetermined, .provisional:
                return .notDetermined
            @unknown default:
                return .unavailable
            }
        #else
            return .unavailable
        #endif
    }

    private static func requestNotifications(warn: VoidhashWarningHandler) async
        -> FlowPermissionResult
    {
        #if os(iOS)
            do {
                let granted = try await UNUserNotificationCenter.current().requestAuthorization(
                    options: [.alert, .badge, .sound])
                return granted ? .granted : .denied
            } catch {
                warn("Asking for notification permission failed: \(error.localizedDescription)")
                return .unavailable
            }
        #else
            warn("A flow asked for notification permission, which this platform lacks")
            return .unavailable
        #endif
    }
}
