package com.voidhash.sdk.schema

import org.json.JSONObject

/** Google Play provider configuration of a product. */
data class RuntimeGooglePlayConfiguration(
    val productId: String,
    val basePlanId: String?,
)

/** Apple App Store provider configuration of a product. */
data class RuntimeAppleAppStoreConfiguration(
    val productId: String,
)

/** Store providers a product is configured for. */
data class RuntimeProductProviders(
    val googlePlay: RuntimeGooglePlayConfiguration? = null,
    val appleAppStore: RuntimeAppleAppStoreConfiguration? = null,
)

/** A product as defined in the project schema. */
data class RuntimeProductDefinition(
    val slug: String,
    val type: String,
    val name: String,
    val providers: RuntimeProductProviders,
)

/** A paywall location as defined in the project schema. */
data class RuntimeLocationDefinition(
    val slug: String,
    val name: String,
    val description: String?,
)

/** The project schema as fetched from `/api/v1/sdk/schema`, keyed by slug. */
data class RuntimeSchema(
    val version: String,
    val products: Map<String, RuntimeProductDefinition>,
    val locations: Map<String, RuntimeLocationDefinition>,
) {
    companion object {
        /** Parses the schema response body. */
        fun fromJson(json: JSONObject): RuntimeSchema {
            val products = json.optJSONObject("products") ?: JSONObject()
            val locations = json.optJSONObject("locations") ?: JSONObject()

            return RuntimeSchema(
                version = json.optString("version"),
                products = products.keys().asSequence().associateWith { slug ->
                    val product = products.getJSONObject(slug)
                    val providers = product.optJSONObject("configuration")
                        ?.optJSONObject("providers")
                    RuntimeProductDefinition(
                        slug = product.optString("slug", slug),
                        type = product.optString("type"),
                        name = product.optJSONObject("properties")?.optString("name").orEmpty(),
                        providers = RuntimeProductProviders(
                            googlePlay = providers?.optJSONObject("googlePlay")?.let {
                                RuntimeGooglePlayConfiguration(
                                    productId = it.optString("productId"),
                                    basePlanId = if (it.isNull("basePlanId")) {
                                        null
                                    } else {
                                        it.optString("basePlanId").ifEmpty { null }
                                    },
                                )
                            },
                            appleAppStore = providers?.optJSONObject("appleAppStore")?.let {
                                RuntimeAppleAppStoreConfiguration(it.optString("productId"))
                            },
                        ),
                    )
                },
                locations = locations.keys().asSequence().associateWith { slug ->
                    val location = locations.getJSONObject(slug)
                    RuntimeLocationDefinition(
                        slug = location.optString("slug", slug),
                        name = location.optString("name"),
                        description = if (location.isNull("description")) {
                            null
                        } else {
                            location.optString("description").ifEmpty { null }
                        },
                    )
                },
            )
        }
    }
}
