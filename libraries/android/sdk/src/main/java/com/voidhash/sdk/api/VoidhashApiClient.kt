package com.voidhash.sdk.api

import com.voidhash.sdk.VoidhashApiException
import com.voidhash.sdk.VoidhashNetworkException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException

private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

/**
 * Thin OkHttp client over the `/api/v1/sdk` endpoints.
 *
 * Responses are handed back as plain models; a `404` on the person endpoint is
 * mapped to `null` because an unidentified person is not an error.
 */
class VoidhashApiClient(
    baseUrl: String,
    private val headers: SdkHeaders,
    private val httpClient: OkHttpClient = OkHttpClient(),
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO,
) {
    private val baseUrl: String = baseUrl.trimEnd('/')

    /** Fetches the runtime schema for the current app. */
    suspend fun getSchema(distinctId: String): JSONObject =
        requestJson("GET", "/api/v1/sdk/schema", distinctId, null)!!

    /** Resolves the paywall configured for [locationSlug]; `null` when nothing is showing. */
    suspend fun resolvePaywallRaw(distinctId: String, locationSlug: String): JSONObject? {
        val payload = JSONObject().put("locationSlug", locationSlug)
        return requestJson("POST", "/api/v1/sdk/resolve-paywall", distinctId, payload, allowNotFound = true)
    }

    /** Fetches the current person snapshot; `null` when the backend has no person yet. */
    suspend fun getPerson(distinctId: String): VoidhashPerson? {
        val json = requestJson("GET", "/api/v1/sdk/person", distinctId, null, allowNotFound = true)
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
            requestJson("POST", "/api/v1/sdk/identify", distinctId, payload)!!,
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
        val json = requestJson("POST", "/api/v1/sdk/evaluate-flags", distinctId, payload)!!
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
        val json = requestJson("POST", "/api/v1/sdk/resolve-paywall", distinctId, payload)
            ?: return null
        return ResolvedPaywall.fromJson(json)
    }

    /** Syncs a store transaction; returns whether the backend accepted it. */
    suspend fun syncTransaction(distinctId: String, request: SyncTransactionRequest): Boolean {
        val json = requestJson(
            "POST",
            "/api/v1/sdk/sync-transaction",
            distinctId,
            request.toJson(),
        )
        return json?.optBoolean("accepted") ?: false
    }

    /**
     * Records a development (simulated) purchase. Only valid while the SDK
     * runs in the development environment; the backend rejects it otherwise.
     */
    suspend fun developmentPurchase(
        distinctId: String,
        request: DevelopmentPurchaseRequest,
    ): Boolean {
        val json = requestJson(
            "POST",
            "/api/v1/sdk/development/purchase",
            distinctId,
            request.toJson(),
        )
        return json?.optBoolean("accepted") ?: true
    }

    private suspend fun requestJson(
        method: String,
        path: String,
        distinctId: String,
        payload: JSONObject?,
        allowNotFound: Boolean = false,
    ): JSONObject? {
        val builder = Request.Builder().url(baseUrl + path)
        for ((name, value) in headers.build(distinctId)) {
            builder.header(name, value)
        }
        if (method == "GET") {
            builder.get()
        } else {
            builder.method(method, (payload ?: JSONObject()).toString().toRequestBody(JSON_MEDIA_TYPE))
        }

        val response = execute(builder.build())
        response.use {
            val body = it.body?.string().orEmpty()
            if (it.code == 404 && allowNotFound) {
                return null
            }
            if (!it.isSuccessful) {
                throw toApiException(it.code, body)
            }
            if (body.isBlank() || body == "null") {
                return null
            }
            return JSONObject(body)
        }
    }

    private suspend fun execute(request: Request): Response = withContext(dispatcher) {
        try {
            httpClient.newCall(request).execute()
        } catch (error: IOException) {
            throw VoidhashNetworkException("Failed to reach ${request.url}", error)
        }
    }

    private fun toApiException(status: Int, body: String): VoidhashApiException {
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

        return VoidhashApiException(status, code, description)
    }
}
