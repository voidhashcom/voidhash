package com.voidhash.sdk.paywall

import com.voidhash.sdk.cache.fnv1aHex

/**
 * What the paywall engine an app links can run.
 *
 * The SDK sends it when it resolves a paywall, so the backend serves only flows the engine can
 * show; a flow that needs more is answered as a placement with nothing showing. An app without
 * the engine sends nothing and is served only flows the first engine release could show.
 *
 * @property packageAbiVersion The newest flow package format version the engine reads.
 * @property guestAbiVersion The newest code component ABI version the engine runs; it runs every
 *   older one.
 * @property nativeComponents The native components the engine provides, as `id@version`.
 */
data class FlowEngineCapabilities(
    val packageAbiVersion: Int,
    val guestAbiVersion: Int,
    val nativeComponents: List<String>,
) {
    /** The `resolve-paywall` headers that report the engine. */
    fun headers(): Map<String, String> = mapOf(
        PACKAGE_ABI_HEADER to packageAbiVersion.toString(),
        GUEST_ABI_HEADER to guestAbiVersion.toString(),
        NATIVE_COMPONENTS_HEADER to nativeComponents.joinToString(","),
    )

    /**
     * Identifies these capabilities in the key of a cached `resolve-paywall` answer.
     *
     * The backend answers by what the engine can run, so an answer cached for one engine must
     * not serve another: after an app update brings a newer engine, a "nothing showing" cached
     * for the old one would otherwise hide a paywall the new one can show. Native components are
     * sorted, so their order does not matter.
     */
    val cacheKey: String
        get() {
            val natives = nativeComponents.sorted().joinToString(",")
            return "e" + fnv1aHex("$packageAbiVersion|$guestAbiVersion|$natives")
        }

    companion object {
        const val PACKAGE_ABI_HEADER = "x-ui-package-abi"
        const val GUEST_ABI_HEADER = "x-ui-guest-abi"
        const val NATIVE_COMPONENTS_HEADER = "x-ui-native-components"
    }
}
