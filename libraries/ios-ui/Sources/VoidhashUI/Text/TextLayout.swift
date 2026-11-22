import CoreGraphics
import CoreText
import Foundation

/// How a paragraph is set, as layout measures it and a `text` view draws it (views protocol,
/// "Text" and "Text measurement").
package struct TextStyle: Hashable, Sendable {
    package enum Alignment: UInt8, Sendable {
        case left = 0
        case right = 1
        case center = 2
        case justify = 3
    }

    /// Empty for the default family.
    package var family: String = ""
    package var size: Float = 14
    package var weight: UInt16 = 400
    package var italic = false
    package var lineHeight: Float = 14 * 1.2
    package var letterSpacing: Float = 0
    package var alignment: Alignment = .left
    /// The most lines shown, 0 for no limit.
    package var maxLines: UInt32 = 0
    /// Runs styled apart from the rest, in order and not overlapping.
    package var runs: [TextRun] = []

    package init() {}
}

/// A stretch of a paragraph styled apart from the rest (views protocol, "Text", `textRuns`);
/// it changes only what it sets. Its press handler is the view's business, not the layout's.
package struct TextRun: Hashable, Sendable {
    /// UTF-16 code units of the text: the run is `start..<end`.
    package var start: Int
    package var end: Int
    /// CSS weight; `nil` keeps the paragraph's.
    package var weight: UInt16?
    /// `nil` keeps the paragraph's slant.
    package var italic: Bool?
    /// `0xRRGGBBAA`; `nil` keeps the paragraph's colour.
    package var color: UInt32?
    package var underline = false
    package var lineThrough = false

    package init(
        start: Int, end: Int, weight: UInt16? = nil, italic: Bool? = nil, color: UInt32? = nil,
        underline: Bool = false, lineThrough: Bool = false
    ) {
        self.start = start
        self.end = end
        self.weight = weight
        self.italic = italic
        self.color = color
        self.underline = underline
        self.lineThrough = lineThrough
    }
}

/// A paragraph broken into lines at one width. Measuring and drawing both use it, so a
/// measured size and a drawn paragraph cannot disagree.
package struct TextLayout {
    package struct Line {
        package let line: CTLine
        /// The characters the line shows, its ellipsis included.
        package let content: String
        /// The width the line occupies: a line ending at a hard break or the end of the text
        /// counts its trailing whitespace, a line wrapped at a space does not.
        package let width: CGFloat
        /// The line ends at a hard break or the end of the text; justification leaves it alone.
        package let endsParagraph: Bool
        /// Where the baseline sits below the line's top: the largest ascent and descent of the
        /// fonts its glyphs use, centred in the line height.
        package let baseline: CGFloat
        /// The UTF-16 code units of the text the line shows, its hard break and ellipsis not
        /// included.
        package let range: Range<Int>
        /// What string index 0 of `line` is in the text: 0 for a line of the whole paragraph,
        /// the line's start for a cut line, which is set on its own.
        package let stringOffset: Int

        init(
            line: CTLine, content: String, width: CGFloat, endsParagraph: Bool, font: CTFont,
            lineHeight: CGFloat, range: Range<Int>, stringOffset: Int = 0
        ) {
            self.line = line
            self.range = range
            self.stringOffset = stringOffset
            self.content = content
            self.width = width
            self.endsParagraph = endsParagraph
            var ascent: CGFloat = 0
            var descent: CGFloat = 0
            let runs = CTLineGetGlyphRuns(line) as? [CTRun] ?? []
            let fonts = runs.compactMap { run -> CTFont? in
                let value = (CTRunGetAttributes(run) as NSDictionary)[kCTFontAttributeName]
                guard let value, CFGetTypeID(value as CFTypeRef) == CTFontGetTypeID() else {
                    return nil
                }
                return (value as! CTFont)
            }
            for runFont in fonts.isEmpty ? [font] : fonts {
                let metrics = TextLayout.verticalMetrics(of: runFont)
                ascent = max(ascent, metrics.ascent)
                descent = max(descent, metrics.descent)
            }
            baseline = (lineHeight - (ascent + descent)) / 2 + ascent
        }
    }

    package let lines: [Line]
    package let style: TextStyle
    /// The text with its runs' attributes, which the lines were set from.
    package let paragraph: NSAttributedString
    /// The width the lines were wrapped at, `.infinity` for unconstrained text.
    package let wrapWidth: CGFloat
    package let font: CTFont
    /// The widest line and the height of every line shown.
    package let size: CGSize

    /// Where the baseline of line `index` sits below the top of the text box.
    package func baseline(ofLine index: Int) -> CGFloat {
        return CGFloat(index) * CGFloat(style.lineHeight) + lines[index].baseline
    }

    /// Where the glyphs of line `index` sit below the top of the text box: its baseline,
    /// rounded down to the device pixel grid of `scale` as the engine places glyphs.
    package func glyphBaseline(ofLine index: Int, scale: CGFloat) -> CGFloat {
        let scale = max(scale, 1)
        return (baseline(ofLine: index) * scale).rounded(.down) / scale
    }

    /// A font's ascent and descent at its size as the engine reads them: the OS/2 typographic
    /// ascender and descender when the font sets USE_TYPO_METRICS, the hhea ones otherwise.
    static func verticalMetrics(of font: CTFont) -> (ascent: CGFloat, descent: CGFloat) {
        let unitScale = CTFontGetSize(font) / CGFloat(max(CTFontGetUnitsPerEm(font), 1))
        let int16 = { (table: Data, offset: Int) -> CGFloat in
            let index = table.startIndex + offset
            return CGFloat(Int16(bitPattern: UInt16(table[index]) << 8 | UInt16(table[index + 1])))
        }
        if let os2 = CTFontCopyTable(font, CTFontTableTag(0x4F53_2F32), []) as Data?,  // 'OS/2'
            os2.count >= 72, Int(int16(os2, 62)) & 0x80 != 0, int16(os2, 68) != 0
        {
            return (int16(os2, 68) * unitScale, -int16(os2, 70) * unitScale)
        }
        if let hhea = CTFontCopyTable(font, CTFontTableTag(0x6868_6561), []) as Data?,  // 'hhea'
            hhea.count >= 8
        {
            return (int16(hhea, 4) * unitScale, -int16(hhea, 6) * unitScale)
        }
        return (CTFontGetAscent(font), CTFontGetDescent(font))
    }

    /// Lays `text` out at `width` (`.infinity`: unconstrained), wrapping at word boundaries,
    /// each line `lineHeight` tall, and ending the last line shown in `…` when lines are cut.
    package init(text: String, style: TextStyle, width: CGFloat, fonts: FontRegistry) {
        self.style = style
        wrapWidth = width
        let font = fonts.font(
            family: style.family, weight: Int(style.weight), italic: style.italic,
            size: CGFloat(style.size))
        self.font = font
        var attributes: [NSAttributedString.Key: Any] = [
            NSAttributedString.Key(kCTFontAttributeName as String): font,
            NSAttributedString.Key(kCTForegroundColorFromContextAttributeName as String): true,
        ]
        if style.letterSpacing != 0 {
            attributes[NSAttributedString.Key(kCTKernAttributeName as String)] =
                CGFloat(style.letterSpacing)
        }
        let string = text as NSString
        let paragraph = Self.attributed(
            text, style: style, base: attributes, font: font, fonts: fonts)
        self.paragraph = paragraph
        let typesetter = CTTypesetterCreateWithAttributedString(paragraph)
        // Core Text needs a finite width; this one is wider than any paragraph.
        let breakWidth = width.isFinite ? max(0, Double(width)) : 1e7
        let length = string.length
        var lines: [Line] = []
        var start = 0
        let limit = style.maxLines == 0 ? Int.max : Int(style.maxLines)
        while start < length {
            var count = CTTypesetterSuggestLineBreak(typesetter, start, breakWidth)
            if count <= 0 {
                count = 1
            }
            let end = start + count
            // The line without its hard break, which draws nothing.
            var contentEnd = end
            while contentEnd > start, Self.isLineBreak(string.character(at: contentEnd - 1)) {
                contentEnd -= 1
            }
            let hardBreak = contentEnd < end
            let line = CTTypesetterCreateLine(
                typesetter, CFRange(location: start, length: contentEnd - start))
            if lines.count == limit - 1 && (end < length || hardBreak) {
                // The last line shown, with more lines after it (an empty one after a final
                // break included): ends in an ellipsis.
                let (ellipsized, content, cut) = Self.ellipsized(
                    line, paragraph: paragraph, from: start, to: contentEnd,
                    attributes: attributes, width: width)
                lines.append(
                    Line(
                        line: ellipsized, content: content,
                        width: Self.width(of: ellipsized, trailingWhitespace: true),
                        endsParagraph: true, font: font, lineHeight: CGFloat(style.lineHeight),
                        range: start..<cut, stringOffset: start))
                break
            }
            let endsParagraph = end >= length || hardBreak
            lines.append(
                Line(
                    line: line,
                    content: string.substring(
                        with: NSRange(location: start, length: contentEnd - start)),
                    width: Self.width(of: line, trailingWhitespace: endsParagraph),
                    endsParagraph: endsParagraph, font: font,
                    lineHeight: CGFloat(style.lineHeight), range: start..<contentEnd))
            start = end
        }
        if lines.isEmpty || (length > 0 && Self.isLineBreak(string.character(at: length - 1))
            && lines.count < limit)
        {
            // An empty paragraph, or one ending in a line break, has an empty last line.
            let empty = CTLineCreateWithAttributedString(
                NSAttributedString(string: "", attributes: attributes))
            lines.append(
                Line(
                    line: empty, content: "", width: 0, endsParagraph: true, font: font,
                    lineHeight: CGFloat(style.lineHeight), range: length..<length))
        }
        self.lines = lines
        size = CGSize(
            width: lines.map(\.width).max() ?? 0,
            height: CGFloat(lines.count) * CGFloat(style.lineHeight))
    }

    /// Whether `scalar` is whitespace as the views core and the engine have it: Unicode's
    /// `White_Space` (Rust's `char::is_whitespace`), which counts the no-break spaces.
    static func isWhiteSpace(_ scalar: Unicode.Scalar) -> Bool {
        return scalar.properties.isWhitespace
    }

    private static func isLineBreak(_ unit: unichar) -> Bool {
        return unit == 0x0A || unit == 0x0D || unit == 0x2028 || unit == 0x2029
    }

    private static func width(of line: CTLine, trailingWhitespace: Bool) -> CGFloat {
        var width = CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
        if !trailingWhitespace {
            width -= CGFloat(CTLineGetTrailingWhitespaceWidth(line))
        }
        return width.isFinite ? max(0, width) : 0
    }

    /// The paragraph with its runs applied: each run's weight and slant pick its font from
    /// the registry, its colour replaces the paragraph's, which is the context's fill colour
    /// elsewhere.
    private static func attributed(
        _ text: String, style: TextStyle, base: [NSAttributedString.Key: Any], font: CTFont,
        fonts: FontRegistry
    ) -> NSAttributedString {
        let paragraph = NSMutableAttributedString(string: text, attributes: base)
        let length = paragraph.length
        let fontKey = NSAttributedString.Key(kCTFontAttributeName as String)
        for run in style.runs {
            let start = min(max(run.start, 0), length)
            let end = min(max(run.end, start), length)
            guard end > start else {
                continue
            }
            let range = NSRange(location: start, length: end - start)
            let weight = run.weight ?? style.weight
            let italic = run.italic ?? style.italic
            if weight != style.weight || italic != style.italic {
                paragraph.addAttribute(
                    fontKey,
                    value: fonts.font(
                        family: style.family, weight: Int(weight), italic: italic,
                        size: CGFloat(style.size)),
                    range: range)
            }
            if let color = run.color {
                paragraph.removeAttribute(
                    NSAttributedString.Key(kCTForegroundColorFromContextAttributeName as String),
                    range: range)
                paragraph.addAttribute(
                    NSAttributedString.Key(kCTForegroundColorAttributeName as String),
                    value: DrawList.color(color), range: range)
            }
        }
        return paragraph
    }

    /// The last line shown when lines are cut, as the engine cuts it (views protocol, "Text
    /// measurement"): from the end of `line` (`start..<end` of `paragraph`), drop the last
    /// character that is not whitespace, then more while what is left plus `…` is wider than
    /// `width`; drop the whitespace left at the end and append `…` in the paragraph's style.
    /// Returns where the text was cut.
    private static func ellipsized(
        _ line: CTLine, paragraph: NSAttributedString, from start: Int, to end: Int,
        attributes: [NSAttributedString.Key: Any], width: CGFloat
    ) -> (line: CTLine, content: String, cut: Int) {
        let string = paragraph.string as NSString
        let marker = NSAttributedString(string: "…", attributes: attributes)
        let markerWidth = Self.width(
            of: CTLineCreateWithAttributedString(marker), trailingWhitespace: true)
        var cut = end
        while cut > start {
            let cluster = string.rangeOfComposedCharacterSequence(at: cut - 1)
            cut = max(cluster.location, start)
            if string.substring(with: cluster).unicodeScalars.allSatisfy(Self.isWhiteSpace) {
                continue
            }
            if CTLineGetOffsetForStringIndex(line, cut, nil) + markerWidth <= width {
                break
            }
        }
        while cut > start, let scalar = UnicodeScalar(string.character(at: cut - 1)),
            Self.isWhiteSpace(scalar)
        {
            cut -= 1
        }
        let shown = NSMutableAttributedString(
            attributedString: paragraph.attributedSubstring(
                from: NSRange(location: start, length: cut - start)))
        shown.append(marker)
        return (CTLineCreateWithAttributedString(shown), shown.string, cut)
    }
}

/// Lays text out for one flow view, and keeps recent layouts so that measuring the same
/// paragraph again costs a lookup, and a `text` view draws the very layout the core sized it
/// from.
package final class TextSystem {
    package let fonts: FontRegistry

    private struct Key: Hashable {
        let text: String
        let style: TextStyle
        let width: UInt64
    }

    private struct Paragraph: Hashable {
        let text: String
        let style: TextStyle
    }

    private var layouts: [Key: TextLayout] = [:]
    /// The layouts ``measure(_:style:maxWidth:)`` handed the core, by paragraph, the latest
    /// last.
    private var measured: [Paragraph: [TextLayout]] = [:]
    /// Layouts, and measured paragraphs, kept at most; each cache starts over beyond it.
    private static let capacity = 1024
    /// Measurements of one paragraph kept, at different widths.
    private static let measuredPerParagraph = 8

    /// Answers ``measure(_:style:maxWidth:)`` in place of laying the text out, when set. The
    /// views contract's tests replay the editor's recorded answers through a view's own
    /// callback with it, to check how the view applies the core's operations apart from how
    /// it measures text.
    var answers: ((String, TextStyle, CGFloat) -> CGSize)?

    package init(fonts: FontRegistry = FontRegistry()) {
        self.fonts = fonts
    }

    /// The layout of `text` at `width`, from the cache when it was laid out before.
    package func layout(_ text: String, style: TextStyle, width: CGFloat) -> TextLayout {
        let key = Key(
            text: text, style: style,
            width: width.isFinite ? Double(width).bitPattern : Double.infinity.bitPattern)
        if let layout = layouts[key] {
            return layout
        }
        let layout = TextLayout(text: text, style: style, width: width, fonts: fonts)
        if layouts.count >= Self.capacity {
            layouts.removeAll(keepingCapacity: true)
        }
        layouts[key] = layout
        return layout
    }

    /// The width of the widest line and the height of every line shown at `maxWidth`.
    package func measure(_ text: String, style: TextStyle, maxWidth: CGFloat) -> CGSize {
        if let answers {
            return answers(text, style, maxWidth)
        }
        let layout = layout(text, style: style, width: maxWidth)
        let paragraph = Paragraph(text: text, style: style)
        if measured[paragraph] == nil, measured.count >= Self.capacity {
            measured.removeAll(keepingCapacity: true)
        }
        var history = measured[paragraph, default: []]
        history.removeAll { $0.wrapWidth == layout.wrapWidth }
        history.append(layout)
        if history.count > Self.measuredPerParagraph {
            history.removeFirst()
        }
        measured[paragraph] = history
        return layout.size
    }

    /// The layout a text box of `box` draws at `scale` device pixels per point: the one
    /// measuring produced that the core sized the box from, so the drawn lines are the
    /// measured ones.
    ///
    /// Laying the text out again at the box's width is not the same: the core shrinks the box
    /// to the widest line, and the line cut at the line limit was wrapped, and its ellipsis
    /// fitted, at the wider width it was measured at. At the box's width it wraps earlier, or
    /// the separately measured `…` no longer fits beside the rest, and loses more characters.
    ///
    /// A measured layout matches when it was wrapped at the box's width (a fixed or stretched
    /// width), or its widest line is the box's width, which the core rounds to the device
    /// pixel grid; and its lines are the box's height, or fit in a taller box. The latest
    /// measurement wins. Text no measurement matches is laid out at the box's width.
    package func drawnLayout(
        _ text: String, style: TextStyle, box: CGSize, scale: CGFloat
    ) -> TextLayout {
        let pixel = 1 / max(scale, 1)
        let history = measured[Paragraph(text: text, style: style)] ?? []
        let widthMatches = history.filter { layout in
            abs(layout.wrapWidth - box.width) < pixel
                || (layout.wrapWidth >= box.width - pixel
                    && abs(layout.size.width - box.width) < pixel)
        }
        return widthMatches.last { abs($0.size.height - box.height) < pixel }
            ?? widthMatches.last { $0.size.height < box.height + pixel }
            ?? layout(text, style: style, width: box.width)
    }

    /// Forgets every layout: fonts changed.
    package func fontsChanged() {
        layouts.removeAll()
        measured.removeAll()
    }
}
