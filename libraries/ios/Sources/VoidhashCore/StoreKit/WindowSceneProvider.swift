#if canImport(UIKit)
    import UIKit

    /// Resolves the `UIWindowScene` used to confirm purchases and to present the subscription
    /// management sheet. Injected so hosts (and tests) can supply their own scene lookup.
    public protocol WindowSceneProviding: Sendable {
        @MainActor func currentWindowScene() -> UIWindowScene?
    }

    /// Default provider: the app's window scene the user is looking at.
    ///
    /// With several scenes connected (iPad multi-window, an external display, a scene left in
    /// the background) it prefers the foreground-active one, then a foreground-inactive one
    /// (a system alert or the app switcher is over it), then any other, and an app window
    /// before a window on an external display. Scenes that are not window scenes, such as
    /// CarPlay's, are never returned. Finds no scene inside an app extension.
    public struct DefaultWindowSceneProvider: WindowSceneProviding {
        public init() {}

        @MainActor public func currentWindowScene() -> UIWindowScene? {
            let scenes =
                ExtensionSafeApplication.shared?.connectedScenes
                .compactMap { $0 as? UIWindowScene } ?? []
            return scenes.min { first, second in
                Self.presentationRank(
                    activationState: first.activationState,
                    isApplicationWindow: first.session.role == .windowApplication)
                    < Self.presentationRank(
                        activationState: second.activationState,
                        isApplicationWindow: second.session.role == .windowApplication)
            }
        }

        /// Orders scenes for presenting a sheet; the lowest rank is presented on.
        static func presentationRank(
            activationState: UIScene.ActivationState, isApplicationWindow: Bool
        ) -> Int {
            let activation: Int
            switch activationState {
            case .foregroundActive: activation = 0
            case .foregroundInactive: activation = 1
            default: activation = 2
            }
            return (isApplicationWindow ? 0 : 3) + activation
        }
    }
#endif
