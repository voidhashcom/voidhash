#if os(iOS)
    import UIKit

    /// The gesture recognizers of one screen, which turn touches into the coordinator's
    /// drags and backdrop taps:
    ///
    /// - a pushed screen swipes back horizontally, from its leading edge or, with
    ///   `gestureArea: "screen"`, from anywhere; a horizontal scroll view keeps a swipe that
    ///   starts on it outside the edge band;
    /// - a modal or sheet drags vertically by its stack. A drag that starts in a vertical
    ///   scroll view moves the sheet while the finger moves up and the sheet is below its
    ///   highest detent, or moves down with the scroll view at its top; otherwise it scrolls,
    ///   as UIKit's sheets do;
    /// - a presentation's backdrop takes taps, which dismiss when `backdropBehavior` allows.
    ///
    /// A drag that starts on an app component's views is the component's first: a swipe back
    /// starts there only within the edge band, and its recognizers wait for that decision;
    /// a sheet's drag waits until every recognizer of the component fails.
    @MainActor
    final class ScreenGestures: NSObject, UIGestureRecognizerDelegate {
        weak var screen: NodeView?
        private weak var coordinator: TransitionCoordinator?
        private var pan: UIPanGestureRecognizer?
        private var tap: UITapGestureRecognizer?
        /// The vertical scroll view a sheet drag started in.
        weak var startScroll: UIScrollView?
        private var startedInHorizontalScroll = false
        private var startedInComponent = false
        /// Whether the coordinator moves the screen with this drag, and the finger's
        /// translation when it took over from a scroll view.
        private var dragging = false
        private var takeover: CGFloat = 0
        /// The finger's translation at the last movement, which tells its direction.
        private var lastTranslation: CGFloat = 0
        /// Where the scroll view stays while the sheet follows the finger.
        private var pinnedOffset: CGFloat = 0

        init(screen: NodeView, motionView: NodeView, coordinator: TransitionCoordinator) {
            self.screen = screen
            self.coordinator = coordinator
            super.init()
            let kind = coordinator.screenMotion(of: screen).kind
            if kind != .dialog {
                let pan = UIPanGestureRecognizer(target: self, action: #selector(panned(_:)))
                pan.delegate = self
                pan.maximumNumberOfTouches = 1
                // A presentation drags by its stack, so its backdrop does not.
                (kind.isPresentation ? motionView : screen).addGestureRecognizer(pan)
                self.pan = pan
            }
            if kind.isPresentation {
                let tap = UITapGestureRecognizer(target: self, action: #selector(tapped(_:)))
                tap.delegate = self
                screen.addGestureRecognizer(tap)
                self.tap = tap
            }
        }

        func uninstall() {
            for recognizer in [pan, tap].compactMap({ $0 as UIGestureRecognizer? }) {
                recognizer.view?.removeGestureRecognizer(recognizer)
            }
        }

        /// Ends the drag in flight without settling it; the coordinator already moved on.
        func cancel() {
            guard let pan, pan.state == .began || pan.state == .changed else {
                return
            }
            dragging = false
            pan.isEnabled = false
            pan.isEnabled = true
        }

        private var motion: ScreenMotion? {
            guard let screen, let coordinator else {
                return nil
            }
            return coordinator.screenMotion(of: screen)
        }

        /// The finger's translation and velocity towards dismissal.
        private func towardsDismissal(_ pan: UIPanGestureRecognizer) -> (CGFloat, CGFloat) {
            let view = pan.view
            let translation = pan.translation(in: view)
            let velocity = pan.velocity(in: view)
            guard let motion, !motion.kind.isPresentation else {
                return (translation.y, velocity.y)
            }
            return (translation.x * motion.sign, velocity.x * motion.sign)
        }

        @objc private func panned(_ pan: UIPanGestureRecognizer) {
            let (translation, velocity) = towardsDismissal(pan)
            track(pan.state, translation: translation, velocity: velocity)
        }

        /// Moves the screen with a drag in `phase`, the finger `translation` points from where
        /// it started and moving `velocity` points per second, both towards dismissal.
        func track(_ phase: UIGestureRecognizer.State, translation: CGFloat, velocity: CGFloat) {
            guard let screen, let coordinator else {
                return
            }
            switch phase {
            case .began, .changed:
                let movement = translation - lastTranslation
                lastTranslation = translation
                if !dragging {
                    if let scroll = startScroll {
                        // In a sheet's scroll view the sheet moves first towards its highest
                        // detent, and the content scrolls only from there; a downward drag
                        // scrolls the content back to its top before the sheet follows.
                        let expands = movement < 0 && coordinator.canExpand(screen)
                        let collapses = movement > 0 && Self.atTop(scroll)
                        guard expands || collapses else {
                            return
                        }
                        takeover = translation
                        pinnedOffset = collapses
                            ? -scroll.adjustedContentInset.top : scroll.contentOffset.y
                    } else {
                        takeover = 0
                    }
                    dragging = coordinator.beginDrag(screen)
                }
                guard dragging else {
                    return
                }
                if let scroll = startScroll {
                    scroll.contentOffset.y = pinnedOffset
                    coordinator.drag(screen, translation: translation - takeover)
                    if movement < 0, !coordinator.canExpand(screen) {
                        // At its highest detent: the sheet settles there, and the content
                        // scrolls with the rest of the drag.
                        coordinator.endDrag(screen, velocity: 0)
                        dragging = false
                    }
                } else {
                    coordinator.drag(screen, translation: translation - takeover)
                }
            case .ended:
                if dragging {
                    coordinator.endDrag(screen, velocity: velocity)
                }
                finish()
            case .cancelled, .failed:
                if dragging {
                    coordinator.cancelDrag(screen)
                }
                finish()
            default:
                break
            }
        }

        private func finish() {
            dragging = false
            lastTranslation = 0
            startScroll = nil
            startedInHorizontalScroll = false
            startedInComponent = false
        }

        @objc private func tapped(_ tap: UITapGestureRecognizer) {
            if tap.state == .ended, let screen {
                coordinator?.backdropTapped(screen)
            }
        }

        /// Whether `view` is one of an app component's views inside `container`.
        private static func inComponent(_ view: UIView?, below container: UIView?) -> Bool {
            var current = view
            while let next = current, next !== container {
                if (next as? ExternalNodeView)?.component != nil {
                    return true
                }
                current = next.superview
            }
            return false
        }

        private static func atTop(_ scroll: UIScrollView) -> Bool {
            return scroll.contentOffset.y <= -scroll.adjustedContentInset.top + 0.5
        }

        // MARK: - UIGestureRecognizerDelegate

        func gestureRecognizer(_ recognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
            guard let screen else {
                return false
            }
            if recognizer === tap {
                // Only touches on the backdrop itself, not on the presentation's content.
                return touch.view === screen
            }
            guard recognizer.state == .possible else {
                return true
            }
            startScroll = nil
            startedInHorizontalScroll = false
            startedInComponent = false
            var view = touch.view
            while let current = view, current !== recognizer.view {
                if (current as? ExternalNodeView)?.component != nil {
                    startedInComponent = true
                    break
                }
                if let node = current as? ScrollNodeView {
                    if node.props["scrollDirection"]?.string == "horizontal" {
                        startedInHorizontalScroll = true
                    } else if motion?.kind.isPresentation == true {
                        startScroll = node.scrollView
                    }
                    break
                }
                view = current.superview
            }
            return true
        }

        func gestureRecognizerShouldBegin(_ recognizer: UIGestureRecognizer) -> Bool {
            guard let screen, let coordinator, let motion else {
                return false
            }
            if recognizer === tap {
                return coordinator.allowsBackdropDismiss(screen)
            }
            guard let pan = recognizer as? UIPanGestureRecognizer, let view = pan.view,
                motion.draggable, screen.props["closing"]?.bool != true
            else {
                return false
            }
            let velocity = pan.velocity(in: view)
            if motion.kind.isPresentation {
                return abs(velocity.y) > abs(velocity.x)
            }
            guard abs(velocity.x) > abs(velocity.y), velocity.x * motion.sign > 0 else {
                return false
            }
            let start = pan.location(in: view).x - pan.translation(in: view).x
            let atEdge = motion.startsAtLeadingEdge(start, width: view.bounds.width)
            return atEdge
                || (motion.gestureFromAnywhere && !startedInHorizontalScroll && !startedInComponent)
        }

        func gestureRecognizer(
            _ recognizer: UIGestureRecognizer,
            shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer
        ) -> Bool {
            // A sheet follows a scroll view's drag towards its highest detent, and down once
            // the scroll view reaches its top.
            guard recognizer === pan, let scroll = startScroll else {
                return false
            }
            return other === scroll.panGestureRecognizer
        }

        func gestureRecognizer(
            _ recognizer: UIGestureRecognizer, shouldRequireFailureOf other: UIGestureRecognizer
        ) -> Bool {
            // A sheet or modal drags only once the component under the finger declined it.
            guard recognizer === pan, motion?.kind.isPresentation == true else {
                return false
            }
            return Self.inComponent(other.view, below: recognizer.view)
        }

        func gestureRecognizer(
            _ recognizer: UIGestureRecognizer, shouldBeRequiredToFailBy other: UIGestureRecognizer
        ) -> Bool {
            // A component's recognizers wait for a swipe back, which decides at once whether
            // it is one, as it starts there only at the edge.
            if recognizer === pan, motion?.kind.isPresentation == false,
                Self.inComponent(other.view, below: recognizer.view)
            {
                return true
            }
            // Scroll views across the drag's axis wait until the drag declines; a swipe back
            // decides at once whether it is one, so they barely wait.
            guard recognizer === pan, let scroll = other.view as? UIScrollView,
                other === scroll.panGestureRecognizer, let motion
            else {
                return false
            }
            guard motion.kind.isPresentation else {
                return true
            }
            let node = scroll.superview as? ScrollNodeView
            return node?.props["scrollDirection"]?.string == "horizontal"
        }
    }

    /// A shared element flying between its frame on the screen beneath and its frame on the
    /// moving screen, with their corner radii, while both real views are hidden. It shows a
    /// picture of the moving screen's element, taken when the flight starts.
    @MainActor
    final class SharedElementFlight {
        let source: NodeView
        let target: NodeView
        /// The two frames in the flight layer: the source's, and the target's at rest.
        let from: CGRect
        let to: CGRect
        private let fromRadius: CGFloat
        private let toRadius: CGFloat
        /// What flies.
        let view = UIView()

        init(source: NodeView, target: NodeView, in layer: UIView) {
            self.source = source
            self.target = target
            from = source.convert(source.bounds, to: layer)
            to = target.convert(target.bounds, to: layer)
            fromRadius = source.shape.uniformRadius ?? 0
            toRadius = target.shape.uniformRadius ?? 0
            let format = UIGraphicsImageRendererFormat()
            format.scale = target.host?.displayScale ?? 2
            format.opaque = false
            let picture = TextInputNodeView.withSecureTextHidden(in: target) {
                UIGraphicsImageRenderer(size: target.bounds.size, format: format).image {
                    target.layer.render(in: $0.cgContext)
                }
            }
            let image = UIImageView(image: picture)
            image.contentMode = .scaleToFill
            image.frame = CGRect(origin: .zero, size: from.size)
            image.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            view.frame = from
            view.clipsToBounds = true
            view.isUserInteractionEnabled = false
            view.addSubview(image)
            if #available(iOS 13.0, *) {
                view.layer.cornerCurve = .circular
            }
            layer.addSubview(view)
            source.setNavigation { $0.hiddenForFlight = true }
            target.setNavigation { $0.hiddenForFlight = true }
        }

        /// Places the element `presence` of the way from the source to the target.
        func apply(presence: CGFloat) {
            let t = min(max(presence, 0), 1)
            let lerp = { (a: CGFloat, b: CGFloat) in a + (b - a) * t }
            view.frame = CGRect(
                x: lerp(from.minX, to.minX), y: lerp(from.minY, to.minY),
                width: lerp(from.width, to.width), height: lerp(from.height, to.height))
            view.layer.cornerRadius = lerp(fromRadius, toRadius)
        }

        func end() {
            view.removeFromSuperview()
            source.setNavigation { $0.hiddenForFlight = false }
            target.setNavigation { $0.hiddenForFlight = false }
        }
    }
#endif
