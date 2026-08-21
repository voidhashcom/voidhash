package com.voidhash.sdk.identity

import java.security.MessageDigest
import java.util.Locale

/**
 * Deterministic account token derivation shared with StoreKit and the other
 * Voidhash SDKs. The output must be bit-identical across platforms — it is the
 * identifier the store reports back to the backend.
 */
object AccountToken {
    /** Shared UUIDv5 namespace for StoreKit and Google Play account identifiers. */
    const val NAMESPACE = "3919eb4e-3466-593c-8c1e-84554e13a0a6"

    /** Derives an RFC 4122 UUIDv5 from a namespace UUID and UTF-8 name. */
    fun uuidV5(namespaceUuid: String, name: String): String {
        val namespaceBytes = uuidToBytes(namespaceUuid)
        val nameBytes = name.toByteArray(Charsets.UTF_8)

        val digest = MessageDigest.getInstance("SHA-1")
        digest.update(namespaceBytes)
        digest.update(nameBytes)

        val bytes = digest.digest().copyOf(16)
        bytes[6] = ((bytes[6].toInt() and 0x0f) or 0x50).toByte()
        bytes[8] = ((bytes[8].toInt() and 0x3f) or 0x80).toByte()
        return bytesToUuid(bytes)
    }

    /** Derives the deterministic account token supplied to Google Play. */
    fun derive(distinctId: String): String = uuidV5(NAMESPACE, distinctId)

    private fun uuidToBytes(uuid: String): ByteArray {
        val hex = uuid.replace("-", "")
        require(hex.length == 32 && hex.all { it.isDigit() || it.lowercaseChar() in 'a'..'f' }) {
            "Invalid UUID namespace: $uuid"
        }
        return ByteArray(16) { index ->
            hex.substring(index * 2, index * 2 + 2).toInt(16).toByte()
        }
    }

    private fun bytesToUuid(bytes: ByteArray): String {
        val hex = bytes.joinToString("") {
            (it.toInt() and 0xff).toString(16).padStart(2, '0')
        }.lowercase(Locale.US)
        return "${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-" +
            "${hex.substring(16, 20)}-${hex.substring(20)}"
    }
}
