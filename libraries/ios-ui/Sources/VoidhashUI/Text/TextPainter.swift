import CoreGraphics
import CoreText
import Foundation

/// What a `text` view paints besides its glyphs (views protocol, "Text").
package struct TextPaint {
    package struct Decoration {
        package enum Style: String {
            case solid, double, dashed, dotted, wavy
        }

        package var underline = false
        package var lineThrough = false
        package var color: CGColor
        package var style: Style = .solid
    }

    package struct Stroke {
        /// How far the outline reaches beyond the glyph edges.
        package var width: CGFloat
        package var color: CGColor
    }

    package struct Shadow {
        package var color: CGColor
        package var offset: CGSize
        package var blur: CGFloat
    }

    package var color: CGColor = CGColor(srgbRed: 0, green: 0, blue: 0, alpha: 1)
    package var decoration: Decoration?
    package var stroke: Stroke?
    package var shadow: Shadow?

    package init() {}
}

extension TextLayout {
    /// Line `index` as it is drawn in a box `boxWidth` wide: justified when the alignment asks
    /// for it, at its offset from the box's left edge.
    package func placedLine(_ index: Int, boxWidth: CGFloat) -> (
        line: CTLine, x: CGFloat, width: CGFloat
    ) {
        let entry = lines[index]
        var line = entry.line
        var width = entry.width
        if style.alignment == .justify, !entry.endsParagraph, boxWidth > width,
            let justified = CTLineCreateJustifiedLine(line, 1, Double(boxWidth))
        {
            line = justified
            width = boxWidth
        }
        switch style.alignment {
        case .left, .justify: return (line, 0, width)
        case .right: return (line, boxWidth - width, width)
        case .center: return (line, (boxWidth - width) / 2, width)
        }
    }

    /// The UTF-16 offset in the text of the character under `point` (relative to the top-left
    /// corner of a box `boxWidth` wide), from Core Text's hit-testing of the line under it;
    /// `nil` between lines' ends and the box's edges, and on a cut line's ellipsis.
    package func characterIndex(at point: CGPoint, boxWidth: CGFloat) -> Int? {
        let height = CGFloat(style.lineHeight)
        guard point.y >= 0, height > 0 else {
            return nil
        }
        let index = Int(point.y / height)
        guard index < lines.count else {
            return nil
        }
        let entry = lines[index]
        let (line, x, width) = placedLine(index, boxWidth: boxWidth)
        let along = point.x - x
        guard along >= 0, along < width, !entry.range.isEmpty else {
            return nil
        }
        // The caret position nearest the point; the character under it is the one before
        // when that caret lies past the point.
        var caret = CTLineGetStringIndexForPosition(line, CGPoint(x: along, y: 0))
        guard caret != kCFNotFound else {
            return nil
        }
        let lineStart = entry.range.lowerBound - entry.stringOffset
        if caret > lineStart, CTLineGetOffsetForStringIndex(line, caret, nil) > along {
            caret -= 1
        }
        let offset = caret + entry.stringOffset
        return entry.range.contains(offset) ? offset : nil
    }

    /// The boxes the glyphs of `range` (UTF-16 offsets of the text) cover, one per line they
    /// reach, relative to the top-left corner of a box `boxWidth` wide.
    package func rects(for range: Range<Int>, boxWidth: CGFloat) -> [CGRect] {
        let height = CGFloat(style.lineHeight)
        return lines.indices.compactMap { index -> CGRect? in
            let entry = lines[index]
            let shown = entry.range.clamped(to: range)
            guard !shown.isEmpty else {
                return nil
            }
            let (line, x, _) = placedLine(index, boxWidth: boxWidth)
            let from = CTLineGetOffsetForStringIndex(line, shown.lowerBound - entry.stringOffset, nil)
            let to = CTLineGetOffsetForStringIndex(line, shown.upperBound - entry.stringOffset, nil)
            return CGRect(
                x: x + min(from, to), y: CGFloat(index) * height, width: abs(to - from),
                height: height)
        }
    }

    /// Draws the lines top-aligned in `box` of a y-down context, each aligned in the box's
    /// width, with glyphs on the device pixel grid of `scale`. The glyph stroke is drawn behind
    /// the fill, and the shadow of both together. Runs draw in their own colours and with their
    /// own lines, besides the paragraph's decoration.
    package func draw(in context: CGContext, box: CGRect, scale: CGFloat, paint: TextPaint) {
        context.saveGState()
        defer { context.restoreGState() }
        context.textMatrix = .identity
        if let shadow = paint.shadow {
            context.setShadow(offset: shadow.offset, blur: shadow.blur, color: shadow.color)
            context.beginTransparencyLayer(auxiliaryInfo: nil)
        }
        let size = CGFloat(style.size)
        for index in lines.indices {
            let entry = lines[index]
            let (line, offset, width) = placedLine(index, boxWidth: box.width)
            let x = box.minX + offset
            let y = box.minY + baseline(ofLine: index)
            context.saveGState()
            context.translateBy(x: x, y: box.minY + glyphBaseline(ofLine: index, scale: scale))
            context.scaleBy(x: 1, y: -1)
            if let stroke = paint.stroke, stroke.width > 0 {
                context.setTextDrawingMode(.stroke)
                context.setStrokeColor(stroke.color)
                context.setLineWidth(stroke.width * 2)
                context.setLineJoin(.round)
                // Glyph by glyph: a line draws a coloured run's stroke in the run's colour.
                Self.drawGlyphs(of: line, in: context)
            }
            context.setTextDrawingMode(.fill)
            context.textPosition = .zero
            // Run by run: drawing a coloured run leaves its colour as the context's fill, which
            // a run in the paragraph's colour would otherwise take.
            for run in CTLineGetGlyphRuns(line) as? [CTRun] ?? [] {
                let attributes = CTRunGetAttributes(run) as NSDictionary
                let color = attributes[kCTForegroundColorAttributeName].flatMap { value in
                    CFGetTypeID(value as CFTypeRef) == CGColor.typeID ? (value as! CGColor) : nil
                }
                context.setFillColor(color ?? paint.color)
                CTRunDraw(run, context, CFRange(location: 0, length: 0))
            }
            context.restoreGState()
            if let decoration = paint.decoration, width > 0 {
                if decoration.underline {
                    drawDecoration(
                        decoration, from: x, to: x + width, y: y + size * 0.12, context: context)
                }
                if decoration.lineThrough {
                    drawDecoration(
                        decoration, from: x, to: x + width, y: y - size * 0.3, context: context)
                }
            }
            for run in style.runs where run.underline || run.lineThrough {
                let shown = entry.range.clamped(to: run.start..<max(run.start, run.end))
                guard !shown.isEmpty else {
                    continue
                }
                let from = x + CTLineGetOffsetForStringIndex(
                    line, shown.lowerBound - entry.stringOffset, nil)
                let to = x + CTLineGetOffsetForStringIndex(
                    line, shown.upperBound - entry.stringOffset, nil)
                let lines = TextPaint.Decoration(
                    underline: run.underline, lineThrough: run.lineThrough,
                    color: run.color.map { DrawList.color($0) } ?? paint.color)
                if run.underline {
                    drawDecoration(lines, from: from, to: to, y: y + size * 0.12, context: context)
                }
                if run.lineThrough {
                    drawDecoration(lines, from: from, to: to, y: y - size * 0.3, context: context)
                }
            }
        }
        if paint.shadow != nil {
            context.endTransparencyLayer()
        }
    }

    /// Draws the glyphs of `line` at the text origin in the context's current drawing mode and
    /// colours, whatever colours its runs carry.
    private static func drawGlyphs(of line: CTLine, in context: CGContext) {
        for run in CTLineGetGlyphRuns(line) as? [CTRun] ?? [] {
            let count = CTRunGetGlyphCount(run)
            guard count > 0,
                let value = (CTRunGetAttributes(run) as NSDictionary)[kCTFontAttributeName],
                CFGetTypeID(value as CFTypeRef) == CTFontGetTypeID()
            else {
                continue
            }
            var glyphs = [CGGlyph](repeating: 0, count: count)
            var positions = [CGPoint](repeating: .zero, count: count)
            CTRunGetGlyphs(run, CFRange(location: 0, length: 0), &glyphs)
            CTRunGetPositions(run, CFRange(location: 0, length: 0), &positions)
            CTFontDrawGlyphs(value as! CTFont, glyphs, positions, count, context)
        }
    }

    private func drawDecoration(
        _ decoration: TextPaint.Decoration, from start: CGFloat, to end: CGFloat, y: CGFloat,
        context: CGContext
    ) {
        let thickness = max(1, CGFloat(style.size) / 14)
        context.saveGState()
        defer { context.restoreGState() }
        context.setStrokeColor(decoration.color)
        context.setLineWidth(thickness)
        switch decoration.style {
        case .solid:
            context.strokeLineSegments(between: [CGPoint(x: start, y: y), CGPoint(x: end, y: y)])
        case .double:
            for offset in [-thickness, thickness] {
                context.strokeLineSegments(between: [
                    CGPoint(x: start, y: y + offset), CGPoint(x: end, y: y + offset),
                ])
            }
        case .dashed:
            context.setLineDash(phase: 0, lengths: [thickness * 3, thickness * 2])
            context.strokeLineSegments(between: [CGPoint(x: start, y: y), CGPoint(x: end, y: y)])
        case .dotted:
            context.setLineCap(.round)
            context.setLineDash(phase: 0, lengths: [0, thickness * 2])
            context.strokeLineSegments(between: [CGPoint(x: start, y: y), CGPoint(x: end, y: y)])
        case .wavy:
            let wavelength = thickness * 4
            let path = CGMutablePath()
            path.move(to: CGPoint(x: start, y: y))
            var x = start
            var up = true
            while x < end {
                let next = min(x + wavelength / 2, end)
                path.addQuadCurve(
                    to: CGPoint(x: next, y: y),
                    control: CGPoint(x: (x + next) / 2, y: y + (up ? -thickness : thickness) * 1.5))
                x = next
                up.toggle()
            }
            context.addPath(path)
            context.strokePath()
        }
    }
}
