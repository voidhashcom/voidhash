package com.voidhash.ui

import android.text.SpannableString
import android.text.Spanned
import android.text.style.ClickableSpan
import android.view.View

/**
 * How a link reaches TalkBack: as a text whose words are one clickable span, the way a link in a
 * `TextView` or in Compose text reaches Android, never as a button. From Android 8, TalkBack then
 * says "link" in the reader's own language and lists it in its links menu; before, it reads as
 * text that can be clicked.
 *
 * A double tap clicks the node. Picking the link from the links menu clicks the span: Android
 * builds the node again and finds the span by its id, which a span gets when it is created, so a
 * link keeps one span for as long as its words stay the same.
 */
internal object LinkAccessibility {
    /** The class a link's node reports: a text, whose clickable span makes it a link. */
    const val CLASS_NAME = "android.widget.TextView"

    /** A span whose click calls [press]: create one per link and keep it while the link's words stay. */
    fun span(press: () -> Unit): ClickableSpan = object : ClickableSpan() {
        override fun onClick(widget: View) = press()
    }

    /** [words] carrying [span] over all of them, as a link node's text. */
    fun text(words: CharSequence, span: ClickableSpan): CharSequence = SpannableString(words).apply {
        setSpan(span, 0, length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    }
}
