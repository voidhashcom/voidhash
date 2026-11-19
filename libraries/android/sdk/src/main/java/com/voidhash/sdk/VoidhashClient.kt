package com.voidhash.sdk

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import com.voidhash.core.billing.BillingInAppMessageResult
import com.voidhash.core.billing.BillingProductType
import com.android.billingclient.api.Purchase
import com.voidhash.sdk.analytics.AnalyticsClient
import com.voidhash.sdk.analytics.AnalyticsConsentStore
import com.voidhash.sdk.analytics.AnalyticsSessionManager
import com.voidhash.sdk.analytics.AutomaticEvents
import com.voidhash.sdk.analytics.InstallAttribution
import com.voidhash.sdk.analytics.InstallAttributionOutcome
import com.voidhash.sdk.analytics.PUSH_SEND_ID_DATA_KEY
import com.voidhash.sdk.analytics.PUSH_SEND_ID_PROPERTY
import com.voidhash.sdk.analytics.ProcessCrash
import com.voidhash.sdk.analytics.ScreenSources
import com.voidhash.sdk.analytics.ScreenTracker
import com.voidhash.sdk.analytics.ScreenView
import com.voidhash.sdk.analytics.TOUCH_EVENT
import com.voidhash.sdk.analytics.touchEventProperties
import com.voidhash.sdk.api.DevelopmentPurchaseRequest
import com.voidhash.sdk.api.FeatureFlag
import com.voidhash.sdk.api.PurchasePaywallContext
import com.voidhash.sdk.api.SYNC_TRANSACTION_INTENT_RESTORE
import com.voidhash.sdk.api.SyncTransactionRequest
import com.voidhash.sdk.api.ResolvedPaywall
import com.voidhash.sdk.api.VoidhashApiClient
import com.voidhash.sdk.api.VoidhashPerson
import com.voidhash.sdk.billing.BillingEnginePort
import com.voidhash.sdk.billing.PurchaseFailureReason
import com.voidhash.sdk.billing.StoreTransaction
import com.voidhash.sdk.billing.VoidhashOfferSelection
import com.voidhash.sdk.billing.VoidhashProduct
import com.voidhash.sdk.billing.VoidhashPurchaseOptions
import com.voidhash.sdk.billing.VoidhashPurchaseResult
import com.voidhash.sdk.billing.VoidhashSubscriptionInfo
import com.voidhash.sdk.billing.VoidhashTransaction
import com.voidhash.sdk.billing.VoidhashTransactionUpdate
import com.voidhash.sdk.billing.mapBillingPurchaseToTransaction
import com.voidhash.sdk.analytics.FlushStatus
import com.voidhash.sdk.analytics.GROUP_IDENTIFY_EVENT
import com.voidhash.sdk.cache.CacheManager
import com.voidhash.sdk.cache.fnv1aHex
import com.voidhash.sdk.diagnostics.DiagnosticEmitter
import com.voidhash.sdk.diagnostics.VoidhashDiagnosticKind
import com.voidhash.sdk.diagnostics.redacted
import com.voidhash.sdk.identity.IdentityStore
import com.voidhash.sdk.identity.invalidDistinctIdReason
import com.voidhash.sdk.identity.invalidGroupReason
import com.voidhash.sdk.network.FRESHNESS_BUDGET_MS
import com.voidhash.sdk.network.FailureClass
import com.voidhash.sdk.network.OutboundGate
import com.voidhash.sdk.network.SdkClock
import com.voidhash.sdk.network.SingleFlight
import com.voidhash.sdk.network.SystemSdkClock
import com.voidhash.sdk.network.classifyFailure
import com.voidhash.sdk.network.isAliasAlreadyIdentified
import com.voidhash.sdk.network.isPersonNotFound
import com.voidhash.sdk.api.TransactionSyncVerdict
import com.voidhash.sdk.transactions.AD_DATA_SHARING_TRAIT
import com.voidhash.sdk.transactions.PersonWrite
import com.voidhash.sdk.transactions.PersonWriteKind
import com.voidhash.sdk.transactions.PersonWriteOutbox
import com.voidhash.sdk.transactions.TransactionOutbox
import com.voidhash.sdk.transactions.isScalarTraitValue
import com.voidhash.sdk.paywall.FlowEngineCapabilities
import com.voidhash.sdk.paywall.FlowHost
import com.voidhash.sdk.paywall.PaywallCoordinator
import com.voidhash.sdk.platform.PlatformInfo
import com.voidhash.sdk.schema.RuntimeSchema
import com.voidhash.sdk.schema.SchemaManager
import kotlin.coroutines.AbstractCoroutineContextElement
import kotlin.coroutines.CoroutineContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

/** How many transaction updates wait for a slow collector before the oldest is dropped. */
private const val TRANSACTION_UPDATE_BUFFER = 64

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

/** 90 days — a flow's saved variables outlive any break between two presentations. */
private const val FLOW_STATE_TTL_MS = 1000L * 60 * 60 * 24 * 90

/** How many locations this device remembers for preloading on the next launch. */
private const val KNOWN_LOCATIONS_LIMIT = 20

/** Cache key of the locations this device has resolved before; the name is the stored format's. */
private const val KNOWN_LOCATIONS_CACHE_KEY = "paywall:placements"

/**
 * Ceiling on a read that has nothing cached to serve.
 *
 * Matches the per-request timeout: with no fallback the caller has to wait for the network,
 * but a black-hole connection must still not hang it forever.
 */
private const val COLD_READ_TIMEOUT_MS = 10_000L

/**
 * How long a call the app awaits waits for a delivery it started: `flush`, `shutdown`, and the
 * direct send of `identify` and `setPersonAttributes`. The delivery carries on past it.
 */
private const val DELIVERY_WAIT_MS = 2_000L

/** App foreground refreshes are debounced to at most one per minute. */
private const val FOREGROUND_REFRESH_DEBOUNCE_MS = 60_000L

/** A debounce that has never fired. The monotonic clock may read less than a minute at boot. */
private const val NEVER_REFRESHED = Long.MIN_VALUE

/**
 * Captures retained in memory while the cache establishes the persisted identity, or while the
 * consent is pending and [PendingAnalytics.BUFFER] holds them.
 */
private const val PRE_INIT_ANALYTICS_BUFFER_CAP = 100

private fun sha256Hex(text: String): String =
    java.security.MessageDigest.getInstance("SHA-256").digest(text.toByteArray())
        .joinToString("") { "%02x".format(it) }

/** A digest that is equal for two identifies exactly when they carry the same email and name. */
private fun profileDigest(email: String?, name: String?): String =
    sha256Hex(JSONArray().put(email ?: JSONObject.NULL).put(name ?: JSONObject.NULL).toString())

/** A digest of a group's kept [properties] that does not depend on their order. */
private fun groupPropertiesDigest(properties: Map<String, Any?>): String =
    sha256Hex(
        properties.toSortedMap().entries.joinToString(",") { (key, value) ->
            "${JSONObject.quote(key)}:${if (value is String) JSONObject.quote(value) else value.toString()}"
        },
    )

/** How long a replaced client's store connection may take to end before it is abandoned. */
private const val BILLING_END_TIMEOUT_MS = 5_000L

/**
 * How long a released client keeps its store connection for a purchase sheet still open: Play
 * answers a purchase only on the connection that launched it.
 */
private const val PURCHASE_SHEET_GRACE_MS = 30 * 60_000L

/** Cache key of the last app release seen, shared with the other Voidhash SDKs. */
internal const val LAST_SEEN_APP_RELEASE_CACHE_KEY = "voidhash:analytics:last-seen-app-release"

/**
 * Cache key of the time up to which crashes were handled: the newest one reported, or the moment
 * analytics consent was last granted.
 */
internal const val LAST_REPORTED_CRASH_CACHE_KEY = "voidhash:analytics:last-reported-crash"

private data class PersonRefresh(val person: VoidhashPerson?)

/**
 * Cached under `person:<id>` when the backend confirmed it has no person for that id, so an
 * anonymous visitor's entitlement checks answer from cache instead of a network read each.
 */
private fun noPersonEntry(): JSONObject = JSONObject().put("none", true)

private fun isNoPersonEntry(raw: JSONObject): Boolean = raw.optBoolean("none") && !raw.has("personId")

private data class PaywallRefresh(val paywall: ResolvedPaywall?)

/** A cache entry that decoded; distinguishes a decoded `null` from an undecodable entry. */
private class Decoded<out T>(val value: T)

/**
 * A capture held while the cache loads the persisted identity, or until the end user decides on
 * analytics, with the time it was made.
 */
private data class PendingAnalyticsCapture(
    val name: String,
    val properties: Map<String, Any?>,
    val capturedAt: Long,
)

/** Calls, besides captures and screens, held for the successor of a client configured before the first unlock. */
private const val PRE_UNLOCK_CALL_LIMIT = 100

/** Marks the coroutine that makes the held calls, which must not wait for itself. */
private object HeldCallReplay : AbstractCoroutineContextElement(HeldCallReplayKey)

private object HeldCallReplayKey : CoroutineContext.Key<HeldCallReplay>

/**
 * What the host asked of a client configured before the device was first unlocked, for the client
 * configured in its place once storage is available.
 *
 * Whatever changes the identity, the person, the consent or the queues — captures and screens,
 * `identify`, person attributes, `reset`, the analytics consent, reported transactions,
 * `initialize` — is held in the order it was asked, in memory only, and made on the successor in
 * that order once its storage has loaded, so the consent and identity stored on the device decide
 * as they would have. Until the last held call was made, new ones queue behind it, and the
 * successor's own entry points wait for it (see `VoidhashClient.awaitHeldCalls`); from then on
 * calls go straight to the successor, as every read does from the hand-over on.
 *
 * A successor that is replaced before it made every held call hands the rest on to its
 * replacement. A call is taken off the queue once it was made, so one that was under way when
 * its client was replaced is made again on the next: every held call is one that can be repeated.
 */
internal class DeferredUntilUnlock {
    private class Held(val isCapture: Boolean, val replay: suspend (VoidhashClient) -> Unit)

    /** What became of a call made on the client configured before the unlock. */
    sealed class Admission {
        /** Held, and made on the successor in the order it was asked. */
        object Held : Admission()

        /** Not held: [PRE_UNLOCK_CALL_LIMIT] calls are waiting already. */
        object Refused : Admission()

        /** Nothing is waiting any more: the call is [client]'s to answer. */
        class Live(val client: VoidhashClient) : Admission()
    }

    private val held = ArrayDeque<Held>()
    private var heldCaptures = 0
    private var heldCalls = 0
    private var initializeHeld = false

    /** Set once every held call was made on the successor. */
    private var drained = false
    private val drainedSignal = CompletableDeferred<Unit>()

    /** Counts hand-overs: a drain stops as soon as a later one took the queue over. */
    private var handOvers = 0

    /** The client that took over; `null` until the device was unlocked. */
    @Volatile
    var successor: VoidhashClient? = null
        private set

    /** [successor], when the SDK configured it itself on the unlock rather than the host. */
    @Volatile
    var successorConfiguredBySdk: VoidhashClient? = null
        private set

    /** Told of the successor as it takes over, and whether the SDK configured it itself. */
    @Volatile
    var onSuccessor: ((successor: VoidhashClient, bySdk: Boolean) -> Unit)? = null

    /** Told when a capture or screen was dropped to make room for a newer one. */
    @Volatile
    var onCaptureDropped: (() -> Unit)? = null

    /** How many captures and screens wait for the successor. */
    val pendingCaptures: Int get() = synchronized(this) { heldCaptures }

    /** Whether every held call was made. */
    val isDrained: Boolean get() = synchronized(this) { drained }

    /** Suspends until every held call was made on a successor. */
    suspend fun awaitDrained() {
        drainedSignal.await()
    }

    /** The successor, once nothing waits for it any more or it stopped taking calls. */
    private fun liveSuccessor(): VoidhashClient? = successor?.takeIf { drained || it.isClosed }

    /**
     * Holds [call] for the successor, or says who answers it now. Refused once
     * [PRE_UNLOCK_CALL_LIMIT] calls are held, unless it is one that must not be lost ([always]).
     */
    fun admit(always: Boolean = false, call: suspend (VoidhashClient) -> Unit): Admission = synchronized(this) {
        liveSuccessor()?.let { return Admission.Live(it) }
        if (!always && heldCalls >= PRE_UNLOCK_CALL_LIMIT) return Admission.Refused
        held.addLast(Held(isCapture = false, call))
        heldCalls += 1
        Admission.Held
    }

    /**
     * Holds an event, a capture or a screen, which [replay] records on the successor with the
     * time it was made; at most the newest hundred are kept. Returns the successor instead when
     * the event is its to record now.
     */
    fun holdEvent(replay: (VoidhashClient) -> Unit): VoidhashClient? {
        var dropped = false
        val live = synchronized(this) {
            liveSuccessor() ?: run {
                held.addLast(Held(isCapture = true) { replay(it) })
                heldCaptures += 1
                if (heldCaptures > PRE_INIT_ANALYTICS_BUFFER_CAP) {
                    held.removeAt(held.indexOfFirst { it.isCapture })
                    heldCaptures -= 1
                    dropped = true
                }
                null
            }
        }
        if (dropped) onCaptureDropped?.invoke()
        return live
    }

    /**
     * Initializes the successor, or remembers to, in its place among the held calls. While those
     * are being made it waits for them, at most [DELIVERY_WAIT_MS], so that it returns with the
     * successor initialized like any other `initialize()`.
     */
    suspend fun initialize() {
        val live = synchronized(this) {
            liveSuccessor() ?: run {
                if (!initializeHeld) {
                    initializeHeld = true
                    held.addLast(Held(isCapture = false) { it.initialize() })
                }
                null
            }
        }
        if (live != null) return live.initialize()
        if (successor == null) return
        withTimeoutOrNull(DELIVERY_WAIT_MS) { awaitDrained() }
        synchronized(this) { liveSuccessor() }?.initialize()
    }

    /**
     * Makes [client] the successor: reads go to it from here on, and once its storage has loaded
     * it gets every held call in order, before any made from now on. Called again for the client
     * that replaces a successor still making them, it moves the rest there. [bySdk] says the SDK
     * configured [client] itself on the unlock.
     */
    fun handOver(client: VoidhashClient, bySdk: Boolean = false) {
        val handOver = synchronized(this) {
            if (drained || successor === client) return
            successor = client
            successorConfiguredBySdk = client.takeIf { bySdk }
            ++handOvers
        }
        onSuccessor?.invoke(client, bySdk)
        client.replayHeldCalls(this) {
            while (true) {
                val next = synchronized(this) {
                    if (handOvers != handOver) return@replayHeldCalls
                    held.firstOrNull().also { if (it == null) drained = true }
                } ?: break
                // A closed client makes no calls; what is left is for the one that replaces it,
                // and so is a call that may have failed because the client was closed under it.
                if (client.isClosed) return@replayHeldCalls
                client.replayHeldCall(next.replay)
                if (client.isClosed) return@replayHeldCalls
                synchronized(this) {
                    if (held.firstOrNull() === next) {
                        held.removeFirst()
                        if (next.isCapture) heldCaptures -= 1 else heldCalls -= 1
                    }
                }
            }
            drainedSignal.complete(Unit)
        }
    }
}

/**
 * The local half of an identify: the identity it switched from, the write it queued, and
 * whether the anonymous person's snapshot was carried over to the new identity.
 */
private data class IdentitySwitch(
    val previousDistinctId: String,
    val queued: PersonWrite,
    val carriedSnapshot: Boolean,
    /** Cache keys of the visitor's flag evaluations carried over to the user. */
    val carriedFlagKeys: List<String>,
)

/**
 * Waits at most [timeoutMs] for this work, which runs on the client scope and carries on when the
 * wait ends. `null` when it did not finish in time, or when the client scope went away while the
 * caller is still live; a failure of the work is rethrown.
 */
internal suspend fun <T : Any> Deferred<T>.awaitWithin(timeoutMs: Long): T? = try {
    withTimeoutOrNull(timeoutMs) { await() }
} catch (error: CancellationException) {
    currentCoroutineContext().ensureActive()
    null
}

/**
 * The Voidhash SDK surface. Obtained from [Voidhash.configure].
 *
 * Every method that can wait is a suspending function: the SDK never blocks the caller's
 * thread and never posts work back to the main thread on its own. The others, such as [capture],
 * [screen] and [isFeatureEnabled], return at once.
 *
 * A client that was shut down, or replaced by a later `configure`, does no more work of its
 * own. Receipts reported to it are handed to the client that replaced it for the same publishable
 * key and base URL, or kept on disk for the next `configure` with them. Calls that would change
 * the identity, the person or the store — `identify`, `setPersonAttributes`, `reset`,
 * `getProducts`, `purchase`, `restorePurchases`, `syncPurchases` — throw [VoidhashException]
 * `CLIENT_SHUT_DOWN`; `capture` and `screen` do nothing, `flush` returns an empty status and reads
 * answer from the cache.
 */
class VoidhashClient internal constructor(
    private val apiClient: VoidhashApiClient,
    private val cacheManager: CacheManager,
    private val identityStore: IdentityStore,
    private val schemaManager: SchemaManager,
    private val orchestrator: PurchaseOrchestrator,
    private val analyticsClient: AnalyticsClient,
    private val sessionManager: AnalyticsSessionManager,
    /** The end user's analytics consent; shared with the analytics queue and the request headers. */
    private val consentStore: AnalyticsConsentStore = AnalyticsConsentStore(cacheManager, AnalyticsConsent.GRANTED),
    private val billing: BillingEnginePort,
    private val scope: CoroutineScope,
    private val activitySink: (Activity?) -> Unit,
    private val enabled: Boolean,
    readOnly: Boolean,
    private val onWarning: (String) -> Unit = {},
    private val platform: PlatformInfo? = null,
    screenTracking: ScreenTrackingOptions = ScreenTrackingOptions(),
    private val automaticLifecycleEvents: Boolean = true,
    /** Reads the crashes the system recorded for the app. */
    private val processCrashes: () -> List<ProcessCrash> = { emptyList() },
    private val clock: () -> Long = { System.currentTimeMillis() },
    private val sdkClock: SdkClock = SystemSdkClock,
    private val gate: OutboundGate? = null,
    private val singleFlight: SingleFlight = SingleFlight(),
    private val outbox: TransactionOutbox = TransactionOutbox(clock = sdkClock),
    private val personWrites: PersonWriteOutbox = PersonWriteOutbox(clock = sdkClock),
    private val preloadLocations: List<String> = emptyList(),
    /** The interface revision the app was built against, by location slug. */
    private val flowRevisions: Map<String, Int> = emptyMap(),
    private val featureFlagOptions: FeatureFlagOptions = FeatureFlagOptions(),
    /** Builds the flow coordinator around the client; `null` when the app configured no renderer. */
    flowCoordinatorFactory: ((FlowHost) -> PaywallCoordinator)? = null,
    /**
     * What the renderer's engine can run, sent when resolving a paywall. Read per resolve, so
     * building the client never loads the engine.
     */
    private val flowEngine: () -> FlowEngineCapabilities? = { null },
    /** Opens a link a flow asked for. */
    private val openUrl: (String) -> Unit = {},
    /** Asks the user for a permission a flow requested. */
    private val requestPermission: suspend (Activity, String) -> Boolean = { _, _ -> false },
    private val diagnostics: DiagnosticEmitter = DiagnosticEmitter(),
    private val onShutdown: () -> Unit = {},
    /** Suspends, for a bounded time, until the writer has finished everything this client handed it. */
    private val awaitWritesFinished: suspend () -> Unit = {},
    /** Whether an activity of the app is started as the client is built. */
    initiallyInForeground: Boolean = true,
    /** The live client configured for the same project after this one, if any. */
    private val replacement: () -> VoidhashClient? = { null },
    /** What a wrapping host, such as the React Native module, adds; see [HostSettings]. */
    private val host: HostSettings = HostSettings(),
    /** Reads the store referrers once per install; `null` when the app turned it off. */
    private val installAttribution: InstallAttribution? = null,
    /**
     * Set on the inert client of a process started before the device was first unlocked: takes
     * what cannot be done before the SDK's storage is available.
     */
    private val untilUnlock: DeferredUntilUnlock? = null,
    /** See [VoidhashOptions.analyticsWhilePending]. */
    private val analyticsWhilePending: PendingAnalytics = PendingAnalytics.DROP,
    /** See [VoidhashOptions.grantConsentOnIdentify]. */
    private val grantConsentOnIdentify: Boolean = false,
) {
    private val readOnlyFlag = AtomicBoolean(readOnly)
    private val schemaRef = AtomicReference<RuntimeSchema?>(null)
    private val billingReady = AtomicBoolean(false)
    private val initMutex = Mutex()

    /**
     * Guards local identity changes, and the caching and publishing of every answer made for an
     * identity, so none lands across a switch; never held across a request. Taken after
     * [outboxDrainMutex] where both are held, never before.
     */
    private val identityMutex = Mutex()

    /**
     * Counts identity switches. A refresh reads it before its request and caches the answer only
     * if no identify or sign-out happened meanwhile: a response arriving late would otherwise put
     * a signed-out user's person and flags back into the cache, where nothing deletes them.
     */
    private val identityEpoch = AtomicLong(0)
    private var lastIdentifiedId: String? = null
    private val billingConnectionMutex = Mutex()

    /**
     * One outbox drain at a time, so person writes always go out before the receipts behind them.
     * The direct send of `identify` and `setPersonAttributes` holds it too: a person's writes go out
     * one at a time and in order, so an older value never lands after a newer one, and a drain
     * never sends a write a slow direct send is still delivering.
     */
    private val outboxDrainMutex = Mutex()

    @Volatile
    private var initialized = false

    /** Set by [shutdown] or by a later `configure` replacing this client; never cleared. */
    private val closed = AtomicBoolean(false)

    /** Set once the client let go of its files and cancelled its scope; never cleared. */
    private val released = AtomicBoolean(false)

    /** Whether an activity of the app is started. */
    private val foreground = MutableStateFlow(initiallyInForeground)

    private var appInForeground: Boolean
        get() = foreground.value
        set(value) {
            foreground.value = value
        }

    /** The current identity's latest flag evaluation; see [featureFlags]. */
    private val flagState = MutableStateFlow<List<FeatureFlag>>(emptyList())

    /**
     * Set when an open circuit or a paused key answered a person or flag read from the cache
     * instead of refreshing it; the refresh runs once the API admits requests again.
     */
    private val refreshAwaitingCircuit = AtomicBoolean(false)
    private val retryTimerLock = Any()
    private val pendingAnalyticsLock = Any()

    /** One change to the groups at a time. Taken before [pendingAnalyticsLock], never inside it. */
    private val groupsLock = Any()

    /**
     * Counts the calls that changed the groups; guarded by [groupsLock]. A group description sent
     * outside the queue is remembered as sent only if no such call was made while it was under way.
     */
    private var groupChanges = 0

    /**
     * Describes a group to Voidhash with a `$groupidentify` holding [properties], made at
     * [calledAt], and returns whether the analytics queue took it.
     *
     * A group is what the app says about the end user, so it is described whatever the analytics
     * consent. With consent the event goes through the queue. Without, it is sent at once as a
     * request of its own, never held for a pending consent, stored or retried, and the answer is
     * `false`; [onSent] runs if that request succeeded.
     */
    private fun describeGroup(properties: Map<String, Any?>, calledAt: Long, onSent: () -> Unit = {}): Boolean {
        // Under the lock the consent changes under, so the event is not refused by a withdrawal
        // between this check and its capture.
        synchronized(pendingAnalyticsLock) {
            if (consentStore.isGranted) return captureIfCollected(GROUP_IDENTIFY_EVENT, properties, calledAt)
        }
        // The identity in effect now, not when the request runs: a sign-out right after must not
        // put the next visitor in the group. Only before the storage has loaded is it not known yet.
        val distinctId = if (cacheManager.isWarm) identityStore.getDistinctId() else null
        scope.launch {
            runQuietly("describe a group") {
                val describedAs = distinctId ?: run {
                    cacheManager.awaitWarm()
                    identityStore.getDistinctId()
                }
                if (analyticsClient.sendGroupDescription(describedAs, properties, calledAt)) onSent()
            }
        }
        return false
    }
    private val pendingAnalytics = ArrayDeque<PendingAnalyticsCapture>()

    /**
     * Set once the release event and the held captures went to the queue; guarded by
     * [pendingAnalyticsLock]. Cleared when analytics consent is withdrawn, so the release is
     * checked again once it is granted.
     */
    private var analyticsCaptureReady = false

    /**
     * Counts the times held captures that described a group were dropped, which leaves the
     * digests of what `setGroups` sent untrue; guarded by [pendingAnalyticsLock].
     */
    private var groupDigestInvalidations = 0

    /**
     * Forgets what `setGroups` sent when [dropped], held captures that will never be recorded,
     * describe a group: the next `setGroups` describes its groups again. Call with
     * [pendingAnalyticsLock] held.
     */
    private fun forgetGroupDigestsOf(dropped: Collection<PendingAnalyticsCapture>) {
        if (dropped.none { it.name == GROUP_IDENTIFY_EVENT }) return
        groupDigestInvalidations++
        identityStore.setGroupDigests(emptyMap())
    }

    /** Drops the held captures for good. Call with [pendingAnalyticsLock] held. */
    private fun discardHeldCaptures() {
        forgetGroupDigestsOf(pendingAnalytics)
        pendingAnalytics.clear()
        reportDroppedWhilePending()
    }

    /**
     * How many captures fell off the full buffer while it held them for a pending consent, since
     * the last report; guarded by [pendingAnalyticsLock].
     */
    private var droppedWhilePending = 0

    /**
     * Reports the captures that fell off the buffer while the consent was pending, once the end
     * user's decision settled it. Call with [pendingAnalyticsLock] held.
     */
    private fun reportDroppedWhilePending() {
        val dropped = droppedWhilePending
        if (dropped == 0) return
        droppedWhilePending = 0
        diagnostics.emit(
            VoidhashDiagnosticKind.EVICTION,
            code = "ANALYTICS_EVENT_DROPPED",
            operation = "analytics.capture",
            message = "Dropped the $dropped oldest events captured while the consent was pending: at most " +
                "$PRE_INIT_ANALYTICS_BUFFER_CAP are kept until the end user decides",
        )
    }

    /**
     * This launch's read of the store referrers, once it started; guarded by
     * [pendingAnalyticsLock]. Withdrawing consent cancels and clears it, so it runs again once
     * consent is granted. One that found no answer stays, and the next launch asks again.
     */
    private var installAttributionJob: Job? = null

    /** Whether `ANALYTICS_CONSENT_DENIED` was reported since consent was last granted. */
    private val consentDeniedReported = AtomicBoolean(false)

    /** The send id [trackPushOpened] reported last. */
    private val lastPushOpenedSendId = AtomicReference<String?>(null)
    private val screenTracker = ScreenTracker(screenTracking, clock)
    private val manualScreenCounter = AtomicInteger(0)
    private val activityScreenSuppressors = AtomicInteger(0)
    private val lastForegroundRefreshAt = AtomicLong(NEVER_REFRESHED)
    private val lastReconnectRefreshAt = AtomicLong(NEVER_REFRESHED)
    private val lastValidationRefreshAt = AtomicLong(NEVER_REFRESHED)

    /** What a flow reaches of the client. */
    private val flowHost = object : FlowHost {
        override suspend fun products(): List<VoidhashProduct> = getProducts()

        override suspend fun purchase(product: VoidhashProduct) {
            purchaseForFlow(product, offerId = null, paywallContext = null)
        }

        override suspend fun purchase(product: VoidhashProduct, offerId: String) {
            purchaseForFlow(product, offerId, paywallContext = null)
        }

        override suspend fun purchase(
            product: VoidhashProduct,
            offerId: String?,
            paywallContext: PurchasePaywallContext,
        ) {
            purchaseForFlow(product, offerId, paywallContext)
        }

        override suspend fun restorePurchases() {
            this@VoidhashClient.restorePurchases()
        }

        override fun capture(name: String, properties: Map<String, Any?>) {
            this@VoidhashClient.capture(name, properties)
        }

        override fun screen(name: String, properties: Map<String, Any?>) {
            this@VoidhashClient.screen(name, properties)
        }

        override suspend fun setAttribute(name: String, value: Any?) {
            setPersonAttributesWithStatus(mapOf(name to value))
        }

        override suspend fun requestPermission(activity: Activity, permission: String): Boolean =
            this@VoidhashClient.requestPermission(activity, permission)

        override fun openUrl(url: String) = this@VoidhashClient.openUrl(url)

        override fun loadState(key: String): JSONObject? =
            cacheManager.getObject(flowStateCacheKey(identityStore.getDistinctId(), key))?.value

        override fun saveState(key: String, variables: JSONObject) {
            cacheManager.set(flowStateCacheKey(identityStore.getDistinctId(), key), variables, ttlMs = FLOW_STATE_TTL_MS)
        }

        override fun clearState(key: String) {
            cacheManager.delete(flowStateCacheKey(identityStore.getDistinctId(), key))
        }
    }

    /** Presents flows; `null` when the app configured no renderer, so no flow can show. */
    private val flowCoordinator: PaywallCoordinator? = flowCoordinatorFactory?.invoke(flowHost)

    /** The interface revision each location was last presented with in this process. */
    private val presentedRevisions = java.util.concurrent.ConcurrentHashMap<String, Int>()

    /** Whether paywalls are resolved at all: only a configured renderer can present them. */
    private val flowsEnabled: Boolean get() = flowCoordinator != null

    init {
        // Captures made while the cache loads wait in memory. Once it has loaded they go to the
        // queue, and so to disk, whether or not the host has initialized the client yet.
        if (enabled) {
            scope.launch {
                runQuietly("load the stored state") {
                    cacheManager.awaitWarm()
                    // Whatever the consent, or a later launch could not tell a fresh install any more.
                    installAttribution?.prepare()
                    // The stored consent is known from here on. Without it, the session an earlier
                    // launch stored is dropped, and so are the captures held in the meantime.
                    if (!consentStore.isGranted) sessionManager.discard()
                    identityMutex.withLock { reloadFlagState() }
                    if (synchronized(pendingAnalyticsLock) { pendingAnalytics.isNotEmpty() }) enableAnalyticsCapture()
                }
            }
        }
    }

    /**
     * The client the SDK configured in this one's place once the device was unlocked, when this
     * is the inert client of a process started before the first unlock. Every call made on this
     * client is that client's to answer from then on, so a host that kept this reference needs
     * to do nothing.
     */
    private val takenOverBy: VoidhashClient? get() = untilUnlock?.successor

    /** The failure of a call that cannot be made, nor held, before the device was first unlocked. */
    private fun deviceLocked(what: String) = VoidhashException(
        "DEVICE_LOCKED",
        "Voidhash cannot $what before the device was unlocked for the first time since it started: " +
            "the app's storage is not available yet. Call again once the device is unlocked.",
    )

    init {
        untilUnlock?.onSuccessor = { successor, bySdk ->
            // Read after the successor is published, so an observer mode set meanwhile either is
            // seen here or went to the successor itself: nothing it does first, a store scan
            // included, runs in the wrong mode. A client the host configured keeps its own option.
            if (bySdk) successor.setReadOnly(readOnlyFlag.get())
            // A host that collects `featureFlags` from the client it got before the unlock keeps
            // getting evaluations: the successor's.
            successor.mirrorFeatureFlags(flagState)
            successor.mirrorPurchaseState(personState, transactionUpdateFlow)
            repeat(activityScreenSuppressors.get()) { successor.suppressActivityScreens() }
        }
        untilUnlock?.onCaptureDropped = {
            if (heldCaptureDropReported.compareAndSet(false, true)) {
                diagnostics.emit(
                    VoidhashDiagnosticKind.EVICTION,
                    code = "ANALYTICS_EVENT_DROPPED",
                    operation = "analytics.capture",
                    message = "Dropped the oldest events captured before the device was unlocked: at most " +
                        "$PRE_INIT_ANALYTICS_BUFFER_CAP are kept until then",
                )
            }
        }
    }

    /** Whether the drop of events held until the unlock was reported. */
    private val heldCaptureDropReported = AtomicBoolean(false)

    /**
     * The calls held by the client this one took over from, while they are still being made
     * here; see [awaitHeldCalls].
     */
    @Volatile
    private var inherited: DeferredUntilUnlock? = null

    /**
     * Waits until the calls held before the unlock were made on this client, at most
     * [DELIVERY_WAIT_MS], so that a call made directly on it — `Voidhash.shared` returns it from
     * the hand-over on — lands after the older ones it would otherwise overtake: an `identify`
     * made now must not be undone by one replayed from before the unlock. The replay itself does
     * not wait.
     */
    private suspend fun awaitHeldCalls() {
        val pending = inherited?.takeUnless { it.isDrained } ?: return
        if (currentCoroutineContext()[HeldCallReplayKey] != null) return
        withTimeoutOrNull(DELIVERY_WAIT_MS) { pending.awaitDrained() }
    }

    /** Whether the SDK currently runs in observer mode. */
    val isReadOnly: Boolean get() = takenOverBy?.isReadOnly ?: readOnlyFlag.get()

    /** The generation of the identity in effect; see [identityGenerations]. `0` before [initialize]. */
    @Volatile
    internal var identityGeneration: Long = 0L
        private set

    /**
     * Set once [initialize] announced the identity it loaded. Nothing is announced before, so the
     * host hears the identity first, and a state change made while configuring — a consent chosen,
     * a schema injected — reaches it as part of that announcement instead.
     */
    @Volatile
    private var eventsOpen = false

    /** The last schema adopted, as the server's JSON, for [ClientEvent.Schema]. */
    @Volatile
    private var schemaJson: String? = null

    /** Whether this client was shut down or replaced by a later `configure`. */
    internal val isClosed: Boolean get() = closed.get()

    /** The schema in effect; `null` until one was loaded, fetched or injected. */
    internal val currentSchema: RuntimeSchema? get() = takenOverBy?.currentSchema ?: schemaRef.get()

    /** Keeps [target] at this client's latest flag evaluation, for as long as this client runs. */
    private fun mirrorFeatureFlags(target: MutableStateFlow<List<FeatureFlag>>) {
        scope.launch { flagState.collect { target.value = it } }
    }

    /** Keeps [person] at this client's person and passes its transaction updates on, for as long as this client runs. */
    private fun mirrorPurchaseState(person: MutableStateFlow<VoidhashPerson?>, transactions: MutableSharedFlow<VoidhashTransactionUpdate>) {
        scope.launch { personState.collect { person.value = it } }
        scope.launch { transactionUpdateFlow.collect { transactions.tryEmit(it) } }
    }

    /**
     * Runs [replay] on this client's scope once its storage has loaded, for the calls [source]
     * holds from the client this one took over from: only then is the stored consent and
     * identity known.
     */
    internal fun replayHeldCalls(source: DeferredUntilUnlock, replay: suspend () -> Unit) {
        inherited = source
        scope.launch(HeldCallReplay) {
            runQuietly("make the calls held until the device was unlocked") {
                cacheManager.awaitWarm()
                replay()
            }
        }
    }

    /** Makes one held [call] on this client; its failure is a warning and does not stop the rest. */
    internal suspend fun replayHeldCall(call: suspend (VoidhashClient) -> Unit) {
        runQuietly("make a call held until the device was unlocked") { call(this) }
    }

    /** Hands [event] to the host, where it happened; a host that throws cannot break the client. */
    private fun announce(event: ClientEvent) {
        val listener = host.onEvent ?: return
        if (!eventsOpen || closed.get()) return
        try {
            listener(event)
        } catch (_: Throwable) {
            // The host's own problem; the client's state is unaffected.
        }
    }

    /**
     * Gives the identity now in effect the next generation and announces it, before anything else
     * is read or announced for it. Call where the identity changed, with [identityMutex] held.
     */
    private fun adoptIdentity(previousDistinctId: String, distinctId: String) {
        identityGeneration = identityGenerations.incrementAndGet()
        // Whoever the person was, they are not the one this identity knows.
        personState.value = cacheManager.getObject(personCacheKey(distinctId))
            ?.let { decodeCachedPerson(distinctId, it.value)?.value }
        announce(ClientEvent.Identity(distinctId, previousDistinctId, identityGeneration))
    }

    /** Announces the person cached for [distinctId], when it is the identity in effect. */
    private fun announceCachedPerson(distinctId: String, reason: FreshnessReason = FreshnessReason.FRESH) {
        if (identityStore.getDistinctId() != distinctId) return
        val hit = cacheManager.getObject(personCacheKey(distinctId)) ?: return
        val decoded = decodeCachedPerson(distinctId, hit.value) ?: return
        personState.value = decoded.value
        announce(
            ClientEvent.Person(
                PersonState(distinctId, identityGeneration, decoded.value, hit.isStale, hit.isExpired, reason),
            ),
        )
    }

    /**
     * The current identity's latest flag evaluation, as cached on the device, updated whenever an
     * evaluation arrives — also one a read stopped waiting for after
     * [FeatureFlagOptions.maxWaitMs] — and when the identity changes. Empty until the SDK's
     * storage has loaded or while nothing was evaluated for this identity. Collect it to update UI
     * once flags arrive or change.
     */
    val featureFlags: StateFlow<List<FeatureFlag>> = flagState.asStateFlow()

    /** The current identity's person as the device knows it; see [person]. */
    private val personState = MutableStateFlow<VoidhashPerson?>(null)

    /**
     * The current identity's person as the device knows it, updated whenever a snapshot is cached
     * — after a purchase, a restore, an identify or a refresh — and when the identity changes.
     * `null` until the SDK's storage has loaded, and while nothing is known of the person or the
     * backend has none for the identity. Collect it to keep access and subscription UI current.
     */
    val person: StateFlow<VoidhashPerson?> = personState.asStateFlow()

    private val transactionUpdateFlow = MutableSharedFlow<VoidhashTransactionUpdate>(
        extraBufferCapacity = TRANSACTION_UPDATE_BUFFER,
        onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )

    /**
     * Purchases that complete outside [purchase]: a payment that was pending, a code redeemed in
     * the Play Store, a purchase whose `purchase` call went away while the sheet was open. Each is
     * emitted once the SDK has handled it — its receipt accepted by Voidhash, or queued on the
     * device for delivery, which [VoidhashTransactionUpdate.synced] tells apart — and at most once
     * per process. It is a signal for UI, not a delivery
     * guarantee: an update emitted while nothing collects is not replayed, and access always comes
     * from [person]'s entitlements. Google Play renews a subscription under the purchase it has, so
     * renewals are not emitted; the person shows them.
     */
    val transactionUpdates: SharedFlow<VoidhashTransactionUpdate> = transactionUpdateFlow.asSharedFlow()

    /** Emits a transaction update the purchase machinery announced; see [transactionUpdates]. */
    internal fun emitTransactionUpdate(update: VoidhashTransactionUpdate) {
        if (closed.get()) return
        announce(ClientEvent.Transaction(update))
        transactionUpdateFlow.tryEmit(update)
    }

    /**
     * Whether the flag [key] is enabled in the current identity's latest evaluation, read from
     * memory without waiting: [FeatureFlagOptions.defaults] answers for a flag without an evaluated
     * value, and `false` for one without a default either. Never starts a request; use
     * [getFeatureFlags] or [featureFlags] to get an evaluation.
     */
    fun isFeatureEnabled(key: String): Boolean =
        takenOverBy?.isFeatureEnabled(key)
            ?: flagState.value.firstOrNull { it.key == key }?.enabled ?: featureFlagOptions.defaults[key] ?: false

    /**
     * The end user's analytics consent: the value last passed to [setAnalyticsConsent] on this
     * device, or [VoidhashOptions.analyticsConsent] when the app never set one. Read before the
     * SDK's storage has loaded, it answers with the option or the value set since.
     */
    val analyticsConsent: AnalyticsConsent get() = takenOverBy?.analyticsConsent ?: consentStore.current

    /**
     * The analytics session id the next captured event will carry. Reading it
     * starts a session when none is live but never extends one: only captures
     * and [reset] move the session along. Read before [initialize], it may wait briefly for
     * the stored session to load.
     *
     * Empty while no event can carry a session: unless analytics consent is granted, and on a
     * client that is inert or was shut down. Reading it then starts and stores no session.
     */
    val sessionId: String
        get() {
            takenOverBy?.let { return it.sessionId }
            return if (enabled && !closed.get() && consentStore.isGranted) sessionManager.peek() else ""
        }

    /**
     * The id of the analytics session in effect, for a host whose contract has an answer for
     * "none": `null` before [initialize] loaded the stored session, on a disabled or closed
     * client, unless analytics consent is granted, while no capture has started a session, and
     * once the session's last event is older than the timeout. Unlike [sessionId] it never starts
     * a session, so nothing is handed out that no event carries.
     */
    internal val activeSessionId: String?
        get() {
            takenOverBy?.let { return it.activeSessionId }
            return if (enabled && initialized && !closed.get() && consentStore.isGranted) sessionManager.activeId() else null
        }

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
     * do not depend on it. In a process started in the background — a push, a job, a
     * broadcast — connecting to the store and refreshing wait for the first activity to start.
     *
     * Idempotent: only the first call does work and concurrent callers wait for it. An
     * `identify` in flight does not hold it up. Any exception it does raise is a programmer
     * error, such as a bad option, not a transport problem.
     */
    suspend fun initialize() {
        if (!enabled) {
            untilUnlock?.initialize()
            return
        }
        if (closed.get()) return

        initMutex.withLock {
            if (initialized || closed.get()) return

            // The identity and the last-seen app release live in the cache, and reading them
            // before the warm-up has adopted what an earlier release stored would mint a new
            // anonymous id and re-fire `$app_installed`.
            cacheManager.awaitWarm()
            // Shut down or replaced while its storage loaded: the identity and the release event
            // are for the next client to store, which may have read that storage already.
            if (closed.get()) return
            identityMutex.withLock {
                adoptPinnedDistinctId()
                // Before `initialize` returns, so `isFeatureEnabled` right after it reads cached flags.
                reloadFlagState()
                eventsOpen = true
                adoptIdentity("", identityStore.getDistinctId())
                announce(ClientEvent.Consent(consentStore.current))
            }
            val distinctId = identityStore.getDistinctId()

            // Analytics and lifecycle observation come first and depend on nothing remote.
            // Starting them after the schema fetch is what used to disable analytics for a
            // whole process whenever a cold-cache launch happened to be offline.
            enableAnalyticsCapture()
            // The refresh below is this launch's reconnect refresh, and its foreground refresh
            // when an activity is started: the first activity start after it must not run it a
            // second time. A process started in the background (a push, a job) has no user
            // waiting on the store, the schema or fresh state; its first activity start runs
            // that refresh instead.
            lastReconnectRefreshAt.set(sdkClock.elapsed())
            initialized = true
            // Read after `initialized` is set, as the foreground callback sets its state before
            // reading `initialized`: whichever runs second sees the other, so the refresh runs once.
            val bootRefresh = appInForeground &&
                lastForegroundRefreshAt.compareAndSet(NEVER_REFRESHED, sdkClock.elapsed())
            updateRetryTimer()
            startInstallAttribution()

            // An externally injected schema bypasses cache and network. Otherwise
            // `resolveSchema` publishes through `publishSchema`, and a warm cache can
            // revalidate before it returns — so only fill the gap, never overwrite a
            // fresher schema.
            val injected = schemaRef.get()
            // A cached schema is announced as it is published; one injected before is announced here.
            if (injected != null) schemaJson?.let { announce(ClientEvent.Schema(it)) }
            val schema = injected
                ?: schemaManager.resolveSchema(distinctId, localOnly = true, refresh = bootRefresh)
            if (schema != null) {
                schemaRef.compareAndSet(null, schema)
            }
            identityMutex.withLock {
                announceCachedPerson(
                    distinctId,
                    if (bootRefresh) FreshnessReason.REFRESH_IN_FLIGHT else FreshnessReason.FRESH,
                )
            }

            if (bootRefresh) scope.launch { connectAndReconcileStore() }
            scope.launch { runQuietly("drain the transaction outbox") { drainOutbox() } }
            scope.launch { runQuietly("forget settled restores") { orchestrator.forgetSettledRestores() } }
            if (bootRefresh) scope.launch { runQuietly("preload cached state") { preload(distinctId) } }
            if (automaticLifecycleEvents) {
                scope.launch {
                    // A process started in the background neither reads the records nor opens an
                    // analytics session for them: its first activity start does.
                    awaitForeground()
                    runQuietly("report past crashes") { reportPastCrashes() }
                }
            }
        }
    }

    /**
     * Captures `$app_crashed` for the crashes the system recorded since the last one reported,
     * then remembers the newest. The event time is the crash's own; the app version is the running
     * one, as Android's records do not name the version that crashed.
     *
     * With nothing remembered, only the running version's crashes count: an app that adds the SDK
     * in an update must not report what the system remembers from before it.
     */
    private fun reportPastCrashes() {
        if (!consentStore.isGranted) return
        val reportedUpTo = cacheManager.getObject(LAST_REPORTED_CRASH_CACHE_KEY)?.value?.optLong("timestamp")
            ?: platform?.lastUpdateTime
            ?: 0L
        val unreported = processCrashes().filter { it.timestamp > reportedUpTo }.sortedBy { it.timestamp }
        val newest = unreported.lastOrNull() ?: return
        for (crash in unreported) {
            capture(AutomaticEvents.APP_CRASHED, mapOf("crash_kind" to crash.kind), crash.timestamp)
        }
        // As with the app release: the marker must never reach storage ahead of the events.
        persistQueuedEvents()
        if (consentStore.isGranted) rememberReportedCrashes(newest.timestamp)
    }

    private fun rememberReportedCrashes(upTo: Long) {
        cacheManager.set(LAST_REPORTED_CRASH_CACHE_KEY, JSONObject().put("timestamp", upTo))
    }

    /** [initialize] on the client's own scope, for a caller that cannot wait for it. */
    internal fun initializeInBackground() {
        scope.launch { runQuietly("initialize once the device was unlocked") { initialize() } }
    }

    private suspend fun connectAndReconcileStore() {
        runQuietly("reconcile observed transactions") { reconcileStore() }
    }

    private suspend fun ensureBillingConnected() = billingConnectionMutex.withLock {
        // A cancellation from the SDK's own scope must not end the host's coroutine silently.
        if (closed.get() || !scope.isActive) throw clientShutDown()
        if (!billingReady.get()) {
            // A connection that cannot be opened throws BILLING_CONNECTION_FAILED from the port.
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
            billingReady.set(true)
        }
    }

    private suspend fun reconcileStore() {
        ensureBillingConnected()
        val current = schemaRef.get()
        orchestrator.reconcileObservedTransactions(
            current ?: RuntimeSchema.EMPTY,
            deferStoreFinalization = current == null,
        )
    }

    /**
     * Refreshes everything a launch needs, off the initialization path: the person, all
     * flags, and the paywall configuration for every location this device knows about.
     *
     * Preloading is what makes the first `presentFlow` of a session instant and lets it work
     * offline at all: a location whose configuration was never fetched has nothing to fall
     * back to. Each location's flow package is downloaded too. Without a renderer no flow can
     * be presented, so none is resolved.
     */
    private suspend fun preload(distinctId: String) {
        if (gate?.isBlocked(apiClient.circuitKey) != true) {
            // Without a schema the store surface is unusable, so this is the first thing to fix;
            // a cached one past its stale time is refreshed here too, which is what keeps a
            // long-lived process from running on a day-old schema. `scheduleBackgroundRefresh`
            // joins the retry loop already running rather than starting a second one.
            if (schemaRef.get() == null || schemaManager.isCachedSchemaStale()) {
                schemaManager.scheduleBackgroundRefresh(distinctId)
            }

            // Keyed like the reads, so a read racing the preload joins it instead of repeating it.
            singleFlight.run("person:$distinctId") {
                runQuietly("refresh the person") { refreshPerson(distinctId) }
            }
            singleFlight.run(flagsCacheKey(distinctId, emptyList())) {
                runQuietly("refresh feature flags") { refreshFlags(distinctId, emptyList()) }
            }
        }

        if (!flowsEnabled) return
        for (location in (preloadLocations + knownLocations()).distinct()) {
            val revision = knownRevision(location)
            runQuietly("preload the paywall for $location") {
                refreshPaywall(distinctId, location, revision)
            }
            val cacheKey = paywallCacheKey(distinctId, location, flowEngine(), revision)
            val cached = cacheManager.get(cacheKey)?.value as? JSONObject
            val resolved = cached?.let { decodeCached(cacheKey, it, ResolvedPaywall::fromJson) }?.value
            if (resolved == null) continue
            runQuietly("preload the flow package for $location") { flowCoordinator?.preload(location, resolved) }
        }
    }

    /**
     * Retries anything the backend has not acknowledged yet: person writes, then receipts, so a
     * receipt queued under an anonymous id lands after the identify that merges that id.
     *
     * One drain runs at a time. A trigger arriving during one is skipped, since the retry timer
     * picks up whatever is still due; [joinRunning] instead waits for it and drains again, for
     * callers that must return only once the queues were tried.
     *
     * A receipt accepted here was bought while Voidhash could not be reached, so the person the
     * device holds, or its remembered "no person", predates it: the person is refreshed as after
     * a purchase. A purchase this SDK started is then finished by a store scan: until Google Play
     * consumes a consumable, it cannot be bought again.
     */
    private suspend fun drainOutbox(joinRunning: Boolean = false) {
        if (!outboxDrainMutex.tryLock()) {
            if (!joinRunning) return
            outboxDrainMutex.lock()
        }
        var acceptedStartedBySdk = false
        val receiptsAccepted = try {
            personWrites.drain(
                identify = { write ->
                    val epoch = identityEpoch.get()
                    try {
                        apiClient.identify(write.distinctId, write.target, write.email, write.name).also { person ->
                            cachePersonIfCurrent(write.target, epoch, person)
                        }
                    } catch (error: CancellationException) {
                        throw error
                    } catch (error: Throwable) {
                        // The backend never took this profile, so a repeat of it is sent again.
                        if (classifyFailure(error) == FailureClass.VERDICT && !isAliasAlreadyIdentified(error)) {
                            identityStore.forgetIdentifiedProfile(write.target)
                        }
                        throw error
                    }
                },
                setTraits = { write ->
                    // An agreement to ad data sharing queued before consent was withdrawn is not
                    // sent; the rest of the write is, and so is a revocation.
                    val traits = if (write.kind == PersonWriteKind.TRAITS) consentedTraits(write.traits) else write.traits
                    if (traits.isNotEmpty() || write.email != null || write.name != null) {
                        val epoch = identityEpoch.get()
                        val person = apiClient.setPersonAttributes(write.distinctId, traits, write.email, write.name)
                        cachePersonIfCurrent(write.distinctId, epoch, person)
                    }
                },
            )
            outbox.drain { distinctId, request ->
                apiClient.syncTransactionVerdict(distinctId, request).also { verdict ->
                    if (verdict == TransactionSyncVerdict.ACCEPTED && request.isStartedBySdk) {
                        acceptedStartedBySdk = true
                    }
                }
            }
        } finally {
            outboxDrainMutex.unlock()
        }
        if (receiptsAccepted > 0) refreshPersonAfterPurchase()
        if (acceptedStartedBySdk) scope.launch { connectAndReconcileStore() }
    }

    /**
     * Whether a person write or a receipt is due and its plane open. Reads memory only, so the
     * retry timer of an idle app touches neither disk nor network.
     */
    private fun outboxWorkDue(): Boolean {
        val now = sdkClock.now()
        return personWrites.hasDue(now) && gate?.isBlocked(apiClient.circuitKey) != true ||
            outbox.hasDue(now) && gate?.isBlocked(apiClient.transactionCircuitKey) != true
    }

    /**
     * Runs the retry timer — the analytics daemon — exactly while the client is initialized,
     * live and in the foreground. Each tick probes a paused key once its minute has passed and
     * retries the person writes and receipts whose backoff has elapsed; the daemon then flushes
     * analytics.
     */
    private fun updateRetryTimer() {
        synchronized(retryTimerLock) {
            if (initialized && !closed.get() && appInForeground) {
                analyticsClient.start(scope) {
                    probeAuthenticationIfDue()
                    if (outboxWorkDue()) drainOutbox()
                    refreshSkippedReads()
                }
            } else {
                analyticsClient.stop()
            }
        }
    }

    /**
     * Delivers queued person writes and receipts for the background purchase check, so a
     * purchase Voidhash accepts is finished the usual way rather than on the device. Runs whether
     * or not the client was initialized: in a process the check started, the app's activity, and
     * with it `initialize`, may never come.
     */
    internal suspend fun deliverQueuedReceipts() {
        if (!enabled || closed.get()) return
        gate?.onNetworkChanged()
        runQuietly("deliver queued receipts for the purchase check") { drainOutbox(joinRunning = true) }
    }

    /**
     * Reports that the background check finished the purchase [purchaseToken] on the device while
     * its receipt still waits for Voidhash. The receipt stays queued and is still delivered.
     */
    internal fun onPurchaseFinishedLocally(purchaseToken: String) {
        if (!enabled || outbox.pendingRecords.none { it.request.purchaseToken == purchaseToken }) return
        diagnostics.emit(
            VoidhashDiagnosticKind.TRANSPORT,
            code = "PURCHASE_FINISHED_BEFORE_SYNC",
            operation = "transactions.finish",
            retryable = true,
            message = "Acknowledged a purchase with Google Play before Voidhash recorded it, so Google Play " +
                "does not refund it; its receipt ${redacted("android:$purchaseToken")} is still delivered",
        )
    }

    /**
     * Retries due person writes and receipts once a request proved the API reachable, which is
     * how queued work recovers promptly after an outage, in the background too.
     */
    internal fun onRequestSucceeded() {
        refreshSkippedReads()
        if (!initialized || closed.get() || outboxDrainMutex.isLocked || !outboxWorkDue()) return
        scope.launch { runQuietly("drain the outbox after a successful request") { drainOutbox() } }
    }

    /**
     * Refreshes the person and every flag once after a read was answered from the cache because
     * the API was blocked, as soon as it admits requests again: from the retry timer once the
     * circuit's window has passed, or after any request that succeeded. Without it, an app that
     * shows flags from [featureFlags] would keep the outage's values until the next foreground.
     */
    private fun refreshSkippedReads() {
        if (!initialized || closed.get() || gate?.isBlocked(apiClient.circuitKey) == true) return
        if (!refreshAwaitingCircuit.compareAndSet(true, false)) return
        val distinctId = identityStore.getDistinctId()
        scope.launch {
            val person = catchUp("the person") { singleFlight.run("person:$distinctId") { refreshPerson(distinctId) } }
            val flags = catchUp("feature flags") {
                singleFlight.run(flagsCacheKey(distinctId, emptyList())) { refreshFlags(distinctId, emptyList()) }
            }
            // A half-open circuit admits one probe, which may fail or go to another request: the
            // catch-up stays due until it gets through.
            if (!person || !flags) refreshAwaitingCircuit.set(true)
        }
    }

    /**
     * Runs one part of the catch-up refresh; `false` when it failed in a way a later attempt may
     * not, such as an open circuit or the network, and `true` when it got an answer, a refusal
     * included.
     */
    private suspend fun catchUp(what: String, refresh: suspend () -> Unit): Boolean = try {
        refresh()
        true
    } catch (error: CancellationException) {
        throw error
    } catch (error: Throwable) {
        onWarning("Failed to refresh $what after an outage: ${error.message}")
        classifyFailure(error) == FailureClass.VERDICT
    }

    /**
     * Returns the products of the project that Google Play sells, sorted by slug: the same order on
     * every platform, since the schema keys products by slug and carries no order of its own. A
     * product the store does not return is left out and reported once per call as a
     * `PRODUCT_NOT_FOUND` diagnostic (see [VoidhashOptions.onDiagnostic]) with the reason; one Google
     * Play sells as the other type than Studio's (a subscription for a one-time product, or the
     * reverse) as `PRODUCT_TYPE_MISMATCH` with both types. Products Studio does not sell on Google
     * Play, such as App Store only ones, are left out without a report, as on iOS.
     *
     * With no schema yet — a cold, offline launch — the list is empty rather than an error:
     * there are no products the SDK knows about, which is a fact the caller can render.
     */
    suspend fun getProducts(): List<VoidhashProduct> {
        takenOverBy?.let { return it.getProducts() }
        if (!enabled) return emptyList()
        if (closed.get()) throw clientShutDown()
        val schema = schemaRef.get() ?: RuntimeSchema.EMPTY
        val slugs = schema.products.keys.sorted()
        val products = orchestrator.loadProducts(schema, slugs, reportsUnsold = false)
        return slugs.mapNotNull { products[it] }
    }

    /**
     * Returns the products of [slugs], in the order given: `null` in place of a product the schema
     * does not have, Studio does not sell on Google Play, or the store does not return, each
     * reported as in [getProducts].
     *
     * ```kotlin
     * val (yearly, monthly) = voidhash.getProducts(listOf("yearly", "monthly"))
     * ```
     */
    suspend fun getProducts(slugs: List<String>): List<VoidhashProduct?> {
        takenOverBy?.let { return it.getProducts(slugs) }
        if (!enabled) return slugs.map { null }
        if (closed.get()) throw clientShutDown()
        val products = orchestrator.loadProducts(schemaRef.get() ?: RuntimeSchema.EMPTY, slugs, reportsUnsold = true)
        return slugs.map { products[it] }
    }

    /**
     * Buys [product]. [activity] becomes the activity Play Billing launches its flow from.
     *
     * By default a subscription is bought with its introductory offer when the user can get one
     * ([VoidhashSubscriptionInfo.introOffer]), and at its regular price otherwise; see
     * [VoidhashPurchaseOptions] for choosing another offer, a raw Google Play offer token, and
     * Play's profile id. An offer Google Play does not offer the user fails with `OFFER_UNAVAILABLE`,
     * and one Play refuses as the user is not eligible for it fails with a [VoidhashPurchaseException]
     * whose reason is [PurchaseFailureReason.INELIGIBLE_FOR_OFFER]: the product is never
     * bought at its regular price instead. A quantity other than 1 fails with `INVALID_ARGUMENT`.
     *
     * Returns [VoidhashPurchaseResult.Purchased] once the store charged the user, with whether
     * Voidhash recorded it yet; [VoidhashPurchaseResult.Pending] for a payment Play still waits for,
     * which arrives through [transactionUpdates] once it is made; [VoidhashPurchaseResult.Cancelled]
     * when the user closed the sheet; and [VoidhashPurchaseResult.Disabled] for a client configured
     * with `enabled = false`. Other failures throw [VoidhashException]: `PURCHASE_IN_PROGRESS` while
     * another purchase runs, `ITEM_ALREADY_OWNED`, `STORE_UNAVAILABLE`, and `BILLING_ERROR` — for a
     * declined payment a [VoidhashPurchaseException] whose reason is [PurchaseFailureReason.PAYMENT_DECLINED].
     *
     * With [VoidhashPurchaseOptions.replacing], the purchase replaces the subscription the user has
     * now — an upgrade, a downgrade or a change of plan — in the mode it names. Without it, buying
     * another subscription product adds a second subscription next to the first, and Google Play
     * bills both. The SDK finds the purchase to replace itself, and nothing is bought when it cannot:
     * the purchase fails with `REPLACED_SUBSCRIPTION_NOT_OWNED` when the signed-in Google Play account
     * does not own the named subscription, with `INVALID_ARGUMENT` when either product is not a
     * subscription or both are the same product, and with `SUBSCRIPTION_REPLACEMENT_REFUSED` when
     * Google Play rejects the replacement before its sheet opens. A subscription bought under another
     * identity, before the person signed in for one, can be replaced: the new purchase belongs to the
     * identity that makes it. A purchase started from a flow cannot replace a subscription.
     *
     * Unavailable in observer mode, as set when the purchase starts: an observer
     * never owns a transaction, so it must never start one it would then be
     * unable to finish.
     */
    suspend fun purchase(
        activity: Activity,
        product: VoidhashProduct,
        options: VoidhashPurchaseOptions = VoidhashPurchaseOptions(),
    ): VoidhashPurchaseResult {
        takenOverBy?.let { return it.purchase(activity, product, options) }
        // Refused before the activity is touched: the purchase in flight may still need it.
        return withPurchaseInFlight {
            activitySink(activity)
            try {
                purchaseProduct(product, options)
            } finally {
                activitySink(null)
            }
        }
    }

    /** Whether a purchase may have its store sheet open; [release] keeps the store connection until none is. */
    private val purchasesInFlight = MutableStateFlow(0)

    /** Runs [block] as the one purchase in flight; another one meanwhile fails with `PURCHASE_IN_PROGRESS`. */
    private suspend fun <T> withPurchaseInFlight(block: suspend () -> T): T {
        if (!purchasesInFlight.compareAndSet(0, 1)) {
            throw VoidhashException("PURCHASE_IN_PROGRESS", "Another purchase is already in progress")
        }
        try {
            return block()
        } finally {
            purchasesInFlight.value = 0
        }
    }

    /** The single purchase entry point shared by [purchase] and flows; call within [withPurchaseInFlight]. */
    private suspend fun purchaseProduct(
        product: VoidhashProduct,
        options: VoidhashPurchaseOptions,
        paywallContext: PurchasePaywallContext? = null,
    ): VoidhashPurchaseResult {
        if (untilUnlock != null) throw deviceLocked("start a purchase")
        if (!enabled) return VoidhashPurchaseResult.Disabled
        if (closed.get()) throw clientShutDown()
        if (readOnlyFlag.get()) {
            throw VoidhashException(
                "READ_ONLY_PURCHASE_NOT_ALLOWED",
                "Read-only mode is enabled. Purchasing is disabled for observer-only operation.",
            )
        }
        val schema = requireSchema()
        return orchestrator.purchase(product, schema, options, paywallContext)
    }

    /**
     * Buys [product] for a flow, with the offer [offerId] the flow names or else the automatic one.
     * A flow knows only success and failure, so anything but a purchase throws: `USER_CANCELLED`,
     * `PURCHASE_PENDING`, or `CONFIGURATION_MISSING` for a disabled client.
     */
    private suspend fun purchaseForFlow(product: VoidhashProduct, offerId: String?, paywallContext: PurchasePaywallContext?) {
        val options = VoidhashPurchaseOptions(
            offer = offerId?.let { VoidhashOfferSelection.Id(it) } ?: VoidhashOfferSelection.Automatic,
        )
        when (withPurchaseInFlight { purchaseProduct(product, options, paywallContext) }) {
            is VoidhashPurchaseResult.Purchased -> Unit
            VoidhashPurchaseResult.Pending -> throw VoidhashException("PURCHASE_PENDING", "The payment is pending")
            VoidhashPurchaseResult.Cancelled -> throw VoidhashException("USER_CANCELLED", "The user cancelled the purchase")
            VoidhashPurchaseResult.Disabled -> throw VoidhashException("CONFIGURATION_MISSING", "Voidhash is disabled")
        }
    }

    /**
     * Revalidates owned, restorable purchases for the requesting user and returns the refreshed
     * person, so "nothing to restore" needs no second read; `null` when the backend has no person for
     * the user, or the client is disabled. Bypasses accepted-receipt caching and skips known
     * consumables. Deferred delivery throws and stays queued; success does not imply an active
     * entitlement. Once Google Play listed the purchases, the call waits at most 10 s for Voidhash:
     * a restore that has not finished by then throws like a deferred one and carries on in the
     * background.
     *
     * With no schema yet the store is still reconciled — a receipt is worth syncing whether
     * or not the SDK can name the product — so this never fails for want of configuration.
     */
    suspend fun restorePurchases(): VoidhashPerson? {
        takenOverBy?.let { return it.restorePurchases() }
        if (untilUnlock != null) throw deviceLocked("restore purchases")
        if (!enabled) return null
        if (closed.get()) throw clientShutDown()
        cacheManager.awaitWarm()
        val distinctId = identityStore.getDistinctId()
        ensureBillingConnected()
        val current = schemaRef.get()
        try {
            orchestrator.restorePurchases(current ?: RuntimeSchema.EMPTY, deferStoreFinalization = current == null, distinctId = distinctId)
        } catch (error: VoidhashException) {
            // Cut short because this client was shut down or replaced meanwhile.
            if (closed.get()) throw clientShutDown()
            throw error
        }
        // The restore refreshed the person; this reads what it cached.
        return readPerson(forceFetch = false).person
    }

    /**
     * Opens Google Play's subscription management above [activity]: the page of [product]'s
     * subscription, or the list of the user's subscriptions without one. Throws `STORE_UNAVAILABLE`
     * when nothing on the device can open it.
     */
    suspend fun showManageSubscriptions(activity: Activity, product: VoidhashProduct? = null) {
        openStoreLink(activity, manageSubscriptionsUrl(activity.packageName, product?.storeProductId))
    }

    /**
     * Opens Google Play's page for redeeming a promo code above [activity], with [code] filled in
     * when given. What the user redeems arrives as a purchase: through [transactionUpdates] and the
     * person. Throws `STORE_UNAVAILABLE` when nothing on the device can open it.
     */
    suspend fun presentCodeRedemption(activity: Activity, code: String? = null) {
        openStoreLink(activity, codeRedemptionUrl(code))
    }

    private suspend fun openStoreLink(activity: Activity, url: String) {
        withContext(Dispatchers.Main.immediate) {
            try {
                activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            } catch (error: ActivityNotFoundException) {
                throw VoidhashException("STORE_UNAVAILABLE", "No app on this device opens Google Play's $url", error)
            }
        }
    }

    /**
     * The country the store bills the user in, as ISO 3166-1 alpha-2: Google Play's billing
     * country, which Play may change while the app runs. Google Play names no currency, so
     * [VoidhashStorefront.currencyCode] is `null`; a product's prices carry theirs. `null` for a
     * disabled client. Throws `STORE_UNAVAILABLE` when Play cannot be asked.
     */
    suspend fun getStorefront(): VoidhashStorefront? {
        takenOverBy?.let { return it.getStorefront() }
        if (!enabled) return null
        if (closed.get()) throw clientShutDown()
        ensureBillingConnected()
        return VoidhashStorefront(countryCode = billing.getBillingCountryCode().uppercase(Locale.ROOT), currencyCode = null)
    }

    /**
     * Whether the user can buy from the store now: Google Play is reachable and billing is
     * available for the signed-in account. `false` for a disabled client.
     */
    suspend fun canMakePayments(): Boolean {
        takenOverBy?.let { return it.canMakePayments() }
        if (!enabled || closed.get() || untilUnlock != null) return false
        return try {
            ensureBillingConnected()
            true
        } catch (error: VoidhashException) {
            false
        }
    }

    /** What only Google Play offers; see [VoidhashGooglePlay]. */
    val googlePlay: VoidhashGooglePlay = VoidhashGooglePlay(this)

    /** [VoidhashGooglePlay.showInAppMessages]. */
    internal suspend fun showGooglePlayInAppMessages(activity: Activity): GooglePlayInAppMessageResult {
        takenOverBy?.let { return it.showGooglePlayInAppMessages(activity) }
        if (!enabled) return GooglePlayInAppMessageResult.NoActionNeeded
        if (closed.get()) throw clientShutDown()
        ensureBillingConnected()
        return when (val result = billing.showInAppMessages(activity)) {
            BillingInAppMessageResult.NoActionNeeded -> GooglePlayInAppMessageResult.NoActionNeeded
            is BillingInAppMessageResult.SubscriptionStatusUpdated -> {
                // The user fixed the subscription: the store and the person catch up.
                runQuietly("sync purchases after Google Play updated a subscription") { syncPurchases() }
                runQuietly("refresh the person after Google Play updated a subscription") {
                    readPerson(forceFetch = true)
                }
                GooglePlayInAppMessageResult.SubscriptionStatusUpdated(result.purchaseToken)
            }
        }
    }

    /** [VoidhashGooglePlay.queryPurchases]. */
    internal suspend fun queryGooglePlayPurchases(includeSuspended: Boolean): List<VoidhashTransaction> {
        takenOverBy?.let { return it.queryGooglePlayPurchases(includeSuspended) }
        if (!enabled) return emptyList()
        if (closed.get()) throw clientShutDown()
        ensureBillingConnected()
        val purchases = billing.getAvailableItemsByType(BillingProductType.INAPP) +
            billing.getAvailableItemsByType(BillingProductType.SUBS, includeSuspended)
        val schema = schemaRef.get() ?: RuntimeSchema.EMPTY
        return purchases.map { orchestrator.publicTransaction(mapBillingPurchaseToTransaction(it), schema) }
    }

    /** [VoidhashGooglePlay.isFeatureSupported]. */
    internal suspend fun isGooglePlayFeatureSupported(feature: String): Boolean {
        takenOverBy?.let { return it.isGooglePlayFeatureSupported(feature) }
        if (!enabled) return false
        if (closed.get()) throw clientShutDown()
        ensureBillingConnected()
        return billing.isFeatureSupported(feature)
    }

    /**
     * Reports the host's purchase without connecting, acknowledging or consuming it.
     * Only the token is retained. Pending purchases are ignored; report them again when purchased.
     * Throws `TRANSACTION_NOT_DURABLE` like [reportTransaction] with a token; [isRestore] as there.
     */
    @JvmOverloads
    suspend fun reportTransaction(purchase: Purchase, isRestore: Boolean = false) {
        if (!enabled && untilUnlock == null) return
        if (purchase.products.size > 1) {
            throw VoidhashException("INVALID_TRANSACTION", "Multi-product purchases are not supported")
        }
        if (purchase.purchaseState != Purchase.PurchaseState.PURCHASED) return
        reportTransaction(purchase.purchaseToken, isRestore)
    }

    /**
     * Reports a Google Play purchase token; no other purchase metadata is required.
     * The current SDK identity is captured before delivery. The server verifies the purchase
     * with Google Play. Delivery failures stay queued and never fail the host purchase callback.
     *
     * Without [isRestore] the report is a purchase the user just made, and it goes to the
     * identity it is reported for even when the Google account's purchase belonged to another
     * user; Google Play must show it was made in the last 24 hours, or it is recorded like a
     * background sync, for its current owner. The report is sent even when a background scan had
     * it accepted already, and keeps its intent across retries and relaunches. A purchase is
     * claimed once from a device: reporting it again, also after another user signed in, sends
     * nothing and cannot move it.
     *
     * Pass [isRestore] for a purchase the host's own restore flow returned after the user asked
     * to restore purchases. It is sent as an explicit restore for the current identity, like
     * [restorePurchases], even when Voidhash accepted it before, and keeps that intent across
     * retries and relaunches: the project's paid access sharing setting then decides whether a
     * purchase another user has is shared, moved or kept.
     *
     * Throws `TRANSACTION_NOT_DURABLE` when the device could not write the receipt to storage
     * (for example, a full disk). Delivery is still attempted from memory, but the receipt would
     * not survive the process, so delay consuming the purchase until a later report succeeds.
     *
     * A client replaced by a later `configure` for the same publishable key and base URL hands
     * the report to that client. One shut down with no such successor writes the receipt to disk,
     * where the next `configure` with that key and base URL picks it up.
     */
    @JvmOverloads
    suspend fun reportTransaction(purchaseToken: String, isRestore: Boolean = false) {
        if (untilUnlock != null) {
            if (purchaseToken.isBlank()) {
                throw VoidhashException("INVALID_TRANSACTION", "A Google Play purchase token is required")
            }
            return when (val admission = untilUnlock.admit(always = true) { it.reportTransaction(purchaseToken, isRestore) }) {
                is DeferredUntilUnlock.Admission.Live -> admission.client.reportTransaction(purchaseToken, isRestore)
                // Never refused: the report is the only record that the user paid.
                else -> throw heldUntilUnlockNotDurable("transactions.report")
            }
        }
        if (!enabled) return
        replacementClient()?.let { return it.reportTransaction(purchaseToken, isRestore) }
        if (purchaseToken.isBlank()) {
            throw VoidhashException("INVALID_TRANSACTION", "A Google Play purchase token is required")
        }
        awaitHeldCalls()
        cacheManager.awaitWarm()
        val restoreDistinctId = if (isRestore) identityStore.getDistinctId() else null
        val transaction = StoreTransaction(
            id = purchaseToken,
            transactionId = purchaseToken,
            productId = "",
            purchaseDate = 0.0,
            quantity = 1,
            isAcknowledged = false,
            purchaseState = "purchased",
            purchaseToken = purchaseToken,
            appAccountToken = null,
            receipt = null,
            isAutoRenewing = null,
            externallyManaged = true,
        )
        val schema = schemaRef.get() ?: RuntimeSchema.EMPTY
        val durable = orchestrator.stageReportedTransaction(transaction, schema, restoreDistinctId)
        scope.launch {
            runQuietly("deliver reported transaction") {
                // Externally managed: the orchestrator syncs it and leaves the finish to the host.
                orchestrator.processObservedTransaction(
                    transaction,
                    schema,
                    restoreDistinctId = restoreDistinctId,
                )
            }
        }
        if (!durable) {
            val message = "The purchase was reported, but the device could not store it; it is " +
                "held in memory until delivered and would not survive the app being closed"
            diagnostics.emit(
                VoidhashDiagnosticKind.CACHE,
                code = "TRANSACTION_NOT_DURABLE",
                operation = "transactions.report",
                retryable = true,
                message = message,
            )
            throw VoidhashException("TRANSACTION_NOT_DURABLE", message)
        }
    }

    /**
     * Reports currently owned purchases to Voidhash and refreshes the person.
     * Recovery fallback when a host callback exposes no transaction values. Prefer
     * [reportTransaction] for purchases, especially already consumed products. Observer mode never
     * acknowledges or consumes purchases. Delivery failures stay queued; returning
     * successfully does not imply backend acceptance. Store-read failures are thrown. Once
     * Google Play listed the purchases, waits at most 10 s for their delivery, which carries on in
     * the background past that.
     */
    suspend fun syncPurchases() {
        takenOverBy?.let { return it.syncPurchases() }
        if (untilUnlock != null) throw deviceLocked("sync purchases")
        if (!enabled) return
        if (closed.get()) throw clientShutDown()
        cacheManager.awaitWarm()
        ensureBillingConnected()
        val current = schemaRef.get()
        orchestrator.syncPurchases(
            current ?: RuntimeSchema.EMPTY,
            deferStoreFinalization = current == null,
        )
        // A scan cut short because this client was shut down or replaced must not pass for one that ran.
        if (closed.get()) throw clientShutDown()
    }

    /**
     * Returns the current person, cached for two days and refreshed behind the read after
     * five minutes. `null` when the backend confirmed it has no person for the current
     * identity; that answer is cached the same way, so it costs no network read each time.
     *
     * The read is answered from cache whenever anything is cached, so it never blocks on a
     * slow or unreachable API. [forceFetch] skips the cache, but still falls back to it
     * rather than failing when the API cannot be reached.
     */
    suspend fun getCurrentPerson(forceFetch: Boolean = false): VoidhashPerson? =
        getCurrentPersonState(forceFetch).value

    /** [getCurrentPerson] with the freshness of the returned snapshot attached. */
    suspend fun getCurrentPersonState(forceFetch: Boolean = false): Stale<VoidhashPerson?> {
        takenOverBy?.let { return it.getCurrentPersonState(forceFetch) }
        // Nothing is known before the unlock, which is not the same as "no person".
        if (untilUnlock != null) return Stale(null, isStale = true, isExpired = true)
        if (!enabled) return Stale(null)
        val read = readPerson(forceFetch)
        return Stale(read.person, read.isStale, read.isExpired)
    }

    /**
     * [getCurrentPersonState] with the identity, generation and reason a host needs. With
     * [surfaceAuthFailure], answering with nothing because the key was rejected throws once per
     * pause (see [surfaceAuthenticationFailure]).
     */
    internal suspend fun readPerson(forceFetch: Boolean, surfaceAuthFailure: Boolean = false): PersonState {
        takenOverBy?.let { return it.readPerson(forceFetch, surfaceAuthFailure) }
        if (!enabled) return PersonState(identityStore.getDistinctId(), identityGeneration, null, false, false, FreshnessReason.NO_CACHE)

        // After the warm-up every cache read below is answered from memory.
        cacheManager.awaitWarm()
        // Read before the id: an identity switch in between makes the answer one the host drops.
        val generation = identityGeneration
        val distinctId = identityStore.getDistinctId()
        val cached = cacheManager.getObject(personCacheKey(distinctId))?.let { hit ->
            decodeCachedPerson(distinctId, hit.value)?.let { decoded -> hit to PersonRefresh(decoded.value) }
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
            .let { read ->
                if (surfaceAuthFailure) surfaceAuthenticationFailure(answeredWithNothing = read.value.value == null)
                PersonState(
                    distinctId,
                    generation,
                    read.value.value?.person,
                    read.value.isStale,
                    read.value.isExpired,
                    read.reason,
                )
            }
    }

    /**
     * Drops the person snapshot cached for the current identity; the next read asks the server.
     * Until it answers, [person] is `null` and the host hears of the identity's person as not
     * cached, as on iOS: what was dropped is no longer what the device knows.
     */
    internal suspend fun resetPersonCache() {
        takenOverBy?.let { return it.resetPersonCache() }
        if (!enabled) return
        cacheManager.awaitWarm()
        // Under the identity lock, so no switch comes between the drop and its announcement.
        identityMutex.withLock {
            val distinctId = identityStore.getDistinctId()
            cacheManager.delete(personCacheKey(distinctId))
            personState.value = null
            announce(
                ClientEvent.Person(
                    PersonState(distinctId, identityGeneration, null, isStale = true, isExpired = true, reason = FreshnessReason.NO_CACHE),
                ),
            )
        }
    }

    /**
     * Fetches the person and caches the answer. A confirmed "no person" is cached too, for the
     * same lifetime as a snapshot; a failed fetch throws and leaves the cached entry alone.
     *
     * While an identify onto [distinctId] is still queued, the answer predates the merge of the
     * alias. "No person" is then no answer at all, and neither is a person while the cache holds
     * the snapshot carried over from that alias, which still names it: `null` is returned, and
     * the cached snapshot keeps being served until the identify delivers the merged one.
     */
    private suspend fun refreshPerson(distinctId: String): PersonRefresh? {
        val epoch = identityEpoch.get()
        val person = apiClient.getPerson(distinctId)
        val pending = personWrites.pendingIdentifies(distinctId)
        if (pending.isNotEmpty()) {
            if (person == null) return null
            val carriedFrom = cacheManager.getObject(personCacheKey(distinctId))?.value?.optString("distinctId")
            if (pending.any { it.distinctId == carriedFrom }) return null
        }
        cachePersonIfCurrent(distinctId, epoch, person)
        return PersonRefresh(person)
    }

    /** Whether [distinctId] is still the identity, with no switch since [epoch] was read. */
    private fun isCurrentIdentity(distinctId: String, epoch: Long): Boolean =
        identityEpoch.get() == epoch && identityStore.getDistinctId() == distinctId

    /**
     * Aliases the current (anonymous) identity onto [externalUserId].
     *
     * The local identity switches immediately and the write is queued on disk before the
     * request goes out, so neither a cancelled call nor a killed process loses it. The request
     * never holds up [initialize] or [reset]. Never throws for transport, an unreadable answer
     * or a rejected key: the call stays queued and returns the person the SDK knows, flagged
     * [WriteStatus.DEFERRED]. Until the backend has the alias, an anonymous purchaser keeps the
     * snapshot the anonymous id had, served as stale.
     *
     * Throws `INVALID_ARGUMENT`, before anything changes, for an [externalUserId] the API refuses:
     * blank, longer than 255 characters (code points), containing NUL, or starting with the
     * SDK's anonymous prefixes `vh_anon_` and `vh:anon:`. Any other verdict from the API about the payload — a
     * `400`, a `404` for an unknown target — is thrown as a [VoidhashApiException], and the local
     * identity is put back: the backend will never accept that alias, so keeping it would strand
     * the device on an identity nothing else knows.
     *
     * A `409` means the anonymous id is already linked to a different identified user. Nothing is
     * thrown: the device keeps [externalUserId] without that anonymous id's history and
     * purchases, which stay with the other user, reports [WriteStatus.CONFIRMED] and emits a
     * `PERSON_WRITE_REJECTED` diagnostic, as it does for a queued identify refused this way.
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
    ): PersonWriteResult = identifyForHost(externalUserId, email, name).result

    /** An identify's result with the identity it left in effect, as adopted under the identity lock. */
    internal class HostIdentify(val result: PersonWriteResult, val distinctId: String, val generation: Long)

    /** [identifyWithStatus] for a host, which needs the identity the identify adopted. */
    internal suspend fun identifyForHost(
        externalUserId: String,
        email: String?,
        name: String?,
    ): HostIdentify {
        if (untilUnlock != null) {
            requireIdentifyTarget(externalUserId)
            return when (val admission = untilUnlock.admit { it.identifyForHost(externalUserId, email, name) }) {
                is DeferredUntilUnlock.Admission.Live -> admission.client.identifyForHost(externalUserId, email, name)
                // Held in memory: the identity is switched, and the alias queued, once the device is unlocked.
                DeferredUntilUnlock.Admission.Held ->
                    HostIdentify(PersonWriteResult(WriteStatus.DEFERRED, null), identityStore.getDistinctId(), identityGeneration)
                DeferredUntilUnlock.Admission.Refused -> throw deviceLocked("keep another identify")
            }
        }
        // An inert client writes nothing, so the backend never has it.
        if (!enabled) return HostIdentify(PersonWriteResult(WriteStatus.DEFERRED, null), identityStore.getDistinctId(), identityGeneration)
        if (closed.get()) throw clientShutDown()
        requireIdentifyTarget(externalUserId)
        awaitHeldCalls()

        var adoptedGeneration = 0L
        val switch = identityMutex.withLock {
            awaitWarmWhileLive()
            adoptPinnedDistinctId()
            val previousDistinctId = identityStore.getDistinctId()
            if (grantConsentOnIdentify && consentStore.current == AnalyticsConsent.PENDING) {
                // Before the identity switches: what was held while pending is recorded for the
                // anonymous id, which this identify then links to the user.
                applyAnalyticsConsent(AnalyticsConsent.GRANTED, implied = true)
            }
            // A new identify is reason enough to try a rejected key again, as a new configure is.
            gate?.resumeAuth()
            val pending = personWrites.pendingIdentifies(externalUserId).firstOrNull()
            val profile = profileDigest(email, name)
            if (previousDistinctId == externalUserId && pending != null && pending.email == email && pending.name == name) {
                // The same identify is still on its way: one is enough, and it is sent now.
                scope.launch { runQuietly("drain the person writes") { drainOutbox() } }
                return HostIdentify(PersonWriteResult(WriteStatus.DEFERRED, cachedPerson(externalUserId)), externalUserId, identityGeneration)
            }
            if (previousDistinctId == externalUserId && pending == null) {
                val person = cachedPerson(externalUserId)
                val sameProfile = identityStore.identifiedProfileDigest(externalUserId) == profile
                val knownWithoutProfile = email == null && name == null &&
                    (person != null || lastIdentifiedId == externalUserId)
                if (sameProfile || knownWithoutProfile) {
                    return HostIdentify(
                        PersonWriteResult(if (person == null) WriteStatus.DEFERRED else WriteStatus.CONFIRMED, person),
                        externalUserId,
                        identityGeneration,
                    )
                }
            }
            // An anonymous id is linked onto the user it becomes. Otherwise an identify still
            // queued for this user keeps its alias: a fresh one would stand in for it, and the
            // anonymous purchases behind the queued one would never be merged.
            val aliasDistinctId = when {
                isAnonymousDistinctId(previousDistinctId) -> previousDistinctId
                pending != null -> pending.distinctId
                else -> ANONYMOUS_DISTINCT_ID_PREFIX + java.util.UUID.randomUUID()
            }
            if (pending?.distinctId == aliasDistinctId && email == null && name == null) {
                if (previousDistinctId != externalUserId) {
                    identityEpoch.incrementAndGet()
                    identityStore.setDistinctId(externalUserId)
                    invalidateIdentityState(previousDistinctId)
                    reloadFlagState()
                    adoptIdentity(previousDistinctId, externalUserId)
                }
                scope.launch { runQuietly("drain the person writes") { drainOutbox() } }
                return HostIdentify(PersonWriteResult(WriteStatus.DEFERRED, cachedPerson(externalUserId)), externalUserId, identityGeneration)
            }

            enableAnalyticsCapture()
            // The identity switches first so that a capture racing this call is already
            // attributed to the user the app knows about.
            val queued = withContext(NonCancellable) {
                if (previousDistinctId != externalUserId) identityEpoch.incrementAndGet()
                identityStore.setDistinctId(externalUserId)
                personWrites.enqueue(
                    PersonWrite(
                        kind = PersonWriteKind.IDENTIFY,
                        distinctId = aliasDistinctId,
                        externalUserId = externalUserId,
                        email = email,
                        name = name,
                    ),
                    directSend = true,
                ).also { identityStore.setIdentifiedProfile(externalUserId, profile) }
            }
            val fromAnonymous = aliasDistinctId == previousDistinctId
            IdentitySwitch(
                previousDistinctId,
                queued,
                carriedSnapshot = fromAnonymous && carryAnonymousSnapshot(previousDistinctId, externalUserId),
                carriedFlagKeys = if (fromAnonymous) carryAnonymousFlags(previousDistinctId, externalUserId) else emptyList(),
            ).also {
                reloadFlagState()
                // Identifying the identity already in effect adopts nothing; its profile is still sent.
                if (previousDistinctId != externalUserId) adoptIdentity(previousDistinctId, externalUserId)
                adoptedGeneration = identityGeneration
            }
        }

        // The write is queued already, so a slow API costs the caller at most the wait: the
        // delivery carries on, and its outcome is applied whenever it arrives.
        val callerWaiting = AtomicBoolean(true)
        val delivered = AtomicBoolean(false)
        val delivery = scope.async {
            deliverIdentify(switch, externalUserId, callerWaiting).also {
                delivered.set(it.status == WriteStatus.CONFIRMED)
            }
        }
        // On completion rather than in a `finally`: a delivery the released client never starts
        // must hand its claim back too.
        delivery.invokeOnCompletion { endDirectSend(switch.queued, delivered.get()) }
        val result = awaitDirectWrite(delivery, callerWaiting)
            ?: PersonWriteResult(WriteStatus.DEFERRED, cachedPerson(externalUserId))
        return HostIdentify(result, externalUserId, adoptedGeneration)
    }

    /**
     * Waits at most [DELIVERY_WAIT_MS] for the direct send of a person write. `null` once the wait is
     * over; [callerWaiting] is then taken back, so a refusal arriving later is handled like one of a
     * queued write — dropped and reported — instead of being applied to a caller that was told
     * the write is deferred.
     */
    private suspend fun awaitDirectWrite(
        delivery: Deferred<PersonWriteResult>,
        callerWaiting: AtomicBoolean,
    ): PersonWriteResult? {
        try {
            delivery.awaitWithin(DELIVERY_WAIT_MS)?.let { return it }
        } catch (error: CancellationException) {
            callerWaiting.set(false)
            throw error
        }
        if (callerWaiting.compareAndSet(true, false)) return null
        // The delivery took its answer to this caller just in time; it is about to complete, unless
        // the client scope goes away first.
        return try {
            delivery.await()
        } catch (error: CancellationException) {
            currentCoroutineContext().ensureActive()
            null
        }
    }

    /**
     * Sends the identify [switch] queued and applies the backend's answer to the local identity.
     * What is sent is the write as queued now, which a later identify of the same alias and user may
     * have updated; one a drain delivered meanwhile is not sent again.
     */
    private suspend fun deliverIdentify(
        switch: IdentitySwitch,
        externalUserId: String,
        callerWaiting: AtomicBoolean,
    ): PersonWriteResult {
        val previousDistinctId = switch.previousDistinctId
        var sent = switch.queued
        var settledElsewhere = false
        val person = try {
            outboxDrainMutex.withLock {
                // Owned by this send since its enqueue, so only another direct send of the same
                // key, or something that drops writes of its own accord, can have taken it.
                val current = personWrites.queuedVersionOf(switch.queued)
                if (current == null) {
                    settledElsewhere = true
                    return@withLock null
                }
                sent = current
                apiClient.identify(current.distinctId, externalUserId, current.email, current.name)
            }
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            return identityMutex.withLock {
                val currentDistinctId = identityStore.getDistinctId()
                if (isAliasAlreadyIdentified(error)) {
                    // The alias belongs to another user for good. Putting it back would read that
                    // user's person and send every later identify from it into the same refusal,
                    // so the device stays on the user the app signed in, without the alias's
                    // history, as a queued identify refused this way does.
                    personWrites.withdraw(sent)
                    if (switch.carriedSnapshot) cacheManager.delete(personCacheKey(externalUserId))
                    if (switch.carriedFlagKeys.isNotEmpty()) {
                        forgetCarriedFlags(externalUserId)
                        reloadFlagState()
                    }
                    if (currentDistinctId != previousDistinctId) invalidateIdentityState(previousDistinctId)
                    val message = "Identified ${redacted(externalUserId)} without merging the previous " +
                        "anonymous id, which already belongs to another identified user"
                    diagnostics.emit(
                        VoidhashDiagnosticKind.EVICTION,
                        code = "PERSON_WRITE_REJECTED",
                        operation = "person.identify",
                        httpStatus = 409,
                        message = message,
                    )
                    onWarning(message)
                    return@withLock PersonWriteResult(WriteStatus.CONFIRMED, cachedPerson(externalUserId))
                        .also { settle(sent, it, refusal = null) }
                }
                if (classifyFailure(error) == FailureClass.VERDICT) {
                    if (!callerWaiting.compareAndSet(true, false)) {
                        // The caller was told the identify is deferred. As for a queued identify
                        // the API refuses, the device keeps the user and the write is dropped.
                        personWrites.discard(sent, refusalReason(error))
                        // The backend never took this profile, so a repeat of it is sent again.
                        identityStore.forgetIdentifiedProfile(externalUserId)
                        // Nor will it merge the anonymous id, whose person and flags the user was
                        // served meanwhile.
                        if (switch.carriedSnapshot) cacheManager.delete(personCacheKey(externalUserId))
                        if (switch.carriedFlagKeys.isNotEmpty()) {
                            forgetCarriedFlags(externalUserId)
                            reloadFlagState()
                        }
                        if (currentDistinctId != previousDistinctId) invalidateIdentityState(previousDistinctId)
                        return@withLock PersonWriteResult(WriteStatus.DEFERRED, cachedPerson(externalUserId))
                    }
                    identityStore.forgetIdentifiedProfile(externalUserId)
                    personWrites.withdraw(sent)
                    settle(sent, result = null, refusal = error)
                    if (currentDistinctId == externalUserId) {
                        if (previousDistinctId != externalUserId) identityEpoch.incrementAndGet()
                        identityStore.setDistinctId(previousDistinctId)
                        if (switch.carriedSnapshot) cacheManager.delete(personCacheKey(externalUserId))
                        if (switch.carriedFlagKeys.isNotEmpty()) forgetCarriedFlags(externalUserId)
                        reloadFlagState()
                        if (previousDistinctId != externalUserId) adoptIdentity(externalUserId, previousDistinctId)
                    } else if (currentDistinctId != previousDistinctId) {
                        invalidateIdentityState(previousDistinctId)
                    }
                    throw error
                }

                // Transport, an unreadable answer or a paused key: the write stays queued.
                if (currentDistinctId != previousDistinctId) invalidateIdentityState(previousDistinctId)
                onWarning("Queued an identify for ${redacted(externalUserId)}: ${error.message}")
                PersonWriteResult(WriteStatus.DEFERRED, cachedPerson(externalUserId))
            }
        }

        // This write merged into an identify of the same alias, user and content that another
        // send delivered or was refused for: that outcome is this one's too. Outside the `try`
        // above, so a refusal shared this way reaches the caller as the first one's did.
        if (settledElsewhere) {
            return settledOutcome(switch.queued, callerWaiting)
                ?: PersonWriteResult(WriteStatus.DEFERRED, cachedPerson(externalUserId))
        }

        return identityMutex.withLock {
            personWrites.acknowledge(sent)
            val currentDistinctId = identityStore.getDistinctId()
            // Flags and the person snapshot are evaluated per identity; without this the ones
            // computed for the anonymous visitor keep answering reads.
            if (currentDistinctId != previousDistinctId) invalidateIdentityState(previousDistinctId)
            // A sign-out or another identify since the switch owns the identity now.
            if (currentDistinctId == externalUserId) {
                lastIdentifiedId = externalUserId
                cachePerson(externalUserId, person)
                scope.launch {
                    runQuietly("refresh flags after identify") { refreshFlags(externalUserId, emptyList()) }
                }
            }
            PersonWriteResult(WriteStatus.CONFIRMED, person).also { settle(sent, it, refusal = null) }
        }
    }

    /** How the last direct send of a person write settled, and the queue's revision by then. */
    private class SettledWrite(val atRevision: Long, val result: PersonWriteResult?, val refusal: Throwable?)

    /**
     * The last settled direct send of each person write key, while a direct send still owns the
     * key; see [settledOutcome].
     */
    private val settledWrites = java.util.concurrent.ConcurrentHashMap<String, SettledWrite>()

    /** How many settled direct sends are remembered, for tests. */
    internal val settledWriteCount: Int get() = settledWrites.size

    /** Remembers how the direct send of [sent] settled, for the identical writes it covered. */
    private fun settle(sent: PersonWrite, result: PersonWriteResult?, refusal: Throwable?) {
        settledWrites[sent.key] = SettledWrite(personWrites.latestRevision, result, refusal)
    }

    /**
     * The outcome of [queued] when another direct send of its key delivered or refused it before
     * this one got to it: a send that settled after [queued] was queued covered it. A refusal is
     * thrown to a caller still waiting, as the first send's was. `null` when nothing settled it.
     */
    private fun settledOutcome(queued: PersonWrite, callerWaiting: AtomicBoolean): PersonWriteResult? {
        val settled = settledWrites[queued.key]?.takeIf { it.atRevision >= queued.revision } ?: return null
        val refusal = settled.refusal ?: return settled.result
        if (callerWaiting.compareAndSet(true, false)) throw refusal
        return PersonWriteResult(WriteStatus.DEFERRED, cachedPerson(queued.target))
    }

    /**
     * Copies the anonymous person's snapshot to [externalUserId] when nothing is cached for
     * that id yet, already stale, so its first read revalidates.
     *
     * The backend merges the anonymous person into the identified one, so until it has the
     * alias, the anonymous snapshot is the best answer for the new identity: without it an
     * anonymous purchaser identifying while Voidhash is unreachable loses access to what they
     * just bought. Returns whether a snapshot was carried over.
     */
    private fun carryAnonymousSnapshot(anonymousDistinctId: String, externalUserId: String): Boolean {
        if (cacheManager.get(personCacheKey(externalUserId)) != null) return false
        val snapshot = cacheManager.getObject(personCacheKey(anonymousDistinctId)) ?: return false
        if (isNoPersonEntry(snapshot.value)) return false
        cacheManager.setWithDeadlines(
            personCacheKey(externalUserId),
            snapshot.value,
            staleAt = clock() - 1,
            expiresAt = snapshot.expiresAt,
        )
        return true
    }

    /**
     * Copies the anonymous visitor's flag evaluations to [externalUserId] when nothing is cached
     * for that id yet, already stale, so its first read revalidates. Returns the keys carried over.
     *
     * They stand in until the user's own evaluation replaces them: without them, signing in would
     * turn every flag off until that evaluation arrives, and for as long as Voidhash is unreachable.
     * They are not that evaluation — the backend evaluates flags for the identified person, which
     * may land in other variants — so they are stale from the start, and the refresh after the
     * identify, or the next read, replaces them. Only an anonymous id carries over to the user it
     * becomes; a switch between users never does.
     */
    private fun carryAnonymousFlags(anonymousDistinctId: String, externalUserId: String): List<String> {
        val fromPrefix = "flags:$anonymousDistinctId:"
        val toPrefix = "flags:$externalUserId:"
        if (cacheManager.getCacheKeys().any { it.startsWith(toPrefix) }) return emptyList()
        val carried = mutableListOf<String>()
        for (key in cacheManager.getCacheKeys()) {
            if (!key.startsWith(fromPrefix)) continue
            val evaluation = cacheManager.getArray(key) ?: continue
            val carriedKey = toPrefix + key.removePrefix(fromPrefix)
            cacheManager.setWithDeadlines(
                carriedKey,
                evaluation.value,
                staleAt = clock() - 1,
                expiresAt = evaluation.expiresAt,
            )
            carried += carriedKey
        }
        return carried
    }

    /** Drops the flags [carryAnonymousFlags] gave [externalUserId], when the identify did not hold. */
    private fun forgetCarriedFlags(externalUserId: String) {
        cacheManager.deleteByPrefix("flags:$externalUserId:")
    }

    /**
     * Persists a distinct id the host pinned at configure time. When it replaces an anonymous
     * id this device used before, the alias is queued first, so that id's purchases and
     * history are merged into the pinned person rather than orphaned. The queued identify is
     * delivered like any other; nothing is sent from here. Call with [identityMutex] held,
     * after the cache has warmed up.
     */
    private suspend fun adoptPinnedDistinctId() {
        val pinned = identityStore.pinnedDistinctId ?: return
        val stored = identityStore.storedDistinctId()
        if (stored != null && stored != pinned && isAnonymousDistinctId(stored)) {
            withContext(NonCancellable) {
                personWrites.enqueue(
                    PersonWrite(
                        kind = PersonWriteKind.IDENTIFY,
                        distinctId = stored,
                        externalUserId = pinned,
                    ),
                )
            }
            carryAnonymousSnapshot(stored, pinned)
            carryAnonymousFlags(stored, pinned)
            invalidateIdentityState(stored)
        }
        identityStore.setDistinctId(pinned)
        reloadFlagState()
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

    /**
     * [setPersonAttributes], reporting whether the backend has the traits yet.
     *
     * Trait values are flat: strings, numbers, booleans or `null`. Anything else — a map, a
     * list — throws `INVALID_ARGUMENT` before anything is sent or queued. A non-finite number is
     * sent as `null`. The attributes `email` and `name` with a string value are the person's
     * email and name, sent as such rather than as traits. An empty map sends and queues nothing
     * and reports [WriteStatus.CONFIRMED] with the cached person. While a write for the current
     * person is still queued — an identify that creates it, or earlier traits — the traits queue
     * behind it and report [WriteStatus.DEFERRED], and so does an empty map. A confirmed write
     * returns, and caches, the person as the backend wrote it. A client that is inert writes
     * nothing and reports [WriteStatus.DEFERRED] without a person. Only a verdict from the API about the payload is thrown; its
     * "no such person" answer is not one, since an identify, an event or a receipt can still
     * create the person, so that write is queued too.
     *
     * Traits are what the app says about the person, so they are written whatever the analytics
     * consent. Agreeing to ad data sharing is the exception, see [setAdDataSharing]: unless consent
     * is granted, `$ad_data_sharing` is left out of the write unless it is `false`, and the other
     * traits are still sent. `$ad_data_sharing` set to `false` is always queued, and a write
     * holding nothing else reports [WriteStatus.DEFERRED].
     */
    suspend fun setPersonAttributesWithStatus(attributes: Map<String, Any?>): PersonWriteResult =
        setPersonAttributesWithStatus(attributes, email = null, name = null)

    /**
     * [setPersonAttributesWithStatus] with the person's [email] and [name] besides the traits, as
     * the React Native facade writes them. Each is sent only when not `null`.
     */
    internal suspend fun setPersonAttributesWithStatus(
        attributes: Map<String, Any?>,
        email: String?,
        name: String?,
    ): PersonWriteResult {
        if (untilUnlock != null) {
            validatedTraits(attributes)
            return when (val admission = untilUnlock.admit { it.setPersonAttributesWithStatus(attributes, email, name) }) {
                is DeferredUntilUnlock.Admission.Live ->
                    admission.client.setPersonAttributesWithStatus(attributes, email, name)
                // Held in memory until the device's storage can be read.
                DeferredUntilUnlock.Admission.Held -> PersonWriteResult(WriteStatus.DEFERRED, null)
                DeferredUntilUnlock.Admission.Refused -> throw deviceLocked("keep another person write")
            }
        }
        // An inert client writes nothing, so the backend never has it.
        if (!enabled) return PersonWriteResult(WriteStatus.DEFERRED, null)
        if (closed.get()) throw clientShutDown()

        val profile = ProfileAttributes(validatedTraits(attributes), email, name)
        val email = profile.email
        val name = profile.name
        val requested = profile.traits
        awaitHeldCalls()
        awaitWarmWhileLive()
        val distinctId = identityStore.getDistinctId()
        val revoked = queueingAdDataSharingRevocation(requested, distinctId)
        if (revoked.isEmpty() && requested.isNotEmpty() && email == null && name == null) {
            return PersonWriteResult(WriteStatus.DEFERRED, cachedPerson(distinctId))
        }
        val traits = consentedTraits(revoked)
        // Nothing to write. Sent, it would cost a request that the API refuses for a person it
        // has not created yet, and queued, a record the drain would drop for the same reason.
        if (traits.isEmpty() && email == null && name == null) {
            val status = when {
                // Something was asked for and consent left none of it: an agreement to ad data sharing.
                revoked.isNotEmpty() -> WriteStatus.SKIPPED
                // What the person is waiting for has not reached the backend yet.
                personWrites.hasPendingWriteFor(distinctId) -> WriteStatus.DEFERRED
                else -> WriteStatus.CONFIRMED
            }
            return PersonWriteResult(status, cachedPerson(distinctId))
        }
        if (traits[AD_DATA_SHARING_TRAIT] == true) personWrites.cancelAdDataSharingRevocation(distinctId)
        val write = PersonWrite(kind = PersonWriteKind.TRAITS, distinctId = distinctId, traits = traits, email = email, name = name)

        // Sent now, these traits could reach the backend before the identify that creates the
        // person, or be overwritten by older queued traits arriving after them.
        if (personWrites.hasPendingWriteFor(distinctId)) {
            personWrites.enqueue(write)
            scope.launch { runQuietly("drain the person writes") { drainOutbox() } }
            return PersonWriteResult(WriteStatus.DEFERRED, cachedPerson(distinctId))
        }

        // Queued before it is sent, like an identify, so a slow API costs the caller at most the
        // wait: the send carries on and settles the queued write whenever it is answered.
        // Not cancellable once the key is claimed: a caller cancelled while the write reaches disk
        // must still reach the line below that hands the claim back.
        val queued = withContext(NonCancellable) { personWrites.enqueue(write, directSend = true) }
        val callerWaiting = AtomicBoolean(true)
        val delivered = AtomicBoolean(false)
        val delivery = scope.async {
            var sent = queued
            var written: VoidhashPerson? = null
            try {
                // In line with every other write for this person (see [outboxDrainMutex]), and
                // what is sent is what is queued now: traits merged in since are newer.
                outboxDrainMutex.withLock {
                    // Only a withdrawal of analytics consent takes a write this send owns, one
                    // that held nothing but an agreement to ad data sharing: nothing is left to write.
                    val current = personWrites.queuedVersionOf(queued)
                        ?: return@async PersonWriteResult(WriteStatus.CONFIRMED, cachedPerson(distinctId))
                    sent = current
                    val consented = consentedTraits(current.traits)
                    if (consented.isNotEmpty() || current.email != null || current.name != null) {
                        val epoch = identityEpoch.get()
                        val person = apiClient.setPersonAttributes(distinctId, consented, current.email, current.name)
                        // The person as written is the freshest there is; a sign-out or an identify
                        // meanwhile owns the cache of the identity now in effect.
                        cachePersonIfCurrent(distinctId, epoch, person)
                        written = person
                    }
                }
                personWrites.acknowledge(sent)
                delivered.set(true)
                PersonWriteResult(WriteStatus.CONFIRMED, written ?: cachedPerson(distinctId))
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                if (classifyFailure(error) == FailureClass.VERDICT && !isPersonNotFound(error)) {
                    if (callerWaiting.compareAndSet(true, false)) {
                        personWrites.withdraw(sent)
                        throw error
                    }
                    // The caller was told the traits are deferred: dropped and reported, as queued ones are.
                    personWrites.discard(sent, refusalReason(error))
                    return@async PersonWriteResult(WriteStatus.DEFERRED, cachedPerson(distinctId))
                }
                onWarning("Queued person traits for ${redacted(distinctId)}: ${error.message}")
                PersonWriteResult(WriteStatus.DEFERRED, cachedPerson(distinctId))
            }
        }
        delivery.invokeOnCompletion { endDirectSend(queued, delivered.get()) }
        return awaitDirectWrite(delivery, callerWaiting)
            ?: PersonWriteResult(WriteStatus.DEFERRED, cachedPerson(distinctId))
    }

    /**
     * Queues person traits, [email] and [name] for the current identity and returns once they are
     * queued, without waiting on the network: the drain sends them. For a host whose call must not
     * wait for the API but must keep its place before a later identity change. Validated, and
     * written whatever the consent, as [setPersonAttributesWithStatus] is.
     */
    internal suspend fun queuePersonAttributes(attributes: Map<String, Any?>, email: String?, name: String?) {
        if (untilUnlock != null) {
            validatedTraits(attributes)
            return when (val admission = untilUnlock.admit { it.queuePersonAttributes(attributes, email, name) }) {
                is DeferredUntilUnlock.Admission.Live -> admission.client.queuePersonAttributes(attributes, email, name)
                DeferredUntilUnlock.Admission.Held -> Unit
                DeferredUntilUnlock.Admission.Refused -> throw deviceLocked("keep another person write")
            }
        }
        if (!enabled) return
        if (closed.get()) throw clientShutDown()
        val profile = ProfileAttributes(validatedTraits(attributes), email, name)
        val email = profile.email
        val name = profile.name
        val requested = profile.traits
        awaitHeldCalls()
        awaitWarmWhileLive()
        val distinctId = identityStore.getDistinctId()
        val revoked = queueingAdDataSharingRevocation(requested, distinctId)
        if (revoked.isEmpty() && requested.isNotEmpty() && email == null && name == null) return
        val traits = consentedTraits(revoked)
        if (traits.isEmpty() && email == null && name == null) return
        if (traits[AD_DATA_SHARING_TRAIT] == true) personWrites.cancelAdDataSharingRevocation(distinctId)
        val write = PersonWrite(kind = PersonWriteKind.TRAITS, distinctId = distinctId, traits = traits, email = email, name = name)
        withContext(NonCancellable) { personWrites.enqueue(write) }
        scope.launch { runQuietly("drain the person writes") { drainOutbox() } }
    }

    /**
     * Records whether the end user agreed to you sharing their purchases with ad platforms, as the
     * person trait `$ad_data_sharing`. Voidhash sends a person's purchases to a Conversions API you
     * turned on only when it is `true`.
     *
     * `true` needs analytics consent: while it is not granted the agreement is not written, the
     * call reports [WriteStatus.SKIPPED], and one still queued is dropped
     * when consent is withdrawn. When it is written, it also drops a revocation still queued for
     * the person.
     *
     * `false` is a revocation, which analytics consent neither blocks nor discards: it is on disk
     * when this returns, reported as [WriteStatus.DEFERRED], and sent and retried in the background
     * until Voidhash has written it, or for 48 hours while Voidhash has no such person. It records no
     * analytics. Withdrawing analytics consent does not take the agreement back by itself, so when
     * someone rejects everything, call this next to [setAnalyticsConsent].
     *
     * [setPersonAttributesWithStatus] treats `$ad_data_sharing` the same way.
     */
    suspend fun setAdDataSharing(granted: Boolean): PersonWriteResult =
        setPersonAttributesWithStatus(mapOf(AD_DATA_SHARING_TRAIT to granted))

    /**
     * Person attributes as the API takes them: the attributes `email` and `name` with a string
     * value are the person's profile fields, sent as the request's own `email` and `name`, and the
     * rest are [traits]. An [email] or [name] given beside the attributes wins over the one in them.
     * Any other value under those two keys stays a trait.
     */
    private class ProfileAttributes(attributes: Map<String, Any?>, email: String?, name: String?) {
        val email: String? = email ?: attributes["email"] as? String
        val name: String? = name ?: attributes["name"] as? String
        val traits: Map<String, Any?> = attributes.filterNot { (key, value) ->
            (key == "email" || key == "name") && value is String
        }
    }

    /**
     * [traits] without what analytics consent holds back: unless it is granted, an agreement to
     * ad data sharing. Every other trait is written whatever the consent.
     */
    private fun consentedTraits(traits: Map<String, Any?>): Map<String, Any?> =
        if (AD_DATA_SHARING_TRAIT in traits && traits[AD_DATA_SHARING_TRAIT] != false && !consentStore.isGranted) {
            traits - AD_DATA_SHARING_TRAIT
        } else {
            traits
        }

    /**
     * Queues the revocation [traits] asks for, if any, and returns what else they ask for.
     * Consent never holds a revocation back.
     */
    private suspend fun queueingAdDataSharingRevocation(
        traits: Map<String, Any?>,
        distinctId: String,
    ): Map<String, Any?> {
        if (traits[AD_DATA_SHARING_TRAIT] != false) return traits
        withContext(NonCancellable) { personWrites.enqueueAdDataSharingRevocation(distinctId) }
        // Joins a drain in flight, which took its snapshot before this: with the app backgrounded,
        // no timer would come back for it.
        scope.launch { runQuietly("drain the person writes") { drainOutbox(joinRunning = true) } }
        return traits - AD_DATA_SHARING_TRAIT
    }

    /** [attributes] as traits: flat values only (`INVALID_ARGUMENT` otherwise), non-finite numbers as `null`. */
    private fun validatedTraits(attributes: Map<String, Any?>): Map<String, Any?> {
        val nested = attributes.filterValues { !isScalarTraitValue(it) }.keys
        if (nested.isNotEmpty()) {
            throw VoidhashException(
                "INVALID_ARGUMENT",
                "Person traits must be strings, numbers, booleans or null: ${nested.joinToString()} " +
                    "is not",
            )
        }
        return attributes.mapValues { (_, value) ->
            value.takeUnless { it is Double && !it.isFinite() || it is Float && !it.isFinite() }
        }
    }

    /**
     * Hands a settled direct send's key back to the drain. One that [delivered] proved the API
     * reachable, so what queued behind it while it held the line is drained now rather than on
     * the next timer tick.
     */
    private fun endDirectSend(write: PersonWrite, delivered: Boolean) {
        // Only a direct send of the same key shares a settled outcome; after the last, none will.
        if (personWrites.endDirectSend(write)) settledWrites.remove(write.key)
        if (delivered && !closed.get() && outboxWorkDue()) {
            scope.launch { runQuietly("drain the writes queued behind a direct send") { drainOutbox() } }
        }
    }

    /** The reason a person write was refused, as `PERSON_WRITE_REJECTED` reports it. */
    private fun refusalReason(error: Throwable): String =
        if (error is VoidhashApiException) "HTTP ${error.status}: ${error.description}" else error.message.orEmpty()

    /**
     * Starts over as a fresh visitor. For a signed-in user this is exactly [signOut]. While nobody
     * is signed in, where [signOut] does nothing, it replaces the anonymous id, takes the visitor
     * out of their groups and starts a new analytics session, recording and sending nothing: for
     * a shared device, a guest who starts over, and tests.
     */
    suspend fun reset() {
        switchToAnonymous(signOut = false)
    }

    /**
     * [signOut] when [signOut] is set, else [reset], returning the distinct id in effect afterwards.
     *
     * A signed-in user is signed out either way: `$sign_out` is captured for the identity, session
     * and groups being left, when analytics consent is granted; a consent an identify granted is
     * flushed for, for at most two seconds, and returned to [AnalyticsConsent.PENDING]; then the
     * identity is replaced by a fresh anonymous id, with its groups and cached state forgotten, and
     * a new analytics session starts. The two differ for an anonymous id: [signOut] leaves it
     * alone, and otherwise it is replaced like that without `$sign_out` or a flush.
     */
    internal suspend fun switchToAnonymous(signOut: Boolean): String {
        if (untilUnlock != null) {
            // Never refused: a sign-out that got lost would leave the user it ends signed in.
            val admission = untilUnlock.admit(always = true) { it.switchToAnonymous(signOut) }
            return if (admission is DeferredUntilUnlock.Admission.Live) {
                admission.client.switchToAnonymous(signOut)
            } else {
                identityStore.getDistinctId()
            }
        }
        if (!enabled) return identityStore.getDistinctId()
        // The identity lives in storage the live client shares; a replaced client must not
        // change it behind that client's back.
        if (closed.get()) throw clientShutDown()
        awaitHeldCalls()
        val flushQueued = identityMutex.withLock {
            awaitWarmWhileLive()
            adoptPinnedDistinctId()
            val signedIn = !identityStore.isAnonymous()
            if (signOut && !signedIn) return identityStore.getDistinctId()
            // Only with consent: held for a pending one, it would be recorded after a later
            // grant, for the visitor that follows the user it is about.
            if (signedIn && consentStore.isGranted) {
                enableAnalyticsCapture()
                captureAutomaticEvent(AutomaticEvents.SIGN_OUT)
            }
            // What was recorded while signed in is sent before the implied consent is taken back,
            // which discards the queue.
            signedIn && consentStore.isImplied
        }
        if (flushQueued) flush()
        return identityMutex.withLock {
            awaitWarmWhileLive()
            adoptPinnedDistinctId()
            val previousDistinctId = identityStore.getDistinctId()
            if (consentStore.isImplied) applyAnalyticsConsent(AnalyticsConsent.PENDING, implied = false)
            enableAnalyticsCapture()
            identityEpoch.incrementAndGet()
            identityStore.forgetDistinctId()
            invalidateIdentityState(previousDistinctId)
            reloadFlagState()
            // As after a new configure, the next identity's requests try a rejected key again.
            gate?.resumeAuth()
            if (consentStore.isGranted) sessionManager.rotate() else sessionManager.discard()
            val distinctId = identityStore.getDistinctId()
            adoptIdentity(previousDistinctId, distinctId)
            distinctId
        }
    }

    /**
     * Signs the user out: captures `$sign_out` for them, when analytics consent is granted, then
     * starts a fresh anonymous identity and analytics session and forgets their groups. Does
     * nothing while nobody is signed in, that is while the distinct id is an anonymous one: no
     * event, no new id, and the groups are kept. [reset] starts a fresh visitor then.
     *
     * When an identify granted the analytics consent ([VoidhashOptions.grantConsentOnIdentify]),
     * what is queued is sent first, for at most two seconds, and the consent then returns to
     * [AnalyticsConsent.PENDING]. Otherwise it never waits on the network.
     */
    suspend fun signOut() {
        switchToAnonymous(signOut = true)
    }

    /**
     * Rejects a distinct id the API refuses every request for: a programmer error, never retried
     * or queued.
     */
    private fun requireDistinctId(distinctId: String, argument: String = "distinctId") {
        val reason = invalidDistinctIdReason(distinctId) ?: return
        throw VoidhashException("INVALID_ARGUMENT", "$argument $reason")
    }

    /** [requireDistinctId] for an identify target, which the API also refuses to be anonymous. */
    private fun requireIdentifyTarget(externalUserId: String) {
        requireDistinctId(externalUserId, "externalUserId")
        if (isAnonymousDistinctId(externalUserId)) {
            throw VoidhashException(
                "INVALID_ARGUMENT",
                "externalUserId must not start with $ANONYMOUS_DISTINCT_ID_PREFIX or " +
                    "$LEGACY_ANONYMOUS_DISTINCT_ID_PREFIX, which mark the SDK's anonymous ids",
            )
        }
    }

    private fun cachedPerson(distinctId: String): VoidhashPerson? =
        cacheManager.getObject(personCacheKey(distinctId))?.let { hit ->
            decodeCachedPerson(distinctId, hit.value)?.value
        }

    /** Decodes a cached person entry; a remembered "no person" decodes to `null`. */
    private fun decodeCachedPerson(distinctId: String, raw: JSONObject): Decoded<VoidhashPerson?>? =
        if (isNoPersonEntry(raw)) {
            Decoded(null)
        } else {
            decodeCached(personCacheKey(distinctId), raw, VoidhashPerson::fromJson)
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
                message = "Discarded an undecodable ${key.substringBefore(':')} cache entry: ${error.message}",
            )
            cacheManager.delete(key)
            null
        }

    /** Drops every per-identity cache entry belonging to [distinctId]. */
    private fun invalidateIdentityState(distinctId: String) {
        cacheManager.delete(personCacheKey(distinctId))
        cacheManager.deleteByPrefix("flags:$distinctId:")
        cacheManager.deleteByPrefix("paywall:$distinctId:")
        cacheManager.deleteByPrefix("flow-state:$distinctId:")
    }

    /**
     * Evaluates feature flags; an empty [keys] list evaluates every flag.
     *
     * Results are cached per identity for five minutes and served past that indefinitely, so
     * an offline launch still gates features the way the last online session did. With nothing
     * cached the read waits at most [FeatureFlagOptions.maxWaitMs] (2 s) and then answers without
     * an evaluation, flagged expired; the evaluation carries on and lands in [featureFlags]. A
     * requested key without an evaluated value is answered from [FeatureFlagOptions.defaults]
     * when it has an entry there.
     */
    suspend fun getFeatureFlags(keys: List<String> = emptyList()): List<FeatureFlag> =
        getFeatureFlagsState(keys).value

    /** [getFeatureFlags] with the freshness of the returned evaluation attached. */
    suspend fun getFeatureFlagsState(keys: List<String> = emptyList()): Stale<List<FeatureFlag>> {
        val read = readFlags(keys)
        return Stale(read.flags, read.isStale, read.isExpired)
    }

    /** A flag read with the identity and generation it was made under. */
    internal class FlagsRead(val state: FlagsState, val isExpired: Boolean) {
        val flags: List<FeatureFlag> get() = state.flags
        val isStale: Boolean get() = state.isStale
    }

    /**
     * [getFeatureFlagsState] for a host: every flag when [keys] is empty, also reported as `null`.
     * [surfaceAuthFailure] as for [readPerson].
     */
    internal suspend fun readFlags(keys: List<String>, surfaceAuthFailure: Boolean = false): FlagsRead {
        takenOverBy?.let { return it.readFlags(keys, surfaceAuthFailure) }
        if (!enabled) {
            // Before the first unlock nothing was evaluated: the defaults answer, flagged as no evaluation.
            val locked = untilUnlock != null
            return FlagsRead(
                FlagsState(identityStore.getDistinctId(), identityGeneration, keys.ifEmpty { null }, withDefaults(emptyList(), keys), locked),
                isExpired = locked,
            )
        }

        cacheManager.awaitWarm()
        val generation = identityGeneration
        val epoch = identityEpoch.get()
        val distinctId = identityStore.getDistinctId()
        val cacheKey = flagsCacheKey(distinctId, keys)
        val exact = cacheManager.getArray(cacheKey)
        val cached = exact ?: if (keys.isNotEmpty()) {
            cacheManager.getArray(flagsCacheKey(distinctId, emptyList()))
        } else null
        val cachedFlags = cached?.value?.let(::decodeFlags)?.let { flags ->
            if (exact == null && keys.isNotEmpty()) flags.filter { it.key in keys } else flags
        }

        val state = readThrough(
            key = cacheKey,
            cached = cachedFlags,
            isStale = cached?.isStale != false,
            isExpired = cached?.isExpired == true,
            coldWaitMs = featureFlagOptions.maxWaitMs.coerceAtLeast(0L),
        ) { refreshFlags(distinctId, keys) }
            .value
        if (surfaceAuthFailure) surfaceAuthenticationFailure(answeredWithNothing = state.value == null)

        // An evaluation served from the cache counts as the latest too, so `isFeatureEnabled` and
        // `featureFlags` agree with what this read answered, unless an identity switch reloaded
        // them for the next identity meanwhile.
        state.value?.let { flags ->
            identityMutex.withLock { if (isCurrentIdentity(distinctId, epoch)) publishFlags(keys, flags) }
        }
        return FlagsRead(
            FlagsState(distinctId, generation, keys.ifEmpty { null }, withDefaults(state.value ?: emptyList(), keys), state.isStale),
            state.isExpired,
        )
    }

    /**
     * Makes [flags], the evaluation of [keys] (every flag when empty), the latest in [featureFlags].
     * Call with [identityMutex] held, once [isCurrentIdentity] confirmed the evaluation is the
     * identity in effect's: every switch reloads the flags under that lock, so none comes between
     * the check and this.
     */
    private fun publishFlags(keys: List<String>, flags: List<FeatureFlag>) {
        flagState.update { current -> if (keys.isEmpty()) flags else current.filterNot { it.key in keys } + flags }
    }

    /** [evaluated] plus the default of each of [keys] that has a default and no evaluated value. */
    private fun withDefaults(evaluated: List<FeatureFlag>, keys: List<String>): List<FeatureFlag> =
        evaluated + keys.distinct().mapNotNull { key ->
            val default = featureFlagOptions.defaults[key]
            if (default == null || evaluated.any { it.key == key }) null else FeatureFlag(key, default, null)
        }

    /**
     * Evaluates [keys] (every flag when empty) for [distinctId], then caches, publishes and
     * announces the evaluation unless the identity switched while it was under way: a sign-out or
     * an identify meanwhile owns the cache, [featureFlags] and the generation of the identity now
     * in effect. Checked and published under [identityMutex], as [cachePersonIfCurrent] does for
     * the person, so an evaluation that arrives as the identity switches is never the next
     * identity's, nor cached after the switch dropped this one's.
     */
    private suspend fun refreshFlags(distinctId: String, keys: List<String>): List<FeatureFlag> {
        val epoch = identityEpoch.get()
        val flags = apiClient.evaluateFlags(distinctId, keys)
        identityMutex.withLock {
            if (!isCurrentIdentity(distinctId, epoch)) return@withLock
            cacheManager.set(
                flagsCacheKey(distinctId, keys),
                encodeFlags(flags),
                staleTimeMs = FLAGS_CACHE_STALE_TIME_MS,
            )
            publishFlags(keys, flags)
            announce(ClientEvent.Flags(FlagsState(distinctId, identityGeneration, keys.ifEmpty { null }, flags, false)))
        }
        return flags
    }

    /**
     * Points [featureFlags] at the current identity's cached full evaluation; empty when it has
     * none. Called once storage has loaded and on every identity change; never mints an
     * identity, which is `initialize`'s to do.
     */
    private fun reloadFlagState() {
        val distinctId = identityStore.pinnedDistinctId ?: identityStore.storedDistinctId()
        val cached = distinctId?.let { cacheManager.getArray(flagsCacheKey(it, emptyList())) }
        flagState.value = cached?.value?.let(::decodeFlags).orEmpty()
    }

    /**
     * Queues an analytics event. The name is trimmed; a blank one is ignored and reported as
     * `ANALYTICS_EVENT_INVALID`. Does nothing unless analytics consent is granted.
     */
    fun capture(name: String, properties: Map<String, Any?> = emptyMap()) {
        capture(name, properties, sdkClock.now())
    }

    /**
     * Reports that the end user opened a notification, as `$push_opened` naming its send. Call it
     * with the data of a notification your app shows or handles itself, such as
     * `RemoteMessage.data`. The SDK does not extend your messaging service or replace your
     * activities, so it never sees a notification on its own.
     *
     * A notification not sent through Voidhash is ignored, and so is one reported again right after
     * its first report. Does nothing unless analytics consent is granted.
     */
    fun trackPushOpened(data: Map<String, *>?) {
        reportPushOpened(data?.get(PUSH_SEND_ID_DATA_KEY) as? String)
    }

    /**
     * [trackPushOpened] for a notification Android showed itself: tapping one starts your launcher
     * activity with the notification's data as `intent.extras`.
     */
    fun trackPushOpened(extras: Bundle?) {
        // Extras can come from any app that starts the activity, and reading them unpacks them all.
        val sendId = try {
            extras?.getString(PUSH_SEND_ID_DATA_KEY)
        } catch (error: RuntimeException) {
            onWarning("Failed to read an opened notification: ${error.message}")
            null
        }
        reportPushOpened(sendId)
    }

    private fun reportPushOpened(sendId: String?) {
        if (sendId.isNullOrBlank()) return
        // Recreating an activity reads the same intent again.
        if (lastPushOpenedSendId.getAndSet(sendId) == sendId) return
        capture(AutomaticEvents.PUSH_OPENED, mapOf(PUSH_SEND_ID_PROPERTY to sendId))
    }

    /** [capture] for an event made at [capturedAt] (epoch millis) that a host held back until now. */
    internal fun capture(name: String, properties: Map<String, Any?>, capturedAt: Long) {
        captureIfCollected(name, properties, capturedAt, reportDenied = true)
    }

    /** Whether a capture made now is held in memory until the end user decides on analytics. */
    private fun heldWhilePending(): Boolean =
        analyticsWhilePending == PendingAnalytics.BUFFER && consentStore.current == AnalyticsConsent.PENDING

    /**
     * [capture], answering whether the event was taken: queued, or held in memory to be queued
     * once the storage has loaded or the pending consent is granted. `false` when it was skipped
     * for lack of consent, or by a client that does not run. [reportDenied] is set for an event
     * the app asked for, whose skipping for lack of consent it is told about; the SDK's own
     * events are skipped silently.
     */
    private fun captureIfCollected(
        name: String,
        properties: Map<String, Any?>,
        capturedAt: Long,
        reportDenied: Boolean = false,
    ): Boolean {
        if (!enabled) {
            if (untilUnlock != null) {
                val copied = properties.toMap()
                untilUnlock.holdEvent { it.capture(name, copied, capturedAt) }?.capture(name, properties, capturedAt)
            }
            return false
        }
        // A replaced client's queue file belongs to its successor now.
        if (closed.get()) return false
        // Under the lock [setAnalyticsConsent] changes the consent under, so a capture racing it is
        // either refused or discarded with the rest of the queue, and one held for a pending
        // consent is never left behind by the decision.
        synchronized(pendingAnalyticsLock) {
            val whilePending = heldWhilePending()
            if (!whilePending && !consentStore.isGranted) {
                if (reportDenied) reportConsentDenied("analytics.capture")
                return false
            }
            // Until the cache has loaded, the identity to attribute the event to is unknown.
            if (whilePending || (!analyticsCaptureReady && !cacheManager.isWarm)) {
                pendingAnalytics.addLast(PendingAnalyticsCapture(name, properties.toMap(), capturedAt))
                if (pendingAnalytics.size > PRE_INIT_ANALYTICS_BUFFER_CAP) {
                    val dropped = pendingAnalytics.removeFirst()
                    forgetGroupDigestsOf(listOf(dropped))
                    if (whilePending) {
                        // Reported once, with the count, when the end user decides.
                        droppedWhilePending++
                    } else {
                        diagnostics.emit(
                            VoidhashDiagnosticKind.EVICTION,
                            code = "ANALYTICS_EVENT_DROPPED",
                            operation = "analytics.capture",
                            message = "Dropped ${dropped.name}: the analytics buffer used while the SDK's " +
                                "storage loads is full",
                        )
                    }
                }
                return true
            }
            enableAnalyticsCapture(now = capturedAt)
            analyticsClient.capture(name, properties, scope, capturedAt = capturedAt, sendWhenFull = initialized)
            return true
        }
    }

    /**
     * Starts handing captures to the analytics queue, once the cache holds the persisted
     * identity. `$app_installed` or `$app_updated` goes first, stamped at [now] or at the
     * earliest capture held until then, whichever came first, followed by those captures with
     * the times they were made: the release event leads the stream in order and in time. Runs
     * once.
     *
     * Until [initialize] a full batch is not sent from the capture path: the client makes no
     * requests of its own before it is initialized.
     *
     * Unless analytics consent is granted the held captures are dropped and nothing else
     * happens: the release is neither captured nor recorded, so the check runs once consent is
     * granted. Captures held for a pending consent ([PendingAnalytics.BUFFER]) stay held.
     */
    private fun enableAnalyticsCapture(now: Long = sdkClock.now()) {
        synchronized(pendingAnalyticsLock) {
            if (analyticsCaptureReady) return
            if (!consentStore.isGranted) {
                if (!heldWhilePending()) discardHeldCaptures()
                return
            }
            resolveAppReleaseEvent()?.let { releaseEvent ->
                val stampedAt = minOf(now, pendingAnalytics.minOfOrNull { it.capturedAt } ?: now)
                analyticsClient.capture(
                    releaseEvent,
                    emptyMap(),
                    scope,
                    capturedAt = stampedAt,
                    sendWhenFull = initialized,
                )
            }
            for (held in pendingAnalytics) {
                analyticsClient.capture(
                    held.name,
                    held.properties,
                    scope,
                    capturedAt = held.capturedAt,
                    sendWhenFull = initialized,
                )
            }
            pendingAnalytics.clear()
            reportDroppedWhilePending()
            analyticsCaptureReady = true
        }
    }

    /**
     * Captures a `$screen` for a screen the SDK cannot see on its own (custom
     * navigation, onboarding steps, pager pages). Every call is a new arrival,
     * so calling it twice with the same [name] emits twice. The name is trimmed; a blank one
     * is ignored and reported as `ANALYTICS_EVENT_INVALID`.
     */
    fun screen(name: String, properties: Map<String, Any?> = emptyMap()) {
        screen(name, properties, sdkClock.now())
    }

    /** [screen] for a screen the user arrived at at [capturedAt] (epoch millis). */
    internal fun screen(name: String, properties: Map<String, Any?>, capturedAt: Long) {
        if (untilUnlock != null) {
            // Held like a capture, with the time of the arrival, and recorded once the device is unlocked.
            val copied = properties.toMap()
            untilUnlock.holdEvent { it.screen(name, copied, capturedAt) }?.screen(name, properties, capturedAt)
            return
        }
        if (!enabled) return
        val screenName = name.trim()
        if (screenName.isEmpty()) {
            diagnostics.emit(
                VoidhashDiagnosticKind.EVICTION,
                code = "ANALYTICS_EVENT_INVALID",
                operation = "analytics.screen",
                message = "Ignored a screen with a blank name",
            )
            onWarning("Ignored a screen with a blank name")
            return
        }
        trackScreen(
            ScreenView(
                identity = "manual:$screenName#${manualScreenCounter.incrementAndGet()}",
                name = screenName,
                path = screenName,
                source = ScreenSources.MANUAL,
            ),
            properties,
            capturedAt,
        )
    }

    /**
     * Delivers everything queued: person writes, then store receipts, then analytics events, and
     * returns once each was tried. An open circuit is half-opened first, and a paused key is
     * probed when its minute has passed, so a flush after an outage does not wait on a timer.
     *
     * Returns after at most 2 s, while delivery carries on in the background: a status with
     * `lastError` "Delivery is still in progress" counts nothing as flushed yet. After an outage
     * one flush sends at most ten batches of events; the rest follow every five seconds.
     *
     * Never throws: transport failure leaves the data queued and is reported through the
     * returned status instead.
     */
    suspend fun flush(): FlushStatus {
        takenOverBy?.let { return it.flush() }
        if (untilUnlock != null) {
            return FlushStatus(
                flushed = 0,
                pending = untilUnlock.pendingCaptures,
                lastError = "The device has not been unlocked since it started; nothing is sent until it is",
            )
        }
        if (!enabled || closed.get()) return FlushStatus(flushed = 0, pending = 0)
        gate?.onNetworkChanged()
        val delivery = scope.async {
            probeAuthenticationIfDue()
            deliverQueued()
        }
        return delivery.awaitWithin(DELIVERY_WAIT_MS) ?: FlushStatus(
            flushed = 0,
            pending = analyticsClient.queueLength,
            lastError = "Delivery is still in progress",
        )
    }

    /** Drains person writes and receipts, then flushes analytics; reports the analytics outcome. */
    private suspend fun deliverQueued(): FlushStatus {
        runQuietly("deliver queued person writes and receipts") { drainOutbox(joinRunning = true) }
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

    /**
     * The distinct id requests are made as. Returns the `distinctId` option at once when one was
     * configured. Otherwise, called before [initialize] on a device's first launch with this SDK,
     * it may wait briefly for the SDK's storage to load, so that it never answers with an id the
     * stored one then replaces.
     */
    fun getDistinctId(): String = takenOverBy?.getDistinctId() ?: identityStore.getDistinctId()

    /**
     * Puts the end user in a group, such as the company or workspace they use your app as part
     * of. Every later event carries it in `$groups`, until [setGroups] leaves it out, [resetGroups],
     * [reset] or a [signOut] of a signed-in user;
     * it is stored on the device with the distinct id, one group per type.
     *
     * [properties] set the group's own properties, such as its `name` and `plan`: strings,
     * numbers or booleans, other values are left out with a warning. They are sent as a
     * `$groupidentify` event when given, or when the end user's group of that type changed, so
     * the group is known before any other event names it. A group is what your app says about
     * the end user, so it is described whatever the analytics consent: while consent is not
     * granted the event is sent at once on its own, with nothing but the group in it, instead of
     * through the analytics queue, and is not retried if that request fails.
     *
     * A group [type] is a lower-case letter followed by up to 63 lower-case letters, digits or
     * underscores, such as `company`, and a [key] has 1 to 256 characters. A call with any other
     * is ignored with a warning.
     *
     * Applies before it returns, in order with [identify], [reset] and [signOut] made before it:
     * an event captured next carries the group. Made before the device was first unlocked, it is
     * held and applied in its place once the SDK's storage can be read.
     */
    @JvmOverloads
    fun group(type: String, key: String, properties: Map<String, Any?>? = null) {
        invalidGroupReason(type, key)?.let { reason ->
            onWarning("Ignoring group(\"$type\"): $reason")
            return
        }
        val calledAt = sdkClock.now()
        val copied = properties?.toMap()
        // Made directly on the client that took over while the calls held before the unlock are
        // still being made on it, it takes its place behind them: a sign-out replayed after it
        // must not take the user out of the group again.
        inherited?.takeUnless { it.isDrained }?.let { pending ->
            val admission = pending.admit(always = true) { it.groupInOrder(type, key, copied, calledAt) }
            if (admission is DeferredUntilUnlock.Admission.Held) return
        }
        groupInOrder(type, key, copied, calledAt)
    }

    /** [group] once it is this call's turn among those held before the unlock. */
    internal fun groupInOrder(type: String, key: String, properties: Map<String, Any?>?, calledAt: Long) {
        if (untilUnlock != null) {
            // Never refused: a lost group would leave every later event without it.
            val admission = untilUnlock.admit(always = true) { it.groupInOrder(type, key, properties, calledAt) }
            if (admission is DeferredUntilUnlock.Admission.Live) {
                admission.client.groupInOrder(type, key, properties, calledAt)
            }
            return
        }
        replacementClient()?.let { return it.group(type, key, properties) }
        if (!enabled || closed.get()) return
        val groupSet = properties?.let { groupProperties(it, type) }
        synchronized(groupsLock) {
            groupChanges++
            val changed = identityStore.setGroup(type, key)
            if (!changed && groupSet == null) return
            describeGroup(
                buildMap {
                    put("\$group_type", type)
                    put("\$group_key", key)
                    groupSet?.let { put("\$group_set", it) }
                },
                calledAt,
            )
        }
    }

    /**
     * Makes [groups], by group type, the whole set of groups the end user belongs to: a type
     * that is missing from it, or `null`, is one they are no longer in. An empty map takes them
     * out of every group, as [resetGroups] does.
     *
     * A group is described to Voidhash with a `$groupidentify` event only when there is something
     * new to say: its id differs from the one held for its type, or its properties differ from
     * the ones this method last sent for it. So the same call made again sends nothing, and an app
     * can call it whenever it learns the user's groups. Groups are described whatever the
     * analytics consent, as [group] does; a description sent without consent that did not reach
     * Voidhash is sent again by the next call. Leaving a group sends nothing.
     *
     * Types and ids follow the rules of [group], and an entry that breaks them is left out with
     * a warning. Ordered, and held before the first unlock, as [group] is.
     */
    fun setGroups(groups: Map<String, VoidhashGroup?>) {
        val calledAt = sdkClock.now()
        val copied = buildMap {
            for ((type, group) in groups) if (group != null) put(type, group.copy(properties = group.properties.toMap()))
        }
        inherited?.takeUnless { it.isDrained }?.let { pending ->
            val admission = pending.admit(always = true) { it.setGroupsInOrder(copied, calledAt) }
            if (admission is DeferredUntilUnlock.Admission.Held) return
        }
        setGroupsInOrder(copied, calledAt)
    }

    /** [setGroups] once it is this call's turn among those held before the unlock. */
    internal fun setGroupsInOrder(groups: Map<String, VoidhashGroup>, calledAt: Long) {
        if (untilUnlock != null) {
            val admission = untilUnlock.admit(always = true) { it.setGroupsInOrder(groups, calledAt) }
            if (admission is DeferredUntilUnlock.Admission.Live) admission.client.setGroupsInOrder(groups, calledAt)
            return
        }
        replacementClient()?.let { return it.setGroups(groups) }
        if (!enabled || closed.get()) return
        val accepted = groups.filter { (type, group) ->
            val reason = invalidGroupReason(type, group.id)
            if (reason != null) onWarning("Ignoring the group \"$type\" in setGroups: $reason")
            reason == null
        }
        synchronized(groupsLock) {
            val held = identityStore.groups
            val sentBefore = identityStore.groupDigests
            val invalidations = synchronized(pendingAnalyticsLock) { groupDigestInvalidations }
            val change = ++groupChanges
            identityStore.replaceGroups(accepted.mapValues { (_, group) -> group.id })
            val sent = mutableMapOf<String, String>()
            // In order of group type, whatever the order of the map.
            for ((type, group) in accepted.toSortedMap()) {
                val groupSet = groupProperties(group.properties, type)
                val digest = groupPropertiesDigest(groupSet)
                val described = held[type] == group.id && sentBefore[type] == digest
                // A description sent without consent leaves its digest only once the request
                // succeeded, so the next call sends one that failed again.
                if (described || describeGroup(
                        buildMap {
                            put("\$group_type", type)
                            put("\$group_key", group.id)
                            if (groupSet.isNotEmpty()) put("\$group_set", groupSet)
                        },
                        calledAt,
                        onSent = {
                            synchronized(groupsLock) {
                                if (groupChanges == change && identityStore.groups[type] == group.id) {
                                    identityStore.setGroupDigests(identityStore.groupDigests + (type to digest))
                                }
                            }
                        },
                    )
                ) {
                    sent[type] = digest
                }
            }
            synchronized(pendingAnalyticsLock) {
                // Held captures describing a group were dropped meanwhile, and which is not known.
                identityStore.setGroupDigests(if (groupDigestInvalidations == invalidations) sent else emptyMap())
            }
        }
    }

    /**
     * Takes the end user out of every group; later events carry no `$groups`. Ordered and held
     * before the first unlock as [group] is.
     */
    fun resetGroups() {
        inherited?.takeUnless { it.isDrained }?.let { pending ->
            val admission = pending.admit(always = true) { it.resetGroupsInOrder() }
            if (admission is DeferredUntilUnlock.Admission.Held) return
        }
        resetGroupsInOrder()
    }

    /** [resetGroups] once it is this call's turn among those held before the unlock. */
    internal fun resetGroupsInOrder() {
        if (untilUnlock != null) {
            val admission = untilUnlock.admit(always = true) { it.resetGroupsInOrder() }
            if (admission is DeferredUntilUnlock.Admission.Live) admission.client.resetGroupsInOrder()
            return
        }
        replacementClient()?.let { return it.resetGroups() }
        if (!enabled || closed.get()) return
        synchronized(groupsLock) {
            groupChanges++
            identityStore.resetGroups()
        }
    }

    /**
     * The groups the end user belongs to, by group type, as [group] and [setGroups] set them. Empty when they
     * belong to none, on a disabled client, and before the device was first unlocked.
     */
    val groups: Map<String, String>
        get() = takenOverBy?.groups ?: if (enabled) identityStore.groups else emptyMap()

    /** The flat values of a group's [properties], which a group can keep; the rest is left out with a warning. */
    private fun groupProperties(properties: Map<String, Any?>, type: String): Map<String, Any?> {
        val kept = properties.filterValues { value ->
            value is String || value is Boolean ||
                (value is Number && (value !is Double || value.isFinite()) && (value !is Float || value.isFinite()))
        }
        if (kept.size < properties.size) {
            val left = (properties.keys - kept.keys).sorted().joinToString()
            onWarning(
                "Leaving out the group properties $left of group type \"$type\": a group property is a " +
                    "string, a number or a boolean",
            )
        }
        return kept
    }

    /**
     * Switches observer mode. In observer mode transactions are still synced to
     * the backend but never finished with the store — the host app owns that.
     */
    fun setReadOnly(readOnly: Boolean) {
        // Kept here too: set before the device was unlocked, it is what the successor starts with.
        readOnlyFlag.set(readOnly)
        takenOverBy?.setReadOnly(readOnly)
    }

    /**
     * Records the end user's consent to usage analytics and stores it on the device, where it
     * wins over [VoidhashOptions.analyticsConsent] on every later launch. [reset] and [signOut]
     * keep it. It also makes the app's decision of a consent an identify granted
     * ([VoidhashOptions.grantConsentOnIdentify]), which [reset] and [signOut] then keep too.
     *
     * Takes effect before this returns. Withdrawing consent ([AnalyticsConsent.DENIED] or
     * [AnalyticsConsent.PENDING]) deletes the analytics events queued on the device, and an
     * agreement to ad data sharing still queued, cancels a send in flight and drops the analytics
     * session; from then on events, screens and lifecycle events are not collected, and requests to Voidhash
     * carry the consent. Granting it starts collecting again; nothing from the time without
     * consent is sent, except the events [PendingAnalytics.BUFFER] held while it was pending,
     * which are recorded first; [AnalyticsConsent.DENIED] discards those. Purchases, entitlements,
     * flags, paywalls, [identify], person attributes, groups and taking the agreement
     * to ad data sharing back through [setAdDataSharing] are unaffected.
     *
     * A client replaced by a later `configure` hands the call to the client that replaced it.
     */
    fun setAnalyticsConsent(consent: AnalyticsConsent) {
        // Made directly on the client that took over while the calls held before the unlock are
        // still being made on it, it takes its place behind them: an older consent replayed after
        // it must not undo it. This function cannot wait, so it queues.
        inherited?.takeUnless { it.isDrained }?.let { pending ->
            val admission = pending.admit(always = true) { it.setAnalyticsConsentInOrder(consent) }
            if (admission is DeferredUntilUnlock.Admission.Held) return
        }
        setAnalyticsConsentInOrder(consent)
    }

    /** [setAnalyticsConsent] once it is this call's turn among those held before the unlock. */
    internal fun setAnalyticsConsentInOrder(consent: AnalyticsConsent) {
        if (untilUnlock != null) {
            // Held in its place among the captures and person writes around it, so the successor
            // discards and collects exactly what a client that could store it would have. Never
            // refused: a withdrawal must not get lost.
            val admission = untilUnlock.admit(always = true) { it.setAnalyticsConsentInOrder(consent) }
            if (admission is DeferredUntilUnlock.Admission.Live) return admission.client.setAnalyticsConsent(consent)
            // In memory, for `analyticsConsent` and the captures made until the unlock.
            consentStore.set(consent)
            return
        }
        replacementClient()?.let { return it.setAnalyticsConsent(consent) }
        if (closed.get()) return
        if (!enabled) {
            consentStore.set(consent)
            return
        }
        applyAnalyticsConsent(consent, implied = false)
    }

    /**
     * Puts [consent] in effect on a client that runs; [implied] marks a grant an identify made,
     * which [switchToAnonymous] takes back.
     */
    private fun applyAnalyticsConsent(consent: AnalyticsConsent, implied: Boolean) {
        val previous = synchronized(pendingAnalyticsLock) {
            // Flipped first, under the lock captures queue under: nothing captured from here on
            // reaches the queue that is about to be discarded.
            val previous = consentStore.set(consent, implied)
            if (consent == AnalyticsConsent.DENIED) discardHeldCaptures()
            if (consent != AnalyticsConsent.GRANTED && previous == AnalyticsConsent.GRANTED) {
                discardHeldCaptures()
                analyticsCaptureReady = false
                analyticsClient.discardQueued()
                sessionManager.discard()
                installAttributionJob?.cancel()
                installAttributionJob = null
            }
            previous
        }
        if (previous != consent) announce(ClientEvent.Consent(consent))
        if (consent == AnalyticsConsent.GRANTED) {
            consentDeniedReported.set(false)
            // A crash from the time without consent stays unreported, as anything else skipped
            // meanwhile does.
            if (previous != AnalyticsConsent.GRANTED && automaticLifecycleEvents) {
                rememberReportedCrashes(sdkClock.now())
            }
            // The release check left for this grant; before the warm-up the first capture or
            // `initialize` runs it.
            if (previous != AnalyticsConsent.GRANTED && cacheManager.isWarm) enableAnalyticsCapture()
            startInstallAttribution()
        } else if (previous == AnalyticsConsent.GRANTED) {
            personWrites.discardAdDataSharingAgreements()
        }
    }

    /**
     * Starts this launch's read of the store referrers on the client's scope, which never holds up
     * the caller and ends with the client. It waits for [initialize] and for analytics consent,
     * and, like the launch's refresh, for an activity: a process started in the background has no
     * user waiting on it.
     */
    private fun startInstallAttribution() {
        val attribution = installAttribution ?: return
        synchronized(pendingAnalyticsLock) {
            if (!initialized || closed.get() || !consentStore.isGranted || installAttributionJob != null) return
            installAttributionJob = scope.launch {
                foreground.first { it }
                try {
                    attributeInstall(attribution)
                } catch (error: CancellationException) {
                    throw error
                } catch (error: Throwable) {
                    // Whatever went wrong used up this launch's attempt: the app must be able to tell.
                    attribution.reportDeferred("Reading the store referrers failed: ${error.javaClass.simpleName}")
                }
            }
        }
    }

    /**
     * Reads the store referrers and queues the touch they carry for the current identity, an
     * anonymous one included, whose person a later [identify] merges. The install is settled only
     * once that touch is on disk: a process killed before then, or a withdrawal of consent, leaves
     * it for the next attempt.
     */
    private suspend fun attributeInstall(attribution: InstallAttribution) {
        if (!attribution.beginAttempt()) return
        when (val outcome = attribution.read()) {
            InstallAttributionOutcome.TryLater -> return
            InstallAttributionOutcome.NoTouch -> Unit
            is InstallAttributionOutcome.Touch -> {
                // A blocking read cannot see its cancellation; one withdrawn meanwhile and granted
                // again has a successor recording this touch.
                currentCoroutineContext().ensureActive()
                // Queued under the lock [setAnalyticsConsent] withdraws consent under.
                val queued = synchronized(pendingAnalyticsLock) {
                    val allowed = !closed.get() && consentStore.isGranted
                    if (allowed) {
                        analyticsClient.capture(
                            TOUCH_EVENT,
                            touchEventProperties(outcome.values),
                            scope,
                            capturedAt = null,
                            sendWhenFull = true,
                        )
                    }
                    allowed
                }
                if (!queued) return
                if (!analyticsClient.persistAndAwait()) {
                    attribution.reportDeferred("The touch could not be written to storage")
                    return
                }
            }
        }
        currentCoroutineContext().ensureActive()
        attribution.markDone()
    }

    /** Reports, once per period without consent, that analytics were not collected. */
    private fun reportConsentDenied(operation: String) {
        if (!consentDeniedReported.compareAndSet(false, true)) return
        diagnostics.emit(
            VoidhashDiagnosticKind.CONSENT,
            code = "ANALYTICS_CONSENT_DENIED",
            operation = operation,
            message = "Analytics consent is not granted; events are not collected",
        )
    }

    /**
     * Presents the flow assigned to [location] above [activity] and returns how it ended.
     *
     * [input] are the inputs the app passes the flow, by name: each a [String], a [Number] or a
     * [Boolean]; anything else is dropped with a warning. An input that is not passed keeps its
     * default. [actions] are the handlers of the app actions the flow may call, by name. A call
     * to an action without a handler, and a handler that throws, fail that call in the flow,
     * which then carries on as it was designed to; a debug build logs the missing handler.
     * Handlers still running when the flow ends are cancelled.
     *
     * [revision] is the revision of the location's interface the app was built against, so it is
     * shown only a flow it can answer. Left out, it is the location's entry in
     * [VoidhashOptions.flowRevisions], or 0 without one.
     *
     * The result says how the flow ended ([FlowResult.outcome]) and carries its outputs
     * ([FlowResult.output]) whichever way that was.
     *
     * A location with a cached configuration and package presents immediately, without waiting
     * on the API, which is what makes a flow work on a cold or offline start. Presenting a flow
     * while another is on screen closes that one, whose call returns the outcome
     * [FlowResult.DISMISSED]. So does [dismissFlow], from the moment this is called. Cancelling
     * the calling coroutine closes the flow too.
     *
     * @throws FlowException when the flow cannot be shown, or stops because it can no longer be
     *   drawn; [FlowException.reason] says why. A flow that is not on its way to the screen within
     *   15 seconds of this call, because its paywall is still being resolved or its package
     *   downloaded, is not shown any more: that is [FlowFailure.UNAVAILABLE], and what was being
     *   fetched is cached for the next call. Once shown, a flow stays for as long as the user takes.
     */
    suspend fun presentFlow(
        activity: Activity,
        location: String,
        revision: Int? = null,
        input: Map<String, Any> = emptyMap(),
        actions: Map<String, FlowActionHandler> = emptyMap(),
    ): FlowResult {
        takenOverBy?.let { return it.presentFlow(activity, location, revision, input, actions) }
        if (untilUnlock != null) {
            throw FlowException(
                FlowFailure.UNAVAILABLE,
                "The flow for \"$location\" cannot be shown before the device was unlocked for the first " +
                    "time since it started: the app's storage is not available yet",
            )
        }
        if (!enabled || closed.get()) {
            throw FlowException(FlowFailure.DISABLED, "Voidhash is disabled or was shut down")
        }
        val coordinator = flowCoordinator ?: throw FlowException(
            FlowFailure.RENDERER_MISSING,
            "No flow renderer is configured: add the Voidhash `ui` module and pass " +
                "VoidhashOptions(paywallRenderer = VoidhashUiPaywallRenderer())",
        )
        val interfaceRevision = (revision ?: flowRevisions[location] ?: 0).coerceAtLeast(0)
        // What a refresh of the location asks for from now on, when the options name no revision.
        presentedRevisions[location] = interfaceRevision

        // From here on `dismissFlow()` cancels the presentation, also while it is being resolved,
        // and its deadline runs.
        val presentation = coordinator.beginPresentation(location)
        try {
            // The refresh behind a read runs on the SDK's scope, so a dismissal or the deadline
            // ends only the wait.
            val resolved = (
                presentation.unlessEnded { resolvePaywallState(location, interfaceRevision) }
                    ?: return presentation.ending?.getOrThrow() ?: FlowResult(FlowResult.DISMISSED)
                ).value
            val paywall = resolved.value
            if (resolved.isStale) {
                val distinctId = identityStore.getDistinctId()
                scope.launch {
                    runQuietly("refresh the paywall for $location") {
                        refreshPaywall(distinctId, location, interfaceRevision)
                    }
                }
            }
            if (paywall == null) {
                // A cold failed read is unavailable. A fresh or cached negative answer means the
                // backend deliberately assigned no flow to this person.
                throw if (resolved.isStale && resolved.isExpired) {
                    FlowException(FlowFailure.UNAVAILABLE, "The flow for \"$location\" could not be resolved")
                } else {
                    FlowException(FlowFailure.NOT_ASSIGNED, "No flow is assigned to \"$location\"")
                }
            }

            // The store sheet of a purchase started from the flow launches from this activity.
            activitySink(activity)
            try {
                return coordinator.present(activity, location, paywall, presentation, input, actions)
            } finally {
                // A flow presented in this one's place keeps the activity it was presented from.
                if (!coordinator.isPresenting) activitySink(null)
            }
        } finally {
            presentation.close()
        }
    }

    /**
     * Presents the flow assigned to a typed [location] above [activity], as the untyped
     * [presentFlow] does, with the location's revision, and returns how it ended in the
     * location's types.
     *
     * @throws FlowException when the flow cannot be shown, or stops because it can no longer be
     *   drawn.
     */
    suspend fun <Input : FlowInput, Output, Outcome, Actions : FlowActions> presentFlow(
        activity: Activity,
        location: FlowLocation<Input, Output, Outcome, Actions>,
        input: Input,
        actions: Actions,
    ): TypedFlowResult<Output, Outcome> {
        val result = presentFlow(activity, location.slug, location.revision, input.toFlowValues(), actions.flowHandlers())
        return TypedFlowResult(location.outcome(result.outcome), location.output(result.output), result.productId)
    }

    /**
     * Changes inputs of the flow on screen: [values] by name, each a [String], a [Number] or a
     * [Boolean]. Inputs it does not name keep their values. Does nothing when no flow is on
     * screen.
     */
    fun updateFlowInput(values: Map<String, Any>) {
        takenOverBy?.let { return it.updateFlowInput(values) }
        flowCoordinator?.updateInput(values)
    }

    /**
     * Closes the flow on screen, if any, and cancels a flow that is still being resolved or
     * downloaded, so it does not appear later; either way its [presentFlow] returns the outcome
     * [FlowResult.DISMISSED]. A download already under way finishes, and the flow is cached.
     */
    fun dismissFlow() {
        takenOverBy?.let { return it.dismissFlow() }
        flowCoordinator?.dismiss()
    }

    /**
     * Stops every timer and callback, flushes analytics a last time for at most 2 s, then cancels
     * the SDK scope, waits for the writes already under way to reach storage, and ends the store
     * connection in the background. The client stops even when the flush
     * fails or the calling coroutine is cancelled during it. It stays shut down; see the class
     * documentation for how it answers afterwards. A disabled client sends nothing and returns
     * an empty status.
     */
    suspend fun shutdown(): FlushStatus {
        // Only the client the SDK configured in this one's place on the unlock is this one's to
        // stop. One the host configured itself replaced this client like any other configure
        // does, and shutting a replaced client down leaves its successor running.
        untilUnlock?.successorConfiguredBySdk?.let { return it.shutdown() }
        if (!closed.compareAndSet(false, true)) {
            return FlushStatus(flushed = 0, pending = if (enabled) analyticsClient.queueLength else 0)
        }
        updateRetryTimer()
        onShutdown()
        if (!enabled) {
            release()
            return FlushStatus(flushed = 0, pending = 0)
        }
        // The client lets go of its files however the final flush ends, a cancelled caller
        // included: the next `configure` loads its storage only after this client released it.
        val status = try {
            // Anything captured inside the persist-behind window has to reach disk before the
            // scope goes away, whether or not the final flush gets through.
            sessionManager.persist()
            runQuietly("persist the analytics queue") {
                analyticsClient.persistAndCompact()
                analyticsClient.persistAndAwait()
            }
            // The queue is on disk, so a final send cut short loses nothing: the next client
            // with this key delivers what is left.
            val finalFlush = scope.async { analyticsClient.flush() }
            try {
                finalFlush.awaitWithin(DELIVERY_WAIT_MS)
                    ?: FlushStatus(0, analyticsClient.queueLength, "The final flush did not finish in time")
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                onWarning("Failed to flush the analytics queue: ${error.message}")
                FlushStatus(0, analyticsClient.queueLength, error.message)
            }
        } finally {
            analyticsClient.reportPendingEvictions()
            release()
        }
        // A rewrite of a queue file the writer had already started still finishes after the
        // release, from this client's memory. A receipt that a replaced client appends once this
        // returns would be overwritten by it, so the rewrite has to end first.
        awaitWritesFinished()
        return status
    }

    /**
     * Stops this client for good without waiting on anything; a later `configure` replacing it
     * calls this, also on a client whose [shutdown] is still flushing. Events captured but not
     * yet on disk are handed to the writer, which finishes them before the next client's storage
     * loads; after that nothing of this client rewrites the SDK's files.
     */
    internal fun close() {
        if (closed.compareAndSet(false, true)) {
            updateRetryTimer()
            onShutdown()
            if (enabled) {
                sessionManager.persist()
                analyticsClient.persistNow()
                analyticsClient.reportPendingEvictions()
            }
        }
        release()
    }

    /**
     * Hands the queue files over to the client configured next, cancels the SDK scope, which
     * closes the writer, and ends the store connection in the background. Runs once.
     */
    private fun release() {
        if (!released.compareAndSet(false, true)) return
        if (!enabled) {
            scope.cancel()
            return
        }
        // Work of this client still in flight must not rewrite the files from its memory, and a
        // receipt reported to it from now on is appended instead.
        analyticsClient.detach()
        outbox.detach()
        personWrites.detach()
        // A purchase still running records its markers in the successor's cache.
        cacheManager.handOff { replacementClient()?.cacheManager }
        scope.cancel()
        // Not on the cancelled scope, nor on the caller's: the store connection has to end even
        // though nothing else of this client runs any more, without holding anybody up. A purchase
        // whose sheet is open keeps it until the sheet closes, so Play's answer still reaches this
        // client, which records it for its successor.
        CoroutineScope(Dispatchers.Default + NonCancellable).launch {
            withTimeoutOrNull(PURCHASE_SHEET_GRACE_MS) { purchasesInFlight.first { it == 0 } }
            withTimeoutOrNull(BILLING_END_TIMEOUT_MS) {
                runQuietly("end the billing connection") { billing.endConnection() }
            }
        }
    }

    /**
     * The live client that replaced this one for the same project, once this one is closed. A
     * disabled successor keeps nothing, so a receipt is written to disk here instead.
     */
    private fun replacementClient(): VoidhashClient? {
        if (!closed.get()) return null
        return replacement()?.takeIf { it !== this && it.enabled && !it.closed.get() }
    }

    /**
     * Waits for the stored state to load, for a call that changes the identity or the person.
     * A client shut down or replaced meanwhile throws `CLIENT_SHUT_DOWN` here: its successor may
     * have read the storage already, and must not have it changed behind its back.
     */
    private suspend fun awaitWarmWhileLive() {
        cacheManager.awaitWarm()
        if (closed.get()) throw clientShutDown()
    }

    /**
     * Reports, and returns the failure of, a purchase reported before the device was first
     * unlocked: it is held and delivered once the device is unlocked, but only in memory, as
     * nothing can be stored yet. The host is told, so it does not consume the purchase on a
     * report that would not survive the process.
     */
    private fun heldUntilUnlockNotDurable(operation: String): VoidhashException {
        val message = "The purchase was reported before the device was unlocked for the first time since " +
            "it started, when nothing can be stored: it is held in memory, reported once the device is " +
            "unlocked, and would not survive the app being closed before then"
        diagnostics.emit(
            VoidhashDiagnosticKind.CACHE,
            code = "TRANSACTION_NOT_DURABLE",
            operation = operation,
            retryable = true,
            message = message,
        )
        return VoidhashException("TRANSACTION_NOT_DURABLE", message)
    }

    /**
     * Makes [successor], configured for the same project now that the device is unlocked, the
     * client that answers for this one. Does nothing on a client that was not configured before
     * the first unlock.
     */
    internal fun handOverTo(successor: VoidhashClient, bySdk: Boolean = false) {
        untilUnlock?.handOver(successor, bySdk)
        // Replaced before it made every call held by the client it took over from: the rest are
        // the replacement's to make.
        inherited?.takeUnless { it.isDrained }?.handOver(successor)
    }

    private fun clientShutDown() = VoidhashException(
        "CLIENT_SHUT_DOWN",
        "This Voidhash client was shut down or replaced by a later configure(); use Voidhash.shared",
    )

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
     * Resolves the paywall release assigned to [location] without presenting it. Answered from
     * the seven-day configuration cache first. `null` while no renderer is configured.
     */
    suspend fun resolvePaywall(location: String): ResolvedPaywall? =
        resolvePaywallState(location).value

    /**
     * [resolvePaywall] with the freshness of the returned configuration attached. [revision] is
     * the revision of the location's interface the answer is for; left out, the one the app
     * configured or last presented the location with.
     */
    suspend fun resolvePaywallState(location: String, revision: Int? = null): Stale<ResolvedPaywall?> {
        takenOverBy?.let { return it.resolvePaywallState(location, revision) }
        if (untilUnlock != null) return Stale(null, isStale = true, isExpired = true)
        if (!enabled || !flowsEnabled) return Stale(null)

        cacheManager.awaitWarm()
        val distinctId = identityStore.getDistinctId()
        val interfaceRevision = revision ?: knownRevision(location)
        val cacheKey = paywallCacheKey(distinctId, location, flowEngine(), interfaceRevision)
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
        ) { refreshPaywall(distinctId, location, interfaceRevision) }
            .value

        if (state.value?.paywall != null) rememberLocation(location)
        return Stale(state.value?.paywall, state.isStale, state.isExpired)
    }

    /** The server's answer for a location as it is cached: its JSON, or `null` for no paywall. */
    private class PaywallJson(val raw: JSONObject?)

    /**
     * The server's paywall answer for [location] as JSON, `"null"` when no paywall is assigned, for
     * a host that renders flows itself or not at all: unlike [resolvePaywallState] it resolves
     * without a renderer too. Cache-first like it; throws `PAYWALL_UNAVAILABLE` when nothing is
     * cached and the server gives no answer.
     */
    internal suspend fun resolvePaywallJson(location: String): String {
        takenOverBy?.let { return it.resolvePaywallJson(location) }
        if (untilUnlock != null) throw deviceLocked("resolve a paywall")
        if (!enabled) return "null"
        cacheManager.awaitWarm()
        val distinctId = identityStore.getDistinctId()
        val revision = knownRevision(location)
        val cacheKey = paywallCacheKey(distinctId, location, flowEngine(), revision)
        val cached = cacheManager.get(cacheKey)?.let { hit -> hit to PaywallJson(hit.value as? JSONObject) }
        val read = readThrough(
            key = cacheKey,
            cached = cached?.second,
            isStale = cached?.first?.isStale != false,
            isExpired = cached?.first?.isExpired == true,
        ) { PaywallJson(fetchPaywall(distinctId, location, revision)) }
        surfaceAuthenticationFailure(answeredWithNothing = read.value.value == null)
        val answer = read.value.value
            ?: throw VoidhashException("PAYWALL_UNAVAILABLE", "The paywall for \"$location\" could not be resolved")
        if (answer.raw?.let(ResolvedPaywall::fromJson) != null) rememberLocation(location)
        return answer.raw?.toString() ?: "null"
    }

    private suspend fun refreshPaywall(distinctId: String, location: String, revision: Int): PaywallRefresh {
        if (!flowsEnabled) return PaywallRefresh(null)
        return PaywallRefresh(fetchPaywall(distinctId, location, revision)?.let(ResolvedPaywall::fromJson))
    }

    /**
     * Asks the server which paywall [location] shows an app built against [revision] of its
     * interface and caches its answer, `null` for none, unless the identity switched while the
     * request was under way. Checked and cached under [identityMutex]: a switch drops the
     * previous identity's paywalls under it, and an answer cached after that would stay on the
     * device for a user who signed out.
     */
    private suspend fun fetchPaywall(distinctId: String, location: String, revision: Int): JSONObject? {
        val epoch = identityEpoch.get()
        val engine = flowEngine()
        val raw = apiClient.resolvePaywallRaw(distinctId, location, engine, revision)
        identityMutex.withLock {
            if (isCurrentIdentity(distinctId, epoch)) {
                // Stored under the engine and the revision the request reported, the ones the
                // answer was decided for.
                cacheManager.set(
                    paywallCacheKey(distinctId, location, engine, revision),
                    raw,
                    ttlMs = PAYWALL_CACHE_TTL_MS,
                    staleTimeMs = PAYWALL_CACHE_STALE_TIME_MS,
                )
            }
        }
        rememberLocation(location)
        return raw
    }

    /**
     * Adopts an externally supplied schema without a server round-trip. Escape
     * hatch for preview and testing hosts; the next background refresh replaces it.
     */
    fun injectInternalSchema(schema: RuntimeSchema) {
        if (untilUnlock != null) {
            val admission = untilUnlock.admit(always = true) { it.injectInternalSchema(schema) }
            if (admission is DeferredUntilUnlock.Admission.Live) return admission.client.injectInternalSchema(schema)
        }
        publishSchema(schema)
    }

    /** [injectInternalSchema] from the server's JSON, which the host hears of as it is. */
    internal fun injectInternalSchemaJson(json: String) {
        if (untilUnlock != null) {
            val admission = untilUnlock.admit(always = true) { it.injectInternalSchemaJson(json) }
            if (admission is DeferredUntilUnlock.Admission.Live) return admission.client.injectInternalSchemaJson(json)
        }
        val document = JSONObject(json)
        publishSchema(RuntimeSchema.fromJson(document))
        publishSchemaJson(document)
    }

    /** Remembers the JSON of the schema just adopted and announces it. */
    internal fun publishSchemaJson(json: JSONObject) {
        val text = json.toString()
        schemaJson = text
        announce(ClientEvent.Schema(text))
    }

    // Embedded-engine surface: stateless data-plane operations for hosts that use the
    // client as their backend transport. Each takes the distinct id explicitly instead of
    // reading the persisted identity, so the host stays the single source of truth. A blank
    // distinct id throws `INVALID_ARGUMENT` before anything is sent or queued. A disabled client
    // sends nothing: reads answer empty and `identifyPerson` throws `CONFIGURATION_MISSING`.

    /** Fetches the runtime schema. Deliberately does not run initialization: the embedded
     * surface is data-plane only and must never start the store's billing connection. */
    suspend fun fetchSchema(distinctId: String): RuntimeSchema {
        takenOverBy?.let { return it.fetchSchema(distinctId) }
        if (untilUnlock != null) throw deviceLocked("fetch the schema")
        if (!enabled) return RuntimeSchema.EMPTY
        if (closed.get()) throw clientShutDown()
        requireDistinctId(distinctId)
        return RuntimeSchema.fromJson(apiClient.getSchema(distinctId))
    }

    /** Fetches the person snapshot; `null` when the backend has none yet. */
    suspend fun fetchPerson(distinctId: String): VoidhashPerson? {
        takenOverBy?.let { return it.fetchPerson(distinctId) }
        if (untilUnlock != null) throw deviceLocked("fetch a person")
        if (!enabled) return null
        if (closed.get()) throw clientShutDown()
        requireDistinctId(distinctId)
        return apiClient.getPerson(distinctId)
    }

    /** Aliases [distinctId] onto [externalUserId] and returns the merged person. */
    suspend fun identifyPerson(
        distinctId: String,
        externalUserId: String,
        email: String?,
        name: String?,
    ): VoidhashPerson {
        takenOverBy?.let { return it.identifyPerson(distinctId, externalUserId, email, name) }
        if (untilUnlock != null) throw deviceLocked("identify a person")
        if (!enabled) throw VoidhashException("CONFIGURATION_MISSING", "Voidhash is disabled")
        if (closed.get()) throw clientShutDown()
        requireDistinctId(distinctId)
        requireIdentifyTarget(externalUserId)
        return apiClient.identify(distinctId, externalUserId, email, name)
    }

    /** Writes person traits and returns the updated person. */
    suspend fun setPersonTraits(
        distinctId: String,
        traits: Map<String, Any?>,
    ): VoidhashPerson? {
        takenOverBy?.let { return it.setPersonTraits(distinctId, traits) }
        if (untilUnlock != null) throw deviceLocked("write person traits")
        if (!enabled) return null
        if (closed.get()) throw clientShutDown()
        requireDistinctId(distinctId)
        apiClient.setPersonAttributes(distinctId, traits)
        return apiClient.getPerson(distinctId)
    }

    /** Evaluates feature flags; an empty [keys] list evaluates every flag. */
    suspend fun evaluateFeatureFlags(
        distinctId: String,
        keys: List<String>,
    ): List<FeatureFlag> {
        takenOverBy?.let { return it.evaluateFeatureFlags(distinctId, keys) }
        if (untilUnlock != null) throw deviceLocked("evaluate feature flags")
        if (!enabled) return emptyList()
        if (closed.get()) throw clientShutDown()
        requireDistinctId(distinctId)
        return apiClient.evaluateFlags(distinctId, keys)
    }

    /**
     * Syncs a store transaction; returns whether the backend accepted it.
     *
     * The receipt is written to the durable outbox before the request goes out and removed
     * only once the backend accepts it, so a process death between the store charging the
     * user and Voidhash recording it is recovered on the next launch. Never throws for
     * transport or for the backend refusing the receipt: an undelivered receipt is queued and
     * a refused one is kept but not retried until the next launch; both report `accepted = false`.
     * Only a `restore` [SyncTransactionRequest.intent], which the project's paid access sharing
     * applies to, and a `purchase` claim of a purchase just made can share or move a purchase
     * another person owns; a queued claim stays one across retries and relaunches. A restore stays one for [distinctId] however
     * the receipt was queued before, across retries and relaunches: a receipt queued for another
     * identity is delivered for that identity first, then the restore is sent, and the result is
     * the restore's.
     * A disabled client keeps and sends nothing and reports `accepted = false`; a replaced one
     * hands the receipt to its successor like [reportTransaction].
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
        if (untilUnlock != null) {
            requireDistinctId(distinctId)
            return when (val admission = untilUnlock.admit(always = true) { it.syncStoreTransactionWithStatus(distinctId, request) }) {
                is DeferredUntilUnlock.Admission.Live -> admission.client.syncStoreTransactionWithStatus(distinctId, request)
                // Never refused: the receipt is the only record that the user paid.
                else -> throw heldUntilUnlockNotDurable("transactions.sync")
            }
        }
        if (!enabled) return TransactionSyncResult(WriteStatus.DEFERRED, accepted = false)
        replacementClient()?.let { return it.syncStoreTransactionWithStatus(distinctId, request) }
        requireDistinctId(distinctId)
        awaitHeldCalls()
        val key = "android:${request.purchaseToken.ifEmpty { request.transactionId }}"
        // Staged as an explicit restore, so a capture queued earlier cannot turn it into a sync.
        val restoreDistinctId = distinctId.takeIf { request.intent == SYNC_TRANSACTION_INTENT_RESTORE }
        var retained = outbox.enqueue(key, distinctId, request, restoreDistinctId).record
            ?: return TransactionSyncResult(WriteStatus.DEFERRED, accepted = false)
        // Kept on disk for the next configure; a shut-down client sends nothing.
        if (closed.get()) return TransactionSyncResult(WriteStatus.DEFERRED, accepted = false)

        while (true) {
            val sent = retained.outgoingRequest
            val verdict = try {
                apiClient.syncTransactionVerdict(retained.distinctId, sent)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                if (classifyFailure(error) == FailureClass.VERDICT) {
                    onWarning("Backend refused store transaction ${redacted(key)}: ${error.message}")
                    outbox.park(key, error)
                } else {
                    onWarning("Queued store transaction ${redacted(key)}: ${error.message}")
                    outbox.postpone(key, error)
                }
                return TransactionSyncResult(WriteStatus.DEFERRED, accepted = false)
            }

            if (verdict != TransactionSyncVerdict.ACCEPTED) {
                // The receipt stays in the outbox, and `drain` keeps retrying it.
                outbox.postpone(key)
                return TransactionSyncResult(WriteStatus.DEFERRED, accepted = false)
            }
            if (outbox.acknowledge(key, retained.distinctId, sent.intent)) {
                return TransactionSyncResult(WriteStatus.CONFIRMED, accepted = true)
            }
            // A restore waits behind the delivery just accepted; it goes next.
            retained = outbox.pendingRecords.firstOrNull { it.key == key }
                ?: return TransactionSyncResult(WriteStatus.CONFIRMED, accepted = true)
        }
    }

    /** Records a development purchase and returns its explicit gateway acceptance verdict. */
    suspend fun recordDevelopmentPurchase(
        distinctId: String,
        request: DevelopmentPurchaseRequest,
    ): Boolean {
        takenOverBy?.let { return it.recordDevelopmentPurchase(distinctId, request) }
        if (untilUnlock != null) throw deviceLocked("record a development purchase")
        if (!enabled) return false
        if (closed.get()) throw clientShutDown()
        requireDistinctId(distinctId)
        return apiClient.developmentPurchase(distinctId, request)
    }

    /** Captures one of the [AutomaticEvents]; a no-op when the host emits them itself. */
    internal fun captureAutomaticEvent(name: String) {
        if (!enabled || !automaticLifecycleEvents) return
        captureIfCollected(name, emptyMap(), sdkClock.now())
    }

    /** Feeds a screen arrival through the tracker and captures `$screen` when it is new. */
    internal fun trackScreen(
        view: ScreenView,
        properties: Map<String, Any?> = emptyMap(),
        capturedAt: Long = sdkClock.now(),
    ) {
        // A tracker attached to the client from before the first unlock reports to the live one.
        takenOverBy?.let { return it.trackScreen(view, properties, capturedAt) }
        if (!enabled) return
        // Without consent the host's `mapScreen` is not run either.
        // Only a screen the app reported itself is reported as skipped for lack of consent.
        val manual = view.source == ScreenSources.MANUAL
        if (!consentStore.isGranted && !heldWhilePending()) {
            if (manual) reportConsentDenied("analytics.screen")
            return
        }
        // `mapScreen` is the host's code, run from activity, fragment and navigation callbacks on
        // the main thread: what it throws must not escape into them.
        val screenProperties = try {
            screenTracker.transition(view)
        } catch (error: Throwable) {
            val message = "Dropped the screen ${view.name}: ScreenTrackingOptions.mapScreen threw " +
                error.javaClass.name
            diagnostics.emit(
                VoidhashDiagnosticKind.EVICTION,
                code = "SCREEN_MAPPER_FAILED",
                operation = "analytics.screen",
                message = message,
            )
            onWarning(message)
            return
        } ?: return
        captureIfCollected(AutomaticEvents.SCREEN, properties + screenProperties, capturedAt, reportDenied = manual)
    }

    /** Forces every captured-but-unwritten analytics event, and the session they extend, to disk. */
    internal fun persistQueuedEvents() {
        if (!enabled || closed.get()) return
        sessionManager.persist()
        analyticsClient.persistNow()
    }

    /** Whether the app has an activity started; sent as `x-is-backgrounded`. */
    internal val isAppInForeground: Boolean get() = appInForeground

    /** Whether activity resumes are ignored because an attached Compose tracker reports screens. */
    internal val activityScreensSuppressed: Boolean get() = activityScreenSuppressors.get() > 0

    /**
     * Stops activity resumes from producing screens while at least one Compose Navigation
     * tracker is attached; it releases its suppression on close. Fragment tracking skips only
     * the activities that show a tracked fragment, and needs none.
     */
    internal fun suppressActivityScreens() {
        // Counted here too, for the client that takes over from one configured before the unlock.
        activityScreenSuppressors.incrementAndGet()
        takenOverBy?.suppressActivityScreens()
    }

    internal fun releaseActivityScreens() {
        // `AtomicInteger.updateAndGet` is API 24; the SDK supports API 23.
        while (true) {
            val count = activityScreenSuppressors.get()
            if (activityScreenSuppressors.compareAndSet(count, maxOf(0, count - 1))) break
        }
        takenOverBy?.releaseActivityScreens()
    }

    /**
     * Resolves `$app_installed` / `$app_updated` from the last app release the cache
     * remembers, then records the current one. Returns the event to capture, or `null` when
     * the release is unchanged, the host owns lifecycle events, or the cache failed.
     * `$app_opened` belongs to the first activity start, not to this.
     *
     * Android backs the SDK's storage up and restores it onto a reinstall or a new device, where
     * the remembered release says nothing about this install. The release therefore records when
     * the app was installed: one recorded for another install means a fresh install, which gets
     * `$app_installed` and a session of its own. A release recorded by an SDK that did not store
     * the install time is compared by version alone.
     */
    private fun resolveAppReleaseEvent(): String? {
        if (!automaticLifecycleEvents) return null
        val firstInstallTime = platform?.firstInstallTime
        val currentRelease = JSONObject()
            .put("appBuild", platform?.appBuild ?: "")
            .put("appVersion", platform?.appVersion ?: "")
        firstInstallTime?.let { currentRelease.put("firstInstallTime", it) }

        val releaseEvent = try {
            val previous = cacheManager.getObject(LAST_SEEN_APP_RELEASE_CACHE_KEY)?.value
            val restoredFromAnotherInstall = firstInstallTime != null && previous != null &&
                previous.has("firstInstallTime") && previous.optLong("firstInstallTime") != firstInstallTime
            when {
                previous == null -> AutomaticEvents.APP_INSTALLED
                restoredFromAnotherInstall -> {
                    sessionManager.rotate()
                    AutomaticEvents.APP_INSTALLED
                }
                previous.optString("appBuild") != currentRelease.getString("appBuild") ||
                    previous.optString("appVersion") != currentRelease.getString("appVersion") ->
                    AutomaticEvents.APP_UPDATED
                else -> null
            }
        } catch (error: Throwable) {
            onWarning("Failed to read the last seen app release: ${error.message}")
            null
        }

        try {
            cacheManager.set(LAST_SEEN_APP_RELEASE_CACHE_KEY, currentRelease)
        } catch (error: Throwable) {
            onWarning("Failed to store the last seen app release: ${error.message}")
        }
        return releaseEvent
    }

    /**
     * Serves [cached] and refreshes behind it, waiting at most the freshness budget.
     *
     * This is the shape of every interactive read in the SDK. With something cached the
     * caller waits 500 ms for the refresh and then gets the cached value anyway, so a slow
     * or dead API costs half a second once rather than a hang on every call; the refresh
     * keeps running and its result lands in cache for the next read. With nothing cached
     * there is nothing to serve, so the caller waits for the request itself, at most
     * [coldWaitMs].
     */
    private suspend fun <T : Any> readThrough(
        key: String,
        cached: T?,
        isStale: Boolean,
        isExpired: Boolean,
        fallback: T? = cached,
        coldWaitMs: Long = COLD_READ_TIMEOUT_MS,
        fetch: suspend () -> T?,
    ): Read<T> {
        if (cached != null && !isStale) return Read(Stale(cached), FreshnessReason.FRESH)
        // An open circuit or a rejected key means the refresh cannot succeed; serving the
        // cache immediately beats spending the freshness budget finding that out. The refresh
        // is made up for once requests are admitted again.
        if (gate?.isBlocked(apiClient.circuitKey) == true) {
            refreshAwaitingCircuit.set(true)
            return Read(
                Stale(fallback, isStale = true, isExpired = fallback == null || isExpired),
                if (fallback == null) FreshnessReason.NO_CACHE else FreshnessReason.REFRESH_FAILED,
            )
        }

        val refresh: Deferred<T?> = scope.async {
            singleFlight.run(key) {
                try {
                    fetch()
                } catch (error: CancellationException) {
                    throw error
                } catch (error: Throwable) {
                    onWarning("Failed to refresh the ${key.substringBefore(':')} cache: ${error.message}")
                    null
                }
            }
        }

        // With something to serve, wait only the freshness budget. With nothing, wait for
        // the request — but never longer than one attempt is allowed to take, so a black-hole
        // network cannot hang the caller indefinitely.
        val fresh = try {
            withTimeoutOrNull(
                if (cached == null) coldWaitMs else FRESHNESS_BUDGET_MS,
            ) {
                refresh.await()
            }
        } catch (error: CancellationException) {
            // The refresh ran on the SDK scope; if that scope is gone (shutdown, reconfigure)
            // the read still belongs to a live caller and answers from what it has.
            currentCoroutineContext().ensureActive()
            null
        }

        if (fresh != null) return Read(Stale(fresh), FreshnessReason.FRESH)
        val reason = when {
            fallback == null -> FreshnessReason.NO_CACHE
            refresh.isCompleted -> FreshnessReason.REFRESH_FAILED
            else -> FreshnessReason.REFRESH_IN_FLIGHT
        }
        return Read(Stale(fallback, isStale = true, isExpired = fallback == null || isExpired), reason)
    }

    /**
     * Fails a host's read that answers with nothing because the publishable key was rejected, the
     * first such read of each pause: otherwise a misconfigured build looks like an end user who owns
     * nothing. A read that can answer from its cache never fails; the pause itself is reported as a
     * diagnostic either way.
     */
    private fun surfaceAuthenticationFailure(answeredWithNothing: Boolean) {
        if (!answeredWithNothing || gate?.takeUnsurfacedAuthFailure() != true) return
        throw VoidhashException(
            "AUTHENTICATION_FAILED",
            "The publishable key was rejected. Check the key this build ships with.",
        )
    }

    /** What [readThrough] answered, and why it has the freshness it has. */
    private class Read<T : Any>(val value: Stale<T?>, val reason: FreshnessReason)

    /**
     * An activity started. Starts the retry timer, then rescans purchases, sends queued data and
     * refreshes person, flags and stale paywalls. The refresh is debounced to once a minute: tab
     * switches and permission dialogs produce foreground transitions the user never perceives as
     * a new session. The first one after an initialization in the background is the store
     * connection and refresh that initialization left for it.
     *
     * A client that was never initialized — initialization deferred until consent or sign-in —
     * only half-opens the breaker: it must not reach the store or the backend, nor mint an
     * identity, on its own. Such a foreground does not count towards the debounce.
     */
    internal fun onAppForegrounded() {
        if (!enabled || closed.get()) return
        appInForeground = true
        updateRetryTimer()
        if (!initialized) {
            gate?.onNetworkChanged()
            return
        }
        val now = sdkClock.elapsed()
        val last = lastForegroundRefreshAt.get()
        if (last != NEVER_REFRESHED && now - last < FOREGROUND_REFRESH_DEBOUNCE_MS) return
        if (!lastForegroundRefreshAt.compareAndSet(last, now)) return

        gate?.onNetworkChanged()
        scope.launch {
            if (!probeAuthenticationIfDue()) return@launch
            runQuietly("reconcile purchases on foreground") { reconcileStore() }
            runQuietly("deliver queued data on foreground") { deliverQueued() }
            runQuietly("refresh on foreground") { preload(identityStore.getDistinctId()) }
        }
    }

    /**
     * No activity is started any more. Stops the retry timer and sends what is due once — person
     * writes and receipts, then analytics — so a purchase made just before and the events that
     * ended the session do not wait for the next launch. The queue file is
     * brought up to date with evictions first, since the process may be killed next.
     */
    internal fun onAppBackgrounded() {
        if (!enabled || closed.get()) return
        appInForeground = false
        updateRetryTimer()
        analyticsClient.persistAndCompact()
        if (!initialized) return
        val outboxDue = outboxWorkDue()
        if (outboxDue || analyticsClient.queueLength > 0) {
            scope.launch {
                if (outboxDue) runQuietly("deliver queued person writes and receipts on background") { drainOutbox() }
                analyticsClient.flushQuietly()
            }
        }
    }

    /** Suspends until an activity of the app is started. */
    internal suspend fun awaitForeground() {
        foreground.first { it }
    }

    /**
     * Reacts to the device regaining a network: rescans purchases and sends queued data,
     * then refreshes cached state. Debounced to once a minute
     * like the foreground refresh: a flapping connection must not turn into a refresh storm.
     * Like [onAppForegrounded], it only half-opens the breaker before [initialize].
     *
     * A network often connects before it can reach the internet — a captive portal to sign in
     * to, a VPN still coming up — so the refresh its connection ran may have failed. The moment
     * it [becameValidated] is debounced on its own and so always gets a refresh through.
     */
    internal fun onConnectivityRestored(becameValidated: Boolean = false) {
        if (!enabled || closed.get()) return
        val debounce = if (becameValidated) lastValidationRefreshAt else lastReconnectRefreshAt
        val now = sdkClock.elapsed()
        val last = debounce.get()
        if (last != NEVER_REFRESHED && now - last < FOREGROUND_REFRESH_DEBOUNCE_MS) return
        if (!debounce.compareAndSet(last, now)) return

        gate?.onNetworkChanged()
        if (!initialized) return
        scope.launch {
            if (!probeAuthenticationIfDue()) return@launch
            runQuietly("reconcile purchases on reconnect") { reconcileStore() }
            runQuietly("deliver queued data on reconnect") { deliverQueued() }
            runQuietly("refresh on reconnect") { preload(identityStore.getDistinctId()) }
        }
    }

    private suspend fun probeAuthenticationIfDue(): Boolean {
        val outbound = gate ?: return true
        if (!outbound.isPaused) return true
        if (!outbound.beginAuthProbe()) return false
        try {
            apiClient.getPerson(
                identityStore.getDistinctId(),
                authenticationProbe = true,
            )
        } catch (error: CancellationException) {
            outbound.endAuthProbe(succeeded = false)
            throw error
        } catch (error: Throwable) {
            // A verdict is the API answering the request, and so is a 2xx whose body is a JSON
            // object, even one the SDK cannot read as a person: it accepted the key, which is all
            // the probe asks. A rejected key, and an answer that is not the API's — a 2xx with a
            // proxy's or maintenance page, an empty body, a JSON array or scalar — leave the
            // pause to the next probe: lifting it would drain every queue into that page.
            val accepted = error is VoidhashApiException &&
                (classifyFailure(error) == FailureClass.VERDICT || error.isJsonObjectAnswer)
            if (!accepted) {
                outbound.endAuthProbe(succeeded = false)
                return false
            }
        }
        outbound.endAuthProbe(succeeded = true)
        diagnostics.emit(
            VoidhashDiagnosticKind.AUTH,
            code = "AUTHENTICATION_RECOVERED",
            operation = "client.probe",
            message = "The publishable key is accepted again; outbound requests resumed",
        )
        return true
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

    /** Locations this device has resolved before, newest last. */
    private fun knownLocations(): List<String> {
        val stored = cacheManager.getArray(KNOWN_LOCATIONS_CACHE_KEY)?.value ?: return emptyList()
        return (0 until stored.length())
            .mapNotNull { (stored.opt(it) as? String)?.takeIf(String::isNotEmpty) }
            .fold(emptyList()) { locations, location ->
                (locations - location + location).takeLast(KNOWN_LOCATIONS_LIMIT)
            }
    }

    private fun rememberLocation(location: String) {
        if (!flowsEnabled) return
        val known = knownLocations()
        if (known.lastOrNull() == location) return
        val updated = (known - location + location).takeLast(KNOWN_LOCATIONS_LIMIT)
        if (updated == known) return
        cacheManager.set(KNOWN_LOCATIONS_CACHE_KEY, JSONArray(updated))
    }

    /**
     * The interface revision to resolve [location] for when no presentation names one: the one
     * the app configured, else the one it last presented the location with, else 0.
     */
    private fun knownRevision(location: String): Int =
        (flowRevisions[location] ?: presentedRevisions[location] ?: 0).coerceAtLeast(0)

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

    /**
     * Paywall answers are cached per identity, per engine, per location and per revision of the
     * location's interface: the backend answers by what the engine can run (see
     * [FlowEngineCapabilities.cacheKey]) and by what the app can answer, so an app update that
     * brings a newer engine or a newer revision starts from a fresh answer instead of one cached
     * for the old one. Revision 0 keeps the key answers were cached under before revisions.
     */
    private fun paywallCacheKey(
        distinctId: String,
        location: String,
        engine: FlowEngineCapabilities?,
        revision: Int,
    ): String {
        val key = "paywall:$distinctId:${engine?.cacheKey ?: "none"}:$location"
        return if (revision > 0) "$key@r$revision" else key
    }

    /** Where the variables of the flow [key] names are saved for [distinctId]. */
    private fun flowStateCacheKey(distinctId: String, key: String): String = "flow-state:$distinctId:$key"

    private fun encodeFlags(flags: List<FeatureFlag>): JSONArray = JSONArray(
        flags.map { flag ->
            JSONObject()
                .put("key", flag.key)
                .put("enabled", flag.enabled)
                .put("variantKey", flag.variantKey ?: JSONObject.NULL)
                .put("payload", flag.payload ?: JSONObject.NULL)
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
                // Entries written before payloads were cached have none.
                payload = flag.opt("payload").takeUnless { it === JSONObject.NULL },
            )
        }

    private fun personCacheKey(distinctId: String): String = "person:$distinctId"

    /**
     * Caches [person], the answer to a request made for [distinctId] once the identity switches had
     * reached [epoch], unless the identity switched since: a sign-out or an identify meanwhile owns
     * the cache and the [person] flow of the identity now in effect. Checked and published under
     * [identityMutex], which every switch and [adoptIdentity] hold, so an answer that arrives as the
     * identity switches can never replace the next identity's person.
     */
    private suspend fun cachePersonIfCurrent(distinctId: String, epoch: Long, person: VoidhashPerson?) {
        identityMutex.withLock { if (isCurrentIdentity(distinctId, epoch)) cachePerson(distinctId, person) }
    }

    /**
     * Caches [person], or the backend's confirmation that there is none, as one snapshot, and
     * publishes it when [distinctId] is the identity in effect. Call with [identityMutex] held, so
     * no identity switch comes between the check and the publish; see [cachePersonIfCurrent].
     */
    private fun cachePerson(distinctId: String, person: VoidhashPerson?) {
        cacheManager.set(
            personCacheKey(distinctId),
            person?.raw ?: noPersonEntry(),
            ttlMs = PERSON_CACHE_TTL_MS,
            staleTimeMs = PERSON_CACHE_STALE_TIME_MS,
        )
        if (identityStore.getDistinctId() == distinctId) {
            personState.value = person
            announce(ClientEvent.Person(PersonState(distinctId, identityGeneration, person, false, false, FreshnessReason.FRESH)))
        }
    }

    /** Runs [block], reporting a failure as a warning and `null` instead of throwing it. */
    private suspend fun <T> runQuietly(context: String, block: suspend () -> T): T? =
        try {
            block()
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            onWarning("Failed to $context: ${error.message}")
            null
        }

    private fun requireSchema(): RuntimeSchema = schemaRef.get()
        ?: throw VoidhashException(
            "CONFIGURATION_MISSING",
            "Voidhash schema is not resolved yet — call initialize() first",
        )
}
