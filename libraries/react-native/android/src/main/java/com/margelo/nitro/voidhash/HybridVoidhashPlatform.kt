package com.margelo.nitro.voidhash

import android.content.Context
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import com.margelo.nitro.voidhash.platform.VoidhashPlatformCore

/**
 * Exposes the bare-native platform metadata to the React Native SDK. The behaviour lives in
 * [VoidhashPlatformCore]; this class only maps its snapshot into the Nitro struct.
 */
@Keep
@DoNotStrip
class HybridVoidhashPlatform : HybridVoidhashPlatformSpec() {
    private val core = VoidhashPlatformCore()

    override fun getInfo(): NativePlatformInfo {
        val context: Context = requireNotNull(NitroModules.applicationContext) {
            "CONFIGURATION_MISSING: VoidhashPlatform used before the application started"
        }
        val snapshot = core.snapshot(context)
        return NativePlatformInfo(
            bundleId = snapshot.bundleId,
            appBuild = snapshot.appBuild,
            appName = snapshot.appName,
            appVersion = snapshot.appVersion,
            systemVersion = snapshot.systemVersion,
            deviceBrand = snapshot.deviceBrand,
            deviceName = snapshot.deviceName,
            locales = snapshot.locales.toTypedArray(),
            isDebugBuild = snapshot.isDebugBuild,
            urlSchemes = snapshot.urlSchemes.toTypedArray(),
        )
    }
}
