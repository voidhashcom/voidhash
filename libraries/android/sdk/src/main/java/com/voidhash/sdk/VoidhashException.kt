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

/**
 * Raised when the API responds with a non-2xx status.
 *
 * @property retryAfterMs the cool-down the server asked for on a 429 or 503, from the
 *   `Retry-After` header or the response body. `null` when the server named none.
 */
class VoidhashApiException(
    val status: Int,
    code: String,
    description: String,
    val retryAfterMs: Long? = null,
) : VoidhashException(code, description)

/** Raised when a request never reached the API. */
class VoidhashNetworkException(
    description: String,
    cause: Throwable? = null,
) : VoidhashException("NETWORK_ERROR", description, cause)
