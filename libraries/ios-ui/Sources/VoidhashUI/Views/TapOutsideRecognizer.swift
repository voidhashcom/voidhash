#if os(iOS)
    import UIKit
    import UIKit.UIGestureRecognizerSubclass

    /// Watches every touch of the view hosting the tree for a tap whose touch down landed on no
    /// `textInput` view: a down and an up within 10 points, not cancelled (views protocol,
    /// `text_tap_outside`). It never recognizes, cancels or delays a touch, so presses,
    /// scrolling and screen gestures go on as without it. Gesture recognizers see a touch
    /// before the view it landed on, so ``onTap`` runs before that view's press.
    @MainActor
    final class TapOutsideRecognizer: UIGestureRecognizer, UIGestureRecognizerDelegate {
        /// How far a tap may move, in points.
        static let slop: CGFloat = 10

        /// A tap outside every text field.
        var onTap: (() -> Void)?
        /// Where the tap went down, while it may still be one.
        private var start: CGPoint?

        init() {
            super.init(target: nil, action: nil)
            cancelsTouchesInView = false
            delaysTouchesBegan = false
            delaysTouchesEnded = false
            delegate = self
        }

        /// A touch went down at `point` (in the recognizer's view) on `view`.
        func touchDown(at point: CGPoint, on view: UIView?) {
            var current = view
            while let next = current, !(next is TextInputNodeView) {
                current = next.superview
            }
            start = current == nil ? point : nil
        }

        /// The touch moved to `point`.
        func touchMoved(to point: CGPoint) {
            if let start, hypot(point.x - start.x, point.y - start.y) > Self.slop {
                self.start = nil
            }
        }

        /// The touch went up at `point`.
        func touchUp(at point: CGPoint) {
            touchMoved(to: point)
            if start != nil {
                start = nil
                onTap?()
            }
        }

        override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
            // A second finger makes it no tap.
            guard touches.count == 1, numberOfTouches <= 1, let touch = touches.first else {
                start = nil
                state = .failed
                return
            }
            touchDown(at: touch.location(in: view), on: touch.view)
        }

        override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
            if let touch = touches.first {
                touchMoved(to: touch.location(in: view))
            }
        }

        override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
            if let touch = touches.first {
                touchUp(at: touch.location(in: view))
            }
            state = .failed
        }

        override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
            start = nil
            state = .failed
        }

        override func reset() {
            super.reset()
            start = nil
        }

        func gestureRecognizer(
            _ recognizer: UIGestureRecognizer,
            shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer
        ) -> Bool {
            return true
        }
    }
#endif
