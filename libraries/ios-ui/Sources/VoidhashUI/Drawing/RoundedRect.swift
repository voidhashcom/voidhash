import CoreGraphics

/// A rectangle with its own radii at each corner, elliptical where a border's widths differ
/// on the two sides of a corner: the shape of a view's border box, padding box and shadows.
package struct RoundedRect: Equatable {
    package var rect: CGRect
    package var topLeft: CGSize
    package var topRight: CGSize
    package var bottomRight: CGSize
    package var bottomLeft: CGSize

    /// `radii` as the `cornerRadii` prop lists them: top-left, top-right, bottom-right,
    /// bottom-left.
    package init(rect: CGRect, radii: [CGFloat]) {
        let radius = { (index: Int) -> CGSize in
            let value = index < radii.count ? max(0, radii[index]) : 0
            return CGSize(width: value, height: value)
        }
        self.init(
            rect: rect, topLeft: radius(0), topRight: radius(1), bottomRight: radius(2),
            bottomLeft: radius(3))
    }

    package init(
        rect: CGRect, topLeft: CGSize, topRight: CGSize, bottomRight: CGSize, bottomLeft: CGSize
    ) {
        self.rect = rect
        self.topLeft = topLeft
        self.topRight = topRight
        self.bottomRight = bottomRight
        self.bottomLeft = bottomLeft
    }

    /// Every corner square.
    package var isRectangle: Bool {
        return [topLeft, topRight, bottomRight, bottomLeft].allSatisfy {
            $0.width <= 0 || $0.height <= 0
        }
    }

    /// The one circular radius of every corner, when they share one.
    package var uniformRadius: CGFloat? {
        let corners = [topLeft, topRight, bottomRight, bottomLeft]
        guard corners.allSatisfy({ $0 == topLeft }), topLeft.width == topLeft.height else {
            return nil
        }
        return topLeft.width
    }

    /// The shape grown by `amount` on every side (shrunk for a negative amount); rounded
    /// corners keep following the outline, square ones stay square.
    package func outset(by amount: CGFloat) -> RoundedRect {
        let grow = { (corner: CGSize) -> CGSize in
            guard corner.width > 0, corner.height > 0 else {
                return .zero
            }
            return CGSize(width: max(0, corner.width + amount), height: max(0, corner.height + amount))
        }
        return RoundedRect(
            rect: rect.insetBy(dx: -amount, dy: -amount), topLeft: grow(topLeft),
            topRight: grow(topRight), bottomRight: grow(bottomRight), bottomLeft: grow(bottomLeft))
    }

    /// The inner edge of a border of `widths` (top, right, bottom, left): each corner's radius
    /// shrinks by the widths on its two sides.
    package func inset(top: CGFloat, right: CGFloat, bottom: CGFloat, left: CGFloat) -> RoundedRect {
        let shrink = { (corner: CGSize, horizontal: CGFloat, vertical: CGFloat) in
            CGSize(width: max(0, corner.width - horizontal), height: max(0, corner.height - vertical))
        }
        let inner = CGRect(
            x: rect.minX + left, y: rect.minY + top,
            width: max(0, rect.width - left - right), height: max(0, rect.height - top - bottom))
        return RoundedRect(
            rect: inner, topLeft: shrink(topLeft, left, top), topRight: shrink(topRight, right, top),
            bottomRight: shrink(bottomRight, right, bottom),
            bottomLeft: shrink(bottomLeft, left, bottom))
    }

    /// The outline, clockwise from the top-left corner, with radii scaled down together where
    /// two on one side would overlap (CSS's corner overlap rule).
    package var path: CGPath {
        let path = CGMutablePath()
        add(to: path)
        return path
    }

    package func add(to path: CGMutablePath) {
        let r = rect.standardized
        guard r.width > 0, r.height > 0 else {
            return
        }
        var scale: CGFloat = 1
        let sides: [(CGFloat, CGFloat)] = [
            (topLeft.width + topRight.width, r.width),
            (bottomLeft.width + bottomRight.width, r.width),
            (topLeft.height + bottomLeft.height, r.height),
            (topRight.height + bottomRight.height, r.height),
        ]
        for (sum, length) in sides where sum > length {
            scale = min(scale, length / sum)
        }
        let corner = { (size: CGSize) -> CGSize in
            guard size.width > 0, size.height > 0 else {
                return .zero
            }
            return CGSize(width: size.width * scale, height: size.height * scale)
        }
        let tl = corner(topLeft)
        let tr = corner(topRight)
        let br = corner(bottomRight)
        let bl = corner(bottomLeft)
        // A quarter ellipse as one cubic: the control points sit this far along the tangents.
        let k: CGFloat = 0.552_284_75
        path.move(to: CGPoint(x: r.minX + tl.width, y: r.minY))
        path.addLine(to: CGPoint(x: r.maxX - tr.width, y: r.minY))
        if tr != .zero {
            path.addCurve(
                to: CGPoint(x: r.maxX, y: r.minY + tr.height),
                control1: CGPoint(x: r.maxX - tr.width * (1 - k), y: r.minY),
                control2: CGPoint(x: r.maxX, y: r.minY + tr.height * (1 - k)))
        }
        path.addLine(to: CGPoint(x: r.maxX, y: r.maxY - br.height))
        if br != .zero {
            path.addCurve(
                to: CGPoint(x: r.maxX - br.width, y: r.maxY),
                control1: CGPoint(x: r.maxX, y: r.maxY - br.height * (1 - k)),
                control2: CGPoint(x: r.maxX - br.width * (1 - k), y: r.maxY))
        }
        path.addLine(to: CGPoint(x: r.minX + bl.width, y: r.maxY))
        if bl != .zero {
            path.addCurve(
                to: CGPoint(x: r.minX, y: r.maxY - bl.height),
                control1: CGPoint(x: r.minX + bl.width * (1 - k), y: r.maxY),
                control2: CGPoint(x: r.minX, y: r.maxY - bl.height * (1 - k)))
        }
        path.addLine(to: CGPoint(x: r.minX, y: r.minY + tl.height))
        if tl != .zero {
            path.addCurve(
                to: CGPoint(x: r.minX + tl.width, y: r.minY),
                control1: CGPoint(x: r.minX, y: r.minY + tl.height * (1 - k)),
                control2: CGPoint(x: r.minX + tl.width * (1 - k), y: r.minY))
        }
        path.closeSubpath()
    }
}
