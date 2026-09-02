package com.margelo.nitro.voidhash.engine

import android.content.Context
import com.voidhash.sdk.ScreenTrackingOptions
import com.voidhash.sdk.VOIDHASH_DEFAULT_BASE_URL
import com.voidhash.sdk.Voidhash
import com.voidhash.sdk.VoidhashClient
import com.voidhash.sdk.VoidhashOptions
import com.voidhash.sdk.api.DevelopmentPurchaseRequest
import com.voidhash.sdk.api.SdkHeaders
import com.voidhash.sdk.api.SyncTransactionRequest
import com.voidhash.sdk.api.VoidhashApiClient
import com.voidhash.sdk.platform.PlatformInfo
import org.json.JSONArray
import org.json.JSONObject

private fun JSONObject.optStringOrNull(key: String): String? {
    if (!has(key) || isNull(key)) return null
    return optString(key)
}

/**
 * The Nitro-free heart of `HybridVoidhashEngine`: owns the embedded bare-native client and
 * performs every data-plane operation on it.
 *
 * Kept separate from the hybrid so it can be unit tested on the JVM without React Native or
 * Nitro; the hybrid only wraps these calls into Nitro promises. The factories exist for tests.
 */
class VoidhashEngineCore(
    private val configureClient: (Context, String, VoidhashOptions) -> VoidhashClient =
        { context, publishableKey, options -> Voidhash.configure(context, publishableKey, options) },
    private val platformInfoProvider: (Context) -> PlatformInfo = PlatformInfo::fromContext,
    private val apiClientFactory: (String, SdkHeaders) -> VoidhashApiClient =
        { baseUrl, headers -> VoidhashApiClient(baseUrl, headers) },
) {
    /**
     * The options JSON the TypeScript client sends. Absent keys keep the bare SDK's defaults,
     * so a missing `readOnly` means observer mode.
     *
     * Automatic native screens default to off: the JS layer owns screen tracking and passes
     * `screenTracking.automatic` explicitly. The `$app_*` lifecycle events are always emitted
     * by JS, so the embedded client never captures them.
     */
    class Options(optionsJson: String) {
        private val json = JSONObject(optionsJson)

        val baseUrl: String = json.optStringOrNull("baseUrl") ?: VOIDHASH_DEFAULT_BASE_URL
        val ingestUrl: String? = json.optStringOrNull("ingestUrl")
        val debug: Boolean = json.optBoolean("debug", false)
        val enabled: Boolean = json.optBoolean("enabled", true)
        val readOnly: Boolean = json.optBoolean("readOnly", true)
        val dev: Boolean = json.optBoolean("dev", false)
        val automaticScreenTracking: Boolean =
            json.optJSONObject("screenTracking")?.optBoolean("automatic", false) ?: false

        fun toVoidhashOptions(): VoidhashOptions = VoidhashOptions(
            baseUrl = baseUrl,
            ingestUrl = ingestUrl,
            debug = debug,
            enabled = enabled,
            readOnly = readOnly,
            dev = dev,
            screenTracking = ScreenTrackingOptions(automatic = automaticScreenTracking),
            automaticLifecycleEvents = false,
        )
    }

    @Volatile
    private var apiClient: VoidhashApiClient? = null

    @Volatile
    private var client: VoidhashClient? = null

    /** The header builder the engine's requests use; exposed for the tests. */
    @Volatile
    internal var headers: SdkHeaders? = null
        private set

    val isConfigured: Boolean get() = client != null

    /** Whether the embedded client runs in observer mode; `null` before [configure]. */
    val isReadOnly: Boolean? get() = client?.isReadOnly

    /**
     * Creates the embedded client. The client is never initialized: the engine is data-plane
     * only and must not open a billing connection next to the observer the JS layer owns.
     */
    fun configure(context: Context, publishableKey: String, optionsJson: String) {
        val platform = platformInfoProvider(context)
        val options = Options(optionsJson)
        val configuredClient = configureClient(context, publishableKey, options.toVoidhashOptions())
        // The client owns the observer flag, so the header can never drift from what the
        // client — and through `setReadOnly`, the JS layer — decided.
        val sdkHeaders = SdkHeaders(
            publishableKey = publishableKey,
            platform = platform,
            readOnlyProvider = { configuredClient.isReadOnly },
            debugProvider = { options.debug },
            environmentProvider = {
                if (options.dev && platform.isDebugBuild) "development" else "production"
            },
        )
        client = configuredClient
        headers = sdkHeaders
        apiClient = apiClientFactory(options.baseUrl, sdkHeaders)
    }

    /** Mirrors the JS observer-mode decision into the embedded client. */
    fun setReadOnly(readOnly: Boolean) {
        requireClient().setReadOnly(readOnly)
    }

    suspend fun fetchSchema(distinctId: String): String =
        requireApiClient().getSchema(distinctId).toString()

    suspend fun fetchPerson(distinctId: String): String =
        requireApiClient().getPerson(distinctId)?.raw?.toString() ?: "null"

    suspend fun identify(distinctId: String, bodyJson: String): String {
        val body = JSONObject(bodyJson)
        val person = requireApiClient().identify(
            distinctId,
            body.getString("distinctId"),
            body.optStringOrNull("email"),
            body.optStringOrNull("name"),
        )
        return person.raw.toString()
    }

    suspend fun setPersonAttributes(distinctId: String, attributesJson: String): String {
        val body = JSONObject(attributesJson)
        val traits = body.optJSONObject("traits") ?: JSONObject()
        body.optStringOrNull("email")?.let { traits.put("email", it) }
        body.optStringOrNull("name")?.let { traits.put("name", it) }

        val attributes = LinkedHashMap<String, Any?>()
        for (key in traits.keys()) {
            attributes[key] = traits.get(key).takeUnless { it == JSONObject.NULL }
        }
        val apiClient = requireApiClient()
        apiClient.setPersonAttributes(distinctId, attributes)
        return apiClient.getPerson(distinctId)?.raw?.toString() ?: "null"
    }

    suspend fun evaluateFlags(distinctId: String, flagKeysJson: String): String {
        val keys = JSONArray(flagKeysJson).let { array ->
            (0 until array.length()).map { array.getString(it) }
        }
        val flags = requireApiClient().evaluateFlags(distinctId, keys)
        val response = JSONArray()
        for (flag in flags) {
            response.put(
                JSONObject()
                    .put("key", flag.key)
                    .put("enabled", flag.enabled)
                    .put("variantKey", flag.variantKey ?: JSONObject.NULL),
            )
        }
        return response.toString()
    }

    suspend fun resolvePaywall(distinctId: String, locationSlug: String): String =
        requireApiClient().resolvePaywallRaw(distinctId, locationSlug)?.toString() ?: "null"

    suspend fun syncTransaction(distinctId: String, requestJson: String): Boolean {
        val request = JSONObject(requestJson).getJSONObject("request")
        return requireApiClient().syncTransaction(
            distinctId,
            SyncTransactionRequest(
                appAccountToken = request.optStringOrNull("appAccountToken"),
                providerProductId = request.optStringOrNull("providerProductId") ?: "",
                productSlug = request.getString("productSlug"),
                purchaseDate = request.getDouble("purchaseDate"),
                purchaseToken = request.optStringOrNull("purchaseToken") ?: "",
                quantity = request.optInt("quantity", 1),
                receipt = request.optStringOrNull("receipt"),
                transactionId = request.getString("transactionId"),
            ),
        )
    }

    suspend fun developmentPurchase(distinctId: String, requestJson: String): Boolean {
        val request = JSONObject(requestJson).getJSONObject("request")
        requireApiClient().developmentPurchase(
            distinctId,
            DevelopmentPurchaseRequest(
                devTransactionId = request.getString("devTransactionId"),
                productSlug = request.getString("productSlug"),
                purchaseDate = request.getDouble("purchaseDate"),
                quantity = request.optInt("quantity", 1),
            ),
        )
        return true
    }

    fun injectInternalSchema(schemaJson: String) {
        requireClient().injectInternalSchema(
            com.voidhash.sdk.schema.RuntimeSchema.fromJson(JSONObject(schemaJson)),
        )
    }

    private fun requireClient(): VoidhashClient =
        client ?: throw IllegalStateException(NOT_CONFIGURED_MESSAGE)

    private fun requireApiClient(): VoidhashApiClient =
        apiClient ?: throw IllegalStateException(NOT_CONFIGURED_MESSAGE)

    companion object {
        const val NOT_CONFIGURED_MESSAGE = "CONFIGURATION_MISSING: VoidhashEngine is not configured"
    }
}
