import Foundation
@_spi(VoidhashFlows) import Voidhash
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
        /// Receives the URL of an image the package pins that arrived as other bytes.
        var onImageMismatch: ((String) -> Void)? { get set }
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
    /// While presentations wait for their flow, it shows its ``FlowLoading`` state once they have
    /// waited ``FlowLoading/delay``, in the controller the flow then takes over: the flow replaces
    /// the loading state without a second transition.
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
        private let loading: FlowLoading
        private let loadingDelay: TimeInterval
        /// Main-thread state. Weak, because UIKit owns a presented controller and releases it
        /// when it left the screen, whoever dismissed it.
        private weak var presented: FlowViewController<View>?
        /// Main-thread state: the presentations waiting for their flow, with what cancels each.
        private var waiting: [Int: FlowLoadingCancelledHandler] = [:]
        /// Main-thread state: shows the loading state once the presentations have waited for it.
        private var loadingDue: Task<Void, Never>?
        /// Main-thread state: presentations whose loading ended before it began on the main
        /// thread, which then does not begin.
        private var endedEarly: Set<Int> = []
        /// Main-thread state: flows on their way to the screen. No loading state is presented
        /// meanwhile: it would take the transition the flow is about to start.
        private var arriving = 0
        /// How long a loading state that appeared stays at least, so it never flashes.
        private static var minimumLoadingTime: TimeInterval { 0.3 }

        /// - Parameters:
        ///   - packageAbiVersions: The flow package versions `View` reads.
        ///   - loading: What is shown while a presentation waits for its flow.
        ///   - loadingDelay: How long a presentation waits before that shows.
        ///   - makeView: Creates the view a flow is shown in, with the SDK's image store.
        package init(
            context: FlowRendererContext, packageAbiVersions: ClosedRange<Int>,
            loading: FlowLoading = .none, loadingDelay: TimeInterval = FlowLoading.delay,
            makeView: @escaping @MainActor @Sendable (FlowImageStore?) -> View
        ) {
            self.context = context
            self.packageAbiVersions = packageAbiVersions
            self.loading = loading
            self.loadingDelay = loadingDelay
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
                presented.flowView?.postMessage(data)
            }
        }

        // MARK: - Loading

        package func beginLoading(
            presentation: Int, locationSlug: String,
            onCancel: @escaping FlowLoadingCancelledHandler
        ) {
            guard loading.shows else {
                return
            }
            Task { @MainActor in
                guard self.endedEarly.remove(presentation) == nil else {
                    return
                }
                self.waiting[presentation] = onCancel
                self.scheduleLoading()
            }
        }

        package func endLoading(presentation: Int) async {
            guard loading.shows else {
                return
            }
            await endLoadingOnMain(presentation)
        }

        @MainActor
        private func endLoadingOnMain(_ presentation: Int) async {
            if waiting.removeValue(forKey: presentation) == nil {
                endedEarly.insert(presentation)
            }
            guard waiting.isEmpty else {
                return
            }
            loadingDue?.cancel()
            loadingDue = nil
            if presented?.isLoading == true {
                await dismissPresented()
            }
        }

        /// Shows the loading state once the waiting presentations have waited for it, unless a
        /// flow is on screen by then.
        @MainActor
        private func scheduleLoading() {
            guard loadingDue == nil, presented == nil else {
                return
            }
            let delay = loadingDelay
            loadingDue = Task { @MainActor [weak self] in
                try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                guard !Task.isCancelled, let self else {
                    return
                }
                self.loadingDue = nil
                await self.presentLoading()
            }
        }

        @MainActor
        private func presentLoading() async {
            // Not over a flow, nor from a controller UIKit would not present from: the
            // presentation still shows its flow when it is ready.
            guard !waiting.isEmpty, presented == nil, arriving == 0,
                let presenting = context.presentingViewController(),
                presenting.viewIfLoaded?.window != nil, presenting.presentedViewController == nil,
                presenting.transitionCoordinator == nil,
                let loadingView = loading.makeView(cancel: { [weak self] in
                    self?.endUserLeftLoading()
                })
            else {
                return
            }
            let controller = FlowViewController<View>(
                loadingView: loadingView,
                onEscape: { [weak self] in self?.endUserLeftLoading() })
            await Self.transition { completion in
                presenting.present(controller, animated: true, completion: completion)
                guard controller.presentingViewController != nil else {
                    return false
                }
                self.presented = controller
                controller.loadingShownAt = CACurrentMediaTime()
                // Taken off the screen by the app or the system: the presentations go on
                // waiting, and their flow is presented anew when it is ready.
                controller.onLeftScreen = { [weak self, weak controller] in
                    Task { @MainActor in
                        if let self, let controller, self.presented === controller {
                            self.presented = nil
                        }
                    }
                }
                return true
            }
            if presented === controller, controller.isLoading {
                let focus =
                    (loadingView as? StandardFlowLoadingView)?.firstAccessibilityElement
                    ?? loadingView
                UIAccessibility.post(notification: .screenChanged, argument: focus)
            }
        }

        /// Shows `flowView` in place of the loading state on screen, once that has been up long
        /// enough to be read; `false`, with nothing changed, when there is none to take over or it
        /// is on its way off the screen.
        @MainActor
        private func takeOverLoading(
            flowView: View, locationSlug: String, onDismiss: FlowDismissedHandler?
        ) async -> Bool {
            func loadingOnScreen() -> FlowViewController<View>? {
                guard let controller = presented, controller.isLoading, !controller.isLeaving else {
                    return nil
                }
                return controller
            }
            guard let controller = loadingOnScreen() else {
                return false
            }
            if let shownAt = controller.loadingShownAt {
                let remaining = Self.minimumLoadingTime - (CACurrentMediaTime() - shownAt)
                if remaining > 0 {
                    try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
                }
            }
            // Closed meanwhile: the presentation was cancelled, and the controller is leaving.
            guard loadingOnScreen() === controller else {
                return false
            }
            controller.onLeftScreen = onDismiss
            controller.show(flowView: flowView, locationSlug: locationSlug)
            return true
        }

        /// The end user left the loading state: every presentation behind it is cancelled, and
        /// each one's end takes the loading state down.
        @MainActor
        private func endUserLeftLoading() {
            for cancel in waiting.values {
                cancel()
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
            // A loading state due now would take the transition this flow is about to start.
            arriving += 1
            defer { arriving -= 1 }
            loadingDue?.cancel()
            loadingDue = nil
            let flowView = makeView(context.imageStore)
            let warn = context.warn
            flowView.onMessage = { message in onBridgeEvent?(message) }
            flowView.onError = { message in warn("[\(locationSlug)] \(message)") }
            flowView.onFailure = { message in onFailure?(message) }
            flowView.onImageMismatch = context.onImageMismatch.map { report in { url in report(url) } }
            do {
                try flowView.load(package: package, runtimeModule: runtimeModule)
            } catch {
                warn("The flow for \"\(locationSlug)\" could not be shown: \(error)")
                return false
            }

            if await takeOverLoading(
                flowView: flowView, locationSlug: locationSlug, onDismiss: onDismiss)
            {
                return true
            }

            // The SDK dismisses a flow before it shows the next, so normally nothing is here.
            await dismissPresented()

            let controller = FlowViewController(locationSlug: locationSlug, flowView: flowView)

            guard let candidate = context.presentingViewController() else {
                throw VoidhashStoreError.paywallPresenterNotAvailable
            }
            // A transition the controller is part of has to end first, such as the dismissal
            // of a screen the app closed just before. What is on top can differ afterwards.
            await Self.settle(candidate.presentedViewController ?? candidate)
            // A loading state presented meanwhile is taken over rather than presented over.
            if await takeOverLoading(
                flowView: flowView, locationSlug: locationSlug, onDismiss: onDismiss)
            {
                return true
            }
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
            controller.isLeaving = true
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
                    "The flow for \"\(controller.locationSlug ?? "loading")\" could not be dismissed")
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

    /// The view of a controller that starts with a loading state: the VoiceOver escape gesture
    /// leaves the loading state, whichever view shows it, and does nothing once a flow replaced it.
    private final class LoadingContainerView: UIView {
        var onEscape: (@MainActor () -> Void)?

        override func accessibilityPerformEscape() -> Bool {
            guard let onEscape else {
                return false
            }
            onEscape()
            return true
        }
    }

    /// Full-screen host of a flow's view; the flow draws its own close control. It can start
    /// with a loading state, which the flow then replaces.
    package final class FlowViewController<View: FlowViewHost>: UIViewController,
        FlowHostingViewController
    {
        /// The flow's view; `nil` while the controller shows a loading state.
        package private(set) var flowView: View?
        package private(set) var locationSlug: String?
        /// The loading state shown until a flow replaces it.
        private var loadingView: UIView?
        /// Called once when the controller has left the screen, whoever dismissed it. Set once
        /// UIKit accepted its presentation. Also read in `deinit`, which is not main-actor
        /// isolated; UIKit releases view controllers on the main thread.
        package nonisolated(unsafe) var onLeftScreen: FlowDismissedHandler?

        /// Whether it shows a loading state rather than a flow.
        package var isLoading: Bool {
            return flowView == nil
        }

        /// Whether the presenter is taking it off the screen.
        package var isLeaving = false

        /// When the loading state appeared, in `CACurrentMediaTime()`; `nil` before.
        package var loadingShownAt: CFTimeInterval?

        /// Leaves the loading state on the VoiceOver escape gesture, whatever view the app gave it.
        private var onEscape: (@MainActor () -> Void)?

        package init(locationSlug: String, flowView: View) {
            self.locationSlug = locationSlug
            self.flowView = flowView
            super.init(nibName: nil, bundle: nil)
            modalPresentationStyle = .fullScreen
        }

        /// A controller showing `loadingView` until ``show(flowView:locationSlug:)``; `onEscape`
        /// answers the VoiceOver escape gesture meanwhile. It fades in, which Reduce Motion keeps.
        package init(loadingView: UIView, onEscape: (@MainActor () -> Void)? = nil) {
            self.loadingView = loadingView
            self.onEscape = onEscape
            super.init(nibName: nil, bundle: nil)
            modalPresentationStyle = .fullScreen
            modalTransitionStyle = .crossDissolve
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
            if let flowView {
                view = flowView
                return
            }
            let container = LoadingContainerView()
            container.onEscape = onEscape
            container.backgroundColor = .systemBackground
            if let loadingView {
                loadingView.frame = container.bounds
                loadingView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
                container.addSubview(loadingView)
            }
            view = container
        }

        /// Shows `flowView` in place of the loading state: a quick cross-fade, or at once with
        /// Reduce Motion. The flow leaves the screen as a flow presented directly does.
        package func show(flowView: View, locationSlug: String) {
            self.flowView = flowView
            self.locationSlug = locationSlug
            onEscape = nil
            (view as? LoadingContainerView)?.onEscape = nil
            modalTransitionStyle = .coverVertical
            flowView.frame = view.bounds
            flowView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            guard let loadingView else {
                view.addSubview(flowView)
                return
            }
            self.loadingView = nil
            view.insertSubview(flowView, belowSubview: loadingView)
            loadingView.isUserInteractionEnabled = false
            loadingView.accessibilityElementsHidden = true
            if UIAccessibility.isReduceMotionEnabled || view.window == nil {
                loadingView.removeFromSuperview()
            } else {
                UIView.animate(
                    withDuration: 0.2, animations: { loadingView.alpha = 0 },
                    completion: { _ in loadingView.removeFromSuperview() })
            }
            UIAccessibility.post(notification: .screenChanged, argument: nil)
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
