#if os(iOS)
    import CoreImage
    import QuartzCore
    import UIKit

    /// Blurs snapshots for `layerBlur`.
    @MainActor
    enum LayerBlur {
        private static let context = CIContext()

        /// `image` blurred by a Gaussian of deviation `sigma` pixels, into transparency at the
        /// edges, at its own size.
        static func blur(_ image: CGImage, sigma: CGFloat) -> CGImage? {
            let input = CIImage(cgImage: image)
            let output = input.applyingGaussianBlur(sigma: Double(sigma)).cropped(to: input.extent)
            return context.createCGImage(output, from: input.extent)
        }
    }

    /// The node kinds of batch version 1 (views protocol, "Node kinds").
    package enum NodeKind: UInt8, Sendable {
        case view = 1
        case text = 2
        case pressable = 3
        case safeArea = 4
        case scrollView = 5
        case path = 6
        case image = 7
        case external = 8
        case textInput = 9
        case stack = 10
        case screen = 11
    }

    /// What node views need from the view that hosts the tree: shared resources, and the way
    /// back to the core for input.
    @MainActor
    protocol NodeHost: AnyObject {
        var textSystem: TextSystem { get }
        /// Physical pixels per logical pixel.
        var displayScale: CGFloat { get }
        /// A loaded image, `nil` until it is.
        func image(for url: String) -> UIImage?
        func press(_ handler: UInt32)
        func pointer(_ handler: UInt32, pointer: Int64, phase: UInt8, at location: CGPoint)
        func accessibilityAction(_ handler: UInt32, name: String) -> Bool
        /// A new id for a touch, unique for the host's lifetime.
        func nextPointerId() -> Int64
        /// The platform gave `field` the keyboard.
        func textFocused(_ field: TextInputNodeView)
        /// The platform took the keyboard from `field` and gave it to no other field.
        func textBlurred(_ field: TextInputNodeView)
        /// `field` holds `state` after a change, which `edit` made when the platform named it;
        /// the revision after it, `nil` when the core does not know the field.
        func textChanged(
            _ field: TextInputNodeView, _ state: TextFieldState, edit: TextEdit?, byUser: Bool
        ) -> UInt64?
        /// The return key of `field`, as its action name.
        func textAction(_ field: TextInputNodeView, _ action: String)
        /// The app component providing `renderer`, `nil` when none does.
        func nativeComponent(renderer: String) -> VoidhashNativeComponentRegistration?
        /// An event the component in external view `id` emitted, with a JSON object payload.
        func componentEvent(_ id: Int32, name: String, payload: String)
        /// The component in external view `id` wrote prop `name` to the JSON value `json`.
        func writeComponentProp(_ id: Int32, name: String, json: String)
        /// The component in external view `id` wants `size` (`NaN` on an axis it leaves to
        /// the layout).
        func componentSize(_ id: Int32, _ size: CGSize)
    }

    extension NodeHost {
        func nativeComponent(renderer: String) -> VoidhashNativeComponentRegistration? {
            return nil
        }

        func componentEvent(_ id: Int32, name: String, payload: String) {}

        func writeComponentProp(_ id: Int32, name: String, json: String) {}

        func componentSize(_ id: Int32, _ size: CGSize) {}
    }

    /// One view of the tree: frame, transform, opacity, decoration, clipping, hit-testing,
    /// presses, pointers and accessibility. Kinds with their own content subclass it.
    ///
    /// The layer's anchor is its top-left corner, so the `transform` prop applies about that
    /// corner, as the protocol defines it, and frames are set as bounds and position (a
    /// transformed view has no meaningful `frame`).
    @MainActor
    class NodeView: UIView {
        let id: Int32
        let kind: NodeKind
        weak var host: NodeHost?
        private(set) var props: [String: PropValue] = [:]
        /// The frame in the parent, before the transform.
        private(set) var nodeFrame: CGRect = .zero
        /// Subviews in paint order.
        private(set) var childNodes: [NodeView] = []
        weak var parentNode: NodeView?

        private lazy var decoration = BoxDecoration(layer: layer)
        /// Clips the subviews to the bounds and corners while `clips` is set, without clipping
        /// the view's own shadows and outline.
        private var clipView: UIView?
        private var backdrop: BackdropBlurView?
        /// While `layerBlur` is set, holds what the view draws (decoration, content and
        /// subviews), invisible; `blurOverlay` shows it blurred.
        private var blurBody: UIView?
        private var blurOverlay: CALayer?
        /// Touches that began on this view, by the pointer id they are reported with.
        private var touchIds: [ObjectIdentifier: Int64] = [:]
        /// What a live region last read, to announce only changes.
        var spokenLiveText: String?
        /// Screen transitions' part of the view's state, over what its props say.
        private(set) var navigation = NavigationState()
        /// What changed since the last ``refresh()``; everything before the first.
        private var pending = Change(keys: [], resized: true, everything: true)

        /// What a batch changed on a view, so that a refresh rebuilds only that: style
        /// transitions change a few props on every frame.
        struct Change {
            /// Prop keys merged.
            var keys: Set<String>
            /// The frame's size changed.
            var resized: Bool
            /// Nothing is known to be unchanged: the view's first refresh.
            var everything: Bool

            /// Whether any of `keys` changed, or the size when `orSize`.
            func touches(_ keys: Set<String>, orSize: Bool = true) -> Bool {
                return everything || (orSize && resized) || !self.keys.isDisjoint(with: keys)
            }
        }

        /// What screen transitions set on a view (a screen, a presentation's stack, a shared
        /// element), kept apart from its props so a batch's ``refresh()`` does not undo it.
        struct NavigationState: Equatable {
            /// Moves the view after its `transform`.
            var offset: CGPoint = .zero
            /// Multiplies its `opacity`.
            var alpha: CGFloat = 1
            /// Another screen covers it: it takes no touches.
            var covered = false
            /// The screen covering it hides it from assistive technology.
            var hiddenFromAccessibility = false
            /// A shared element whose flight shows in its place.
            var hiddenForFlight = false
        }

        required init(id: Int32, kind: NodeKind, host: NodeHost?) {
            self.id = id
            self.kind = kind
            self.host = host
            super.init(frame: .zero)
            layer.anchorPoint = .zero
            isMultipleTouchEnabled = true
            // Its layers go below every subview, so it is made before any.
            _ = decoration
        }

        @available(*, unavailable)
        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        /// Where subviews go.
        var contentHost: UIView {
            return clipView ?? bodyView
        }

        /// What holds the view's own drawing and its subviews.
        var bodyView: UIView {
            return blurBody ?? self
        }

        // MARK: - Operations

        /// Merges a `PROPS` delta; `null` returns a key to its default.
        func merge(_ delta: [String: PropValue]) {
            for (key, value) in delta {
                switch value {
                case .null, .undefined:
                    props[key] = nil
                default:
                    props[key] = value
                }
                pending.keys.insert(key)
            }
        }

        func place(_ frame: CGRect) {
            if frame.size != nodeFrame.size {
                pending.resized = true
            }
            nodeFrame = frame
        }

        /// Makes `children` the subviews, in this order; subviews not listed leave the view
        /// but stay alive.
        func setChildren(_ children: [NodeView]) {
            for old in childNodes where old.parentNode === self && !children.contains(where: { $0 === old }) {
                old.removeFromSuperview()
                old.parentNode = nil
            }
            for child in children {
                if let previous = child.parentNode, previous !== self {
                    previous.childNodes.removeAll { $0 === child }
                }
                child.parentNode = self
            }
            childNodes = children
            placeChildren()
        }

        /// Puts the subviews into `contentHost` in paint order.
        private func placeChildren() {
            let host = contentHost
            let current = host.subviews.compactMap { $0 as? NodeView }
            guard current.count != childNodes.count || !zip(current, childNodes).allSatisfy({ $0 === $1 })
            else {
                return
            }
            for child in childNodes {
                // Appending an existing subview moves it to the front.
                host.addSubview(child)
            }
        }

        /// The view was deleted or reset away: it is never shown again.
        func released() {}

        /// Whether the view or one in its subtree shows an app component's live view.
        var showsNativeComponent: Bool {
            return childNodes.contains { $0.showsNativeComponent }
        }

        /// Called when the view leaves the tree for good.
        func detachFromParent() {
            parentNode?.childNodes.removeAll { $0 === self }
            parentNode = nil
            removeFromSuperview()
        }

        // MARK: - Applying props and frames

        /// Applies the props and frame after a batch changed them, rebuilding only what the
        /// changed props and size feed.
        func refresh() {
            let change = pending
            pending = Change(keys: [], resized: false, everything: false)
            let size = nodeFrame.size
            bounds = CGRect(origin: bounds.origin, size: size)
            layer.position = nodeFrame.origin
            applyNavigation()
            // First: it decides which layer the decoration paints on.
            if change.touches(["layerBlur"], orSize: false) {
                updateLayerBlur()
            }
            if change.touches(Self.decorationKeys.union(["layerBlur"])) {
                decoration.update(props: props, size: size)
            }
            if change.touches(["clips", "cornerRadii", "layerBlur"]) {
                updateClip()
            }
            if change.touches(["backdropBlur", "cornerRadii"]) {
                updateBackdrop()
            }
            if change.touches(["blendMode"], orSize: false) {
                layer.compositingFilter = Self.compositingFilter(props["blendMode"]?.string)
            }
            accessibilityViewIsModal = props["accessibilityViewIsModal"]?.bool == true
            refreshContent(change)
        }

        /// The props the decoration paints from.
        private static let decorationKeys: Set<String> = [
            "backgroundColor", "backgroundGradient", "borderWidths", "borderColors", "borderStyle",
            "cornerRadii", "shadows", "outline",
        ]

        /// Changes the transitions' part of the view's state. Inside an animation block the
        /// change animates.
        func setNavigation(_ change: (inout NavigationState) -> Void) {
            var state = navigation
            change(&state)
            guard state != navigation else {
                return
            }
            navigation = state
            applyNavigation()
        }

        private func applyNavigation() {
            transform = transformProp.concatenating(
                CGAffineTransform(translationX: navigation.offset.x, y: navigation.offset.y))
            alpha = CGFloat(min(max(props["opacity"]?.number ?? 1, 0), 1)) * navigation.alpha
            isHidden = props["hidden"]?.bool == true || navigation.hiddenForFlight
            isUserInteractionEnabled = pointerEvents != "none" && !navigation.covered
            accessibilityElementsHidden =
                props["accessibilityElementsHidden"]?.bool == true || props["closing"]?.bool == true
                || navigation.hiddenFromAccessibility
        }

        /// Kind-specific content; called at the end of ``refresh()`` with what changed.
        func refreshContent(_ change: Change) {}

        /// An image this view may show finished loading.
        func imageLoaded(_ url: String) {}

        var shape: RoundedRect {
            return decoration.shape
        }

        var transformProp: CGAffineTransform {
            guard let values = props["transform"]?.numbers, values.count == 6 else {
                return .identity
            }
            return CGAffineTransform(
                a: values[0], b: values[1], c: values[2], d: values[3], tx: values[4], ty: values[5])
        }

        private var pointerEvents: String? {
            return props["pointerEvents"]?.string
        }

        private func updateClip() {
            let clips = props["clips"]?.bool == true && clipsWithContainer
            if clips, clipView == nil {
                let view = UIView()
                view.layer.anchorPoint = .zero
                bodyView.addSubview(view)
                clipView = view
                for child in childNodes {
                    view.addSubview(child)
                }
            } else if !clips, let view = clipView {
                clipView = nil
                for child in childNodes {
                    bodyView.addSubview(child)
                }
                view.removeFromSuperview()
            }
            guard let clipView else {
                return
            }
            clipView.bounds = CGRect(origin: .zero, size: nodeFrame.size)
            clipView.layer.position = .zero
            Self.clip(clipView.layer, to: shape)
        }

        /// Whether `clips` puts the subviews in a clipping container; a scroll view clips its
        /// content itself.
        var clipsWithContainer: Bool {
            return true
        }

        /// Clips `layer` and its sublayers to `shape`, by its corner radius when it has one.
        static func clip(_ layer: CALayer, to shape: RoundedRect) {
            layer.masksToBounds = true
            if let radius = shape.uniformRadius {
                layer.cornerRadius = radius
                layer.mask = nil
            } else {
                layer.cornerRadius = 0
                let mask = (layer.mask as? CAShapeLayer) ?? CAShapeLayer()
                mask.path = shape.path
                layer.mask = mask
            }
            if #available(iOS 13.0, *) {
                layer.cornerCurve = .circular
            }
        }

        /// `backdropBlur`: what is behind the view, blurred within its bounds, below its own
        /// background.
        private func updateBackdrop() {
            let sigma = props["backdropBlur"]?.number ?? 0
            guard sigma > 0 else {
                backdrop?.removeFromSuperview()
                backdrop = nil
                return
            }
            let effect = backdrop ?? BackdropBlurView()
            effect.sigma = CGFloat(sigma)
            if backdrop == nil {
                effect.isUserInteractionEnabled = false
                insertSubview(effect, at: 0)
                // Below the decoration, which paints the background over the blur.
                layer.insertSublayer(effect.layer, at: 0)
                backdrop = effect
            }
            effect.frame = CGRect(origin: .zero, size: nodeFrame.size)
            Self.clip(effect.layer, to: shape)
        }

        /// `layerBlur`: the view with its subviews, blurred. Core Animation has no public filter
        /// for a view tree, so the view draws into a hidden body, and a snapshot of it, blurred
        /// with Core Image, shows in its place; ``renderLayerBlur()`` renews the snapshot after
        /// every batch. The blurred copy takes no touches; the body under it does.
        private func updateLayerBlur() {
            let blurred = (props["layerBlur"]?.number ?? 0) > 0
            if blurred, blurBody == nil {
                let body = UIView()
                body.layer.anchorPoint = .zero
                body.isUserInteractionEnabled = true
                // Everything the view draws moves into the body, in order.
                let moving = layer.sublayers ?? []
                addSubview(body)
                for sublayer in moving where sublayer !== backdrop?.layer {
                    if let view = subviews.first(where: { $0.layer === sublayer }) {
                        body.addSubview(view)
                    } else {
                        body.layer.addSublayer(sublayer)
                    }
                }
                decoration.move(to: body.layer)
                body.layer.opacity = 0
                let overlay = CALayer()
                layer.addSublayer(overlay)
                blurBody = body
                blurOverlay = overlay
            } else if !blurred, let body = blurBody {
                blurBody = nil
                blurOverlay?.removeFromSuperlayer()
                blurOverlay = nil
                for sublayer in body.layer.sublayers ?? [] {
                    if let view = body.subviews.first(where: { $0.layer === sublayer }) {
                        addSubview(view)
                    } else {
                        layer.addSublayer(sublayer)
                    }
                }
                decoration.move(to: layer)
                body.removeFromSuperview()
            }
            blurBody?.bounds = CGRect(origin: .zero, size: nodeFrame.size)
            blurBody?.layer.position = .zero
        }

        /// Renews the blurred snapshot of a view with `layerBlur`, after its subtree changed.
        func renderLayerBlur() {
            guard let body = blurBody, let overlay = blurOverlay,
                let sigma = props["layerBlur"]?.number, sigma > 0
            else {
                return
            }
            let size = nodeFrame.size
            guard size.width > 0, size.height > 0 else {
                overlay.contents = nil
                return
            }
            // The blur spreads about three deviations past the edges.
            let margin = (CGFloat(sigma) * 3).rounded(.up)
            let canvas = CGSize(width: size.width + margin * 2, height: size.height + margin * 2)
            let scale = host?.displayScale ?? 1
            let format = UIGraphicsImageRendererFormat()
            format.scale = scale
            format.opaque = false
            body.layer.opacity = 1
            let snapshot = TextInputNodeView.withSecureTextHidden(in: body) {
                UIGraphicsImageRenderer(size: canvas, format: format).image { context in
                    context.cgContext.translateBy(x: margin, y: margin)
                    body.layer.render(in: context.cgContext)
                }
            }
            body.layer.opacity = 0
            overlay.frame = CGRect(x: -margin, y: -margin, width: canvas.width, height: canvas.height)
            overlay.contentsScale = scale
            overlay.contents = snapshot.cgImage.flatMap {
                LayerBlur.blur($0, sigma: CGFloat(sigma) * scale)
            }
        }

        /// The Core Animation compositing filter of a CSS `mix-blend-mode` keyword.
        private static func compositingFilter(_ mode: String?) -> Any? {
            guard let mode else {
                return nil
            }
            let names: [String: String] = [
                "multiply": "multiplyBlendMode",
                "screen": "screenBlendMode",
                "overlay": "overlayBlendMode",
                "darken": "darkenBlendMode",
                "lighten": "lightenBlendMode",
                "color-dodge": "colorDodgeBlendMode",
                "color-burn": "colorBurnBlendMode",
                "hard-light": "hardLightBlendMode",
                "soft-light": "softLightBlendMode",
                "difference": "differenceBlendMode",
                "exclusion": "exclusionBlendMode",
                "hue": "hueBlendMode",
                "saturation": "saturationBlendMode",
                "color": "colorBlendMode",
                "luminosity": "luminosityBlendMode",
                "plus-lighter": "plusL",
                "plus-darker": "plusD",
            ]
            return names[mode]
        }

        // MARK: - Hit-testing

        override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
            // Unlike UIKit's, a transparent view still takes touches, as on the web; and
            // subviews outside the bounds take them unless the view clips.
            guard !isHidden, isUserInteractionEnabled else {
                return nil
            }
            let inside = self.point(inside: point, with: event)
            if pointerEvents != "box-only", inside || props["clips"]?.bool != true {
                if let hit = hitTestChildren(point, with: event) {
                    return hit
                }
            }
            if pointerEvents == "box-none" {
                return nil
            }
            return inside ? self : nil
        }

        /// The topmost subview the point hits.
        func hitTestChildren(_ point: CGPoint, with event: UIEvent?) -> UIView? {
            for child in childNodes.reversed() where child.superview != nil {
                if let hit = child.hitTest(child.convert(point, from: self), with: event) {
                    return hit
                }
            }
            return nil
        }

        // MARK: - Touches

        func handler(_ key: String) -> UInt32? {
            guard let value = props[key]?.number, value >= 0, value <= Double(UInt32.max) else {
                return nil
            }
            return UInt32(value)
        }

        override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
            let pointer = handler("onPointer")
            guard let host, pointer != nil || takesPresses else {
                super.touchesBegan(touches, with: event)
                return
            }
            for touch in touches {
                let id = host.nextPointerId()
                touchIds[ObjectIdentifier(touch)] = id
                if let pointer {
                    host.pointer(pointer, pointer: id, phase: 0, at: touch.location(in: self))
                }
            }
        }

        override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
            guard touches.contains(where: { touchIds[ObjectIdentifier($0)] != nil }) else {
                super.touchesMoved(touches, with: event)
                return
            }
            guard let host, let pointer = handler("onPointer") else {
                return
            }
            for touch in touches {
                if let id = touchIds[ObjectIdentifier(touch)] {
                    host.pointer(pointer, pointer: id, phase: 1, at: touch.location(in: self))
                }
            }
        }

        override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
            finish(touches, cancelled: false, event: event)
        }

        override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
            finish(touches, cancelled: true, event: event)
        }

        private func finish(_ touches: Set<UITouch>, cancelled: Bool, event: UIEvent?) {
            let tracked = touches.filter { touchIds[ObjectIdentifier($0)] != nil }
            guard !tracked.isEmpty else {
                if cancelled {
                    super.touchesCancelled(touches, with: event)
                } else {
                    super.touchesEnded(touches, with: event)
                }
                return
            }
            for touch in tracked {
                guard let id = touchIds.removeValue(forKey: ObjectIdentifier(touch)), let host
                else {
                    continue
                }
                let location = touch.location(in: self)
                if let pointer = handler("onPointer") {
                    host.pointer(pointer, pointer: id, phase: cancelled ? 3 : 2, at: location)
                }
                // A tap: lifted inside the view, not cancelled by a scroll or the system.
                if !cancelled, self.point(inside: location, with: event),
                    let press = pressHandler(at: location)
                {
                    host.press(press)
                }
            }
        }

        /// Whether a tap on the view may press a handler.
        var takesPresses: Bool {
            return handler("onPress") != nil
        }

        /// The handler a tap at `location` (in the view's coordinates) presses.
        func pressHandler(at location: CGPoint) -> UInt32? {
            return handler("onPress")
        }

        // MARK: - Accessibility

        /// Whether assistive technology sees the view as one element, by React Native's rules:
        /// as `accessible` says, else text and pressables are, other views are not.
        var accessibleElement: Bool {
            // A button holding a developer's component is a container of the button's element
            // and the component's.
            if keepsComponents {
                return false
            }
            if let accessible = props["accessible"]?.bool {
                return accessible
            }
            return kind == .text || kind == .textInput || kind == .pressable
                || props["onPress"] != nil
        }

        /// Text the view itself shows.
        var ownText: String? {
            return nil
        }

        /// What the view reads as: its label, or the text it and its subviews show.
        var spokenText: String? {
            if let label = props["accessibilityLabel"]?.string {
                return label
            }
            var parts: [String] = []
            if let text = ownText, !text.isEmpty {
                parts.append(text)
            }
            for child in childNodes
            where !child.isHidden && !child.accessibilityElementsHidden {
                if let text = child.spokenText, !text.isEmpty {
                    parts.append(text)
                }
            }
            return parts.isEmpty ? nil : parts.joined(separator: " ")
        }

        override var isAccessibilityElement: Bool {
            get { accessibleElement }
            set {}
        }

        override var accessibilityLabel: String? {
            get { accessibleElement ? spokenText : props["accessibilityLabel"]?.string }
            set {}
        }

        /// Whether the view is an `accessible` view holding a developer's component (views
        /// protocol, "Native components", `accessibilityKeepsComponents`): its elements are
        /// the button itself, then the component's own.
        var keepsComponents: Bool {
            return props["accessibilityKeepsComponents"]?.bool == true
        }

        /// The element standing for the view itself while it keeps components.
        private lazy var buttonElement = NodeButtonElement(node: self)

        override var accessibilityElements: [Any]? {
            get {
                guard keepsComponents else {
                    return nil
                }
                return [buttonElement] + componentElements(under: self)
            }
            set {}
        }

        /// What of the subtree of `node` reads on its own after the button, in order: each
        /// component's view, and a view under it that decides for itself (`accessible`) and
        /// holds one.
        private func componentElements(under node: NodeView) -> [Any] {
            var elements: [Any] = []
            for child in node.childNodes
            where !child.isHidden && !child.accessibilityElementsHidden {
                if let view = (child as? ExternalNodeView)?.component?.view {
                    elements.append(view)
                } else if child.props["accessible"] != nil || child.keepsComponents {
                    if child.showsNativeComponent {
                        elements.append(child)
                    }
                } else {
                    elements += componentElements(under: child)
                }
            }
            return elements
        }

        override var accessibilityHint: String? {
            get { props["accessibilityHint"]?.string }
            set {}
        }

        override var accessibilityTraits: UIAccessibilityTraits {
            get { Self.traits(role: props["accessibilityRole"]?.string, state: props["accessibilityState"]) }
            set {}
        }

        override var accessibilityValue: String? {
            get { Self.value(props["accessibilityValue"], state: props["accessibilityState"]) }
            set {}
        }

        /// React Native's roles as traits, with the disabled, selected and busy states.
        static func traits(role: String?, state: PropValue?) -> UIAccessibilityTraits {
            var traits: UIAccessibilityTraits = []
            switch role {
            case "button", "togglebutton", "checkbox", "radio", "switch", "menuitem":
                traits.insert(.button)
            case "link": traits.insert(.link)
            case "header": traits.insert(.header)
            case "image": traits.insert(.image)
            case "imagebutton": traits.formUnion([.image, .button])
            case "adjustable": traits.insert(.adjustable)
            case "search": traits.insert(.searchField)
            case "text": traits.insert(.staticText)
            case "summary": traits.insert(.summaryElement)
            case "keyboardkey": traits.insert(.keyboardKey)
            case "tab": traits.insert(.button)
            case "tablist": traits.insert(.tabBar)
            default: break
            }
            if state?["disabled"]?.bool == true {
                traits.insert(.notEnabled)
            }
            if state?["selected"]?.bool == true || state?["checked"]?.bool == true && role == "radio" {
                traits.insert(.selected)
            }
            if state?["busy"]?.bool == true {
                traits.insert(.updatesFrequently)
            }
            return traits
        }

        /// `accessibilityValue` (its text, or `now` as a percentage of `min`…`max`), followed by
        /// the checked and expanded states, as React Native reads them.
        static func value(_ value: PropValue?, state: PropValue?) -> String? {
            var parts: [String] = []
            if let text = value?["text"]?.string {
                parts.append(text)
            } else if let now = value?["now"]?.number {
                if let min = value?["min"]?.number, let max = value?["max"]?.number, max > min {
                    let formatter = NumberFormatter()
                    formatter.numberStyle = .percent
                    parts.append(
                        formatter.string(from: NSNumber(value: (now - min) / (max - min)))
                            ?? "\(now)")
                } else {
                    parts.append(NumberFormatter.localizedString(from: NSNumber(value: now), number: .decimal))
                }
            }
            switch state?["checked"] {
            case .bool(true)?: parts.append("checked")
            case .bool(false)?: parts.append("unchecked")
            case .string("mixed")?: parts.append("mixed")
            default: break
            }
            if let expanded = state?["expanded"]?.bool {
                parts.append(expanded ? "expanded" : "collapsed")
            }
            return parts.isEmpty ? nil : parts.joined(separator: ", ")
        }

        private var declaredActions: [(name: String, label: String?)] {
            return (props["accessibilityActions"]?.array ?? []).compactMap { action in
                guard let name = action["name"]?.string else {
                    return nil
                }
                return (name, action["label"]?.string)
            }
        }

        @discardableResult
        private func perform(_ name: String) -> Bool {
            guard declaredActions.contains(where: { $0.name == name }),
                let handler = handler("onAccessibilityAction"), let host
            else {
                return false
            }
            return host.accessibilityAction(handler, name: name)
        }

        override func accessibilityActivate() -> Bool {
            if let press = handler("onPress"), let host {
                host.press(press)
                return true
            }
            return perform("activate")
        }

        override func accessibilityIncrement() {
            adjust("increment")
        }

        override func accessibilityDecrement() {
            adjust("decrement")
        }

        /// Moves an adjustable element: its declared action, or for the `adjustable` role the
        /// action by name even when undeclared, which the core hands the view's component or
        /// turns into a press.
        private func adjust(_ name: String) {
            if perform(name) {
                return
            }
            if props["accessibilityRole"]?.string == "adjustable",
                let handler = handler("onAccessibilityAction"), let host
            {
                _ = host.accessibilityAction(handler, name: name)
            }
        }

        override func accessibilityPerformMagicTap() -> Bool {
            return perform("magicTap")
        }

        override func accessibilityPerformEscape() -> Bool {
            return perform("escape")
        }

        override var accessibilityCustomActions: [UIAccessibilityCustomAction]? {
            get {
                let standard: Set<String> = ["activate", "increment", "decrement", "magicTap", "escape"]
                let custom = declaredActions.filter { !standard.contains($0.name) }
                guard !custom.isEmpty else {
                    return nil
                }
                return custom.map { action in
                    UIAccessibilityCustomAction(name: action.label ?? action.name) {
                        [weak self] _ in
                        self?.perform(action.name) ?? false
                    }
                }
            }
            set {}
        }
    }

    /// The button element of a view that keeps a developer's component: the view's frame,
    /// its label (or the text of the flow's own views under it, none of the component's), its
    /// traits, value, hint and actions; activating it presses the view.
    final class NodeButtonElement: UIAccessibilityElement {
        private weak var node: NodeView?

        init(node: NodeView) {
            self.node = node
            super.init(accessibilityContainer: node)
        }

        override var accessibilityFrame: CGRect {
            get {
                guard let node else {
                    return .zero
                }
                return UIAccessibility.convertToScreenCoordinates(node.bounds, in: node)
            }
            set {}
        }

        override var accessibilityLabel: String? {
            get { node?.spokenText }
            set {}
        }

        override var accessibilityHint: String? {
            get { node?.accessibilityHint }
            set {}
        }

        override var accessibilityValue: String? {
            get { node?.accessibilityValue }
            set {}
        }

        override var accessibilityTraits: UIAccessibilityTraits {
            get { node?.accessibilityTraits ?? [] }
            set {}
        }

        override var accessibilityCustomActions: [UIAccessibilityCustomAction]? {
            get { node?.accessibilityCustomActions }
            set {}
        }

        override func accessibilityActivate() -> Bool {
            return node?.accessibilityActivate() ?? false
        }

        override func accessibilityIncrement() {
            node?.accessibilityIncrement()
        }

        override func accessibilityDecrement() {
            node?.accessibilityDecrement()
        }
    }

    /// A blur of what is behind it at a requested strength. UIKit's public blur effects have a
    /// fixed strength, so this one holds the effect part-way through a paused property
    /// animator from no effect to a full blur, at the fraction of the full blur's radius that
    /// was asked for. The effect's tint scales with it.
    ///
    /// A paused animator must not be released, so it exists only while the view is in a
    /// window, and is rebuilt when the app returns to the foreground, where UIKit may have
    /// reset it.
    @MainActor
    final class BackdropBlurView: UIVisualEffectView {
        /// The blur radius (sigma) of the effect at full strength.
        static let fullSigma: CGFloat = 30

        private var animator: UIViewPropertyAnimator?
        private var foregroundObserver: NSObjectProtocol?

        /// The requested blur radius (sigma); strengths beyond the full effect's are capped.
        var sigma: CGFloat = 0 {
            didSet {
                if sigma != oldValue {
                    animator?.fractionComplete = fraction
                }
            }
        }

        private var fraction: CGFloat {
            return min(max(sigma / Self.fullSigma, 0), 1)
        }

        init() {
            super.init(effect: nil)
        }

        required init?(coder: NSCoder) {
            fatalError("init(coder:) is not supported")
        }

        override func didMoveToWindow() {
            super.didMoveToWindow()
            if window == nil {
                stop()
                if let foregroundObserver {
                    NotificationCenter.default.removeObserver(foregroundObserver)
                }
                foregroundObserver = nil
            } else {
                start()
                if foregroundObserver == nil {
                    foregroundObserver = NotificationCenter.default.addObserver(
                        forName: UIApplication.willEnterForegroundNotification, object: nil,
                        queue: .main
                    ) { [weak self] _ in
                        MainActor.assumeIsolated {
                            self?.stop()
                            self?.start()
                        }
                    }
                }
            }
        }

        private func start() {
            guard animator == nil else {
                return
            }
            effect = nil
            let animator = UIViewPropertyAnimator(duration: 1, curve: .linear) { [weak self] in
                self?.effect = UIBlurEffect(style: .light)
            }
            animator.pausesOnCompletion = true
            animator.fractionComplete = fraction
            self.animator = animator
        }

        private func stop() {
            guard let animator else {
                return
            }
            animator.stopAnimation(true)
            self.animator = nil
            effect = nil
        }
    }
#endif
