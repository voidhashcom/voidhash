package com.voidhash.sdk.cache

import com.voidhash.sdk.VoidhashHostApi

/** Version of the on-disk cache layout; bumping it retires every entry written before it. */
const val CACHE_SCHEMA_VERSION: Int = 1

/**
 * Builds the storage prefix for one project: `vh:<version>:<hash>:`.
 *
 * Two Voidhash clients in the same process (or a key rotation between builds) must not read
 * each other's people, flags and paywalls, so the publishable key and the API origin are
 * folded into the prefix. The version segment lets a later SDK release discard or migrate a
 * whole layout without having to recognise individual keys.
 *
 * The base URL is hashed in its [normalizedBaseUrl] form, so spellings of one API origin share a
 * namespace.
 */
fun cacheKeyPrefix(publishableKey: String, baseUrl: String): String =
    "vh:$CACHE_SCHEMA_VERSION:${fnv1aHex("$publishableKey|${normalizedBaseUrl(baseUrl)}")}:"

/**
 * The prefix earlier releases derived from [baseUrl] exactly as configured, or `null` when it is
 * the same as [cacheKeyPrefix]'s, as it is for a base URL already written in normalized form.
 */
@VoidhashHostApi
fun unnormalizedCacheKeyPrefix(publishableKey: String, baseUrl: String): String? =
    "vh:$CACHE_SCHEMA_VERSION:${fnv1aHex("$publishableKey|$baseUrl")}:"
        .takeIf { it != cacheKeyPrefix(publishableKey, baseUrl) }

/**
 * [baseUrl] without trailing slashes and with its scheme and host in lowercase; the path is kept.
 *
 * `https://API.example.com/` and `https://api.example.com` reach the same API. Were they hashed
 * as written, changing the spelling between releases would give every device a new namespace:
 * a new anonymous identity, no cached entitlements, and queued receipts nobody reads again. A URL
 * already in this form is returned unchanged, so its namespace does not move.
 */
internal fun normalizedBaseUrl(baseUrl: String): String {
    val trimmed = baseUrl.trimEnd('/')
    val schemeEnd = trimmed.indexOf("://")
    if (schemeEnd < 0) return trimmed
    val authorityStart = schemeEnd + 3
    val authorityEnd = trimmed.indexOfAny(charArrayOf('/', '?', '#'), authorityStart)
        .takeIf { it >= 0 } ?: trimmed.length
    // User info, if any, is case-sensitive; only the host and port that follow it are not.
    val hostStart = trimmed.lastIndexOf('@', authorityEnd - 1).takeIf { it >= authorityStart }?.plus(1)
        ?: authorityStart
    return trimmed.substring(0, schemeEnd).lowercase() +
        trimmed.substring(schemeEnd, hostStart) +
        trimmed.substring(hostStart, authorityEnd).lowercase() +
        trimmed.substring(authorityEnd)
}

/**
 * 32-bit FNV-1a, rendered as eight lowercase hex digits.
 *
 * The prefix has to be identical for the same inputs across processes and releases, which
 * rules out `String.hashCode` (unspecified across platforms) and anything seeded.
 */
@VoidhashHostApi
fun fnv1aHex(value: String): String {
    var hash = 0x811C9DC5u
    for (byte in value.toByteArray(Charsets.UTF_8)) {
        hash = hash xor (byte.toUInt() and 0xFFu)
        hash *= 0x01000193u
    }
    return hash.toString(16).padStart(8, '0')
}
