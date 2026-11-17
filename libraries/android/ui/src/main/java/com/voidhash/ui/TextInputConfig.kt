// Adapted from the Flutter engine's Android embedder (TextInputPlugin.java in
// shell/platform/android/io/flutter/plugin/editing).
// Copyright 2013 The Flutter Authors. All rights reserved.
// Use of the adapted parts is governed by the BSD-style license in THIRD_PARTY_NOTICES.md.

package com.voidhash.ui

import android.text.InputType
import android.view.inputmethod.EditorInfo
import org.json.JSONObject

/** How a text input asks the keyboard to be set up: the `config` of a `textInput` message. */
internal data class TextInputConfig(
    val keyboard: String = "text",
    val returnKey: String = "default",
    val secure: Boolean = false,
    val multiline: Boolean = false,
    val capitalization: String = "none",
    val autocorrect: Boolean = false,
    val autofill: String = "none",
) {
    /** The `InputType` an input method reads to pick its layout and behaviour. */
    val inputType: Int
        get() = when (keyboard) {
            "number", "decimal" -> {
                var type = InputType.TYPE_CLASS_NUMBER
                if (keyboard == "decimal") type = type or InputType.TYPE_NUMBER_FLAG_DECIMAL
                if (secure) type = type or InputType.TYPE_NUMBER_VARIATION_PASSWORD
                type
            }
            "phone" -> InputType.TYPE_CLASS_PHONE
            else -> {
                var type = InputType.TYPE_CLASS_TEXT
                if (multiline) type = type or InputType.TYPE_TEXT_FLAG_MULTI_LINE
                type = type or when {
                    // Both, as some input methods ignore the flag and suggest from a password.
                    secure -> InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS or InputType.TYPE_TEXT_VARIATION_PASSWORD
                    keyboard == "email" -> InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
                    keyboard == "url" -> InputType.TYPE_TEXT_VARIATION_URI
                    else -> 0
                }
                if (!secure && autocorrect) type = type or InputType.TYPE_TEXT_FLAG_AUTO_CORRECT
                type or when (capitalization) {
                    "characters" -> InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS
                    "words" -> InputType.TYPE_TEXT_FLAG_CAP_WORDS
                    "sentences" -> InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
                    else -> 0
                }
            }
        }

    /** The return key's `IME_ACTION_…`. A multiline input's default key breaks the line. */
    val imeAction: Int
        get() = when (returnKey) {
            "next" -> EditorInfo.IME_ACTION_NEXT
            "done" -> EditorInfo.IME_ACTION_DONE
            "go" -> EditorInfo.IME_ACTION_GO
            "search" -> EditorInfo.IME_ACTION_SEARCH
            "send" -> EditorInfo.IME_ACTION_SEND
            else -> if (multiline) EditorInfo.IME_ACTION_NONE else EditorInfo.IME_ACTION_UNSPECIFIED
        }

    /**
     * Never the fullscreen editor, which would draw a copy of the text above the flow, and no
     * learning from what is typed into a secure input. A multiline input whose return key breaks
     * the line says so, as an input method otherwise shows an action key.
     */
    val imeOptions: Int
        get() {
            var options = imeAction or EditorInfo.IME_FLAG_NO_FULLSCREEN or EditorInfo.IME_FLAG_NO_EXTRACT_UI
            if (secure) options = options or EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING
            if (multiline && returnKey == "default") options = options or EditorInfo.IME_FLAG_NO_ENTER_ACTION
            return options
        }

    /** What the engine is told when the return key is pressed; `newline` for a default key. */
    val returnAction: String get() = if (returnKey == "default") "newline" else returnKey

    /**
     * The hint an autofill service reads, or `null` for a field it should leave alone. The values
     * are the platform's (`View.AUTOFILL_HINT_…`) and AndroidX's (`HintConstants`), spelled out as
     * neither set of constants covers them all. `organization` has no Android hint.
     */
    val autofillHint: String?
        get() = when (autofill) {
            "name" -> "name"
            "givenName" -> "personGivenName"
            "familyName" -> "personFamilyName"
            "email" -> "emailAddress"
            "phone" -> "phone"
            "username" -> "username"
            "newPassword" -> "newPassword"
            "password" -> "password"
            "oneTimeCode" -> "smsOTPCode"
            "postalCode" -> "postalCode"
            "country" -> "addressCountry"
            else -> null
        }

    companion object {
        fun fromPayload(config: JSONObject) = TextInputConfig(
            keyboard = config.optString("keyboard", "text"),
            returnKey = config.optString("returnKey", "default"),
            secure = config.optBoolean("secure"),
            multiline = config.optBoolean("multiline"),
            capitalization = config.optString("capitalization", "none"),
            autocorrect = config.optBoolean("autocorrect"),
            autofill = config.optString("autofill", "none"),
        )
    }
}
