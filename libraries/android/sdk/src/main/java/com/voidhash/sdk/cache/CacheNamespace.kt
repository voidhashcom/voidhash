package com.voidhash.sdk.cache

/** Version of the on-disk cache layout; bumping it retires every entry written before it. */
const val CACHE_SCHEMA_VERSION: Int = 1

/**
 * Builds the storage prefix for one project: `vh:<version>:<hash>:`.
 *
 * Two Voidhash clients in the same process (or a key rotation between builds) must not read
 * each other's people, flags and paywalls, so the publishable key and the API origin are
 * folded into the prefix. The version segment lets a later SDK release discard or migrate a
 * whole layout without having to recognise individual keys.
 */
fun cacheKeyPrefix(publishableKey: String, baseUrl: String): String =
    "vh:$CACHE_SCHEMA_VERSION:${fnv1aHex("$publishableKey|$baseUrl")}:"

/**
 * 32-bit FNV-1a, rendered as eight lowercase hex digits.
 *
 * The prefix has to be identical for the same inputs across processes and releases, which
 * rules out `String.hashCode` (unspecified across platforms) and anything seeded.
 */
internal fun fnv1aHex(value: String): String {
    var hash = 0x811C9DC5u
    for (byte in value.toByteArray(Charsets.UTF_8)) {
        hash = hash xor (byte.toUInt() and 0xFFu)
        hash *= 0x01000193u
    }
    return hash.toString(16).padStart(8, '0')
}
