import Foundation

#if os(iOS)
    import UIKit
#endif

/// What the end user sees while a flow waits for the network: see ``FlowViewRenderer/loading``.
///
/// A presentation that has to wait for its flow (its location's answer, or its package) shows the
/// loading state full screen once it has waited ``delay``, so a flow already on the device is shown
/// without it. The loading state stays until the flow takes its place, or the presentation fails
/// or is cancelled. The end user can leave it: the presentation then ends as
/// ``FlowResult/dismissed``, as when the app dismisses it, and is reported as cancelled by the end
/// user.
public struct FlowLoading: Sendable {
    /// How long a presentation waits before its loading state shows.
    public static let delay: TimeInterval = 0.4

    enum Kind: Sendable {
        case standard
        case none
        #if os(iOS)
            case custom(
                @MainActor @Sendable (_ cancel: @escaping @MainActor @Sendable () -> Void) -> UIView)
        #endif
    }

    let kind: Kind

    /// The SDK's own: a spinner VoiceOver announces as in progress, and a close button, on the
    /// system background, in light and dark mode.
    public static let standard = FlowLoading(kind: .standard)

    /// None: the app's screen stays as it is until the flow is shown, as before loading states.
    public static let none = FlowLoading(kind: .none)

    #if os(iOS)
        /// The app's own view, which fills the screen; lay it out within its safe area. Call
        /// `cancel` to let the end user leave it: the presentation then ends as
        /// ``FlowResult/dismissed``. A view that offers no way out keeps the end user until the
        /// flow is shown or the presentation fails, at most the presentation's deadline.
        public static func custom(
            _ makeView: @escaping @MainActor @Sendable (
                _ cancel: @escaping @MainActor @Sendable () -> Void
            ) -> UIView
        ) -> FlowLoading {
            return FlowLoading(kind: .custom(makeView))
        }
    #endif

    /// Whether a loading state is shown at all.
    var shows: Bool {
        if case .none = kind {
            return false
        }
        return true
    }
}

#if os(iOS)
    extension FlowLoading {
        /// The view of the loading state, whose `cancel` lets the end user leave it.
        @MainActor
        func makeView(cancel: @escaping @MainActor @Sendable () -> Void) -> UIView? {
            switch kind {
            case .none:
                return nil
            case .standard:
                return StandardFlowLoadingView(cancel: cancel)
            case .custom(let makeView):
                return makeView(cancel)
            }
        }
    }

    /// The SDK's loading state: a large spinner in the middle and a close button in the top
    /// trailing corner of the safe area, on the system background.
    ///
    /// VoiceOver moves to the spinner when the loading state appears and announces it as in
    /// progress, in the reader's language; the close button leaves it, and so does the escape
    /// gesture, which the controller showing it answers for any loading view.
    @MainActor
    final class StandardFlowLoadingView: UIView {
        let spinner = UIActivityIndicatorView(style: .large)
        let closeButton = UIButton(type: .close)
        private let cancel: @MainActor @Sendable () -> Void

        init(cancel: @escaping @MainActor @Sendable () -> Void) {
            self.cancel = cancel
            super.init(frame: .zero)
            backgroundColor = .systemBackground
            spinner.translatesAutoresizingMaskIntoConstraints = false
            spinner.startAnimating()
            closeButton.translatesAutoresizingMaskIntoConstraints = false
            closeButton.addAction(UIAction { [weak self] _ in self?.cancel() }, for: .primaryActionTriggered)
            addSubview(spinner)
            addSubview(closeButton)
            let guide = safeAreaLayoutGuide
            NSLayoutConstraint.activate([
                spinner.centerXAnchor.constraint(equalTo: guide.centerXAnchor),
                spinner.centerYAnchor.constraint(equalTo: guide.centerYAnchor),
                // The close glyph is smaller; the button is the size of a touch target.
                closeButton.widthAnchor.constraint(equalToConstant: 44),
                closeButton.heightAnchor.constraint(equalToConstant: 44),
                closeButton.topAnchor.constraint(equalTo: guide.topAnchor, constant: 8),
                closeButton.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -8),
            ])
            accessibilityElements = [spinner, closeButton]
        }

        @available(*, unavailable)
        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        /// What VoiceOver moves to when the loading state appears.
        var firstAccessibilityElement: Any? {
            return spinner
        }
    }
#endif
