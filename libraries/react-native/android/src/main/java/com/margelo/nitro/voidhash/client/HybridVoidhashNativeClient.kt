@file:OptIn(VoidhashHostApi::class)

package com.margelo.nitro.voidhash

import com.voidhash.sdk.VoidhashHostApi
import android.app.Activity
import android.content.Context
import androidx.annotation.Keep
import com.android.billingclient.api.BillingClient
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import com.margelo.nitro.voidhash.client.LegacyStorageImporter
import com.margelo.nitro.voidhash.client.toNative
import com.margelo.nitro.voidhash.flows.VoidhashFlowsCore
import com.voidhash.sdk.AnalyticsConsent
import com.voidhash.sdk.ClientEvent
import com.voidhash.sdk.FeatureFlagOptions
import com.voidhash.sdk.FlowCapability
import com.voidhash.sdk.FlowException
import com.voidhash.sdk.FlowFailure
import com.voidhash.sdk.FlowResult
import com.voidhash.sdk.FlagsState
import com.voidhash.sdk.FreshnessReason
import com.voidhash.sdk.GooglePlayInAppMessageResult
import com.voidhash.sdk.HostSettings
import com.voidhash.sdk.PendingAnalytics
import com.voidhash.sdk.PersonState
import com.voidhash.sdk.PlatformServices
import com.voidhash.sdk.ScreenTrackingOptions
import com.voidhash.sdk.Voidhash
import com.voidhash.sdk.VoidhashClient
import com.voidhash.sdk.VoidhashException
import com.voidhash.sdk.VoidhashGroup
import com.voidhash.sdk.VoidhashOptions
import com.voidhash.sdk.VoidhashPurchaseException
import com.voidhash.sdk.WriteStatus
import com.voidhash.sdk.analytics.AutomaticEvents
import com.voidhash.sdk.analytics.FlushStatus
import com.voidhash.sdk.api.FeatureFlag
import com.voidhash.sdk.billing.GooglePlayPurchaseOptions
import com.voidhash.sdk.billing.PurchaseFailureReason
import com.voidhash.sdk.billing.SubscriptionReplacement
import com.voidhash.sdk.billing.SubscriptionReplacementMode
import com.voidhash.sdk.billing.VoidhashOfferSelection
import com.voidhash.sdk.billing.VoidhashProduct
import com.voidhash.sdk.billing.VoidhashPurchaseOptions
import com.voidhash.sdk.billing.VoidhashPurchaseResult
import com.voidhash.sdk.diagnostics.VoidhashDiagnostic
import com.voidhash.sdk.isAnonymousDistinctId
import com.voidhash.sdk.diagnostics.VoidhashDiagnosticKind
import com.voidhash.sdk.identity.invalidGroupReason
import com.voidhash.sdk.platform.whenStartedUnlocked
import com.voidhash.sdk.transactions.isScalarTraitValue
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CompletableJob
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.Executor
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/** Captures and screens kept before `start()`, attributed to the identity it loads. */
private const val PRE_START_CAPTURE_LIMIT = 100

/** Diagnostics kept for a listener that is not set yet. */
private const val PRE_LISTENER_DIAGNOSTIC_LIMIT = 100

/**
 * The version of the bridge contract (`src/specs/VoidhashNativeClient.nitro.ts`) this module
 * implements: the facade's `NATIVE_CONTRACT_VERSION`, which starts no client of another.
 */
internal const val NATIVE_CONTRACT_VERSION = 1

/** A rejection the facade reads its code from: the message is always `"<CODE>: <detail>"`. */
internal class NativeClientException(val code: String, detail: String, cause: Throwable? = null) :
    RuntimeException("$code: $detail", cause)

/**
 * The React Native client over the bare SDK's [VoidhashClient] (`VoidhashNativeClient.nitro.ts`).
 *
 * Every behaviour is the SDK's; this class maps the contract onto it. Two rules are its own:
 *
 * - **Order.** Events and promise settlements go through one serial queue, in the order the client
 *   produced them. The client announces a change synchronously where it happens, so an event a call
 *   caused is queued before that call's settlement, and reaches JavaScript first.
 * - **Lifetime.** `configure()` only records the options. `start()` configures the SDK, which
 *   retires any client still running in the process (a JavaScript reload leaves one behind), and
 *   initializes it from local state. `shutdown()` rejects every call still pending with
 *   `NOT_INITIALIZED` before it resolves, so no answer from that run arrives after it.
 * - **First unlock.** In a process Android starts before the device was first unlocked, `start()`
 *   waits for the unlock before it opens anything (see [awaitFirstUnlock]), so the SDK is never
 *   configured into the inert client it returns there, which this class could not follow.
 */
@Keep
@DoNotStrip
class HybridVoidhashNativeClient internal constructor(
    private val contextProvider: () -> Context?,
    private val activityProvider: () -> Activity?,
    private val platform: PlatformServices,
    private val delivery: Executor,
    /** Where a call starts running; replaceable so a test decides when that is. */
    private val callDispatcher: CoroutineDispatcher = Dispatchers.Default,
) : HybridVoidhashNativeClientSpec() {
    constructor() : this(
        contextProvider = { NitroModules.applicationContext },
        activityProvider = { NitroModules.applicationContext?.currentActivity },
        platform = PlatformServices(),
        // One thread, ended once idle: an instance a JavaScript reload left behind keeps none.
        delivery = ThreadPoolExecutor(1, 1, 5, TimeUnit.SECONDS, LinkedBlockingQueue()) { runnable ->
            Thread(runnable, "voidhash-react-native-client").apply { isDaemon = true }
        }.apply { allowCoreThreadTimeOut(true) },
    )

    private companion object {
        /** Whether a `start()` of this process already adopted the `distinctId` option. */
        @Volatile
        var distinctIdAdopted = false

        /**
         * The wait of the one start in this process that waits for the first unlock. A newer
         * instance's start takes it over, as its start retires an older instance's client.
         */
        val startAwaitingUnlock = AtomicReference<CompletableDeferred<Unit>?>(null)
    }

    private class PendingCapture(val name: String, val properties: Map<String, Any?>, val at: Long)

    private val lock = Any()
    private var configuration: NativeClientConfiguration? = null
    private var readOnly: Boolean? = null

    /** A consent `setAnalyticsConsent()` chose before `start()`; it wins over the configuration's. */
    private var chosenConsent: NativeAnalyticsConsent? = null

    @Volatile
    private var client: VoidhashClient? = null

    /**
     * The products the client's last [getProducts] answered, by slug: the ones [purchase] buys and
     * [showManageSubscriptions] names, without asking Google Play again before every sheet.
     * Dropped once a purchase or a restore may have changed the offers the end user is eligible
     * for. Guarded by [lock].
     */
    private var heldProducts: Map<String, VoidhashProduct> = emptyMap()

    /**
     * Counts the products loads begun and the drops of [heldProducts]: only the latest load begun
     * since the last drop is held, so an earlier, slower one never replaces its answer. Guarded by
     * [lock].
     */
    private var productsLoads = 0

    @Volatile
    private var listener: ((NativeClientEvent) -> Unit)? = null
    private val pendingCaptures = ArrayDeque<PendingCapture>()
    private val pendingDiagnostics = ArrayDeque<NativeDiagnostic>()
    private var droppedBeforeStart = 0

    /**
     * Whether captures go to the client. Not before `initialize` has loaded the consent stored on
     * the device: until then the client knows only the option, and a capture would be refused or
     * kept on its say.
     */
    private var capturesOpen = false

    /** The run the client's callbacks belong to; a later start or a shutdown silences an earlier run's. */
    @Volatile
    private var run = 0

    /**
     * Keeps identity changes and person writes in call order: a write queued before an identify
     * belongs to the identity before it. FIFO, and taken on the calling thread.
     */
    private val identityOrder = Mutex()

    /** The calls of the current run; [shutdown] cancels them and rejects their promises. */
    private var calls: CompletableJob = SupervisorJob()
    private var callScope = CoroutineScope(calls + callDispatcher)
    private val lifecycleScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    // ---- Lifecycle ----

    override fun contractVersion(): Double = NATIVE_CONTRACT_VERSION.toDouble()

    override fun configure(configuration: NativeClientConfiguration) {
        synchronized(lock) { this.configuration = configuration }
    }

    override fun start(): Promise<Unit> {
        val promise = Promise<Unit>()
        // A start already running is joined; one that is done starts nothing again.
        synchronized(lock) {
            if (starting?.isCompleted != false && client?.isClosed == false) {
                settle(promise, Result.success(Unit))
                return promise
            }
            startPromises += promise
            if (starting?.isCompleted == false) return promise
            val thisRun = ++run
            starting = lifecycleScope.launch {
                val outcome = runCatching { startClient(thisRun) }
                // Queued from the start itself and under the lock, with the start taken out of
                // `starting` in the same step: a `start()` made from here on begins anew instead
                // of adding its promise to a list nobody settles any more, and a shutdown that
                // finds no start to wait for resolves after these.
                synchronized(lock) {
                    val settling = startPromises.toList()
                    startPromises.clear()
                    if (starting === coroutineContext[Job]) starting = null
                    settling.forEach { settle(it, outcome) }
                }
            }
        }
        return promise
    }

    /** The start in flight, if any; [shutdown] waits for it. Guarded by [lock]. */
    private var starting: Job? = null

    /** The wait of the start in flight for the first unlock, which [shutdown] ends. Guarded by [lock]. */
    private var awaitingUnlock: CompletableDeferred<Unit>? = null

    /**
     * Suspends the start that is run [thisRun] until the device was unlocked for the first time
     * since it started. Before that, in a process Android starts for a `directBootAware`
     * component, nothing the SDK or the TypeScript core stored can be opened: the start waits
     * rather than begin as a fresh install, and reads and writes nothing meanwhile. Captures are
     * held as before any start. A [shutdown] ends the wait, and so does the start of a newer
     * instance; both reject this start with `NOT_INITIALIZED`.
     */
    private suspend fun awaitFirstUnlock(context: Context, thisRun: Int) {
        if (platform.userUnlocked(context)) return
        val unlocked = CompletableDeferred<Unit>()
        synchronized(lock) {
            if (run != thisRun) throw notInitialized()
            awaitingUnlock = unlocked
        }
        startAwaitingUnlock.getAndSet(unlocked)?.completeExceptionally(notInitialized())
        val announce = { unlocked.complete(Unit); Unit }
        // When Android refuses the unlock receiver, the next activity to start on the unlocked
        // device ends the wait instead.
        val stopWaiting = platform.whenUserUnlocked(context, announce)
            ?: whenStartedUnlocked(context, { platform.userUnlocked(context) }, announce)
        try {
            // Unlocked between the check above and the registration: nothing announces it any more.
            if (platform.userUnlocked(context)) unlocked.complete(Unit)
            unlocked.await()
        } finally {
            stopWaiting()
            startAwaitingUnlock.compareAndSet(unlocked, null)
            synchronized(lock) { if (awaitingUnlock === unlocked) awaitingUnlock = null }
        }
    }

    /** The promises of the start in flight. Guarded by [lock]. */
    private val startPromises = mutableListOf<Promise<Unit>>()

    /** The start that is run [thisRun]: overtaken by a [shutdown], it starts nothing, or stops what it started. */
    private suspend fun startClient(thisRun: Int) {
        val configuration = synchronized(lock) { configuration }
            ?: throw NativeClientException("NOT_INITIALIZED", "configure() was not called")
        if (client?.isClosed == false) return
        val context = contextProvider()?.applicationContext
            ?: throw NativeClientException("NOT_INITIALIZED", "The React Native host has no application context")
        awaitFirstUnlock(context, thisRun)

        // What the TypeScript core stored is adopted before the SDK reads any of it, and once a
        // client a JavaScript reload left running can no longer write over it.
        withContext(Dispatchers.IO) {
            Voidhash.retireRunningClient()
            LegacyStorageImporter(context, configuration.publishableKey, configuration.baseUrl).import()
        }
        if (synchronized(lock) { run } != thisRun) throw notInitialized()
        // The client this start configures, once there is one: the instance may still hold an
        // earlier start's closed client until then.
        val configured = AtomicReference<VoidhashClient?>(null)

        val pinned = configuration.distinctId?.takeUnless { distinctIdAdopted }
        // `appStoreMessages` and `purchaseIntents` are StoreKit's; Google Play has nothing they apply to.
        val options = VoidhashOptions(
            baseUrl = configuration.baseUrl,
            ingestUrl = configuration.ingestUrl,
            debug = configuration.debug,
            distinctId = pinned,
            readOnly = readOnly ?: configuration.readOnly,
            dev = configuration.developmentMode,
            // The facade's navigation integrations report screens through `screen()`.
            screenTracking = ScreenTrackingOptions(automatic = false),
            automaticLifecycleEvents = configuration.automaticLifecycleEvents,
            preloadLocations = configuration.preloadLocations.toList(),
            flowRevisions = configuration.flowRevisions.associate { it.location to it.revision.toInt() },
            flowRenderer = VoidhashFlowsCore.linkedRenderer(
                runtimeModules = configuration.flowRuntime == NativeFlowRuntime.MODULE,
            ),
            flowCapabilities = configuration.flowCapabilities.map(::flowCapability).toSet(),
            featureFlags = FeatureFlagOptions(
                maxWaitMs = configuration.featureFlagMaxWaitMs?.toLong() ?: FeatureFlagOptions().maxWaitMs,
                defaults = configuration.featureFlagDefaults.orEmpty(),
            ),
            onDiagnostic = { diagnostic -> if (isCurrent(thisRun, configured.get())) onDiagnostic(diagnostic) },
            analyticsConsent = consent(configuration.analyticsConsent),
            analyticsWhilePending = when (configuration.analyticsWhilePending) {
                NativePendingAnalytics.DROP -> PendingAnalytics.DROP
                NativePendingAnalytics.BUFFER -> PendingAnalytics.BUFFER
            },
            grantConsentOnIdentify = configuration.grantConsentOnIdentify,
            installAttribution = configuration.installAttribution,
            metaAppId = configuration.metaAppId,
        )
        val started = Voidhash.configure(
            context,
            configuration.publishableKey,
            options,
            platform,
            HostSettings(
                sdkName = "react-native",
                sdkVersion = configuration.sdkVersion,
                onEvent = { event -> if (isCurrent(thisRun, configured.get())) onClientEvent(event) },
            ),
        )
        configured.set(started)
        if (pinned != null) distinctIdAdopted = true
        // Chosen in this process before the start: it wins, is stored, and is in effect before
        // anything below captures. The client announces it as the consent `initialize` settles on.
        val chosen = synchronized(lock) { chosenConsent } ?: configuration.chosenAnalyticsConsent
        chosen?.let { started.setAnalyticsConsent(consent(it)) }
        configuration.internalSchemaJson?.let { started.injectInternalSchemaJson(it) }
        val published = synchronized(lock) {
            (run == thisRun).also { current ->
                if (current) {
                    // An observer mode set since the options were built found no client to tell:
                    // under the lock `setReadOnly` stores it under, so none is missed, and before
                    // `initialize` below can scan the store.
                    readOnly?.let(started::setReadOnly)
                    client = started
                    chosenConsent = null
                    capturesOpen = false
                }
            }
        }
        if (!published) {
            // A shutdown overtook this start: what it started does not outlive it.
            started.shutdown()
            throw notInitialized()
        }
        try {
            started.initialize()
        } finally {
            openCaptures(started)
        }
    }

    /**
     * Hands the captures held since before the start to [started], with their call times. The
     * client records, holds or drops them by the consent it settled on.
     * Under the lock, so a capture made meanwhile cannot overtake them.
     */
    private fun openCaptures(started: VoidhashClient) {
        synchronized(lock) {
            if (client !== started) return
            for (capture in pendingCaptures) started.capture(capture.name, capture.properties, capture.at)
            pendingCaptures.clear()
            capturesOpen = true
        }
        reportDroppedCaptures()
    }

    /** Whether [run] is still this instance's, and its client [started] not retired by another one. */
    private fun isCurrent(run: Int, started: VoidhashClient?): Boolean = run == this.run && started?.isClosed != true

    override fun shutdown(): Promise<NativeFlushStatus> {
        val promise = Promise<NativeFlushStatus>()
        val (stopping, pending, inFlight) = synchronized(lock) {
            val inFlight = starting
            val stopping = client
            client = null
            heldProducts = emptyMap()
            productsLoads += 1
            capturesOpen = false
            run += 1
            awaitingUnlock?.completeExceptionally(notInitialized())
            val pending = calls
            calls = SupervisorJob()
            callScope = CoroutineScope(calls + callDispatcher)
            Triple(stopping, pending, inFlight)
        }
        lifecycleScope.launch {
            // A start this overtook stops what it started and rejects before this resolves.
            inFlight?.join()
            // Each cancelled call queues its NOT_INITIALIZED rejection before this resolves.
            pending.cancelAndJoin()
            val outcome = runCatching { (stopping?.shutdown() ?: FlushStatus(0, 0)).toNative() }
            settle(promise, outcome)
        }
        return promise
    }

    override fun setEventListener(listener: (event: NativeClientEvent) -> Unit) {
        deliver {
            this.listener = listener
            // What happened while nobody listened.
            while (pendingDiagnostics.isNotEmpty()) {
                val diagnostic = pendingDiagnostics.removeFirst()
                runCatching { listener(event(NativeClientEventType.DIAGNOSTIC, diagnostic = diagnostic)) }
            }
        }
        reportDroppedCaptures()
    }

    /** Reports the captures dropped before the start, once a listener is there to hear it. */
    private fun reportDroppedCaptures() {
        deliver {
            val current = listener ?: return@deliver
            val dropped = synchronized(lock) { droppedBeforeStart.also { droppedBeforeStart = 0 } }
            if (dropped == 0) return@deliver
            val diagnostic = NativeDiagnostic(
                NativeDiagnosticKind.EVICTION,
                "ANALYTICS_EVENT_DROPPED",
                "analytics.capture",
                false,
                null,
                "Dropped the $dropped oldest events captured before the client finished starting: " +
                    "at most $PRE_START_CAPTURE_LIMIT are kept",
            )
            current(event(NativeClientEventType.DIAGNOSTIC, diagnostic = diagnostic))
        }
    }

    override fun removeEventListener() {
        deliver { listener = null }
    }

    // ---- Identity and person ----

    override fun getDistinctId(): Promise<String> = call { it.getDistinctId() }

    override fun identify(externalUserId: String, email: String?, name: String?): Promise<NativeIdentifyResult> =
        call(ordered = true) { client ->
            val previous = client.getDistinctId()
            val identified = client.identifyForHost(externalUserId, email, name)
            NativeIdentifyResult(
                identity = NativeIdentityChange(identified.distinctId, previous, identified.generation.toDouble()),
                status = writeStatus(identified.result.status),
                personJson = identified.result.person?.raw?.toString(),
            )
        }

    override fun reset(): Promise<NativeIdentityChange> = switchToAnonymous(signOut = false)

    override fun signOut(): Promise<NativeIdentityChange> = switchToAnonymous(signOut = true)

    /**
     * The client's `reset()` or `signOut()`. The identity switches at once; what a person who
     * was signed out left queued goes out after. Replacing an anonymous visitor, or signing out
     * nobody, sends nothing.
     */
    private fun switchToAnonymous(signOut: Boolean): Promise<NativeIdentityChange> = call(ordered = true) { client ->
        val previous = client.getDistinctId()
        val distinctId = client.switchToAnonymous(signOut)
        if (distinctId != previous && !isAnonymousDistinctId(previous)) client.flush()
        NativeIdentityChange(distinctId, previous, client.identityGeneration.toDouble())
    }

    override fun group(groupType: String, groupKey: String, propertiesJson: String?): Promise<Unit> =
        call(ordered = true) { client ->
            invalidGroupReason(groupType, groupKey)?.let { throw NativeClientException("INVALID_ARGUMENT", it) }
            val properties = propertiesJson?.let { json ->
                val document = try {
                    JSONObject(json)
                } catch (error: Exception) {
                    throw NativeClientException("INVALID_ARGUMENT", "Group properties are not a JSON object")
                }
                jsonMap(document)
            }
            client.group(groupType, groupKey, properties)
        }

    override fun setGroups(groupsJson: String): Promise<Unit> = call(ordered = true) { client ->
        val document = try {
            JSONObject(groupsJson)
        } catch (error: Exception) {
            throw NativeClientException("INVALID_ARGUMENT", "Groups are not a JSON object")
        }
        client.setGroups(
            document.keys().asSequence().associateWith { type ->
                val group = document.optJSONObject(type)
                    ?: throw NativeClientException("INVALID_ARGUMENT", "Group \"$type\" is not a JSON object")
                val id = group.opt("id") as? String
                    ?: throw NativeClientException("INVALID_ARGUMENT", "Group \"$type\" has no string id")
                VoidhashGroup(id, group.optJSONObject("properties")?.let(::jsonMap).orEmpty())
            },
        )
    }

    override fun resetGroups(): Promise<Unit> = call(ordered = true) { it.resetGroups() }

    override fun getGroups(): Map<String, String> = client?.takeUnless { it.isClosed }?.groups.orEmpty()

    override fun setPersonAttributes(attributesJson: String): Promise<Unit> = call(ordered = true) { client ->
        // Resolves once queued for the identity in effect; the network is not waited on.
        client.queuePersonAttributes(attributes(attributesJson), null, null)
    }

    override fun setPersonAttributesState(attributesJson: String): Promise<NativePersonWriteResult> = call(ordered = true) { client ->
        val result = client.setPersonAttributesWithStatus(attributes(attributesJson), null, null)
        NativePersonWriteResult(writeStatus(result.status), result.person?.raw?.toString())
    }

    override fun getPersonState(forceFetch: Boolean): Promise<NativePersonState> =
        call { client -> client.readPerson(forceFetch, surfaceAuthFailure = true).toNative() }

    override fun resetPersonCache(): Promise<Unit> = call { it.resetPersonCache() }

    // ---- Flags, paywalls and products ----

    override fun getFeatureFlags(flagKeys: Array<String>?): Promise<NativeFeatureFlagsResult> = call { client ->
        client.readFlags(flagKeys?.toList().orEmpty(), surfaceAuthFailure = true).state.toNative()
    }

    override fun getPaywall(location: String): Promise<String> = call { it.resolvePaywallJson(location) }

    override fun getProducts(): Promise<Array<NativeProduct>> {
        val load = synchronized(lock) { ++productsLoads }
        return call { client ->
            val products = client.getProducts()
            synchronized(lock) {
                // A load that a shutdown, a later load or a purchase overtook is not held: it
                // belongs to a client no longer started, or answers for outdated offers.
                if (this.client === client && productsLoads == load) {
                    heldProducts = products.associateBy { it.slug }
                }
            }
            products.map { it.toNative() }.toTypedArray()
        }
    }

    /**
     * The products [slugs] name: the ones held, and Google Play's answer now for the others, `null`
     * where it sells none.
     */
    private suspend fun products(client: VoidhashClient, slugs: List<String>): List<VoidhashProduct?> {
        val held = synchronized(lock) { heldProducts }
        val missing = slugs.filterNot(held::containsKey).distinct()
        val loaded = if (missing.isEmpty()) emptyMap() else missing.zip(client.getProducts(missing)).toMap()
        return slugs.map { held[it] ?: loaded[it] }
    }

    /**
     * Forgets the products held, and any load running, after a purchase or a restore: what the end
     * user bought can change the offers they are eligible for. Until the facade loads them again,
     * [purchase] asks Google Play for the products it buys.
     */
    private fun dropHeldProducts() {
        synchronized(lock) {
            heldProducts = emptyMap()
            productsLoads += 1
        }
    }

    // ---- Purchases ----

    override fun purchase(productSlug: String, options: NativePurchaseOptions): Promise<NativePurchaseResult> = call { client ->
        // Refused before Google Play is touched, as the client itself refuses it.
        if (client.isReadOnly) {
            throw NativeClientException(
                "READ_ONLY_PURCHASE_NOT_ALLOWED",
                "Read-only mode is enabled. Purchasing is disabled for observer-only operation.",
            )
        }
        // The products the last load answered, as the App Store bridge buys them; Google Play is
        // asked only for one not held. The replaced one is named by its slug as the bought one is.
        val loaded = products(client, listOfNotNull(productSlug, options.replacing?.productSlug))
        fun current(index: Int, slug: String) = loaded[index]
            ?: throw NativeClientException("INVALID_ARGUMENT", "No product \"$slug\" can be bought on Google Play")
        val product = current(0, productSlug)
        val replacing = options.replacing?.let { SubscriptionReplacement(current(1, it.productSlug), replacementMode(it.mode)) }
        val quantity = options.quantity.toInt().takeIf { it >= 1 && it.toDouble() == options.quantity }
            ?: throw NativeClientException("INVALID_ARGUMENT", "The quantity ${options.quantity} is not a positive whole number")
        // The App Store options are StoreKit's; Google Play has nothing to apply them to.
        val purchaseOptions = VoidhashPurchaseOptions(
            offer = offerSelection(product, options),
            quantity = quantity,
            replacing = replacing,
            googlePlay = options.googlePlay?.let {
                GooglePlayPurchaseOptions(it.isOfferPersonalized, it.obfuscatedProfileId, it.offerToken)
            },
        )
        val activity = requireActivity()
        val result = try {
            client.purchase(activity, product, purchaseOptions)
        } catch (error: VoidhashPurchaseException) {
            // The store's reason is the code the facade reads it from.
            val reason = when (error.reason) {
                PurchaseFailureReason.PAYMENT_DECLINED -> "PAYMENT_DECLINED"
                PurchaseFailureReason.INELIGIBLE_FOR_OFFER -> "INELIGIBLE_FOR_OFFER".also { dropHeldProducts() }
                null -> throw error
            }
            throw NativeClientException(reason, error.description, error)
        }
        when (result) {
            is VoidhashPurchaseResult.Purchased -> {
                dropHeldProducts()
                NativePurchaseResult(NativePurchaseOutcome.PURCHASED, result.transaction.toNative(), result.synced)
            }
            VoidhashPurchaseResult.Pending -> NativePurchaseResult(NativePurchaseOutcome.PENDING, null, null)
            VoidhashPurchaseResult.Cancelled -> NativePurchaseResult(NativePurchaseOutcome.CANCELLED, null, null)
            // Only a client the SDK made inert, as in a secondary process; the facade's own
            // `enabled: false` never reaches the native client. Reported as on iOS, as a client
            // that is not started.
            VoidhashPurchaseResult.Disabled ->
                throw NativeClientException("NOT_INITIALIZED", "Voidhash is inert in this process; nothing was bought")
        }
    }

    override fun restorePurchases(): Promise<NativePersonState> = call { client ->
        client.restorePurchases()
        dropHeldProducts()
        // What the restore cached, with the freshness and generation it is read under.
        client.readPerson(forceFetch = false).toNative()
    }

    override fun syncPurchases(): Promise<Unit> = call { it.syncPurchases() }

    override fun reportTransaction(transaction: NativeReportedTransaction, isRestore: Boolean): Promise<Unit> = call { client ->
        if (transaction.platform != NativeStorePlatform.GOOGLEPLAY) {
            throw NativeClientException("UNSUPPORTED_PLATFORM", "Only Google Play purchases can be reported on Android")
        }
        val token = transaction.purchaseToken?.takeIf { it.isNotBlank() }
            ?: throw NativeClientException("INVALID_ARGUMENT", "A Google Play purchase token is required")
        // A pending or unspecified purchase is ignored; the integration reports it again once purchased.
        val state = transaction.purchaseState ?: NativeReportedPurchaseState.PURCHASED
        if (state == NativeReportedPurchaseState.PURCHASED) client.reportTransaction(token, isRestore)
    }

    // ---- Store actions, both stores ----

    override fun showManageSubscriptions(productSlug: String?): Promise<Unit> = call { client ->
        val activity = requireActivity()
        // A product Google Play does not return opens the list of every subscription instead.
        val product = productSlug?.let { products(client, listOf(it)).single() }
        client.showManageSubscriptions(activity, product)
    }

    override fun presentCodeRedemption(code: String?): Promise<Unit> = call { client ->
        client.presentCodeRedemption(requireActivity(), code)
    }

    override fun getStorefront(): Promise<NativeStorefront?> = call { client ->
        client.getStorefront()?.let { NativeStorefront(it.countryCode, it.currencyCode) }
    }

    override fun canMakePayments(): Promise<Boolean> = call { it.canMakePayments() }

    // ---- App Store ----

    override fun appStoreBeginRefundRequest(transactionId: String): Promise<NativeRefundRequestStatus> =
        rejected(appStoreOnly("Refund requests"))

    override fun appStoreSubscriptionStatus(groupId: String): Promise<Array<NativeAppStoreSubscriptionStatus>> =
        rejected(appStoreOnly("Subscription statuses"))

    override fun appStoreCurrentEntitlements(): Promise<Array<NativeTransaction>> =
        rejected(appStoreOnly("Current entitlements"))

    override fun appStoreAppTransaction(): Promise<String> = rejected(appStoreOnly("The app transaction"))

    private fun appStoreOnly(what: String) = NativeClientException("UNSUPPORTED_PLATFORM", "$what are an App Store feature")

    // ---- Google Play ----

    override fun googlePlayShowInAppMessages(): Promise<NativeInAppMessageResult> = call { client ->
        when (val result = client.googlePlay.showInAppMessages(requireActivity())) {
            GooglePlayInAppMessageResult.NoActionNeeded ->
                NativeInAppMessageResult(NativeInAppMessageStatus.NOACTIONNEEDED, null)
            is GooglePlayInAppMessageResult.SubscriptionStatusUpdated ->
                NativeInAppMessageResult(NativeInAppMessageStatus.SUBSCRIPTIONSTATUSUPDATED, result.purchaseToken)
        }
    }

    override fun googlePlayQueryPurchases(includeSuspended: Boolean): Promise<Array<NativeTransaction>> = call { client ->
        client.googlePlay.queryPurchases(includeSuspended).map { it.toNative() }.toTypedArray()
    }

    override fun googlePlayIsFeatureSupported(feature: String): Promise<Boolean> = call { client ->
        val featureType = when (feature) {
            "subscriptions" -> BillingClient.FeatureType.SUBSCRIPTIONS
            "subscriptionsUpdate" -> BillingClient.FeatureType.SUBSCRIPTIONS_UPDATE
            "inAppMessaging" -> BillingClient.FeatureType.IN_APP_MESSAGING
            "productDetails" -> BillingClient.FeatureType.PRODUCT_DETAILS
            "billingConfig" -> BillingClient.FeatureType.BILLING_CONFIG
            "alternativeBillingOnly" -> BillingClient.FeatureType.ALTERNATIVE_BILLING_ONLY
            "externalOffer" -> BillingClient.FeatureType.EXTERNAL_OFFER
            else -> throw NativeClientException("INVALID_ARGUMENT", "\"$feature\" is not a Google Play billing feature")
        }
        client.googlePlay.isFeatureSupported(featureType)
    }

    // ---- Configuration at runtime ----

    override fun setAnalyticsConsent(consent: NativeAnalyticsConsent): Promise<Boolean> {
        // Before the start there is nothing to store it in: `start()` applies and stores it. A
        // denial discards what was captured so far, as it does on a running client.
        val running = synchronized(lock) {
            client?.takeUnless { it.isClosed } ?: run {
                chosenConsent = consent
                if (consent == NativeAnalyticsConsent.DENIED) {
                    pendingCaptures.clear()
                    droppedBeforeStart = 0
                }
                null
            }
        }
        if (running == null) {
            val promise = Promise<Boolean>()
            deliver { promise.resolve(false) }
            return promise
        }
        return call { client ->
            client.setAnalyticsConsent(consent(consent))
            true
        }
    }

    override fun getAnalyticsConsent(): NativeAnalyticsConsent {
        client?.takeUnless { it.isClosed }?.let { return nativeConsent(it.analyticsConsent) }
        val configuration = synchronized(lock) { chosenConsent?.let { return it }; configuration }
        return configuration?.chosenAnalyticsConsent ?: configuration?.analyticsConsent ?: NativeAnalyticsConsent.GRANTED
    }

    override fun setReadOnly(readOnly: Boolean) {
        // The client is read under the lock the start publishes it under: either this call sees
        // it, or the start sees what this call stored.
        val running = synchronized(lock) {
            this.readOnly = readOnly
            client
        }
        running?.setReadOnly(readOnly)
    }

    override fun isReadOnly(): Boolean =
        client?.takeUnless { it.isClosed }?.isReadOnly ?: synchronized(lock) { readOnly ?: configuration?.readOnly ?: false }

    // ---- Analytics ----

    override fun capture(eventName: String, propertiesJson: String) {
        intake(eventName, propertiesJson, operation = "analytics.capture")
    }

    override fun screen(name: String, propertiesJson: String) {
        if (synchronized(lock) { configuration?.screenTrackingEnabled } == false) return
        // The facade already mapped the screen into its `$screen_*` properties: recorded as they are.
        intake(AutomaticEvents.SCREEN, propertiesJson, operation = "analytics.screen")
    }

    override fun captureAt(eventName: String, propertiesJson: String, capturedAt: Double) {
        intake(eventName, propertiesJson, operation = "analytics.capture", capturedAt = capturedAt.toLong())
    }

    override fun screenAt(name: String, propertiesJson: String, capturedAt: Double) {
        if (synchronized(lock) { configuration?.screenTrackingEnabled } == false) return
        intake(AutomaticEvents.SCREEN, propertiesJson, operation = "analytics.screen", capturedAt = capturedAt.toLong())
    }

    /**
     * Stamps and queues an event on the calling thread; never throws. [capturedAt] is the time of
     * an event the facade held back, in epoch millis; the time of this call without it.
     */
    private fun intake(name: String, propertiesJson: String, operation: String, capturedAt: Long? = null) {
        try {
            val properties = jsonMap(JSONObject(propertiesJson))
            val now = capturedAt ?: System.currentTimeMillis()
            val running = synchronized(lock) {
                val running = client?.takeUnless { it.isClosed || !capturesOpen }
                if (running == null) {
                    pendingCaptures.addLast(PendingCapture(name, properties, now))
                    if (pendingCaptures.size > PRE_START_CAPTURE_LIMIT) {
                        pendingCaptures.removeFirst()
                        droppedBeforeStart += 1
                    }
                }
                running
            } ?: return
            running.capture(name, properties, now)
        } catch (error: Throwable) {
            onDiagnostic(
                VoidhashDiagnostic(
                    VoidhashDiagnosticKind.EVICTION,
                    "ANALYTICS_EVENT_DROPPED",
                    operation,
                    message = "Dropped \"$name\": ${error.message}",
                ),
            )
        }
    }

    override fun flush(): Promise<NativeFlushStatus> = call { it.flush().toNative() }

    /** Empty when there is no session: reading must not start one, as the SDK's own `sessionId` does. */
    override fun getSessionId(): String = client?.takeUnless { it.isClosed }?.activeSessionId.orEmpty()

    // ---- Flows ----

    /**
     * Presents the flow at [location] through the SDK and resolves with how it ended, or with why
     * it could not be presented, as JSON. Each action [presentation] lists is answered by
     * [onAction]; a call JavaScript rejects, and one it has no handler for, fail in the flow as
     * they do in a native app.
     */
    override fun presentFlow(
        location: String,
        presentation: NativeFlowPresentation,
        onAction: (name: String, argsJson: String) -> Promise<Promise<String>>,
    ): Promise<String> = call { client ->
        val activity = usableActivity()
            ?: return@call VoidhashFlowsCore.encode(
                VoidhashFlowsCore.failed(FlowFailure.UNAVAILABLE, "The React Native host has no current activity"),
            )
        try {
            val result = client.presentFlow(
                activity,
                location,
                revision = presentation.revision?.toInt(),
                input = VoidhashFlowsCore.flowValues(presentation.inputJson),
                actions = VoidhashFlowsCore.actionHandlers(presentation.actions, onAction),
            )
            // A flow that ended in a purchase or a restore outdates the products held.
            if (result.outcome == FlowResult.PURCHASED || result.outcome == FlowResult.RESTORED) dropHeldProducts()
            VoidhashFlowsCore.encode(result)
        } catch (error: FlowException) {
            VoidhashFlowsCore.encode(error)
        }
    }

    override fun updateFlowInput(valuesJson: String): Promise<Unit> =
        call { it.updateFlowInput(VoidhashFlowsCore.flowValues(valuesJson)) }

    override fun dismissFlow(): Promise<Unit> = call { it.dismissFlow() }

    /** The host's current activity, unless it is finishing or gone. */
    private fun usableActivity(): Activity? =
        activityProvider()?.takeUnless { it.isFinishing || it.isDestroyed }

    private fun requireActivity(): Activity =
        usableActivity() ?: throw NativeClientException("CURRENT_ACTIVITY_NULL", "The React Native host has no current activity")

    // ---- Bridging ----

    /** Runs [block] on the delivery queue, after everything queued before it. */
    private fun deliver(block: () -> Unit) {
        delivery.execute {
            try {
                block()
            } catch (_: Throwable) {
                // A listener that throws must not stop later deliveries.
            }
        }
    }

    private fun <T> settle(promise: Promise<T>, outcome: Result<T>) {
        deliver { outcome.fold({ promise.resolve(it) }, { promise.reject(rejection(it)) }) }
    }

    private fun <T> rejected(error: Throwable): Promise<T> = Promise<T>().also { settle(it, Result.failure(error)) }

    /**
     * Runs one call against the started client. Its promise settles on the delivery queue, after
     * the events the call caused; a call [shutdown] cancels rejects with `NOT_INITIALIZED`.
     */
    private fun <T> call(ordered: Boolean = false, block: suspend (VoidhashClient) -> T): Promise<T> {
        val promise = Promise<T>()
        val (running, scope) = synchronized(lock) { client?.takeUnless { it.isClosed } to callScope }
        if (running == null) {
            settle(promise, Result.failure(notInitialized()))
            return promise
        }
        // An ordered call queues for [identityOrder] on the calling thread, so calls take it in
        // the order they were made; the work itself runs off that thread. Neither start can be
        // cancelled before the body runs: a call [shutdown] cancels before it was dispatched, or
        // launched into a scope [shutdown] has just cancelled, still reaches its settlement below.
        scope.launch(start = if (ordered) CoroutineStart.UNDISPATCHED else CoroutineStart.ATOMIC) {
            val outcome = try {
                // Cancelled before it started: nothing of the call runs, and it rejects below.
                ensureActive()
                Result.success(
                    if (ordered) {
                        identityOrder.withLock { withContext(Dispatchers.Default) { block(running) } }
                    } else {
                        block(running)
                    },
                )
            } catch (error: CancellationException) {
                Result.failure(notInitialized())
            } catch (error: Throwable) {
                Result.failure(if (running.isClosed) notInitialized() else error)
            }
            settle(promise, outcome)
        }
        return promise
    }

    private fun notInitialized() = NativeClientException("NOT_INITIALIZED", "The Voidhash client is not started")

    /** The error JavaScript reads `"<CODE>: <detail>"` from. */
    private fun rejection(error: Throwable): Throwable = when (error) {
        is NativeClientException -> error
        is VoidhashException ->
            if (error.code == "CLIENT_SHUT_DOWN") notInitialized() else NativeClientException(error.code, error.description, error)
        else -> NativeClientException("UNKNOWN_ERROR", error.message ?: error.javaClass.simpleName, error)
    }

    private fun onClientEvent(event: ClientEvent) {
        val native = when (event) {
            is ClientEvent.Identity -> event(
                NativeClientEventType.IDENTITY,
                identity = NativeIdentityChange(event.distinctId, event.previousDistinctId, event.generation.toDouble()),
            )
            is ClientEvent.Person -> event(NativeClientEventType.PERSON, person = event.state.toNative())
            is ClientEvent.Flags -> event(NativeClientEventType.FLAGS, flags = event.state.toNative())
            is ClientEvent.Schema -> event(NativeClientEventType.SCHEMA, schemaJson = event.json)
            is ClientEvent.Consent -> event(NativeClientEventType.CONSENT, consent = nativeConsent(event.consent))
            is ClientEvent.Transaction -> {
                // Google Play reports no renewals, but a renewal would change no offer.
                if (event.update.transaction.isRenewal != true) dropHeldProducts()
                event(
                    NativeClientEventType.TRANSACTION,
                    transaction = NativeTransactionUpdate(event.update.transaction.toNative(), event.update.synced),
                )
            }
        }
        deliver { listener?.invoke(native) }
    }

    private fun onDiagnostic(diagnostic: VoidhashDiagnostic) {
        val native = NativeDiagnostic(
            kind = when (diagnostic.kind) {
                VoidhashDiagnosticKind.TRANSPORT -> NativeDiagnosticKind.TRANSPORT
                VoidhashDiagnosticKind.EVICTION -> NativeDiagnosticKind.EVICTION
                VoidhashDiagnosticKind.BREAKER -> NativeDiagnosticKind.BREAKER
                VoidhashDiagnosticKind.AUTH -> NativeDiagnosticKind.AUTH
                VoidhashDiagnosticKind.CACHE -> NativeDiagnosticKind.CACHE
                VoidhashDiagnosticKind.CONSENT -> NativeDiagnosticKind.CONSENT
                VoidhashDiagnosticKind.STORE -> NativeDiagnosticKind.CONFIGURATION
            },
            code = diagnostic.code,
            // The contract names a product load after the facade method that makes it.
            operation = if (diagnostic.operation == "products.load") "getProducts" else diagnostic.operation,
            retryable = diagnostic.retryable,
            httpStatus = diagnostic.httpStatus?.toDouble(),
            message = diagnostic.message,
        )
        deliver {
            val current = listener
            if (current != null) {
                current(event(NativeClientEventType.DIAGNOSTIC, diagnostic = native))
            } else {
                pendingDiagnostics.addLast(native)
                if (pendingDiagnostics.size > PRE_LISTENER_DIAGNOSTIC_LIMIT) pendingDiagnostics.removeFirst()
            }
        }
    }

    private fun event(
        type: NativeClientEventType,
        identity: NativeIdentityChange? = null,
        person: NativePersonState? = null,
        flags: NativeFeatureFlagsResult? = null,
        schemaJson: String? = null,
        consent: NativeAnalyticsConsent? = null,
        diagnostic: NativeDiagnostic? = null,
        transaction: NativeTransactionUpdate? = null,
    ) = NativeClientEvent(type, identity, person, flags, schemaJson, consent, diagnostic, transaction, null)

    /**
     * Person attributes with flat values only; `INVALID_ARGUMENT` otherwise. The client itself
     * sends an `email` and a `name` as the person's own.
     */
    private fun attributes(json: String): Map<String, Any?> {
        val document = try {
            JSONObject(json)
        } catch (error: Exception) {
            throw NativeClientException("INVALID_ARGUMENT", "Person attributes are not a JSON object")
        }
        val values = jsonMap(document)
        val nested = values.filterValues { !isScalarTraitValue(it) }.keys
        if (nested.isNotEmpty()) {
            throw NativeClientException(
                "INVALID_ARGUMENT",
                "Person traits must be strings, numbers, booleans or null: ${nested.joinToString()} is not",
            )
        }
        return values
    }
}

private fun PersonState.toNative() = NativePersonState(
    distinctId = distinctId,
    generation = generation.toDouble(),
    personJson = person?.raw?.toString(),
    isStale = isStale,
    isExpired = isExpired,
    reason = when (reason) {
        FreshnessReason.FRESH -> NativeFreshnessReason.FRESH
        FreshnessReason.REFRESH_IN_FLIGHT -> NativeFreshnessReason.REFRESHINFLIGHT
        FreshnessReason.REFRESH_FAILED -> NativeFreshnessReason.REFRESHFAILED
        FreshnessReason.NO_CACHE -> NativeFreshnessReason.NOCACHE
    },
)

private fun FlagsState.toNative() = NativeFeatureFlagsResult(
    distinctId = distinctId,
    generation = generation.toDouble(),
    flagKeys = keys?.toTypedArray(),
    flags = flags.map { it.toNative() }.toTypedArray(),
    isStale = isStale,
)

private fun FeatureFlag.toNative() = NativeFeatureFlag(key, enabled, variantKey, payload?.let(::jsonValue))

private fun FlushStatus.toNative() = NativeFlushStatus(flushed.toDouble(), pending.toDouble(), lastError)

private fun writeStatus(status: WriteStatus) = when (status) {
    WriteStatus.CONFIRMED -> NativeWriteStatus.CONFIRMED
    WriteStatus.DEFERRED -> NativeWriteStatus.DEFERRED
    WriteStatus.SKIPPED -> NativeWriteStatus.SKIPPED
}

private fun consent(consent: NativeAnalyticsConsent) = when (consent) {
    NativeAnalyticsConsent.GRANTED -> AnalyticsConsent.GRANTED
    NativeAnalyticsConsent.DENIED -> AnalyticsConsent.DENIED
    NativeAnalyticsConsent.PENDING -> AnalyticsConsent.PENDING
}

private fun nativeConsent(consent: AnalyticsConsent) = when (consent) {
    AnalyticsConsent.GRANTED -> NativeAnalyticsConsent.GRANTED
    AnalyticsConsent.DENIED -> NativeAnalyticsConsent.DENIED
    AnalyticsConsent.PENDING -> NativeAnalyticsConsent.PENDING
}

private fun replacementMode(mode: NativeSubscriptionReplacementMode) = when (mode) {
    NativeSubscriptionReplacementMode.WITHTIMEPRORATION -> SubscriptionReplacementMode.WITH_TIME_PRORATION
    NativeSubscriptionReplacementMode.CHARGEPRORATEDPRICE -> SubscriptionReplacementMode.CHARGE_PRORATED_PRICE
    NativeSubscriptionReplacementMode.CHARGEFULLPRICE -> SubscriptionReplacementMode.CHARGE_FULL_PRICE
    NativeSubscriptionReplacementMode.WITHOUTPRORATION -> SubscriptionReplacementMode.WITHOUT_PRORATION
    NativeSubscriptionReplacementMode.DEFERRED -> SubscriptionReplacementMode.DEFERRED
}

/**
 * The offer [options] names for [product]. One named with its kind is resolved here, among the
 * product's current offers and intro offer; one named by id alone the SDK resolves. Either way an
 * offer the product does not have rejects `OFFER_UNAVAILABLE`, never buying the regular price.
 */
private fun offerSelection(product: VoidhashProduct, options: NativePurchaseOptions): VoidhashOfferSelection =
    when (options.offerSelection) {
        NativeOfferSelection.AUTOMATIC -> VoidhashOfferSelection.Automatic
        NativeOfferSelection.REGULARPRICE -> VoidhashOfferSelection.None
        NativeOfferSelection.OFFER -> {
            val kind = options.offerKind
            val id = options.offerId
            val intro = product.subscription?.introOffer
            when {
                kind == NativeOfferKind.INTRODUCTORY -> VoidhashOfferSelection.Offer(
                    intro ?: throw NativeClientException("OFFER_UNAVAILABLE", "\"${product.slug}\" has no intro offer for this user"),
                )
                id == null -> throw NativeClientException("INVALID_ARGUMENT", "The offer to buy \"${product.slug}\" with names no id")
                kind == null || kind == NativeOfferKind.UNKNOWN -> VoidhashOfferSelection.Id(id)
                else -> VoidhashOfferSelection.Offer(
                    (product.offers + listOfNotNull(intro)).firstOrNull { it.id == id && it.kind.toNative() == kind }
                        ?: throw NativeClientException("OFFER_UNAVAILABLE", "\"${product.slug}\" has no offer \"$id\" for this user"),
                )
            }
        }
    }

private fun flowCapability(capability: NativeFlowCapability) = when (capability) {
    NativeFlowCapability.LINKS -> FlowCapability.LINKS
    NativeFlowCapability.NOTIFICATIONS -> FlowCapability.NOTIFICATIONS
    NativeFlowCapability.TRACKING -> FlowCapability.TRACKING
    NativeFlowCapability.ATTRIBUTES -> FlowCapability.ATTRIBUTES
}

/** A flag payload or other decoded JSON value as JSON text. */
private fun jsonValue(value: Any): String = when (value) {
    is JSONObject, is JSONArray -> value.toString()
    is String -> JSONObject.quote(value)
    else -> VoidhashFlowsCore.jsonScalar(value)
}

/** [json] as a map the SDK takes, nested objects and arrays included. */
internal fun jsonMap(json: JSONObject): Map<String, Any?> =
    json.keys().asSequence().associateWith { key -> jsonPlain(json.opt(key)) }

private fun jsonPlain(value: Any?): Any? = when (value) {
    null, JSONObject.NULL -> null
    is JSONObject -> jsonMap(value)
    is JSONArray -> (0 until value.length()).map { jsonPlain(value.opt(it)) }
    else -> value
}
