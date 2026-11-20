package com.voidhash.ui

import android.graphics.Path
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.math.tan

/**
 * Parses SVG path data (`d`) into a [Path]: every command of SVG 1.1 in absolute and relative
 * form, implicit repeats, and numbers written as `1.5.5`, `-1-2` or `1e-3`. Parsing stops at the
 * first malformed command and keeps what came before it, as browsers do.
 */
internal object SvgPath {
    fun parse(data: String): Path = Path().also { Parser(data, PathSink(it)).build() }

    /** Receives the parsed segments; a test sink records them. */
    interface Sink {
        fun moveTo(x: Double, y: Double)

        fun lineTo(x: Double, y: Double)

        fun cubicTo(x1: Double, y1: Double, x2: Double, y2: Double, x: Double, y: Double)

        fun quadTo(x1: Double, y1: Double, x: Double, y: Double)

        fun close()
    }

    private class PathSink(private val path: Path) : Sink {
        override fun moveTo(x: Double, y: Double) = path.moveTo(x.toFloat(), y.toFloat())

        override fun lineTo(x: Double, y: Double) = path.lineTo(x.toFloat(), y.toFloat())

        override fun cubicTo(x1: Double, y1: Double, x2: Double, y2: Double, x: Double, y: Double) =
            path.cubicTo(x1.toFloat(), y1.toFloat(), x2.toFloat(), y2.toFloat(), x.toFloat(), y.toFloat())

        override fun quadTo(x1: Double, y1: Double, x: Double, y: Double) =
            path.quadTo(x1.toFloat(), y1.toFloat(), x.toFloat(), y.toFloat())

        override fun close() = path.close()
    }

    /** Parses [data] into [sink]. */
    fun parse(data: String, sink: Sink) = Parser(data, sink).build()

    private class Parser(private val data: String, private val sink: Sink) {
        private var at = 0
        private var currentX = 0.0
        private var currentY = 0.0
        private var startX = 0.0
        private var startY = 0.0
        private var started = false

        /** The last cubic's second control point, or the last quadratic's control point, for reflection. */
        private var cubicControl: DoubleArray? = null
        private var quadControl: DoubleArray? = null

        fun build() {
            var command: Char? = null
            while (true) {
                skipSeparators()
                if (at >= data.length) return
                val char = data[at]
                if (char in COMMANDS) {
                    command = char
                    at += 1
                } else if (command == null || !startsNumber(char)) {
                    return
                }
                val active = command ?: return
                if (!perform(active)) return
                // A moveto's further coordinate pairs are linetos.
                command = when (active) {
                    'M' -> 'L'
                    'm' -> 'l'
                    'Z', 'z' -> null
                    else -> active
                }
            }
        }

        private fun startsNumber(char: Char) = char in '0'..'9' || char == '-' || char == '+' || char == '.'

        /** Performs one command with its operands; `false` when they are malformed. */
        private fun perform(command: Char): Boolean {
            val relative = command.isLowerCase()
            val originX = if (relative) currentX else 0.0
            val originY = if (relative) currentY else 0.0
            var cubic: DoubleArray? = null
            var quad: DoubleArray? = null
            when (command.lowercaseChar()) {
                'm' -> {
                    val x = number() ?: return false
                    val y = number() ?: return false
                    currentX = originX + x
                    currentY = originY + y
                    startX = currentX
                    startY = currentY
                    sink.moveTo(currentX, currentY)
                    started = true
                }
                'l' -> {
                    val x = number() ?: return false
                    val y = number() ?: return false
                    lineTo(originX + x, originY + y)
                }
                'h' -> lineTo((if (relative) currentX else 0.0) + (number() ?: return false), currentY)
                'v' -> lineTo(currentX, (if (relative) currentY else 0.0) + (number() ?: return false))
                'c' -> {
                    val values = numbers(6) ?: return false
                    cubic = doubleArrayOf(originX + values[2], originY + values[3])
                    curveTo(originX + values[0], originY + values[1], cubic[0], cubic[1], originX + values[4], originY + values[5])
                }
                's' -> {
                    val values = numbers(4) ?: return false
                    val first = reflect(cubicControl)
                    cubic = doubleArrayOf(originX + values[0], originY + values[1])
                    curveTo(first[0], first[1], cubic[0], cubic[1], originX + values[2], originY + values[3])
                }
                'q' -> {
                    val values = numbers(4) ?: return false
                    quad = doubleArrayOf(originX + values[0], originY + values[1])
                    quadTo(quad[0], quad[1], originX + values[2], originY + values[3])
                }
                't' -> {
                    val values = numbers(2) ?: return false
                    quad = reflect(quadControl)
                    quadTo(quad[0], quad[1], originX + values[0], originY + values[1])
                }
                'a' -> {
                    val rx = number() ?: return false
                    val ry = number() ?: return false
                    val rotation = number() ?: return false
                    val large = flag() ?: return false
                    val sweep = flag() ?: return false
                    val x = number() ?: return false
                    val y = number() ?: return false
                    arcTo(originX + x, originY + y, abs(rx), abs(ry), rotation * PI / 180, large, sweep)
                }
                'z' -> {
                    if (started) sink.close()
                    currentX = startX
                    currentY = startY
                }
                else -> return false
            }
            cubicControl = cubic
            quadControl = quad
            return true
        }

        private fun reflect(control: DoubleArray?): DoubleArray =
            if (control == null) doubleArrayOf(currentX, currentY) else doubleArrayOf(2 * currentX - control[0], 2 * currentY - control[1])

        /** Path data may draw before its first moveto only in malformed input; a subpath starts at the current point then. */
        private fun ensureStarted() {
            if (!started) {
                sink.moveTo(currentX, currentY)
                started = true
            }
        }

        private fun lineTo(x: Double, y: Double) {
            ensureStarted()
            sink.lineTo(x, y)
            currentX = x
            currentY = y
        }

        private fun curveTo(x1: Double, y1: Double, x2: Double, y2: Double, x: Double, y: Double) {
            ensureStarted()
            sink.cubicTo(x1, y1, x2, y2, x, y)
            currentX = x
            currentY = y
        }

        private fun quadTo(x1: Double, y1: Double, x: Double, y: Double) {
            ensureStarted()
            sink.quadTo(x1, y1, x, y)
            currentX = x
            currentY = y
        }

        /** An elliptical arc by the endpoint parameterization (SVG 1.1, appendix F.6), as cubics of at most a quarter turn each. */
        private fun arcTo(endX: Double, endY: Double, radiusX: Double, radiusY: Double, rotation: Double, large: Boolean, sweep: Boolean) {
            if (currentX == endX && currentY == endY) return
            if (radiusX <= 0 || radiusY <= 0) {
                lineTo(endX, endY)
                return
            }
            var rx = radiusX
            var ry = radiusY
            val cosine = cos(rotation)
            val sine = sin(rotation)
            val dx = (currentX - endX) / 2
            val dy = (currentY - endY) / 2
            val x1 = cosine * dx + sine * dy
            val y1 = -sine * dx + cosine * dy
            val lambda = x1 * x1 / (rx * rx) + y1 * y1 / (ry * ry)
            if (lambda > 1) {
                rx *= sqrt(lambda)
                ry *= sqrt(lambda)
            }
            val numerator = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
            val denominator = rx * rx * y1 * y1 + ry * ry * x1 * x1
            var coefficient = sqrt(max(0.0, numerator) / denominator)
            if (large == sweep) coefficient = -coefficient
            val cx1 = coefficient * rx * y1 / ry
            val cy1 = -coefficient * ry * x1 / rx
            val centerX = cosine * cx1 - sine * cy1 + (currentX + endX) / 2
            val centerY = sine * cx1 + cosine * cy1 + (currentY + endY) / 2
            fun angle(ux: Double, uy: Double, vx: Double, vy: Double) = atan2(ux * vy - uy * vx, ux * vx + uy * vy)
            val theta = angle(1.0, 0.0, (x1 - cx1) / rx, (y1 - cy1) / ry)
            var delta = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry)
            if (!sweep && delta > 0) delta -= 2 * PI else if (sweep && delta < 0) delta += 2 * PI
            val segments = max(1, ceil(abs(delta) / (PI / 2)).toInt())
            val step = delta / segments
            val handle = 4.0 / 3.0 * tan(step / 4)
            fun pointX(angle: Double) = centerX + cosine * rx * cos(angle) - sine * ry * sin(angle)
            fun pointY(angle: Double) = centerY + sine * rx * cos(angle) + cosine * ry * sin(angle)
            fun derivativeX(angle: Double) = -cosine * rx * sin(angle) - sine * ry * cos(angle)
            fun derivativeY(angle: Double) = -sine * rx * sin(angle) + cosine * ry * cos(angle)
            ensureStarted()
            var from = theta
            for (index in 0 until segments) {
                val to = from + step
                val p0x = pointX(from)
                val p0y = pointY(from)
                val p3x = if (index == segments - 1) endX else pointX(to)
                val p3y = if (index == segments - 1) endY else pointY(to)
                sink.cubicTo(
                    p0x + handle * derivativeX(from),
                    p0y + handle * derivativeY(from),
                    p3x - handle * derivativeX(to),
                    p3y - handle * derivativeY(to),
                    p3x,
                    p3y,
                )
                from = to
            }
            currentX = endX
            currentY = endY
        }

        private fun skipSeparators() {
            while (at < data.length && (data[at] == ' ' || data[at] == '\t' || data[at] == '\n' || data[at] == '\r' || data[at] == '\u000C' || data[at] == ',')) {
                at += 1
            }
        }

        /** An arc flag: a single `0` or `1`, which may run into the next number. */
        private fun flag(): Boolean? {
            skipSeparators()
            if (at >= data.length) return null
            return when (data[at]) {
                '0' -> false.also { at += 1 }
                '1' -> true.also { at += 1 }
                else -> null
            }
        }

        private fun numbers(count: Int): DoubleArray? {
            val values = DoubleArray(count)
            for (index in 0 until count) values[index] = number() ?: return null
            return values
        }

        private fun number(): Double? {
            skipSeparators()
            val start = at
            if (at < data.length && (data[at] == '-' || data[at] == '+')) at += 1
            var digits = 0
            var seenDot = false
            while (at < data.length) {
                val char = data[at]
                if (char in '0'..'9') {
                    digits += 1
                } else if (char == '.' && !seenDot) {
                    seenDot = true
                } else {
                    break
                }
                at += 1
            }
            if (digits == 0) {
                at = start
                return null
            }
            if (at < data.length && (data[at] == 'e' || data[at] == 'E')) {
                var exponentEnd = at + 1
                if (exponentEnd < data.length && (data[exponentEnd] == '-' || data[exponentEnd] == '+')) exponentEnd += 1
                var exponentDigits = 0
                while (exponentEnd < data.length && data[exponentEnd] in '0'..'9') {
                    exponentEnd += 1
                    exponentDigits += 1
                }
                if (exponentDigits > 0) at = exponentEnd
            }
            return data.substring(start, at).toDoubleOrNull()?.takeIf { it.isFinite() }
        }

        private companion object {
            const val COMMANDS = "MmLlHhVvCcSsQqTtAaZz"
        }
    }
}
