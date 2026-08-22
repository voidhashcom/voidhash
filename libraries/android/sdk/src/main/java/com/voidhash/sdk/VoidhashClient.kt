package com.voidhash.sdk

import android.app.Activity
import com.voidhash.sdk.analytics.AnalyticsClient
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
import com.voidhash.sdk.cache.CacheManager
import com.voidhash.sdk.identity.IdentityStore
import com.voidhash.sdk.paywall.PaywallCoordinator
import com.voidhash.sdk.paywall.PaywallListener
import com.voidhash.sdk.paywall.PaywallPurchaseHandler
import com.voidhash.sdk.schema.RuntimeSchema
import com.voidhash.sdk.schema.SchemaManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

/** 2 days — the shared person-cache lifetime across the Voidhash SDKs. */
private const val PERSON_CACHE_TTL_MS = 1000L * 60 * 60 * 24 * 2

/** 5 minutes — after this a cached person is served but considered stale. */
private const val PERSON_CACHE_STALE_TIME_MS = 1000L * 60 * 5

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
    private val billing: BillingEnginePort,
    private val scope: CoroutineScope,
    private val paywallCoordinatorFactory: (PaywallPurchaseHandler) -> PaywallCoordinator,
    private val activitySink: (Activity?) -> Unit,
    private val enabled: Boolean,
    readOnly: Boolean,
    private val onWarning: (String) -> Unit = {},
) {
    private val readOnlyFlag = AtomicBoolean(readOnly)
    private val schemaRef = AtomicReference<RuntimeSchema?>(null)
    private val initMutex = Mutex()
    private var initialized = false

    private val paywallPurchaseHandler = object : PaywallPurchaseHandler {
        override suspend fun products(): List<VoidhashProduct> = getProducts()

        override suspend fun purchase(product: VoidhashProduct): VoidhashTransaction =
            orchestrator.purchase(product, requireSchema())

        override suspend fun restorePurchases() {
            this@VoidhashClient.restorePurchases()
        }
    }

    internal val currentReadOnly: Boolean get() = readOnlyFlag.get()

    /**
     * Connects to the store, resolves the schema and reconciles anything the
     * store still reports as unfinished.
     *
     * Safe to call repeatedly: only the first *successful* call does work.
     * Concurrent callers wait for it, so nobody returns from `initialize()`
     * before the schema is available. A failed call leaves the client
     * uninitialized and can be retried.
     */
    suspend fun initialize() {
        if (!enabled) return

        initMutex.withLock {
            if (initialized) return

            try {
                val distinctId = identityStore.getDistinctId()
                // `resolveSchema` publishes through `publishSchema`, and a warm
                // cache can revalidate before it returns — so only fill the gap
                // if nothing was published, never overwrite a fresher schema.
                val schema = schemaManager.resolveSchema(distinctId)
                schemaRef.compareAndSet(null, schema)

                billing.initConnection { purchase ->
                    scope.launch {
                        try {
                            orchestrator.processObservedTransaction(
                                mapBillingPurchaseToTransaction(purchase),
                                requireSchema(),
                            )
                        } catch (error: CancellationException) {
                            throw error
                        } catch (error: Throwable) {
                            onWarning("Failed to process an observed purchase: ${error.message}")
                        }
                    }
                }

                runQuietly("reconcile observed transactions") {
                    orchestrator.reconcileObservedTransactions(requireSchema())
                }

                analyticsClient.start(scope)
                initialized = true
            } catch (error: Throwable) {
                schemaRef.set(null)
                throw error
            }
        }
    }

    /** Returns the store products for every product configured in the schema. */
    suspend fun getProducts(): List<VoidhashProduct> {
        if (!enabled) return emptyList()
        return orchestrator.getProducts(requireSchema())
    }

    /**
     * Buys [product]. [activity] becomes the activity Play Billing launches its
     * flow from.
     */
    suspend fun purchase(activity: Activity, product: VoidhashProduct): VoidhashTransaction {
        check(enabled) { "CONFIGURATION_MISSING: Voidhash is disabled" }
        activitySink(activity)
        return try {
            orchestrator.purchase(product, requireSchema())
        } finally {
            activitySink(null)
        }
    }

    /** Reconciles every purchase the store still reports and refreshes the person. */
    suspend fun restorePurchases() {
        if (!enabled) return
        orchestrator.restorePurchases(requireSchema())
    }

    /**
     * Returns the current person. The snapshot is cached for two days (stale
     * after five minutes); [forceFetch] bypasses the cache.
     */
    suspend fun getCurrentPerson(forceFetch: Boolean = false): VoidhashPerson? {
        if (!enabled) return null

        val distinctId = identityStore.getDistinctId()
        if (!forceFetch) {
            cacheManager.getObject(personCacheKey(distinctId))?.let {
                return VoidhashPerson.fromJson(it.value)
            }
        }

        val person = apiClient.getPerson(distinctId)
        person?.let { cachePerson(distinctId, it) }
        return person
    }

    /** Aliases the current (anonymous) identity onto [externalUserId]. */
    suspend fun identify(
        externalUserId: String,
        email: String? = null,
        name: String? = null,
    ): VoidhashPerson? {
        if (!enabled) return null
        val person = apiClient.identify(
            identityStore.getDistinctId(),
            externalUserId,
            email,
            name,
        )
        identityStore.setDistinctId(externalUserId)
        cachePerson(externalUserId, person)
        return person
    }

    /** Writes person traits. */
    suspend fun setPersonAttributes(attributes: Map<String, Any?>) {
        if (!enabled) return
        apiClient.setPersonAttributes(identityStore.getDistinctId(), attributes)
    }

    /** Clears the local identity and cache; the next call generates a new anonymous id. */
    suspend fun reset() {
        identityStore.reset()
    }

    /** Evaluates feature flags; an empty [keys] list evaluates every flag. */
    suspend fun getFeatureFlags(keys: List<String> = emptyList()): List<FeatureFlag> {
        if (!enabled) return emptyList()
        return apiClient.evaluateFlags(identityStore.getDistinctId(), keys)
    }

    /** Queues an analytics event. */
    fun capture(name: String, properties: Map<String, Any?> = emptyMap()) {
        if (!enabled) return
        analyticsClient.capture(name, properties, scope)
    }

    /** Sends every queued analytics event. */
    suspend fun flush() {
        if (!enabled) return
        analyticsClient.flush()
    }

    /** The distinct id requests are made as. */
    fun getDistinctId(): String = identityStore.getDistinctId()

    /**
     * Switches observer mode. In observer mode transactions are still synced to
     * the backend but never finished with the store — the host app owns that.
     */
    fun setReadOnly(readOnly: Boolean) {
        readOnlyFlag.set(readOnly)
    }

    /**
     * Presents the paywall configured for [location].
     *
     * @return false when no paywall is showing for the location.
     */
    suspend fun presentPaywall(
        activity: Activity,
        location: String,
        listener: PaywallListener? = null,
    ): Boolean {
        if (!enabled) return false
        activitySink(activity)

        val coordinator = paywallCoordinatorFactory(paywallPurchaseHandler)
        return coordinator.present(location, listener) { raw ->
            scope.launch {
                try {
                    coordinator.handleBridgeMessage(location, raw)
                } catch (error: CancellationException) {
                    throw error
                } catch (error: Throwable) {
                    // The page is waiting on this request; a vanished exception
                    // would leave its button spinning forever.
                    coordinator.reportBridgeMessageFailure(location, raw, error)
                }
            }
        }
    }

    /** Ends the store connection, stops the analytics daemon and cancels the SDK scope. */
    suspend fun shutdown() {
        analyticsClient.stop()
        runQuietly("flush the analytics queue") { analyticsClient.flush() }
        runQuietly("end the billing connection") { billing.endConnection() }
        scope.cancel()
    }

    /**
     * Adopts a schema resolved outside [initialize] — the stale-while-revalidate
     * refresh — so a warm-cache session stops running on the stale schema.
     */
    internal fun publishSchema(schema: RuntimeSchema) {
        schemaRef.set(schema)
    }

    /**
     * Resolves the paywall configured for [location] without presenting it.
     *
     * Embedded hosts (for example the React Native SDK) use this together with
     * their own presenter; the returned envelope carries everything a renderer
     * needs.
     */
    suspend fun resolvePaywall(location: String): ResolvedPaywall? {
        if (!enabled) return null
        return apiClient.resolvePaywall(identityStore.getDistinctId(), location)
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

    /** Syncs a store transaction; returns whether the backend accepted it. */
    suspend fun syncStoreTransaction(
        distinctId: String,
        request: SyncTransactionRequest,
    ): Boolean = apiClient.syncTransaction(distinctId, request)

    /** Records a development purchase through the development gateway. */
    suspend fun recordDevelopmentPurchase(
        distinctId: String,
        request: DevelopmentPurchaseRequest,
    ) {
        apiClient.developmentPurchase(distinctId, request)
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
