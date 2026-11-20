package com.voidhash.sdk.flows

import com.voidhash.sdk.cache.fnv1aHex

/**
 * What the paywall engine an app links can run.
 *
 * The SDK sends it when it resolves a paywall, so the backend serves only flows the engine can
 * show; a flow that needs more is answered as a location with nothing showing. An app without
 * the engine sends nothing and is served only flows the first engine release could show.
 *
 * @property packageAbiVersion The newest flow package format version the engine reads.
 * @property guestAbiVersion The newest code component ABI version the engine runs; it runs every
 *   older one.
 * @property nativeComponents The native components the engine provides, as `id@version`.
 * @property runtimeBridgeVersion The newest runtime bridge the engine hosts when it runs the flow
 *   runtime as a downloaded module, else `null`. Such an engine reads no package format itself,
 *   so the backend serves it any release a runtime module is offered for.
 */
data class FlowEngineCapabilities(
    val packageAbiVersion: Int,
    val guestAbiVersion: Int,
    val nativeComponents: List<String>,
    val runtimeBridgeVersion: Int? = null,
) {
    /** The `resolve-paywall` headers that report the engine. */
    fun headers(): Map<String, String> = buildMap {
        put(PACKAGE_ABI_HEADER, packageAbiVersion.toString())
        put(GUEST_ABI_HEADER, guestAbiVersion.toString())
        put(NATIVE_COMPONENTS_HEADER, nativeComponents.joinToString(","))
        runtimeBridgeVersion?.let { put(RUNTIME_BRIDGE_HEADER, it.toString()) }
    }

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
            // An engine running modules is served by other rules, so its answers are its own; the
            // key of an engine running the linked runtime is unchanged.
            val runtime = runtimeBridgeVersion?.let { "|r$it" } ?: ""
            return "e" + fnv1aHex("$packageAbiVersion|$guestAbiVersion|$natives$runtime")
        }

    companion object {
        const val PACKAGE_ABI_HEADER = "x-ui-package-abi"
        const val GUEST_ABI_HEADER = "x-ui-guest-abi"
        const val NATIVE_COMPONENTS_HEADER = "x-ui-native-components"
        const val RUNTIME_BRIDGE_HEADER = "x-ui-runtime-bridge"
    }
}
