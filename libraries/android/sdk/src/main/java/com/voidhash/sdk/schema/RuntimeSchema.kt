package com.voidhash.sdk.schema

import org.json.JSONException
import org.json.JSONObject

/**
 * An offer of a product on one store.
 *
 * @property id how paywalls and apps name the offer; the same on every store.
 * @property offerId the store's identifier: a Play developer offer id on the product's base plan.
 */
data class RuntimeStoreOffer(
    val id: String,
    val offerId: String,
)

/** Google Play provider configuration of a product. */
data class RuntimeGooglePlayConfiguration(
    val productId: String,
    val basePlanId: String?,
    val offers: List<RuntimeStoreOffer> = emptyList(),
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

/**
 * A product as defined in the project schema.
 *
 * @property id the product's Voidhash id, which a person's subscriptions name.
 */
data class RuntimeProductDefinition(
    val id: String,
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
        /** The well-formed entries of a provider configuration's `offers` list. */
        private fun parseOffers(configuration: JSONObject): List<RuntimeStoreOffer> {
            val offers = configuration.optJSONArray("offers") ?: return emptyList()
            return (0 until offers.length()).mapNotNull { index ->
                val offer = offers.optJSONObject(index) ?: return@mapNotNull null
                val id = offer.optString("id")
                val offerId = offer.optString("offerId")
                if (id.isEmpty() || offerId.isEmpty()) null else RuntimeStoreOffer(id, offerId)
            }
        }

        /**
         * The schema a client has when the backend has never been reachable.
         *
         * Store operations answer from it rather than failing: an app that asks for its
         * products on a cold offline launch gets an empty list, which it can render, instead
         * of an exception it has to catch.
         */
        val EMPTY: RuntimeSchema = RuntimeSchema("", emptyMap(), emptyMap())

        /**
         * Parses the schema response body. A product or location entry that is not an object
         * is skipped rather than failing the whole schema. A product without its `id`, as
         * schemas cached by earlier releases have, fails it: such a schema is undecodable, and a
         * cached one is discarded and fetched again.
         */
        fun fromJson(json: JSONObject): RuntimeSchema {
            val products = json.optJSONObject("products") ?: JSONObject()
            val locations = json.optJSONObject("locations") ?: JSONObject()

            return RuntimeSchema(
                version = json.optString("version"),
                products = products.keys().asSequence().mapNotNull { slug ->
                    val product = products.optJSONObject(slug) ?: return@mapNotNull null
                    val providers = product.optJSONObject("configuration")
                        ?.optJSONObject("providers")
                    val id = product.optString("id").ifEmpty {
                        throw JSONException("The schema's product \"$slug\" has no id")
                    }
                    slug to RuntimeProductDefinition(
                        id = id,
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
                                    offers = parseOffers(it),
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
                }.toMap(),
                locations = locations.keys().asSequence().mapNotNull { slug ->
                    val location = locations.optJSONObject(slug) ?: return@mapNotNull null
                    slug to RuntimeLocationDefinition(
                        slug = location.optString("slug", slug),
                        name = location.optString("name"),
                        description = if (location.isNull("description")) {
                            null
                        } else {
                            location.optString("description").ifEmpty { null }
                        },
                    )
                }.toMap(),
            )
        }
    }
}
