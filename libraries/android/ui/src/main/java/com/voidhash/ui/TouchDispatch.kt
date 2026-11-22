package com.voidhash.ui

import android.graphics.Matrix
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup

/** Pointer phases of `vhv_surface_pointer`. */
internal const val PHASE_DOWN = 0
internal const val PHASE_MOVE = 1
internal const val PHASE_UP = 2
internal const val PHASE_CANCEL = 3

/**
 * Hands a view group's touches to its subviews through their own [View.dispatchTouchEvent], in
 * their coordinates, choosing the subview by the views protocol's hit-testing instead of
 * Android's bounds check: subviews outside a parent that does not clip take touches, and
 * `pointerEvents` decides who may.
 *
 * Each pointer goes, when it goes down, to the subview the group picks for it; if that subview
 * does not take it, the group may take it itself (`onPress` and `onPointer` bubble to the
 * nearest view that has them), but never a subview beneath the picked one. A framework view
 * already holding a pointer keeps every new one it is picked for; a node view keeps only those it
 * takes. The subview then
 * gets every event of that pointer, so a framework scroll view inside receives genuine events and
 * cancels the views under the finger when it starts scrolling, as anywhere else.
 */
internal class TouchDispatch(private val group: ViewGroup) {
    /** Who has each pointer that is down, by pointer id: a subview, or [group] itself. */
    private val owners = HashMap<Int, View>()

    /**
     * Dispatches [event], in [group]'s pixels. [pick] names the subview a pointer going down at a
     * point goes to, if any; [own] handles the pointers [group] takes itself, in an event holding
     * only those, and returns whether it takes a pointer going down.
     */
    fun dispatch(event: MotionEvent, pick: (x: Float, y: Float) -> View?, own: ((MotionEvent) -> Boolean)?): Boolean {
        val action = event.actionMasked
        // The previous gesture ended without reaching this group.
        if (action == MotionEvent.ACTION_DOWN && owners.isNotEmpty()) cancel(event, own)
        val handled = when (action) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN -> down(event, pick, own)
            MotionEvent.ACTION_CANCEL -> owners.isNotEmpty().also { cancel(event, own) }
            else -> owners.isNotEmpty().also { for (owner in owners.values.distinct()) send(event, owner, own) }
        }
        when (action) {
            MotionEvent.ACTION_UP -> owners.clear()
            MotionEvent.ACTION_POINTER_UP -> owners.remove(event.getPointerId(event.actionIndex))
        }
        return handled
    }

    private fun down(event: MotionEvent, pick: (Float, Float) -> View?, own: ((MotionEvent) -> Boolean)?): Boolean {
        val index = event.actionIndex
        val id = event.getPointerId(index)
        val candidates = listOfNotNull(pick(event.getX(index), event.getY(index)), own?.let { group })
        for (candidate in candidates) {
            // A view already holding a pointer keeps the new one, as Android's view groups do,
            // unless it is a node view that refuses it: a text holding a link refuses a pointer
            // on its plain words, which goes to the view that would take it alone.
            val holding = owners.containsValue(candidate) && candidate !is NodeView
            owners[id] = candidate
            if (send(event, candidate, own) || holding) return true
            owners.remove(id)
        }
        return false
    }

    /** Cancels every pointer down here, in every owner: someone above took the touch. */
    fun cancel(event: MotionEvent, own: ((MotionEvent) -> Boolean)?) {
        val cancel = MotionEvent.obtain(event).apply { action = MotionEvent.ACTION_CANCEL }
        for (owner in owners.values.distinct()) send(cancel, owner, own, split = false)
        cancel.recycle()
        owners.clear()
    }

    /** Sends [owner] the part of [event] about its pointers, in its coordinates. */
    private fun send(event: MotionEvent, owner: View, own: ((MotionEvent) -> Boolean)?, split: Boolean = true): Boolean {
        val part = (if (split) split(event, owners.filterValues { it === owner }.keys) else MotionEvent.obtain(event)) ?: return false
        try {
            if (owner === group) return own?.invoke(part) ?: false
            part.offsetLocation((group.scrollX - owner.left).toFloat(), (group.scrollY - owner.top).toFloat())
            val matrix = owner.matrix
            if (!matrix.isIdentity) {
                val inverse = Matrix()
                if (matrix.invert(inverse)) part.transform(inverse)
            }
            return owner.dispatchTouchEvent(part)
        } finally {
            part.recycle()
        }
    }

    private companion object {
        /**
         * [event] with only the pointers [ids] names; `null` when it holds none of them, or
         * another pointer went down or up.
         */
        fun split(event: MotionEvent, ids: Set<Int>): MotionEvent? {
            val indices = (0 until event.pointerCount).filter { event.getPointerId(it) in ids }
            if (indices.isEmpty()) return null
            val masked = event.actionMasked
            val action = if (masked == MotionEvent.ACTION_POINTER_DOWN || masked == MotionEvent.ACTION_POINTER_UP) {
                val changed = event.getPointerId(event.actionIndex)
                if (changed !in ids) return null
                when {
                    indices.size == 1 -> if (masked == MotionEvent.ACTION_POINTER_DOWN) MotionEvent.ACTION_DOWN else MotionEvent.ACTION_UP
                    else -> masked or (indices.indexOfFirst { event.getPointerId(it) == changed } shl MotionEvent.ACTION_POINTER_INDEX_SHIFT)
                }
            } else {
                event.action
            }
            // All of them: a copy, which keeps the samples between events for velocity tracking.
            if (indices.size == event.pointerCount) return MotionEvent.obtain(event).apply { this.action = action }
            val properties = Array(indices.size) { MotionEvent.PointerProperties().also { p -> event.getPointerProperties(indices[it], p) } }
            val coordinates = Array(indices.size) { MotionEvent.PointerCoords().also { c -> event.getPointerCoords(indices[it], c) } }
            return MotionEvent.obtain(
                event.downTime,
                event.eventTime,
                action,
                indices.size,
                properties,
                coordinates,
                event.metaState,
                event.buttonState,
                event.xPrecision,
                event.yPrecision,
                event.deviceId,
                event.edgeFlags,
                event.source,
                event.flags,
            )
        }
    }
}
