// Adapted from the Flutter engine's Android embedder (TextInputPlugin.java and
// InputConnectionAdaptor.java in shell/platform/android/io/flutter/plugin/editing).
// Copyright 2013 The Flutter Authors. All rights reserved.
// Use of the adapted parts is governed by the BSD-style license in THIRD_PARTY_NOTICES.md.

package com.voidhash.ui

import android.os.Bundle
import android.os.Handler
import android.text.TextUtils
import android.view.KeyCharacterMap
import android.view.KeyEvent
import android.view.inputmethod.CompletionInfo
import android.view.inputmethod.CorrectionInfo
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.ExtractedText
import android.view.inputmethod.ExtractedTextRequest
import android.view.inputmethod.InputConnection
import android.view.inputmethod.InputContentInfo
import org.json.JSONException
import org.json.JSONObject

/** What the keyboard client asks of Android; [ViewTextInputPlatform] is the view's. */
internal interface TextInputPlatform {
    fun showKeyboard()

    fun hideKeyboard()

    /** Makes the input method connect again, to the input and configuration held by then. */
    fun restartInput()

    fun updateSelection(selectionStart: Int, selectionEnd: Int, composingStart: Int, composingEnd: Int)

    fun updateExtractedText(token: Int, text: ExtractedText)

    fun updateCursorAnchor(anchor: CursorAnchor)

    fun copyToClipboard(text: String)

    fun clipboardText(): String?

    /** An input an autofill service may fill took the keyboard; [bounds] as the engine gives them. */
    fun autofillEntered(client: Int, bounds: List<Float>?)

    fun autofillExited(client: Int)

    fun autofillValueChanged(client: Int, text: String)
}

/**
 * Where an input method places what it draws near the text: the caret and each composed
 * character, as `[x, y, width, height]` in dp of the surface.
 */
internal data class CursorAnchor(
    val state: TextEditingState,
    val caret: List<Float>?,
    val characterBounds: Map<Int, List<Float>>,
)

/** Composed characters past this many get no bounds: each costs a call into the engine. */
private const val MAX_ANCHORED_CHARACTERS = 64

private const val COMPOSING_SET = 1
private const val COMPOSING_CLEAR = 2

private const val KEY_A = 4
private const val KEY_BACKSPACE = 42
private const val KEY_HOME = 74
private const val KEY_DELETE = 76
private const val KEY_END = 77
private const val KEY_RIGHT = 79
private const val KEY_LEFT = 80
private const val KEY_DOWN = 81
private const val KEY_UP = 82

private const val MODIFIER_SHIFT = 1
private const val MODIFIER_CONTROL = 2
private const val MODIFIER_ALT = 4
private const val MODIFIER_COMMAND = 8

/**
 * The keyboard client of a paywall surface.
 *
 * The engine holds the text of the input that has the keyboard, its selection and its composing
 * range. This client stands between it and Android's input method: it shows and hides the
 * keyboard as the engine says (`textInput`), turns each request of the input method into one edit
 * of the engine's text, and keeps a copy of the engine's editing state for the input method to
 * read. The copy is only ever what the engine reported or answered: an edit is sent to the engine
 * first and the copy becomes what the engine then holds, which may not be what was asked for (an
 * input with a maximum length cuts text short). Requests an input method groups in a batch become
 * a single edit.
 *
 * Nothing here is logged: the text may be a password. Main thread only.
 *
 * @param engine the text input of the surface's renderer, while there is one.
 * @param requestFrame the engine changed what it shows.
 * @param onStateChanged the mirrored editing state of the input changed from the first to the
 *   second, by an edit or by the engine; the accessibility bridge reports it.
 */
internal class PaywallTextInput(
    private val engine: () -> TextEngine?,
    private val platform: TextInputPlatform,
    private val requestFrame: () -> Unit,
    private val onStateChanged: (previous: TextEditingState, next: TextEditingState) -> Unit = { _, _ -> },
) {
    /** The input that has the keyboard: its package node, as the engine names it. */
    var client: Int? = null
        private set

    var config: TextInputConfig? = null
        private set

    /** The engine's editing state, as last reported or answered. */
    var state = TextEditingState()
        private set

    val isActive: Boolean get() = client != null

    private var revision = -1L

    /** What the requests of an open batch make of [state], until the batch ends. */
    private var pending: TextEditingState? = null
    private var batchDepth = 0
    private var connection: Connection? = null
    private var extractToken: Int? = null
    private var monitorsCursor = false
    private var sentAnchor: CursorAnchor? = null

    /** Whether Android's keyboard is on screen, as far as the window's insets tell. */
    var keyboardVisible = false
        private set

    /** The input autofill was told it may fill, which it is told again when that ends. */
    private var autofillClient: Int? = null

    /** Handles a `textInput` or `textState` message of the surface. */
    fun onMessage(type: String, payload: JSONObject) {
        when (type) {
            "textInput" -> onTextInput(payload)
            "textState" -> onTextState(payload)
        }
    }

    /** Sets up the input method for the input that has the keyboard, or `null` when none has. */
    fun createInputConnection(outAttrs: EditorInfo): InputConnection? {
        val config = config ?: return null
        endConnection()
        outAttrs.inputType = config.inputType
        outAttrs.imeOptions = config.imeOptions
        outAttrs.initialSelStart = state.selectionStart
        outAttrs.initialSelEnd = state.selectionEnd
        outAttrs.initialCapsMode = TextUtils.getCapsMode(state.text, state.selectionStart, config.inputType)
        return Connection().also { connection = it }
    }

    /**
     * A key of a hardware keyboard, or one an input method sent as a key event. Returns whether
     * the input used it.
     *
     * The engine's shortcuts follow another platform's conventions, so Android's are translated:
     * Control moves by word (the engine's alt) and Alt to the ends of the line (its command).
     */
    fun handleKey(event: KeyEvent): Boolean {
        val config = config ?: return false
        if (event.action != KeyEvent.ACTION_DOWN) return false
        val shortcut = event.isCtrlPressed || event.isMetaPressed
        val usage = when (event.keyCode) {
            KeyEvent.KEYCODE_DEL -> KEY_BACKSPACE
            KeyEvent.KEYCODE_FORWARD_DEL -> KEY_DELETE
            KeyEvent.KEYCODE_DPAD_LEFT -> KEY_LEFT
            KeyEvent.KEYCODE_DPAD_RIGHT -> KEY_RIGHT
            KeyEvent.KEYCODE_DPAD_UP -> KEY_UP
            KeyEvent.KEYCODE_DPAD_DOWN -> KEY_DOWN
            KeyEvent.KEYCODE_MOVE_HOME -> KEY_HOME
            KeyEvent.KEYCODE_MOVE_END -> KEY_END
            else -> null
        }
        when {
            usage != null -> {
                var modifiers = 0
                if (event.isShiftPressed) modifiers = modifiers or MODIFIER_SHIFT
                if (event.isCtrlPressed) modifiers = modifiers or MODIFIER_CONTROL or MODIFIER_ALT
                if (event.isAltPressed || event.isMetaPressed) modifiers = modifiers or MODIFIER_COMMAND
                return act { it.textKey(usage, modifiers) }
            }
            event.keyCode == KeyEvent.KEYCODE_ENTER || event.keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER ->
                return act { it.textAction(config.returnAction) }
            shortcut -> return when (event.keyCode) {
                KeyEvent.KEYCODE_A -> act { it.textKey(KEY_A, MODIFIER_COMMAND) }
                KeyEvent.KEYCODE_Z -> act { if (event.isShiftPressed) it.textRedo() else it.textUndo() }
                KeyEvent.KEYCODE_Y -> act { it.textRedo() }
                KeyEvent.KEYCODE_C -> contextMenuAction(android.R.id.copy)
                KeyEvent.KEYCODE_X -> contextMenuAction(android.R.id.cut)
                KeyEvent.KEYCODE_V -> contextMenuAction(android.R.id.paste)
                else -> false
            }
        }
        val character = event.unicodeChar
        // Accents that combine with the next key are the input method's to compose.
        if (character < 0x20 || character and KeyCharacterMap.COMBINING_ACCENT != 0) return false
        val typed = String(Character.toChars(character))
        edit { it.replacingSelection(typed) }
        return true
    }

    /**
     * Whether Android's keyboard is on screen. One that goes away while an input has it was
     * dismissed by the end user (the back button, the keyboard's own key), so the input gives
     * the keyboard up.
     */
    fun keyboardVisibilityChanged(visible: Boolean) {
        val dismissed = keyboardVisible && !visible && client != null
        keyboardVisible = visible
        if (dismissed) blur()
    }

    /** Takes the keyboard from the input; the engine answers with a `textInput` without a client. */
    fun blur() {
        if (client == null) return
        engine()?.textBlur()
        requestFrame()
    }

    /** Selects [start]..[end] of the input's text, as assistive technology asks; offsets out of the text change nothing. */
    fun select(start: Int, end: Int) = edit { it.selecting(start, end) }

    /** An autofill service filled the input [filledClient] with [text]. */
    fun autofill(filledClient: Int, text: String) {
        if (filledClient != client) return
        flush()
        pending = TextEditingState(text, text.length, text.length)
        flush()
    }

    /**
     * Tells an input method that follows the caret where it is now. Called after each frame, as
     * the caret also moves when the flow scrolls or the keyboard pushes the input up.
     */
    fun afterFrame() {
        if (!monitorsCursor || client == null) return
        val anchor = cursorAnchor() ?: return
        if (anchor == sentAnchor) return
        sentAnchor = anchor
        platform.updateCursorAnchor(anchor)
    }

    private fun onTextInput(payload: JSONObject) {
        val nextConfig = payload.optJSONObject("config")?.let(TextInputConfig::fromPayload)
        if (payload.isNull("client") || nextConfig == null) return clear()
        val next = payload.optInt("client")
        if (next == client && nextConfig == config) return
        val previous = client
        if (previous != next) exitAutofill()
        endConnection(discard = previous != next)
        client = next
        config = nextConfig
        revision = -1L
        state = TextEditingState()
        // The input method reads the selection as it connects, before `textState` is handled.
        readEngineState()?.let { (held, heldRevision) ->
            state = held
            revision = heldRevision
        }
        // The view takes the focus first: only the focused view's input method can be restarted.
        platform.showKeyboard()
        platform.restartInput()
        if (autofillClient == null && nextConfig.autofillHint != null) {
            autofillClient = next
            platform.autofillEntered(next, engine()?.textBounds()?.toList())
        }
    }

    private fun clear() {
        if (client == null) return
        endConnection(discard = true)
        client = null
        config = null
        revision = -1L
        state = TextEditingState()
        platform.hideKeyboard()
        // Drops the connection, and with it what an input method keeps of the text.
        platform.restartInput()
        exitAutofill()
    }

    private fun exitAutofill() {
        autofillClient?.let(platform::autofillExited)
        autofillClient = null
    }

    private fun onTextState(payload: JSONObject) {
        if (client == null || payload.optInt("client", -1) != client) return
        // Queued before an edit made since: the answer to that edit is newer.
        val reported = payload.optLong("revision", -1L)
        if (reported < revision) return
        revision = reported
        adopt(TextEditingState.fromPayload(payload), expected = null)
    }

    /** The engine's editing state and its revision, when the input this client serves has the keyboard. */
    private fun readEngineState(): Pair<TextEditingState, Long>? {
        val json = engine()?.textState() ?: return null
        val payload = try {
            JSONObject(json)
        } catch (error: JSONException) {
            return null
        }
        if (payload.optInt("client", -1) != client) return null
        return TextEditingState.fromPayload(payload) to payload.optLong("revision", -1L)
    }

    /** Applies a request of the input method, now or when its batch ends. */
    private fun edit(change: (TextEditingState) -> TextEditingState) {
        if (client == null) return
        pending = change(pending ?: state)
        if (batchDepth == 0) flush()
    }

    /** Sends what the requests since the last flush made of the text to the engine, as one edit. */
    private fun flush() {
        val next = pending ?: return
        pending = null
        if (next == state) return
        val engine = engine() ?: return
        val edit = state.editTo(next)
        when {
            edit != null -> engine.textReplace(
                edit.start,
                edit.end,
                edit.text,
                next.selectionBase,
                next.selectionExtent,
                if (next.hasComposing) COMPOSING_SET else COMPOSING_CLEAR,
                next.composingStart.coerceAtLeast(0),
                next.composingEnd.coerceAtLeast(0),
            )
            // The engine's selection call ends the composition, so it serves only without one.
            !next.hasComposing -> engine.textSetSelection(next.selectionBase, next.selectionExtent)
            else -> engine.textReplace(
                next.composingStart,
                next.composingStart,
                "",
                next.selectionBase,
                next.selectionExtent,
                COMPOSING_SET,
                next.composingStart,
                next.composingEnd,
            )
        }
        requestFrame()
        syncFromEngine(expected = next)
    }

    /** Runs something that changes the engine's text by itself, and takes over what it made of it. */
    private fun act(action: (TextEngine) -> Boolean): Boolean {
        flush()
        val engine = engine() ?: return false
        val handled = action(engine)
        requestFrame()
        syncFromEngine(expected = null)
        return handled
    }

    private fun syncFromEngine(expected: TextEditingState?) {
        // No answer: the edit made the input give up the keyboard, and a `textInput` says so next.
        val (held, heldRevision) = readEngineState() ?: return
        revision = maxOf(revision, heldRevision)
        adopt(held, expected)
    }

    /**
     * Makes [next] the mirrored state and tells the input method, which is owed every change of
     * the selection, its own included.
     *
     * @param expected what the input method's own request asked for, or `null` when the change
     *   is the engine's. An input method composing text the engine did not keep as asked is
     *   restarted, as it would go on composing text that is not there.
     */
    private fun adopt(next: TextEditingState, expected: TextEditingState?) {
        val previous = state
        if (next == previous) return
        state = next
        // Requests based on what the engine no longer holds cannot be applied to what it holds now.
        pending = null
        val composing = expected ?: previous
        val composingLost = composing.hasComposing && (
            next.composingStart != composing.composingStart ||
                next.composingEnd != composing.composingEnd ||
                next.composingText != composing.composingText
            )
        if (composingLost) {
            platform.restartInput()
        } else {
            platform.updateSelection(next.selectionStart, next.selectionEnd, next.composingStart, next.composingEnd)
        }
        extractToken?.let { token -> platform.updateExtractedText(token, extractedText()) }
        if (next.text != previous.text) autofillClient?.let { platform.autofillValueChanged(it, next.text) }
        onStateChanged(previous, next)
    }

    /**
     * Select all, cut, copy or paste (`android.R.id`), from a hardware key, an input method or
     * assistive technology. Returns whether the id is one of those.
     */
    fun contextMenuAction(id: Int): Boolean {
        val shown = pending ?: state
        val selected = shown.text.substring(shown.selectionStart, shown.selectionEnd)
        // A secure input's text never leaves it for the clipboard.
        val copies = selected.isNotEmpty() && config?.secure == false
        when (id) {
            android.R.id.selectAll -> edit { it.selecting(0, it.text.length) }
            android.R.id.copy -> if (copies) platform.copyToClipboard(selected)
            android.R.id.cut -> if (copies) {
                platform.copyToClipboard(selected)
                edit { it.replacingSelection("") }
            }
            android.R.id.paste -> platform.clipboardText()?.let { pasted -> edit { it.replacingSelection(pasted) } }
            else -> return false
        }
        return true
    }

    private fun extractedText(): ExtractedText {
        val shown = pending ?: state
        return ExtractedText().apply {
            startOffset = 0
            partialStartOffset = -1
            partialEndOffset = -1
            selectionStart = shown.selectionStart
            selectionEnd = shown.selectionEnd
            text = shown.text
        }
    }

    private fun cursorAnchor(): CursorAnchor? {
        val engine = engine() ?: return null
        val shown = state
        val bounds = LinkedHashMap<Int, List<Float>>()
        if (shown.hasComposing) {
            val last = minOf(shown.composingEnd, shown.composingStart + MAX_ANCHORED_CHARACTERS)
            for (index in shown.composingStart until last) {
                val rects = engine.textRectsForRange(index, index + 1) ?: continue
                if (rects.size >= 4) bounds[index] = rects.take(4)
            }
        }
        return CursorAnchor(shown, engine.textCaretRect(shown.selectionExtent)?.toList(), bounds)
    }

    /**
     * Ends the connection an input method holds. What it still had in a batch is sent, unless
     * the input it was meant for no longer has the keyboard ([discard]).
     */
    private fun endConnection(discard: Boolean = false) {
        batchDepth = 0
        if (discard) pending = null
        flush()
        connection = null
        extractToken = null
        monitorsCursor = false
        sentAnchor = null
    }

    /**
     * What an input method talks to. One that was replaced, because another input took the
     * keyboard or the input method reconnected, does nothing.
     */
    private inner class Connection : InputConnection {
        private val isCurrent: Boolean get() = connection === this

        private val shown: TextEditingState get() = pending ?: state

        private fun request(change: (TextEditingState) -> TextEditingState): Boolean {
            if (!isCurrent) return false
            edit(change)
            return true
        }

        override fun getTextBeforeCursor(n: Int, flags: Int): CharSequence? {
            if (!isCurrent) return null
            val shown = shown
            return shown.text.substring((shown.selectionStart - n.coerceAtLeast(0)).coerceAtLeast(0), shown.selectionStart)
        }

        override fun getTextAfterCursor(n: Int, flags: Int): CharSequence? {
            if (!isCurrent) return null
            val shown = shown
            val end = (shown.selectionEnd.toLong() + n.coerceAtLeast(0)).coerceAtMost(shown.text.length.toLong())
            return shown.text.substring(shown.selectionEnd, end.toInt())
        }

        override fun getSelectedText(flags: Int): CharSequence? {
            if (!isCurrent) return null
            val shown = shown
            if (shown.selectionStart == shown.selectionEnd) return null
            return shown.text.substring(shown.selectionStart, shown.selectionEnd)
        }

        override fun getCursorCapsMode(reqModes: Int): Int {
            if (!isCurrent) return 0
            val shown = shown
            return TextUtils.getCapsMode(shown.text, shown.selectionStart, reqModes)
        }

        override fun getExtractedText(request: ExtractedTextRequest?, flags: Int): ExtractedText? {
            if (!isCurrent) return null
            extractToken = if (flags and InputConnection.GET_EXTRACTED_TEXT_MONITOR != 0) request?.token ?: 0 else null
            return extractedText()
        }

        override fun deleteSurroundingText(beforeLength: Int, afterLength: Int): Boolean =
            request { it.deletingSurrounding(beforeLength, afterLength) }

        override fun deleteSurroundingTextInCodePoints(beforeLength: Int, afterLength: Int): Boolean =
            request { it.deletingSurroundingCodePoints(beforeLength, afterLength) }

        override fun setComposingText(text: CharSequence?, newCursorPosition: Int): Boolean =
            request { it.inserting(text?.toString().orEmpty(), newCursorPosition, composing = true) }

        override fun setComposingRegion(start: Int, end: Int): Boolean =
            request { it.composingRegion(start, end) }

        override fun finishComposingText(): Boolean = request { it.finishingComposing() }

        override fun commitText(text: CharSequence?, newCursorPosition: Int): Boolean =
            request { it.inserting(text?.toString().orEmpty(), newCursorPosition, composing = false) }

        override fun commitCompletion(text: CompletionInfo?): Boolean = false

        override fun commitCorrection(correctionInfo: CorrectionInfo?): Boolean = false

        override fun setSelection(start: Int, end: Int): Boolean = request { it.selecting(start, end) }

        override fun performEditorAction(editorAction: Int): Boolean {
            val config = config
            if (!isCurrent || config == null) return false
            val action = when (editorAction) {
                EditorInfo.IME_ACTION_NONE -> "newline"
                EditorInfo.IME_ACTION_NEXT -> "next"
                EditorInfo.IME_ACTION_GO -> "go"
                EditorInfo.IME_ACTION_SEARCH -> "search"
                EditorInfo.IME_ACTION_SEND -> "send"
                EditorInfo.IME_ACTION_DONE -> "done"
                // An input method that names no action pressed the key as it is configured.
                else -> config.returnAction
            }
            act { it.textAction(action) }
            return true
        }

        override fun performContextMenuAction(id: Int): Boolean = isCurrent && contextMenuAction(id)

        override fun beginBatchEdit(): Boolean {
            if (!isCurrent) return false
            batchDepth += 1
            return true
        }

        override fun endBatchEdit(): Boolean {
            if (!isCurrent || batchDepth == 0) return false
            batchDepth -= 1
            if (batchDepth == 0) flush()
            return batchDepth > 0
        }

        override fun sendKeyEvent(event: KeyEvent?): Boolean {
            if (!isCurrent || event == null) return false
            handleKey(event)
            return true
        }

        override fun clearMetaKeyStates(states: Int): Boolean = isCurrent

        override fun reportFullscreenMode(enabled: Boolean): Boolean = false

        override fun performPrivateCommand(action: String?, data: Bundle?): Boolean = false

        override fun requestCursorUpdates(cursorUpdateMode: Int): Boolean {
            if (!isCurrent) return false
            monitorsCursor = cursorUpdateMode and InputConnection.CURSOR_UPDATE_MONITOR != 0
            if (cursorUpdateMode and InputConnection.CURSOR_UPDATE_IMMEDIATE != 0) {
                cursorAnchor()?.let { anchor ->
                    sentAnchor = anchor
                    platform.updateCursorAnchor(anchor)
                }
            }
            if (monitorsCursor) requestFrame()
            return true
        }

        override fun getHandler(): Handler? = null

        override fun closeConnection() {
            if (isCurrent) endConnection()
        }

        override fun commitContent(inputContentInfo: InputContentInfo, flags: Int, opts: Bundle?): Boolean = false
    }
}
