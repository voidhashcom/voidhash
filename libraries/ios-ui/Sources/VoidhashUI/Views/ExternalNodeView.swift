#if os(iOS)
    import UIKit

    /// An `external` view (views protocol, "Canvases" and "Native components"). `vh.canvas`
    /// draws its latest draw list; any other renderer is an app component, whose view fills
    /// this one. A renderer no component provides shows nothing.
    final class ExternalNodeView: NodeView {
        private var drawList: [UInt8] = []
        private var images: [String] = []
        private let drawing = DrawingView()
        /// The app component shown, from the first `renderer` to `DELETE` or `RESET`.
        private(set) var component: (any VoidhashNativeComponentView)?
        private var context: VoidhashNativeComponentContext?
        /// The renderer the component was created for, or found missing.
        private var resolvedRenderer: String?
        /// What the component was last given.
        private var givenProps: [String: VoidhashNativeComponentValue]?
        private var givenState: VoidhashNativeComponentValue?
        private var givenDisabled = false
        /// The size last reported for the component; `NaN` on an axis left to the layout,
        /// which is where a component starts.
        private var reportedSize = ExternalNodeView.noPreference
        /// The widths the component's view was measured at since its content last changed
        /// (`nil` for no limit), the last of them last.
        private var measuredWidths: [CGFloat?] = []

        required init(id: Int32, kind: NodeKind, host: NodeHost?) {
            super.init(id: id, kind: kind, host: host)
            addSubview(drawing)
            drawing.clipsToBounds = true
            drawing.drawer = { [weak self] context in self?.drawCanvas(in: context) }
            if #available(iOS 17.0, *) {
                registerForTraitChanges([UITraitUserInterfaceStyle.self]) {
                    (view: ExternalNodeView, _: UITraitCollection) in
                    view.environmentChanged()
                }
            }
        }

        /// Keeps the list until the next one arrives.
        func show(drawList: [UInt8], images: [String]) {
            self.drawList = drawList
            self.images = images
            drawing.setNeedsDisplay()
        }

        override func refreshContent(_ change: Change) {
            if change.touches(["renderer"]) {
                drawing.frame = CGRect(origin: .zero, size: nodeFrame.size)
                drawing.setNeedsDisplay()
                component?.view.frame = CGRect(origin: .zero, size: nodeFrame.size)
            }
            let renderer = props["renderer"]?.string
            if renderer != resolvedRenderer {
                disposeComponent()
                resolvedRenderer = renderer
                if let renderer, renderer != "vh.canvas",
                    let registration = host?.nativeComponent(renderer: renderer)
                {
                    createComponent(registration)
                    return
                }
            }
            if change.touches(["layoutDirection"], orSize: false) {
                applyLayoutDirection()
                environmentChanged()
            }
            if change.touches(["componentProps"], orSize: false) {
                giveProps()
            }
            if change.resized, component != nil, measuredWidths.last != layoutWidth {
                measureComponent(contentChanged: false)
            }
        }

        override func imageLoaded(_ url: String) {
            if images.contains(url) {
                drawing.setNeedsDisplay()
            }
        }

        private func drawCanvas(in context: CGContext) {
            guard props["renderer"]?.string == "vh.canvas", !drawList.isEmpty, let host else {
                return
            }
            let urls = images
            DrawList.draw(
                drawList, in: context,
                images: { index in
                    index < urls.count ? host.image(for: urls[index])?.cgImage : nil
                }, fonts: host.textSystem.fonts)
        }

        // MARK: - The app's component

        private func createComponent(_ registration: VoidhashNativeComponentRegistration) {
            let context = VoidhashNativeComponentContext(
                container: self, environment: environment)
            let component = registration.make(context)
            self.context = context
            self.component = component
            let view = component.view
            view.frame = CGRect(origin: .zero, size: nodeFrame.size)
            // Inside the body a `layerBlur` draws, over the canvas drawing, under any subview.
            drawing.superview?.insertSubview(view, aboveSubview: drawing)
            applyLayoutDirection()
            giveProps()
        }

        /// The direction the flow lays the component out in (views protocol, "Layout
        /// direction"); left to right without the key.
        private var layoutDirection: UIUserInterfaceLayoutDirection {
            return props["layoutDirection"]?.string == "rtl" ? .rightToLeft : .leftToRight
        }

        /// Sets the component's views to the flow's direction: its view's semantic content,
        /// and on iOS 17 the trait every view under it reads.
        private func applyLayoutDirection() {
            guard let view = component?.view else {
                return
            }
            let direction = layoutDirection
            view.semanticContentAttribute =
                direction == .rightToLeft ? .forceRightToLeft : .forceLeftToRight
            if #available(iOS 17.0, *) {
                traitOverrides.layoutDirection = direction == .rightToLeft ? .rightToLeft : .leftToRight
                // UIKit hands a changed trait to the views under this one lazily; the component
                // is told of the change right after this and must read its views' new direction.
                updateTraitsIfNeeded()
            }
        }

        /// Gives the component `componentProps` without `$context`, `$state` and
        /// `$disabled`, which reach it through its context, when they changed, then measures
        /// it again.
        private func giveProps() {
            guard let component, let context else {
                return
            }
            var entries = props["componentProps"]?.object ?? [:]
            entries["$context"] = nil
            let state = entries.removeValue(forKey: "$state").flatMap(
                VoidhashNativeComponentValue.init)
            let disabled = entries.removeValue(forKey: "$disabled")?.bool ?? false
            let values = entries.compactMapValues(VoidhashNativeComponentValue.init)
            environmentChanged()
            guard values != givenProps || state != givenState || disabled != givenDisabled
            else {
                return
            }
            givenProps = values
            givenState = state
            givenDisabled = disabled
            context.state = state
            context.isDisabled = disabled
            component.update(props: values)
            // The update may have changed what the view shows.
            measureComponent(contentChanged: true)
        }

        // MARK: - The component's size

        private static let noPreference = CGSize(width: CGFloat.nan, height: .nan)

        /// The width the flow laid the component out at; `nil` before it has one, when the
        /// view is measured at no limit.
        private var layoutWidth: CGFloat? {
            return nodeFrame.width > 0 ? nodeFrame.width : nil
        }

        /// The component's content changed (props, or the component said so).
        func invalidateSize() {
            measureComponent(contentChanged: true)
        }

        /// Measures the component's view at the laid-out width and reports the size when it
        /// changed (views protocol, "Reporting a size").
        ///
        /// A report changes the layout, which may change the width the view is laid out at,
        /// which measures it again: the height is measured at the width and never feeds back
        /// into it. A width alone (`contentChanged` false) measures only at a width the
        /// current content was not measured at yet, and at most a few, so a view whose width
        /// follows its own report settles instead of alternating between two.
        private func measureComponent(contentChanged: Bool) {
            guard let view = component?.view else {
                return
            }
            let width = layoutWidth
            if contentChanged {
                measuredWidths = []
            } else if measuredWidths.contains(width) || measuredWidths.count >= 4 {
                return
            }
            measuredWidths.append(width)
            let size = Self.preferredSize(of: view, width: width)
            guard !Self.sameSize(size, reportedSize) else {
                return
            }
            reportedSize = size
            host?.componentSize(id, size)
        }

        /// The size `view` wants at `width` (no limit for `nil`), `NaN` on an axis it has no
        /// preference for. See ``VoidhashNativeComponentView`` for which measure applies.
        static func preferredSize(of view: UIView, width: CGFloat?) -> CGSize {
            let size: CGSize
            if !view.constraints.isEmpty {
                size = view.systemLayoutSizeFitting(
                    CGSize(
                        width: width ?? UIView.layoutFittingCompressedSize.width,
                        height: UIView.layoutFittingCompressedSize.height),
                    withHorizontalFittingPriority: width == nil ? .fittingSizeLevel : .required,
                    verticalFittingPriority: .fittingSizeLevel)
            } else if overridesSizeThatFits(view) {
                size = view.sizeThatFits(
                    CGSize(
                        width: width ?? .greatestFiniteMagnitude,
                        height: .greatestFiniteMagnitude))
            } else {
                // `UIView.sizeThatFits` answers the view's current size, which the flow gave
                // it: no preference of its own.
                size = view.intrinsicContentSize
            }
            func axis(_ length: CGFloat) -> CGFloat {
                // `noIntrinsicMetric` is negative; a huge length is "no limit" echoed back.
                return length.isFinite && length >= 0 && length < 1e7 ? length : .nan
            }
            return CGSize(width: axis(size.width), height: axis(size.height))
        }

        /// Whether `view`'s class measures itself in `sizeThatFits(_:)` rather than answering
        /// its bounds, as `UIView`'s own does.
        private static func overridesSizeThatFits(_ view: UIView) -> Bool {
            let selector = #selector(UIView.sizeThatFits(_:))
            return class_getMethodImplementation(type(of: view), selector)
                != class_getMethodImplementation(UIView.self, selector)
        }

        /// Equal sizes, `NaN` equal to `NaN`.
        private static func sameSize(_ a: CGSize, _ b: CGSize) -> Bool {
            func same(_ x: CGFloat, _ y: CGFloat) -> Bool {
                return x == y || (x.isNaN && y.isNaN)
            }
            return same(a.width, b.width) && same(a.height, b.height)
        }

        /// The flow's `$context`, and the direction the flow lays the component out in.
        private var environment: VoidhashNativeComponentEnvironment {
            let flow = props["componentProps"]?["$context"]
            let colorScheme: UIUserInterfaceStyle
            switch flow?["colorScheme"]?.string {
            case "dark": colorScheme = .dark
            case "light": colorScheme = .light
            default: colorScheme = traitCollection.userInterfaceStyle == .dark ? .dark : .light
            }
            return VoidhashNativeComponentEnvironment(
                locale: flow?["locale"]?.string.map(Locale.init(identifier:)) ?? .current,
                reducesMotion: flow?["reducedMotion"]?.bool
                    ?? UIAccessibility.isReduceMotionEnabled,
                colorScheme: colorScheme,
                layoutDirection: layoutDirection)
        }

        private func environmentChanged() {
            guard let component, let context else {
                return
            }
            let environment = environment
            guard environment != context.environment else {
                return
            }
            context.environment = environment
            component.environmentDidChange(environment)
        }

        @available(iOS, deprecated: 17.0, message: "Trait changes are registered for on iOS 17")
        override func traitCollectionDidChange(_ previous: UITraitCollection?) {
            super.traitCollectionDidChange(previous)
            environmentChanged()
        }

        /// Delivers an event of the component, unless it was disposed meanwhile.
        func emit(_ name: String, payload: String) {
            guard component != nil else {
                return
            }
            host?.componentEvent(id, name: name, payload: payload)
        }

        /// Writes a prop of the component, unless it was disposed meanwhile.
        func write(_ key: String, json: String) {
            guard component != nil else {
                return
            }
            host?.writeComponentProp(id, name: key, json: json)
        }

        private func disposeComponent() {
            guard let component else {
                return
            }
            self.component = nil
            context?.container = nil
            context = nil
            givenProps = nil
            givenState = nil
            givenDisabled = false
            reportedSize = Self.noPreference
            measuredWidths = []
            component.dispose()
            component.view.removeFromSuperview()
        }

        override func released() {
            disposeComponent()
        }

        override var showsNativeComponent: Bool {
            return component != nil || super.showsNativeComponent
        }

        // MARK: - Touches and accessibility

        /// The component's views take their touches directly; where they take none, the
        /// touch goes on to the views behind, as the external view has no press of its own.
        override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
            let hit = super.hitTest(point, with: event)
            return hit === self && component != nil ? nil : hit
        }

        override func hitTestChildren(_ point: CGPoint, with event: UIEvent?) -> UIView? {
            if let hit = super.hitTestChildren(point, with: event) {
                return hit
            }
            guard let view = component?.view, view.superview != nil else {
                return nil
            }
            return view.hitTest(view.convert(point, from: self), with: event)
        }

        /// The component's own views are the accessibility elements, whatever the flow says
        /// of the external view; hiding it (`hidden`, `accessibilityElementsHidden`) hides them.
        override var accessibleElement: Bool {
            return component == nil && super.accessibleElement
        }
    }
#endif
