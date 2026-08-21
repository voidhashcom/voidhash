package com.voidhash.sdk

/**
 * Base class for every error the SDK raises. The message is always formatted as
 * `"CODE: message"` — the same contract the native billing and paywall layers
 * use, so callers can branch on the code prefix.
 */
open class VoidhashException(
    val code: String,
    val description: String,
    cause: Throwable? = null,
) : RuntimeException("$code: $description", cause)

/** Raised when the API responds with a non-2xx status. */
class VoidhashApiException(
    val status: Int,
    code: String,
    description: String,
) : VoidhashException(code, description)

/** Raised when a request never reached the API. */
class VoidhashNetworkException(
    description: String,
    cause: Throwable? = null,
) : VoidhashException("NETWORK_ERROR", description, cause)
