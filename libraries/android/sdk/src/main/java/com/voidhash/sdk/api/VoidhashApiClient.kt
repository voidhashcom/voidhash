package com.voidhash.sdk.api

import com.voidhash.sdk.VoidhashApiException
import com.voidhash.sdk.VoidhashException
import com.voidhash.sdk.VoidhashNetworkException
import com.voidhash.sdk.diagnostics.DiagnosticEmitter
import com.voidhash.sdk.diagnostics.VoidhashDiagnosticKind
import com.voidhash.sdk.network.FailureClass
import com.voidhash.sdk.network.OutboundGate
import com.voidhash.sdk.network.PERSON_NOT_FOUND_TAG
import com.voidhash.sdk.network.SdkClock
import com.voidhash.sdk.network.SystemSdkClock
import com.voidhash.sdk.network.bodyTextWithinLimit
import com.voidhash.sdk.network.lazySdkHttpClient
import com.voidhash.sdk.network.classifyStatus
import com.voidhash.sdk.network.parseApiErrorTag
import com.voidhash.sdk.network.parseRetryAfterMs
import com.voidhash.sdk.flows.FlowEngineCapabilities
import com.voidhash.sdk.storage.sanitizeJsonObject
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Call
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.Collections

private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

/**
 * Thin OkHttp client over the `/api/v1/sdk` endpoints.
 *
 * Responses are handed back as plain models. Only the API's own answers are trusted as
 * answers: a `404` means "no person" only when the body is the tagged
 * `Api/SdkPersonNotFoundError`, and a 2xx counts only once its body decodes. An edge page, a
 * captive portal or an empty body throws instead, so no caller mistakes it for server state. A
 * 2xx that does not decode says the API accepted the key only when its body is a JSON object
 * ([VoidhashApiException.isJsonObjectAnswer]).
 *
 * Every request passes through [gate], which skips the call outright while the host's
 * circuit is open, the host asked for a pause with a 429, or the publishable key has been
 * rejected. The whole exchange — the call and the response body read — happens on [dispatcher],
 * so no caller can end up parsing bytes off the wire on the thread it called from.
 */
class VoidhashApiClient(
    baseUrl: String,
    private val headers: SdkHeaders,
    private val httpClient: Call.Factory = lazySdkHttpClient(),
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO,
    private val gate: OutboundGate? = null,
    private val clock: SdkClock = SystemSdkClock,
    private val diagnostics: DiagnosticEmitter = DiagnosticEmitter(),
    /** Called after every request the API answered as expected: a usable 2xx or a tagged "not found". */
    private val onSuccess: () -> Unit = {},
) {
    private val baseUrl: String = baseUrl.trimEnd('/')

    /** Codes of request-construction failures already reported, so each is reported once. */
    private val reportedRequestFailures: MutableSet<String> = Collections.synchronizedSet(HashSet())

    /** Host the client talks to; the circuit breaker is keyed by it. */
    val host: String = runCatching { java.net.URI(this.baseUrl).host }.getOrNull() ?: this.baseUrl

    /** Configuration-plane breaker key, kept separate from analytics ingest on the same host. */
    val circuitKey: String = "config:$host"

    /**
     * Receipt breaker key. Receipts the backend keeps failing must not open the breaker that
     * person, flag and schema reads depend on, nor the other way round.
     */
    val transactionCircuitKey: String = "transactions:$host"

    /** Fetches the runtime schema for the current app. */
    suspend fun getSchema(distinctId: String): JSONObject {
        val path = "/api/v1/sdk/schema"
        return requestJson("GET", path, distinctId, null) { json ->
            val schema = requireBody(json, path)
            // `{}` or an error document would otherwise be cached as a project with no products.
            if (schema.optJSONObject("products") == null || schema.optJSONObject("locations") == null) {
                throw malformed(200, "The Voidhash API returned a schema without products or locations")
            }
            schema
        }
    }

    /**
     * Resolves the paywall configured for [locationSlug]; `null` when nothing is showing.
     * [engine] reports the paywall engine the app links, so the backend serves only a flow it
     * can show; `null` without one.
     *
     * [reportsExposure] says whether the caller reports an A/B test's exposure itself. With it the
     * backend records none on resolving and answers with `showing.exposureToken`, which the caller
     * must send on the first event of each presentation of the answer and on each hand-off of it
     * to the app; the SDK's own cached resolves do. Without it, the backend counts the person in
     * the A/B test on resolving.
     */
    suspend fun resolvePaywallRaw(
        distinctId: String,
        locationSlug: String,
        engine: FlowEngineCapabilities? = null,
        interfaceRevision: Int = 0,
        reportsExposure: Boolean = false,
    ): JSONObject? {
        val path = "/api/v1/sdk/resolve-paywall"
        val payload = JSONObject().put("locationSlug", locationSlug)
        // An app that reports no revision counts as revision 0.
        if (interfaceRevision > 0) payload.put("interfaceRevision", interfaceRevision)
        // Left out when false, as SDKs before it sent it: the backend's default.
        if (reportsExposure) payload.put("reportsExposure", true)
        return requestJson("POST", path, distinctId, payload, extraHeaders = engine?.headers().orEmpty()) { json ->
            // Only the JSON `null` says nothing is showing. `{}` or an error document would
            // otherwise be cached as "no paywall" over a location that has one.
            if (json != null && (json.optJSONObject("location") == null || json.optJSONObject("showing") == null)) {
                throw malformed(200, "The Voidhash API returned a paywall without a location or a showing")
            }
            json
        }
    }

    /**
     * Fetches the current person snapshot; `null` when the backend confirms it has no person
     * for [distinctId]. [authenticationProbe] is reserved for the single request recovering an
     * authentication pause.
     */
    suspend fun getPerson(
        distinctId: String,
        authenticationProbe: Boolean = false,
    ): VoidhashPerson? {
        val path = "/api/v1/sdk/person"
        return requestJson<VoidhashPerson?>(
            "GET",
            path,
            distinctId,
            null,
            notFound = PERSON_NOT_FOUND_TAG to null,
            authenticationProbe = authenticationProbe,
        ) { json -> decodePerson(json, path) }
    }

    /**
     * The person an endpoint answered with. `{}` or an error document would otherwise be cached
     * as a person without access, and acknowledge the write that was answered with it.
     */
    private fun decodePerson(json: JSONObject?, path: String): VoidhashPerson {
        val person = requireBody(json, path)
        if (person.optStringOrNull("personId").isNullOrEmpty() ||
            person.optJSONObject("entitlements")?.optJSONArray("grants") == null
        ) {
            throw malformed(200, "The Voidhash API returned a person without an id or grants")
        }
        return VoidhashPerson.fromJson(person)
    }

    /** Aliases the current distinct id onto [newDistinctId]. */
    suspend fun identify(
        distinctId: String,
        newDistinctId: String,
        email: String?,
        name: String?,
    ): VoidhashPerson {
        val path = "/api/v1/sdk/identify"
        val payload = JSONObject().apply {
            put("distinctId", newDistinctId)
            email?.let { put("email", it) }
            name?.let { put("name", it) }
        }
        return requestJson("POST", path, distinctId, payload) { json -> decodePerson(json, path) }
    }

    /**
     * Writes person traits / profile fields and returns the person as written. Non-finite numbers
     * are not representable in JSON and are sent as `null`, however deeply they are nested.
     */
    suspend fun setPersonAttributes(
        distinctId: String,
        traits: Map<String, Any?>,
        email: String? = null,
        name: String? = null,
    ): VoidhashPerson {
        val path = "/api/v1/sdk/person/traits"
        val payload = JSONObject().apply {
            email?.let { put("email", it) }
            name?.let { put("name", it) }
            if (traits.isNotEmpty()) {
                put("traits", sanitizeJsonObject(traits))
            }
        }
        // The API answers with the person written to; anything else is not its confirmation.
        return requestJson("POST", path, distinctId, payload) { json -> decodePerson(json, path) }
    }

    /** Evaluates feature flags; an empty [keys] list evaluates every flag. */
    suspend fun evaluateFlags(distinctId: String, keys: List<String>): List<FeatureFlag> {
        val path = "/api/v1/sdk/evaluate-flags"
        val payload = JSONObject().apply {
            if (keys.isNotEmpty()) {
                put("flagKeys", JSONArray(keys))
            }
        }
        return requestJson("POST", path, distinctId, payload) { json ->
            val flags = requireBody(json, path).optJSONArray("flags")
                ?: throw malformed(200, "The Voidhash API returned a flag evaluation without flags")
            (0 until flags.length()).mapNotNull { index ->
                val flag = flags.optJSONObject(index) ?: return@mapNotNull null
                FeatureFlag(
                    key = flag.optString("key"),
                    enabled = flag.optBoolean("enabled"),
                    variantKey = flag.optStringOrNull("variantKey"),
                    payload = flag.opt("payload").takeUnless { it === JSONObject.NULL },
                )
            }
        }
    }

    /**
     * Resolves the paywall configured for [locationSlug]; `null` when nothing is showing. Nothing
     * is cached or reported: the backend counts the person in an A/B test on resolving.
     */
    suspend fun resolvePaywall(
        distinctId: String,
        locationSlug: String,
        engine: FlowEngineCapabilities? = null,
        interfaceRevision: Int = 0,
    ): ResolvedPaywall? =
        resolvePaywallRaw(distinctId, locationSlug, engine, interfaceRevision)?.let(ResolvedPaywall::fromJson)

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
     *
     * A receipt the backend can never accept as sent (its store provider is not configured for
     * this app, the token is unknown, the environment does not match) throws a
     * [VoidhashApiException] with status 422 and tag `Api/SdkTransactionRejectedError`, its
     * `reason` as the description. Receipts use their own breaker, [transactionCircuitKey].
     */
    suspend fun syncTransactionVerdict(
        distinctId: String,
        request: SyncTransactionRequest,
    ): TransactionSyncVerdict =
        requestJson(
            "POST",
            "/api/v1/sdk/sync-transaction",
            distinctId,
            request.toJson(),
            circuit = transactionCircuitKey,
            emptyBodyIsNull = true,
        ) { json ->
            when (json?.opt("accepted")) {
                true -> TransactionSyncVerdict.ACCEPTED
                false -> TransactionSyncVerdict.REJECTED
                else -> TransactionSyncVerdict.INDETERMINATE
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
        val path = "/api/v1/sdk/development/purchase"
        return requestJson("POST", path, distinctId, request.toJson(), circuit = transactionCircuitKey) { json ->
            requireBody(json, path).opt("accepted") as? Boolean
                ?: throw malformed(200, "The Voidhash API response omitted the accepted verdict")
        }
    }

    /** [body] is `null` when the response was longer than the SDK reads. */
    private class HttpResult(val status: Int, val body: String?, val retryAfter: String?)

    /**
     * Runs one request and settles its breaker permit on every exit.
     *
     * The call and the body read both happen on [dispatcher]: `Response.body.string()` is a
     * blocking socket read, and doing it after `withContext` returns would move the network
     * onto whatever thread the caller happens to be on. A 2xx is settled only after [decode]
     * accepted its body. [notFound] names the tagged 404 that is an answer rather than an
     * error, and the value it stands for. [circuit] is the breaker the request counts against.
     * [decode] gets `null` for the JSON `null`, and for an empty body only with [emptyBodyIsNull]:
     * without it an empty 2xx is not an answer.
     */
    private suspend fun <T> requestJson(
        method: String,
        path: String,
        distinctId: String,
        payload: JSONObject?,
        notFound: Pair<String, T>? = null,
        authenticationProbe: Boolean = false,
        circuit: String = circuitKey,
        extraHeaders: Map<String, String> = emptyMap(),
        emptyBodyIsNull: Boolean = false,
        decode: (JSONObject?) -> T,
    ): T {
        val operation = "api." + path.substringAfterLast('/')
        val request = buildRequest(method, path, distinctId, payload, extraHeaders)
        val permit = gate?.acquire(circuit, authenticationProbe)
        var settled = false
        try {
            val response = try {
                withContext(dispatcher) {
                    try {
                        httpClient.newCall(request).execute().use { response ->
                            HttpResult(response.code, response.bodyTextWithinLimit(), response.header("Retry-After"))
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

            if (response.status in 200..299) {
                // A captive portal or an edge page answers 200 too. Until the body decodes,
                // the host has not answered, so it counts against the breaker, not for it.
                var body: JSONObject? = null
                val decoded = try {
                    body = parseBody(response, path, emptyBodyIsNull)
                    decode(body)
                } catch (error: Exception) {
                    // A JSON object the SDK cannot use is still the API's own answer; a page is not.
                    val jsonObject = body != null
                    gate?.recordUnreadableAnswer(permit, operation, jsonObject)
                    settled = true
                    val unreadable = error as? VoidhashApiException
                    throw VoidhashApiException(
                        unreadable?.status ?: response.status,
                        "MALFORMED_RESPONSE",
                        unreadable?.description ?: "The Voidhash API returned a body the SDK cannot read",
                        isJsonObjectAnswer = jsonObject,
                    )
                }
                gate?.recordSuccess(permit, operation)
                settled = true
                onSuccess()
                return decoded
            }

            val error = toApiException(response)
            val tagged = error.tag != null
            if (notFound != null && response.status == 404 && error.tag == notFound.first) {
                gate?.recordAuthenticatedResponse(permit)
                settled = true
                onSuccess()
                return notFound.second
            }
            when (classifyStatus(response.status, tagged)) {
                FailureClass.AUTH ->
                    gate?.recordAuthFailure(permit, response.status, operation, error.description)
                FailureClass.TRANSIENT ->
                    if (response.status == 429) {
                        gate?.recordThrottled(permit, operation, error.retryAfterMs)
                    } else {
                        gate?.recordRetryableFailure(permit, operation)
                    }
                // A tagged 4xx is the API's answer about the request, not evidence about the
                // host. It must neither count against the breaker nor clear a failing streak.
                FailureClass.VERDICT -> gate?.recordAuthenticatedResponse(permit)
            }
            settled = true
            throw error
        } finally {
            // Cancellation and any unforeseen throw land here: the probe slot goes back
            // rather than wedging the host in half-open forever.
            if (!settled) gate?.release(permit)
        }
    }

    /**
     * Builds the request, failing with a terminal [VoidhashException] instead of whatever
     * OkHttp throws. OkHttp validates the URL and every header value while building, so a
     * value it rejects fails identically on every retry; it is reported once and never
     * mistaken for a transport problem.
     */
    private fun buildRequest(
        method: String,
        path: String,
        distinctId: String,
        payload: JSONObject?,
        extraHeaders: Map<String, String>,
    ): Request = try {
        val builder = Request.Builder().url(baseUrl + path)
        for ((name, value) in headers.build(distinctId) + extraHeaders) {
            builder.header(name, value)
        }
        if (method == "GET") {
            builder.get()
        } else {
            // The platform encoder answers a document it cannot write (NaN, Infinity) with
            // `null` rather than throwing.
            val body: String? = (payload ?: JSONObject()).toString()
            if (body == null) {
                throw requestFailure("INVALID_PAYLOAD", "The request body for $path is not encodable as JSON", null)
            }
            builder.method(method, body.toRequestBody(JSON_MEDIA_TYPE))
        }
        builder.build()
    } catch (error: VoidhashException) {
        throw error
    } catch (error: Exception) {
        // The message deliberately leaves the offending value out: it is a key or an id.
        throw requestFailure(
            "INVALID_REQUEST",
            "Could not build the request for $path: the base URL or a header value is invalid",
            error,
        )
    }

    private fun requestFailure(code: String, message: String, cause: Throwable?): VoidhashException {
        if (reportedRequestFailures.add(code)) {
            diagnostics.emit(
                VoidhashDiagnosticKind.TRANSPORT,
                code = code,
                operation = "api.request",
                retryable = false,
                message = message,
            )
        }
        return VoidhashException(code, message, cause)
    }

    private fun parseBody(response: HttpResult, path: String, emptyBodyIsNull: Boolean): JSONObject? {
        val body = response.body?.trim()
            ?: throw malformed(response.status, "The Voidhash API returned a body longer than the SDK reads")
        if (body == "null") return null
        if (body.isEmpty()) {
            if (emptyBodyIsNull) return null
            throw malformed(response.status, "The Voidhash API returned an empty body for $path")
        }
        return runCatching { JSONObject(body) }.getOrElse {
            throw malformed(response.status, "The Voidhash API returned a body that is not a JSON object")
        }
    }

    /** The body of an endpoint whose contract guarantees one. */
    private fun requireBody(json: JSONObject?, path: String): JSONObject =
        json ?: throw malformed(200, "The Voidhash API returned an empty body for $path")

    private fun malformed(status: Int, description: String) =
        VoidhashApiException(status, "MALFORMED_RESPONSE", description)

    private fun toApiException(response: HttpResult): VoidhashApiException {
        val status = response.status
        val tag = parseApiErrorTag(response.body)
        val code = when {
            // Only the API's own answer is about the key; an edge's 401 or 403 is not.
            (status == 401 || status == 403) && tag != null -> "AUTHENTICATION_FAILED"
            status == 429 -> "RATE_LIMIT_EXCEEDED"
            else -> "API_ERROR"
        }
        val description = runCatching {
            val json = JSONObject(response.body.orEmpty())
            json.optStringOrNull("message")
                ?: json.optStringOrNull("cause")
                ?: json.optStringOrNull("reason")
                ?: tag
        }.getOrNull() ?: "Request failed with status $status"

        return VoidhashApiException(
            status,
            code,
            description,
            parseRetryAfterMs(response.retryAfter, response.body, clock.now()),
            tag,
        )
    }
}
