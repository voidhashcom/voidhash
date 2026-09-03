import Foundation
import ObjectiveC

#if canImport(UIKit)
    import SwiftUI
    import UIKit

    /// Installs the one-time `viewDidAppear(_:)` swizzle that feeds app view controllers to the
    /// shared client.
    ///
    /// The replacement forwards to whatever ``Voidhash/shared`` is at the time, so reconfiguring
    /// picks up the new client without touching the runtime again.
    enum UIKitScreenTracking {
        private static let installation: Void = {
            let original = #selector(UIViewController.viewDidAppear(_:))
            let replacement = #selector(UIViewController.voidhash_viewDidAppear(_:))
            guard let originalMethod = class_getInstanceMethod(UIViewController.self, original),
                let replacementMethod = class_getInstanceMethod(UIViewController.self, replacement)
            else {
                return
            }
            method_exchangeImplementations(originalMethod, replacementMethod)
        }()

        /// Decides whether a controller class belongs to the host app rather than a framework.
        /// Overridable because in an xctest process `Bundle.main` is the test runner, not the
        /// bundle the test's controllers live in.
        nonisolated(unsafe) static var isAppClass: @Sendable (AnyClass) -> Bool = { type in
            Bundle(for: type) == Bundle.main
        }

        private static let screenQueue = SerialTaskQueue()

        static func install() {
            _ = installation
        }

        @MainActor
        static func handle(_ viewController: UIViewController) {
            guard let client = Voidhash.shared else {
                return
            }
            let descriptor = describe(viewController)
            screenQueue.enqueue { await client.trackAutomaticScreen(descriptor) }
        }

        @MainActor
        static func describe(_ viewController: UIViewController) -> ScreenControllerDescriptor {
            let type = Swift.type(of: viewController)
            var chain: [String] = []
            var ancestor = viewController.parent
            while let current = ancestor {
                chain.insert(ScreenControllerDescriptor.unqualifiedClassName(Swift.type(of: current)), at: 0)
                ancestor = current.parent
            }

            return ScreenControllerDescriptor(
                identity: identity(of: viewController),
                className: ScreenControllerDescriptor.unqualifiedClassName(type),
                isAppClass: isAppClass(type),
                isContainer: isContainer(viewController),
                isHostingController: isHostingController(type),
                parentKind: parentKind(of: viewController.parent),
                parentChain: chain,
                title: viewController.navigationItem.title ?? viewController.title
            )
        }

        private nonisolated(unsafe) static var identityKey: UInt8 = 0

        /// Per-instance token, assigned on first sight. Addresses get reused after deallocation,
        /// so `ObjectIdentifier` would dedupe a new controller against the one it replaced.
        @MainActor
        private static func identity(of viewController: UIViewController) -> String {
            if let existing = objc_getAssociatedObject(viewController, &identityKey) as? String {
                return existing
            }
            let identity = UUID().uuidString
            objc_setAssociatedObject(
                viewController, &identityKey, identity, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
            return identity
        }

        private static func parentKind(of parent: UIViewController?)
            -> ScreenControllerDescriptor.ParentKind
        {
            guard let parent else {
                return .none
            }
            return isContainer(parent) ? .container : .other
        }

        private static func isContainer(_ viewController: UIViewController) -> Bool {
            return viewController is UINavigationController || viewController is UITabBarController
                || viewController is UISplitViewController
        }

        private static func isHostingController(_ type: AnyClass) -> Bool {
            var current: AnyClass? = type
            while let candidate = current {
                if NSStringFromClass(candidate).hasSuffix("UIHostingController") {
                    return true
                }
                current = class_getSuperclass(candidate)
            }
            return false
        }
    }

    extension UIViewController {
        @objc dynamic func voidhash_viewDidAppear(_ animated: Bool) {
            // After the exchange this selector holds the original implementation.
            voidhash_viewDidAppear(animated)
            UIKitScreenTracking.handle(self)
        }
    }
#endif
