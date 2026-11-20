import Foundation
import Voidhash
import VoidhashCore

#if os(iOS)
    import UIKit

    /// A view that shows one flow package and speaks the flow bridge: what every way of
    /// drawing a flow offers the full-screen presenter.
    @MainActor
    package protocol FlowViewHost: UIView {
        /// Receives every envelope the flow emits, as JSON.
        var onMessage: ((String) -> Void)? { get set }
        /// Receives renderer failures that do not stop the flow.
        var onError: ((String) -> Void)? { get set }
        /// Receives the reason, once, when the flow can no longer be shown.
        var onFailure: ((String) -> Void)? { get set }
        /// Validates `package` and shows it.
        func load(package: Data) throws
        /// Shows `package` with `runtimeModule`, which ``prepareRuntimeModule(_:)`` got ready,
        /// or, for `nil`, as ``load(package:)`` does.
        func load(package: Data, runtimeModule: SdkResolvedPaywall.FlowPackage.RuntimeModule?)
            throws
        /// Delivers a host → flow bridge envelope.
        func postMessage(_ message: String)
        /// The runtime module the release `flowPackage` describes is shown with, or `nil` when
        /// none has to be prepared; the release is then shown only if the view reads its
        /// package's format.
        nonisolated static func runtimeModule(
            for flowPackage: SdkResolvedPaywall.FlowPackage
        ) -> SdkResolvedPaywall.FlowPackage.RuntimeModule?
        /// Gets `runtimeModule` ready to show a release with, before the release is presented.
        ///
        /// - Throws: When no module that runs the release is available.
        nonisolated static func prepareRuntimeModule(
            _ runtimeModule: SdkResolvedPaywall.FlowPackage.RuntimeModule
        ) async throws
    }

    extension FlowViewHost {
        /// Shows every package as ``load(package:)`` does.
        package func load(
            package: Data, runtimeModule: SdkResolvedPaywall.FlowPackage.RuntimeModule?
        ) throws {
            try load(package: package)
        }

        package nonisolated static func runtimeModule(
            for flowPackage: SdkResolvedPaywall.FlowPackage
        ) -> SdkResolvedPaywall.FlowPackage.RuntimeModule? {
            return nil
        }

        package nonisolated static func prepareRuntimeModule(
            _ runtimeModule: SdkResolvedPaywall.FlowPackage.RuntimeModule
        ) async throws {}
    }

    /// Presents flow packages full screen, one at a time, in a `View`. The SDK's flow
    /// coordinator handles every message; this only relays them.
    ///
    /// UIKit silently drops a transition that overlaps another one or starts from a controller
    /// that cannot present, and calls no completion handler for it. So no transition is taken
    /// for granted here: `show` answers whether the flow really got on screen, `dismiss` returns
    /// once it really left, and neither waits forever for a handler UIKit may never call.
    package final class FlowPresenter<View: FlowViewHost>: FlowPresenting,
        @unchecked Sendable
    {
        // Sendable by hand: the SDK calls the presenter from any task, and every member it
        // reads off the main actor is immutable; `presented` is only touched on the main actor.

        /// How long a transition is waited for before its outcome is read off the controllers
        /// instead. Several times what an animated transition takes.
        private static var transitionTimeout: TimeInterval { 2 }

        private let context: FlowRendererContext
        private let packageAbiVersions: ClosedRange<Int>
        private let makeView: @MainActor @Sendable (FlowImageStore?) -> View
        /// Main-thread state. Weak, because UIKit owns a presented controller and releases it
        /// when it left the screen, whoever dismissed it.
        private weak var presented: FlowViewController<View>?

        /// - Parameters:
        ///   - packageAbiVersions: The flow package versions `View` reads.
        ///   - makeView: Creates the view a flow is shown in, with the SDK's image store.
        package init(
            context: FlowRendererContext, packageAbiVersions: ClosedRange<Int>,
            makeView: @escaping @MainActor @Sendable (FlowImageStore?) -> View
        ) {
            self.context = context
            self.packageAbiVersions = packageAbiVersions
            self.makeView = makeView
        }

        package func supportsFlowPackage(abiVersion: Int) -> Bool {
            return packageAbiVersions.contains(abiVersion)
        }

        /// A release shown with a runtime module is shown whatever its package's format: the
        /// module reads its package, not this SDK.
        package func supportsFlowPackage(_ flowPackage: SdkResolvedPaywall.FlowPackage) -> Bool {
            if View.runtimeModule(for: flowPackage) != nil {
                return true
            }
            return supportsFlowPackage(abiVersion: flowPackage.abiVersion)
        }

        package func show(
            locationSlug: String,
            package: Data,
            onBridgeEvent: FlowMessageHandler?,
            onDismiss: FlowDismissedHandler?,
            onFailure: FlowFailedHandler?
        ) async throws -> Bool {
            return try await present(
                locationSlug: locationSlug, package: package, runtimeModule: nil,
                onBridgeEvent: onBridgeEvent, onDismiss: onDismiss, onFailure: onFailure)
        }

        package func show(
            locationSlug: String,
            package: Data,
            flowPackage: SdkResolvedPaywall.FlowPackage,
            onBridgeEvent: FlowMessageHandler?,
            onDismiss: FlowDismissedHandler?,
            onFailure: FlowFailedHandler?
        ) async throws -> Bool {
            let runtimeModule = View.runtimeModule(for: flowPackage)
            if let runtimeModule {
                do {
                    try await View.prepareRuntimeModule(runtimeModule)
                } catch {
                    context.warn(
                        "The flow runtime for \"\(locationSlug)\" is not available: \(error)")
                    return false
                }
            }
            return try await present(
                locationSlug: locationSlug, package: package, runtimeModule: runtimeModule,
                onBridgeEvent: onBridgeEvent, onDismiss: onDismiss, onFailure: onFailure)
        }

        package func dismiss() async throws {
            await dismissPresented()
        }

        package func postMessage(locationSlug: String, data: String) {
            Task { @MainActor in
                guard let presented = self.presented, presented.locationSlug == locationSlug
                else {
                    return
                }
                presented.flowView.postMessage(data)
            }
        }

        @MainActor
        private func present(
            locationSlug: String,
            package: Data,
            runtimeModule: SdkResolvedPaywall.FlowPackage.RuntimeModule?,
            onBridgeEvent: FlowMessageHandler?,
            onDismiss: FlowDismissedHandler?,
            onFailure: FlowFailedHandler?
        ) async throws -> Bool {
            // The SDK dismisses a flow before it shows the next, so normally nothing is here.
            await dismissPresented()

            let controller = FlowViewController(
                locationSlug: locationSlug, flowView: makeView(context.imageStore))
            let flowView = controller.flowView
            let warn = context.warn
            flowView.onMessage = { message in onBridgeEvent?(message) }
            flowView.onError = { message in warn("[\(locationSlug)] \(message)") }
            flowView.onFailure = { message in onFailure?(message) }
            do {
                try flowView.load(package: package, runtimeModule: runtimeModule)
            } catch {
                warn("The flow for \"\(locationSlug)\" could not be shown: \(error)")
                return false
            }

            guard let candidate = context.presentingViewController() else {
                throw VoidhashStoreError.paywallPresenterNotAvailable
            }
            // A transition the controller is part of has to end first, such as the dismissal
            // of a screen the app closed just before. What is on top can differ afterwards.
            await Self.settle(candidate.presentedViewController ?? candidate)
            guard let presenting = context.presentingViewController() else {
                throw VoidhashStoreError.paywallPresenterNotAvailable
            }
            // UIKit presents only from a controller that is on screen and presents nothing.
            guard presenting.viewIfLoaded?.window != nil,
                presenting.presentedViewController == nil
            else {
                warn(
                    "The flow for \"\(locationSlug)\" could not be presented from \(type(of: presenting)): it is not on screen, or is presenting another view controller"
                )
                return false
            }

            let presented = await Self.transition { completion in
                presenting.present(controller, animated: true, completion: completion)
                // UIKit links the two controllers before `present` returns, unless it dropped
                // the presentation.
                guard controller.presentingViewController != nil else {
                    return false
                }
                self.presented = controller
                controller.onLeftScreen = onDismiss
                return true
            }
            if !presented {
                warn(
                    "The flow for \"\(locationSlug)\" could not be presented from \(type(of: presenting))"
                )
            }
            return presented
        }

        /// Takes the presented flow off the screen and returns once it has left.
        @MainActor
        private func dismissPresented() async {
            guard let controller = presented else {
                return
            }
            // A dismissal UIKit dropped is asked for once more, without animation, which leaves
            // nothing for another transition to overlap.
            for animated in [true, false] {
                // A transition in flight has to end first, such as one of the app's own on
                // top of the flow.
                await Self.settle(controller)
                guard let presenting = controller.presentingViewController else {
                    break
                }
                // Through the presenting controller, so the flow itself goes, together with
                // whatever the app presented on top of it. `controller.dismiss` would dismiss
                // only what is on top and leave the flow on screen.
                await Self.transition { completion in
                    presenting.dismiss(animated: animated, completion: completion)
                    return true
                }
            }
            guard controller.presentingViewController == nil else {
                context.warn(
                    "The flow for \"\(controller.locationSlug)\" could not be dismissed")
                return
            }
            presented = nil
            controller.leftScreen()
        }

        /// Waits for the transition `controller` is part of, if there is one.
        @MainActor
        private static func settle(_ controller: UIViewController) async {
            await transition { completion in
                guard let coordinator = controller.transitionCoordinator else {
                    return false
                }
                return coordinator.animate(alongsideTransition: nil) { _ in completion() }
            }
        }

        /// Starts a UIKit transition and waits for its completion handler.
        ///
        /// UIKit calls the handler at most once, and never for a transition it dropped or
        /// whose controllers went away halfway. So `start` answers whether the transition
        /// began, and the wait ends after ``transitionTimeout`` at the latest.
        ///
        /// - Returns: Whether the transition began.
        @MainActor
        @discardableResult
        private static func transition(
            _ start: (_ completion: @escaping @MainActor () -> Void) -> Bool
        ) async -> Bool {
            let wait = TransitionWait()
            let timeout = transitionTimeout
            return await withCheckedContinuation { continuation in
                wait.continuation = continuation
                guard start({ wait.finish(began: true) }) else {
                    wait.finish(began: false)
                    return
                }
                Task { @MainActor in
                    try? await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
                    wait.finish(began: true)
                }
            }
        }
    }

    /// Resumes whoever waits for a transition once, whichever comes first: its completion
    /// handler or the timeout.
    @MainActor
    private final class TransitionWait {
        var continuation: CheckedContinuation<Bool, Never>?

        func finish(began: Bool) {
            continuation?.resume(returning: began)
            continuation = nil
        }
    }

    /// Full-screen host of a flow's view; the flow draws its own close control.
    package final class FlowViewController<View: FlowViewHost>: UIViewController,
        FlowHostingViewController
    {
        package let flowView: View
        package let locationSlug: String
        /// Called once when the controller has left the screen, whoever dismissed it. Set once
        /// UIKit accepted its presentation. Also read in `deinit`, which is not main-actor
        /// isolated; UIKit releases view controllers on the main thread.
        package nonisolated(unsafe) var onLeftScreen: FlowDismissedHandler?

        package init(locationSlug: String, flowView: View) {
            self.locationSlug = locationSlug
            self.flowView = flowView
            super.init(nibName: nil, bundle: nil)
            modalPresentationStyle = .fullScreen
        }

        @available(*, unavailable)
        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        deinit {
            // Released without having disappeared: dismissed while a full-screen controller
            // of the app covered it, or torn down with its window.
            onLeftScreen?()
        }

        override package func loadView() {
            view = flowView
        }

        override package func viewDidDisappear(_ animated: Bool) {
            super.viewDidDisappear(animated)
            // The view also disappears under a full-screen controller the app presents on top
            // of the flow, which is still presented then.
            if isBeingDismissed || presentedViewController == nil {
                leftScreen()
            }
        }

        /// Reports, once, that the controller left the screen.
        package func leftScreen() {
            let handler = onLeftScreen
            onLeftScreen = nil
            handler?()
        }
    }
#else
    /// Stand-in where no renderer is available: presents nothing.
    package final class UnsupportedPlatformPresenter: FlowPresenting {
        package init() {}

        package func supportsFlowPackage(abiVersion: Int) -> Bool {
            return false
        }

        package func show(
            locationSlug: String,
            package: Data,
            onBridgeEvent: FlowMessageHandler?,
            onDismiss: FlowDismissedHandler?,
            onFailure: FlowFailedHandler?
        ) async throws -> Bool {
            return false
        }

        package func dismiss() async throws {}

        package func postMessage(locationSlug: String, data: String) {}
    }
#endif
