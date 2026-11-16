import Foundation
import VoidhashCore

#if os(iOS)
    import AppTrackingTransparency
    import UserNotifications
#endif

/// Asks the user for the system permissions a flow can request.
public enum FlowPermissions {
    /// Shows the system prompt for `permission` (or answers without one when the user already
    /// decided) and returns whether it is granted.
    public static func request(_ permission: FlowPermission, warn: VoidhashWarningHandler) async
        -> Bool
    {
        #if os(iOS)
            switch permission {
            case .notifications:
                do {
                    return try await UNUserNotificationCenter.current().requestAuthorization(
                        options: [.alert, .badge, .sound])
                } catch {
                    warn("Asking for notification permission failed: \(error.localizedDescription)")
                    return false
                }
            case .tracking:
                // Asking without a usage description terminates the app.
                guard Bundle.main.object(forInfoDictionaryKey: "NSUserTrackingUsageDescription")
                    != nil
                else {
                    warn(
                        "A flow asked for tracking permission, but the app's Info.plist has no NSUserTrackingUsageDescription"
                    )
                    return false
                }
                guard #available(iOS 14, *) else {
                    return true
                }
                return await ATTrackingManager.requestTrackingAuthorization() == .authorized
            }
        #else
            warn("A flow asked for \(permission.rawValue) permission, which this platform lacks")
            return false
        #endif
    }
}
