#if os(iOS)
    import UIKit

    /// Moves `screen` views in and out (views protocol, "Navigation"). The host hands every
    /// screen that enters, starts closing or is deleted to its transitions, and lets them
    /// update after every batch; it reports `transitionEnd` to the core when a closing
    /// transition calls back, and `dismissed` through ``onDismissed``.
    @MainActor
    protocol ScreenTransitioning: AnyObject {
        /// Called when the end user dismissed a screen by a gesture or a tap on its backdrop.
        var onDismissed: ((NodeView) -> Void)? { get set }
        /// Whether the end user can go back: a screen was pushed or presented.
        var canGoBack: Bool { get }
        /// `screen` was created after the package's first frame: bring it in.
        func enter(_ screen: NodeView)
        /// `screen` is closing: take it out, then call back, exactly once. The core deletes
        /// it afterwards.
        func leave(_ screen: NodeView, completion: @escaping @MainActor () -> Void)
        /// `screen` was deleted: whatever it was doing ends now.
        func remove(_ screen: NodeView)
        /// The tree was reset: every screen went without a transition.
        func reset()
        /// A batch was applied; `screens` are every `screen` view of the tree.
        func update(screens: [NodeView])
    }

    /// Animates screens with UIKit property animators and moves them with gesture recognizers,
    /// inside the view that hosts the tree.
    ///
    /// Every screen has a progress (``ScreenMotion``): `0` off screen, `1` presented, a
    /// sheet's detent in between. ``apply(_:)`` writes what a progress means into the views
    /// (the screen or its presentation's stack, the backdrop, the screen beneath, shared
    /// element flights); an animation runs it inside a spring animator towards a target, and
    /// a gesture runs it directly as the finger moves. An interruption reads the progress back
    /// from what is on screen and goes on from there, so animations and gestures hand over to
    /// each other at any time.
    @MainActor
    final class TransitionCoordinator: ScreenTransitioning {
        var onDismissed: ((NodeView) -> Void)?
        /// Whether Reduce Motion is on; read when a transition starts.
        var reduceMotion: () -> Bool = { UIAccessibility.isReduceMotionEnabled }
        /// The clock springs are timed on, which their animators run by.
        var now: () -> CFTimeInterval = { CACurrentMediaTime() }
        private(set) var canGoBack = false

        /// Where flights of shared elements show, above the tree.
        private weak var container: UIView?
        private lazy var flightLayer: UIView = {
            let view = UIView()
            view.isUserInteractionEnabled = false
            return view
        }()
        private var states: [Int32: ScreenState] = [:]
        private var gestures: [Int32: ScreenGestures] = [:]

        /// One screen's transition state.
        final class ScreenState {
            let screen: NodeView
            /// The progress the views show once any running animation ends.
            var progress: CGFloat
            /// The detent a sheet rests at or is heading to.
            var detent: Int?
            /// Where a Reduce Motion cross-fade holds the screen.
            var crossFade: CGFloat?
            var animator: UIViewPropertyAnimator?
            /// How the running animation started, which tells its velocity at any moment.
            var launch: Launch?
            /// Runs when the running animation reaches its target.
            var settled: (() -> Void)?
            /// A drag holds the screen, grabbed at this progress.
            var dragBaseline: CGFloat?
            /// The pending `transitionEnd` of a closing screen.
            var leaving: (@MainActor () -> Void)?
            /// The screen is gone: dismissed by the end user, or closing.
            var gone = false
            var flights: [SharedElementFlight] = []

            init(screen: NodeView, progress: CGFloat) {
                self.screen = screen
                self.progress = progress
            }
        }

        /// A spring animation's start: from where, towards what, at what velocity (progress
        /// per second) and when.
        struct Launch {
            var from: CGFloat
            var target: CGFloat
            var velocity: CGFloat
            var spring: ScreenMotion.Spring
            var time: CFTimeInterval

            /// The velocity of the screen at `time`, in progress per second.
            func velocity(at time: CFTimeInterval) -> CGFloat {
                return CGFloat(
                    spring.velocity(
                        at: max(time - self.time, 0), displacement: Double(from - target),
                        velocity: Double(velocity)))
            }
        }

        init(container: UIView) {
            self.container = container
        }

        /// How `screen` moves, mirrored by the flow's direction, never the device's.
        func screenMotion(of screen: NodeView) -> ScreenMotion {
            return ScreenMotion(props: screen.props)
        }

        // MARK: - Screens entering and leaving

        func enter(_ screen: NodeView) {
            let motion = screenMotion(of: screen)
            // A stack's first screen moves with its presentation.
            guard motion.kind.isPresentation || !isStackRoot(screen) else {
                return
            }
            defer { UIAccessibility.post(notification: .screenChanged, argument: focusTarget(screen)) }
            guard motion.kind != .none else {
                return
            }
            let state = self.state(of: screen)
            let geometry = geometry(of: screen)
            let rest = motion.rest(in: geometry)
            state.detent = motion.kind.isPresentation ? motion.initialSnapIndex : nil
            state.progress = 0
            if reduceMotion() {
                state.crossFade = rest
            } else {
                startFlights(state)
            }
            withoutAnimation { apply(state) }
            animate(state, to: rest, spring: motion.open, velocity: 0) { [weak self, weak state] in
                guard let self, let state else {
                    return
                }
                state.crossFade = nil
                // The content may have changed size while the screen entered.
                state.progress = self.screenMotion(of: state.screen).rest(
                    in: self.geometry(of: state.screen), detent: state.detent)
                self.endFlights(state)
                self.withoutAnimation { self.apply(state) }
            }
        }

        func leave(_ screen: NodeView, completion: @escaping @MainActor () -> Void) {
            let motion = screenMotion(of: screen)
            let state = self.state(of: screen)
            if let pending = state.leaving {
                // Closing twice still ends once.
                state.leaving = nil
                pending()
            }
            state.gone = true
            if let below = below(screen) {
                UIAccessibility.post(notification: .screenChanged, argument: focusTarget(below))
            }
            cancelDrag(on: screen)
            guard motion.kind != .none, !(isStackRoot(screen) && !motion.kind.isPresentation) else {
                _ = stopAnimation(state)
                completion()
                return
            }
            state.leaving = completion
            // Interrupted while entering, it turns back at the speed it was moving.
            let velocity = stopAnimation(state)
            if reduceMotion() {
                state.crossFade = state.progress
            } else {
                startFlights(state)
            }
            animate(state, to: 0, spring: motion.close, velocity: velocity) {
                [weak self, weak state] in
                guard let self, let state else {
                    return
                }
                self.endFlights(state)
                let leaving = state.leaving
                state.leaving = nil
                leaving?()
            }
        }

        func remove(_ screen: NodeView) {
            gestures.removeValue(forKey: screen.id)?.uninstall()
            guard let state = states[screen.id], state.screen === screen else {
                return
            }
            states[screen.id] = nil
            state.animator?.stopAnimation(true)
            state.animator = nil
            state.settled = nil
            endFlights(state)
            let leaving = state.leaving
            state.leaving = nil
            leaving?()
        }

        func reset() {
            for state in states.values {
                state.animator?.stopAnimation(true)
                endFlights(state)
            }
            for gesture in gestures.values {
                gesture.uninstall()
            }
            states.removeAll()
            gestures.removeAll()
            canGoBack = false
        }

        func update(screens: [NodeView]) {
            var stacks: [ObjectIdentifier: NodeView] = [:]
            for screen in screens {
                if let stack = screen.parentNode {
                    stacks[ObjectIdentifier(stack)] = stack
                }
                installGestures(on: screen)
            }
            var backable = false
            for stack in stacks.values {
                let stacked = stack.childNodes.filter { $0.kind == .screen }
                let live = stacked.filter { !isGone($0) }
                for (index, screen) in stacked.enumerated() {
                    let state = self.state(of: screen)
                    // At rest, a sheet follows its detent as its content or the viewport
                    // changes size.
                    if state.animator == nil, state.dragBaseline == nil, !state.gone {
                        state.progress = screenMotion(of: screen).rest(
                            in: geometry(of: screen), detent: state.detent)
                    }
                    withoutAnimation { apply(state) }
                    let above = stacked[(index + 1)...].filter { !isGone($0) }
                    // A sheet or dialog leaves the screen beneath readable, unless its
                    // backdrop blocks touches to it.
                    let hidden = above.contains {
                        let motion = screenMotion(of: $0)
                        return !motion.kind.leavesBelowVisible || motion.backdropBlocks
                    }
                    screen.setNavigation {
                        $0.covered = !above.isEmpty
                        $0.hiddenFromAccessibility = hidden
                    }
                }
                backable =
                    backable
                    || live.contains {
                        screenMotion(of: $0).kind.isPresentation || !isStackRoot($0)
                    }
            }
            canGoBack = backable
        }

        // MARK: - Gestures

        /// A drag on `screen` starts. Returns whether it may move it.
        @discardableResult
        func beginDrag(_ screen: NodeView) -> Bool {
            let motion = screenMotion(of: screen)
            guard motion.draggable, screen.props["closing"]?.bool != true,
                let state = states[screen.id], state.screen === screen, !state.gone,
                state.leaving == nil
            else {
                return false
            }
            _ = stopAnimation(state)
            state.crossFade = nil
            state.dragBaseline = state.progress
            if !reduceMotion() {
                startFlights(state)
            }
            withoutAnimation { apply(state) }
            return true
        }

        /// Whether a presentation rests, or is dragged, below its highest detent: a drag up in
        /// its content expands it before the content scrolls.
        func canExpand(_ screen: NodeView) -> Bool {
            let motion = screenMotion(of: screen)
            guard motion.kind.isPresentation, let state = states[screen.id], state.screen === screen,
                !state.gone, let highest = motion.detentProgress(in: geometry(of: screen)).max()
            else {
                return false
            }
            return state.progress < highest - 0.001
        }

        /// The finger moved `translation` points towards dismissal since the drag began.
        func drag(_ screen: NodeView, translation: CGFloat) {
            guard let state = dragging(screen), let baseline = state.dragBaseline else {
                return
            }
            state.progress = screenMotion(of: screen).dragged(
                from: baseline, translation: translation, in: geometry(of: screen))
            withoutAnimation { apply(state) }
        }

        /// The finger lifted, moving `velocity` points per second towards dismissal: the
        /// screen settles at a detent, back where it was, or goes and is reported dismissed.
        func endDrag(_ screen: NodeView, velocity: CGFloat) {
            guard let state = dragging(screen) else {
                return
            }
            state.dragBaseline = nil
            let motion = screenMotion(of: screen)
            let geometry = geometry(of: screen)
            let speed = -velocity / geometry.extent(of: motion.kind)
            guard let target = motion.release(at: state.progress, velocity: speed, in: geometry)
            else {
                dismiss(state, velocity: speed)
                return
            }
            if motion.kind.isPresentation {
                state.detent = motion.detentProgress(in: geometry).firstIndex(of: target)
            }
            let spring = target >= state.progress ? motion.open : motion.close
            animate(state, to: target, spring: spring, velocity: speed) { [weak self, weak state] in
                guard let self, let state else {
                    return
                }
                self.endFlights(state)
            }
        }

        /// The system took the touch away: the screen goes back where it was grabbed.
        func cancelDrag(_ screen: NodeView) {
            guard let state = dragging(screen), let baseline = state.dragBaseline else {
                return
            }
            state.dragBaseline = nil
            let motion = screenMotion(of: screen)
            animate(state, to: baseline, spring: motion.open, velocity: 0) { [weak self, weak state] in
                guard let self, let state else {
                    return
                }
                self.endFlights(state)
            }
        }

        /// A tap on a presentation's backdrop: a sheet or dialog that allows it leaves.
        func backdropTapped(_ screen: NodeView) {
            guard allowsBackdropDismiss(screen), let state = states[screen.id] else {
                return
            }
            // A sheet still opening turns back at the speed it was moving.
            let velocity = stopAnimation(state)
            state.dragBaseline = nil
            if !reduceMotion() {
                startFlights(state)
            }
            dismiss(state, velocity: velocity)
        }

        func allowsBackdropDismiss(_ screen: NodeView) -> Bool {
            let motion = screenMotion(of: screen)
            guard motion.kind.isPresentation, motion.backdropDismisses,
                screen.props["closing"]?.bool != true, let state = states[screen.id],
                state.screen === screen
            else {
                return false
            }
            return !state.gone && state.leaving == nil
        }

        private func dismiss(_ state: ScreenState, velocity: CGFloat) {
            let motion = screenMotion(of: state.screen)
            animate(state, to: 0, spring: motion.close, velocity: velocity) { [weak self, weak state] in
                guard let self, let state else {
                    return
                }
                state.gone = true
                self.endFlights(state)
                self.onDismissed?(state.screen)
            }
        }

        private func dragging(_ screen: NodeView) -> ScreenState? {
            guard let state = states[screen.id], state.screen === screen, state.dragBaseline != nil
            else {
                return nil
            }
            return state
        }

        /// Ends a drag the screen no longer takes, without settling it.
        private func cancelDrag(on screen: NodeView) {
            states[screen.id]?.dragBaseline = nil
            gestures[screen.id]?.cancel()
        }

        private func installGestures(on screen: NodeView) {
            if let installed = gestures[screen.id], installed.screen === screen {
                return
            }
            let motion = screenMotion(of: screen)
            if !motion.kind.isPresentation && isStackRoot(screen) {
                return
            }
            gestures[screen.id] = ScreenGestures(
                screen: screen, motionView: lead(of: screen), coordinator: self)
        }

        // MARK: - Tests

        /// Finishes every running animation at once, as if its time had passed.
        func finishAnimations() {
            while let state = states.values.first(where: { $0.animator != nil }) {
                state.animator?.stopAnimation(true)
                state.animator = nil
                withoutAnimation { apply(state) }
                let settled = state.settled
                state.settled = nil
                settled?()
            }
        }

        /// The progress a screen shows once its animations end.
        func progress(of screen: NodeView) -> CGFloat? {
            return states[screen.id].map(\.progress)
        }

        /// The shared elements flying for `screen` now.
        func flights(of screen: NodeView) -> [SharedElementFlight] {
            return states[screen.id]?.flights ?? []
        }

        /// The velocity, in progress per second, `screen` moves at now.
        func velocity(of screen: NodeView) -> CGFloat {
            guard let state = states[screen.id], state.animator != nil, let launch = state.launch
            else {
                return 0
            }
            return launch.velocity(at: now())
        }

        /// Whether `screen` is moving: animated, or held by a drag.
        func isMoving(_ screen: NodeView) -> Bool {
            guard let state = states[screen.id] else {
                return false
            }
            return state.animator != nil || state.dragBaseline != nil
        }

        // MARK: - Applying progress

        /// Writes the screen's progress into the views: the screen (or its presentation's
        /// stack), the backdrop, the screen beneath a card and the flights. Inside an animation
        /// block the writes animate.
        private func apply(_ state: ScreenState) {
            let screen = state.screen
            let motion = screenMotion(of: screen)
            let geometry = geometry(of: screen)
            let frame = motion.frame(at: state.progress, in: geometry, crossFade: state.crossFade)
            lead(of: screen).setNavigation {
                $0.offset = frame.offset
                $0.alpha = frame.alpha
            }
            if motion.kind.isPresentation {
                backdrop(of: screen).alpha = frame.dim
            } else if let below = below(screen), below.parentNode === screen.parentNode {
                let covered = screenMotion(of: below)
                let offset =
                    reduceMotion() || state.crossFade != nil
                    ? .zero
                    : covered.coveredOffset(
                        by: state.progress, of: motion, in: self.geometry(of: below))
                below.setNavigation { $0.offset = offset }
            }
            if !state.flights.isEmpty {
                let rest = motion.rest(in: geometry, detent: state.detent)
                let presence = min(max(state.progress / max(rest, 0.01), 0), 1)
                for flight in state.flights {
                    flight.apply(presence: presence)
                }
            }
        }

        private func animate(
            _ state: ScreenState, to target: CGFloat, spring: ScreenMotion.Spring, velocity: CGFloat,
            completion: @escaping () -> Void
        ) {
            _ = stopAnimation(state)
            let distance = target - state.progress
            // UIKit's spring velocity is relative to the distance left.
            let relative = abs(distance) > 0.001 ? velocity / distance : 0
            let timing = UISpringTimingParameters(
                mass: spring.mass, stiffness: spring.stiffness, damping: spring.damping,
                initialVelocity: CGVector(dx: relative, dy: relative))
            let animator = UIViewPropertyAnimator(duration: 0, timingParameters: timing)
            state.launch = Launch(
                from: state.progress, target: target, velocity: velocity, spring: spring,
                time: now())
            state.progress = target
            state.settled = completion
            state.animator = animator
            animator.addAnimations { [weak self, weak state] in
                guard let self, let state else {
                    return
                }
                self.apply(state)
            }
            animator.addCompletion { [weak state, weak animator] position in
                guard let state, let animator, state.animator === animator, position == .end else {
                    return
                }
                state.animator = nil
                let settled = state.settled
                state.settled = nil
                settled?()
            }
            animator.startAnimation()
        }

        /// Stops the running animation where it is on screen, and takes that as the progress.
        /// Returns the velocity it moved at, in progress per second; 0 when none ran.
        private func stopAnimation(_ state: ScreenState) -> CGFloat {
            guard let animator = state.animator else {
                return 0
            }
            let velocity = state.launch?.velocity(at: now()) ?? 0
            state.animator = nil
            state.launch = nil
            state.settled = nil
            let screen = state.screen
            let lead = lead(of: screen)
            if let shown = lead.layer.presentation() {
                let transform = shown.affineTransform()
                let base = lead.transformProp
                let opacity = CGFloat(min(max(lead.props["opacity"]?.number ?? 1, 0.001), 1))
                let progress = screenMotion(of: screen).progress(
                    offset: CGPoint(x: transform.tx - base.tx, y: transform.ty - base.ty),
                    alpha: CGFloat(shown.opacity) / opacity, in: geometry(of: screen),
                    crossFade: state.crossFade)
                if let progress, progress.isFinite {
                    state.progress = progress
                }
            }
            animator.stopAnimation(true)
            withoutAnimation { apply(state) }
            return velocity.isFinite ? velocity : 0
        }

        private func withoutAnimation(_ body: () -> Void) {
            UIView.performWithoutAnimation {
                CATransaction.begin()
                CATransaction.setDisableActions(true)
                body()
                CATransaction.commit()
            }
        }

        // MARK: - Shared elements

        /// Starts the flights of the elements `state`'s screen shares with the one beneath.
        private func startFlights(_ state: ScreenState) {
            guard state.flights.isEmpty, let container, let source = below(state.screen) else {
                return
            }
            let targets = Self.sharedElements(in: state.screen)
            let sources = Self.sharedElements(in: source)
            let pairs = targets.compactMap { id, target in
                sources[id].map { (source: $0, target: target) }
            }
            guard !pairs.isEmpty else {
                return
            }
            // Both ends are measured where their screens rest.
            let motion = screenMotion(of: state.screen)
            let geometry = geometry(of: state.screen)
            let rest = motion.frame(at: motion.rest(in: geometry, detent: state.detent), in: geometry)
            let moving = lead(of: state.screen)
            let current = (moving.navigation.offset, source.navigation.offset)
            withoutAnimation {
                moving.setNavigation { $0.offset = rest.offset }
                source.setNavigation { $0.offset = .zero }
            }
            flightLayer.frame = container.bounds
            container.addSubview(flightLayer)
            // A live component view cannot be in two places, and a picture of it would be blank
            // where the GPU draws it (video, maps) and stale while it changes: an element
            // holding one stays on its screen and moves with it.
            for pair in pairs
            where !pair.source.bounds.isEmpty && !pair.target.bounds.isEmpty
                && !pair.source.showsNativeComponent && !pair.target.showsNativeComponent
            {
                state.flights.append(
                    SharedElementFlight(
                        source: pair.source, target: pair.target, in: flightLayer))
            }
            withoutAnimation {
                moving.setNavigation { $0.offset = current.0 }
                source.setNavigation { $0.offset = current.1 }
                apply(state)
            }
        }

        private func endFlights(_ state: ScreenState) {
            for flight in state.flights {
                flight.end()
            }
            state.flights.removeAll()
        }

        /// The views of a screen's subtree that carry a `sharedElement`, by id; the first in
        /// paint order wins.
        private static func sharedElements(in screen: NodeView) -> [String: NodeView] {
            var found: [String: NodeView] = [:]
            var pending = Array(screen.childNodes.reversed())
            while let node = pending.popLast() {
                if let id = node.props["sharedElement"]?.string, found[id] == nil {
                    found[id] = node
                }
                pending.append(contentsOf: node.childNodes.reversed())
            }
            return found
        }

        // MARK: - The tree

        private func state(of screen: NodeView) -> ScreenState {
            if let state = states[screen.id], state.screen === screen {
                return state
            }
            let motion = screenMotion(of: screen)
            let state = ScreenState(screen: screen, progress: motion.rest(in: geometry(of: screen)))
            if motion.kind.isPresentation {
                state.detent = motion.initialSnapIndex
            }
            states[screen.id] = state
            return state
        }

        private func isGone(_ screen: NodeView) -> Bool {
            if screen.props["closing"]?.bool == true {
                return true
            }
            guard let state = states[screen.id], state.screen === screen else {
                return false
            }
            return state.gone
        }

        /// Whether `screen` is its stack's first screen.
        private func isStackRoot(_ screen: NodeView) -> Bool {
            return screen.parentNode?.childNodes.first(where: { $0.kind == .screen }) === screen
        }

        /// The screen beneath `screen` in its stack that stays.
        private func below(_ screen: NodeView) -> NodeView? {
            guard let siblings = screen.parentNode?.childNodes,
                let index = siblings.firstIndex(where: { $0 === screen })
            else {
                return nil
            }
            return siblings[..<index].last { $0.kind == .screen && !isGone($0) }
        }

        /// What moves for a screen: a presentation moves its stack over the backdrop, a card
        /// moves itself.
        private func lead(of screen: NodeView) -> NodeView {
            guard screenMotion(of: screen).kind.isPresentation else {
                return screen
            }
            return screen.childNodes.first { $0.kind == .stack } ?? screen
        }

        private func geometry(of screen: NodeView) -> ScreenMotion.Geometry {
            return ScreenMotion.Geometry(
                size: screen.nodeFrame.size, contentHeight: lead(of: screen).nodeFrame.height)
        }

        /// The dimming view behind a presentation's stack, made on first use.
        private func backdrop(of screen: NodeView) -> UIView {
            let host = screen.contentHost
            if let existing = host.subviews.first(where: { $0 is BackdropView }) {
                existing.frame = host.bounds
                return existing
            }
            let backdrop = BackdropView(frame: host.bounds)
            backdrop.backgroundColor = .black
            backdrop.alpha = 0
            backdrop.isUserInteractionEnabled = false
            backdrop.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            host.insertSubview(backdrop, at: 0)
            return backdrop
        }

        /// Where assistive technology goes when `screen` comes to the front: the screen, or a
        /// presentation's first screen.
        private func focusTarget(_ screen: NodeView) -> NodeView {
            guard screenMotion(of: screen).kind.isPresentation,
                let stack = screen.childNodes.first(where: { $0.kind == .stack })
            else {
                return screen
            }
            return stack.childNodes.last { $0.kind == .screen && !isGone($0) } ?? screen
        }
    }

    /// The dimming of a presentation's backdrop.
    final class BackdropView: UIView {}
#endif
