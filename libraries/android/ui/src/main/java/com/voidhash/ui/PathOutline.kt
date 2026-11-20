package com.voidhash.ui

import android.graphics.Path
import android.graphics.PathMeasure

/**
 * A path's outline measured for trimming (views protocol, "Paths"): its contours in path order,
 * each as an open line along its whole length, a closed contour's ending with its closing
 * segment.
 *
 * Measuring walks the curves once; [trimmed] then only cuts the measured contours, cheap enough
 * for a trim that animates on every frame.
 */
internal class PathOutline(
    /** The path as given, drawn when it is not trimmed. */
    val path: Path,
) {
    private val contours = ArrayList<PathMeasure>()
    private val lengths = ArrayList<Float>()
    private val length: Float

    init {
        val measure = PathMeasure(path, false)
        do {
            val contourLength = measure.length
            if (contourLength > 0f) {
                // The whole contour as an open line: a closed one ends at its start.
                val open = Path()
                measure.getSegment(0f, contourLength, open, true)
                contours.add(PathMeasure(open, false))
                lengths.add(contourLength)
            }
        } while (measure.nextContour())
        length = lengths.sum()
    }

    /**
     * The stretch of the outline from [start] to [end], fractions of its whole length, as open
     * lines: one per contour it reaches. Empty when [end] is not past [start].
     */
    fun trimmed(start: Float, end: Float): Path {
        val out = Path()
        if (length <= 0f || end <= start) return out
        val from = start * length
        val to = end * length
        var walked = 0f
        for ((index, contour) in contours.withIndex()) {
            val low = walked
            val high = walked + lengths[index]
            walked = high
            if (high <= from || low >= to) continue
            contour.getSegment(maxOf(from, low) - low, minOf(to, high) - low, out, true)
            if (walked >= to) break
        }
        return out
    }
}
