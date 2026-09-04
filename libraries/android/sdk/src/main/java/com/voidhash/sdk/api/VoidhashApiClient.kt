package com.voidhash.sdk.api

import com.voidhash.sdk.VoidhashApiException
import com.voidhash.sdk.VoidhashNetworkException
import com.voidhash.sdk.network.OutboundGate
import com.voidhash.sdk.network.RETRYABLE_STATUS_CODES
import com.voidhash.sdk.network.SdkClock
import com.voidhash.sdk.network.SystemSdkClock
import com.voidhash.sdk.network.buildSdkHttpClient
import com.voidhash.sdk.network.countsTowardsCircuitBreaker
import com.voidhash.sdk.network.parseRetryAfterMs
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException

private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

/**
 * Thin OkHttp client over the `/api/v1/sdk` endpoints.
 *
 * Responses are handed back as plain models; a `404` on the person endpoint is
 * mapped to `null` because an unidentified person is not an error.
 *
 * Every request passes through [gate], which skips the call outright while the host's
 * circuit is open or the publishable key has been rejected. The whole exchange — the call
 * and the response body read — happens on [dispatcher], so no caller can end up parsing
 * bytes off the wire on the thread it called from.
 */
class VoidhashApiClient(
    baseUrl: String,
    private val headers: SdkHeaders,
    private val httpClient: OkHttpClient = buildSdkHttpClient(),
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO,
    private val gate: OutboundGate? = null,
    private val clock: SdkClock = SystemSdkClock,
) {
    private val baseUrl: String = baseUrl.trimEnd('/')

    /** Host the client talks to; the circuit breaker is keyed by it. */
    val host: String = runCatching { java.net.URI(this.baseUrl).host }.getOrNull() ?: this.baseUrl

    /** Configuration-plane breaker key, kept separate from analytics ingest on the same host. */
    val circuitKey: String = "config:$host"

    /** Fetches the runtime schema for the current app. */
    suspend fun getSchema(distinctId: String): JSONObject =
        requireJson("GET", "/api/v1/sdk/schema", distinctId, null)

    /** Resolves the paywall configured for [locationSlug]; `null` when nothing is showing. */
    suspend fun resolvePaywallRaw(distinctId: String, locationSlug: String): JSONObject? {
        val payload = JSONObject().put("locationSlug", locationSlug)
        return requestJson("POST", "/api/v1/sdk/resolve-paywall", distinctId, payload, allowNotFound = true)
    }

    /**
     * Fetches the current person snapshot; `null` when the backend has no person yet.
     * [authenticationProbe] is reserved for the single request recovering an authentication pause.
     */
    suspend fun getPerson(
        distinctId: String,
        authenticationProbe: Boolean = false,
    ): VoidhashPerson? {
        val json = requestJson(
            "GET",
            "/api/v1/sdk/person",
            distinctId,
            null,
            allowNotFound = true,
            authenticationProbe = authenticationProbe,
        )
        return json?.let { VoidhashPerson.fromJson(it) }
    }

    /** Aliases the current distinct id onto [newDistinctId]. */
    suspend fun identify(
        distinctId: String,
        newDistinctId: String,
        email: String?,
        name: String?,
    ): VoidhashPerson {
        val payload = JSONObject().apply {
            put("distinctId", newDistinctId)
            email?.let { put("email", it) }
            name?.let { put("name", it) }
        }
        return VoidhashPerson.fromJson(
            requireJson("POST", "/api/v1/sdk/identify", distinctId, payload),
        )
    }

    /** Writes person traits / profile fields. */
    suspend fun setPersonAttributes(
        distinctId: String,
        traits: Map<String, Any?>,
        email: String? = null,
        name: String? = null,
    ) {
        val payload = JSONObject().apply {
            email?.let { put("email", it) }
            name?.let { put("name", it) }
            if (traits.isNotEmpty()) {
                put("traits", JSONObject(traits.mapValues { it.value ?: JSONObject.NULL }))
            }
        }
        requestJson("POST", "/api/v1/sdk/person/traits", distinctId, payload)
    }

    /** Evaluates feature flags; an empty [keys] list evaluates every flag. */
    suspend fun evaluateFlags(distinctId: String, keys: List<String>): List<FeatureFlag> {
        val payload = JSONObject().apply {
            if (keys.isNotEmpty()) {
                put("flagKeys", JSONArray(keys))
            }
        }
        val json = requireJson("POST", "/api/v1/sdk/evaluate-flags", distinctId, payload)
        val flags = json.optJSONArray("flags") ?: JSONArray()
        return (0 until flags.length()).map { index ->
            val flag = flags.getJSONObject(index)
            FeatureFlag(
                key = flag.optString("key"),
                enabled = flag.optBoolean("enabled"),
                variantKey = flag.optStringOrNull("variantKey"),
            )
        }
    }

    /** Resolves the paywall configured for [locationSlug]; `null` when nothing is showing. */
    suspend fun resolvePaywall(distinctId: String, locationSlug: String): ResolvedPaywall? {
        val payload = JSONObject().put("locationSlug", locationSlug)
        val json = requestJson("POST", "/api/v1/sdk/resolve-paywall", distinctId, payload, allowNotFound = true)
            ?: return null
        return ResolvedPaywall.fromJson(json)
    }

    /** Syncs a store transaction; returns whether the backend accepted it. */
    suspend fun syncTransaction(distinctId: String, request: SyncTransactionRequest): Boolean =
        syncTransactionVerdict(distinctId, request) == TransactionSyncVerdict.ACCEPTED

    /**
     * Syncs a store transaction and reports the backend's verdict.
     *
     * A 2xx whose body does not carry an explicit `accepted` field is
     * [TransactionSyncVerdict.INDETERMINATE], never a rejection: a receipt is the only
     * record that the user paid, and discarding one because a response was shaped
     * unexpectedly is not a trade the SDK is allowed to make.
     */
    suspend fun syncTransactionVerdict(
        distinctId: String,
        request: SyncTransactionRequest,
    ): TransactionSyncVerdict {
        val json = requestJson(
            "POST",
            "/api/v1/sdk/sync-transaction",
            distinctId,
            request.toJson(),
        ) ?: return TransactionSyncVerdict.INDETERMINATE

        val accepted = json.opt("accepted")
        if (accepted !is Boolean) {
            return TransactionSyncVerdict.INDETERMINATE
        }
        return if (accepted) {
            TransactionSyncVerdict.ACCEPTED
        } else {
            TransactionSyncVerdict.REJECTED
        }
    }

    /**
     * Records a development (simulated) purchase. Only valid while the SDK
     * runs in the development environment; the backend rejects it otherwise.
     */
    suspend fun developmentPurchase(
        distinctId: String,
        request: DevelopmentPurchaseRequest,
    ): Boolean {
        val json = requireJson(
            "POST",
            "/api/v1/sdk/development/purchase",
            distinctId,
            request.toJson(),
        )
        val accepted = json.opt("accepted")
        if (accepted !is Boolean) {
            throw VoidhashApiException(
                200,
                "MALFORMED_RESPONSE",
                "The Voidhash API response omitted the accepted verdict",
            )
        }
        return accepted
    }

    private suspend fun requestJson(
        method: String,
        path: String,
        distinctId: String,
        payload: JSONObject?,
        allowNotFound: Boolean = false,
        authenticationProbe: Boolean = false,
    ): JSONObject? {
        val operation = "api." + path.substringAfterLast('/')

        val builder = Request.Builder().url(baseUrl + path)
        for ((name, value) in headers.build(distinctId)) {
            builder.header(name, value)
        }
        if (method == "GET") {
            builder.get()
        } else {
            builder.method(method, (payload ?: JSONObject()).toString().toRequestBody(JSON_MEDIA_TYPE))
        }

        val result = execute(builder.build(), operation, authenticationProbe)
        if (result.status == 404 && allowNotFound) {
            return null
        }
        if (result.status !in 200..299) {
            throw toApiException(result.status, result.body, result.retryAfterMs)
        }
        if (result.body.isBlank() || result.body == "null") {
            return null
        }
        return runCatching { JSONObject(result.body) }.getOrElse {
            throw VoidhashApiException(
                result.status,
                "MALFORMED_RESPONSE",
                "The Voidhash API returned a body that is not a JSON object",
            )
        }
    }

    /** [requestJson] for an endpoint whose contract guarantees a body. */
    private suspend fun requireJson(
        method: String,
        path: String,
        distinctId: String,
        payload: JSONObject?,
    ): JSONObject = requestJson(method, path, distinctId, payload)
        ?: throw VoidhashApiException(
            200,
            "MALFORMED_RESPONSE",
            "The Voidhash API returned an empty body for $path",
        )

    private class HttpResult(val status: Int, val body: String, val retryAfterMs: Long?)

    /**
     * Runs the call and reads its body, both on [dispatcher], settling the breaker permit on
     * every exit.
     *
     * `Response.body.string()` is a blocking socket read; doing it after `withContext`
     * returns would move the network onto whatever thread the caller happens to be on.
     */
    private suspend fun execute(
        request: Request,
        operation: String,
        authenticationProbe: Boolean,
    ): HttpResult {
        val permit = gate?.acquire(circuitKey, operation, authenticationProbe)
        var settled = false
        try {
            val result = try {
                withContext(dispatcher) {
                    try {
                        httpClient.newCall(request).execute().use { response ->
                            HttpResult(
                                response.code,
                                response.body?.string().orEmpty(),
                                null,
                            ).let { partial ->
                                HttpResult(
                                    partial.status,
                                    partial.body,
                                    parseRetryAfterMs(
                                        response.header("Retry-After"),
                                        partial.body,
                                        clock.now(),
                                    ),
                                )
                            }
                        }
                    } catch (error: IOException) {
                        throw VoidhashNetworkException("Failed to reach ${request.url}", error)
                    }
                }
            } catch (error: VoidhashNetworkException) {
                gate?.recordRetryableFailure(permit, operation)
                settled = true
                throw error
            }

            when {
                result.status == 401 || result.status == 403 -> {
                    gate?.recordAuthFailure(
                        permit,
                        result.status,
                        operation,
                        toApiException(result.status, result.body, null).description,
                    )
                    settled = true
                }
                result.status in RETRYABLE_STATUS_CODES -> {
                    if (countsTowardsCircuitBreaker(result.status)) {
                        gate?.recordRetryableFailure(permit, operation)
                    } else {
                        gate?.recordAuthenticatedResponse(permit)
                    }
                    settled = true
                }
                result.status in 400..499 -> {
                    // A 4xx is an answer about the request, not evidence about the host. It
                    // must neither count against the breaker nor clear a failing streak.
                    gate?.recordAuthenticatedResponse(permit)
                    settled = true
                }
                else -> {
                    gate?.recordSuccess(permit)
                    settled = true
                }
            }
            return result
        } finally {
            // Cancellation and any unforeseen throw land here: the probe slot goes back
            // rather than wedging the host in half-open forever.
            if (!settled) gate?.release(permit)
        }
    }

    private fun toApiException(
        status: Int,
        body: String,
        retryAfterMs: Long?,
    ): VoidhashApiException {
        val code = when {
            status == 401 || status == 403 -> "AUTHENTICATION_FAILED"
            status == 429 -> "RATE_LIMIT_EXCEEDED"
            else -> "API_ERROR"
        }
        val description = runCatching {
            val json = JSONObject(body)
            json.optStringOrNull("message")
                ?: json.optStringOrNull("cause")
                ?: json.optStringOrNull("_tag")
        }.getOrNull() ?: "Request failed with status $status"

        return VoidhashApiException(status, code, description, retryAfterMs)
    }
}
