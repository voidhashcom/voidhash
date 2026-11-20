#if os(iOS)
    import QuartzCore
    import UIKit

    /// Draws with Core Graphics above a node's decoration, which a view's own `draw(_:)`
    /// would paint under.
    final class DrawingView: UIView {
        var drawer: ((CGContext) -> Void)?

        override init(frame: CGRect) {
            super.init(frame: frame)
            contentMode = .redraw
            isOpaque = false
            isUserInteractionEnabled = false
        }

        @available(*, unavailable)
        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        override func draw(_ rect: CGRect) {
            guard let context = UIGraphicsGetCurrentContext() else {
                return
            }
            drawer?(context)
        }
    }

    /// A `text` view: draws its paragraph with the same layout the core measured.
    final class TextNodeView: NodeView {
        /// The children of a text view are not shown.
        private let hiddenChildren = UIView()
        private let drawing = DrawingView()

        required init(id: Int32, kind: NodeKind, host: NodeHost?) {
            super.init(id: id, kind: kind, host: host)
            hiddenChildren.isHidden = true
            addSubview(drawing)
            addSubview(hiddenChildren)
            drawing.drawer = { [weak self] context in self?.drawText(in: context) }
        }

        override var contentHost: UIView {
            return hiddenChildren
        }

        override func hitTestChildren(_ point: CGPoint, with event: UIEvent?) -> UIView? {
            return nil
        }

        override var ownText: String? {
            return props["text"]?.string
        }

        override func refreshContent(_ change: Change) {
            guard change.touches(Self.textKeys) else {
                return
            }
            drawing.frame = CGRect(origin: .zero, size: nodeFrame.size)
            drawing.setNeedsDisplay()
            linkElements = nil
        }

        /// The props the paragraph is laid out and drawn from.
        private static let textKeys: Set<String> = [
            "text", "fontFamily", "fontSize", "fontWeight", "italic", "lineHeight",
            "letterSpacing", "textAlign", "color", "numberOfLines", "decoration", "textStroke",
            "textShadow", "textInsets", "textRuns",
        ]

        /// The `textRuns` prop: each run's style, and its press handler.
        private var runs: [(run: TextRun, onPress: UInt32?)] {
            return (props["textRuns"]?.array ?? []).compactMap { value in
                guard let start = value["start"]?.number, let end = value["end"]?.number,
                    start >= 0, end >= start, end <= Double(Int32.max)
                else {
                    return nil
                }
                let run = TextRun(
                    start: Int(start), end: Int(end),
                    weight: value["fontWeight"]?.number.map { UInt16(min(max($0, 1), 1000)) },
                    italic: value["italic"]?.bool,
                    color: value["color"]?.number.map { UInt32(clamping: Int($0)) },
                    underline: value["underline"]?.bool == true,
                    lineThrough: value["lineThrough"]?.bool == true)
                let press = value["onPress"]?.number.flatMap { handler in
                    handler >= 0 && handler <= Double(UInt32.max) ? UInt32(handler) : nil
                }
                return (run, press)
            }
        }

        /// The runs a tap or assistive technology presses.
        private var pressableRuns: [(range: Range<Int>, handler: UInt32)] {
            return runs.compactMap { entry in
                entry.onPress.map { (entry.run.start..<entry.run.end, $0) }
            }
        }

        override var takesPresses: Bool {
            return super.takesPresses || !pressableRuns.isEmpty
        }

        /// A tap on a run with its own handler presses that; any other tap is the view's.
        override func pressHandler(at location: CGPoint) -> UInt32? {
            let runs = pressableRuns
            let box = textBox
            if !runs.isEmpty, let layout = drawnLayout,
                let offset = layout.characterIndex(
                    at: CGPoint(x: location.x - box.minX, y: location.y - box.minY),
                    boxWidth: box.width),
                let run = runs.first(where: { $0.range.contains(offset) })
            {
                return run.handler
            }
            return super.pressHandler(at: location)
        }

        // MARK: Accessibility

        /// The elements assistive technology sees while runs take presses, in reading order:
        /// each pressable run is a link of its own, and the text between them stays the view's,
        /// as parts that read and activate as the view (an author's label reads as one part,
        /// before the links). Built when first asked for after the text changed, so VoiceOver
        /// keeps its focus between batches.
        private var linkElements: [UIAccessibilityElement]?

        override var isAccessibilityElement: Bool {
            get { pressableRuns.isEmpty && accessibleElement }
            set {}
        }

        override var accessibilityElements: [Any]? {
            get {
                guard !pressableRuns.isEmpty else {
                    return nil
                }
                if let linkElements {
                    return linkElements
                }
                let elements = makeAccessibilityElements()
                linkElements = elements
                return elements
            }
            set {}
        }

        private func makeAccessibilityElements() -> [UIAccessibilityElement] {
            let text = (props["text"]?.string ?? "") as NSString
            let layout = drawnLayout
            let box = textBox
            /// The glyph boxes of `range`, in the view's coordinates.
            let rects = { (range: Range<Int>) -> [CGRect] in
                (layout?.rects(for: range, boxWidth: box.width) ?? []).map {
                    $0.offsetBy(dx: box.minX, dy: box.minY)
                }
            }
            var elements: [UIAccessibilityElement] = []
            let readsText = accessibleElement && props["accessibilityLabel"]?.string == nil
            /// The view's own text from `start` to `end`, as a part of the view.
            let addPart = { (start: Int, end: Int) in
                let content = text.substring(with: NSRange(location: start, length: end - start))
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                guard !content.isEmpty else {
                    return
                }
                let part = TextParagraphElement(accessibilityContainer: self)
                part.view = self
                part.label = content
                part.isFirstPart = !elements.contains { $0 is TextParagraphElement }
                part.place(rects(start..<end), in: self)
                elements.append(part)
            }
            if accessibleElement, !readsText {
                let paragraph = TextParagraphElement(accessibilityContainer: self)
                paragraph.view = self
                paragraph.label = spokenText
                paragraph.isFirstPart = true
                paragraph.place([bounds], in: self)
                elements.append(paragraph)
            }
            var cursor = 0
            for run in pressableRuns.sorted(by: { $0.range.lowerBound < $1.range.lowerBound }) {
                let start = min(max(run.range.lowerBound, cursor), text.length)
                let end = min(run.range.upperBound, text.length)
                guard end > start else {
                    continue
                }
                let boxes = rects(start..<end)
                guard !boxes.isEmpty else {
                    continue
                }
                if readsText, start > cursor {
                    addPart(cursor, start)
                }
                let link = TextLinkElement(accessibilityContainer: self)
                link.view = self
                link.handler = run.handler
                link.accessibilityLabel = text.substring(
                    with: NSRange(location: start, length: end - start))
                link.accessibilityTraits = .link
                link.place(boxes, in: self)
                elements.append(link)
                cursor = end
            }
            if readsText, cursor < text.length {
                addPart(cursor, text.length)
            }
            return elements
        }

        /// Presses `handler` for assistive technology.
        fileprivate func pressRun(_ handler: UInt32) {
            host?.press(handler)
        }

        /// The paragraph's style as layout measured it.
        var textStyle: TextStyle {
            var style = TextStyle()
            style.family = props["fontFamily"]?.string ?? ""
            style.size = Float(props["fontSize"]?.number ?? 14)
            style.weight = UInt16(min(max(props["fontWeight"]?.number ?? 400, 1), 1000))
            style.italic = props["italic"]?.bool == true
            style.lineHeight = Float(props["lineHeight"]?.number ?? Double(style.size) * 1.2)
            style.letterSpacing = Float(props["letterSpacing"]?.number ?? 0)
            switch props["textAlign"]?.string {
            case "right": style.alignment = .right
            case "center": style.alignment = .center
            case "justify": style.alignment = .justify
            default: style.alignment = .left
            }
            if let lines = props["numberOfLines"]?.number, lines >= 1 {
                style.maxLines = UInt32(min(lines, Double(UInt32.max)))
            }
            style.runs = runs.map(\.run)
            return style
        }

        /// Where the text box sits in the bounds.
        var textBox: CGRect {
            let insets = props["textInsets"]?.numbers ?? []
            guard insets.count == 4 else {
                return bounds
            }
            return bounds.inset(
                by: UIEdgeInsets(top: insets[0], left: insets[3], bottom: insets[2], right: insets[1]))
        }

        private var paint: TextPaint {
            var paint = TextPaint()
            paint.color = DrawList.color(UInt32(clamping: Int(props["color"]?.number ?? 0xFF)))
            if let decoration = props["decoration"],
                decoration["underline"]?.bool == true || decoration["lineThrough"]?.bool == true
            {
                paint.decoration = TextPaint.Decoration(
                    underline: decoration["underline"]?.bool == true,
                    lineThrough: decoration["lineThrough"]?.bool == true,
                    color: decoration["color"]?.number.map { DrawList.color(UInt32(clamping: Int($0))) }
                        ?? paint.color,
                    style: decoration["style"]?.string.flatMap(TextPaint.Decoration.Style.init)
                        ?? .solid)
            }
            if let stroke = props["textStroke"], let width = stroke["width"]?.number, width > 0 {
                paint.stroke = TextPaint.Stroke(
                    width: CGFloat(width),
                    color: DrawList.color(UInt32(clamping: Int(stroke["color"]?.number ?? 0xFF))))
            }
            if let shadow = props["textShadow"], let color = shadow["color"]?.number {
                paint.shadow = TextPaint.Shadow(
                    color: DrawList.color(UInt32(clamping: Int(color))),
                    offset: CGSize(width: shadow["x"]?.number ?? 0, height: shadow["y"]?.number ?? 0),
                    blur: CGFloat(shadow["blur"]?.number ?? 0))
            }
            return paint
        }

        /// The layout the view draws: the one the core measured its text box from.
        var drawnLayout: TextLayout? {
            guard let host, let text = props["text"]?.string else {
                return nil
            }
            return host.textSystem.drawnLayout(
                text, style: textStyle, box: textBox.size, scale: host.displayScale)
        }

        private func drawText(in context: CGContext) {
            guard let layout = drawnLayout else {
                return
            }
            layout.draw(
                in: context, box: textBox, scale: host?.displayScale ?? 1, paint: paint)
        }
    }

    /// An `image` view: the loaded image in its resize mode, optionally tinted, clipped to the
    /// view's corners.
    final class ImageNodeView: NodeView {
        private let imageView = UIImageView()

        required init(id: Int32, kind: NodeKind, host: NodeHost?) {
            super.init(id: id, kind: kind, host: host)
            imageView.clipsToBounds = true
            imageView.isUserInteractionEnabled = false
            addSubview(imageView)
        }

        /// The image shown, `nil` while it loads.
        var shownImage: UIImage? {
            return imageView.image
        }

        override func refreshContent(_ change: Change) {
            guard change.touches(["source", "resizeMode", "tintColor", "cornerRadii"]) else {
                return
            }
            imageView.frame = CGRect(origin: .zero, size: nodeFrame.size)
            switch props["resizeMode"]?.string {
            case "cover": imageView.contentMode = .scaleAspectFill
            case "contain": imageView.contentMode = .scaleAspectFit
            case "center": imageView.contentMode = .center
            default: imageView.contentMode = .scaleToFill
            }
            NodeView.clip(imageView.layer, to: shape)
            showImage()
        }

        override func imageLoaded(_ url: String) {
            if props["source"]?.string == url {
                showImage()
            }
        }

        private func showImage() {
            guard let url = props["source"]?.string, let image = host?.image(for: url) else {
                imageView.image = nil
                return
            }
            if let tint = props["tintColor"]?.number {
                imageView.image = image.withRenderingMode(.alwaysTemplate)
                imageView.tintColor = UIColor(cgColor: DrawList.color(UInt32(clamping: Int(tint))))
            } else {
                imageView.image = image
            }
        }
    }

    /// A `path` view: SVG path data stretched from its view box to the frame, filled or
    /// stroked, with its stroke's caps and joins, and trimmed to part of its outline.
    ///
    /// Style transitions change the colour, width and trim on every frame, so the geometry is
    /// parsed and measured once per path, view box and size, and a trim only cuts the measured
    /// outline.
    final class PathNodeView: NodeView {
        private let shapeLayer = CAShapeLayer()
        private var parsed: (data: String, path: CGPath)?
        /// The path stretched to the frame, measured for trimming when first trimmed.
        private var outline: PathOutline?

        required init(id: Int32, kind: NodeKind, host: NodeHost?) {
            super.init(id: id, kind: kind, host: host)
            layer.addSublayer(shapeLayer)
        }

        /// The path the view draws, in its own coordinates.
        var shownPath: CGPath? {
            return shapeLayer.path
        }

        override func refreshContent(_ change: Change) {
            if change.touches(["path", "viewBox"]) || outline == nil {
                let data = props["path"]?.string ?? ""
                let path: CGPath
                if let parsed, parsed.data == data {
                    path = parsed.path
                } else {
                    path = SVGPath.parse(data)
                    parsed = (data, path)
                }
                let size = nodeFrame.size
                let viewBox = props["viewBox"]?.numbers ?? []
                let scaleX = viewBox.count == 2 && viewBox[0] > 0 ? size.width / viewBox[0] : 1
                let scaleY = viewBox.count == 2 && viewBox[1] > 0 ? size.height / viewBox[1] : 1
                var scale = CGAffineTransform(scaleX: scaleX, y: scaleY)
                shapeLayer.frame = CGRect(origin: .zero, size: size)
                outline = PathOutline(path.copy(using: &scale) ?? path)
            }
            if change.touches(["path", "viewBox", "pathTrimStart", "pathTrimEnd"]), let outline {
                let start = props["pathTrimStart"]?.number
                let end = props["pathTrimEnd"]?.number
                if start != nil || end != nil {
                    shapeLayer.path = outline.trimmed(
                        from: CGFloat(min(max(start ?? 0, 0), 1)),
                        to: CGFloat(min(max(end ?? 1, 0), 1)))
                } else {
                    shapeLayer.path = outline.path
                }
            }
            let color = DrawList.color(UInt32(clamping: Int(props["pathColor"]?.number ?? 0xFF)))
            if props["pathStyle"]?.string == "stroke" {
                shapeLayer.fillColor = nil
                shapeLayer.strokeColor = color
                shapeLayer.lineWidth = CGFloat(props["pathStrokeWidth"]?.number ?? 1)
                switch props["pathStrokeCap"]?.string {
                case "round": shapeLayer.lineCap = .round
                case "square": shapeLayer.lineCap = .square
                default: shapeLayer.lineCap = .butt
                }
                switch props["pathStrokeJoin"]?.string {
                case "round": shapeLayer.lineJoin = .round
                case "bevel": shapeLayer.lineJoin = .bevel
                default: shapeLayer.lineJoin = .miter
                }
            } else {
                shapeLayer.fillColor = color
                shapeLayer.strokeColor = nil
            }
        }
    }

    /// A `scrollView`: UIKit scrolls the subviews, which are placed in content coordinates.
    final class ScrollNodeView: NodeView {
        let scrollView = UIScrollView()

        required init(id: Int32, kind: NodeKind, host: NodeHost?) {
            super.init(id: id, kind: kind, host: host)
            scrollView.contentInsetAdjustmentBehavior = .never
            scrollView.clipsToBounds = true
            addSubview(scrollView)
        }

        override var contentHost: UIView {
            return scrollView
        }

        override var clipsWithContainer: Bool {
            return false
        }

        override func refreshContent(_ change: Change) {
            let size = nodeFrame.size
            scrollView.frame = CGRect(origin: .zero, size: size)
            NodeView.clip(scrollView.layer, to: shape)
            let content = props["contentSize"]?.numbers ?? []
            let width = content.count == 2 ? CGFloat(content[0]) : 0
            let height = content.count == 2 ? CGFloat(content[1]) : 0
            let horizontal = props["scrollDirection"]?.string == "horizontal"
            // Only the scroll direction scrolls.
            scrollView.contentSize =
                horizontal ? CGSize(width: width, height: size.height) : CGSize(width: size.width, height: height)
            scrollView.alwaysBounceVertical = !horizontal
            scrollView.alwaysBounceHorizontal = horizontal
            let indicator = props["showsIndicator"]?.bool ?? true
            scrollView.showsVerticalScrollIndicator = !horizontal && indicator
            scrollView.showsHorizontalScrollIndicator = horizontal && indicator
        }

        override func hitTestChildren(_ point: CGPoint, with event: UIEvent?) -> UIView? {
            let local = scrollView.convert(point, from: self)
            guard scrollView.point(inside: local, with: event) else {
                return nil
            }
            for child in childNodes.reversed() where child.superview != nil {
                if let hit = child.hitTest(child.convert(point, from: self), with: event) {
                    return hit
                }
            }
            // Touches between the subviews still scroll.
            return scrollView
        }
    }

    /// Part of a text view's own text, beside its links: it reads its stretch of the text
    /// (or the view's label), and activates as the view would. The first part also carries the
    /// view's hint and value, so they are read once.
    final class TextParagraphElement: TextPartElement {
        weak var view: TextNodeView?
        var label: String?
        var isFirstPart = false

        override var accessibilityLabel: String? {
            get { label }
            set {}
        }

        override var accessibilityHint: String? {
            get { isFirstPart ? view?.props["accessibilityHint"]?.string : nil }
            set {}
        }

        override var accessibilityValue: String? {
            get {
                guard isFirstPart else {
                    return nil
                }
                return NodeView.value(
                    view?.props["accessibilityValue"], state: view?.props["accessibilityState"])
            }
            set {}
        }

        override var accessibilityTraits: UIAccessibilityTraits {
            get {
                NodeView.traits(
                    role: view?.props["accessibilityRole"]?.string,
                    state: view?.props["accessibilityState"])
            }
            set {}
        }

        override func accessibilityActivate() -> Bool {
            return view?.accessibilityActivate() ?? false
        }
    }

    /// A text run with its own press handler, as a link.
    final class TextLinkElement: TextPartElement {
        weak var view: TextNodeView?
        var handler: UInt32 = 0

        override func accessibilityActivate() -> Bool {
            guard let view else {
                return false
            }
            view.pressRun(handler)
            return true
        }
    }

    /// An element framed by the glyph boxes of a stretch of text, several when it wraps.
    class TextPartElement: UIAccessibilityElement {
        /// The boxes in the container view's coordinates, one per line the stretch reaches.
        private(set) var rects: [CGRect] = []
        private weak var container: UIView?

        func place(_ rects: [CGRect], in container: UIView) {
            self.rects = rects
            self.container = container
            accessibilityFrameInContainerSpace = rects.dropFirst().reduce(rects.first ?? .zero) {
                $0.union($1)
            }
        }

        override var accessibilityPath: UIBezierPath? {
            get {
                guard let container, rects.count > 1 else {
                    return nil
                }
                let path = UIBezierPath()
                for rect in rects {
                    path.append(UIBezierPath(rect: rect))
                }
                return UIAccessibility.convertToScreenCoordinates(path, in: container)
            }
            set {}
        }
    }
#endif
