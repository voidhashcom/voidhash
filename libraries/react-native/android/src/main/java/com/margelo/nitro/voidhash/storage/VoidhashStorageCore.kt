package com.margelo.nitro.voidhash.storage

import android.content.Context
import com.voidhash.sdk.cache.CacheAdapter
import com.voidhash.sdk.cache.SharedPreferencesCacheAdapter

/**
 * The Nitro-free heart of `HybridVoidhashStorage`: the React Native SDK's cache store.
 *
 * Wraps the same [SharedPreferencesCacheAdapter] the Kotlin SDK persists through — same private
 * preferences file — so the TypeScript `CacheManager` and the embedded native client share one
 * cache. The adapter is resolved lazily because the application context only exists once the
 * app has started; the factory exists for tests.
 */
class VoidhashStorageCore(
    private val contextProvider: () -> Context?,
    private val adapterFactory: (Context) -> CacheAdapter = { SharedPreferencesCacheAdapter(it) },
) {
    private val adapter: CacheAdapter by lazy {
        val context = requireNotNull(contextProvider()) {
            "CONFIGURATION_MISSING: VoidhashStorage used before the application started"
        }
        adapterFactory(context)
    }

    fun get(key: String): String? = adapter.get(key)

    fun set(key: String, value: String) = adapter.set(key, value)

    fun delete(key: String) = adapter.delete(key)
}
