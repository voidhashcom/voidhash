package com.margelo.nitro.voidhash

import android.content.Context
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import com.voidhash.sdk.Voidhash
import com.voidhash.sdk.VoidhashClient
import com.voidhash.sdk.VoidhashOptions
import com.voidhash.sdk.api.DevelopmentPurchaseRequest
import com.voidhash.sdk.api.SdkHeaders
import com.voidhash.sdk.api.SyncTransactionRequest
import com.voidhash.sdk.api.VoidhashApiClient
import org.json.JSONArray
import org.json.JSONObject

private class EngineOptions(optionsJson: String) {
    private val json = JSONObject(optionsJson)

    val baseUrl: String? = json.optStringOrNull("baseUrl")
    val ingestUrl: String? = json.optStringOrNull("ingestUrl")
    val debug: Boolean = json.optBoolean("debug", false)
    val enabled: Boolean = json.optBoolean("enabled", true)
    val readOnly: Boolean = json.optBoolean("readOnly", false)
    val dev: Boolean = json.optBoolean("dev", false)
}

private fun JSONObject.optStringOrNull(key: String): String? {
    if (!has(key) || isNull(key)) return null
    return optString(key)
}

/**
 * Embeds the bare-native [VoidhashClient] as the React Native SDK's data-plane transport.
 *
 * Every operation takes the distinct id explicitly — identity stays JS-owned, so both sides
 * can never diverge. Headers and environment mode are built by the native client exactly like
 * a pure-native integration.
 */
@Keep
@DoNotStrip
class HybridVoidhashEngine : HybridVoidhashEngineSpec() {
    @Volatile
    private var apiClient: VoidhashApiClient? = null

    @Volatile
    private var client: VoidhashClient? = null

    override fun configure(publishableKey: String, optionsJson: String) {
        val context: Context = requireNotNull(NitroModules.applicationContext) {
            "CONFIGURATION_MISSING: VoidhashEngine configured before the application started"
        }
        val platform = com.voidhash.sdk.platform.PlatformInfo.fromContext(context)
        val options = EngineOptions(optionsJson)
        val voidhashOptions = VoidhashOptions(
            baseUrl = options.baseUrl ?: "https://api.voidhash.com",
            ingestUrl = options.ingestUrl,
            debug = options.debug,
            enabled = options.enabled,
            readOnly = options.readOnly,
            dev = options.dev,
        )
        // Configures the shared client for schema resolution side effects; the engine never
        // calls initialize(), so no billing connection is ever opened.
        client = Voidhash.configure(context, publishableKey, voidhashOptions)
        apiClient = VoidhashApiClient(
            voidhashOptions.baseUrl,
            SdkHeaders(
                publishableKey = publishableKey,
                platform = platform,
                readOnlyProvider = { options.readOnly },
                debugProvider = { options.debug },
                environmentProvider = {
                    if (options.dev && platform.isDebugBuild) "development" else "production"
                },
            ),
        )
    }

    override fun fetchSchema(distinctId: String): Promise<String> {
        return Promise.async {
            requireApiClient().getSchema(distinctId).toString()
        }
    }

    override fun fetchPerson(distinctId: String, forceFetch: Boolean): Promise<String> {
        return Promise.async {
            val person = requireApiClient().getPerson(distinctId) ?: return@async "null"
            person.raw.toString()
        }
    }

    override fun identify(distinctId: String, bodyJson: String): Promise<String> {
        val body = JSONObject(bodyJson)
        return Promise.async {
            val person = requireApiClient().identify(
                distinctId,
                body.getString("distinctId"),
                body.optStringOrNull("email"),
                body.optStringOrNull("name"),
            )
            person.raw.toString()
        }
    }

    override fun setPersonAttributes(distinctId: String, attributesJson: String): Promise<String> {
        val body = JSONObject(attributesJson)
        val traits = body.optJSONObject("traits") ?: JSONObject()
        return Promise.async {
            val email = body.optStringOrNull("email")
            if (email != null) traits.put("email", email)
            val name = body.optStringOrNull("name")
            if (name != null) traits.put("name", name)

            val attributes = LinkedHashMap<String, Any?>()
            for (key in traits.keys()) {
                attributes[key] = traits.get(key).takeUnless { it == JSONObject.NULL }
            }
            requireApiClient().setPersonAttributes(distinctId, attributes)
            val person = requireApiClient().getPerson(distinctId)
            person?.raw?.toString() ?: "null"
        }
    }

    override fun evaluateFlags(distinctId: String, flagKeysJson: String): Promise<String> {
        val keys = JSONArray(flagKeysJson).let { array ->
            (0 until array.length()).map { array.getString(it) }
        }
        return Promise.async {
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
            response.toString()
        }
    }

    override fun resolvePaywall(distinctId: String, locationSlug: String): Promise<String> {
        return Promise.async {
            requireApiClient().resolvePaywallRaw(distinctId, locationSlug)?.toString() ?: "null"
        }
    }

    override fun syncTransaction(distinctId: String, requestJson: String): Promise<Boolean> {
        val request = JSONObject(requestJson).getJSONObject("request")
        return Promise.async {
            requireApiClient().syncTransaction(
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
    }

    override fun developmentPurchase(distinctId: String, requestJson: String): Promise<Boolean> {
        val request = JSONObject(requestJson).getJSONObject("request")
        return Promise.async {
            requireApiClient().developmentPurchase(
                distinctId,
                DevelopmentPurchaseRequest(
                    devTransactionId = request.getString("devTransactionId"),
                    productSlug = request.getString("productSlug"),
                    purchaseDate = request.getDouble("purchaseDate"),
                    quantity = request.optInt("quantity", 1),
                ),
            )
            true
        }
    }

    override fun injectInternalSchema(schemaJson: String): Promise<Unit> {
        val schema = com.voidhash.sdk.schema.RuntimeSchema.fromJson(JSONObject(schemaJson))
        return Promise.async {
            client?.injectInternalSchema(schema)
        }
    }

    private fun requireApiClient(): VoidhashApiClient =
        apiClient ?: throw IllegalStateException(
            "CONFIGURATION_MISSING: VoidhashEngine is not configured",
        )
}
