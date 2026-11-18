package com.voidhash.ui.views

import android.graphics.Path
import android.graphics.RectF

/**
 * A rectangle with its own radii at each corner, elliptical where a border's widths differ on the
 * two sides of a corner: the shape of a view's border box, padding box and shadows.
 *
 * [radii] holds x and y of the top-left, top-right, bottom-right and bottom-left corners, as
 * [Path.addRoundRect] takes them; Skia scales radii that overlap on one side down together, as
 * CSS does.
 */
internal class RoundedRect(val rect: RectF, val radii: FloatArray) {
    /** Every corner square. */
    val isRectangle: Boolean
        get() = (0 until 4).all { radii[it * 2] <= 0f || radii[it * 2 + 1] <= 0f }

    /** The one circular radius of every corner, when they share one. */
    val uniformRadius: Float?
        get() = radii[0].takeIf { first -> radii.all { it == first } }

    /**
     * The shape grown by [amount] on every side (shrunk for a negative amount); rounded corners
     * keep following the outline, square ones stay square.
     */
    fun outset(amount: Float): RoundedRect {
        val grown = FloatArray(8)
        for (corner in 0 until 4) {
            val x = radii[corner * 2]
            val y = radii[corner * 2 + 1]
            if (x > 0f && y > 0f) {
                grown[corner * 2] = maxOf(0f, x + amount)
                grown[corner * 2 + 1] = maxOf(0f, y + amount)
            }
        }
        return RoundedRect(RectF(rect.left - amount, rect.top - amount, rect.right + amount, rect.bottom + amount), grown)
    }

    /** The shape moved by [dx], [dy]. */
    fun offset(dx: Float, dy: Float): RoundedRect =
        RoundedRect(RectF(rect).apply { offset(dx, dy) }, radii.copyOf())

    /**
     * The inner edge of a border of these widths: each corner's radius shrinks by the widths on
     * its two sides.
     */
    fun inset(top: Float, right: Float, bottom: Float, left: Float): RoundedRect {
        val inner = RectF(
            rect.left + left,
            rect.top + top,
            rect.left + left + maxOf(0f, rect.width() - left - right),
            rect.top + top + maxOf(0f, rect.height() - top - bottom),
        )
        val sides = floatArrayOf(left, top, right, top, right, bottom, left, bottom)
        return RoundedRect(inner, FloatArray(8) { maxOf(0f, radii[it] - sides[it]) })
    }

    /** Adds the outline, clockwise from the top-left corner, to [path]. */
    fun addTo(path: Path) {
        if (rect.width() <= 0f || rect.height() <= 0f) return
        if (isRectangle) {
            path.addRect(rect, Path.Direction.CW)
        } else {
            path.addRoundRect(rect, radii, Path.Direction.CW)
        }
    }

    fun toPath(): Path = Path().also(::addTo)

    companion object {
        /** [rect] with the `cornerRadii` prop's radii: top-left, top-right, bottom-right, bottom-left. */
        fun of(rect: RectF, cornerRadii: List<Double>, scale: Float): RoundedRect {
            val radii = FloatArray(8)
            for (corner in 0 until 4) {
                val radius = maxOf(0f, (cornerRadii.getOrNull(corner) ?: 0.0).toFloat() * scale)
                radii[corner * 2] = radius
                radii[corner * 2 + 1] = radius
            }
            return RoundedRect(rect, radii)
        }
    }
}
