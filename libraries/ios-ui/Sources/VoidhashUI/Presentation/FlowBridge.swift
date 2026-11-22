#if os(iOS)
    import Foundation
    import UIKit

    /// The bridge envelopes a flow view writes and reads itself, whichever way it draws.
    package enum FlowBridge {
        /// The `context` envelope: the settings ABI 2 components read as `$context`, for the
        /// appearance and text size `traits` carry. Reduce Motion also settles the flow's own
        /// transitions, and the flow sizes its texts by `fontScale`.
        @MainActor
        package static func contextEnvelope(for traits: UITraitCollection) -> String? {
            var payload: [String: Any] = [
                "reducedMotion": UIAccessibility.isReduceMotionEnabled,
                "colorScheme": traits.userInterfaceStyle == .dark ? "dark" : "light",
                "fontScale": fontScale(for: traits),
            ]
            if let curve = fontScaleCurve(for: traits) {
                payload["fontScaleCurve"] = curve
            }
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

        /// The text styles the size curve samples, from caption 2 to large title. Headline
        /// shares body's size and is left out.
        private static let curveStyles: [UIFont.TextStyle] = [
            .caption2, .caption1, .footnote, .subheadline, .callout, .body, .title3, .title2,
            .title1, .largeTitle,
        ]

        /// The size Dynamic Type gives text style `style` in the content size category `traits`
        /// carry: the point size of UIKit's own font for it. `UIFontMetrics.scaledValue(for:)`
        /// approximates it (at the largest accessibility size it gives body text 48 points, not
        /// the 53 UIKit draws, and gives 12 points less than 11), so it is not used.
        private static func dynamicTypeSize(
            _ style: UIFont.TextStyle, _ traits: UITraitCollection
        ) -> Double {
            Double(UIFont.preferredFont(forTextStyle: style, compatibleWith: traits).pointSize)
        }

        /// The default content size category, Large, at which every text shows as designed.
        private static var defaultTraits: UITraitCollection {
            UITraitCollection(preferredContentSizeCategory: .large)
        }

        /// The end user's text size (Dynamic Type) as a multiple of the default, Large: the body
        /// text's size over its 17 points, so 1 at Large, about 0.82 at Extra Small and 3.12 at
        /// the largest accessibility size. It is the view's own category, within any limit the
        /// app sets on it (`maximumContentSizeCategory`). Components read it; the runtime sizes
        /// texts by the curve, so the views draw and measure the sizes they are given and never
        /// scale a text themselves.
        @MainActor
        package static func fontScale(for traits: UITraitCollection) -> Double {
            let scale = dynamicTypeSize(.body, traits) / dynamicTypeSize(.body, defaultTraits)
            return (scale * 1000).rounded() / 1000
        }

        /// How Dynamic Type grows text of each size in the content size category `traits`
        /// carry: `[size, shown size]` for each text style, its size at Large and its size in
        /// the category. Large text grows less than small text (at the largest accessibility
        /// size body text reaches 53 points and a large title 60), and the flow's runtime sizes
        /// a text of any size along this curve. Nil at Large, where every size stays as it is.
        @MainActor
        package static func fontScaleCurve(for traits: UITraitCollection) -> [[Double]]? {
            let curve = curveStyles.map { style in
                [dynamicTypeSize(style, defaultTraits), dynamicTypeSize(style, traits)]
            }
            return curve.allSatisfy({ $0[0] == $0[1] }) ? nil : curve
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
        /// appearance and the text size are trait changes, which the view observes itself.
        package static let contextNotifications: [Notification.Name] = [
            UIAccessibility.reduceMotionStatusDidChangeNotification,
            NSLocale.currentLocaleDidChangeNotification,
        ]
    }
#endif
