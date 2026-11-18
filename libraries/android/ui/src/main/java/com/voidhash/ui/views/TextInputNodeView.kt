package com.voidhash.ui.views

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.text.Editable
import android.text.InputFilter
import android.text.Selection
import android.text.Spannable
import android.text.Spanned
import android.text.TextWatcher
import android.text.method.PasswordTransformationMethod
import android.text.method.SingleLineTransformationMethod
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.accessibility.AccessibilityNodeInfo
import android.view.autofill.AutofillValue
import android.view.inputmethod.BaseInputConnection
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import com.voidhash.ui.TextInputConfig
import kotlin.math.roundToInt

/**
 * What a text field holds, as the core hears it: the whole text, the selection in UTF-16 code
 * units (base is the anchor, extent the moving end) and whether the input method composes in
 * it. The text is the end user's, so no description carries it.
 */
internal class TextFieldState(val text: String, val selectionBase: Int, val selectionExtent: Int, val composing: Boolean) {
    override fun equals(other: Any?) = other is TextFieldState && other.text == text &&
        other.selectionBase == selectionBase && other.selectionExtent == selectionExtent && other.composing == composing

    override fun hashCode() = 31 * (31 * text.hashCode() + selectionBase) + selectionExtent

    override fun toString() = "TextFieldState(selection $selectionBase–$selectionExtent, composing $composing)"
}

/**
 * An edit of a field's text: it replaced [start]..[end], in UTF-16 code units of the text before
 * it, with [inserted] UTF-16 code units. An insertion at a caret replaced an empty range.
 */
internal data class TextEdit(val start: Int, val end: Int, val inserted: Int) {
    /** This edit followed by [next], which edits the text this one left, as one edit of the text before both. */
    fun then(next: TextEdit): TextEdit {
        // The span both touch, in the coordinates of the text between them; outside this edit's
        // insertion they map back to the text before it.
        val from = minOf(start, next.start)
        val to = maxOf(start + inserted, next.end)
        return TextEdit(from, to - inserted + (end - start), (to - from) - (next.end - next.start) + next.inserted)
    }
}

/**
 * A `textInput` view (views protocol, "Text input"): the platform's own [EditText], which owns its
 * text, caret, selection, composition, autofill and its accessibility. The view draws the box
 * (background, border, radii) and keeps the field over it, its text box at `textInsets`.
 *
 * It reports every change of the field to the core under the field's revision rule: the
 * revision `text_changed` returns is kept, and a `TEXT_SET` applies only on the revision it was
 * based on. What the host sets itself is never reported back.
 */
internal class TextInputNodeView(context: Context, nodeId: Int, kind: NodeKind, host: NodeHost?) : NodeView(context, nodeId, kind, host) {
    /** The revision the core last gave the field (views protocol, "Revisions"). */
    var revision = 0L
        private set

    /** What the core last knew the field to hold: reported by the field, or set by the core. */
    private var known = TextFieldState("", 0, 0, false)

    /** The edits the field made to [known]'s text since it was reported, as one; `null` for none. */
    private var unreportedEdit: TextEdit? = null

    /** The host is changing the field (a `TEXT_SET`, its keyboard set-up): not the end user's edit. */
    var applyingSet = false
        private set

    /** The field is taking the keyboard on the host's command, not the end user's. */
    private var focusingByCommand = false

    /** A `TEXT_FOCUS` waiting for the field to have its window's focus. */
    var wantsFocus = false
        private set

    /** The keyboard set-up the field has. */
    var configuration = keyboardSetUp(emptyMap())
        private set

    /** The children of a text input are not shown. */
    private val hiddenChildren = NodeHolder(context).apply { visibility = INVISIBLE }

    val field = FieldEditText(context).also { it.owner = this }

    init {
        addView(hiddenChildren)
        addView(field)
        configuration.applyTo(field)
    }

    override val contentHost: ViewGroup get() = hiddenChildren

    override fun hitTestChildren(x: Float, y: Float): NodeView? = null

    /** The field takes its own touches: taps, selection, the edit menu. */
    override fun touchTarget(x: Float, y: Float): View? = if (inside(x, y) && pointerEvents != "box-none") field else null

    // region Props

    val isDisabled: Boolean get() = props["disabled"]?.bool == true

    val isReadOnly: Boolean get() = props["readOnly"]?.bool == true

    /** The most grapheme clusters the field holds, or `null`. */
    val maxLength: Int? get() = props["maxLength"]?.number?.takeIf { it >= 0 }?.let { minOf(it, Int.MAX_VALUE.toDouble()).toInt() }

    override fun refreshContent(change: Change) {
        val keyboardChanged = change.touches(KEYBOARD_KEYS, orSize = false)
        if (keyboardChanged) applyKeyboard()
        // The input type resets the typeface of a password field, so the style follows it.
        if (keyboardChanged || change.touches(STYLE_KEYS)) applyStyle()
        if (change.touches(setOf("disabled", "readOnly"), orSize = false)) {
            field.isEnabled = !isDisabled
            // A disabled field takes no focus; the core moves the keyboard on.
            if (isDisabled && field.isFocused) clearFieldFocus()
        }
        layoutField()
    }

    /**
     * Gives the field its keyboard set-up. Android reads it when the field takes the keyboard, so
     * it is in place before it can; a field that has the keyboard restarts its input in place,
     * keeping its text and selection.
     */
    private fun applyKeyboard() {
        val next = keyboardSetUp(props)
        if (next == configuration) return
        configuration = next
        val state = currentState
        hostEdit {
            next.applyTo(field)
            val editable = field.text
            if (editable.toString() == state.text) Selection.setSelection(editable, state.selectionBase, state.selectionExtent)
        }
    }

    private fun applyStyle() {
        val host = host
        val density = density
        val size = (props["fontSize"]?.number ?: 14.0).toFloat().coerceAtLeast(0f)
        val font = host?.textSystem?.fonts?.resolve(
            props["fontFamily"]?.string.orEmpty(),
            (props["fontWeight"]?.number ?: 400.0).toInt().coerceIn(1, 1000),
            props["italic"]?.bool == true,
        )
        hostEdit {
            field.typeface = font?.typeface
            field.paint.textSkewX = if (font?.syntheticItalic == true) -0.25f else 0f
            field.setTextSize(TypedValue.COMPLEX_UNIT_PX, size * density)
            field.letterSpacing = if (size > 0f) (props["letterSpacing"]?.number ?: 0.0).toFloat() / size else 0f
            val color = props["color"]?.color ?: 0xFF000000.toInt()
            field.setTextColor(color)
            field.hint = props["placeholder"]?.string
            field.setHintTextColor(props["placeholderColor"]?.color ?: rgbaColor(0x3C3C4399.toDouble()))
            field.highlightColor = props["selectionColor"]?.color ?: rgbaColor(0x007AFF4C.toDouble())
            applyCaretColor(props["caretColor"]?.color ?: rgbaColor(0x007AFFFF.toDouble()))
            val lineHeight = (props["lineHeight"]?.number?.toFloat() ?: (size * 1.2f)) * density
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                if (lineHeight >= 1f) field.lineHeight = lineHeight.roundToInt()
            } else {
                field.setLineSpacing(lineHeight - field.paint.getFontMetrics(null), 1f)
            }
            val horizontal = when (props["textAlign"]?.string) {
                "right" -> Gravity.RIGHT
                "center" -> Gravity.CENTER_HORIZONTAL
                else -> Gravity.LEFT
            }
            field.gravity = horizontal or if (configuration.multiline) Gravity.TOP else Gravity.CENTER_VERTICAL
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                field.justificationMode = if (props["textAlign"]?.string == "justify") {
                    android.text.Layout.JUSTIFICATION_MODE_INTER_WORD
                } else {
                    android.text.Layout.JUSTIFICATION_MODE_NONE
                }
            }
            val decoration = props["decoration"]
            var flags = field.paintFlags and (Paint.UNDERLINE_TEXT_FLAG or Paint.STRIKE_THRU_TEXT_FLAG).inv()
            if (decoration?.get("underline")?.bool == true) flags = flags or Paint.UNDERLINE_TEXT_FLAG
            if (decoration?.get("lineThrough")?.bool == true) flags = flags or Paint.STRIKE_THRU_TEXT_FLAG
            field.paintFlags = flags
            val shadow = props["textShadow"]
            val shadowColor = shadow?.get("color")?.color
            if (shadowColor != null) {
                field.setShadowLayer(
                    maxOf(0.01f, (shadow["blur"]?.number ?: 0.0).toFloat() * density),
                    (shadow["x"]?.number ?: 0.0).toFloat() * density,
                    (shadow["y"]?.number ?: 0.0).toFloat() * density,
                    shadowColor,
                )
            } else {
                field.setShadowLayer(0f, 0f, 0f, 0)
            }
            val insets = props["textInsets"]?.numbers?.takeIf { it.size == 4 }?.map { (it * density).roundToInt() } ?: listOf(0, 0, 0, 0)
            // Android adds a line's extra height below it; the core centres the glyphs in the line,
            // so a multiline field's text box moves down by half of it.
            val centring = if (configuration.multiline) {
                ((lineHeight - field.paint.getFontMetricsInt(null)) / 2).roundToInt().coerceAtLeast(0)
            } else {
                0
            }
            field.setPadding(insets[3], insets[0] + centring, insets[1], insets[2])
        }
    }

    /** The caret, and the selection handles in the same colour (API 29; earlier keeps the theme's). */
    private fun applyCaretColor(color: Int) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
        field.textCursorDrawable = GradientDrawable().apply {
            setColor(color)
            setSize((2 * density).roundToInt(), 1)
        }
        field.textSelectHandle?.mutate()?.setTint(color)
        field.textSelectHandleLeft?.mutate()?.setTint(color)
        field.textSelectHandleRight?.mutate()?.setTint(color)
    }

    private fun layoutField() {
        field.measure(MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY))
        field.layout(0, 0, width, height)
    }

    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        super.onLayout(changed, l, t, r, b)
        layoutField()
    }

    // endregion

    // region Commands

    /**
     * `TEXT_SET`: sets the text and selection when the field is still at `base`, and keeps the
     * new revision; otherwise the field was edited since and the set is dropped. Returns whether
     * it applied.
     */
    fun apply(set: ViewOperation.TextSet): Boolean {
        if (set.base != ViewOperation.TextSet.ANY_REVISION && set.base != revision) return false
        revision = set.revision
        unreportedEdit = null
        val length = set.text.length
        val next = TextFieldState(set.text, set.selectionBase.coerceIn(0, length), set.selectionExtent.coerceIn(0, length), false)
        known = next
        val current = currentState
        // What the field already holds stays untouched: an input method's composition survives
        // a set that changes nothing.
        if (current.text == next.text &&
            (current.composing || current.selectionBase == next.selectionBase && current.selectionExtent == next.selectionExtent)
        ) {
            known = TextFieldState(next.text, next.selectionBase, next.selectionExtent, current.composing)
            return true
        }
        hostEdit {
            val editable = field.text
            if (current.text != next.text) {
                // In place, so the input method keeps its session and hears of the change.
                editable.replace(0, editable.length, next.text)
                // An input method that was composing holds text the field no longer has.
                if (current.composing && field.isFocused) inputMethods?.restartInput(field)
            }
            Selection.setSelection(editable, next.selectionBase, next.selectionExtent)
        }
        return true
    }

    /** `TEXT_FOCUS`: the field takes the keyboard, straight from any other field, or once its window has the focus. */
    fun focus() {
        wantsFocus = true
        takeFocusIfPossible()
    }

    /** A `TEXT_FOCUS` of another field replaced this one's before it could apply. */
    fun cancelFocusRequest() {
        wantsFocus = false
    }

    /** `TEXT_BLUR`: the field gives up the keyboard when it has it. */
    fun blur() {
        wantsFocus = false
        if (field.isFocused) clearFieldFocus()
    }

    /** Applies a waiting `TEXT_FOCUS` when the field's window has the focus. */
    fun takeFocusIfPossible() {
        if (!wantsFocus || !field.hasWindowFocus()) return
        wantsFocus = false
        val moving = !field.isFocused
        focusingByCommand = true
        try {
            if (moving && !field.requestFocus()) return
        } finally {
            focusingByCommand = false
        }
        val methods = inputMethods ?: return
        // Straight from another field: the input restarts for this one, the keyboard stays.
        if (moving) methods.restartInput(field)
        methods.showSoftInput(field, 0)
        // The input method may not serve the window's focused view yet; it drops a show for one
        // it does not serve, so ask again once it does.
        field.post { if (field.isFocused) inputMethods?.showSoftInput(field, 0) }
    }

    /** Takes the focus and the keyboard from the field without the window handing the focus to another field. */
    fun clearFieldFocus() {
        withoutRefocus { field.clearFocus() }
        inputMethods?.hideSoftInputFromWindow(field.windowToken, 0)
    }

    private val inputMethods: InputMethodManager?
        get() = context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager

    // endregion

    // region What the field reports

    /** The field's text, selection and composition now. */
    val currentState: TextFieldState
        get() {
            // `this.`: inside a getter, `field` alone is the backing field.
            val text = this.field.text
            val length = text.length
            val start = Selection.getSelectionStart(text)
            val end = Selection.getSelectionEnd(text)
            return TextFieldState(
                text.toString(),
                if (start < 0) length else start.coerceIn(0, length),
                if (end < 0) length else end.coerceIn(0, length),
                BaseInputConnection.getComposingSpanStart(text) >= 0,
            )
        }

    /**
     * The field's text, selection or composition may have changed: reports it unless it is what
     * the core already knows, the host is changing the field, or the input method is in the
     * middle of a batch of edits, which is reported as one when it ends.
     */
    fun fieldChanged() {
        val host = host ?: return
        if (applyingSet || field.inBatchEdit) return
        val state = currentState
        // A change of the selection alone, or an edit that left the text as it was, names no edit.
        val edit = unreportedEdit.takeIf { state.text != known.text }
        unreportedEdit = null
        if (state == known) return
        known = state
        host.textChanged(this, state, edit, byUser = !focusingByCommand)?.let { revision = it }
    }

    /**
     * The field's text replaced [start]..[end] of the text before with [inserted] UTF-16 code
     * units, as its `TextWatcher` names the edit; the host's own changes are not the field's.
     */
    fun fieldEdited(start: Int, end: Int, inserted: Int) {
        if (applyingSet) return
        val edit = TextEdit(start, end, inserted)
        unreportedEdit = unreportedEdit?.then(edit) ?: edit
    }

    /** Runs [change] as the host's own change of the field: not reported, not filtered. */
    private inline fun hostEdit(change: () -> Unit) {
        val previous = applyingSet
        applyingSet = true
        try {
            change()
        } finally {
            applyingSet = previous
        }
    }

    fun focusChanged(focused: Boolean) {
        val host = host ?: return
        if (focused) {
            host.textFocused(this)
            return
        }
        // Straight to another field: that one reports its focus, and the keyboard stays.
        val taking = takingFocus
        if (taking != null && taking !== field) return
        host.textBlurred(this)
    }

    /**
     * Whether an edit replacing `dest[start, end)` with [inserted] may change the field: not
     * while read-only or disabled, nor typing into a full field at its caret (views protocol,
     * `text_changed`: such an edit is refused whole). Any other edit past `maxLength` is the
     * core's to cut, and composing text waits until the composition ends.
     */
    fun allowsEdit(inserted: CharSequence, dest: Spanned, start: Int, end: Int, composing: Boolean): Boolean {
        if (isReadOnly || isDisabled) return false
        val maxLength = maxLength ?: return true
        if (composing || start != end || inserted.isEmpty()) return true
        if (graphemeCount(dest) < maxLength) return true
        val result = StringBuilder(dest).replace(start, end, inserted.toString())
        return graphemeCount(result) <= maxLength
    }

    /**
     * The return key. Returns whether the field inserts it as a line break itself: only a
     * multiline field whose key is labelled `default` does; any other reports its action.
     */
    fun returnKeyPressed(): Boolean {
        if (configuration.multiline && configuration.returnKey == "default") return true
        host?.textAction(this, configuration.returnAction)
        return false
    }

    // endregion

    // region Accessibility

    /** The field's label: the author's, else the placeholder, as native fields read. */
    val fieldLabel: String? get() = props["accessibilityLabel"]?.string ?: props["placeholder"]?.string

    // endregion

    companion object {
        /** The keyboard set-up's keys. */
        private val KEYBOARD_KEYS = setOf("keyboard", "returnKey", "capitalization", "autocorrect", "autofill", "secureTextEntry", "multiline")

        /** The props the field's text and placeholder are styled from. */
        private val STYLE_KEYS = setOf(
            "fontFamily", "fontSize", "fontWeight", "italic", "lineHeight", "letterSpacing", "textAlign", "color",
            "decoration", "textStroke", "textShadow", "textInsets", "placeholder", "placeholderColor", "caretColor",
            "selectionColor",
        )

        /**
         * The keyboard set-up from a field's props, with the runtime's defaults for absent keys
         * (views protocol, "Text input"), in the engine renderer's terms so both map it alike.
         */
        fun keyboardSetUp(props: Map<String, PropValue>) = TextInputConfig(
            keyboard = props["keyboard"]?.string ?: "text",
            returnKey = props["returnKey"]?.string ?: "default",
            secure = props["secureTextEntry"]?.bool == true,
            multiline = props["multiline"]?.bool == true,
            capitalization = props["capitalization"]?.string ?: "sentences",
            autocorrect = props["autocorrect"]?.bool ?: true,
            autofill = props["autofill"]?.string ?: "none",
        )

        /** The field taking the focus right now, so the one giving it up does not report a blur. */
        private var takingFocus: View? = null

        /** The host is clearing a field's focus or removing views: the window must not hand it to another field. */
        private var refusingFocus = false

        /**
         * Runs [change], during which no field takes the focus: a view that clears its focus or
         * leaves its window hands the focus to the first focusable view, which may be a field the
         * flow did not focus.
         */
        fun <T> withoutRefocus(change: () -> T): T {
            val previous = refusingFocus
            refusingFocus = true
            try {
                return change()
            } finally {
                refusingFocus = previous
            }
        }

        /** Runs `requestFocus` of [field], marked as taking the focus. */
        fun <T> takingFocus(field: View, request: () -> T): T {
            val previous = takingFocus
            takingFocus = field
            try {
                return request()
            } finally {
                takingFocus = previous
            }
        }

        /** Grapheme clusters of [text], as `maxLength` counts them. */
        fun graphemeCount(text: CharSequence): Int {
            val string = text.toString()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                val iterator = android.icu.text.BreakIterator.getCharacterInstance()
                iterator.setText(string)
                var count = 0
                while (iterator.next() != android.icu.text.BreakIterator.DONE) count += 1
                return count
            }
            val iterator = java.text.BreakIterator.getCharacterInstance()
            iterator.setText(string)
            var count = 0
            while (iterator.next() != java.text.BreakIterator.DONE) count += 1
            return count
        }

        /** Hides the keyboard of [view]'s window. */
        fun hideKeyboard(view: View) {
            val methods = view.context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager ?: return
            methods.hideSoftInputFromWindow(view.windowToken, 0)
        }

        /** Whether the host is clearing a field's focus. */
        val isRefusingFocus: Boolean get() = refusingFocus

        /**
         * Runs [draw], which draws [view] into a picture, with the text of every secure field in
         * it left out, so a picture the host takes for an effect never holds a password.
         */
        fun <T> withSecureTextHidden(view: View, draw: () -> T): T {
            val hidden = ArrayList<FieldEditText>()
            val pending = ArrayDeque<View>().apply { add(view) }
            while (pending.isNotEmpty()) {
                val next = pending.removeLast()
                if (next is TextInputNodeView && next.configuration.secure) {
                    next.field.drawsText = false
                    hidden.add(next.field)
                    continue
                }
                if (next is ViewGroup) for (index in 0 until next.childCount) pending.add(next.getChildAt(index))
            }
            try {
                return draw()
            } finally {
                for (field in hidden) field.drawsText = true
            }
        }
    }
}

/**
 * Applies the keyboard set-up to [field]: input type, IME options, masking, autofill. A field
 * that has the keyboard restarts its input, so the keyboard changes in place.
 */
private fun TextInputConfig.applyTo(field: EditText) {
    // Restarts the input of a focused field itself.
    if (field.inputType != inputType) field.inputType = inputType
    if (field.imeOptions != imeOptions) {
        field.imeOptions = imeOptions
        if (field.isFocused) (field.context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager)?.restartInput(field)
    }
    // The input type leaves a phone or number field unmasked, and a multiline one transformed.
    val transformation = when {
        secure -> PasswordTransformationMethod.getInstance()
        multiline -> null
        else -> SingleLineTransformationMethod.getInstance()
    }
    if (field.transformationMethod !== transformation) field.transformationMethod = transformation
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val hint = autofillHint
        if (hint != null) {
            field.setAutofillHints(hint)
            field.importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_YES
        } else {
            field.setAutofillHints(*emptyArray<String>())
            field.importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO
        }
    }
}

/**
 * The native field of a [TextInputNodeView]. It tells its owner of every change, focus and
 * return key, and holds edits to the owner's rules (read-only, disabled, maximum length).
 */
@SuppressLint("ViewConstructor", "AppCompatCustomView")
internal class FieldEditText(context: Context) : EditText(context) {
    var owner: TextInputNodeView? = null

    /** False while the host takes a picture that must not show the field's text. */
    var drawsText = true

    /** The input method is in a batch of edits, reported as one when it ends. */
    var inBatchEdit = false
        private set

    init {
        background = null
        includeFontPadding = false
        // The flow keeps the field's text; a restored instance state would bring an old one back.
        isSaveEnabled = false
        filters = arrayOf(EditFilter())
        addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}

            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                owner?.fieldEdited(start, start + before, count)
            }

            override fun afterTextChanged(s: Editable?) {
                owner?.fieldChanged()
            }
        })
        setOnEditorActionListener { _, _, event ->
            val owner = owner ?: return@setOnEditorActionListener false
            val inserts = owner.configuration.multiline && owner.configuration.returnKey == "default"
            // A hardware Enter arrives once as it goes down and once as it goes up.
            if (event != null && event.action != KeyEvent.ACTION_DOWN) return@setOnEditorActionListener !inserts
            !owner.returnKeyPressed()
        }
    }

    override fun onDraw(canvas: android.graphics.Canvas) {
        if (drawsText) super.onDraw(canvas)
    }

    override fun onSelectionChanged(selStart: Int, selEnd: Int) {
        super.onSelectionChanged(selStart, selEnd)
        owner?.fieldChanged()
    }

    override fun onBeginBatchEdit() {
        super.onBeginBatchEdit()
        inBatchEdit = true
    }

    // Also how a composition that ends without changing the text is heard: the input method
    // finishes it in a batch of its own.
    override fun onEndBatchEdit() {
        super.onEndBatchEdit()
        inBatchEdit = false
        owner?.fieldChanged()
    }

    override fun requestFocus(direction: Int, previouslyFocusedRect: Rect?): Boolean {
        val owner = owner
        if (TextInputNodeView.isRefusingFocus || owner == null || owner.isDisabled) return false
        return TextInputNodeView.takingFocus(this) { super.requestFocus(direction, previouslyFocusedRect) }
    }

    override fun onFocusChanged(focused: Boolean, direction: Int, previouslyFocusedRect: Rect?) {
        super.onFocusChanged(focused, direction, previouslyFocusedRect)
        owner?.focusChanged(focused)
    }

    override fun onWindowFocusChanged(hasWindowFocus: Boolean) {
        super.onWindowFocusChanged(hasWindowFocus)
        if (hasWindowFocus) owner?.takeFocusIfPossible()
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        // Its window may already have the focus, which is then not reported again.
        post { owner?.takeFocusIfPossible() }
    }

    // The back button puts the keyboard away first: the end user dismissed it, so the field gives
    // it up and the flow does not also go back. Taken before the input method and the window
    // see it.
    override fun onKeyPreIme(keyCode: Int, event: KeyEvent): Boolean {
        if (keyCode != KeyEvent.KEYCODE_BACK || !isFocused) return super.onKeyPreIme(keyCode, event)
        if (event.action == KeyEvent.ACTION_UP && !event.isCanceled) owner?.clearFieldFocus()
        return true
    }

    // Autofill and assistive technology set the whole text; neither may change a read-only or
    // disabled field.
    override fun autofill(value: AutofillValue) {
        val owner = owner
        if (owner == null || owner.isReadOnly || owner.isDisabled) return
        super.autofill(value)
    }

    override fun performAccessibilityAction(action: Int, arguments: Bundle?): Boolean {
        val owner = owner
        if (action == AccessibilityNodeInfo.ACTION_SET_TEXT && (owner == null || owner.isReadOnly || owner.isDisabled)) return false
        return super.performAccessibilityAction(action, arguments)
    }

    override fun onInitializeAccessibilityNodeInfo(info: AccessibilityNodeInfo) {
        super.onInitializeAccessibilityNodeInfo(info)
        val owner = owner ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val hint = owner.props["accessibilityHint"]?.string
            info.hintText = listOfNotNull(owner.fieldLabel, hint).joinToString(", ").ifEmpty { null }
        }
        if (owner.isReadOnly) {
            info.isEditable = false
            info.removeAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SET_TEXT)
            info.removeAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_PASTE)
            info.removeAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_CUT)
        }
        if (owner.props["accessibilityRole"]?.string == "search") info.className = "android.widget.EditText"
    }

    /** Holds edits to the owner's rules and turns a typed line break into the return key. */
    private inner class EditFilter : InputFilter {
        override fun filter(source: CharSequence, start: Int, end: Int, dest: Spanned, dstart: Int, dend: Int): CharSequence? {
            val owner = owner ?: return null
            // Only edits of the field's own text; a whole new text (autofill, assistive
            // technology) is held to the rules where it is set.
            if (owner.applyingSet || dest !is Editable) return null
            val inserted = source.subSequence(start, end)
            val composing = BaseInputConnection.getComposingSpanStart(dest) >= 0 ||
                (source is Spannable && BaseInputConnection.getComposingSpanStart(source) >= 0)
            if (inserted.toString() == "\n" && !composing && !owner.returnKeyPressed()) {
                return dest.subSequence(dstart, dend)
            }
            return if (owner.allowsEdit(inserted, dest, dstart, dend, composing)) null else dest.subSequence(dstart, dend)
        }
    }
}
