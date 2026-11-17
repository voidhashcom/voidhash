// Adapted from the Flutter engine's Android embedder (ListenableEditingState.java and
// TextEditingDelta.java in shell/platform/android/io/flutter/plugin/editing).
// Copyright 2013 The Flutter Authors. All rights reserved.
// Use of the adapted parts is governed by the BSD-style license in THIRD_PARTY_NOTICES.md.

package com.voidhash.ui

import org.json.JSONObject

/**
 * The editing state of a text input: what the engine holds, as the keyboard client mirrors it.
 * Offsets are UTF-16 code units; a composing range of -1 means the input method composes nothing.
 *
 * The methods answer the state an input method's request would make of this one, with the
 * meaning Android's own editors give each request. They change nothing: the client sends the
 * difference to the engine and keeps whatever the engine then holds.
 */
internal data class TextEditingState(
    val text: String = "",
    val selectionBase: Int = 0,
    val selectionExtent: Int = 0,
    val composingStart: Int = -1,
    val composingEnd: Int = -1,
) {
    val selectionStart: Int get() = minOf(selectionBase, selectionExtent)
    val selectionEnd: Int get() = maxOf(selectionBase, selectionExtent)
    val hasComposing: Boolean get() = composingStart in 0 until composingEnd

    /** The text being composed, empty when there is none. */
    val composingText: String get() = if (hasComposing) text.substring(composingStart, composingEnd) else ""

    /**
     * `commitText` and `setComposingText`: [inserted] takes the place of the composing text, or of
     * the selection when nothing is composed, and is the new composing text when [composing].
     * [newCursorPosition] is the input method's: 1 puts the caret right after the inserted text
     * and greater values further on, 0 right before it and negative values further back.
     */
    fun inserting(inserted: String, newCursorPosition: Int, composing: Boolean): TextEditingState {
        val start = if (hasComposing) composingStart else selectionStart
        val end = if (hasComposing) composingEnd else selectionEnd
        val result = text.substring(0, start) + inserted + text.substring(end)
        val caret = if (newCursorPosition > 0) {
            start.toLong() + inserted.length + newCursorPosition - 1
        } else {
            start.toLong() + newCursorPosition
        }.coerceIn(0L, result.length.toLong()).toInt()
        val composes = composing && inserted.isNotEmpty()
        return TextEditingState(
            text = result,
            selectionBase = caret,
            selectionExtent = caret,
            composingStart = if (composes) start else -1,
            composingEnd = if (composes) start + inserted.length else -1,
        )
    }

    /** A typed key or a paste: [inserted] takes the selection's place and nothing is composed. */
    fun replacingSelection(inserted: String): TextEditingState {
        val caret = selectionStart + inserted.length
        return TextEditingState(
            text = text.substring(0, selectionStart) + inserted + text.substring(selectionEnd),
            selectionBase = caret,
            selectionExtent = caret,
        )
    }

    /**
     * `deleteSurroundingText`: removes [before] code units before the selection and [after]
     * after it, leaving the selection and the composing text. A count that would cut a surrogate
     * pair in half takes the whole pair.
     */
    fun deletingSurrounding(before: Int, after: Int): TextEditingState {
        val (start, end) = surroundedRange()
        var state = this
        if (after > 0) {
            var until = (end.toLong() + after).coerceAtMost(text.length.toLong()).toInt()
            if (splitsPair(until)) until += 1
            state = state.replacing(end, until, "")
        }
        if (before > 0) {
            var from = (start - before).coerceAtLeast(0)
            if (splitsPair(from)) from -= 1
            state = state.replacing(from, start, "")
        }
        return state
    }

    /** `deleteSurroundingTextInCodePoints`: as [deletingSurrounding], counting code points. */
    fun deletingSurroundingCodePoints(before: Int, after: Int): TextEditingState {
        val (start, end) = surroundedRange()
        var from = start
        repeat(before.coerceAtLeast(0)) {
            if (from > 0) from -= Character.charCount(text.codePointBefore(from))
        }
        var until = end
        repeat(after.coerceAtLeast(0)) {
            if (until < text.length) until += Character.charCount(text.codePointAt(until))
        }
        return replacing(end, until, "").replacing(from, start, "")
    }

    /** `setSelection`. A range outside the text is ignored, as Android's editors do. */
    fun selecting(start: Int, end: Int): TextEditingState =
        if (start !in 0..text.length || end !in 0..text.length) {
            this
        } else {
            copy(selectionBase = start, selectionExtent = end)
        }

    /** `setComposingRegion`: makes existing text the composing text; an empty range ends it. */
    fun composingRegion(start: Int, end: Int): TextEditingState {
        val from = minOf(start, end).coerceIn(0, text.length)
        val until = maxOf(start, end).coerceIn(0, text.length)
        return if (from == until) finishingComposing() else copy(composingStart = from, composingEnd = until)
    }

    /** `finishComposingText`: the composing text stays as it is and is no longer composed. */
    fun finishingComposing(): TextEditingState = copy(composingStart = -1, composingEnd = -1)

    /**
     * The edit that turns this state's text into [next]'s: the smallest single range that
     * differs, never ending inside a surrogate pair. `null` when the texts are the same.
     */
    fun editTo(next: TextEditingState): TextEdit? {
        val from = text
        val to = next.text
        if (from == to) return null
        var prefix = 0
        val shortest = minOf(from.length, to.length)
        while (prefix < shortest && from[prefix] == to[prefix]) prefix += 1
        if (prefix > 0 && Character.isHighSurrogate(from[prefix - 1])) prefix -= 1
        var suffix = 0
        while (
            suffix < shortest - prefix &&
            from[from.length - 1 - suffix] == to[to.length - 1 - suffix]
        ) {
            suffix += 1
        }
        if (suffix > 0 && Character.isLowSurrogate(from[from.length - suffix])) suffix -= 1
        return TextEdit(prefix, from.length - suffix, to.substring(prefix, to.length - suffix))
    }

    /** The selection widened by the composing text, which a surrounding delete leaves alone. */
    private fun surroundedRange(): Pair<Int, Int> =
        if (hasComposing) {
            minOf(selectionStart, composingStart) to maxOf(selectionEnd, composingEnd)
        } else {
            selectionStart to selectionEnd
        }

    private fun splitsPair(offset: Int): Boolean =
        offset in 1 until text.length &&
            Character.isLowSurrogate(text[offset]) &&
            Character.isHighSurrogate(text[offset - 1])

    /** Replaces [start]..[end], moving the selection and the composing range along with the text. */
    private fun replacing(start: Int, end: Int, replacement: String): TextEditingState {
        if (start == end && replacement.isEmpty()) return this
        fun moved(offset: Int): Int = when {
            offset < 0 -> offset
            offset <= start -> offset
            offset >= end -> offset - (end - start) + replacement.length
            else -> start + replacement.length
        }
        val composingFrom = moved(composingStart)
        val composingUntil = moved(composingEnd)
        val composes = composingFrom in 0 until composingUntil
        return TextEditingState(
            text = text.substring(0, start) + replacement + text.substring(end),
            selectionBase = moved(selectionBase),
            selectionExtent = moved(selectionExtent),
            composingStart = if (composes) composingFrom else -1,
            composingEnd = if (composes) composingUntil else -1,
        )
    }

    companion object {
        /** The state a `textState` payload carries, with offsets brought inside the text. */
        fun fromPayload(payload: JSONObject): TextEditingState {
            val text = payload.optString("text")
            val composingStart = payload.optInt("composingStart", -1)
            val composingEnd = payload.optInt("composingEnd", -1)
            val composes = composingStart in 0 until composingEnd && composingEnd <= text.length
            return TextEditingState(
                text = text,
                selectionBase = payload.optInt("selectionBase").coerceIn(0, text.length),
                selectionExtent = payload.optInt("selectionExtent").coerceIn(0, text.length),
                composingStart = if (composes) composingStart else -1,
                composingEnd = if (composes) composingEnd else -1,
            )
        }
    }
}

/** One replacement of [start]..[end] (UTF-16 code units of the text before it) with [text]. */
internal data class TextEdit(val start: Int, val end: Int, val text: String)
