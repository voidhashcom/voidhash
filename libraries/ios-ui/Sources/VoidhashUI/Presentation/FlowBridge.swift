#if os(iOS)
    import Foundation
    import UIKit

    /// The bridge envelopes a flow view writes and reads itself, whichever way it draws.
    package enum FlowBridge {
        /// The `context` envelope: the settings ABI 2 components read as `$context`, for the
        /// appearance `traits` carry. Reduce Motion also settles the flow's own transitions.
        @MainActor
        package static func contextEnvelope(for traits: UITraitCollection) -> String? {
            var payload: [String: Any] = [
                "reducedMotion": UIAccessibility.isReduceMotionEnabled,
                "colorScheme": traits.userInterfaceStyle == .dark ? "dark" : "light",
            ]
            // The same locale the SDK reports for the device.
            if let locale = Locale.preferredLanguages.first {
                payload["locale"] = locale
            }
            let envelope: [String: Any] = ["version": 1, "type": "context", "payload": payload]
            guard
                let data = try? JSONSerialization.data(
                    withJSONObject: envelope, options: [.sortedKeys])
            else {
                return nil
            }
            return String(data: data, encoding: .utf8)
        }

        /// The URL of a `loadImage` envelope, which the view serves itself.
        package static func imageRequestUrl(_ message: String) -> String? {
            guard message.contains("\"loadImage\""),
                let object = try? JSONSerialization.jsonObject(with: Data(message.utf8))
                    as? [String: Any],
                object["type"] as? String == "loadImage",
                let payload = object["payload"] as? [String: Any]
            else {
                return nil
            }
            return payload["url"] as? String
        }

        /// Notifications after which the `context` envelope may read differently. The
        /// appearance is a trait change, which the view observes itself.
        package static let contextNotifications: [Notification.Name] = [
            UIAccessibility.reduceMotionStatusDidChangeNotification,
            NSLocale.currentLocaleDidChangeNotification,
        ]
    }
#endif
