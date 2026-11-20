import CoreGraphics
import Foundation

/// Parses SVG path data (`d`) into a `CGPath`: every command of SVG 1.1 in absolute and relative
/// form, implicit repeats, and numbers written as `1.5.5`, `-1-2` or `1e-3`. Parsing stops at
/// the first malformed command and keeps what came before it, as browsers do.
package enum SVGPath {
    package static func parse(_ data: String) -> CGPath {
        var parser = Parser(Array(data.utf8))
        let path = CGMutablePath()
        parser.build(into: path)
        return path
    }

    private struct Parser {
        private let bytes: [UInt8]
        private var at = 0
        private var current = CGPoint.zero
        private var subpathStart = CGPoint.zero
        /// The second control point of the last cubic, or the control point of the last
        /// quadratic, for the smooth commands' reflection.
        private var lastCubicControl: CGPoint?
        private var lastQuadControl: CGPoint?

        init(_ bytes: [UInt8]) {
            self.bytes = bytes
        }

        mutating func build(into path: CGMutablePath) {
            var command: UInt8?
            while true {
                skipSeparators()
                guard at < bytes.count else {
                    return
                }
                let byte = bytes[at]
                if Self.isCommand(byte) {
                    command = byte
                    at += 1
                } else if command == nil || !Self.startsNumber(byte) {
                    return
                }
                guard let active = command, perform(active, into: path) else {
                    return
                }
                // A moveto's further coordinate pairs are linetos.
                if active == UInt8(ascii: "M") {
                    command = UInt8(ascii: "L")
                } else if active == UInt8(ascii: "m") {
                    command = UInt8(ascii: "l")
                } else if active == UInt8(ascii: "Z") || active == UInt8(ascii: "z") {
                    command = nil
                }
            }
        }

        private static func isCommand(_ byte: UInt8) -> Bool {
            return "MmLlHhVvCcSsQqTtAaZz".utf8.contains(byte)
        }

        private static func startsNumber(_ byte: UInt8) -> Bool {
            return (byte >= 48 && byte <= 57) || byte == UInt8(ascii: "-")
                || byte == UInt8(ascii: "+") || byte == UInt8(ascii: ".")
        }

        /// Performs one command with its operands; `false` when they are malformed.
        private mutating func perform(_ command: UInt8, into path: CGMutablePath) -> Bool {
            let relative = command >= UInt8(ascii: "a")
            let origin = relative ? current : .zero
            func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
                return CGPoint(x: origin.x + x, y: origin.y + y)
            }
            var cubic: CGPoint?
            var quad: CGPoint?
            switch command | 0x20 {
            case UInt8(ascii: "m"):
                guard let x = number(), let y = number() else { return false }
                current = point(x, y)
                subpathStart = current
                path.move(to: current)
            case UInt8(ascii: "l"):
                guard let x = number(), let y = number() else { return false }
                lineTo(point(x, y), path)
            case UInt8(ascii: "h"):
                guard let x = number() else { return false }
                lineTo(CGPoint(x: (relative ? current.x : 0) + x, y: current.y), path)
            case UInt8(ascii: "v"):
                guard let y = number() else { return false }
                lineTo(CGPoint(x: current.x, y: (relative ? current.y : 0) + y), path)
            case UInt8(ascii: "c"):
                guard let x1 = number(), let y1 = number(), let x2 = number(), let y2 = number(),
                    let x = number(), let y = number()
                else { return false }
                let control = point(x2, y2)
                curveTo(point(x, y), point(x1, y1), control, path)
                cubic = control
            case UInt8(ascii: "s"):
                guard let x2 = number(), let y2 = number(), let x = number(), let y = number()
                else { return false }
                let first = reflect(lastCubicControl)
                let control = point(x2, y2)
                curveTo(point(x, y), first, control, path)
                cubic = control
            case UInt8(ascii: "q"):
                guard let x1 = number(), let y1 = number(), let x = number(), let y = number()
                else { return false }
                let control = point(x1, y1)
                quadTo(point(x, y), control, path)
                quad = control
            case UInt8(ascii: "t"):
                guard let x = number(), let y = number() else { return false }
                let control = reflect(lastQuadControl)
                quadTo(point(x, y), control, path)
                quad = control
            case UInt8(ascii: "a"):
                guard let rx = number(), let ry = number(), let rotation = number(),
                    let large = flag(), let sweep = flag(), let x = number(), let y = number()
                else { return false }
                arcTo(
                    point(x, y), radii: CGSize(width: abs(rx), height: abs(ry)),
                    rotation: rotation * .pi / 180, large: large, sweep: sweep, path)
            case UInt8(ascii: "z"):
                if !path.isEmpty {
                    path.closeSubpath()
                }
                current = subpathStart
            default:
                return false
            }
            lastCubicControl = cubic
            lastQuadControl = quad
            return true
        }

        private func reflect(_ control: CGPoint?) -> CGPoint {
            guard let control else {
                return current
            }
            return CGPoint(x: 2 * current.x - control.x, y: 2 * current.y - control.y)
        }

        /// Path data may draw before its first moveto only in malformed input; start a subpath
        /// at the current point then, as Core Graphics requires one.
        private func ensureStarted(_ path: CGMutablePath) {
            if path.isEmpty {
                path.move(to: current)
            }
        }

        private mutating func lineTo(_ point: CGPoint, _ path: CGMutablePath) {
            ensureStarted(path)
            path.addLine(to: point)
            current = point
        }

        private mutating func curveTo(
            _ point: CGPoint, _ control1: CGPoint, _ control2: CGPoint, _ path: CGMutablePath
        ) {
            ensureStarted(path)
            path.addCurve(to: point, control1: control1, control2: control2)
            current = point
        }

        private mutating func quadTo(_ point: CGPoint, _ control: CGPoint, _ path: CGMutablePath) {
            ensureStarted(path)
            path.addQuadCurve(to: point, control: control)
            current = point
        }

        /// An elliptical arc by the endpoint parameterization (SVG 1.1, appendix F.6), as
        /// cubic Béziers of at most a quarter turn each.
        private mutating func arcTo(
            _ end: CGPoint, radii: CGSize, rotation: CGFloat, large: Bool, sweep: Bool,
            _ path: CGMutablePath
        ) {
            let start = current
            guard start != end else {
                return
            }
            var rx = radii.width
            var ry = radii.height
            guard rx > 0, ry > 0 else {
                lineTo(end, path)
                return
            }
            let cosine = cos(rotation)
            let sine = sin(rotation)
            let dx = (start.x - end.x) / 2
            let dy = (start.y - end.y) / 2
            let x1 = cosine * dx + sine * dy
            let y1 = -sine * dx + cosine * dy
            let lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
            if lambda > 1 {
                rx *= lambda.squareRoot()
                ry *= lambda.squareRoot()
            }
            let numerator = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
            let denominator = rx * rx * y1 * y1 + ry * ry * x1 * x1
            var coefficient = (max(0, numerator) / denominator).squareRoot()
            if large == sweep {
                coefficient = -coefficient
            }
            let cx1 = coefficient * rx * y1 / ry
            let cy1 = -coefficient * ry * x1 / rx
            let center = CGPoint(
                x: cosine * cx1 - sine * cy1 + (start.x + end.x) / 2,
                y: sine * cx1 + cosine * cy1 + (start.y + end.y) / 2)
            func angle(_ ux: CGFloat, _ uy: CGFloat, _ vx: CGFloat, _ vy: CGFloat) -> CGFloat {
                let value = atan2(ux * vy - uy * vx, ux * vx + uy * vy)
                return value
            }
            let theta = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry)
            var delta = angle(
                (x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry)
            if !sweep && delta > 0 {
                delta -= 2 * .pi
            } else if sweep && delta < 0 {
                delta += 2 * .pi
            }
            let segments = max(1, Int((abs(delta) / (.pi / 2)).rounded(.up)))
            let step = delta / CGFloat(segments)
            let handle = 4.0 / 3.0 * tan(step / 4)
            func pointOnEllipse(_ angle: CGFloat) -> CGPoint {
                let x = rx * cos(angle)
                let y = ry * sin(angle)
                return CGPoint(
                    x: center.x + cosine * x - sine * y, y: center.y + sine * x + cosine * y)
            }
            func derivative(_ angle: CGFloat) -> CGPoint {
                let x = -rx * sin(angle)
                let y = ry * cos(angle)
                return CGPoint(x: cosine * x - sine * y, y: sine * x + cosine * y)
            }
            ensureStarted(path)
            var from = theta
            for index in 0..<segments {
                let to = from + step
                let p0 = pointOnEllipse(from)
                let d0 = derivative(from)
                let d1 = derivative(to)
                let p3 = index == segments - 1 ? end : pointOnEllipse(to)
                path.addCurve(
                    to: p3,
                    control1: CGPoint(x: p0.x + handle * d0.x, y: p0.y + handle * d0.y),
                    control2: CGPoint(x: p3.x - handle * d1.x, y: p3.y - handle * d1.y))
                from = to
            }
            current = end
        }

        private mutating func skipSeparators() {
            while at < bytes.count,
                bytes[at] == 0x20 || bytes[at] == 0x09 || bytes[at] == 0x0A
                    || bytes[at] == 0x0D || bytes[at] == 0x0C || bytes[at] == UInt8(ascii: ",")
            {
                at += 1
            }
        }

        /// An arc flag: a single `0` or `1`, which may run into the next number.
        private mutating func flag() -> Bool? {
            skipSeparators()
            guard at < bytes.count else {
                return nil
            }
            switch bytes[at] {
            case UInt8(ascii: "0"):
                at += 1
                return false
            case UInt8(ascii: "1"):
                at += 1
                return true
            default:
                return nil
            }
        }

        private mutating func number() -> CGFloat? {
            skipSeparators()
            let start = at
            if at < bytes.count, bytes[at] == UInt8(ascii: "-") || bytes[at] == UInt8(ascii: "+") {
                at += 1
            }
            var digits = 0
            var seenDot = false
            while at < bytes.count {
                let byte = bytes[at]
                if byte >= 48 && byte <= 57 {
                    digits += 1
                } else if byte == UInt8(ascii: "."), !seenDot {
                    seenDot = true
                } else {
                    break
                }
                at += 1
            }
            guard digits > 0 else {
                at = start
                return nil
            }
            if at < bytes.count, bytes[at] == UInt8(ascii: "e") || bytes[at] == UInt8(ascii: "E") {
                var exponentEnd = at + 1
                if exponentEnd < bytes.count,
                    bytes[exponentEnd] == UInt8(ascii: "-") || bytes[exponentEnd] == UInt8(ascii: "+")
                {
                    exponentEnd += 1
                }
                var exponentDigits = 0
                while exponentEnd < bytes.count, bytes[exponentEnd] >= 48, bytes[exponentEnd] <= 57
                {
                    exponentEnd += 1
                    exponentDigits += 1
                }
                if exponentDigits > 0 {
                    at = exponentEnd
                }
            }
            let text = String(decoding: bytes[start..<at], as: UTF8.self)
            guard let value = Double(text), value.isFinite else {
                return nil
            }
            return CGFloat(value)
        }
    }
}
