package com.voidhash.ui.views

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import kotlin.math.max
import kotlin.math.min

/**
 * Draws a canvas draw list (guest ABI 1, "Canvases and draw lists") with [Canvas].
 *
 * The canvas is in the view's logical pixels with the origin at its top-left corner. Opacity (op
 * 12) multiplies into colours and images and is saved and restored with the canvas state, as the
 * engine draws it. The core validated the list; a truncated command ends it, and saves it leaves
 * open are restored after it.
 */
internal object DrawList {
    fun draw(list: ByteArray, canvas: Canvas, images: (Int) -> Bitmap?, fonts: FontRegistry) {
        val reader = ByteReader(list)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
        var alpha = 1f
        val saved = ArrayList<Float>()
        val base = canvas.save()
        try {
            while (true) {
                val code = reader.u8() ?: return
                when (code) {
                    1 -> {
                        val x = reader.f32() ?: return
                        val y = reader.f32() ?: return
                        val w = reader.f32() ?: return
                        val h = reader.f32() ?: return
                        val color = reader.u32() ?: return
                        fill(paint, color, alpha)
                        canvas.drawRect(RectF(x, y, x + w, y + h).sorted(), paint)
                    }
                    2 -> {
                        val x = reader.f32() ?: return
                        val y = reader.f32() ?: return
                        val w = reader.f32() ?: return
                        val h = reader.f32() ?: return
                        val radius = reader.f32() ?: return
                        val color = reader.u32() ?: return
                        val rect = RectF(x, y, x + w, y + h).sorted()
                        val corner = min(max(0f, radius), min(rect.width() / 2, rect.height() / 2))
                        fill(paint, color, alpha)
                        canvas.drawRoundRect(rect, corner, corner, paint)
                    }
                    3 -> {
                        val cx = reader.f32() ?: return
                        val cy = reader.f32() ?: return
                        val radius = reader.f32() ?: return
                        val color = reader.u32() ?: return
                        fill(paint, color, alpha)
                        canvas.drawCircle(cx, cy, max(0f, radius), paint)
                    }
                    4 -> {
                        val x1 = reader.f32() ?: return
                        val y1 = reader.f32() ?: return
                        val x2 = reader.f32() ?: return
                        val y2 = reader.f32() ?: return
                        val width = reader.f32() ?: return
                        val color = reader.u32() ?: return
                        fill(paint, color, alpha)
                        paint.style = Paint.Style.STROKE
                        paint.strokeWidth = width
                        paint.strokeCap = Paint.Cap.BUTT
                        canvas.drawLine(x1, y1, x2, y2, paint)
                    }
                    5 -> {
                        val index = reader.u16() ?: return
                        val x = reader.f32() ?: return
                        val y = reader.f32() ?: return
                        val w = reader.f32() ?: return
                        val h = reader.f32() ?: return
                        val opacity = reader.f32() ?: return
                        images(index)?.let { drawImage(canvas, it, RectF(x, y, x + w, y + h), opacity * alpha, paint) }
                    }
                    6 -> {
                        val x = reader.f32() ?: return
                        val y = reader.f32() ?: return
                        val size = reader.f32() ?: return
                        val color = reader.u32() ?: return
                        val length = reader.u16() ?: return
                        val range = reader.take(length.toLong()) ?: return
                        val text = String(list, range.first, range.last - range.first + 1, Charsets.UTF_8)
                        if (size > 0f && text.isNotEmpty()) {
                            // One line in the default font, its baseline at the point.
                            val font = fonts.resolve("", 400, false)
                            val textPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.SUBPIXEL_TEXT_FLAG).apply {
                                typeface = font.typeface
                                textSize = size
                                this.color = drawColor(color, alpha)
                            }
                            canvas.drawText(text, x, y, textPaint)
                        }
                    }
                    7 -> {
                        canvas.save()
                        saved.add(alpha)
                    }
                    8 -> if (saved.isNotEmpty()) {
                        canvas.restore()
                        alpha = saved.removeAt(saved.lastIndex)
                    }
                    9 -> {
                        val x = reader.f32() ?: return
                        val y = reader.f32() ?: return
                        canvas.translate(x, y)
                    }
                    10 -> canvas.rotate(Math.toDegrees((reader.f32() ?: return).toDouble()).toFloat())
                    11 -> {
                        val sx = reader.f32() ?: return
                        val sy = reader.f32() ?: return
                        canvas.scale(sx, sy)
                    }
                    12 -> alpha *= (reader.f32() ?: return).coerceIn(0f, 1f)
                    13 -> {
                        val index = reader.u16() ?: return
                        val count = reader.u32() ?: return
                        if (count > reader.remaining / 20) return
                        val image = images(index)
                        for (sprite in 0 until count) {
                            val x = reader.f32() ?: return
                            val y = reader.f32() ?: return
                            val side = reader.f32() ?: return
                            val rotation = reader.f32() ?: return
                            val opacity = reader.f32() ?: return
                            image ?: continue
                            canvas.save()
                            canvas.translate(x, y)
                            canvas.rotate(Math.toDegrees(rotation.toDouble()).toFloat())
                            drawImage(canvas, image, RectF(-side / 2, -side / 2, side / 2, side / 2), opacity * alpha, paint)
                            canvas.restore()
                        }
                    }
                    // Not an operation of ABI 1: nothing after it can be read.
                    else -> return
                }
            }
        } finally {
            canvas.restoreToCount(base)
        }
    }

    /** `0xRRGGBBAA` with straight alpha, its alpha multiplied by [alpha]. */
    fun drawColor(rgba: Long, alpha: Float): Int = withAlpha(rgbaColor(rgba.toDouble()), alpha)

    private fun fill(paint: Paint, rgba: Long, alpha: Float) {
        paint.reset()
        paint.flags = Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG
        paint.color = drawColor(rgba, alpha)
    }

    private fun drawImage(canvas: Canvas, image: Bitmap, rect: RectF, alpha: Float, paint: Paint) {
        if (alpha <= 0f) return
        paint.reset()
        paint.flags = Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG
        paint.alpha = (min(alpha, 1f) * 255 + 0.5f).toInt()
        canvas.drawBitmap(image, null, rect, paint)
    }

    private fun RectF.sorted(): RectF = apply { sort() }
}
