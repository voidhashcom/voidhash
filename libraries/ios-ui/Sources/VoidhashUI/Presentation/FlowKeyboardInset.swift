#if os(iOS)
    import Foundation
    import UIKit

    /// Follows the system keyboard and says how much of a view's bottom it covers, so the flow
    /// can end above it.
    ///
    /// The keyboard slides in and out. A hidden view is animated with the keyboard's own
    /// duration and curve, and ``current`` reads how far that animation is, once per rendered
    /// frame, so the flow's content moves with the keyboard.
    @MainActor
    package final class FlowKeyboardInset {
        private weak var view: UIView?
        /// Its height is the inset; its presentation layer has the height in mid-animation.
        private let follower = UIView()
        private let changed: () -> Void
        private nonisolated(unsafe) var observers: [NSObjectProtocol] = []
        /// The inset the keyboard ends at.
        package private(set) var target: CGFloat = 0
        /// Whether the keyboard is still moving to ``target``.
        package private(set) var isAnimating = false
        /// Counts animations, so the end of one that another replaced does not end the newer.
        private var animation = 0

        /// - Parameters:
        ///   - view: The view the surface draws into.
        ///   - changed: Called when ``current`` has a new value to read, now and on every frame
        ///     while ``isAnimating``.
        package init(view: UIView, changed: @escaping () -> Void) {
            self.view = view
            self.changed = changed
            follower.isHidden = true
            follower.isUserInteractionEnabled = false
            view.addSubview(follower)
            let center = NotificationCenter.default
            observers.append(
                center.addObserver(
                    forName: UIResponder.keyboardWillChangeFrameNotification, object: nil,
                    queue: .main
                ) { [weak self] notification in
                    let info = notification.userInfo
                    let frame = (info?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?
                        .cgRectValue
                    let duration =
                        (info?[UIResponder.keyboardAnimationDurationUserInfoKey] as? NSNumber)?
                        .doubleValue
                    let curve =
                        (info?[UIResponder.keyboardAnimationCurveUserInfoKey] as? NSNumber)?
                        .uintValue
                    MainActor.assumeIsolated {
                        self?.keyboardWillMove(to: frame, duration: duration ?? 0, curve: curve)
                    }
                })
            observers.append(
                center.addObserver(
                    forName: UIResponder.keyboardWillHideNotification, object: nil, queue: .main
                ) { [weak self] notification in
                    let info = notification.userInfo
                    let duration =
                        (info?[UIResponder.keyboardAnimationDurationUserInfoKey] as? NSNumber)?
                        .doubleValue
                    let curve =
                        (info?[UIResponder.keyboardAnimationCurveUserInfoKey] as? NSNumber)?
                        .uintValue
                    MainActor.assumeIsolated {
                        self?.move(to: 0, duration: duration ?? 0, curve: curve)
                    }
                })
        }

        deinit {
            for observer in observers {
                NotificationCenter.default.removeObserver(observer)
            }
        }

        /// How much of the view's bottom the keyboard covers right now, in points.
        package var current: CGFloat {
            guard isAnimating, let presentation = follower.layer.presentation() else {
                return target
            }
            return max(0, presentation.bounds.height)
        }

        /// Forgets the keyboard: the view left its window.
        package func reset() {
            move(to: 0, duration: 0, curve: nil)
        }

        private func keyboardWillMove(to frame: CGRect?, duration: TimeInterval, curve: UInt?) {
            guard let view, let window = view.window, let frame else {
                return
            }
            let screen = window.screen
            move(
                to: Self.overlap(
                    keyboard: frame, screen: screen.bounds,
                    view: view.convert(view.bounds, to: screen.coordinateSpace)),
                duration: duration, curve: curve)
        }

        /// How much of `view` a keyboard at `keyboard` covers from the bottom, all three in
        /// screen coordinates. A keyboard that does not sit on the screen's bottom edge (the
        /// floating and the split keyboard of an iPad) covers nothing the flow has to move for.
        package static func overlap(keyboard: CGRect, screen: CGRect, view: CGRect) -> CGFloat {
            guard !keyboard.isEmpty, keyboard.maxY >= screen.maxY - 0.5,
                keyboard.minY < screen.maxY
            else {
                return 0
            }
            return min(max(0, view.maxY - keyboard.minY), view.height)
        }

        private func move(to inset: CGFloat, duration: TimeInterval, curve: UInt?) {
            guard inset != target || isAnimating else {
                return
            }
            let from = current
            target = inset
            animation += 1
            follower.layer.removeAllAnimations()
            guard duration > 0, follower.window != nil, from != inset else {
                follower.frame.size.height = inset
                isAnimating = false
                changed()
                return
            }
            follower.frame.size.height = from
            isAnimating = true
            let started = animation
            // The curve is the keyboard's own, which has no named option.
            let options = UIView.AnimationOptions(rawValue: (curve ?? 7) << 16)
            UIView.animate(
                withDuration: duration, delay: 0, options: [options, .beginFromCurrentState]
            ) {
                self.follower.frame.size.height = inset
            } completion: { [weak self] _ in
                guard let self, self.animation == started else {
                    return
                }
                self.isAnimating = false
                self.changed()
            }
            changed()
        }
    }
#endif
