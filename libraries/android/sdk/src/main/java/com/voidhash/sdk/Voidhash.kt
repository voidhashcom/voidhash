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
import com.voidhash.core.billing.PlayFinishHooks
import com.voidhash.core.billing.PlayFinishJob
import com.voidhash.sdk.analytics.AnalyticsClient
import com.voidhash.sdk.analytics.AnalyticsConsentStore
import com.voidhash.sdk.analytics.AnalyticsSessionManager
import com.voidhash.sdk.analytics.DeviceMetaProviderLookup
import com.voidhash.sdk.analytics.DevicePlayReferrerConnection
import com.voidhash.sdk.analytics.InstallAttribution
import com.voidhash.sdk.analytics.LifecycleTracker
import com.voidhash.sdk.analytics.MetaProviderLookup
import com.voidhash.sdk.analytics.PlayReferrerConnection
import com.voidhash.sdk.analytics.analyticsStandardProperties
import com.voidhash.sdk.analytics.readProcessCrashes
import com.voidhash.sdk.api.SdkHeaders
import com.voidhash.sdk.api.VoidhashApiClient
import com.voidhash.sdk.billing.DefaultBillingEnginePort
import com.voidhash.sdk.billing.DevelopmentBillingEngine
import com.voidhash.sdk.billing.BillingEnginePort
import com.voidhash.sdk.cache.CacheManager
import com.voidhash.sdk.cache.InMemoryCacheAdapter
import com.voidhash.sdk.cache.SharedPreferencesCacheAdapter
import com.voidhash.sdk.cache.cacheKeyPrefix
import com.voidhash.sdk.cache.unnormalizedCacheKeyPrefix
import com.voidhash.sdk.diagnostics.DiagnosticEmitter
import com.voidhash.sdk.diagnostics.VoidhashDiagnosticKind
import com.voidhash.sdk.diagnostics.diagnosticDeliveryExecutor
import com.voidhash.sdk.identity.DISTINCT_ID_CACHE_KEY
import com.voidhash.sdk.identity.IdentityStore
import com.voidhash.sdk.identity.invalidDistinctIdReason
import com.voidhash.sdk.lifecycle.VoidhashActivityLifecycleCallbacks
import com.voidhash.sdk.network.AndroidConnectivityMonitor
import com.voidhash.sdk.network.CircuitBreaker
import com.voidhash.sdk.network.ConnectivityMonitor
import com.voidhash.sdk.network.OutboundGate
import com.voidhash.sdk.network.SystemSdkClock
import com.voidhash.sdk.network.isActiveNetworkMetered
import com.voidhash.sdk.network.lazySdkHttpClient
import com.voidhash.sdk.storage.FileRecordStore
import com.voidhash.sdk.storage.InMemoryRecordStore
import com.voidhash.sdk.storage.PersistenceWriter
import com.voidhash.sdk.transactions.AcceptedReceipts
import com.voidhash.sdk.transactions.PersonWriteOutbox
import com.voidhash.sdk.transactions.TransactionOutbox
import com.voidhash.sdk.paywall.FlowHost
import com.voidhash.sdk.paywall.FlowImageStore
import com.voidhash.sdk.paywall.FlowPackageStore
import com.voidhash.sdk.paywall.PaywallCoordinator
import com.voidhash.sdk.paywall.downloadFlowImage
import com.voidhash.sdk.paywall.downloadFlowPackage
import com.voidhash.sdk.paywall.flowPackageImages
import com.voidhash.sdk.paywall.requestFlowPermission
import com.voidhash.sdk.platform.PlatformInfo
import com.voidhash.sdk.platform.currentProcessName
import com.voidhash.sdk.platform.isAppInForeground
import com.voidhash.sdk.platform.isMainProcess
import com.voidhash.sdk.platform.isUserUnlocked
import com.voidhash.sdk.platform.whenStartedUnlocked
import com.voidhash.sdk.platform.whenUserUnlocked
import com.voidhash.sdk.schema.RuntimeSchema
import com.voidhash.sdk.schema.SchemaManager
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import java.io.File
import java.lang.ref.WeakReference
import java.util.concurrent.Executor
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

private const val LOG_TAG = "Voidhash"

/**
 * How long [Voidhash.retireRunningClient], and a client's `shutdown`, wait for the client's last
 * writes.
 */
private const val RETIRE_WAIT_MS = 2_000L

/**
 * Entry point of the Voidhash Android SDK.
 *
 * ```kotlin
 * val voidhash = Voidhash.configure(context, "pk_live_…")
 * lifecycleScope.launch { voidhash.initialize() }
 * ```
 */
object Voidhash {
    /** The live client and the queue namespace it owns. */
    private class Registration(val client: VoidhashClient, val namespace: String)

    @Volatile
    private var current: Registration? = null

    /** Writer of the last client that stored to disk; the next one's storage loads after it. */
    private var lastWriter: PersistenceWriter? = null

    /** The client [lastWriter] belongs to, which may have left [current] while still flushing. */
    private var lastWriterOwner: WeakReference<VoidhashClient>? = null

    /** Whether this process has reported `$app_opened`, whichever client did. */
    private val appOpenedInProcess = AtomicBoolean(false)

    /**
     * The client created by the most recent [configure] call in this process; `null` after it is
     * shut down, and in a process where the SDK does not run.
     */
    @JvmStatic
    val shared: VoidhashClient?
        get() = current?.client

    /**
     * Configures the SDK and returns the client.
     *
     * Configuration is cheap and synchronous; call
     * [VoidhashClient.initialize] to connect to the store and resolve the
     * project schema. Re-configuring replaces the previous client: it stops all of its
     * background work and ends its store connection. A receipt reported to it afterwards is
     * handed to the new client when both use the same publishable key and base URL; otherwise it
     * is stored for the previous key and delivered once a client is configured with it again.
     *
     * Without a [publishableKey] (`null` or blank) the returned client is inert, as with
     * `enabled = false`: an app that has no key for a build or an environment configures the SDK
     * the same way and calls it as usual, and nothing is read, stored or sent.
     *
     * The SDK runs only in the app's main process. In any other process — a service declared
     * with its own `android:process`, or one another library starts — the returned client is
     * inert, as with `enabled = false`, unless [VoidhashOptions.runInSecondaryProcess] opts in.
     *
     * In a process Android starts before the device was first unlocked (for a `directBootAware`
     * component) the app's storage is not available, so the returned client reads, writes and
     * sends nothing yet. It holds, in memory and in order, what changes the identity, the person,
     * the consent or the queues: captures, `identify`, person attributes, `reset`, the analytics
     * consent, reported purchases and `initialize()`. Reads answer without a value, flagged
     * expired, and what can neither be done nor held, such as `purchase`, throws `DEVICE_LOCKED`.
     * Once the device is unlocked the SDK configures itself again with the same arguments, and
     * with the observer mode set since: the client returned here then answers every call through
     * that working client, which [shared] returns too, and what was held is made on it.
     */
    @JvmStatic
    @JvmOverloads
    fun configure(
        context: Context,
        publishableKey: String?,
        options: VoidhashOptions = VoidhashOptions(),
    ): VoidhashClient = configure(context, publishableKey, options, PlatformServices())

    /**
     * Stops the client running in this process, as the next [configure] would, and waits at most
     * [RETIRE_WAIT_MS] for it to finish writing; for a host that changes the SDK's storage before
     * configuring again. A purchase sheet it opened keeps its store connection.
     */
    internal suspend fun retireRunningClient() {
        val writer = synchronized(this) {
            current?.client?.close()
            lastWriterOwner?.get()?.close()
            lastWriter
        } ?: return
        withTimeoutOrNull(RETIRE_WAIT_MS) { writer.awaitFinished() }
    }

    /** [configure] over replaceable [platform] services. */
    @Synchronized
    internal fun configure(
        context: Context,
        publishableKey: String?,
        options: VoidhashOptions,
        platform: PlatformServices,
        host: HostSettings = HostSettings(),
        /** The client configured before the first unlock this call takes over from, when the SDK makes it. */
        takingOverFrom: VoidhashClient? = null,
    ): VoidhashClient {
        // Keys read from resources or build config often carry a trailing newline, which no
        // HTTP header may contain.
        val key = publishableKey?.trim().orEmpty()
        // Without a key there is no project to talk to: the client is inert, as when disabled.
        val enabled = options.enabled && key.isNotEmpty()
        val applicationContext = context.applicationContext
        val diagnostics = DiagnosticEmitter(options.onDiagnostic, platform.diagnosticDelivery)
        // Logcat ends up in bug reports and crash reporters, so the SDK writes to it only when the
        // host asked for it; `onDiagnostic` receives the same situations either way.
        val warn: (String) -> Unit = { message -> if (options.debug) Log.w(LOG_TAG, message) }
        if (options.enabled && key.isEmpty()) warn("Voidhash has no publishable key and does nothing")

        // The SDK's preferences and queue files are not safe to share between processes: each
        // process would rewrite them from its own stale copy. A secondary process therefore
        // gets a client that never touches them and leaves the live one alone.
        val secondaryProcess = !options.runInSecondaryProcess &&
            !isMainProcess(applicationContext, platform.processName(applicationContext))
        // Read before it is closed, which takes it out of `current`.
        val replaced = current.takeUnless { secondaryProcess }
        if (secondaryProcess) {
            warn("Voidhash is inert in this process; it runs in the app's main process only")
            diagnostics.emit(
                VoidhashDiagnosticKind.CACHE,
                code = "SECONDARY_PROCESS_INERT",
                operation = "client.configure",
                message = "Voidhash was configured outside the app's main process and does nothing " +
                    "here. Set VoidhashOptions.runInSecondaryProcess to run it in this process instead.",
            )
        } else {
            current?.client?.close()
            // A client whose `shutdown` is still in its final flush has left `current` but keeps
            // its files until the flush ends; the new client's storage must not wait on that.
            lastWriterOwner?.get()?.close()
        }
        // Before the first unlock the app's storage cannot be opened, and the queue files look
        // as if they did not exist: a client that ran now would later write its empty queues
        // over them. It stays inert instead, and the SDK is configured again on unlock.
        val untilUnlock = if (enabled && !secondaryProcess && !platform.userUnlocked(applicationContext)) {
            diagnostics.emit(
                VoidhashDiagnosticKind.CACHE,
                code = "DEVICE_LOCKED_INERT",
                operation = "client.configure",
                retryable = true,
                message = "Voidhash was configured before the device was first unlocked, while the app's " +
                    "storage is not available: it reads, writes and sends nothing until then, and holds " +
                    "captures, identity and person calls and reported purchases in memory. Once the " +
                    "device is unlocked the SDK configures itself again and this client works.",
            )
            DeferredUntilUnlock()
        } else {
            null
        }
        // An inert client reads and writes nothing, so whatever an enabled client stored stays
        // exactly as it was until the SDK runs again.
        val active = enabled && !secondaryProcess && untilUnlock == null

        val platformInfo = PlatformInfo.fromContext(applicationContext)
        // Development mode is a debug-build-only affordance: the flag alone is
        // never enough, so it can never reach a production release.
        val developmentMode = options.dev && platformInfo.isDebugBuild
        val scope = sdkScope(diagnostics, warn)

        // Every hook below reads the client it was built for instead of the
        // `current` registration, which a later `configure()` moves elsewhere.
        val clientRef = AtomicReference<VoidhashClient?>(null)

        val monitor = if (active) platform.connectivityMonitor(applicationContext, diagnostics) else null
        val gate = OutboundGate(
            CircuitBreaker(SystemSdkClock, diagnostics),
            diagnostics,
            SystemSdkClock,
            networkAvailable = { monitor?.isNetworkAvailable() ?: true },
        )

        // Every byte the SDK reads or writes goes through this one thread, so `configure`
        // and `capture` return without ever waiting on storage.
        val writer = if (active) {
            PersistenceWriter(scope, after = lastWriter) { error ->
                diagnostics.emit(
                    VoidhashDiagnosticKind.CACHE,
                    code = "CACHE_WRITE_FAILED",
                    operation = "storage.write",
                    retryable = true,
                    message = "A write to device storage failed; the value is kept in memory and " +
                        "stored with the next write that succeeds: ${error.message}",
                )
                warn("A Voidhash persistence task failed: ${error.message}")
            }.also { lastWriter = it }
        } else {
            null
        }

        // Namespacing by publishable key and origin keeps two configured projects — or the
        // same app before and after a key rotation — from reading each other's state.
        val namespace = cacheKeyPrefix(key, options.baseUrl)
        // Resolved on first use, which an inert client never makes: asking for the directory
        // creates it.
        val queueDirectory by lazy { File(applicationContext.filesDir, "voidhash") }
        val cacheAdapter = if (active) SharedPreferencesCacheAdapter(applicationContext, namespace) else null
        // Read on the writer thread ahead of any write of this launch, which is the only moment
        // that tells an identity an earlier launch stored from one this launch minted or switched
        // to. It stays unknown when the warm-up fails, which then settles nothing about the install.
        val hadStoredIdentity = AtomicReference<Boolean?>(null)
        val cacheManager = CacheManager(
            adapter = cacheAdapter ?: InMemoryCacheAdapter(),
            diagnostics = diagnostics,
            writer = writer,
            // Runs once, on the writer thread, before anything reads through: adopts the
            // identity, session and receipts an earlier release left behind.
            onWarmUp = {
                if (cacheAdapter != null) {
                    unnormalizedCacheKeyPrefix(key, options.baseUrl)?.let { previous ->
                        if (adoptNamespace(cacheAdapter, queueDirectory, previous, namespace)) {
                            warn("Adopted Voidhash state stored under the base URL as configured")
                        }
                    }
                    if (cacheAdapter.migrateLegacyEntries()) {
                        warn("Adopted Voidhash state written by an earlier SDK release")
                    }
                    hadStoredIdentity.set(cacheAdapter.get(DISTINCT_ID_CACHE_KEY) != null)
                }
            },
            expiringKeyPrefixes = listOf(
                PROCESSED_TRANSACTION_KEY_PREFIX,
                RESTORED_TRANSACTION_IDENTITY_KEY_PREFIX,
                SDK_STARTED_PURCHASE_KEY_PREFIX,
            ),
        )
        val identityStore = IdentityStore(cacheManager)
        val analyticsConsent = AnalyticsConsentStore(cacheManager, options.analyticsConsent)
        options.distinctId?.let { distinctId ->
            if (!identityStore.pin(distinctId)) {
                warn(
                    "Ignoring the distinctId option, which ${invalidDistinctIdReason(distinctId)}; " +
                        "the device keeps its anonymous identity",
                )
            }
        }

        val currentActivity = ActivityHolder()
        val readOnlyRef = AtomicBoolean(options.readOnly)
        val readOnlyProvider = { clientRef.get()?.currentReadOnly ?: readOnlyRef.get() }

        // One client, one connection pool, one explicit timeout budget for every request the
        // SDK makes. It is built on the first request: building one loads the platform's
        // certificate store, which `configure` must not do on the caller's thread.
        val httpClient = lazySdkHttpClient()
        val headers = SdkHeaders(
            sdkVersion = host.sdkVersion,
            sdkName = host.sdkName,
            publishableKey = key,
            platform = platformInfo,
            readOnlyProvider = readOnlyProvider,
            debugProvider = { options.debug },
            backgroundedProvider = { clientRef.get()?.isAppInForeground == false },
            analyticsConsentProvider = { analyticsConsent.current },
        )
        val apiClient = VoidhashApiClient(
            options.baseUrl,
            headers,
            httpClient,
            gate = gate,
            diagnostics = diagnostics,
            onSuccess = { clientRef.get()?.onRequestSucceeded() },
        )

        val recordStore = { name: String ->
            if (active) {
                FileRecordStore(File(queueDirectory, "${queueFilePrefix(namespace)}$name.ndjson"), diagnostics)
            } else {
                InMemoryRecordStore()
            }
        }
        val outbox = TransactionOutbox(
            store = recordStore("transactions"),
            clock = SystemSdkClock,
            writer = writer,
            diagnostics = diagnostics,
            onWarning = warn,
            acceptedReceipts = AcceptedReceipts(
                store = recordStore("accepted-receipts"),
                clock = SystemSdkClock,
                writer = writer,
            ),
        )
        val personWrites = PersonWriteOutbox(
            store = recordStore("person-writes"),
            clock = SystemSdkClock,
            writer = writer,
            diagnostics = diagnostics,
            onWarning = warn,
        )

        // Building a port opens nothing: the store is connected by `initialize()` and the
        // purchase calls, which an inert client never makes.
        val billing: BillingEnginePort = if (developmentMode) {
            DevelopmentBillingEngine(activityProvider = { currentActivity.get() }, onWarning = warn)
        } else {
            platform.playBilling(applicationContext, { currentActivity.get() }, warn)
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
            onWarning = warn,
            syncScope = scope,
            diagnostics = diagnostics,
            onTransactionUpdate = { update -> clientRef.get()?.emitTransactionUpdate(update) },
        )

        val sessionManager = AnalyticsSessionManager(cacheManager, onWarning = warn)
        val analyticsClient = AnalyticsClient(
            ingestUrl = options.ingestUrl ?: options.baseUrl,
            publishableKey = key,
            distinctIdProvider = identityStore::getDistinctId,
            sessionIdProvider = sessionManager::current,
            groupsProvider = { identityStore.groups },
            httpClient = httpClient,
            standardProperties = {
                analyticsStandardProperties(platformInfo, sdkVersion = host.sdkVersion, sdkName = host.sdkName)
            },
            store = recordStore("analytics"),
            writer = writer,
            gate = gate,
            diagnostics = diagnostics,
            onWarning = warn,
            consentProvider = { analyticsConsent.current },
        )

        // Activity callbacks carry the foreground signal that runs the retry timer, half-opens
        // the circuit breaker and triggers the refresh, besides the lifecycle events and screens.
        val application = (applicationContext as? Application)?.takeIf { active }
        // What stops waiting for the unlock, once a client configured before it waits for one.
        val stopAwaitingUnlock = AtomicReference<(() -> Unit)?>(null)
        val lifecycleCallbacks = VoidhashActivityLifecycleCallbacks(
            clientProvider = { clientRef.get() },
            screenTracking = options.screenTracking,
            lifecycleTracker = LifecycleTracker(appOpenedInProcess),
        )

        // The background purchase check, in a process it started, asks this client to deliver
        // its receipts before it finishes anything on the device.
        val playFinishHooks = PlayFinishHooks(
            deliverReceipts = { clientRef.get()?.deliverQueuedReceipts() },
            onFinishedLocally = { purchase -> clientRef.get()?.onPurchaseFinishedLocally(purchase.purchaseToken) },
            onWarning = warn,
        )

        val client = VoidhashClient(
            apiClient = apiClient,
            cacheManager = cacheManager,
            identityStore = identityStore,
            schemaManager = SchemaManager(
                apiClient = apiClient,
                cacheManager = cacheManager,
                appVersion = platformInfo.appVersion,
                refreshScope = scope,
                onSchema = onSchemaResolved,
                onSchemaJson = { json -> clientRef.get()?.publishSchemaJson(json) },
                onWarning = warn,
                clock = SystemSdkClock,
                gate = gate,
                diagnostics = diagnostics,
                awaitForeground = { clientRef.get()?.awaitForeground() },
            ),
            orchestrator = orchestrator,
            analyticsClient = analyticsClient,
            sessionManager = sessionManager,
            consentStore = analyticsConsent,
            billing = billing,
            scope = scope,
            activitySink = currentActivity::set,
            enabled = active,
            readOnly = options.readOnly,
            onWarning = warn,
            platform = platformInfo,
            screenTracking = options.screenTracking,
            automaticLifecycleEvents = options.automaticLifecycleEvents,
            processCrashes = { readProcessCrashes(applicationContext) },
            sdkClock = SystemSdkClock,
            gate = gate,
            outbox = outbox,
            personWrites = personWrites,
            preloadPlacements = options.preloadPlacements,
            featureFlagOptions = options.featureFlags,
            flowCoordinatorFactory = options.paywallRenderer?.takeIf { active }?.let { renderer ->
                // Keyed by URL and shared by every project and person of the app: images are a
                // paywall's public content. Built only for a client that runs, and its directory
                // only once an image is read or stored, so nothing touches it before the unlock.
                val images = FlowImageStore(
                    directory = { File(applicationContext.cacheDir, "voidhash-paywall-images") },
                    download = { url -> downloadFlowImage(httpClient, url, gate) },
                    onWarning = warn,
                    isMetered = { isActiveNetworkMetered(applicationContext) },
                )
                val packages = FlowPackageStore(
                    // Content-addressed, so every project of the app can share it.
                    directory = File(applicationContext.cacheDir, "voidhash-paywall-packages"),
                    cacheManager = cacheManager,
                    download = { url -> downloadFlowPackage(httpClient, url, gate) },
                    onWarning = warn,
                    // Behind the load, so neither a preload nor a presentation waits for images.
                    onLoaded = { sha256, bytes -> scope.launch { images.prefetch(sha256) { flowPackageImages(bytes) } } },
                )
                val factory: (FlowHost) -> PaywallCoordinator = { host ->
                    PaywallCoordinator(
                        host = host,
                        renderer = renderer,
                        loadPackage = packages::load,
                        capabilities = options.flowCapabilities,
                        locale = platformInfo.locales.firstOrNull(),
                        scope = scope,
                        mainDispatcher = Dispatchers.Main.immediate,
                        onWarning = warn,
                        // The store sheet of a purchase from the flow launches from the activity it is shown above.
                        onActivityChanged = currentActivity::set,
                        loadImage = images::load,
                        discardImage = images::discard,
                    )
                }
                factory
            },
            flowEngine = { options.paywallRenderer?.takeIf { active }?.engineCapabilities },
            openUrl = { url -> openExternal(applicationContext, url) },
            requestPermission = { activity, permission -> requestFlowPermission(activity, permission, warn) },
            diagnostics = diagnostics,
            // Each client stops only what it started itself: a client shut down after a later
            // configure must leave its successor's callbacks and monitor running.
            onShutdown = {
                stopAwaitingUnlock.getAndSet(null)?.invoke()
                application?.unregisterActivityLifecycleCallbacks(lifecycleCallbacks)
                monitor?.stop()
                PlayFinishJob.unregister(playFinishHooks)
                unregister(clientRef.get())
            },
            awaitWritesFinished = { writer?.let { withTimeoutOrNull(RETIRE_WAIT_MS) { it.awaitFinished() } } },
            initiallyInForeground = active && platform.appInForeground(),
            replacement = { current?.takeIf { it.namespace == namespace }?.client },
            host = host,
            installAttribution = if (active && options.installAttribution) {
                InstallAttribution(
                    cacheManager = cacheManager,
                    hadIdentityBeforeThisLaunch = hadStoredIdentity::get,
                    firstInstallTime = platformInfo.firstInstallTime,
                    metaAppId = options.metaAppId?.trim()?.takeIf { it.isNotEmpty() },
                    metaProviders = platform.metaProviderLookup(applicationContext),
                    playConnection = { platform.playReferrerConnection(applicationContext) },
                    now = SystemSdkClock::now,
                    diagnostics = diagnostics,
                )
            } else {
                null
            },
            untilUnlock = untilUnlock,
            analyticsWhilePending = options.analyticsWhilePending,
            grantConsentOnIdentify = options.grantConsentOnIdentify,
        )

        clientRef.set(client)
        if (secondaryProcess) return client
        current = Registration(client, namespace)
        if (writer != null) lastWriterOwner = WeakReference(client)

        if (active) PlayFinishJob.register(playFinishHooks)
        application?.registerActivityLifecycleCallbacks(lifecycleCallbacks)
        monitor?.start { becameValidated -> clientRef.get()?.onConnectivityRestored(becameValidated) }
        // A client configured before the first unlock answers through the one configured for the
        // same project in its place, whether the SDK or the host configured it, and that one gets
        // what the first held. One configured while the device is still locked holds it on.
        // A client that replaces one still making those held calls gets the rest of them.
        if (replaced?.namespace == namespace && (active || untilUnlock != null)) {
            replaced.client.handOverTo(client, bySdk = replaced.client === takingOverFrom)
        }
        if (untilUnlock != null) {
            val takeOver = {
                configureAfterUnlock(client, applicationContext, key, options, platform, host)
            }
            // Called from a broadcast receiver or an activity callback, where an exception ends
            // the app's process.
            val takeOverOnUnlock = {
                try {
                    takeOver()
                } catch (error: Exception) {
                    diagnostics.emit(
                        VoidhashDiagnosticKind.TRANSPORT,
                        code = "INTERNAL_ERROR",
                        operation = "client.configure",
                        message = "Voidhash could not configure itself once the device was unlocked " +
                            "(${error.javaClass.name}); call Voidhash.configure again",
                    )
                    warn("Voidhash could not configure itself after the unlock: $error")
                }
                Unit
            }
            val stopWatching = platform.whenUserUnlocked(applicationContext, takeOverOnUnlock) ?: run {
                // Without the unlock broadcast the SDK would stay inert for the life of the
                // process: the next activity to start with the device unlocked takes over instead.
                diagnostics.emit(
                    VoidhashDiagnosticKind.CACHE,
                    code = "DEVICE_UNLOCK_NOT_OBSERVED",
                    operation = "client.configure",
                    retryable = true,
                    message = "Voidhash could not watch for the device being unlocked. It configures itself " +
                        "when the app next comes to the foreground after the unlock; calling " +
                        "Voidhash.configure again after the unlock does the same.",
                )
                whenStartedUnlocked(applicationContext, { platform.userUnlocked(applicationContext) }, takeOverOnUnlock)
            }
            stopAwaitingUnlock.set(stopWatching)
            // Unlocked between the check above and the registration: nothing announces it any more.
            if (platform.userUnlocked(applicationContext)) return takeOver() ?: client
        }
        return client
    }

    /**
     * Configures the SDK again once the device was unlocked, unless the host replaced or shut
     * down [locked], the inert client it got before. The new client starts in the observer mode
     * the host set on [locked], so nothing it does first, a store scan included, finishes a
     * purchase the host owns; [configure] then hands [locked] over to it. Returns the client that
     * took over.
     */
    @Synchronized
    private fun configureAfterUnlock(
        locked: VoidhashClient,
        context: Context,
        publishableKey: String,
        options: VoidhashOptions,
        platform: PlatformServices,
        host: HostSettings,
    ): VoidhashClient? {
        if (current?.client !== locked) return null
        val client = configure(
            context, publishableKey, options.copy(readOnly = locked.isReadOnly), platform, host,
            takingOverFrom = locked,
        )
        DiagnosticEmitter(options.onDiagnostic, platform.diagnosticDelivery).emit(
            VoidhashDiagnosticKind.CACHE,
            code = "DEVICE_UNLOCKED",
            operation = "client.configure",
            message = "The device was unlocked and Voidhash configured itself again; the client " +
                "configured before the unlock works from here on, as does Voidhash.shared",
        )
        return client
    }

    /** Forgets [client] as the live one, unless a later [configure] already replaced it. */
    @Synchronized
    private fun unregister(client: VoidhashClient?) {
        if (current?.client === client) current = null
    }

    /** Queue files of the namespace [prefix] are named `<this><queue>.ndjson`. */
    private fun queueFilePrefix(prefix: String): String = prefix.trim(':').replace(':', '-') + "-"

    /**
     * Moves what a release that hashed the base URL exactly as configured stored under
     * [previousPrefix] — preferences and queue files — to [prefix], the namespace of the
     * normalized URL. Preferences move only into an empty namespace and a queue file only where
     * none exists yet, so nothing stored under [prefix] is overwritten. Returns whether anything
     * moved. Runs on the writer thread, before any store is read.
     */
    private fun adoptNamespace(
        adapter: SharedPreferencesCacheAdapter,
        queueDirectory: File,
        previousPrefix: String,
        prefix: String,
    ): Boolean {
        var adopted = adapter.adoptNamespace(previousPrefix)
        val previousFiles = queueFilePrefix(previousPrefix)
        queueDirectory.listFiles()?.forEach { file ->
            if (!file.name.startsWith(previousFiles) || !file.name.endsWith(".ndjson")) return@forEach
            val target = File(queueDirectory, queueFilePrefix(prefix) + file.name.removePrefix(previousFiles))
            if (!target.exists() && file.renameTo(target)) adopted = true
        }
        return adopted
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

/**
 * The scope everything a client runs on its own lives in. An exception none of that work handled
 * is reported as a diagnostic: left to the thread's uncaught-exception handler, it would end the
 * app's process.
 */
internal fun sdkScope(diagnostics: DiagnosticEmitter, warn: (String) -> Unit): CoroutineScope =
    CoroutineScope(
        SupervisorJob() + Dispatchers.Default + CoroutineExceptionHandler { _, error ->
            diagnostics.emit(
                VoidhashDiagnosticKind.TRANSPORT,
                code = "INTERNAL_ERROR",
                operation = "client.background",
                message = "Background work of the SDK stopped on an unexpected ${error.javaClass.name}; " +
                    "the SDK carries on",
            )
            warn("Voidhash background work failed: $error")
        },
    )

/**
 * The platform services [Voidhash.configure] builds on; tests replace them.
 *
 * @property processName the name of the process `configure` runs in, `null` when unknown.
 * @property appInForeground whether an activity is in the foreground as the client is built.
 * @property playBilling the Play Billing store; building it must not connect.
 * @property connectivityMonitor the source of the connectivity-restored signal.
 * @property diagnosticDelivery where `onDiagnostic` runs, in emission order.
 * @property playReferrerConnection a new connection to Google Play's install referrer service.
 * @property metaProviderLookup the install referrer providers of Meta's apps.
 * @property userUnlocked whether the device was unlocked since it started, so storage is available.
 * @property whenUserUnlocked runs an action once on that unlock; returns what stops waiting for it,
 *   or `null` when the unlock cannot be watched for.
 */
internal class PlatformServices(
    val processName: (Context) -> String? = ::currentProcessName,
    val appInForeground: () -> Boolean = ::isAppInForeground,
    val playBilling: (Context, () -> Activity?, (String) -> Unit) -> BillingEnginePort = ::playBillingPort,
    val connectivityMonitor: (Context, DiagnosticEmitter) -> ConnectivityMonitor = ::AndroidConnectivityMonitor,
    val diagnosticDelivery: Executor = diagnosticDeliveryExecutor,
    val playReferrerConnection: (Context) -> PlayReferrerConnection = ::DevicePlayReferrerConnection,
    val metaProviderLookup: (Context) -> MetaProviderLookup = ::DeviceMetaProviderLookup,
    val userUnlocked: (Context) -> Boolean = ::isUserUnlocked,
    val whenUserUnlocked: (Context, () -> Unit) -> (() -> Unit)? = ::whenUserUnlocked,
)

private fun playBillingPort(
    context: Context,
    activityProvider: () -> Activity?,
    onWarning: (String) -> Unit,
): BillingEnginePort = DefaultBillingEnginePort(
    BillingEngine(
        contextProvider = { context },
        activityProvider = activityProvider,
        isPlayServicesAvailable = { billingContext ->
            GoogleApiAvailability
                .getInstance()
                .isGooglePlayServicesAvailable(billingContext) == ConnectionResult.SUCCESS
        },
        onWarning = onWarning,
        unfinishedPurchases = PlayFinishJob.store { context },
        onUnfinishedPurchasesChanged = { PlayFinishJob.scheduleIfNeeded(context) },
    ),
)
