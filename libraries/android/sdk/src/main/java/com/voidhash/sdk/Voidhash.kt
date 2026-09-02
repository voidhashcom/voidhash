package com.voidhash.sdk

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.voidhash.core.billing.BillingEngine
import com.voidhash.core.paywall.PaywallPresenterCore
import com.voidhash.sdk.analytics.AnalyticsClient
import com.voidhash.sdk.analytics.AnalyticsSessionManager
import com.voidhash.sdk.analytics.analyticsStandardProperties
import com.voidhash.sdk.api.SdkHeaders
import com.voidhash.sdk.api.VoidhashApiClient
import com.voidhash.sdk.billing.DefaultBillingEnginePort
import com.voidhash.sdk.billing.DevelopmentBillingEngine
import com.voidhash.sdk.billing.BillingEnginePort
import com.voidhash.sdk.cache.CacheManager
import com.voidhash.sdk.cache.SharedPreferencesCacheAdapter
import com.voidhash.sdk.identity.IdentityStore
import com.voidhash.sdk.lifecycle.VoidhashActivityLifecycleCallbacks
import com.voidhash.sdk.paywall.DefaultPaywallPresenterPort
import com.voidhash.sdk.paywall.PaywallCoordinator
import com.voidhash.sdk.platform.PlatformInfo
import com.voidhash.sdk.schema.RuntimeSchema
import com.voidhash.sdk.schema.SchemaManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import okhttp3.OkHttpClient
import java.lang.ref.WeakReference
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

private const val LOG_TAG = "Voidhash"

/**
 * Entry point of the Voidhash Android SDK.
 *
 * ```kotlin
 * val voidhash = Voidhash.configure(context, "pk_live_…")
 * lifecycleScope.launch { voidhash.initialize() }
 * ```
 */
object Voidhash {
    @Volatile
    private var instance: VoidhashClient? = null

    @Volatile
    private var activeScope: CoroutineScope? = null

    @Volatile
    private var activeLifecycleCallbacks: Pair<Application, Application.ActivityLifecycleCallbacks>? = null

    /** The client created by the most recent [configure] call. */
    @JvmStatic
    val shared: VoidhashClient?
        get() = instance

    /**
     * Configures the SDK and returns the client.
     *
     * Configuration is cheap and synchronous; call
     * [VoidhashClient.initialize] to connect to the store and resolve the
     * project schema. Re-configuring replaces the previous client and stops its
     * background work.
     */
    @JvmStatic
    @JvmOverloads
    fun configure(
        context: Context,
        publishableKey: String,
        options: VoidhashOptions = VoidhashOptions(),
    ): VoidhashClient {
        // The previous client owns a scope running the analytics daemon and the
        // schema refresh; replacing the client has to stop them.
        activeScope?.cancel()
        activeLifecycleCallbacks?.let { (application, callbacks) ->
            application.unregisterActivityLifecycleCallbacks(callbacks)
        }
        activeLifecycleCallbacks = null

        val applicationContext = context.applicationContext
        val platform = PlatformInfo.fromContext(applicationContext)
        // Development mode is a debug-build-only affordance: the flag alone is
        // never enough, so it can never reach a production release.
        val developmentMode = options.dev && platform.isDebugBuild
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        activeScope = scope

        // Every hook below reads the client it was built for instead of the
        // `instance` singleton, which a later `configure()` moves elsewhere.
        val clientRef = AtomicReference<VoidhashClient?>(null)

        val cacheManager = CacheManager(SharedPreferencesCacheAdapter(applicationContext))
        val identityStore = IdentityStore(cacheManager)
        options.distinctId?.let(identityStore::setDistinctId)

        val currentActivity = ActivityHolder()
        val readOnlyRef = AtomicBoolean(options.readOnly || !COMMERCE_FEATURES_ENABLED)
        val readOnlyProvider = { clientRef.get()?.currentReadOnly ?: readOnlyRef.get() }

        val httpClient = OkHttpClient()
        val headers = SdkHeaders(
            publishableKey = publishableKey,
            platform = platform,
            readOnlyProvider = readOnlyProvider,
            debugProvider = { options.debug },
            environmentProvider = { if (developmentMode) "development" else "production" },
        )
        val apiClient = VoidhashApiClient(options.baseUrl, headers, httpClient)

        val billing: BillingEnginePort = if (developmentMode) {
            DevelopmentBillingEngine(activityProvider = { currentActivity.get() }, onWarning = ::warn)
        } else {
            DefaultBillingEnginePort(
                BillingEngine(
                    contextProvider = { applicationContext },
                    activityProvider = { currentActivity.get() },
                    isPlayServicesAvailable = { billingContext ->
                        GoogleApiAvailability
                            .getInstance()
                            .isGooglePlayServicesAvailable(billingContext) == ConnectionResult.SUCCESS
                    },
                    onWarning = ::warn,
                ),
            )
        }

        // The dev store catalog tracks the schema so the mock sheet can render
        // names and prices; the real store needs no catalog.
        val devCatalogUpdater = (billing as? DevelopmentBillingEngine)?.let { engine ->
            { schema: RuntimeSchema -> engine.updateCatalog(schema) }
        }
        val onSchemaResolved: (RuntimeSchema) -> Unit = { schema ->
            devCatalogUpdater?.invoke(schema)
            clientRef.get()?.publishSchema(schema)
        }

        val orchestrator = PurchaseOrchestrator(
            billing = billing,
            apiClient = apiClient,
            cacheManager = cacheManager,
            identityStore = identityStore,
            readOnlyProvider = readOnlyProvider,
            developmentMode = developmentMode,
            onPersonRefresh = { clientRef.get()?.getCurrentPerson(forceFetch = true) },
            onWarning = ::warn,
        )

        val sessionManager = AnalyticsSessionManager(cacheManager, onWarning = ::warn)
        val analyticsClient = AnalyticsClient(
            ingestUrl = options.ingestUrl ?: options.baseUrl,
            publishableKey = publishableKey,
            distinctIdProvider = identityStore::getDistinctId,
            sessionIdProvider = sessionManager::current,
            httpClient = httpClient,
            standardProperties = { analyticsStandardProperties(platform) },
            onWarning = ::warn,
        )

        val application = applicationContext as? Application
        val lifecycleCallbacks = VoidhashActivityLifecycleCallbacks(
            clientProvider = { clientRef.get() },
            screenTracking = options.screenTracking,
        )
        val detachLifecycleCallbacks = {
            if (activeLifecycleCallbacks?.second === lifecycleCallbacks) {
                application?.unregisterActivityLifecycleCallbacks(lifecycleCallbacks)
                activeLifecycleCallbacks = null
            }
        }

        val presenter = PaywallPresenterCore(
            contextProvider = { applicationContext },
            activityProvider = { currentActivity.get() },
            onLoadFailed = { locationSlug, description ->
                warn("Paywall for location \"$locationSlug\" failed to load: $description")
            },
        )

        val client = VoidhashClient(
            apiClient = apiClient,
            cacheManager = cacheManager,
            identityStore = identityStore,
            schemaManager = SchemaManager(
                apiClient = apiClient,
                cacheManager = cacheManager,
                appVersion = platform.appVersion,
                refreshScope = scope,
                onSchema = onSchemaResolved,
                onWarning = ::warn,
            ),
            orchestrator = orchestrator,
            analyticsClient = analyticsClient,
            sessionManager = sessionManager,
            billing = billing,
            scope = scope,
            paywallCoordinatorFactory = { purchaseHandler ->
                PaywallCoordinator(
                    presenter = DefaultPaywallPresenterPort(presenter),
                    purchaseHandler = purchaseHandler,
                    resolvePaywall = { locationSlug ->
                        apiClient.resolvePaywall(identityStore.getDistinctId(), locationSlug)
                    },
                    openExternal = { url -> openExternal(applicationContext, url) },
                    locale = platform.locales.firstOrNull(),
                    onCapture = { name, properties ->
                        clientRef.get()?.capture(name, properties)
                    },
                    onWarning = ::warn,
                )
            },
            activitySink = currentActivity::set,
            enabled = options.enabled,
            readOnly = options.readOnly || !COMMERCE_FEATURES_ENABLED,
            onWarning = ::warn,
            platform = platform,
            screenTracking = options.screenTracking,
            automaticLifecycleEvents = options.automaticLifecycleEvents,
            onShutdown = detachLifecycleCallbacks,
        )

        clientRef.set(client)
        instance = client

        val observesActivities = options.automaticLifecycleEvents || options.screenTracking.automatic
        if (application != null && options.enabled && observesActivities) {
            application.registerActivityLifecycleCallbacks(lifecycleCallbacks)
            activeLifecycleCallbacks = application to lifecycleCallbacks
        }
        return client
    }

    private fun warn(message: String) {
        Log.w(LOG_TAG, message)
    }

    private fun openExternal(context: Context, url: String) {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    private class ActivityHolder {
        private var reference: WeakReference<Activity>? = null

        fun get(): Activity? = reference?.get()

        fun set(activity: Activity?) {
            reference = activity?.let { WeakReference(it) }
        }
    }
}
