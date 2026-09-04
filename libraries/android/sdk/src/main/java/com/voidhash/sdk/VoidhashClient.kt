package com.voidhash.sdk

import android.app.Activity
import com.voidhash.sdk.analytics.AnalyticsClient
import com.voidhash.sdk.analytics.AnalyticsSessionManager
import com.voidhash.sdk.analytics.AutomaticEvents
import com.voidhash.sdk.analytics.ScreenSources
import com.voidhash.sdk.analytics.ScreenTracker
import com.voidhash.sdk.analytics.ScreenView
import com.voidhash.sdk.api.DevelopmentPurchaseRequest
import com.voidhash.sdk.api.FeatureFlag
import com.voidhash.sdk.api.SyncTransactionRequest
import com.voidhash.sdk.api.ResolvedPaywall
import com.voidhash.sdk.api.VoidhashApiClient
import com.voidhash.sdk.api.VoidhashPerson
import com.voidhash.sdk.billing.BillingEnginePort
import com.voidhash.sdk.billing.VoidhashProduct
import com.voidhash.sdk.billing.VoidhashTransaction
import com.voidhash.sdk.billing.mapBillingPurchaseToTransaction
import com.voidhash.sdk.analytics.FlushStatus
import com.voidhash.sdk.cache.CacheManager
import com.voidhash.sdk.cache.fnv1aHex
import com.voidhash.sdk.diagnostics.DiagnosticEmitter
import com.voidhash.sdk.diagnostics.VoidhashDiagnosticKind
import com.voidhash.sdk.identity.IdentityStore
import com.voidhash.sdk.network.FRESHNESS_BUDGET_MS
import com.voidhash.sdk.network.OutboundGate
import com.voidhash.sdk.network.SdkClock
import com.voidhash.sdk.network.RETRYABLE_STATUS_CODES
import com.voidhash.sdk.network.SingleFlight
import com.voidhash.sdk.network.VoidhashCircuitOpenException
import com.voidhash.sdk.network.VoidhashOutboundPausedException
import com.voidhash.sdk.network.SystemSdkClock
import com.voidhash.sdk.api.TransactionSyncVerdict
import com.voidhash.sdk.transactions.PersonWrite
import com.voidhash.sdk.transactions.PersonWriteKind
import com.voidhash.sdk.transactions.PersonWriteOutbox
import com.voidhash.sdk.transactions.TransactionOutbox
import com.voidhash.sdk.paywall.PaywallCoordinator
import com.voidhash.sdk.paywall.PaywallListener
import com.voidhash.sdk.paywall.PaywallPurchaseHandler
import com.voidhash.sdk.platform.PlatformInfo
import com.voidhash.sdk.schema.RuntimeSchema
import com.voidhash.sdk.schema.SchemaManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

/** 2 days — the shared person-cache lifetime across the Voidhash SDKs. */
private const val PERSON_CACHE_TTL_MS = 1000L * 60 * 60 * 24 * 2

/** 5 minutes — after this a cached person is served but considered stale. */
private const val PERSON_CACHE_STALE_TIME_MS = 1000L * 60 * 5

/** 5 minutes — after this cached flags are still served but scheduled for refresh. */
private const val FLAGS_CACHE_STALE_TIME_MS = 1000L * 60 * 5

/** 7 days — a paywall configuration is usable for a week without contact. */
private const val PAYWALL_CACHE_TTL_MS = 1000L * 60 * 60 * 24 * 7

/** 1 hour — after this a cached paywall configuration is refreshed behind the read. */
private const val PAYWALL_CACHE_STALE_TIME_MS = 1000L * 60 * 60

/** How many placements this device remembers for preloading on the next launch. */
private const val KNOWN_PLACEMENTS_LIMIT = 20

/** Cache key of the placements this device has resolved before. */
private const val KNOWN_PLACEMENTS_CACHE_KEY = "paywall:placements"

/**
 * Ceiling on a read that has nothing cached to serve.
 *
 * Matches the per-request timeout: with no fallback the caller has to wait for the network,
 * but a black-hole connection must still not hang it forever.
 */
private const val COLD_READ_TIMEOUT_MS = 10_000L

/** App foreground refreshes are debounced to at most one per minute. */
private const val FOREGROUND_REFRESH_DEBOUNCE_MS = 60_000L

/** Captures retained in memory while the cache establishes the persisted identity. */
private const val PRE_INIT_ANALYTICS_BUFFER_CAP = 100

/** Cache key of the last app release seen, shared with the other Voidhash SDKs. */
internal const val LAST_SEEN_APP_RELEASE_CACHE_KEY = "voidhash:analytics:last-seen-app-release"

private data class PersonRefresh(val person: VoidhashPerson?)

private data class PaywallRefresh(val paywall: ResolvedPaywall?)

/** A cache entry that decoded; distinguishes a decoded `null` from an undecodable entry. */
private class Decoded<T>(val value: T)

private data class PendingAnalyticsCapture(
    val name: String,
    val properties: Map<String, Any?>,
)

/**
 * The Voidhash SDK surface. Obtained from [Voidhash.configure].
 *
 * Every method is a suspending function: the SDK never blocks the caller's
 * thread and never posts work back to the main thread on its own.
 */
class VoidhashClient internal constructor(
    private val apiClient: VoidhashApiClient,
    private val cacheManager: CacheManager,
    private val identityStore: IdentityStore,
    private val schemaManager: SchemaManager,
    private val orchestrator: PurchaseOrchestrator,
    private val analyticsClient: AnalyticsClient,
    private val sessionManager: AnalyticsSessionManager,
    private val billing: BillingEnginePort,
    private val scope: CoroutineScope,
    private val paywallCoordinatorFactory: (
        PaywallPurchaseHandler,
        suspend (String) -> ResolvedPaywall?,
    ) -> PaywallCoordinator,
    private val activitySink: (Activity?) -> Unit,
    private val enabled: Boolean,
    readOnly: Boolean,
    private val onWarning: (String) -> Unit = {},
    /** The commerce release gate; tests flip it to exercise owner-mode behaviour. */
    private val commerceFeaturesEnabled: Boolean = COMMERCE_FEATURES_ENABLED,
    private val platform: PlatformInfo? = null,
    screenTracking: ScreenTrackingOptions = ScreenTrackingOptions(),
    private val automaticLifecycleEvents: Boolean = true,
    private val clock: () -> Long = { System.currentTimeMillis() },
    private val sdkClock: SdkClock = SystemSdkClock,
    private val gate: OutboundGate? = null,
    private val singleFlight: SingleFlight = SingleFlight(),
    private val outbox: TransactionOutbox = TransactionOutbox(clock = sdkClock),
    private val personWrites: PersonWriteOutbox = PersonWriteOutbox(clock = sdkClock),
    private val preloadPlacements: List<String> = emptyList(),
    private val paywallPreloader: suspend (String, String) -> Unit = { _, _ -> },
    private val diagnostics: DiagnosticEmitter = DiagnosticEmitter(),
    private val onShutdown: () -> Unit = {},
) {
    private val readOnlyFlag = AtomicBoolean(readOnly || !commerceFeaturesEnabled)
    private val schemaRef = AtomicReference<RuntimeSchema?>(null)
    private val billingReady = AtomicBoolean(false)
    private val initMutex = Mutex()
    private var initialized = false
    private val pendingAnalyticsLock = Any()
    private val pendingAnalytics = ArrayDeque<PendingAnalyticsCapture>()
    @Volatile
    private var analyticsCaptureReady = cacheManager.isWarm
    private val screenTracker = ScreenTracker(screenTracking, clock)
    private val manualScreenCounter = AtomicInteger(0)
    private val activityScreenSuppressors = AtomicInteger(0)
    private val lastForegroundRefreshAt = AtomicLong(0L)
    private val lastReconnectRefreshAt = AtomicLong(0L)

    private val paywallPurchaseHandler = object : PaywallPurchaseHandler {
        override suspend fun products(): List<VoidhashProduct> = getProducts()

        override suspend fun purchase(product: VoidhashProduct): VoidhashTransaction =
            purchaseProduct(product)

        override suspend fun restorePurchases() {
            this@VoidhashClient.restorePurchases()
        }
    }

    /** Whether the SDK currently runs in observer mode. */
    val isReadOnly: Boolean get() = readOnlyFlag.get()

    /**
     * The analytics session id the next captured event will carry. Reading it
     * starts a session when none is live but never extends one: only captures
     * and [reset] move the session along.
     */
    val sessionId: String get() = sessionManager.peek()

    internal val currentReadOnly: Boolean get() = isReadOnly

    /**
     * Brings the client up: starts analytics, loads the schema, connects to the store and
     * reconciles anything the store still reports as unfinished.
     *
     * **Never fails because Voidhash is unreachable.** It returns once local state has
     * loaded, which on a cold offline start means no schema at all; the store surface then
     * answers from [RuntimeSchema.EMPTY] until a schema arrives. The background refresh
     * retries for as long as the client lives and is re-triggered on app foreground and on
     * connectivity restored, so a device that boots offline still ends up configured.
     *
     * Analytics capture and lifecycle observation start *before* the schema is fetched and
     * do not depend on it.
     *
     * Idempotent: only the first call does work and concurrent callers wait for it. Any
     * exception it does raise is a programmer error — a missing publishable key, a bad
     * option — not a transport problem.
     */
    suspend fun initialize() {
        if (!enabled) return

        initMutex.withLock {
            if (initialized) return

            // The identity and the last-seen app release live in the cache, and reading them
            // before the warm-up has adopted what an earlier release stored would mint a new
            // anonymous id and re-fire `$app_installed`.
            cacheManager.awaitWarm()
            val distinctId = identityStore.getDistinctId()

            // Analytics and lifecycle observation come first and depend on nothing remote.
            // Starting them after the schema fetch is what used to disable analytics for a
            // whole process whenever a cold-cache launch happened to be offline.
            // Each daemon tick also probes a paused key once its interval has elapsed, so a
            // rejected key that gets fixed is noticed without waiting for a foreground.
            analyticsClient.start(scope) { probeAuthenticationIfDue() }
            enableAnalyticsCapture()
            captureStartupEvents()
            initialized = true

            // An externally injected schema bypasses cache and network. Otherwise
            // `resolveSchema` publishes through `publishSchema`, and a warm cache can
            // revalidate before it returns — so only fill the gap, never overwrite a
            // fresher schema.
            val schema = schemaRef.get() ?: schemaManager.resolveSchema(distinctId)
            if (schema != null) {
                schemaRef.compareAndSet(null, schema)
            }

            runQuietly("connect to the store") {
                billing.initConnection { purchase ->
                    scope.launch {
                        try {
                            val current = schemaRef.get()
                            orchestrator.processObservedTransaction(
                                mapBillingPurchaseToTransaction(purchase),
                                current ?: RuntimeSchema.EMPTY,
                                deferStoreFinalization = current == null,
                            )
                        } catch (error: CancellationException) {
                            throw error
                        } catch (error: Throwable) {
                            onWarning("Failed to process an observed purchase: ${error.message}")
                        }
                    }
                }
            }
            billingReady.set(true)

            val current = schemaRef.get()
            runQuietly("reconcile observed transactions") {
                orchestrator.reconcileObservedTransactions(
                    current ?: RuntimeSchema.EMPTY,
                    deferStoreFinalization = current == null,
                )
            }

            scope.launch { runQuietly("drain the transaction outbox") { drainOutbox() } }
            scope.launch { runQuietly("preload cached state") { preload(distinctId) } }
        }
    }

    /**
     * Refreshes everything a launch needs, off the initialization path: the person, all
     * flags, and the paywall configuration for every placement this device knows about.
     *
     * Preloading is what makes the first `presentPaywall` of a session instant and lets it
     * work offline at all: a placement whose configuration was never fetched has nothing to
     * fall back to.
     */
    private suspend fun preload(distinctId: String) {
        if (gate?.isBlocked(apiClient.circuitKey) != true) {
            // Without a schema the store surface is unusable, so this is the first thing to fix.
            // `scheduleBackgroundRefresh` joins the retry loop already running rather than
            // starting a second one.
            if (schemaRef.get() == null) {
                schemaManager.scheduleBackgroundRefresh(distinctId)
            }

            runQuietly("refresh the person") { refreshPerson(distinctId) }
            runQuietly("refresh feature flags") { refreshFlags(distinctId, emptyList()) }
        }

        for (placement in (preloadPlacements + knownPlacements()).distinct()) {
            runQuietly("preload the paywall for $placement") {
                refreshPaywall(distinctId, placement)
            }
            val cacheKey = paywallCacheKey(distinctId, placement)
            val cached = cacheManager.get(cacheKey)?.value as? JSONObject
            val resolved = cached?.let { decodeCached(cacheKey, it, ResolvedPaywall::fromJson) }?.value
            if (resolved != null) {
                runQuietly("preload the paywall assets for $placement") {
                    paywallPreloader(placement, resolved.htmlUrl)
                }
            }
        }
    }

    /** Retries anything the backend has not acknowledged yet: receipts, then person writes. */
    private suspend fun drainOutbox() {
        outbox.drain { distinctId, request ->
            apiClient.syncTransactionVerdict(distinctId, request)
        }
        personWrites.drain(
            identify = { write ->
                apiClient.identify(
                    write.distinctId,
                    write.externalUserId ?: write.distinctId,
                    write.email,
                    write.name,
                ).also { cachePerson(write.externalUserId ?: write.distinctId, it) }
            },
            setTraits = { write ->
                apiClient.setPersonAttributes(write.distinctId, write.traits)
            },
        )
    }

    /**
     * Returns the store products for every product configured in the schema.
     *
     * With no schema yet — a cold, offline launch — the list is empty rather than an error:
     * there are no products the SDK knows about, which is a fact the caller can render.
     */
    suspend fun getProducts(): List<VoidhashProduct> {
        if (!enabled) return emptyList()
        return orchestrator.getProducts(schemaRef.get() ?: RuntimeSchema.EMPTY)
    }

    /**
     * Buys [product]. [activity] becomes the activity Play Billing launches its
     * flow from.
     *
     * Unavailable in observer mode: an observer never owns a transaction, so it
     * must never start one it would then be unable to finish. The check reads
     * the live flag, so it also covers the commerce release gate.
     */
    suspend fun purchase(activity: Activity, product: VoidhashProduct): VoidhashTransaction {
        activitySink(activity)
        return try {
            purchaseProduct(product)
        } finally {
            activitySink(null)
        }
    }

    /** The single purchase entry point shared by [purchase] and the paywall bridge. */
    private suspend fun purchaseProduct(product: VoidhashProduct): VoidhashTransaction {
        check(enabled) { "CONFIGURATION_MISSING: Voidhash is disabled" }
        if (readOnlyFlag.get()) {
            throw VoidhashException(
                "READ_ONLY_PURCHASE_NOT_ALLOWED",
                "Read-only mode is enabled. Purchasing is disabled for observer-only operation.",
            )
        }
        return orchestrator.purchase(product, requireSchema())
    }

    /**
     * Reconciles every purchase the store still reports and refreshes the person.
     *
     * With no schema yet the store is still reconciled — a receipt is worth syncing whether
     * or not the SDK can name the product — so this never fails for want of configuration.
     */
    suspend fun restorePurchases() {
        if (!enabled) return
        orchestrator.restorePurchases(schemaRef.get() ?: RuntimeSchema.EMPTY)
    }

    /**
     * Returns the current person, cached for two days and refreshed behind the read after
     * five minutes.
     *
     * The read is answered from cache whenever anything is cached, so it never blocks on a
     * slow or unreachable API. [forceFetch] skips the cache, but still falls back to it
     * rather than failing when the API cannot be reached.
     */
    suspend fun getCurrentPerson(forceFetch: Boolean = false): VoidhashPerson? =
        getCurrentPersonState(forceFetch).value

    /** [getCurrentPerson] with the freshness of the returned snapshot attached. */
    suspend fun getCurrentPersonState(forceFetch: Boolean = false): Stale<VoidhashPerson?> {
        if (!enabled) return Stale(null)

        val distinctId = identityStore.getDistinctId()
        val cached = cacheManager.getObject(personCacheKey(distinctId))?.let { hit ->
            decodeCached(personCacheKey(distinctId), hit.value, VoidhashPerson::fromJson)
                ?.let { decoded -> hit to PersonRefresh(decoded.value) }
        }

        // `forceFetch` means what it says while the network is usable: no cached value is
        // offered to the read, so it waits for the server rather than settling for the copy
        // it already has after the freshness budget.
        val bypassCache = forceFetch && gate?.isBlocked(apiClient.circuitKey) != true

        return readThrough(
            key = "person:$distinctId",
            cached = if (bypassCache) null else cached?.second,
            isStale = forceFetch || cached?.first?.isStale != false,
            isExpired = cached?.first?.isExpired == true,
            fallback = cached?.second,
        ) { refreshPerson(distinctId) }
            .let { state -> Stale(state.value?.person, state.isStale, state.isExpired) }
    }

    private suspend fun refreshPerson(distinctId: String): PersonRefresh {
        val person = apiClient.getPerson(distinctId)
        if (person == null) {
            cacheManager.delete(personCacheKey(distinctId))
        } else {
            cachePerson(distinctId, person)
        }
        return PersonRefresh(person)
    }

    /**
     * Aliases the current (anonymous) identity onto [externalUserId].
     *
     * The local identity switches immediately and the per-identity caches for the previous
     * id are dropped once the backend has the alias or the call is queued for it. Never
     * throws for transport: an unreachable backend leaves the call queued and returns the
     * person the SDK knows. A verdict about the payload (a 4xx) is thrown, and the local
     * identity is put back: the backend will never accept that alias, so keeping it would
     * strand the device on an identity nothing else knows.
     */
    suspend fun identify(
        externalUserId: String,
        email: String? = null,
        name: String? = null,
    ): VoidhashPerson? = identifyWithStatus(externalUserId, email, name).person

    /** [identify], reporting whether the backend has the alias yet. */
    suspend fun identifyWithStatus(
        externalUserId: String,
        email: String? = null,
        name: String? = null,
    ): PersonWriteResult {
        if (!enabled) return PersonWriteResult(WriteStatus.CONFIRMED, null)

        cacheManager.awaitWarm()
        val previousDistinctId = identityStore.getDistinctId()
        enableAnalyticsCapture()
        val write = PersonWrite(
            kind = PersonWriteKind.IDENTIFY,
            distinctId = previousDistinctId,
            externalUserId = externalUserId,
            email = email,
            name = name,
        )

        // The identity switches first so that a capture racing this call is already
        // attributed to the user the app knows about.
        identityStore.setDistinctId(externalUserId)

        val person = try {
            apiClient.identify(previousDistinctId, externalUserId, email, name)
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            if (isTransportFailure(error)) {
                personWrites.enqueue(write)
                invalidateIdentityState(previousDistinctId)
                onWarning("Queued identify for $externalUserId: ${error.message}")
                return PersonWriteResult(
                    WriteStatus.DEFERRED,
                    cachedPerson(externalUserId) ?: cachedPerson(previousDistinctId),
                )
            }
            identityStore.setDistinctId(previousDistinctId)
            throw error
        }

        // Flags and the person snapshot are evaluated per identity; without this the ones
        // computed for the anonymous visitor keep answering reads.
        invalidateIdentityState(previousDistinctId)
        cachePerson(externalUserId, person)
        scope.launch {
            runQuietly("refresh flags after identify") { refreshFlags(externalUserId, emptyList()) }
        }
        return PersonWriteResult(WriteStatus.CONFIRMED, person)
    }

    /**
     * Writes person traits.
     *
     * Never throws for transport: an unreachable backend queues the write and delivers it on
     * the next successful flush.
     */
    suspend fun setPersonAttributes(attributes: Map<String, Any?>) {
        setPersonAttributesWithStatus(attributes)
    }

    /** [setPersonAttributes], reporting whether the backend has the traits yet. */
    suspend fun setPersonAttributesWithStatus(attributes: Map<String, Any?>): PersonWriteResult {
        if (!enabled) return PersonWriteResult(WriteStatus.CONFIRMED, null)

        val distinctId = identityStore.getDistinctId()
        return try {
            apiClient.setPersonAttributes(distinctId, attributes)
            PersonWriteResult(WriteStatus.CONFIRMED, cachedPerson(distinctId))
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            if (!isTransportFailure(error)) throw error
            personWrites.enqueue(
                PersonWrite(
                    kind = PersonWriteKind.TRAITS,
                    distinctId = distinctId,
                    traits = attributes,
                ),
            )
            onWarning("Queued person traits for $distinctId: ${error.message}")
            PersonWriteResult(WriteStatus.DEFERRED, cachedPerson(distinctId))
        }
    }

    /**
     * Clears the local identity; the next call generates a new anonymous id.
     * Captures `$sign_out` for the identity and session being cleared first,
     * then starts a new analytics session.
     */
    suspend fun reset() {
        if (!enabled) return
        cacheManager.awaitWarm()
        val previousDistinctId = identityStore.getDistinctId()
        enableAnalyticsCapture()
        captureAutomaticEvent(AutomaticEvents.SIGN_OUT)
        identityStore.forgetDistinctId()
        invalidateIdentityState(previousDistinctId)
        sessionManager.rotate()
    }

    /**
     * Whether [error] means "the server did not answer" rather than "the server said no".
     *
     * Only the former is worth queueing: a 4xx describes the payload and will be repeated.
     */
    private fun isTransportFailure(error: Throwable): Boolean = when (error) {
        is VoidhashNetworkException -> true
        is VoidhashCircuitOpenException -> true
        is VoidhashOutboundPausedException -> true
        is VoidhashApiException -> error.status in RETRYABLE_STATUS_CODES
        else -> false
    }

    private fun cachedPerson(distinctId: String): VoidhashPerson? =
        cacheManager.getObject(personCacheKey(distinctId))?.let { hit ->
            decodeCached(personCacheKey(distinctId), hit.value, VoidhashPerson::fromJson)?.value
        }

    /**
     * Decodes a cached document, treating one that no longer parses as a miss.
     *
     * A cache entry is the one input whose shape the SDK cannot trust: a release that changed
     * a model, or a corrupted write, must cost a refetch and a diagnostic, never a throw from
     * a read that promised to answer from local state.
     */
    private fun <T> decodeCached(
        key: String,
        raw: JSONObject,
        decode: (JSONObject) -> T,
    ): Decoded<T>? =
        try {
            Decoded(decode(raw))
        } catch (error: Throwable) {
            diagnostics.emit(
                VoidhashDiagnosticKind.CACHE,
                code = "CACHE_READ_FAILED",
                operation = "cache.get",
                message = "Discarded an undecodable cache entry for $key: ${error.message}",
            )
            cacheManager.delete(key)
            null
        }

    /** Drops every per-identity cache entry belonging to [distinctId]. */
    private fun invalidateIdentityState(distinctId: String) {
        cacheManager.delete(personCacheKey(distinctId))
        cacheManager.deleteByPrefix("flags:$distinctId:")
        cacheManager.deleteByPrefix("paywall:$distinctId:")
    }

    /**
     * Evaluates feature flags; an empty [keys] list evaluates every flag.
     *
     * Results are cached per identity for five minutes and served past that indefinitely, so
     * an offline launch still gates features the way the last online session did.
     */
    suspend fun getFeatureFlags(keys: List<String> = emptyList()): List<FeatureFlag> =
        getFeatureFlagsState(keys).value

    /** [getFeatureFlags] with the freshness of the returned evaluation attached. */
    suspend fun getFeatureFlagsState(keys: List<String> = emptyList()): Stale<List<FeatureFlag>> {
        if (!enabled) return Stale(emptyList())

        val distinctId = identityStore.getDistinctId()
        val cacheKey = flagsCacheKey(distinctId, keys)
        val cached = cacheManager.getArray(cacheKey)

        val state = readThrough(
            key = cacheKey,
            cached = cached?.value?.let(::decodeFlags),
            isStale = cached?.isStale != false,
            isExpired = cached?.isExpired == true,
        ) { refreshFlags(distinctId, keys) }

        return Stale(state.value ?: emptyList(), state.isStale, state.isExpired)
    }

    private suspend fun refreshFlags(distinctId: String, keys: List<String>): List<FeatureFlag> {
        val flags = apiClient.evaluateFlags(distinctId, keys)
        cacheManager.set(
            flagsCacheKey(distinctId, keys),
            encodeFlags(flags),
            staleTimeMs = FLAGS_CACHE_STALE_TIME_MS,
        )
        return flags
    }

    /** Queues an analytics event. */
    fun capture(name: String, properties: Map<String, Any?> = emptyMap()) {
        if (!enabled) return
        val buffered = synchronized(pendingAnalyticsLock) {
            if (analyticsCaptureReady) {
                false
            } else {
                pendingAnalytics.addLast(PendingAnalyticsCapture(name, properties.toMap()))
                if (pendingAnalytics.size > PRE_INIT_ANALYTICS_BUFFER_CAP) {
                    val dropped = pendingAnalytics.removeFirst()
                    diagnostics.emit(
                        VoidhashDiagnosticKind.EVICTION,
                        code = "ANALYTICS_EVENT_DROPPED",
                        operation = "analytics.capture",
                        message = "Dropped ${dropped.name}: the pre-initialization analytics buffer is full",
                    )
                }
                true
            }
        }
        if (buffered) return
        analyticsClient.capture(name, properties, scope)
    }

    /** Transfers pre-warm captures after the persisted identity is available. */
    private fun enableAnalyticsCapture() {
        synchronized(pendingAnalyticsLock) {
            pendingAnalytics.forEach { event ->
                analyticsClient.capture(event.name, event.properties, scope)
            }
            pendingAnalytics.clear()
            analyticsCaptureReady = true
        }
    }

    /**
     * Captures a `$screen` for a screen the SDK cannot see on its own (custom
     * navigation, onboarding steps, pager pages). Every call is a new arrival,
     * so calling it twice with the same [name] emits twice.
     */
    fun screen(name: String, properties: Map<String, Any?> = emptyMap()) {
        if (!enabled) return
        trackScreen(
            ScreenView(
                identity = "manual:$name#${manualScreenCounter.incrementAndGet()}",
                name = name,
                path = name,
                source = ScreenSources.MANUAL,
            ),
            properties,
        )
    }

    /**
     * Sends every queued analytics event and retries any unacknowledged store receipt.
     *
     * Never throws: transport failure leaves the data queued and is reported through the
     * returned status instead.
     */
    suspend fun flush(): FlushStatus {
        if (!enabled) return FlushStatus(flushed = 0, pending = 0)
        scope.launch { runQuietly("drain the transaction outbox") { drainOutbox() } }
        return try {
            analyticsClient.flush()
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            FlushStatus(
                flushed = 0,
                pending = analyticsClient.queueLength,
                lastError = error.message,
            )
        }
    }

    /** The distinct id requests are made as. */
    fun getDistinctId(): String = identityStore.getDistinctId()

    /**
     * Switches observer mode. In observer mode transactions are still synced to
     * the backend but never finished with the store — the host app owns that.
     * While commerce is unavailable, passing `false` keeps observer mode enabled.
     */
    fun setReadOnly(readOnly: Boolean) {
        readOnlyFlag.set(readOnly || !commerceFeaturesEnabled)
    }

    /**
     * Presents the paywall configured for [location].
     *
     * @return false while paywalls are unavailable, when no paywall is showing for the
     * location, or when the presenter declines to show it.
     */
    @Deprecated(
        "Use the overload returning PaywallStatus, which distinguishes an unassigned " +
            "location from an unavailable one.",
        ReplaceWith("presentPaywall(activity, location, listener, PaywallStatus.SHOWN)"),
    )
    suspend fun presentPaywall(
        activity: Activity,
        location: String,
        listener: PaywallListener? = null,
    ): Boolean = presentPaywallForStatus(activity, location, listener) == PaywallStatus.SHOWN

    /**
     * Presents the paywall configured for [location] and reports why it did not show.
     *
     * A location with a cached configuration presents immediately, without waiting on the
     * API, which is what makes a paywall work on a cold or offline start.
     */
    suspend fun presentPaywallForStatus(
        activity: Activity,
        location: String,
        listener: PaywallListener? = null,
    ): PaywallStatus {
        if (!enabled || !commerceFeaturesEnabled) return PaywallStatus.NOT_ASSIGNED
        activitySink(activity)

        var shown = false
        try {
            val status = presentResolvedPaywall(activity, location, listener)
            shown = status == PaywallStatus.SHOWN
            return status
        } finally {
            // A presented paywall keeps the activity: the store sheet for a purchase started
            // from it launches from there. One that never showed must not leave the sink
            // pointing at a screen the user has moved on from.
            if (!shown) activitySink(null)
        }
    }

    private suspend fun presentResolvedPaywall(
        activity: Activity,
        location: String,
        listener: PaywallListener?,
    ): PaywallStatus {
        val distinctId = identityStore.getDistinctId()
        val resolved = resolvePaywallState(location)
        if (resolved.value == null) {
            // A cold failed read is unavailable. A fresh or cached negative answer means
            // the backend deliberately assigned no paywall to this person.
            return if (resolved.isStale && resolved.isExpired) {
                PaywallStatus.UNAVAILABLE
            } else {
                PaywallStatus.NOT_ASSIGNED
            }
        }

        rememberPlacement(location)
        val coordinator = paywallCoordinatorFactory(paywallPurchaseHandler) { resolved.value }
        val shown = coordinator.present(location, listener) { raw ->
            scope.launch {
                try {
                    coordinator.handleBridgeMessage(location, raw)
                } catch (error: CancellationException) {
                    throw error
                } catch (error: Throwable) {
                    // The page is waiting on this request; a vanished exception would leave
                    // its button spinning forever.
                    coordinator.reportBridgeMessageFailure(location, raw, error)
                }
            }
        }

        if (resolved.isStale) {
            scope.launch {
                runQuietly("refresh the paywall for $location") { refreshPaywall(distinctId, location) }
            }
        }
        return if (shown) PaywallStatus.SHOWN else PaywallStatus.UNAVAILABLE
    }

    /** Ends the store connection, stops the analytics daemon and cancels the SDK scope. */
    suspend fun shutdown(): FlushStatus {
        onShutdown()
        analyticsClient.stop()
        // Anything captured inside the persist-behind window has to reach disk before the
        // scope goes away, whether or not the final flush gets through.
        runQuietly("persist the analytics queue") { analyticsClient.persistAndAwait() }
        val status = try {
            analyticsClient.flush()
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            onWarning("Failed to flush the analytics queue: ${error.message}")
            FlushStatus(0, analyticsClient.queueLength, error.message)
        }
        runQuietly("end the billing connection") { billing.endConnection() }
        scope.cancel()
        return status
    }

    /**
     * Adopts a schema resolved outside [initialize] — the stale-while-revalidate
     * refresh — so a warm-cache session stops running on the stale schema.
     */
    internal fun publishSchema(schema: RuntimeSchema) {
        val wasMissing = schemaRef.getAndSet(schema) == null
        if (wasMissing && billingReady.get()) {
            scope.launch {
                runQuietly("reconcile observed transactions after schema refresh") {
                    orchestrator.reconcileObservedTransactions(schema)
                }
            }
        }
    }

    /**
     * Resolves the paywall configured for [location] without presenting it.
     *
     * Embedded hosts (for example the React Native SDK) use this together with their own
     * presenter; the returned envelope carries everything a renderer needs. Answered from
     * the seven-day configuration cache first.
     */
    suspend fun resolvePaywall(location: String): ResolvedPaywall? =
        resolvePaywallState(location).value

    /** [resolvePaywall] with the freshness of the returned configuration attached. */
    suspend fun resolvePaywallState(location: String): Stale<ResolvedPaywall?> {
        if (!enabled || !commerceFeaturesEnabled) return Stale(null)

        val distinctId = identityStore.getDistinctId()
        val cacheKey = paywallCacheKey(distinctId, location)
        val cached = cacheManager.get(cacheKey)?.let { hit ->
            val raw = hit.value as? JSONObject
            if (raw == null) {
                hit to PaywallRefresh(null)
            } else {
                decodeCached(cacheKey, raw, ResolvedPaywall::fromJson)
                    ?.let { decoded -> hit to PaywallRefresh(decoded.value) }
            }
        }

        val state = readThrough(
            key = cacheKey,
            cached = cached?.second,
            isStale = cached?.first?.isStale != false,
            isExpired = cached?.first?.isExpired == true,
        ) { refreshPaywall(distinctId, location) }

        if (state.value?.paywall != null) rememberPlacement(location)
        return Stale(state.value?.paywall, state.isStale, state.isExpired)
    }

    private suspend fun refreshPaywall(distinctId: String, location: String): PaywallRefresh {
        val raw = apiClient.resolvePaywallRaw(distinctId, location)
        val resolved = raw?.let(ResolvedPaywall::fromJson)
        cacheManager.set(
            paywallCacheKey(distinctId, location),
            raw,
            ttlMs = PAYWALL_CACHE_TTL_MS,
            staleTimeMs = PAYWALL_CACHE_STALE_TIME_MS,
        )
        rememberPlacement(location)
        return PaywallRefresh(resolved)
    }

    /**
     * Adopts an externally supplied schema without a server round-trip. Escape
     * hatch for preview and testing hosts; the next background refresh replaces it.
     */
    fun injectInternalSchema(schema: RuntimeSchema) {
        publishSchema(schema)
    }

    // Embedded-engine surface: stateless data-plane operations for hosts that use the
    // client as their backend transport (the React Native SDK). Each takes the distinct
    // id explicitly instead of reading the persisted identity, so the host stays the
    // single source of truth.

    /** Fetches the runtime schema. Deliberately does not run initialization: the embedded
     * surface is data-plane only and must never start the store's billing connection. */
    suspend fun fetchSchema(distinctId: String): RuntimeSchema =
        RuntimeSchema.fromJson(apiClient.getSchema(distinctId))

    /** Fetches the person snapshot; `null` when the backend has none yet. */
    suspend fun fetchPerson(distinctId: String): VoidhashPerson? =
        apiClient.getPerson(distinctId)

    /** Aliases [distinctId] onto [externalUserId] and returns the merged person. */
    suspend fun identifyPerson(
        distinctId: String,
        externalUserId: String,
        email: String?,
        name: String?,
    ): VoidhashPerson = apiClient.identify(distinctId, externalUserId, email, name)

    /** Writes person traits and returns the updated person. */
    suspend fun setPersonTraits(
        distinctId: String,
        traits: Map<String, Any?>,
    ): VoidhashPerson? {
        apiClient.setPersonAttributes(distinctId, traits)
        return apiClient.getPerson(distinctId)
    }

    /** Evaluates feature flags; an empty [keys] list evaluates every flag. */
    suspend fun evaluateFeatureFlags(
        distinctId: String,
        keys: List<String>,
    ): List<FeatureFlag> = apiClient.evaluateFlags(distinctId, keys)

    /**
     * Syncs a store transaction; returns whether the backend accepted it.
     *
     * The receipt is written to the durable outbox before the request goes out and removed
     * only once the backend accepts it, so a process death between the store charging the
     * user and Voidhash recording it is recovered on the next launch. Never throws for
     * transport: a receipt that could not be delivered is queued and reported as deferred.
     */
    suspend fun syncStoreTransaction(
        distinctId: String,
        request: SyncTransactionRequest,
    ): Boolean = syncStoreTransactionWithStatus(distinctId, request).accepted

    /** [syncStoreTransaction], reporting whether the receipt is confirmed or still queued. */
    suspend fun syncStoreTransactionWithStatus(
        distinctId: String,
        request: SyncTransactionRequest,
    ): TransactionSyncResult {
        val key = "${request.transactionId}:${request.purchaseDate}"
        // A receipt already on disk for this transaction must be replaced, not duplicated.
        outbox.awaitRestored()
        outbox.enqueue(key, distinctId, request)

        val verdict = try {
            apiClient.syncTransactionVerdict(distinctId, request)
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            if (!isTransportFailure(error)) throw error
            onWarning("Queued store transaction ${request.transactionId}: ${error.message}")
            outbox.postpone(key)
            return TransactionSyncResult(WriteStatus.DEFERRED, accepted = false)
        }

        return when (verdict) {
            TransactionSyncVerdict.ACCEPTED -> {
                outbox.acknowledge(key)
                TransactionSyncResult(WriteStatus.CONFIRMED, accepted = true)
            }
            // Both of the remaining verdicts leave the receipt in the outbox; `drain`
            // decides whether to keep retrying it or drop it.
            TransactionSyncVerdict.REJECTED ->
                TransactionSyncResult(WriteStatus.DEFERRED, accepted = false).also {
                    outbox.postpone(key)
                }
            TransactionSyncVerdict.INDETERMINATE ->
                TransactionSyncResult(WriteStatus.DEFERRED, accepted = false).also {
                    outbox.postpone(key)
                }
        }
    }

    /** Records a development purchase and returns its explicit gateway acceptance verdict. */
    suspend fun recordDevelopmentPurchase(
        distinctId: String,
        request: DevelopmentPurchaseRequest,
    ): Boolean = apiClient.developmentPurchase(distinctId, request)

    /** Captures one of the [AutomaticEvents]; a no-op when the host emits them itself. */
    internal fun captureAutomaticEvent(name: String) {
        if (!enabled || !automaticLifecycleEvents) return
        capture(name)
    }

    /** Feeds a screen arrival through the tracker and captures `$screen` when it is new. */
    internal fun trackScreen(view: ScreenView, properties: Map<String, Any?> = emptyMap()) {
        if (!enabled) return
        val screenProperties = screenTracker.transition(view) ?: return
        capture(AutomaticEvents.SCREEN, properties + screenProperties)
    }

    /** Forces every captured-but-unwritten analytics event to disk. */
    internal fun persistQueuedEvents() {
        if (!enabled) return
        analyticsClient.persistNow()
    }

    /** Whether activity resumes are ignored because a finer-grained integration is active. */
    internal val activityScreensSuppressed: Boolean get() = activityScreenSuppressors.get() > 0

    /**
     * Stops activity resumes from producing screens while at least one finer-grained
     * integration holds a suppression; the fragment integration holds one for the client's
     * lifetime, a Compose tracker releases it on close.
     */
    internal fun suppressActivityScreens() {
        activityScreenSuppressors.incrementAndGet()
    }

    internal fun releaseActivityScreens() {
        // `AtomicInteger.updateAndGet` is API 24; the SDK supports API 23.
        while (true) {
            val count = activityScreenSuppressors.get()
            if (activityScreenSuppressors.compareAndSet(count, maxOf(0, count - 1))) return
        }
    }

    /**
     * Captures `$app_installed` / `$app_updated` and `$app_opened` from the last
     * app release the cache remembers, then records the current one. A cache
     * failure loses the install/update event, never the session start.
     */
    private fun captureStartupEvents() {
        if (!automaticLifecycleEvents) return
        val currentRelease = JSONObject()
            .put("appBuild", platform?.appBuild ?: "")
            .put("appVersion", platform?.appVersion ?: "")

        val releaseEvent = try {
            val previous = cacheManager.getObject(LAST_SEEN_APP_RELEASE_CACHE_KEY)?.value
            when {
                previous == null -> AutomaticEvents.APP_INSTALLED
                previous.optString("appBuild") != currentRelease.getString("appBuild") ||
                    previous.optString("appVersion") != currentRelease.getString("appVersion") ->
                    AutomaticEvents.APP_UPDATED
                else -> null
            }
        } catch (error: Throwable) {
            onWarning("Failed to read the last seen app release: ${error.message}")
            null
        }

        releaseEvent?.let(::captureAutomaticEvent)
        captureAutomaticEvent(AutomaticEvents.APP_OPENED)

        try {
            cacheManager.set(LAST_SEEN_APP_RELEASE_CACHE_KEY, currentRelease)
        } catch (error: Throwable) {
            onWarning("Failed to store the last seen app release: ${error.message}")
        }
    }

    /**
     * Serves [cached] and refreshes behind it, waiting at most the freshness budget.
     *
     * This is the shape of every interactive read in the SDK. With something cached the
     * caller waits 500 ms for the refresh and then gets the cached value anyway, so a slow
     * or dead API costs half a second once rather than a hang on every call; the refresh
     * keeps running and its result lands in cache for the next read. With nothing cached
     * there is nothing to serve, so the caller waits for the request itself.
     */
    private suspend fun <T : Any> readThrough(
        key: String,
        cached: T?,
        isStale: Boolean,
        isExpired: Boolean,
        fallback: T? = cached,
        fetch: suspend () -> T?,
    ): Stale<T?> {
        if (cached != null && !isStale) return Stale(cached)
        // An open circuit or a rejected key means the refresh cannot succeed; serving the
        // cache immediately beats spending the freshness budget finding that out.
        if (gate?.isBlocked(apiClient.circuitKey) == true) {
            return Stale(
                fallback,
                isStale = true,
                isExpired = fallback == null || isExpired,
            )
        }

        val refresh: Deferred<T?> = scope.async {
            singleFlight.run(key) {
                try {
                    fetch()
                } catch (error: CancellationException) {
                    throw error
                } catch (error: Throwable) {
                    onWarning("Failed to refresh $key: ${error.message}")
                    null
                }
            }
        }

        // With something to serve, wait only the freshness budget. With nothing, wait for
        // the request — but never longer than one attempt is allowed to take, so a black-hole
        // network cannot hang the caller indefinitely.
        val fresh = try {
            withTimeoutOrNull(
                if (cached == null) COLD_READ_TIMEOUT_MS else FRESHNESS_BUDGET_MS,
            ) {
                refresh.await()
            }
        } catch (error: CancellationException) {
            // The refresh ran on the SDK scope; if that scope is gone (shutdown, reconfigure)
            // the read still belongs to a live caller and answers from what it has.
            currentCoroutineContext().ensureActive()
            null
        }

        return if (fresh != null) {
            Stale(fresh)
        } else {
            Stale(
                fallback,
                isStale = true,
                isExpired = fallback == null || isExpired,
            )
        }
    }

    /**
     * Refreshes person, flags and stale paywalls, and flushes queues, after the app comes
     * back to the foreground. Debounced to once a minute: tab switches and permission
     * dialogs produce foreground transitions the user never perceives as a new session.
     */
    internal fun onAppForegrounded() {
        if (!enabled) return
        val now = sdkClock.now()
        val last = lastForegroundRefreshAt.get()
        if (now - last < FOREGROUND_REFRESH_DEBOUNCE_MS) return
        if (!lastForegroundRefreshAt.compareAndSet(last, now)) return

        gate?.onNetworkChanged()
        scope.launch {
            if (!probeAuthenticationIfDue()) return@launch
            runQuietly("flush on foreground") { flush() }
            runQuietly("refresh on foreground") { preload(identityStore.getDistinctId()) }
        }
    }

    /**
     * Reacts to the device regaining a network: queues go out first, because they hold data
     * that only exists on this device, and refreshes follow. Debounced to once a minute
     * like the foreground refresh: a flapping connection must not turn into a refresh storm.
     */
    internal fun onConnectivityRestored() {
        if (!enabled) return
        val now = sdkClock.now()
        val last = lastReconnectRefreshAt.get()
        if (now - last < FOREGROUND_REFRESH_DEBOUNCE_MS) return
        if (!lastReconnectRefreshAt.compareAndSet(last, now)) return

        gate?.onNetworkChanged()
        scope.launch {
            if (!probeAuthenticationIfDue()) return@launch
            runQuietly("flush on reconnect") { flush() }
            runQuietly("refresh on reconnect") { preload(identityStore.getDistinctId()) }
        }
    }

    private suspend fun probeAuthenticationIfDue(): Boolean {
        val outbound = gate ?: return true
        if (!outbound.isPaused) return true
        if (!outbound.beginAuthProbe()) return false
        return try {
            apiClient.getPerson(
                identityStore.getDistinctId(),
                authenticationProbe = true,
            )
            outbound.endAuthProbe(succeeded = true)
            diagnostics.emit(
                com.voidhash.sdk.diagnostics.VoidhashDiagnosticKind.AUTH,
                code = "AUTHENTICATION_RECOVERED",
                operation = "client.probe",
                message = "The publishable key is accepted again; outbound requests resumed",
            )
            true
        } catch (error: CancellationException) {
            outbound.endAuthProbe(succeeded = false)
            throw error
        } catch (_: Throwable) {
            outbound.endAuthProbe(succeeded = false)
            false
        }
    }

    /**
     * Refreshes the person after a purchase, then twice more.
     *
     * The backend grants entitlements from the receipt asynchronously, so the snapshot read
     * the instant a purchase completes routinely still says `hasAccess = false`. The two
     * follow-ups absorb that lag without making the purchase call wait on it.
     */
    internal suspend fun refreshPersonAfterPurchase() {
        val distinctId = identityStore.getDistinctId()
        runQuietly("refresh the person after a purchase") { refreshPerson(distinctId) }
        scope.launch {
            for (delayMs in listOf(2_000L, 3_000L)) {
                sdkClock.sleep(delayMs)
                runQuietly("refresh the person after a purchase") { refreshPerson(distinctId) }
            }
        }
    }

    /** Placements this device has resolved before, newest last. */
    private fun knownPlacements(): List<String> {
        val stored = cacheManager.getArray(KNOWN_PLACEMENTS_CACHE_KEY)?.value ?: return emptyList()
        return (0 until stored.length())
            .mapNotNull { (stored.opt(it) as? String)?.takeIf(String::isNotEmpty) }
            .fold(emptyList()) { placements, placement ->
                (placements - placement + placement).takeLast(KNOWN_PLACEMENTS_LIMIT)
            }
    }

    private fun rememberPlacement(placement: String) {
        val known = knownPlacements()
        if (known.lastOrNull() == placement) return
        val updated = (known - placement + placement).takeLast(KNOWN_PLACEMENTS_LIMIT)
        if (updated == known) return
        cacheManager.set(KNOWN_PLACEMENTS_CACHE_KEY, JSONArray(updated))
    }

    private fun flagsCacheKey(distinctId: String, keys: List<String>): String {
        val scope = if (keys.isEmpty()) {
            "all"
        } else {
            fnv1aHex(
                keys.sorted().joinToString(separator = "") { key ->
                    "${key.toByteArray(Charsets.UTF_8).size}:$key"
                },
            )
        }
        return "flags:$distinctId:$scope"
    }

    private fun paywallCacheKey(distinctId: String, location: String): String =
        "paywall:$distinctId:$location"

    private fun encodeFlags(flags: List<FeatureFlag>): JSONArray = JSONArray(
        flags.map { flag ->
            JSONObject()
                .put("key", flag.key)
                .put("enabled", flag.enabled)
                .put("variantKey", flag.variantKey ?: JSONObject.NULL)
        },
    )

    private fun decodeFlags(stored: JSONArray): List<FeatureFlag> =
        (0 until stored.length()).mapNotNull { index ->
            val flag = stored.optJSONObject(index) ?: return@mapNotNull null
            FeatureFlag(
                key = flag.optString("key"),
                enabled = flag.optBoolean("enabled"),
                variantKey = flag.optString("variantKey").takeIf {
                    it.isNotEmpty() && !flag.isNull("variantKey")
                },
            )
        }

    private fun personCacheKey(distinctId: String): String = "person:$distinctId"

    private fun cachePerson(distinctId: String, person: VoidhashPerson) {
        cacheManager.set(
            personCacheKey(distinctId),
            person.raw,
            ttlMs = PERSON_CACHE_TTL_MS,
            staleTimeMs = PERSON_CACHE_STALE_TIME_MS,
        )
    }

    private suspend fun runQuietly(context: String, block: suspend () -> Unit) {
        try {
            block()
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            onWarning("Failed to $context: ${error.message}")
        }
    }

    private fun requireSchema(): RuntimeSchema = schemaRef.get()
        ?: throw VoidhashException(
            "CONFIGURATION_MISSING",
            "Voidhash schema is not resolved yet — call initialize() first",
        )
}
