#if os(iOS)
    import CoreGraphics
    import Foundation

    /// How a `screen` view moves (views protocol, "Navigation"), described as data: where a
    /// screen sits at a given progress, how the one beneath it reacts, and where a released
    /// swipe goes. Progress is the engine's: `0` off screen, `1` presented, a sheet's detent
    /// in between.
    struct ScreenMotion: Equatable {
        enum Kind: String {
            case slide, fade, none, modal, sheet, dialog

            /// A presentation's host, moving the stack inside it over a backdrop.
            var isPresentation: Bool {
                return self == .modal || self == .sheet || self == .dialog
            }

            /// Whether the screen beneath stays in view while this one rests over it.
            var leavesBelowVisible: Bool {
                return self == .sheet || self == .dialog
            }
        }

        /// A spring of the runtime's `transitionSpec`.
        struct Spring: Equatable {
            var stiffness: Double
            var damping: Double
            var mass: Double

            /// The velocity, `t` seconds in, of a damped spring that started `displacement`
            /// away from its rest moving at `velocity` (both in progress, per second for the
            /// velocity): the motion `UISpringTimingParameters` animates with these values.
            func velocity(at t: Double, displacement x0: Double, velocity v0: Double) -> Double {
                let mass = max(self.mass, .ulpOfOne)
                let omega = (max(stiffness, 0) / mass).squareRoot()
                guard omega > 0 else {
                    return v0
                }
                let zeta = damping / (2 * (max(stiffness, 0) * mass).squareRoot())
                if zeta < 1 {
                    let decay = zeta * omega
                    let omegaD = omega * (1 - zeta * zeta).squareRoot()
                    let b = (v0 + decay * x0) / omegaD
                    let envelope = exp(-decay * t)
                    // x(t) = e^(-ζωt) (x0 cos ωd·t + b sin ωd·t)
                    return envelope
                        * ((-decay * x0 + b * omegaD) * cos(omegaD * t)
                            + (-decay * b - x0 * omegaD) * sin(omegaD * t))
                }
                if zeta == 1 {
                    let b = v0 + omega * x0
                    return exp(-omega * t) * (b - omega * (x0 + b * t))
                }
                let root = (zeta * zeta - 1).squareRoot()
                let r1 = -omega * (zeta - root)
                let r2 = -omega * (zeta + root)
                let a = (v0 - r2 * x0) / (r1 - r2)
                let b = x0 - a
                return a * r1 * exp(r1 * t) + b * r2 * exp(r2 * t)
            }
        }

        enum Detent: Equatable {
            /// The height the presentation's stack laid out to.
            case auto
            /// A fraction of the presentation's height.
            case fraction(CGFloat)
        }

        /// The values the engine moves screens by (its flow navigation and transition
        /// controller), which the views protocol states under "Navigation".
        enum Engine {
            /// The runtime's springs when a screen names none.
            static let open = Spring(stiffness: 1_000, damping: 500, mass: 3)
            static let close = Spring(stiffness: 1_100, damping: 98, mass: 3)
            /// Backdrop opacity behind a modal and a sheet, at rest.
            static let modalDim: CGFloat = 0.3
            static let sheetDim: CGFloat = 0.4
            /// How far a covered slide screen drifts back, as a share of its width.
            static let parallax: CGFloat = 0.3
            /// How far from the leading edge a swipe back may start when it may not start
            /// anywhere, in points.
            static let edgeWidth: CGFloat = 24
            /// A swipe dismisses when its projected end passes this share of the way.
            static let dismissThreshold: CGFloat = 0.5
            /// Seconds of release velocity a swipe back and a sheet project forward.
            static let swipeVelocityImpact: CGFloat = 0.3
            static let snapVelocityImpact: CGFloat = 0.1
        }

        var kind: Kind
        var rightToLeft: Bool
        var open: Spring
        var close: Spring
        var detents: [Detent]
        var initialSnapIndex: Int
        var gestureEnabled: Bool
        /// A swipe back may start anywhere on the screen, not only at its leading edge.
        var gestureFromAnywhere: Bool
        var backdropDismisses: Bool
        /// A presentation whose backdrop takes touches (`backdropBehavior` `block` or
        /// `dismiss`): it is modal, and the screen beneath is hidden from assistive technology.
        var backdropBlocks: Bool

        /// The motion `props` describe, mirrored horizontally when the flow lays the screen out
        /// right to left (`layoutDirection`), whatever the device's own direction.
        init(props: [String: PropValue]) {
            let presentation = props["presentation"]?.string
            kind =
                props["motion"]?.string.flatMap(Kind.init(rawValue:))
                ?? (presentation == "transparentModal"
                    ? .dialog : presentation == "formSheet" ? .sheet : .slide)
            rightToLeft = props["layoutDirection"]?.string == "rtl"
            let spring = { (side: String, fallback: Spring) -> Spring in
                guard let spec = props["transitionSpec"]?[side] else {
                    return fallback
                }
                return Spring(
                    stiffness: spec["stiffness"]?.number ?? fallback.stiffness,
                    damping: spec["damping"]?.number ?? fallback.damping,
                    mass: spec["mass"]?.number ?? fallback.mass)
            }
            open = spring("open", Engine.open)
            close = spring("close", Engine.close)
            detents = (props["snapPoints"]?.array ?? []).compactMap { point in
                if point.string == "auto" {
                    return .auto
                }
                guard let fraction = point.number, fraction.isFinite, fraction > 0 else {
                    return nil
                }
                return .fraction(CGFloat(min(fraction, 1)))
            }
            if detents.isEmpty {
                detents = [kind == .sheet ? .auto : .fraction(1)]
            }
            initialSnapIndex = min(
                max(Int(props["initialSnapIndex"]?.number ?? 0), 0), detents.count - 1)
            gestureEnabled = props["gestureEnabled"]?.bool == true
            gestureFromAnywhere = props["gestureArea"]?.string == "screen"
            backdropDismisses =
                kind != .modal && props["backdropBehavior"]?.string == "dismiss"
            backdropBlocks =
                kind.isPresentation
                && ["block", "dismiss"].contains(props["backdropBehavior"]?.string)
        }

        /// `1` for leading-to-trailing motion, `-1` when mirrored.
        var sign: CGFloat {
            return rightToLeft ? -1 : 1
        }

        /// Whether a drag may move the screen at all: a swipe back or down when enabled, and
        /// a sheet with several detents between them even when it may not be dismissed.
        var draggable: Bool {
            switch kind {
            case .slide, .fade, .none: return gestureEnabled
            case .modal, .sheet: return gestureEnabled || detents.count > 1
            case .dialog: return false
            }
        }

        // MARK: - Geometry

        /// What a screen moves within: its own size, and for a presentation the height its
        /// stack laid out to, which an `"auto"` detent rests at.
        struct Geometry: Equatable {
            var size: CGSize
            var contentHeight: CGFloat

            /// The distance a drag covers between progress `0` and `1`.
            func extent(of kind: Kind) -> CGFloat {
                return max(kind.isPresentation ? size.height : size.width, 1)
            }
        }

        /// The detents as progress, ascending.
        func detentProgress(in geometry: Geometry) -> [CGFloat] {
            guard kind.isPresentation else {
                return [1]
            }
            return detents.map { detent in
                switch detent {
                case .fraction(let fraction):
                    return max(fraction, 0.01)
                case .auto:
                    return min(max(geometry.contentHeight / max(geometry.size.height, 1), 0.01), 1)
                }
            }
            .sorted()
        }

        /// Where the screen rests once it entered, or at detent `index`.
        func rest(in geometry: Geometry, detent index: Int? = nil) -> CGFloat {
            guard kind == .sheet || kind == .modal else {
                return 1
            }
            let detents = detentProgress(in: geometry)
            return detents[min(max(index ?? initialSnapIndex, 0), detents.count - 1)]
        }

        // MARK: - Frames

        /// What a screen shows at one progress: its translation and opacity (of the screen
        /// itself, or of a presentation's stack), and its backdrop's opacity.
        struct Frame: Equatable {
            var offset: CGPoint = .zero
            var alpha: CGFloat = 1
            var dim: CGFloat = 0
        }

        /// The screen at `progress`. With `crossFade`, the screen stays where it rests at
        /// `crossFade` and fades instead of moving (Reduce Motion).
        func frame(at progress: CGFloat, in geometry: Geometry, crossFade: CGFloat? = nil) -> Frame {
            let presented = min(max(progress, 0), 1)
            var frame = Frame()
            switch kind {
            case .slide:
                frame.offset.x = sign * geometry.size.width * (1 - progress)
            case .fade, .dialog:
                frame.alpha = presented
            case .none:
                break
            case .modal, .sheet:
                frame.offset.y = geometry.size.height * (1 - progress)
                // The backdrop is fully dimmed once the sheet reaches its lowest detent.
                let lowest = detentProgress(in: geometry).first ?? 1
                let presence = min(max(progress / max(lowest, 0.01), 0), 1)
                frame.dim = presence * (kind == .modal ? Engine.modalDim : Engine.sheetDim)
            }
            if let anchor = crossFade, kind == .slide || kind == .modal || kind == .sheet {
                frame.offset = self.frame(at: anchor, in: geometry).offset
                frame.alpha = min(max(progress / max(anchor, 0.01), 0), 1)
            }
            return frame
        }

        /// The progress a screen showing `offset` and `alpha` is at: the inverse of
        /// ``frame(at:in:crossFade:)``, to pick up an animation where it was interrupted.
        func progress(offset: CGPoint, alpha: CGFloat, in geometry: Geometry, crossFade: CGFloat?)
            -> CGFloat?
        {
            if let anchor = crossFade, kind == .slide || kind == .modal || kind == .sheet {
                return alpha * anchor
            }
            switch kind {
            case .slide:
                return 1 - offset.x / (sign * max(geometry.size.width, 1))
            case .fade, .dialog:
                return alpha
            case .modal, .sheet:
                return 1 - offset.y / max(geometry.size.height, 1)
            case .none:
                return nil
            }
        }

        /// How a screen of this motion sits under a card moving by `upper` at `progress` above
        /// it: a slide screen drifts back towards the upper screen's leading edge as the card
        /// covers it; others stay.
        func coveredOffset(by progress: CGFloat, of upper: ScreenMotion, in geometry: Geometry)
            -> CGPoint
        {
            guard kind == .slide else {
                return .zero
            }
            let covered = min(max(progress, 0), 1)
            return CGPoint(x: -upper.sign * Engine.parallax * geometry.size.width * covered, y: 0)
        }

        /// Whether a horizontal drag starting `x` points into a screen `width` wide starts at
        /// its leading edge, where a swipe back may always start.
        func startsAtLeadingEdge(_ x: CGFloat, width: CGFloat) -> Bool {
            return (rightToLeft ? width - x : x) <= Engine.edgeWidth
        }

        // MARK: - Gestures

        /// Where a drag that moved the screen `translation` points towards dismissal from
        /// `baseline` puts it: a pushed screen between gone and where it was grabbed; a sheet
        /// between its detents (or gone, when it may be dismissed), stretching with resistance
        /// beyond them.
        func dragged(from baseline: CGFloat, translation: CGFloat, in geometry: Geometry) -> CGFloat {
            let progress = baseline - translation / geometry.extent(of: kind)
            guard kind == .modal || kind == .sheet else {
                return min(max(progress, 0), baseline)
            }
            let detents = detentProgress(in: geometry)
            let upper = detents.last ?? 1
            let lower = gestureEnabled ? 0 : detents.first ?? 1
            if progress > upper {
                return upper + Self.rubberBand(progress - upper)
            }
            if progress < lower {
                return gestureEnabled ? lower : lower - Self.rubberBand(lower - progress)
            }
            return progress
        }

        /// UIKit's scroll view resistance past an edge, in progress.
        static func rubberBand(_ excess: CGFloat) -> CGFloat {
            return 1 - 1 / (excess * 0.55 + 1)
        }

        /// Where a drag released at `progress` with `velocity` (progress per second, positive
        /// towards presenting) settles: a progress to rest at, or `nil` to dismiss. The
        /// engine's release rules: a pushed screen projects the release velocity
        /// ``Engine/swipeVelocityImpact`` seconds ahead and dismisses past
        /// ``Engine/dismissThreshold``; a sheet projects ``Engine/snapVelocityImpact`` seconds
        /// ahead and takes the nearest detent, or dismissal when it may.
        func release(at progress: CGFloat, velocity: CGFloat, in geometry: Geometry) -> CGFloat? {
            guard kind == .modal || kind == .sheet else {
                let projected = (1 - progress) - velocity * Engine.swipeVelocityImpact
                return gestureEnabled && projected > Engine.dismissThreshold ? nil : 1
            }
            let detents = detentProgress(in: geometry)
            let candidates = (gestureEnabled ? [0] : []) + detents
            let projected = progress + velocity * Engine.snapVelocityImpact
            var chosen = candidates[candidates.count - 1]
            for index in 0..<(candidates.count - 1)
            where projected < (candidates[index] + candidates[index + 1]) / 2 {
                chosen = candidates[index]
                break
            }
            return chosen == 0 && gestureEnabled ? nil : chosen
        }
    }
#endif
