package com.voidhash.sdk

/** SDK version reported through `x-sdk-version`; matches the npm package version. */
const val VOIDHASH_SDK_VERSION: String = "0.0.1-alpha.1"

/** Default Voidhash API origin. */
const val VOIDHASH_DEFAULT_BASE_URL: String = "https://api.voidhash.com"

/** Prefix of every anonymous distinct id the SDK generates. */
const val ANONYMOUS_DISTINCT_ID_PREFIX: String = "vh:anon:"

/**
 * Configuration for [Voidhash.configure].
 *
 * @property baseUrl origin of the Voidhash API.
 * @property ingestUrl origin of the analytics ingest API; defaults to [baseUrl].
 * @property debug forces `x-is-debug-build` and enables verbose logging.
 * @property distinctId pins the initial distinct id instead of generating an anonymous one.
 * @property enabled when false the client is inert: no network, no billing connection.
 * @property readOnly observer mode — transactions are synced but never finished with the store.
 */
data class VoidhashOptions(
    val baseUrl: String = VOIDHASH_DEFAULT_BASE_URL,
    val ingestUrl: String? = null,
    val debug: Boolean = false,
    val distinctId: String? = null,
    val enabled: Boolean = true,
    val readOnly: Boolean = false,
)
