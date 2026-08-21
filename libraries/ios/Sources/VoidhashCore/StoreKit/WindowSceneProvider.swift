#if canImport(UIKit)
    import UIKit

    /// Resolves the `UIWindowScene` used to confirm purchases and to present the subscription
    /// management sheet. Injected so hosts (and tests) can supply their own scene lookup.
    public protocol WindowSceneProviding: Sendable {
        @MainActor func currentWindowScene() -> UIWindowScene?
    }

    /// Default provider using the first connected scene, matching the React Native behaviour.
    public struct DefaultWindowSceneProvider: WindowSceneProviding {
        public init() {}

        @MainActor public func currentWindowScene() -> UIWindowScene? {
            return UIApplication.shared.connectedScenes.first as? UIWindowScene
        }
    }
#endif
