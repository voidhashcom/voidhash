package com.margelo.nitro.voidhash

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import com.margelo.nitro.voidhash.storage.VoidhashStorageCore

/**
 * Exposes the bare-native cache store to the React Native SDK. The behaviour lives in
 * [VoidhashStorageCore]; this class only bridges it into Nitro.
 */
@Keep
@DoNotStrip
class HybridVoidhashStorage : HybridVoidhashStorageSpec() {
    private val core = VoidhashStorageCore(contextProvider = { NitroModules.applicationContext })

    override fun get(key: String): Promise<String?> {
        return Promise.async { core.get(key) }
    }

    override fun set(key: String, value: String): Promise<Unit> {
        return Promise.async { core.set(key, value) }
    }

    override fun delete(key: String): Promise<Unit> {
        return Promise.async { core.delete(key) }
    }
}
