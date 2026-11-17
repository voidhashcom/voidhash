package com.voidhash.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.graphics.Matrix
import android.graphics.Rect
import android.os.Build
import android.view.View
import android.view.autofill.AutofillManager
import android.view.autofill.AutofillValue
import android.view.inputmethod.CursorAnchorInfo
import android.view.inputmethod.ExtractedText
import android.view.inputmethod.InputMethodManager
import kotlin.math.ceil
import kotlin.math.floor

/** [TextInputPlatform] for the view a paywall is drawn into. */
internal class ViewTextInputPlatform(private val view: View) : TextInputPlatform {
    private val inputMethods: InputMethodManager?
        get() = view.context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager?

    private val clipboard: ClipboardManager?
        get() = view.context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager?

    override fun showKeyboard() {
        // An input method serves the focused view of the focused window. Without window focus
        // the request is dropped; the view asks again when its window gets it.
        view.requestFocus()
        inputMethods?.showSoftInput(view, 0)
    }

    override fun hideKeyboard() {
        inputMethods?.hideSoftInputFromWindow(view.windowToken, 0)
    }

    override fun restartInput() {
        inputMethods?.restartInput(view)
    }

    override fun updateSelection(selectionStart: Int, selectionEnd: Int, composingStart: Int, composingEnd: Int) {
        inputMethods?.updateSelection(view, selectionStart, selectionEnd, composingStart, composingEnd)
    }

    override fun updateExtractedText(token: Int, text: ExtractedText) {
        inputMethods?.updateExtractedText(view, token, text)
    }

    override fun updateCursorAnchor(anchor: CursorAnchor) {
        val density = view.resources.displayMetrics.density
        val builder = CursorAnchorInfo.Builder()
        builder.setSelectionRange(anchor.state.selectionStart, anchor.state.selectionEnd)
        if (anchor.state.hasComposing) {
            builder.setComposingText(anchor.state.composingStart, anchor.state.composingText)
        }
        anchor.caret?.let { (x, y, _, height) ->
            val bottom = (y + height) * density
            builder.setInsertionMarkerLocation(
                x * density,
                y * density,
                bottom,
                bottom,
                CursorAnchorInfo.FLAG_HAS_VISIBLE_REGION,
            )
        }
        for ((index, bounds) in anchor.characterBounds) {
            val (x, y, width, height) = bounds
            builder.addCharacterBounds(
                index,
                x * density,
                y * density,
                (x + width) * density,
                (y + height) * density,
                CursorAnchorInfo.FLAG_HAS_VISIBLE_REGION,
            )
        }
        // The coordinates above are the view's; the matrix places them on the screen.
        val location = IntArray(2)
        view.getLocationOnScreen(location)
        builder.setMatrix(Matrix().apply { setTranslate(location[0].toFloat(), location[1].toFloat()) })
        inputMethods?.updateCursorAnchorInfo(view, builder.build())
    }

    override fun copyToClipboard(text: String) {
        clipboard?.setPrimaryClip(ClipData.newPlainText(null, text))
    }

    override fun clipboardText(): String? {
        val clip = clipboard?.primaryClip?.takeIf { it.itemCount > 0 } ?: return null
        return clip.getItemAt(0).coerceToText(view.context)?.toString()
    }

    override fun autofillEntered(client: Int, bounds: List<Float>?) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        view.context.getSystemService(AutofillManager::class.java)
            ?.notifyViewEntered(view, client, pixelBounds(bounds))
    }

    override fun autofillExited(client: Int) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        view.context.getSystemService(AutofillManager::class.java)?.notifyViewExited(view, client)
    }

    override fun autofillValueChanged(client: Int, text: String) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        view.context.getSystemService(AutofillManager::class.java)
            ?.notifyValueChanged(view, client, AutofillValue.forText(text))
    }

    /** The engine's `[x, y, width, height]` in dp as pixels of the view; the whole view without them. */
    fun pixelBounds(bounds: List<Float>?): Rect {
        if (bounds == null || bounds.size < 4) return Rect(0, 0, view.width, view.height)
        val density = view.resources.displayMetrics.density
        val (x, y, width, height) = bounds
        return Rect(
            floor(x * density).toInt(),
            floor(y * density).toInt(),
            ceil((x + width) * density).toInt(),
            ceil((y + height) * density).toInt(),
        )
    }
}
