#if os(iOS)
    import QuartzCore
    import UIKit

    /// Paints what every view kind shares below its subviews: drop shadows, background colour
    /// and gradient, inset shadows, borders and outline (views protocol, "Every view").
    ///
    /// Common boxes use the view layer's own background and corner radius, which Core Animation
    /// draws without offscreen passes; everything else goes in shape and gradient layers below
    /// the subviews. Borders are always shape layers: the layer's own border would paint over
    /// subviews that overlap it.
    @MainActor
    final class BoxDecoration {
        private unowned var layer: CALayer
        /// Holds every extra layer, always the view layer's first sublayer, so subviews paint
        /// over it.
        private let container = CALayer()
        private var dropShadows: [CALayer] = []
        private var background: CAShapeLayer?
        private var gradient: CAGradientLayer?
        private var insetShadows: [CALayer] = []
        private var borders: [CALayer] = []
        private var outline: CAShapeLayer?

        /// The border box with its corners, as last laid out.
        private(set) var shape = RoundedRect(rect: .zero, radii: [])

        init(layer: CALayer) {
            self.layer = layer
            container.name = "decoration"
            layer.insertSublayer(container, at: 0)
        }

        /// Paints on `target` from now on, leaving the current layer bare; the next
        /// ``update(props:size:)`` repaints.
        func move(to target: CALayer) {
            layer.backgroundColor = nil
            layer.cornerRadius = 0
            target.insertSublayer(container, at: 0)
            layer = target
        }

        func update(props: [String: PropValue], size: CGSize) {
            let bounds = CGRect(origin: .zero, size: size)
            let radii = (props["cornerRadii"]?.numbers ?? []).map { CGFloat($0) }
            shape = RoundedRect(rect: bounds, radii: radii)
            let uniform = shape.uniformRadius
            container.frame = bounds

            layer.cornerRadius = uniform ?? 0
            if #available(iOS 13.0, *) {
                layer.cornerCurve = .circular
            }
            updateDropShadows(props["shadows"]?.array ?? [], uniform: uniform)
            updateBackground(props["backgroundColor"]?.number, uniform: uniform)
            updateGradient(props["backgroundGradient"], uniform: uniform)
            updateInsetShadows(props["shadows"]?.array ?? [])
            updateBorders(props)
            updateOutline(props["outline"])
        }

        // MARK: - Shadows

        private func updateDropShadows(_ shadows: [PropValue], uniform: CGFloat?) {
            let drops = shadows.filter { $0["inset"]?.bool != true }
            dropShadows = reuse(dropShadows, count: drops.count, below: 0) { CALayer() }
            for (layer, shadow) in zip(dropShadows, drops) {
                let spread = CGFloat(shadow["spread"]?.number ?? 0)
                let blur = max(0, CGFloat(shadow["blur"]?.number ?? 0))
                let offset = CGSize(
                    width: shadow["x"]?.number ?? 0, height: shadow["y"]?.number ?? 0)
                let cast = shape.outset(by: spread)
                layer.frame = container.bounds
                layer.shadowPath = cast.path
                layer.shadowColor = DrawList.color(UInt32(clamping: Int(shadow["color"]?.number ?? 0)))
                layer.shadowOpacity = 1
                // Core Animation's shadow radius spreads like half a CSS blur radius.
                layer.shadowRadius = blur / 2
                layer.shadowOffset = offset
                // A box shadow is never drawn below the box itself.
                let reach = blur * 2 + abs(spread) + abs(offset.width) + abs(offset.height) + 4
                let hole = CGMutablePath()
                hole.addRect(container.bounds.insetBy(dx: -reach, dy: -reach))
                shape.add(to: hole)
                let mask = (layer.mask as? CAShapeLayer) ?? CAShapeLayer()
                mask.fillRule = .evenOdd
                mask.path = hole
                layer.mask = mask
            }
        }

        private func updateInsetShadows(_ shadows: [PropValue]) {
            let insets = shadows.filter { $0["inset"]?.bool == true }
            let index = dropShadows.count + (background == nil ? 0 : 1) + (gradient == nil ? 0 : 1)
            insetShadows = reuse(insetShadows, count: insets.count, below: index) {
                let clip = CALayer()
                let ring = CAShapeLayer()
                ring.fillRule = .evenOdd
                clip.addSublayer(ring)
                return clip
            }
            for (clip, shadow) in zip(insetShadows, insets) {
                guard let ring = clip.sublayers?.first as? CAShapeLayer else {
                    continue
                }
                let spread = CGFloat(shadow["spread"]?.number ?? 0)
                let blur = max(0, CGFloat(shadow["blur"]?.number ?? 0))
                let offset = CGSize(
                    width: shadow["x"]?.number ?? 0, height: shadow["y"]?.number ?? 0)
                let color = DrawList.color(UInt32(clamping: Int(shadow["color"]?.number ?? 0)))
                clip.frame = container.bounds
                let mask = (clip.mask as? CAShapeLayer) ?? CAShapeLayer()
                mask.path = shape.path
                clip.mask = mask
                // A ring around the box shrunk by the spread and moved by the offset; its
                // blurred shadow is what falls inside the box.
                var hole = shape.outset(by: -spread)
                hole.rect = hole.rect.offsetBy(dx: offset.width, dy: offset.height)
                let reach = blur * 2 + abs(spread) + abs(offset.width) + abs(offset.height) + 4
                let path = CGMutablePath()
                path.addRect(container.bounds.insetBy(dx: -reach, dy: -reach))
                hole.add(to: path)
                ring.frame = container.bounds
                ring.path = path
                ring.fillColor = color
                ring.shadowColor = color
                ring.shadowOpacity = 1
                ring.shadowRadius = blur / 2
                ring.shadowOffset = .zero
            }
        }

        // MARK: - Background

        private func updateBackground(_ color: Double?, uniform: CGFloat?) {
            let fill = color.map { DrawList.color(UInt32(clamping: Int($0))) }
            if uniform != nil || fill == nil {
                // The view layer draws it, rounded by its corner radius.
                layer.backgroundColor = fill
                background?.removeFromSuperlayer()
                background = nil
                return
            }
            layer.backgroundColor = nil
            let shapeLayer = background ?? CAShapeLayer()
            if background == nil {
                container.insertSublayer(shapeLayer, at: UInt32(dropShadows.count))
                background = shapeLayer
            }
            shapeLayer.frame = container.bounds
            shapeLayer.path = shape.path
            shapeLayer.fillColor = fill
        }

        private func updateGradient(_ descriptor: PropValue?, uniform: CGFloat?) {
            guard let descriptor,
                let colors = descriptor["colors"]?.numbers, colors.count >= 2,
                let stops = descriptor["stops"]?.numbers, stops.count == colors.count
            else {
                gradient?.removeFromSuperlayer()
                gradient = nil
                return
            }
            let gradientLayer = gradient ?? CAGradientLayer()
            if gradient == nil {
                let index = dropShadows.count + (background == nil ? 0 : 1)
                container.insertSublayer(gradientLayer, at: UInt32(index))
                gradient = gradientLayer
            }
            let point = { (key: String, fallback: CGPoint) -> CGPoint in
                guard let values = descriptor[key]?.numbers, values.count == 2 else {
                    return fallback
                }
                return CGPoint(x: values[0], y: values[1])
            }
            gradientLayer.frame = container.bounds
            gradientLayer.colors = colors.map { DrawList.color(UInt32(clamping: Int($0))) }
            gradientLayer.locations = stops.map { NSNumber(value: $0) }
            let start = point("start", CGPoint(x: 0.5, y: 0))
            if descriptor["type"]?.string == "radial" {
                let radius = CGFloat(descriptor["radius"]?.number ?? 0.5)
                gradientLayer.type = .radial
                gradientLayer.startPoint = start
                gradientLayer.endPoint = CGPoint(x: start.x + radius, y: start.y + radius)
            } else {
                gradientLayer.type = .axial
                gradientLayer.startPoint = start
                gradientLayer.endPoint = point("end", CGPoint(x: 0.5, y: 1))
            }
            if let uniform {
                gradientLayer.cornerRadius = uniform
                gradientLayer.masksToBounds = uniform > 0
                gradientLayer.mask = nil
            } else {
                gradientLayer.cornerRadius = 0
                gradientLayer.masksToBounds = false
                let mask = (gradientLayer.mask as? CAShapeLayer) ?? CAShapeLayer()
                mask.path = shape.path
                gradientLayer.mask = mask
            }
        }

        // MARK: - Borders

        private func updateBorders(_ props: [String: PropValue]) {
            let widths = (props["borderWidths"]?.numbers ?? []).map { max(0, CGFloat($0)) }
            guard widths.count == 4, widths.contains(where: { $0 > 0 }) else {
                setBorderLayers([])
                return
            }
            let colorValues = props["borderColors"]?.numbers ?? []
            let colors = (0..<4).map { index -> CGColor in
                let value = index < colorValues.count ? colorValues[index] : 0x0000_00FF
                return DrawList.color(UInt32(clamping: Int(value)))
            }
            let style = props["borderStyle"]?.string
            let sameWidth = widths.allSatisfy { $0 == widths[0] }
            let sameColor = colors.allSatisfy { $0 == colors[0] }
            let inner = shape.inset(top: widths[0], right: widths[1], bottom: widths[2], left: widths[3])
            if let style, sameWidth, sameColor {
                // A dashed or dotted border, along the middle of its width.
                let stroke = CAShapeLayer()
                stroke.frame = container.bounds
                stroke.path = shape.outset(by: -widths[0] / 2).path
                stroke.fillColor = nil
                stroke.strokeColor = colors[0]
                stroke.lineWidth = widths[0]
                Self.dash(stroke, style: style, width: widths[0])
                setBorderLayers([stroke])
                return
            }
            let ring = CGMutablePath()
            shape.add(to: ring)
            inner.add(to: ring)
            if sameColor {
                let fill = CAShapeLayer()
                fill.frame = container.bounds
                fill.fillRule = .evenOdd
                fill.path = ring
                fill.fillColor = colors[0]
                setBorderLayers([fill])
                return
            }
            // Sides of different colours meet on the line from each outer corner to the
            // matching inner one, as in CSS.
            let outer = shape.rect
            let box = inner.rect
            let corners = (
                outerTL: CGPoint(x: outer.minX, y: outer.minY),
                outerTR: CGPoint(x: outer.maxX, y: outer.minY),
                outerBR: CGPoint(x: outer.maxX, y: outer.maxY),
                outerBL: CGPoint(x: outer.minX, y: outer.maxY),
                innerTL: CGPoint(x: box.minX, y: box.minY),
                innerTR: CGPoint(x: box.maxX, y: box.minY),
                innerBR: CGPoint(x: box.maxX, y: box.maxY),
                innerBL: CGPoint(x: box.minX, y: box.maxY))
            let sides: [[CGPoint]] = [
                [corners.outerTL, corners.outerTR, corners.innerTR, corners.innerTL],
                [corners.outerTR, corners.outerBR, corners.innerBR, corners.innerTR],
                [corners.outerBR, corners.outerBL, corners.innerBL, corners.innerBR],
                [corners.outerBL, corners.outerTL, corners.innerTL, corners.innerBL],
            ]
            var layers: [CALayer] = []
            for (index, polygon) in sides.enumerated() where widths[index] > 0 {
                let side = CAShapeLayer()
                side.frame = container.bounds
                side.fillRule = .evenOdd
                side.path = ring
                side.fillColor = colors[index]
                let mask = CAShapeLayer()
                let wedge = CGMutablePath()
                wedge.addLines(between: polygon)
                wedge.closeSubpath()
                mask.path = wedge
                side.mask = mask
                layers.append(side)
            }
            setBorderLayers(layers)
        }

        private func setBorderLayers(_ layers: [CALayer]) {
            for old in borders {
                old.removeFromSuperlayer()
            }
            borders = layers
            let index =
                dropShadows.count + (background == nil ? 0 : 1) + (gradient == nil ? 0 : 1)
                + insetShadows.count
            for (offset, layer) in layers.enumerated() {
                container.insertSublayer(layer, at: UInt32(index + offset))
            }
        }

        private func updateOutline(_ outline: PropValue?) {
            guard let outline, let width = outline["width"]?.number, width > 0 else {
                self.outline?.removeFromSuperlayer()
                self.outline = nil
                return
            }
            let stroke = self.outline ?? CAShapeLayer()
            if self.outline == nil {
                container.addSublayer(stroke)
                self.outline = stroke
            }
            let offset = CGFloat(outline["offset"]?.number ?? 0)
            stroke.frame = container.bounds
            stroke.path = shape.outset(by: offset + CGFloat(width) / 2).path
            stroke.fillColor = nil
            stroke.strokeColor = DrawList.color(UInt32(clamping: Int(outline["color"]?.number ?? 0xFF)))
            stroke.lineWidth = CGFloat(width)
            Self.dash(stroke, style: outline["style"]?.string, width: CGFloat(width))
        }

        private static func dash(_ stroke: CAShapeLayer, style: String?, width: CGFloat) {
            switch style {
            case "dashed":
                stroke.lineDashPattern = [NSNumber(value: Double(width * 3)), NSNumber(value: Double(width * 3))]
                stroke.lineCap = .butt
            case "dotted":
                stroke.lineDashPattern = [0, NSNumber(value: Double(width * 2))]
                stroke.lineCap = .round
            default:
                stroke.lineDashPattern = nil
                stroke.lineCap = .butt
            }
        }

        /// Keeps `count` layers of `existing`, adding new ones at `index` of the container and
        /// removing the rest.
        private func reuse(
            _ existing: [CALayer], count: Int, below index: Int, make: () -> CALayer
        ) -> [CALayer] {
            var layers = Array(existing.prefix(count))
            for extra in existing.dropFirst(count) {
                extra.removeFromSuperlayer()
            }
            while layers.count < count {
                let layer = make()
                container.insertSublayer(layer, at: UInt32(index + layers.count))
                layers.append(layer)
            }
            return layers
        }
    }
#endif
