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
import com.voidhash.sdk.cache.cacheKeyPrefix
import com.voidhash.sdk.diagnostics.DiagnosticEmitter
import com.voidhash.sdk.identity.IdentityStore
import com.voidhash.sdk.lifecycle.VoidhashActivityLifecycleCallbacks
import com.voidhash.sdk.network.AndroidConnectivityMonitor
import com.voidhash.sdk.network.CircuitBreaker
import com.voidhash.sdk.network.ConnectivityMonitor
import com.voidhash.sdk.network.OutboundGate
import com.voidhash.sdk.network.SystemSdkClock
import com.voidhash.sdk.network.buildSdkHttpClient
import com.voidhash.sdk.storage.FileRecordStore
import com.voidhash.sdk.storage.PersistenceWriter
import com.voidhash.sdk.transactions.PersonWriteOutbox
import com.voidhash.sdk.transactions.TransactionOutbox
import com.voidhash.sdk.paywall.DefaultPaywallPresenterPort
import com.voidhash.sdk.paywall.PaywallCoordinator
import com.voidhash.sdk.platform.PlatformInfo
import com.voidhash.sdk.schema.RuntimeSchema
import com.voidhash.sdk.schema.SchemaManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import java.io.File
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

    @Volatile
    private var activeConnectivityMonitor: ConnectivityMonitor? = null

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
        activeConnectivityMonitor?.stop()
        activeConnectivityMonitor = null

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

        val diagnostics = DiagnosticEmitter(options.onDiagnostic)
        val gate = OutboundGate(CircuitBreaker(SystemSdkClock, diagnostics), diagnostics, SystemSdkClock)

        // Every byte the SDK reads or writes goes through this one thread, so `configure`
        // and `capture` return without ever waiting on storage.
        val writer = PersistenceWriter(scope) { error ->
            warn("A Voidhash persistence task failed: ${error.message}")
        }

        // Namespacing by publishable key and origin keeps two configured projects — or the
        // same app before and after a key rotation — from reading each other's state.
        val cacheAdapter = SharedPreferencesCacheAdapter(
            applicationContext,
            cacheKeyPrefix(publishableKey, options.baseUrl),
        )
        val cacheManager = CacheManager(
            adapter = cacheAdapter,
            diagnostics = diagnostics,
            writer = writer,
            // Runs once, on the writer thread, before anything reads through: adopts the
            // identity, session and receipts an unnamespaced release left behind.
            onWarmUp = {
                if (cacheAdapter.migrateLegacyEntries()) {
                    warn("Adopted Voidhash state written by an earlier SDK release")
                }
            },
        )
        val identityStore = IdentityStore(cacheManager)
        options.distinctId?.let(identityStore::setDistinctId)

        val currentActivity = ActivityHolder()
        val readOnlyRef = AtomicBoolean(options.readOnly || !COMMERCE_FEATURES_ENABLED)
        val readOnlyProvider = { clientRef.get()?.currentReadOnly ?: readOnlyRef.get() }

        // One client, one connection pool, one explicit timeout budget for every request the
        // SDK makes.
        val httpClient = buildSdkHttpClient()
        val headers = SdkHeaders(
            publishableKey = publishableKey,
            platform = platform,
            readOnlyProvider = readOnlyProvider,
            debugProvider = { options.debug },
            environmentProvider = { if (developmentMode) "development" else "production" },
        )
        val apiClient = VoidhashApiClient(options.baseUrl, headers, httpClient, gate = gate)

        val queueDirectory = File(applicationContext.filesDir, "voidhash")
        val queueNamespace = cacheKeyPrefix(publishableKey, options.baseUrl)
            .trim(':')
            .replace(':', '-')
        val outbox = TransactionOutbox(
            store = FileRecordStore(
                File(queueDirectory, "$queueNamespace-transactions.ndjson"),
                diagnostics,
            ),
            clock = SystemSdkClock,
            writer = writer,
            diagnostics = diagnostics,
            onWarning = ::warn,
        )
        val personWrites = PersonWriteOutbox(
            store = FileRecordStore(
                File(queueDirectory, "$queueNamespace-person-writes.ndjson"),
                diagnostics,
            ),
            clock = SystemSdkClock,
            writer = writer,
            diagnostics = diagnostics,
            onWarning = ::warn,
        )

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
            onPersonRefresh = { clientRef.get()?.refreshPersonAfterPurchase() },
            outbox = outbox,
            onWarning = ::warn,
        )

        val sessionManager = AnalyticsSessionManager(cacheManager, onWarning = ::warn)
        val analyticsClient = AnalyticsClient(
            ingestUrl = options.ingestUrl ?: options.baseUrl,
            publishableKey = publishableKey,
            distinctIdProvider = identityStore::getDistinctId,
            sessionIdProvider = sessionManager::current,
            httpClient = httpClient,
            standardProperties = {
                analyticsStandardProperties(
                    platform,
                    environment = if (developmentMode) "development" else "production",
                )
            },
            store = FileRecordStore(
                File(queueDirectory, "$queueNamespace-analytics.ndjson"),
                diagnostics,
            ),
            writer = writer,
            gate = gate,
            diagnostics = diagnostics,
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
                clock = SystemSdkClock,
                gate = gate,
                diagnostics = diagnostics,
            ),
            orchestrator = orchestrator,
            analyticsClient = analyticsClient,
            sessionManager = sessionManager,
            billing = billing,
            scope = scope,
            paywallCoordinatorFactory = { purchaseHandler, resolve ->
                PaywallCoordinator(
                    presenter = DefaultPaywallPresenterPort(presenter),
                    purchaseHandler = purchaseHandler,
                    resolvePaywall = resolve,
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
            sdkClock = SystemSdkClock,
            gate = gate,
            outbox = outbox,
            personWrites = personWrites,
            preloadPlacements = options.preloadPlacements,
            paywallPreloader = { locationSlug, htmlUrl ->
                presenter.preload(locationSlug, htmlUrl)
            },
            diagnostics = diagnostics,
            onShutdown = {
                detachLifecycleCallbacks()
                activeConnectivityMonitor?.stop()
                activeConnectivityMonitor = null
            },
        )

        clientRef.set(client)
        instance = client

        // Activity callbacks are always installed for an enabled client: besides the
        // lifecycle events and screens they carry the foreground signal that half-opens the
        // circuit breaker and triggers the refresh and flush.
        if (application != null && options.enabled) {
            application.registerActivityLifecycleCallbacks(lifecycleCallbacks)
            activeLifecycleCallbacks = application to lifecycleCallbacks
        }

        if (options.enabled) {
            val monitor = AndroidConnectivityMonitor(applicationContext, diagnostics)
            monitor.start { clientRef.get()?.onConnectivityRestored() }
            activeConnectivityMonitor = monitor
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
