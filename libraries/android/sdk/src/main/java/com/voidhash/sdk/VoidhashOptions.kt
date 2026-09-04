package com.voidhash.sdk

import com.voidhash.sdk.analytics.ScreenView
import com.voidhash.sdk.diagnostics.VoidhashDiagnostic

/** SDK version reported through `x-sdk-version`; matches the npm package version. */
const val VOIDHASH_SDK_VERSION: String = "0.0.1-alpha.1"

/** Default Voidhash API origin. */
const val VOIDHASH_DEFAULT_BASE_URL: String = "https://api.voidhash.com"

/** Prefix of every anonymous distinct id the SDK generates. */
const val ANONYMOUS_DISTINCT_ID_PREFIX: String = "vh:anon:"

// Temporary release gate. Transaction observation and submission intentionally stay active while
// SDK-started purchases and hosted paywalls are unavailable.
internal const val COMMERCE_FEATURES_ENABLED: Boolean = false

/**
 * Configuration for [Voidhash.configure].
 *
 * @property baseUrl origin of the Voidhash API.
 * @property ingestUrl origin of the analytics ingest API; defaults to [baseUrl].
 * @property debug forces `x-is-debug-build` and enables verbose logging.
 * @property distinctId pins the initial distinct id instead of generating an anonymous one.
 * @property enabled when false the client is inert: no network, no billing connection.
 * @property readOnly observer mode — transactions are synced but never finished with the store.
 *   The current release always enables this mode while commerce is unavailable.
 * @property dev requests development mode. Honored only in debug builds: there purchases run
 *   against a mock store and are recorded under the development environment, never charged.
 *   In a release build (or with `dev = false`) the real Play Billing store is used.
 * @property screenTracking configures the automatic `$screen` event.
 * @property automaticLifecycleEvents captures `$app_installed`, `$app_updated`, `$app_opened`,
 *   `$app_backgrounded`, `$app_became_active` and `$sign_out`. Hosts that emit these events
 *   themselves (the React Native SDK) turn it off.
 * @property preloadPlacements paywall locations to fetch and cache on the first launch, so a
 *   paywall can be presented before the device has ever resolved it online. Locations the
 *   device has already resolved are remembered and preloaded without being listed here.
 * @property onDiagnostic receives structured reports about situations the SDK handled on its
 *   own: dropped events, an open circuit, a rejected key, an unreadable cache entry. Called
 *   from background threads; exceptions it raises are swallowed.
 */
data class VoidhashOptions(
    val baseUrl: String = VOIDHASH_DEFAULT_BASE_URL,
    val ingestUrl: String? = null,
    val debug: Boolean = false,
    val distinctId: String? = null,
    val enabled: Boolean = true,
    val readOnly: Boolean = true,
    val dev: Boolean = false,
    val screenTracking: ScreenTrackingOptions = ScreenTrackingOptions(),
    val automaticLifecycleEvents: Boolean = true,
    val preloadPlacements: List<String> = emptyList(),
    val onDiagnostic: ((VoidhashDiagnostic) -> Unit)? = null,
)

/**
 * Configuration of the automatic `$screen` event.
 *
 * @property automatic captures a screen for every resumed activity. Off, only
 *   [VoidhashClient.screen] and [VoidhashScreenTracking] produce screens.
 * @property fragments also captures resumed AndroidX fragments and suppresses the
 *   screen of the activities hosting them. Requires `androidx.fragment` on the classpath.
 * @property includeParams adds `$screen_params` (route arguments, string-coerced, at most
 *   20 keys). Off by default because arguments routinely carry ids and tokens.
 * @property mapScreen rewrites a screen before capture; returning `null` drops it.
 */
data class ScreenTrackingOptions(
    val automatic: Boolean = true,
    val fragments: Boolean = false,
    val includeParams: Boolean = false,
    val mapScreen: ((ScreenView) -> ScreenView?)? = null,
)
