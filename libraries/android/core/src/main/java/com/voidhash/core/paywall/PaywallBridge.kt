package com.voidhash.core.paywall

/**
 * Shared paywall bridge contract between the SDK and a presented flow. Every constant here is
 * part of the wire contract and must stay behaviourally identical to the iOS
 * `PaywallBridge.swift` counterpart.
 */
object PaywallBridge {
    /** Envelope version every flow message carries. */
    const val VERSION = 1

    /**
     * Escapes every non-ASCII code unit as `\uXXXX`, so an outbound envelope is pure ASCII
     * whatever transport carries it; localized prices like "59,99 €" survive unchanged.
     */
    fun escapeNonAscii(json: String): String {
        val builder = StringBuilder(json.length)
        for (character in json) {
            if (character.code < 0x80) {
                builder.append(character)
            } else {
                builder.append("\\u").append(character.code.toString(16).padStart(4, '0'))
            }
        }
        return builder.toString()
    }
}
