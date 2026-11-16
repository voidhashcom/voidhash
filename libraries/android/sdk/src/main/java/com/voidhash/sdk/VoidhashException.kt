package com.voidhash.sdk

import com.voidhash.sdk.billing.PurchaseFailureReason

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
 * A purchase the store refused, with the store's reason when it gave one.
 *
 * @property reason why the store refused it: a declined payment, or a user not eligible for the
 *   offer; `null` when the store gave no reason.
 */
class VoidhashPurchaseException(
    code: String,
    description: String,
    cause: Throwable? = null,
    val reason: PurchaseFailureReason? = null,
) : VoidhashException(code, description, cause)

/**
 * Raised when the API responds with a non-2xx status, or with a 2xx body the SDK cannot use
 * (code `MALFORMED_RESPONSE`).
 *
 * @property retryAfterMs the cool-down the server asked for on a 429 or 503, from the
 *   `Retry-After` header or the response body. `null` when the server named none.
 * @property tag the `_tag` of a Voidhash API error body, for example
 *   `Api/SdkPersonNotFoundError`. `null` when the body is not a Voidhash API error, as with an
 *   edge or proxy page; such a response says nothing about the request and is retried.
 */
class VoidhashApiException(
    val status: Int,
    code: String,
    description: String,
    val retryAfterMs: Long? = null,
    val tag: String? = null,
) : VoidhashException(code, description) {
    /**
     * Whether this is a 2xx whose body was a JSON object the SDK could not use. Only the API
     * answers a request that way, having accepted its key; a page from something in front of it,
     * an empty body, a JSON array or a scalar is not such an answer.
     */
    internal var isJsonObjectAnswer: Boolean = false
        private set

    /** A 2xx the SDK cannot use (code `MALFORMED_RESPONSE`), saying whether its body was a JSON object. */
    internal constructor(status: Int, code: String, description: String, isJsonObjectAnswer: Boolean) :
        this(status, code, description) {
        this.isJsonObjectAnswer = isJsonObjectAnswer
    }
}

/** Raised when a request never reached the API. */
class VoidhashNetworkException(
    description: String,
    cause: Throwable? = null,
) : VoidhashException("NETWORK_ERROR", description, cause)
