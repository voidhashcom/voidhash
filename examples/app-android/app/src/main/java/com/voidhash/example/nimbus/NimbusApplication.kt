package com.voidhash.example.nimbus

import android.app.Application
import com.voidhash.sdk.FlowCapability
import com.voidhash.sdk.Voidhash
import com.voidhash.sdk.VoidhashClient
import com.voidhash.sdk.VOIDHASH_DEFAULT_BASE_URL
import com.voidhash.sdk.VoidhashOptions

/**
 * Configures Voidhash once for the process.
 *
 * `configure` is synchronous and cheap, so it belongs here; the expensive part
 * — [VoidhashClient.initialize] — runs off the main thread from
 * [NimbusViewModel], which is also what renders its loading and failure states.
 */
class NimbusApplication : Application() {

    /**
     * The configured client, or `null` when no publishable key was supplied at
     * build time. Every screen degrades to setup instructions in that case
     * instead of the app crashing on a key it never had.
     */
    var voidhash: VoidhashClient? = null
        private set

    override fun onCreate() {
        super.onCreate()

        val publishableKey = BuildConfig.VOIDHASH_PUBLISHABLE_KEY
        if (publishableKey.isBlank()) return

        voidhash = Voidhash.configure(
            context = this,
            publishableKey = publishableKey,
            options = VoidhashOptions(
                baseUrl = BuildConfig.VOIDHASH_API_BASE_URL.ifBlank { VOIDHASH_DEFAULT_BASE_URL },
                // Debug builds buy from a mock store, so the example runs on a
                // bare emulator with no Play Console setup. Release builds
                // ignore the flag and always use real Play Billing.
                dev = true,
                debug = BuildConfig.DEBUG,
                // What flows may do besides purchasing and restoring. Asking for
                // notifications also needs POST_NOTIFICATIONS in the manifest.
                flowCapabilities = setOf(
                    FlowCapability.LINKS,
                    FlowCapability.ATTRIBUTES,
                    FlowCapability.NOTIFICATIONS,
                ),
            ),
        )
    }
}
