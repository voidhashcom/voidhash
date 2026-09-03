package com.margelo.nitro.voidhash.platform

import android.content.Context
import android.content.pm.PackageManager
import com.voidhash.sdk.platform.PlatformInfo

/** Manifest meta-data key the Expo config plugin writes the app's URL scheme(s) into. */
const val SCHEME_META_DATA_KEY = "com.voidhash.sdk.scheme"

/**
 * Host app and device metadata as the React Native SDK reports it; the Nitro-free shape of the
 * `NativePlatformInfo` struct the `VoidhashPlatform` hybrid returns.
 */
data class NativePlatformSnapshot(
    val bundleId: String,
    val appBuild: String?,
    val appName: String?,
    val appVersion: String?,
    val systemVersion: String?,
    val deviceBrand: String?,
    val deviceName: String?,
    val locales: List<String>,
    val isDebugBuild: Boolean,
    val urlSchemes: List<String>,
)

/**
 * The Nitro-free heart of `HybridVoidhashPlatform`: reads the platform metadata from the same
 * [PlatformInfo] the Kotlin SDK builds its headers from, plus the URL scheme(s) the config plugin
 * mirrored into the manifest.
 *
 * Kept separate from the hybrid so it can be unit tested on the JVM without React Native or
 * Nitro; the hybrid only maps the snapshot into the generated struct. The factory exists for tests.
 */
class VoidhashPlatformCore(
    private val platformInfoProvider: (Context) -> PlatformInfo = PlatformInfo::fromContext,
) {
    /** Builds the snapshot for the app [context] belongs to. */
    fun snapshot(context: Context): NativePlatformSnapshot =
        snapshot(platformInfoProvider(context), readUrlSchemes(context))

    /** Maps the Kotlin SDK's [info] plus the manifest [urlSchemes] onto the snapshot. */
    fun snapshot(info: PlatformInfo, urlSchemes: List<String>): NativePlatformSnapshot =
        NativePlatformSnapshot(
            bundleId = info.bundleId,
            appBuild = info.appBuild,
            appName = info.appName,
            appVersion = info.appVersion,
            systemVersion = info.systemVersion,
            deviceBrand = info.deviceBrand,
            deviceName = info.deviceName,
            locales = info.locales,
            isDebugBuild = info.isDebugBuild,
            urlSchemes = urlSchemes,
        )

    /**
     * Android cannot enumerate its own intent-filter schemes, so the config plugin mirrors the
     * Expo `scheme` into manifest meta-data (comma-separated when there are several).
     */
    fun readUrlSchemes(context: Context): List<String> {
        val metaData = runCatching {
            context.packageManager
                .getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
                .metaData
        }.getOrNull() ?: return emptyList()
        return parseSchemes(metaData.getString(SCHEME_META_DATA_KEY))
    }

    companion object {
        /** Splits the comma-separated meta-data value, trimming entries and dropping blanks. */
        fun parseSchemes(raw: String?): List<String> =
            raw.orEmpty().split(",").map { it.trim() }.filter { it.isNotEmpty() }
    }
}
