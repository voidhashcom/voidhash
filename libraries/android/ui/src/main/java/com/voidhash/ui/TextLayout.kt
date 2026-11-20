package com.voidhash.ui

import android.graphics.Canvas
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import java.text.BreakIterator
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/** How a paragraph is set, as layout measures it and a `text` view draws it (views protocol, "Text"). */
internal data class TextStyle(
    /** Empty for the default family. */
    val family: String = "",
    val size: Float = 14f,
    val weight: Int = 400,
    val italic: Boolean = false,
    val lineHeight: Float = size * 1.2f,
    val letterSpacing: Float = 0f,
    val alignment: Int = ALIGN_LEFT,
    /** The most lines shown, 0 for no limit. */
    val maxLines: Int = 0,
    /** Runs styled apart from the rest, in order and not overlapping. */
    val runs: List<TextRun> = emptyList(),
) {
    companion object {
        const val ALIGN_LEFT = 0
        const val ALIGN_RIGHT = 1
        const val ALIGN_CENTER = 2
        const val ALIGN_JUSTIFY = 3
    }
}

/**
 * A stretch of a paragraph styled apart from the rest (views protocol, "Text", `textRuns`); it
 * changes only what it sets. Its press handler is the view's business, not the layout's.
 */
internal data class TextRun(
    /** UTF-16 code units of the text: the run is `[start, end)`. */
    val start: Int,
    val end: Int,
    /** CSS weight; `null` keeps the paragraph's. */
    val weight: Int? = null,
    /** `null` keeps the paragraph's slant. */
    val italic: Boolean? = null,
    /** An Android colour int; `null` keeps the paragraph's colour. */
    val color: Int? = null,
    val underline: Boolean = false,
    val lineThrough: Boolean = false,
) {
    companion object {
        /** Ints per run in `measureText`'s runs: `VhvTextRun`'s fields in order. */
        private const val INTS = 7

        /**
         * The runs of a measure request: per run its start, end, weight (0 keeps the
         * paragraph's), slant (0 keeps it, 1 upright, 2 italic), lines (underline 1,
         * line-through 2), `0xRRGGBBAA` colour and whether it has one.
         */
        fun fromInts(ints: IntArray?): List<TextRun> {
            ints ?: return emptyList()
            return (0 until ints.size / INTS).mapNotNull { index ->
                val at = index * INTS
                val start = ints[at]
                val end = ints[at + 1]
                if (start < 0 || end < start) return@mapNotNull null
                TextRun(
                    start = start,
                    end = end,
                    weight = ints[at + 2].takeIf { it > 0 }?.coerceIn(1, 1000),
                    italic = when (ints[at + 3]) {
                        1 -> false
                        2 -> true
                        else -> null
                    },
                    color = if (ints[at + 6] != 0) rgbaColor((ints[at + 5].toLong() and 0xFFFFFFFFL).toDouble()) else null,
                    underline = ints[at + 4] and 1 != 0,
                    lineThrough = ints[at + 4] and 2 != 0,
                )
            }
        }
    }
}

/**
 * A paragraph broken into lines at one width, in device pixels. Measuring and drawing both use
 * it, so a measured size and a drawn paragraph cannot disagree (views protocol, "Text
 * measurement"): text breaks at hard line breaks and wraps at word boundaries, a word wider than
 * the line between characters; each line is `lineHeight` tall; the line at the limit is cut and
 * ends in `…`.
 *
 * The text is set in pieces, one per stretch of one style: the paragraph's, or a run's, each
 * with its own font. A piece is measured and drawn on its own, so the advance of a range is the
 * sum of its pieces', the same when wrapping, drawing, hit-testing and framing a run.
 */
internal class TextLayout(val text: String, val style: TextStyle, val wrapWidth: Float, val scale: Float, fonts: FontRegistry) {
    /**
     * One line: the UTF-16 range `[start, end)` of the text it shows (its hard break and ellipsis
     * not included), whether it ends in `…`, the width it occupies, whether it ends a paragraph
     * (justification leaves it alone), and where its baseline sits below its top.
     */
    class Line(
        val start: Int,
        val end: Int,
        val ellipsis: Boolean,
        val width: Float,
        val endsParagraph: Boolean,
        val baseline: Float,
        /** The characters the line shows, its ellipsis included. */
        val content: String,
    )

    /** A stretch `[start, end)` of the text in one style; [color] `null` is the paragraph's. */
    private class Piece(val start: Int, val end: Int, val paint: Paint, val font: ResolvedFont, val color: Int?)

    /** The paragraph's own paint, which also sets the ellipsis. */
    val paint: Paint
    val lines: List<Line>

    /** The widest line and the height of every line shown, in pixels. */
    val width: Float
    val height: Float

    /** The height of one line in pixels. */
    val lineHeight: Float = style.lineHeight * scale

    private val font: ResolvedFont = fonts.resolve(style.family, style.weight, style.italic)
    private val pieces: List<Piece>
    private val characters: BreakIterator = BreakIterator.getCharacterInstance().also { it.setText(text) }

    init {
        paint = paint(font)
        pieces = pieces(fonts)
        val limit = if (style.maxLines <= 0) Int.MAX_VALUE else style.maxLines
        val built = ArrayList<Line>()
        val paragraphs = paragraphs()
        paragraphs@ for ((index, paragraph) in paragraphs.withIndex()) {
            val breaks = wrap(paragraph.first, paragraph.second, wrapWidth)
            for ((lineIndex, end) in breaks.withIndex()) {
                val start = if (lineIndex == 0) paragraph.first else breaks[lineIndex - 1]
                val endsParagraph = lineIndex == breaks.lastIndex
                val more = !endsParagraph || index < paragraphs.lastIndex
                if (built.size == limit - 1 && more) {
                    // The last line shown, with more lines after it: cut, ending in an ellipsis.
                    val cut = ellipsized(start, end, wrapWidth)
                    val width = advance(start, cut) + paint.measureText(ELLIPSIS)
                    built.add(Line(start, cut, true, width, true, baseline(start, cut, true), text.substring(start, cut) + ELLIPSIS))
                    break@paragraphs
                }
                // A line wrapped at a space does not count the spaces at the wrap.
                val measured = if (endsParagraph) end else trimEnd(text, end, start)
                built.add(Line(start, end, false, advance(start, measured), endsParagraph, baseline(start, end, false), text.substring(start, end)))
            }
        }
        lines = built
        this.width = built.maxOfOrNull { it.width } ?: 0f
        height = built.size * lineHeight
    }

    /** Where the baseline of line [index] sits below the top of the text box. */
    fun baseline(index: Int): Float = index * lineHeight + lines[index].baseline

    private fun paint(font: ResolvedFont): Paint {
        val size = style.size
        val spacing = style.letterSpacing
        return Paint(Paint.ANTI_ALIAS_FLAG or Paint.SUBPIXEL_TEXT_FLAG).apply {
            typeface = font.typeface
            textSize = size * scale
            // Letter spacing is in ems; Android adds it per character, half before and half after.
            letterSpacing = if (size > 0f) spacing / size else 0f
            if (font.syntheticItalic) textSkewX = -0.21f
        }
    }

    /** The text in pieces of one style: the paragraph's between runs, each run's own. */
    private fun pieces(fonts: FontRegistry): List<Piece> {
        val pieces = ArrayList<Piece>()
        var at = 0
        for (run in style.runs) {
            val start = run.start.coerceIn(at, text.length)
            val end = run.end.coerceIn(start, text.length)
            if (end <= start) continue
            if (start > at) pieces.add(Piece(at, start, paint, font, null))
            val weight = run.weight ?: style.weight
            val italic = run.italic ?: style.italic
            if (weight == style.weight && italic == style.italic) {
                pieces.add(Piece(start, end, paint, font, run.color))
            } else {
                val runFont = fonts.resolve(style.family, weight, italic)
                pieces.add(Piece(start, end, paint(runFont), runFont, run.color))
            }
            at = end
        }
        if (at < text.length) pieces.add(Piece(at, text.length, paint, font, null))
        return pieces
    }

    /** The advance of the text's `[from, to)`, in pixels, piece by piece. */
    private fun advance(from: Int, to: Int): Float {
        var total = 0f
        for (piece in pieces) {
            if (piece.end <= from) continue
            if (piece.start >= to) break
            total += piece.paint.measureText(text, max(from, piece.start), min(to, piece.end))
        }
        return total
    }

    /**
     * The paragraphs between hard breaks (LF, CR, CRLF, U+2028, U+2029) as `[start, end)`; text
     * ending in one has an empty last.
     */
    private fun paragraphs(): List<Pair<Int, Int>> {
        val paragraphs = ArrayList<Pair<Int, Int>>()
        var start = 0
        var at = 0
        while (at < text.length) {
            val unit = text[at]
            if (unit == '\n' || unit == '\r' || unit == ' ' || unit == ' ') {
                paragraphs.add(start to at)
                at += if (unit == '\r' && at + 1 < text.length && text[at + 1] == '\n') 2 else 1
                start = at
            } else {
                at += 1
            }
        }
        paragraphs.add(start to text.length)
        return paragraphs
    }

    /** The ends of the lines the paragraph `[start, end)` wraps into at [available] pixels. */
    private fun wrap(start: Int, end: Int, available: Float): List<Int> {
        if (start == end || !available.isFinite()) return listOf(end)
        val width = available + FIT_TOLERANCE
        val paragraph = text.substring(start, end)
        val ends = ArrayList<Int>()
        val words = BreakIterator.getLineInstance().apply { setText(paragraph) }
        val characters = BreakIterator.getCharacterInstance().apply { setText(paragraph) }
        var from = 0
        while (from < paragraph.length) {
            var best = -1
            var candidate = words.following(from)
            while (candidate != BreakIterator.DONE) {
                if (advance(start + from, trimEnd(text, start + candidate, start + from)) > width) break
                best = candidate
                candidate = words.next()
            }
            if (best == -1) {
                // The first word is wider than the line: as many characters as fit, at least one.
                var next = characters.following(from)
                best = next
                while (true) {
                    next = characters.next()
                    if (next == BreakIterator.DONE || advance(start + from, start + next) > width) break
                    best = next
                }
            }
            ends.add(start + best)
            from = best
        }
        return ends
    }

    /**
     * Where the last line shown, `[start, end)`, is cut when lines are cut: from its end,
     * whitespace, then one visible character, then characters while the rest and `…` are wider
     * than [width], then whitespace go; `…`, in the paragraph's style, follows.
     */
    private fun ellipsized(start: Int, end: Int, width: Float): Int {
        var cut = trimEnd(text, end, start)
        if (cut > start) cut = max(start, characters.preceding(cut))
        val ellipsis = paint.measureText(ELLIPSIS)
        while (width.isFinite() && cut > start && advance(start, cut) + ellipsis > width + FIT_TOLERANCE) {
            cut = max(start, characters.preceding(cut))
        }
        return trimEnd(text, cut, start)
    }

    /**
     * The baseline below the top of the line showing `[start, end)`: the largest ascent and
     * descent of the fonts its pieces use (and the system font's where a character falls back
     * to it, and the paragraph's for its ellipsis or when it is empty), centred in the line
     * height.
     */
    private fun baseline(start: Int, end: Int, ellipsis: Boolean): Float {
        var ascent = 0f
        var descent = 0f
        fun include(font: ResolvedFont, paint: Paint, content: CharSequence, from: Int, to: Int) {
            val file = font.file
            if (file != null) {
                ascent = max(ascent, file.ascent * paint.textSize)
                descent = max(descent, file.descent * paint.textSize)
                if (fallsBack(content, from, to, file)) {
                    val fallback = systemMetrics(paint.textSize)
                    ascent = max(ascent, -fallback.ascent)
                    descent = max(descent, fallback.descent)
                }
            } else {
                val metrics = paint.fontMetrics
                ascent = max(ascent, -metrics.ascent)
                descent = max(descent, metrics.descent)
            }
        }
        for (piece in pieces) {
            if (piece.end <= start) continue
            if (piece.start >= end) break
            include(piece.font, piece.paint, text, max(start, piece.start), min(end, piece.end))
        }
        if (ellipsis || start == end) include(font, paint, ELLIPSIS, 0, if (ellipsis) ELLIPSIS.length else 0)
        return (lineHeight - (ascent + descent)) / 2 + ascent
    }

    private fun fallsBack(content: CharSequence, from: Int, to: Int, file: FontFile): Boolean {
        var at = from
        while (at < to) {
            val codePoint = Character.codePointAt(content, at)
            if (!Character.isWhitespace(codePoint) && !file.hasGlyph(codePoint)) return true
            at += Character.charCount(codePoint)
        }
        return false
    }

    private fun systemMetrics(size: Float): Paint.FontMetrics =
        Paint().apply {
            typeface = Typeface.DEFAULT
            textSize = size
        }.fontMetrics

    // region Placing lines

    /** Whether line [index] is stretched to [boxWidth]: justified, not ending a paragraph, and narrower. */
    private fun justified(index: Int, boxWidth: Float): Boolean {
        val line = lines[index]
        return style.alignment == TextStyle.ALIGN_JUSTIFY && !line.endsParagraph && boxWidth > line.width
    }

    /** The width line [index] occupies in a box [boxWidth] pixels wide. */
    private fun placedWidth(index: Int, boxWidth: Float): Float = if (justified(index, boxWidth)) boxWidth else lines[index].width

    /** Where line [index] starts from the left edge of a box [boxWidth] pixels wide. */
    private fun lineX(index: Int, boxWidth: Float): Float {
        val line = lines[index]
        return when (style.alignment) {
            TextStyle.ALIGN_RIGHT -> boxWidth - line.width
            TextStyle.ALIGN_CENTER -> (boxWidth - line.width) / 2
            else -> 0f
        }
    }

    /** What each space of line [index] widens by in a box [boxWidth] pixels wide: 0 unless it is justified. */
    private fun spaceExtra(index: Int, boxWidth: Float): Float {
        if (!justified(index, boxWidth)) return 0f
        val line = lines[index]
        val spaces = spaces(line.start, trimEnd(text, line.end, line.start))
        return if (spaces == 0) 0f else (boxWidth - line.width) / spaces
    }

    private fun spaces(from: Int, to: Int): Int {
        var count = 0
        for (at in from until to) if (text[at] == ' ') count += 1
        return count
    }

    /** Where the character at UTF-16 offset [at] of line [index] starts, from the box's left edge. */
    private fun position(index: Int, at: Int, boxWidth: Float, extra: Float): Float {
        val line = lines[index]
        return lineX(index, boxWidth) + advance(line.start, at) + extra * spaces(line.start, at)
    }

    /**
     * The UTF-16 offset in the text of the character under [x], [y] (pixels from the text box's
     * top-left corner, in a box [boxWidth] wide); `null` between a line's end and the box's
     * edges, below the last line, and on a cut line's ellipsis.
     */
    fun characterIndex(x: Float, y: Float, boxWidth: Float): Int? {
        if (y < 0f || lineHeight <= 0f) return null
        val index = floor(y / lineHeight).toInt()
        if (index >= lines.size) return null
        val line = lines[index]
        val left = lineX(index, boxWidth)
        if (x < left || x >= left + placedWidth(index, boxWidth) || line.start == line.end) return null
        val extra = spaceExtra(index, boxWidth)
        var at = line.start
        while (at < line.end) {
            val next = characters.following(at).let { if (it == BreakIterator.DONE) line.end else min(it, line.end) }
            if (x < position(index, next, boxWidth, extra)) return at
            at = next
        }
        return null
    }

    /**
     * The boxes the glyphs of `[start, end)` (UTF-16 offsets of the text) cover, one per line
     * they reach, in pixels from the top-left corner of a text box [boxWidth] wide.
     */
    fun rects(start: Int, end: Int, boxWidth: Float): List<RectF> = lines.indices.mapNotNull { index ->
        val line = lines[index]
        val from = max(start, line.start)
        val to = min(end, line.end)
        if (to <= from) return@mapNotNull null
        val extra = spaceExtra(index, boxWidth)
        val left = position(index, from, boxWidth, extra)
        val right = position(index, to, boxWidth, extra)
        RectF(min(left, right), index * lineHeight, max(left, right), (index + 1) * lineHeight)
    }

    // endregion

    /**
     * Draws the lines top-aligned in the box at [left], [top] of [boxWidth] pixels, each aligned
     * in its width. Glyphs sit on their baseline rounded down to a device pixel from the box's
     * top; decorations on the exact baseline. The glyph stroke is drawn behind the fill, and the
     * shadow is cast by the bottom-most pass. Runs draw in their own colours and with their own
     * lines, besides the paragraph's decoration.
     */
    fun draw(canvas: Canvas, left: Float, top: Float, boxWidth: Float, textPaint: TextPaint) {
        val shadowRadius = textPaint.shadow?.let { BoxDecoration.blurMaskRadius(it.blur * scale).coerceAtLeast(0.01f) }
        fun Paint.castShadow() = apply {
            val shadow = textPaint.shadow ?: return@apply
            setShadowLayer(shadowRadius ?: 0.01f, shadow.x * scale, shadow.y * scale, shadow.color)
        }
        // Per piece paint: the stroke behind, then the fill in the piece's colour.
        val strokes = HashMap<Paint, Paint>()
        val fills = HashMap<Pair<Paint, Int>, Paint>()
        fun stroke(paint: Paint): Paint? = textPaint.stroke?.let { stroke ->
            strokes.getOrPut(paint) {
                Paint(paint).apply {
                    style = Paint.Style.STROKE
                    color = stroke.color
                    strokeWidth = stroke.width * scale * 2
                    strokeJoin = Paint.Join.ROUND
                }.castShadow()
            }
        }
        fun fill(paint: Paint, color: Int): Paint = fills.getOrPut(paint to color) {
            Paint(paint).apply { this.color = color }.also { if (textPaint.stroke == null) it.castShadow() }
        }
        // Android puts half of the letter spacing before each character; the protocol adds it after.
        val spacingShift = paint.letterSpacing * paint.textSize / 2
        val size = style.size * scale
        val thickness = max(1f * scale, size / 14)
        for ((index, line) in lines.withIndex()) {
            val extra = spaceExtra(index, boxWidth)
            val justify = justified(index, boxWidth)
            val glyphY = top + floor(baseline(index))
            val drawnEnd = if (justify) trimEnd(text, line.end, line.start) else line.end
            for (pass in 0..1) {
                for (piece in pieces) {
                    if (piece.end <= line.start) continue
                    if (piece.start >= drawnEnd) break
                    val passPaint = if (pass == 0) stroke(piece.paint) ?: continue else fill(piece.paint, piece.color ?: textPaint.color)
                    // A justified line in words, each at its stretched place.
                    var from = max(line.start, piece.start)
                    val to = min(drawnEnd, piece.end)
                    while (from < to) {
                        val wordEnd = if (justify) text.indexOf(' ', from).let { if (it < 0 || it > to) to else it } else to
                        if (wordEnd > from) {
                            canvas.drawText(text, from, wordEnd, left + position(index, from, boxWidth, extra) - spacingShift, glyphY, passPaint)
                        }
                        from = if (justify && wordEnd < to) wordEnd + 1 else wordEnd
                    }
                }
                if (line.ellipsis) {
                    val passPaint = if (pass == 0) stroke(paint) ?: continue else fill(paint, textPaint.color)
                    canvas.drawText(ELLIPSIS, left + position(index, line.end, boxWidth, extra) - spacingShift, glyphY, passPaint)
                }
            }
            val y = top + baseline(index)
            val x = left + lineX(index, boxWidth)
            val lineWidth = placedWidth(index, boxWidth)
            val decoration = textPaint.decoration
            if (decoration != null && lineWidth > 0f) {
                val decorationPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = decoration.color
                    this.style = Paint.Style.STROKE
                    strokeWidth = thickness
                }.castShadow()
                if (decoration.underline) drawDecoration(canvas, decoration.style, x, x + lineWidth, y + size * 0.12f, decorationPaint)
                if (decoration.lineThrough) drawDecoration(canvas, decoration.style, x, x + lineWidth, y - size * 0.3f, decorationPaint)
            }
            for (run in style.runs) {
                if (!run.underline && !run.lineThrough) continue
                val from = max(run.start, line.start)
                val to = min(run.end, line.end)
                if (to <= from) continue
                val start = left + position(index, from, boxWidth, extra)
                val end = left + position(index, to, boxWidth, extra)
                val runPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = run.color ?: textPaint.color
                    this.style = Paint.Style.STROKE
                    strokeWidth = thickness
                }.castShadow()
                if (run.underline) canvas.drawLine(start, y + size * 0.12f, end, y + size * 0.12f, runPaint)
                if (run.lineThrough) canvas.drawLine(start, y - size * 0.3f, end, y - size * 0.3f, runPaint)
            }
        }
    }

    private fun drawDecoration(canvas: Canvas, style: String, start: Float, end: Float, y: Float, paint: Paint) {
        val thickness = paint.strokeWidth
        when (style) {
            "double" -> {
                canvas.drawLine(start, y - thickness, end, y - thickness, paint)
                canvas.drawLine(start, y + thickness, end, y + thickness, paint)
            }
            "dashed" -> {
                paint.pathEffect = DashPathEffect(floatArrayOf(thickness * 3, thickness * 2), 0f)
                canvas.drawLine(start, y, end, y, paint)
            }
            "dotted" -> {
                paint.strokeCap = Paint.Cap.ROUND
                paint.pathEffect = DashPathEffect(floatArrayOf(0f, thickness * 2), 0f)
                canvas.drawLine(start, y, end, y, paint)
            }
            "wavy" -> {
                val half = thickness * 2
                val path = Path().apply { moveTo(start, y) }
                var x = start
                var up = true
                while (x < end) {
                    val next = minOf(x + half, end)
                    path.quadTo((x + next) / 2, y + (if (up) -thickness else thickness) * 1.5f, next, y)
                    x = next
                    up = !up
                }
                canvas.drawPath(path, paint)
            }
            else -> canvas.drawLine(start, y, end, y, paint)
        }
    }

    companion object {
        const val ELLIPSIS = "…"

        /**
         * Device pixels text may exceed its width by and still fit: the core asks again at the
         * width a measurement returned, after a round trip through logical pixels that can lose
         * the last bit.
         */
        const val FIT_TOLERANCE = 0.05f

        /** [end] moved back over the whitespace before it, not past [start]. */
        fun trimEnd(text: String, end: Int, start: Int = 0): Int {
            var at = end
            while (at > start && Character.isWhitespace(text[at - 1])) at -= 1
            return at
        }
    }
}

/** What a `text` view paints besides its glyphs (views protocol, "Text"), in logical pixels. */
internal class TextPaint(
    val color: Int,
    val decoration: Decoration? = null,
    val stroke: Stroke? = null,
    val shadow: Shadow? = null,
) {
    class Decoration(val underline: Boolean, val lineThrough: Boolean, val color: Int, val style: String)

    /** An outline reaching [width] beyond the glyph edges. */
    class Stroke(val width: Float, val color: Int)

    class Shadow(val color: Int, val x: Float, val y: Float, val blur: Float)
}

/**
 * Lays text out for one paywall view, and keeps recent layouts so that measuring the same
 * paragraph again costs a lookup, and a `text` view draws the very layout the core sized it from.
 */
internal class TextSystem(val fonts: FontRegistry) {
    private data class Key(val text: String, val style: TextStyle, val width: Float, val scale: Float)

    private data class Paragraph(val text: String, val style: TextStyle, val scale: Float)

    private val layouts = object : LinkedHashMap<Key, TextLayout>(64, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<Key, TextLayout>?) = size > CAPACITY
    }

    /** The layouts [measure] handed the core, by paragraph, the latest last. */
    private val measured = object : LinkedHashMap<Paragraph, ArrayList<TextLayout>>(64, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<Paragraph, ArrayList<TextLayout>>?) = size > CAPACITY
    }

    /** The layout of [text] at [width] device pixels (infinite: unconstrained), from the cache when it was laid out before. */
    fun layout(text: String, style: TextStyle, width: Float, scale: Float): TextLayout {
        val key = Key(text, style, if (width.isFinite()) width else Float.POSITIVE_INFINITY, scale)
        return layouts.getOrPut(key) { TextLayout(text, style, width, scale, fonts) }
    }

    /**
     * The width of the widest line and the height of every line shown, in logical pixels, of
     * [text] wrapped to [maxWidth] logical pixels at [scale] device pixels per logical pixel.
     */
    fun measure(text: String, style: TextStyle, maxWidth: Float, scale: Float): Pair<Float, Float> {
        val safeScale = if (scale.isFinite() && scale > 0f) scale else 1f
        val layout = layout(text, style, if (maxWidth.isFinite()) max(0f, maxWidth) * safeScale else maxWidth, safeScale)
        val history = measured.getOrPut(Paragraph(text, style, safeScale)) { ArrayList() }
        history.remove(layout)
        history.add(layout)
        if (history.size > MEASURED_PER_PARAGRAPH) history.removeAt(0)
        return layout.width / safeScale to layout.height / safeScale
    }

    /**
     * The layout a text box of [boxWidth] × [boxHeight] device pixels draws: the one measuring
     * produced that the core sized the box from, so the drawn lines are the measured ones.
     *
     * Laying the text out again at the box's width is not the same: the core shrinks the box to
     * the widest line, and the line cut at the line limit was wrapped, and its ellipsis fitted, at
     * the wider width it was measured at. At the box's width it wraps earlier, or the separately
     * measured `…` no longer fits beside the rest, and loses more characters.
     *
     * A measured layout matches when it was wrapped at the box's width (a fixed or stretched
     * width), or its widest line is the box's width, which the core rounds up to the device
     * pixel grid; and its lines are the box's height, or fit in a taller box. The latest
     * measurement wins. Text no measurement matches is laid out at the box's width.
     */
    fun drawnLayout(text: String, style: TextStyle, boxWidth: Float, boxHeight: Float, scale: Float): TextLayout {
        val widthMatches = measured[Paragraph(text, style, scale)].orEmpty().filter { layout ->
            abs(layout.wrapWidth - boxWidth) < 1f ||
                (layout.wrapWidth >= boxWidth && boxWidth > layout.width - TextLayout.FIT_TOLERANCE && boxWidth < layout.width + 1f)
        }
        return widthMatches.lastOrNull { abs(it.height - boxHeight) < 1f }
            ?: widthMatches.lastOrNull { it.height < boxHeight + 1f }
            ?: layout(text, style, boxWidth, scale)
    }

    /** Forgets every layout: fonts changed. */
    fun fontsChanged() {
        layouts.clear()
        measured.clear()
    }

    private companion object {
        /** Layouts kept at most; the least recently used go first. */
        const val CAPACITY = 1024

        /** Measurements of one paragraph kept, at different widths. */
        const val MEASURED_PER_PARAGRAPH = 8
    }
}
