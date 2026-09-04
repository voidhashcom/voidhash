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

/** Development-provider configuration of a product, used by the mock store. */
data class RuntimeDevelopmentConfiguration(
    val productId: String,
    val price: Double,
    val currencyCode: String,
    val period: String,
    val periodCount: Int,
    val duration: String?,
    val warning: String?,
)

/** Store providers a product is configured for. */
data class RuntimeProductProviders(
    val googlePlay: RuntimeGooglePlayConfiguration? = null,
    val appleAppStore: RuntimeAppleAppStoreConfiguration? = null,
    val development: RuntimeDevelopmentConfiguration? = null,
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
        /**
         * The schema a client has when the backend has never been reachable.
         *
         * Store operations answer from it rather than failing: an app that asks for its
         * products on a cold offline launch gets an empty list, which it can render, instead
         * of an exception it has to catch.
         */
        val EMPTY: RuntimeSchema = RuntimeSchema("", emptyMap(), emptyMap())

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
                            development = providers?.optJSONObject("development")?.let {
                                RuntimeDevelopmentConfiguration(
                                    productId = it.optString("productId"),
                                    price = it.optDouble("price"),
                                    currencyCode = it.optString("currencyCode"),
                                    period = it.optString("period"),
                                    periodCount = it.optInt("periodCount", 1),
                                    duration = if (it.isNull("duration")) {
                                        null
                                    } else {
                                        it.optString("duration").ifEmpty { null }
                                    },
                                    warning = if (it.isNull("warning")) {
                                        null
                                    } else {
                                        it.optString("warning").ifEmpty { null }
                                    },
                                )
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
