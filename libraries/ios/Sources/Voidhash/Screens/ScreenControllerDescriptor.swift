import Foundation

/// The facts about a view controller the automatic UIKit screen filter needs, detached from
/// `UIViewController` so the filter and naming rules are testable without a view hierarchy.
struct ScreenControllerDescriptor: Sendable, Equatable {
    enum ParentKind: Sendable {
        /// No parent: a root or presented controller.
        case none
        /// A navigation, tab bar or split view controller.
        case container
        /// Any other parent; the controller is a part of a screen, not a screen.
        case other
    }

    /// Identity token of the controller instance.
    var identity: String
    /// Class name without the module prefix.
    var className: String
    /// Whether the class is defined by the host app rather than a framework.
    var isAppClass: Bool
    /// Whether the controller is itself a navigation, tab bar or split view controller, including
    /// app-defined subclasses, which are never screens of their own.
    var isContainer: Bool
    /// Whether the controller is a `UIHostingController` or a subclass of one.
    var isHostingController: Bool
    var parentKind: ParentKind
    /// Class names of the `parent` chain, outermost first.
    var parentChain: [String]
    var title: String?

    /// Applies the §5.2 filter rules and builds the ``ScreenView`` for a controller that counts
    /// as a screen; `nil` for containers, framework classes, embedded children and, once a SwiftUI
    /// screen has fired, hosting controllers.
    static func screenView(
        for descriptor: ScreenControllerDescriptor, suppressHostingControllers: Bool
    ) -> ScreenView? {
        guard descriptor.isAppClass, !descriptor.isContainer else {
            return nil
        }
        guard descriptor.parentKind != .other else {
            return nil
        }
        if suppressHostingControllers, descriptor.isHostingController {
            return nil
        }

        let chain = descriptor.parentChain + [descriptor.className]
        let title = descriptor.title?.trimmingCharacters(in: .whitespacesAndNewlines)
        return ScreenView(
            identity: descriptor.identity,
            name: descriptor.className,
            path: "/" + chain.joined(separator: "/"),
            title: (title?.isEmpty ?? true) ? nil : title,
            source: .uikit
        )
    }

    /// Class name without a module prefix, for Swift and Objective-C classes alike.
    static func unqualifiedClassName(_ type: AnyClass) -> String {
        let full = String(describing: type)
        guard let dot = full.lastIndex(of: ".") else {
            return full
        }
        return String(full[full.index(after: dot)...])
    }
}
