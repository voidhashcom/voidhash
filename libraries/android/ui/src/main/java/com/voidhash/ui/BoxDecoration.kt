package com.voidhash.ui

import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.DashPathEffect
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Region
import android.graphics.Shader
import android.os.Build
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min

/**
 * Paints what every view kind shares below its subviews: drop shadows, background colour and
 * gradient, inset shadows, borders and outline (views protocol, "Every view"), in pixels.
 *
 * [update] turns the props into paths and paints once per change; [draw] only paints them.
 */
internal class BoxDecoration {
    /** The border box with its corners, as last laid out. */
    var shape = RoundedRect(RectF(), FloatArray(8))
        private set

    /** [shape] as a path, for clipping. */
    val shapePath = Path()

    private class Blurred(val path: Path, val color: Int, val blur: Float) {
        /** The software-rendered blur, for canvases that cannot blur themselves. */
        var bitmap: Bitmap? = null
        var bitmapBounds = RectF()
    }

    private val dropShadows = ArrayList<Blurred>()
    private val insetShadows = ArrayList<Blurred>()
    private var backgroundColor: Int? = null
    private var gradient: Shader? = null

    /** Border pieces: a path, its paint, and the wedge it is clipped to for one side's colour. */
    private class BorderPiece(val path: Path, val paint: Paint, val clip: Path?)

    private val borders = ArrayList<BorderPiece>()
    private var outline: BorderPiece? = null
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG)

    /** Whether anything is painted at all; a bare view skips [draw]. */
    var isEmpty = true
        private set

    /** Lays the decoration out for a view of [width] × [height] pixels at [scale] pixels per logical pixel. */
    fun update(props: Map<String, PropValue>, width: Float, height: Float, scale: Float) {
        shape = RoundedRect.of(RectF(0f, 0f, width, height), props["cornerRadii"]?.numbers.orEmpty(), scale)
        shapePath.reset()
        shape.addTo(shapePath)
        val shadows = props["shadows"]?.array.orEmpty()
        dropShadows.clear()
        insetShadows.clear()
        for (shadow in shadows) {
            val color = shadow["color"]?.color ?: continue
            val spread = (shadow["spread"]?.number ?: 0.0).toFloat() * scale
            val blur = max(0f, (shadow["blur"]?.number ?: 0.0).toFloat() * scale)
            val dx = (shadow["x"]?.number ?: 0.0).toFloat() * scale
            val dy = (shadow["y"]?.number ?: 0.0).toFloat() * scale
            if (shadow["inset"]?.bool == true) {
                // A ring around the box shrunk by the spread and moved by the offset; its blurred
                // shadow is what falls inside the box.
                val reach = blur * 2 + abs(spread) + abs(dx) + abs(dy) + 4
                val ring = Path().apply {
                    fillType = Path.FillType.EVEN_ODD
                    addRect(-reach, -reach, width + reach, height + reach, Path.Direction.CW)
                    shape.outset(-spread).offset(dx, dy).addTo(this)
                }
                insetShadows.add(Blurred(ring, color, blur))
            } else {
                dropShadows.add(Blurred(shape.outset(spread).offset(dx, dy).toPath(), color, blur))
            }
        }
        backgroundColor = props["backgroundColor"]?.color
        gradient = props["backgroundGradient"]?.let { gradientShader(it, width, height) }
        updateBorders(props, scale)
        updateOutline(props["outline"], scale)
        isEmpty = dropShadows.isEmpty() && insetShadows.isEmpty() && backgroundColor == null &&
            gradient == null && borders.isEmpty() && outline == null
    }

    fun draw(canvas: Canvas) {
        if (isEmpty) return
        for (shadow in dropShadows) {
            // A box shadow is never drawn below the box itself.
            canvas.save()
            clipOut(canvas, shapePath)
            drawBlurred(canvas, shadow)
            canvas.restore()
        }
        backgroundColor?.let { color ->
            fill.shader = null
            fill.color = color
            canvas.drawPath(shapePath, fill)
        }
        gradient?.let { shader ->
            fill.color = 0xFF000000.toInt()
            fill.shader = shader
            canvas.drawPath(shapePath, fill)
            fill.shader = null
        }
        if (insetShadows.isNotEmpty()) {
            canvas.save()
            canvas.clipPath(shapePath)
            for (shadow in insetShadows) drawBlurred(canvas, shadow)
            canvas.restore()
        }
        for (piece in borders) {
            if (piece.clip != null) {
                canvas.save()
                canvas.clipPath(piece.clip)
                canvas.drawPath(piece.path, piece.paint)
                canvas.restore()
            } else {
                canvas.drawPath(piece.path, piece.paint)
            }
        }
        outline?.let { canvas.drawPath(it.path, it.paint) }
    }

    private fun gradientShader(descriptor: PropValue, width: Float, height: Float): Shader? {
        val colors = descriptor["colors"]?.numbers ?: return null
        val stops = descriptor["stops"]?.numbers ?: return null
        if (colors.size < 2 || stops.size != colors.size) return null
        val colorInts = IntArray(colors.size) { rgbaColor(colors[it]) }
        val positions = FloatArray(stops.size) { stops[it].toFloat().coerceIn(0f, 1f) }
        for (index in 1 until positions.size) positions[index] = max(positions[index], positions[index - 1])
        fun point(key: String, x: Float, y: Float): Pair<Float, Float> {
            val values = descriptor[key]?.numbers
            return if (values?.size == 2) values[0].toFloat() to values[1].toFloat() else x to y
        }
        val (startX, startY) = point("start", 0.5f, 0f)
        if (descriptor["type"]?.string == "radial") {
            val radius = (descriptor["radius"]?.number ?: 0.5).toFloat()
            if (radius <= 0f || width <= 0f || height <= 0f) return null
            // In the unit box, so a radial gradient is elliptical on a non-square view.
            return RadialGradient(0f, 0f, 1f, colorInts, positions, Shader.TileMode.CLAMP).apply {
                setLocalMatrix(
                    Matrix().apply {
                        setScale(radius * width, radius * height)
                        postTranslate(startX * width, startY * height)
                    },
                )
            }
        }
        val (endX, endY) = point("end", 0.5f, 1f)
        return LinearGradient(
            startX * width,
            startY * height,
            endX * width,
            endY * height,
            colorInts,
            positions,
            Shader.TileMode.CLAMP,
        )
    }

    private fun updateBorders(props: Map<String, PropValue>, scale: Float) {
        borders.clear()
        val widths = props["borderWidths"]?.numbers?.map { max(0f, it.toFloat() * scale) }
        if (widths == null || widths.size != 4 || widths.none { it > 0f }) return
        val colorValues = props["borderColors"]?.numbers.orEmpty()
        val colors = IntArray(4) { rgbaColor(colorValues.getOrNull(it) ?: 0x000000FF.toDouble()) }
        val style = props["borderStyle"]?.string
        val sameWidth = widths.all { it == widths[0] }
        val sameColor = colors.all { it == colors[0] }
        val inner = shape.inset(widths[0], widths[1], widths[2], widths[3])
        if (style != null && sameWidth && sameColor) {
            // A dashed or dotted border, along the middle of its width.
            borders.add(BorderPiece(shape.outset(-widths[0] / 2).toPath(), strokePaint(colors[0], widths[0], style), null))
            return
        }
        val ring = Path().apply {
            fillType = Path.FillType.EVEN_ODD
            shape.addTo(this)
            inner.addTo(this)
        }
        if (sameColor) {
            borders.add(BorderPiece(ring, fillPaint(colors[0]), null))
            return
        }
        // Sides of different colours meet on the line from each outer corner to the matching
        // inner one, as in CSS.
        val outer = shape.rect
        val box = inner.rect
        val sides = listOf(
            floatArrayOf(outer.left, outer.top, outer.right, outer.top, box.right, box.top, box.left, box.top),
            floatArrayOf(outer.right, outer.top, outer.right, outer.bottom, box.right, box.bottom, box.right, box.top),
            floatArrayOf(outer.right, outer.bottom, outer.left, outer.bottom, box.left, box.bottom, box.right, box.bottom),
            floatArrayOf(outer.left, outer.bottom, outer.left, outer.top, box.left, box.top, box.left, box.bottom),
        )
        for ((index, polygon) in sides.withIndex()) {
            if (widths[index] <= 0f) continue
            val wedge = Path().apply {
                moveTo(polygon[0], polygon[1])
                lineTo(polygon[2], polygon[3])
                lineTo(polygon[4], polygon[5])
                lineTo(polygon[6], polygon[7])
                close()
            }
            borders.add(BorderPiece(ring, fillPaint(colors[index]), wedge))
        }
    }

    private fun updateOutline(descriptor: PropValue?, scale: Float) {
        val width = (descriptor?.get("width")?.number ?: 0.0).toFloat() * scale
        if (descriptor == null || width <= 0f) {
            outline = null
            return
        }
        val offset = (descriptor["offset"]?.number ?: 0.0).toFloat() * scale
        val color = descriptor["color"]?.color ?: 0xFF000000.toInt()
        outline = BorderPiece(
            shape.outset(offset + width / 2).toPath(),
            strokePaint(color, width, descriptor["style"]?.string),
            null,
        )
    }

    private fun fillPaint(color: Int) = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color }

    private fun strokePaint(color: Int, width: Float, style: String?) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color
        this.style = Paint.Style.STROKE
        strokeWidth = width
        when (style) {
            "dashed" -> pathEffect = DashPathEffect(floatArrayOf(width * 3, width * 3), 0f)
            "dotted" -> {
                strokeCap = Paint.Cap.ROUND
                pathEffect = DashPathEffect(floatArrayOf(0f, width * 2), 0f)
            }
        }
    }

    private fun drawBlurred(canvas: Canvas, shadow: Blurred) {
        val radius = blurMaskRadius(shadow.blur)
        if (radius > 0f && canvas.isHardwareAccelerated && Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
            // Hardware rendering before API 28 ignores mask filters: blur in software once.
            val bitmap = shadow.bitmap ?: renderBlur(shadow, radius)
            fill.shader = null
            fill.color = shadow.color
            canvas.drawBitmap(bitmap, null, shadow.bitmapBounds, fill)
            return
        }
        fill.shader = null
        fill.color = shadow.color
        fill.maskFilter = if (radius > 0f) BlurMaskFilter(radius, BlurMaskFilter.Blur.NORMAL) else null
        canvas.drawPath(shadow.path, fill)
        fill.maskFilter = null
    }

    /** [shadow]'s path blurred into an alpha bitmap, at most 1024 pixels on its longer side. */
    private fun renderBlur(shadow: Blurred, radius: Float): Bitmap {
        val bounds = RectF()
        shadow.path.computeBounds(bounds, true)
        val margin = shadow.blur * 1.5f + 2f
        bounds.inset(-margin, -margin)
        val factor = min(1f, 1024f / max(1f, max(bounds.width(), bounds.height())))
        val bitmap = Bitmap.createBitmap(
            max(1, ceil(bounds.width() * factor).toInt()),
            max(1, ceil(bounds.height() * factor).toInt()),
            Bitmap.Config.ALPHA_8,
        )
        Canvas(bitmap).apply {
            scale(factor, factor)
            translate(-bounds.left, -bounds.top)
            drawPath(
                shadow.path,
                Paint(Paint.ANTI_ALIAS_FLAG).apply { maskFilter = BlurMaskFilter(radius, BlurMaskFilter.Blur.NORMAL) },
            )
        }
        shadow.bitmap = bitmap
        shadow.bitmapBounds = bounds
        return bitmap
    }

    companion object {
        /** Clips [path] out of what [canvas] draws next. */
        @Suppress("DEPRECATION")
        fun clipOut(canvas: Canvas, path: Path) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                canvas.clipOutPath(path)
            } else {
                canvas.clipPath(path, Region.Op.DIFFERENCE)
            }
        }

        /**
         * The [BlurMaskFilter] radius of a CSS blur radius (twice the Gaussian's deviation); Skia
         * turns a mask radius `r` into the deviation `0.57735 r + 0.5`.
         */
        fun blurMaskRadius(cssBlur: Float): Float = max(0f, (cssBlur / 2 - 0.5f) / 0.57735f)
    }
}
