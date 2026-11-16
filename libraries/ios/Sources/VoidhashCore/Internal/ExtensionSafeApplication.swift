#if canImport(UIKit)
    import Foundation
    import UIKit

    /// Reaches the shared `UIApplication` without naming `UIApplication.shared`, which is
    /// unavailable to code linked into an app extension.
    public enum ExtensionSafeApplication {
        /// Whether the process is an app extension, which has no application.
        public static var isAppExtension: Bool {
            return Bundle.main.bundlePath.hasSuffix(".appex")
        }

        /// The running application; `nil` inside an app extension, where there is none.
        @MainActor
        public static var shared: UIApplication? {
            guard !isAppExtension else {
                return nil
            }
            let selector = NSSelectorFromString("sharedApplication")
            guard UIApplication.responds(to: selector) else {
                return nil
            }
            return UIApplication.perform(selector)?.takeUnretainedValue() as? UIApplication
        }
    }
#endif
