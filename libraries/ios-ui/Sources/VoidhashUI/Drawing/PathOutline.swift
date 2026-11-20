import CoreGraphics

/// A path's outline measured for trimming (views protocol, "Paths"): its contours flattened
/// to polylines in path order, a closed contour ending with its closing segment.
///
/// Measuring flattens the curves once; ``trimmed(from:to:)`` then only walks the measured
/// points, cheap enough for a trim that animates on every frame.
package struct PathOutline {
    /// The path as given, drawn when it is not trimmed.
    package let path: CGPath
    private let contours: [[CGPoint]]
    private let length: CGFloat

    /// How far a flattened curve may stray from the curve, in the path's units (logical
    /// pixels once stretched to the frame), as the engine flattens it.
    private static let tolerance: CGFloat = 0.05

    package init(_ path: CGPath) {
        self.path = path
        var contours: [[CGPoint]] = []
        var points: [CGPoint] = []
        var last = CGPoint.zero
        let finish = {
            if points.count > 1 {
                contours.append(points)
            }
            points = []
        }
        // The element's type is spelled out and the curve math lives in the helpers below, so
        // the compiler type-checks this closure quickly (Swift 6.1 gave up on it otherwise).
        path.applyWithBlock { (pointer: UnsafePointer<CGPathElement>) in
            let element = pointer.pointee
            let at = element.points
            switch element.type {
            case .moveToPoint:
                finish()
                points = [at[0]]
                last = at[0]
            case .addLineToPoint:
                if points.isEmpty { points = [last] }
                points.append(at[0])
                last = at[0]
            case .addQuadCurveToPoint:
                if points.isEmpty { points = [last] }
                let (p0, p1, p2) = (last, at[0], at[1])
                let count = Self.segments(Self.bend(p0, p1, p2) / 4)
                for step in 1...count {
                    points.append(
                        Self.quadratic(p0, p1, p2, at: CGFloat(step) / CGFloat(count)))
                }
                last = p2
            case .addCurveToPoint:
                if points.isEmpty { points = [last] }
                let (p0, p1, p2, p3) = (last, at[0], at[1], at[2])
                let deviation = max(Self.bend(p0, p1, p2), Self.bend(p1, p2, p3))
                let count = Self.segments(deviation * 3 / 4)
                for step in 1...count {
                    points.append(
                        Self.cubic(p0, p1, p2, p3, at: CGFloat(step) / CGFloat(count)))
                }
                last = p3
            case .closeSubpath:
                if let first = points.first, let end = points.last, first != end {
                    points.append(first)
                }
                if let first = points.first {
                    last = first
                }
                finish()
            @unknown default:
                break
            }
        }
        finish()
        self.contours = contours
        length = contours.reduce(0) { total, points in
            total + zip(points, points.dropFirst()).reduce(0) { $0 + Self.distance($1.0, $1.1) }
        }
    }

    /// How far the middle of three control points bends away from the line through the other
    /// two: the length of their second difference.
    private static func bend(_ a: CGPoint, _ b: CGPoint, _ c: CGPoint) -> CGFloat {
        let x: CGFloat = a.x - 2 * b.x + c.x
        let y: CGFloat = a.y - 2 * b.y + c.y
        return distance(CGPoint(x: x, y: y))
    }

    /// The point at `t` of the quadratic Bézier curve through `p0`, `p1` and `p2`.
    private static func quadratic(_ p0: CGPoint, _ p1: CGPoint, _ p2: CGPoint, at t: CGFloat)
        -> CGPoint
    {
        let u: CGFloat = 1 - t
        let a: CGFloat = u * u
        let b: CGFloat = 2 * u * t
        let c: CGFloat = t * t
        let x: CGFloat = a * p0.x + b * p1.x + c * p2.x
        let y: CGFloat = a * p0.y + b * p1.y + c * p2.y
        return CGPoint(x: x, y: y)
    }

    /// The point at `t` of the cubic Bézier curve through `p0` to `p3`.
    private static func cubic(
        _ p0: CGPoint, _ p1: CGPoint, _ p2: CGPoint, _ p3: CGPoint, at t: CGFloat
    ) -> CGPoint {
        let u: CGFloat = 1 - t
        let a: CGFloat = u * u * u
        let b: CGFloat = 3 * u * u * t
        let c: CGFloat = 3 * u * t * t
        let d: CGFloat = t * t * t
        let x: CGFloat = a * p0.x + b * p1.x + c * p2.x + d * p3.x
        let y: CGFloat = a * p0.y + b * p1.y + c * p2.y + d * p3.y
        return CGPoint(x: x, y: y)
    }

    /// The stretch of the outline from `start` to `end`, fractions of its whole length, as
    /// open polylines: one per contour it reaches. Empty when `end` is not past `start`.
    package func trimmed(from start: CGFloat, to end: CGFloat) -> CGPath {
        let out = CGMutablePath()
        guard length > 0, end > start else {
            return out
        }
        let from = start * length
        let to = end * length
        var walked: CGFloat = 0
        for points in contours {
            var open = false
            for (a, b) in zip(points, points.dropFirst()) {
                let segment = Self.distance(a, b)
                let low = walked
                let high = walked + segment
                walked = high
                if segment <= 0 || high <= from || low >= to {
                    continue
                }
                let at = { (distance: CGFloat) -> CGPoint in
                    let t = (distance - low) / segment
                    return CGPoint(x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t)
                }
                if !open {
                    out.move(to: at(max(from, low)))
                    open = true
                }
                out.addLine(to: at(min(to, high)))
            }
            if walked >= to {
                break
            }
        }
        return out
    }

    /// Line segments that keep a curve whose second difference is `bend` within the
    /// tolerance.
    private static func segments(_ bend: CGFloat) -> Int {
        guard bend.isFinite, bend > 0 else {
            return 1
        }
        return min(max(Int((bend / tolerance).squareRoot().rounded(.up)), 1), 1024)
    }

    private static func distance(_ vector: CGPoint) -> CGFloat {
        return (vector.x * vector.x + vector.y * vector.y).squareRoot()
    }

    private static func distance(_ a: CGPoint, _ b: CGPoint) -> CGFloat {
        return distance(CGPoint(x: b.x - a.x, y: b.y - a.y))
    }
}
