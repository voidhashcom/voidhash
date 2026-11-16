package com.voidhash.sdk.platform

import android.content.Context
import android.content.pm.ApplicationInfo
import android.os.Build

/**
 * Device and app metadata reported through the common SDK headers and the
 * standardized analytics properties.
 *
 * Held as plain data so header building stays unit-testable without an Android
 * runtime.
 *
 * @property firstInstallTime when this install of the app was made, in epoch milliseconds;
 *   `null` when unknown. A reinstall or a new device has a new one, even where Android restored
 *   the app's data from a backup.
 * @property lastUpdateTime when the running version of the app was installed, in epoch
 *   milliseconds; `null` when unknown.
 */
data class PlatformInfo(
    val bundleId: String,
    val appVersion: String?,
    val systemVersion: String?,
    val deviceBrand: String?,
    val deviceName: String?,
    val locales: List<String>,
    val isDebugBuild: Boolean,
    val appName: String? = null,
    val appBuild: String? = null,
    val firstInstallTime: Long? = null,
    val lastUpdateTime: Long? = null,
) {
    companion object {
        /** Reads the platform metadata off [context]. */
        @Suppress("DEPRECATION")
        fun fromContext(context: Context): PlatformInfo {
            val packageName = context.packageName ?: ""
            val packageInfo = runCatching {
                context.packageManager.getPackageInfo(packageName, 0)
            }.getOrNull()

            val appBuild = packageInfo?.let { info ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    info.longVersionCode.toString()
                } else {
                    info.versionCode.toString()
                }
            }

            return PlatformInfo(
                bundleId = packageName,
                appVersion = packageInfo?.versionName,
                systemVersion = Build.VERSION.RELEASE,
                deviceBrand = Build.BRAND,
                deviceName = Build.MODEL,
                locales = readLocales(context),
                isDebugBuild = (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0,
                appName = runCatching {
                    context.applicationInfo.loadLabel(context.packageManager).toString()
                }.getOrNull(),
                appBuild = appBuild,
                firstInstallTime = packageInfo?.firstInstallTime?.takeIf { it > 0 },
                lastUpdateTime = packageInfo?.lastUpdateTime?.takeIf { it > 0 },
            )
        }

        /**
         * Reads every preferred locale, not just the primary one — `LocaleList`
         * only exists from API 24, so older devices keep the single-locale
         * configuration field.
         */
        @Suppress("DEPRECATION")
        private fun readLocales(context: Context): List<String> {
            val configuration = context.resources.configuration

            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
                return listOfNotNull(configuration.locale?.toLanguageTag())
            }

            val localeList = configuration.locales
            return (0 until localeList.size()).mapNotNull { index ->
                localeList[index]?.toLanguageTag()
            }
        }
    }
}
