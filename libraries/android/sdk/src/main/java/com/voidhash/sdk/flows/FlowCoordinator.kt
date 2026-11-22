package com.voidhash.sdk.flows

import android.app.Activity
import android.app.Application
import android.os.Bundle
import com.voidhash.sdk.FlowActionHandler
import com.voidhash.sdk.FlowCapability
import com.voidhash.sdk.FlowException
import com.voidhash.sdk.FlowFailure
import com.voidhash.sdk.FlowPermissionResult
import com.voidhash.sdk.FlowPermissionStatus
import com.voidhash.sdk.FlowResult
import com.voidhash.sdk.VoidhashException
import com.voidhash.sdk.api.FlowPackageReference
import com.voidhash.sdk.api.PaywallAnswer
import com.voidhash.sdk.api.PurchasePaywallContext
import com.voidhash.sdk.api.ResolvedPaywall
import com.voidhash.sdk.billing.VoidhashProduct
import com.voidhash.sdk.network.FLOW_PRESENTATION_DEADLINE_MS
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.selects.select
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray
import org.json.JSONObject
import java.util.Collections
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.coroutines.EmptyCoroutineContext

/**
 * What a presented flow reaches outside itself, which
 * [VoidhashClient][com.voidhash.sdk.VoidhashClient] implements. Methods may be called on any thread.
 */
internal interface FlowHost {
    /** The store products a flow can offer. */
    suspend fun products(): List<VoidhashProduct>

    /** Buys [product]; the single purchase entry of the host. Throws when the purchase fails. */
    suspend fun purchase(product: VoidhashProduct)

    /**
     * Buys the offer [offerId] of [product], as the project schema names it. Throws when the
     * purchase fails, including when the offer is unavailable: a host must never buy the
     * product at its regular price instead. The default refuses every offer.
     */
    suspend fun purchase(product: VoidhashProduct, offerId: String) {
        throw VoidhashException("OFFER_UNAVAILABLE", "This app cannot buy offers in flows")
    }

    /**
     * Buys [product], or its offer [offerId], for a flow, naming the paywall it was started from
     * so its revenue is credited to it. The default buys through the methods above, and the
     * purchase names no paywall.
     */
    suspend fun purchase(product: VoidhashProduct, offerId: String?, paywallContext: PurchasePaywallContext) {
        if (offerId == null) purchase(product) else purchase(product, offerId)
    }

    /** Restores the user's purchases. Throws when the restore fails. */
    suspend fun restorePurchases()

    /**
     * Captures an analytics event: one the flow tracked, or one the coordinator reports about a
     * presentation (`$paywall_viewed`, `$paywall_load_failed`, `$paywall_load_cancelled`,
     * `$paywall_completed` and `$paywall_dismissed`).
     */
    fun capture(name: String, properties: Map<String, Any?>)

    /** Records the flow screen the user arrived at. */
    fun screen(name: String, properties: Map<String, Any?>)

    /** Sets one attribute of the current person; [value] is a string, number, boolean or `null`. */
    suspend fun setAttribute(name: String, value: Any?)

    /**
     * The status of [permission] (`notifications`, `tracking`) above [activity], without asking:
     * the app's handler of it, else the SDK's.
     */
    suspend fun permissionStatus(activity: Activity, permission: String): FlowPermissionStatus

    /** Asks the user for [permission] above [activity]: the app's handler of it, else the SDK's. */
    suspend fun requestPermission(activity: Activity, permission: String): FlowPermissionResult

    /** Opens [url] outside the app. */
    fun openUrl(url: String)

    /** The variables saved for the flow [key] names, or `null` when none are saved. */
    fun loadState(key: String): JSONObject?

    /** Saves the variables of the flow [key] names, for its next presentation. */
    fun saveState(key: String, variables: JSONObject)

    /** Forgets the variables saved for the flow [key] names. */
    fun clearState(key: String)
}

private const val ACTION_BUSY_MESSAGE = "Another paywall action is already running"

/**
 * How long a flow waits for the activity that replaces one destroyed for a configuration change.
 * Android creates and starts it right after the destroy; a flow that still waits by then has no
 * activity to come back to.
 */
private const val RECREATION_WAIT_MS = 5_000L

/**
 * Longest a purchase or restore in a flow that goes on waits for the store's products read again
 * before the flow hears the result; products that take longer reach the flow after it.
 */
internal const val PRODUCT_REFRESH_WAIT_MS = 2_000L

/** The state of a presentation's loading state once it ended. */
private val LOADING_ENDED = Any()

/**
 * How long the loading state stays under a flow that has not drawn yet; past it the flow is taken
 * as drawn, so a flow that never reports does not keep the loading state forever.
 */
private const val LOADING_HANDOVER_MS = 1_500L

/**
 * Presents flows through a [FlowRenderer] and handles every message they send.
 *
 * One flow is on screen at a time: presenting another closes the current one. A `purchase` or
 * `restore` calls [FlowHost] exactly once while no other one is running (a second one is
 * answered `ACTION_BUSY`), reports its progress to the flow as `status` messages and a
 * `response`, and ends the flow on success; a failed or cancelled purchase leaves the flow on
 * screen so the user can try again. Actions needing a [FlowCapability] the app did not grant are
 * refused with a warning. The variables a flow reports are saved per paywall and restored when
 * it is presented again, until the flow finishes or a purchase from it succeeds.
 *
 * An `appAction` runs the handler the app passed for it and is answered with its reply. A call
 * without a handler, and a handler that throws, are answered as failed, so the flow never waits
 * on the app; handlers still running when the flow ends are cancelled.
 *
 * A renderer whose surface goes away, as when the app is in the background, creates the flow's
 * runtime anew when it is back. That runtime reports `ready` again and is configured from the
 * variables saved by then; the screen the user was on is not part of them, so the flow shows its
 * first screen.
 *
 * Each presentation reports to analytics through [FlowHost.capture] ([FlowPresentationReport]):
 * its first event (viewed, or failed or cancelled before the view) and, once viewed, how it
 * ended. A preload reports nothing. The flow's own `track` and `$screen` events carry the ids of
 * the flow; a flow tracking one of the SDK's own event names is not passed on.
 *
 * An activity recreated for a configuration change — a rotation, a switch to dark mode, another
 * font size or locale, a resized window — takes the renderer's window with it. That is not the
 * user leaving: the same presentation is shown again above the recreated activity, where the end
 * user was (the runtime's place: the screens shown, the keyboard, what a logic waited for), with
 * its variables, and a purchase in flight still ends it. The place lives in memory with the
 * presentation, never on disk; a later presentation starts on the flow's first screen. An activity destroyed
 * for any other reason closes the flow, and so does a recreated activity that never starts: one
 * that is destroyed first, or does not come within [RECREATION_WAIT_MS]. Shown again, it is still
 * the same presentation: viewed and ended once, its load time measured from the first call.
 *
 * @param loadPackage the verified bytes of a flow package, never one of the withdrawn packages it
 *   is passed, or why they cannot be had.
 * @param scope runs message handling; the coordinator never blocks the main thread.
 * @param mainDispatcher the main thread, where every renderer call runs.
 * @param onWarning receives anomalies the coordinator recovers from.
 */
internal class FlowCoordinator(
    private val host: FlowHost,
    private val renderer: FlowRenderer,
    private val loadPackage: suspend (
        location: String,
        reference: FlowPackageReference,
        withdrawn: List<String>,
    ) -> FlowPackageLoad,
    private val capabilities: Set<FlowCapability>,
    private val locale: String?,
    private val scope: CoroutineScope,
    private val mainDispatcher: CoroutineDispatcher = Dispatchers.Main.immediate,
    private val onWarning: (String) -> Unit = {},
    /**
     * Told of an app action a flow called that the app passed no handler for. The SDK logs it in
     * a debug build of the app, whether or not it logs warnings.
     */
    private val onMissingActionHandler: (String) -> Unit = onWarning,
    /**
     * Told, on the main thread, of the activity a flow is shown above once the one it was
     * presented from was recreated: what the host launches for the flow, such as the store's
     * purchase sheet, has to start from there.
     */
    private val onActivityChanged: (Activity) -> Unit = {},
    /**
     * Loads an image a flow shows, by its URL and the SHA-256 its build pinned it to (`null` for
     * one it did not), throwing when it cannot be had or is not the pinned image: the SDK's own
     * reads the images it keeps on the device before the network. `null` leaves images to the
     * renderer.
     */
    private val loadImage: (suspend (url: String, sha256: String?) -> ByteArray)? = null,
    /**
     * Forgets an image [loadImage] handed out that the renderer could not use, so it is not
     * handed out again from where it is kept.
     */
    private val discardImage: suspend (url: String) -> Unit = {},
    /** Monotonic milliseconds, which a presentation's load time is measured in. */
    private val elapsedMs: () -> Long = { System.nanoTime() / 1_000_000 },
) {
    private val active = AtomicReference<PresentedFlow?>(null)

    /**
     * The images reported refused, as `<package sha256>\n<url>`: each is reported once per
     * package while the process lives, however often a flow asks for it again.
     */
    private val refusedImages: MutableSet<String> = Collections.newSetFromMap(ConcurrentHashMap())

    /** Whether a flow is on screen or being presented. */
    val isPresenting: Boolean get() = active.get() != null

    /**
     * Downloads the flow package of [paywall] ahead of its presentation, when it can be drawn. A
     * preload is not a presentation: it reports nothing.
     */
    suspend fun preload(location: String, paywall: ResolvedPaywall) = preload(location, PaywallAnswer(paywall))

    /** [preload] of an answer, which never loads a package it lists as withdrawn. */
    internal suspend fun preload(location: String, answer: PaywallAnswer) {
        val reference = answer.paywall.flowPackage ?: return
        if (renderer.supports(reference)) loadPackage(location, reference, answer.withdrawnPackages)
    }

    /**
     * A presentation that is not on screen yet: its paywall is still being resolved, or its
     * package downloaded. It ends without showing anything when [dismiss] cancels it, or when
     * [FLOW_PRESENTATION_DEADLINE_MS] pass before the flow is handed to the renderer: by then the
     * user has moved on, and a paywall appearing over whatever they are doing would be worse than
     * none. Either way what it was waiting for carries on, and is cached for the next presentation.
     *
     * Begun from an activity, it follows it until the flow is shown: one recreated for a
     * configuration change meanwhile is replaced by its successor, which the flow is shown above,
     * and one destroyed for good, or not recreated within [RECREATION_WAIT_MS], dismisses it.
     */
    internal inner class PendingPresentation(private val location: String, startActivity: Activity?) {
        private val ended = CompletableDeferred<Unit>()

        /**
         * How it ended before it reached the screen, whether that was its deadline, and whether the
         * end user ended it by leaving the renderer's loading state.
         */
        private inner class Unshown(val result: Result<FlowResult>, val timedOut: Boolean, val byEndUser: Boolean)

        private val outcome = AtomicReference<Unshown?>(null)

        /** The renderer's loading state: `null` before it began, then its session, then [LOADING_ENDED]. */
        private val loading = AtomicReference<Any?>(null)

        /** What the presentation reports to analytics, its load time measured from now. */
        val report = FlowPresentationReport(location, elapsedMs) { name, properties ->
            guard("capture a flow event") { host.capture(name, properties) }
        }

        /** Measures the deadline on the coordinator's scope, from the moment the presentation began. */
        private val deadline = scope.launch {
            delay(FLOW_PRESENTATION_DEADLINE_MS)
            val message = "The flow for \"$location\" was not ready to show within " +
                "${FLOW_PRESENTATION_DEADLINE_MS / 1000} s; what was fetched for it is kept for the next presentation"
            if (end(failed(FlowFailure.UNAVAILABLE, message), timedOut = true)) onWarning(message)
        }

        /** When it began, in [elapsedMs]' milliseconds: a loading state begun later counts from here. */
        private val startedAtMs = elapsedMs()

        init {
            if (startActivity != null) onMain { beginLoading(startActivity) }
        }

        /**
         * Main thread. Begins the renderer's loading state above [above], in place of the one
         * begun before, unless the presentation ended or a flow is on screen: the loading state is
         * never shown over one.
         */
        private fun beginLoading(above: Activity) {
            val previous = loading.get()
            if (previous === LOADING_ENDED || active.get() != null) return
            val session = try {
                renderer.beginLoading(above, (elapsedMs() - startedAtMs).coerceAtLeast(0)) { leftByEndUser() }
            } catch (error: Exception) {
                onWarning("The flow renderer could not show its loading state: ${error.message}")
                null
            }
            if (!loading.compareAndSet(previous, session)) {
                session?.end()
                return
            }
            (previous as? FlowLoadingSession)?.end()
        }

        /** Takes the renderer's loading state down, or keeps it from showing; later calls do nothing. */
        fun endLoading() {
            val session = loading.getAndSet(LOADING_ENDED) as? FlowLoadingSession ?: return
            onMain { session.end() }
        }

        /**
         * Waits until the loading state has been up long enough to be read, so a flow arriving
         * right after it appeared does not flash it; returns `false` when the presentation ended
         * meanwhile.
         */
        suspend fun awaitLoadingShownLongEnough(): Boolean {
            val remaining = withContext(mainDispatcher) {
                (loading.get() as? FlowLoadingSession)?.remainingMs() ?: 0L
            }
            if (remaining <= 0) return true
            return unlessEnded { delay(remaining) } != null
        }

        /** How the presentation ended before it reached the screen; `null` while it may still be shown. */
        val ending: Result<FlowResult>? get() = outcome.get()?.result

        /**
         * Reports how the presentation ended before it reached the screen, as the ending that won
         * says: out of time, or cancelled by the app or by the end user leaving the renderer's
         * loading state. Nothing before its answer is known.
         */
        fun reportUnshown() {
            val unshown = outcome.get() ?: return
            when {
                unshown.timedOut -> report.failed(FlowLoadFailure.TIMEOUT)
                unshown.byEndUser -> report.cancelledByEndUser()
                else -> report.cancelledByApp()
            }
        }

        /** [reportUnshown], then returns how it ended, or throws it. */
        fun endedUnshown(): FlowResult {
            reportUnshown()
            return ending?.getOrThrow() ?: FlowResult.dismissedUnshown()
        }

        fun dismiss() {
            end(Result.success(FlowResult.dismissedUnshown()), timedOut = false)
        }

        /** The end user left the loading state: the presentation ends as [dismiss] ends it, reported as theirs. */
        private fun leftByEndUser() {
            end(Result.success(FlowResult.dismissedUnshown()), timedOut = false, byEndUser = true)
        }

        private fun end(result: Result<FlowResult>, timedOut: Boolean, byEndUser: Boolean = false): Boolean {
            if (!outcome.compareAndSet(null, Unshown(result, timedOut, byEndUser))) return false
            // Reported as it ends, not when its caller resumes: a client that is shutting down
            // dismisses first and stops collecting right after.
            reportUnshown()
            ended.complete(Unit)
            return true
        }

        /** The value [unlessEnded] waited for. */
        inner class Ran<T>(val value: T)

        /**
         * Waits for [work], or returns `null` as soon as the presentation ends; [ending] then says
         * how. The wait for [work] is cancelled; what it started on another scope, a refresh or a
         * download, carries on, so its result is cached for the next presentation.
         */
        suspend fun <T> unlessEnded(work: suspend () -> T): Ran<T>? = coroutineScope {
            val running = async { work() }
            select {
                running.onAwait { Ran(it) }
                ended.onAwait {
                    running.cancel()
                    null
                }
            }
        }

        /** The activity to show the flow above: the one it was begun from, or its recreation. */
        @Volatile
        var activity: Activity? = startActivity
            private set

        /** `false` while [activity] is being recreated; read and written on the main thread. */
        private val activityReady = MutableStateFlow(true)

        /** Whether [activity] can take the flow now. Main thread. */
        val hasActivity: Boolean get() = activityReady.value

        /** Main thread only, like the callbacks below. */
        private var successor: Activity? = null
        private var recreationDeadline: Job? = null
        private val application = startActivity?.application

        private val follower = object : Application.ActivityLifecycleCallbacks {
            override fun onActivityDestroyed(destroyed: Activity) {
                when {
                    destroyed === successor -> dismiss()
                    destroyed !== activity -> Unit
                    destroyed.isChangingConfigurations -> {
                        activityReady.value = false
                        recreationDeadline = scope.launch {
                            delay(RECREATION_WAIT_MS)
                            onMain { if (!activityReady.value) dismiss() }
                        }
                    }
                    // Gone for good before the flow was shown: there is nothing to show it above.
                    activityReady.value -> dismiss()
                }
            }

            override fun onActivityCreated(created: Activity, savedInstanceState: Bundle?) {
                val current = activity ?: return
                if (!activityReady.value && successor == null && created !== current && created.javaClass == current.javaClass) {
                    successor = created
                }
            }

            override fun onActivityStarted(started: Activity) {
                if (started !== successor) return
                successor = null
                recreationDeadline?.cancel()
                activity = started
                activityReady.value = true
                guard("report the recreated activity") { onActivityChanged(started) }
                // The loading state went with the activity it was shown above; the presentation
                // has waited long enough for it to show above the new one at once.
                beginLoading(started)
            }

            override fun onActivityResumed(activity: Activity) {}

            override fun onActivityPaused(activity: Activity) {}

            override fun onActivityStopped(activity: Activity) {}

            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
        }

        init {
            application?.registerActivityLifecycleCallbacks(follower)
        }

        /** Waits until [activity] can take the flow, and returns it; `null` without one. */
        suspend fun awaitActivity(): Activity? {
            activityReady.first { it }
            return activity
        }

        /**
         * Stops the deadline, the wait for [dismiss] and following the activity: the flow was
         * handed to the renderer, or the presentation was given up. A flow handed to the renderer
         * ([handedOver]) ends the loading state itself once it is on screen above it; otherwise it
         * ends here.
         */
        fun close(handedOver: Boolean = false) {
            deadline.cancel()
            pending.remove(this)
            application?.unregisterActivityLifecycleCallbacks(follower)
            onMain { recreationDeadline?.cancel() }
            if (!handedOver) endLoading()
        }
    }

    /** The presentations that are not on screen yet. */
    private val pending: MutableSet<PendingPresentation> = Collections.newSetFromMap(ConcurrentHashMap())

    /**
     * Starts the presentation of the flow for [location], whose paywall is still to be resolved:
     * from here on [dismiss] cancels it and its deadline runs. Hand it to [present], or
     * [PendingPresentation.close] it.
     */
    internal fun beginPresentation(location: String, activity: Activity? = null): PendingPresentation =
        PendingPresentation(location, activity).also { pending.add(it) }

    /**
     * Presents the flow of [paywall] above [activity] and returns how it ended. [input] are the
     * inputs the app passes it and [actions] the handlers of the app actions it may call, both by
     * name. [dismiss] closes the flow, also while the package is still being downloaded: the call
     * then returns the outcome [FlowResult.DISMISSED] and the download finishes on its own.
     * Cancelling the caller closes the flow too.
     *
     * A flow that cannot be shown, or fails while it is on screen, throws a [FlowException]. One
     * that is not handed to the renderer within [FLOW_PRESENTATION_DEADLINE_MS] of this call is
     * not shown and throws [FlowFailure.UNAVAILABLE]; the download finishes on its own here too.
     * Once on screen, a flow has no deadline.
     */
    suspend fun present(
        activity: Activity,
        location: String,
        paywall: ResolvedPaywall,
        input: Map<String, Any> = emptyMap(),
        actions: Map<String, FlowActionHandler> = emptyMap(),
    ): FlowResult = present(activity, location, PaywallAnswer(paywall), beginPresentation(location, activity), input, actions)

    /** [present] of an answer, whose ids and exposure token its analytics carry. */
    internal suspend fun present(
        activity: Activity,
        location: String,
        answer: PaywallAnswer,
        input: Map<String, Any> = emptyMap(),
        actions: Map<String, FlowActionHandler> = emptyMap(),
    ): FlowResult = present(activity, location, answer, beginPresentation(location, activity), input, actions)

    /**
     * [present] for a presentation begun with [beginPresentation], which this call closes. With
     * [bundled], the verified bytes of the package the app bundles for the answer, it shows those
     * instead of loading the answer's package.
     */
    internal suspend fun present(
        activity: Activity,
        location: String,
        answer: PaywallAnswer,
        presentation: PendingPresentation,
        input: Map<String, Any> = emptyMap(),
        actions: Map<String, FlowActionHandler> = emptyMap(),
        bundled: ByteArray? = null,
    ): FlowResult = try {
        presentPending(activity, location, answer, presentation, input, actions, bundled)
    } catch (error: CancellationException) {
        // The caller went away before the flow was viewed; once viewed, the flow reported its ending.
        presentation.report.cancelledByApp()
        throw error
    } finally {
        presentation.close()
    }

    private suspend fun presentPending(
        activity: Activity,
        location: String,
        answer: PaywallAnswer,
        presentation: PendingPresentation,
        input: Map<String, Any>,
        actions: Map<String, FlowActionHandler>,
        bundled: ByteArray?,
    ): FlowResult {
        val paywall = answer.paywall
        val report = presentation.report
        if (bundled != null) report.packageSource = "bundled"
        val reference = paywall.flowPackage ?: run {
            presentation.ending?.let { return it.getOrThrow() }
            onWarning("The paywall for \"$location\" has no flow package")
            throw FlowException(FlowFailure.NOT_ASSIGNED, "The paywall for \"$location\" has no flow package")
        }
        // An answer naming a flow package: from here on the presentation reports how it went.
        report.show(answer)
        if (presentation.ending != null) return presentation.endedUnshown()
        if (!renderer.supports(reference)) {
            report.failed(FlowLoadFailure.PACKAGE_UNSUPPORTED)
            // The Voidhash renderer reports no capabilities exactly where its native library
            // doesn't ship for the device's CPU, and then draws no package at all.
            val why = if (renderer.engineCapabilities == null) {
                "the flow renderer has no native library for this device's CPU"
            } else {
                "it uses package format ${reference.abiVersion}, which this SDK build cannot read; " +
                    "report it with abiVersion ${reference.abiVersion}"
            }
            throw FlowException(
                FlowFailure.UNSUPPORTED_PACKAGE,
                "The flow for \"$location\" cannot be drawn: $why",
                abiVersion = reference.abiVersion,
            )
        }
        // On the coordinator's scope, so a dismissal or the deadline ends the wait and not the download.
        val download = scope.async {
            if (bundled != null) FlowPackageLoad.Loaded(bundled, fromCache = true) else loadPackage(location, reference, answer.withdrawnPackages)
        }
        val loaded = presentation.unlessEnded {
            try {
                download.await()
            } catch (error: CancellationException) {
                // The coordinator's scope went away under a caller that is still there.
                currentCoroutineContext().ensureActive()
                null
            }
        } ?: return presentation.endedUnshown()
        val bytes = when (val load = loaded.value) {
            is FlowPackageLoad.Loaded -> load.bytes.also {
                if (bundled == null) report.packageSource = if (load.fromCache) "cache" else "network"
            }
            is FlowPackageLoad.Failed -> {
                report.failed(
                    when (load.failure) {
                        FlowPackageFailure.DOWNLOAD -> FlowLoadFailure.PACKAGE_DOWNLOAD_FAILED
                        FlowPackageFailure.INTEGRITY -> FlowLoadFailure.PACKAGE_INTEGRITY_FAILED
                        FlowPackageFailure.WITHDRAWN -> FlowLoadFailure.OTHER
                    },
                )
                throw FlowException(FlowFailure.UNAVAILABLE, "The flow for \"$location\" could not be downloaded")
            }
            // The client was shut down or replaced under the download: the app gave it up.
            null -> {
                report.cancelledByApp()
                throw FlowException(FlowFailure.UNAVAILABLE, "The flow for \"$location\" could not be downloaded")
            }
        }
        // In module mode, the runtime module the release needs; bounded by the renderer.
        val prepared = presentation.unlessEnded {
            try {
                renderer.prepare(presentation.activity ?: activity, reference)
                null
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                error
            }
        } ?: return presentation.endedUnshown()
        prepared.value?.let { error ->
            onWarning("The flow runtime for \"$location\" is not available: ${error.message}")
            report.failed(FlowLoadFailure.RUNTIME_DOWNLOAD_FAILED)
            throw FlowException(FlowFailure.UNAVAILABLE, "The flow runtime for \"$location\" is not available")
        }

        // The release shown, whatever answer arrives while it is on screen.
        val paywallContext = paywall.showingId?.let { showingId ->
            PurchasePaywallContext(showingId, location, paywall.paywallId, answer.releaseId)
                .also { if (bundled != null) it.source = "bundled" }
        }
        val flowInput = flowValues(input, "input of the flow for \"$location\"")
        // Above the activity the presentation follows: after a recreation meanwhile, its successor.
        // A loading state that just appeared stays long enough to be read rather than flash.
        if (!presentation.awaitLoadingShownLongEnough()) return presentation.endedUnshown()
        var flow: PresentedFlow? = null
        while (flow == null) {
            val above = presentation.unlessEnded { presentation.awaitActivity() ?: activity }
                ?: return presentation.endedUnshown()
            flow = withContext(mainDispatcher) {
                // Recreated again on the way to the main thread: wait for the next one.
                if (!presentation.hasActivity) return@withContext null
                PresentedFlow(
                    above.value, location, paywallContext, reference,
                    stateKey = paywall.paywallId ?: location,
                    bytes = bytes,
                    input = flowInput,
                    actions = actions,
                    report = report,
                ).also { presented -> if (show(presented, bytes, presentation)) presented.configureFirst() }
            }
        }
        try {
            return flow.result.await()
        } catch (error: CancellationException) {
            flow.dismiss(FlowEnding.APP)
            throw error
        }
    }

    /** Whether the renderer draws the release whose package [reference] describes. */
    internal fun supports(reference: FlowPackageReference): Boolean = renderer.supports(reference)

    /**
     * Closes the flow on screen, if any, and cancels every presentation that is not on screen
     * yet; each one's [present] returns the outcome [FlowResult.DISMISSED].
     */
    fun dismiss() {
        // Before the flow on screen is read: a presentation that goes on screen meanwhile has
        // either seen its dismissal or is the active flow by then.
        pending.toList().forEach { it.dismiss() }
        active.get()?.dismiss(FlowEnding.APP)
    }

    /**
     * Changes inputs of the flow on screen: [values] by name, each a string, number, boolean or
     * list of strings.
     * Inputs it does not name keep their values. Does nothing when no flow is on screen.
     */
    fun updateInput(values: Map<String, Any>) {
        val flow = active.get() ?: return
        val changed = flowValues(values, "input of the flow for \"${flow.location}\"")
        if (changed.isEmpty()) return
        // Kept, so a runtime the renderer creates anew is configured with them.
        synchronized(flow) {
            flow.input = flow.input + changed
            flow.post(FlowEnvelope.inputMessage(JSONObject(changed)))
        }
    }

    /** Main thread. Returns whether [flow] is on screen. */
    private fun show(flow: PresentedFlow, bytes: ByteArray, presentation: PendingPresentation): Boolean {
        active.getAndSet(flow)?.dismiss(FlowEnding.APP)
        // Dismissed, or past its deadline, after the package arrived and before anything was shown.
        presentation.ending?.let { ending ->
            presentation.reportUnshown()
            flow.end(ending, FlowEnding.APP)
            return false
        }
        // Handed to the renderer: from here on the flow has no deadline.
        presentation.close(handedOver = true)
        // The loading states of other presentations are not shown over this flow.
        pending.forEach { it.endLoading() }
        val session = try {
            renderer.present(flow.activity, bytes, flow.reference, flow.attachment)
        } catch (error: Exception) {
            presentation.endLoading()
            flow.end(
                failed(FlowFailure.PRESENTATION_FAILED, "The flow could not be presented: ${error.message}"),
                FlowEnding.ERROR,
            )
            return false
        }
        // The flow is above the loading state now, which goes once the flow has drawn, so neither
        // the activity nor an empty window shows through in between.
        scope.launch(mainDispatcher + NonCancellable) {
            withTimeoutOrNull(LOADING_HANDOVER_MS) { flow.drawn.await() }
            presentation.endLoading()
        }
        // Ended while the renderer was presenting: it failed, or `dismiss` was called from another
        // thread, whose own cleanup found no session yet. The window just shown must not stay.
        if (flow.ended.get()) {
            session.dismiss()
            return false
        }
        flow.session = session
        flow.followActivity()
        return true
    }

    /**
     * Configures the flow's runtime: its products and the state saved for it by now. The first
     * call is the presentation's own; each later one answers the `ready` of a runtime the renderer
     * created anew, after its surface or its activity went away, which starts from what the one
     * before it saved. The store is asked for the products once per presentation, and again after
     * a purchase or restore in a flow that goes on ([refreshProducts]).
     */
    private suspend fun configure(flow: PresentedFlow, requestId: String?, later: Boolean = false) {
        // A store failure must not leave the flow unconfigured; it still gets its saved state.
        val products = flow.products ?: try {
            host.products().also { flow.products = it }
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            onWarning("Failed to resolve paywall products: ${error.message}")
            emptyList()
        }
        val state = guard("load the flow state") { host.loadState(flow.stateKey) }
        val permissions = permissionStatuses(flow.activity)

        // With `updateInput`, so a change of inputs is either part of this or posted after it.
        synchronized(flow) {
            val skipped = mutableSetOf<String>()
            val config = buildFlowRuntimeConfig(
                productIds = flow.reference.productIds,
                products = products,
                locale = locale,
                capabilities = capabilities.map { it.wireName },
                state = state,
                input = JSONObject(flow.input),
                // A runtime created anew goes on where the one before it left the end user.
                place = if (later) flow.place?.json else null,
                restoresPlace = true,
                permissions = permissions,
                onSkippedProduct = { reference ->
                    skipped.add(reference)
                    onWarning("Paywall product not available in the store: $reference")
                },
            )
            // Shown without any of the products it offers: the store failed, or has none of them.
            val productIds = flow.reference.productIds
            if (productIds.isNotEmpty() && skipped.containsAll(productIds)) flow.report.productsUnavailable = true
            flow.permissions = permissions
            flow.configureWith(FlowEnvelope.configureMessage(config, requestId), replay = later)
        }
    }

    /** Main thread, from the renderer. */
    private fun handle(flow: PresentedFlow, raw: String) {
        val envelope = try {
            FlowEnvelope.parse(raw)
        } catch (error: FlowEnvelopeParseException) {
            onWarning("Ignoring unrecognized paywall bridge message: ${error.message}")
            return
        }
        val payload = envelope.payload

        when (envelope.type) {
            // The first runtime is configured once, as soon as both the flow and its session
            // exist. A later `ready` comes from a runtime the renderer created anew, which knows
            // nothing yet: it is configured from the state saved by now.
            "ready" -> if (flow.session != null) {
                val first = flow.readied.compareAndSet(false, true)
                // Shown again after a recreation and configured before its first frame already.
                if (!first && flow.takeConfiguredEarly()) return
                scope.launch {
                    if (!first || flow.configured.compareAndSet(false, true)) {
                        configure(flow, envelope.requestId, later = !first)
                    }
                }
            }
            "purchase", "restore" -> scope.launch { runAction(flow, envelope) }
            "close" -> {
                payload.optJSONObject("output")?.let { flow.output = it.toFlowValues() }
                flow.dismiss(FlowEnding.CLOSE)
            }
            "openExternal" -> if (granted(FlowCapability.LINKS)) {
                guard("open ${payload.getString("url")}") { host.openUrl(payload.getString("url")) }
            }
            "finish" -> {
                guard("clear the flow state") { host.clearState(flow.stateKey) }
                payload.optJSONObject("output")?.let { flow.output = it.toFlowValues() }
                flow.end(Result.success(FlowResult(payload.getString("result"), flow.output)), FlowEnding.END_STEP)
            }
            "appAction" -> flow.handlers.launch { callApp(flow, envelope) }
            "requestPermission" -> flow.handlers.launch { requestPermission(flow, envelope) }
            "setAttribute" -> setAttribute(payload)
            "track" -> guard("capture a flow event") {
                val name = payload.getString("name")
                val properties = payload.optJSONObject("properties").toMap()
                when (name) {
                    // The runtime's view is the presentation's, reported once, by the SDK, with
                    // the screen it names; each runtime created anew tracks it again.
                    FLOW_VIEWED_EVENT -> flow.report.viewed(properties)
                    // The presentation's events are the SDK's to report.
                    in SDK_FLOW_EVENTS -> Unit
                    else -> host.capture(name, properties + flow.report.context())
                }
            }
            "screen" -> guard("record a flow screen") {
                host.screen(
                    payload.getString("name"),
                    flow.report.context() + ("flow_screen_index" to (payload.get("index") as Number).toInt()),
                )
            }
            "state" -> {
                // Kept for an ending that reports none itself: a purchase, a restore, a dismissal.
                payload.optJSONObject("output")?.let { flow.output = it.toFlowValues() }
                val variables = payload.getJSONObject("variables")
                // Kept in memory for a runtime created anew for this presentation, which goes on
                // from there; only the variables are saved for later presentations.
                val changed = flow.saved(variables, payload.optJSONObject("place"))
                // A `state` that only moved the end user leaves the saved variables as they are.
                if (changed) guard("save the flow state") { host.saveState(flow.stateKey, variables) }
            }
            "log" -> onWarning(
                "Paywall for \"${flow.location}\" logged (${payload.getString("level")}): ${payload.getString("message")}",
            )
        }
    }

    /**
     * Runs the app's handler for the action the flow called and answers the call. A call is
     * always answered while the flow is shown: without a handler, and when the handler throws, as
     * failed. A flow that ended meanwhile has cancelled the handler, and nothing is sent.
     */
    private suspend fun callApp(flow: PresentedFlow, envelope: FlowInboundEnvelope) {
        val name = envelope.payload.getString("name")
        val requestId = envelope.requestId ?: run {
            onWarning("Ignoring the app action \"$name\" the flow for \"${flow.location}\" called without a request id")
            return
        }
        val handler = flow.actions[name]
        if (handler == null) {
            onMissingActionHandler(
                "The flow for \"${flow.location}\" called the app action \"$name\", which the app passed no " +
                    "handler for; pass one in `actions` of presentFlow",
            )
            flow.post(FlowEnvelope.appActionFailure(requestId, "No handler is registered for \"$name\""))
            return
        }
        val answer = try {
            val reply = handler.handle(envelope.payload.optJSONObject("args").toFlowValues())
            FlowEnvelope.appActionReply(
                requestId,
                JSONObject(flowValues(reply, "reply of the app action \"$name\"")),
            )
        } catch (error: Throwable) {
            // Cancelled because the flow ended: there is nothing left to answer.
            currentCoroutineContext().ensureActive()
            onWarning("The handler of the app action \"$name\" failed: ${error.message}")
            FlowEnvelope.appActionFailure(requestId, error.message.orEmpty().ifEmpty { "The app action failed" })
        }
        flow.post(answer)
    }

    /**
     * The entries of [values] a flow can take: strings, finite numbers, booleans and lists of
     * strings (a list as a [JSONArray]). Anything else is dropped with a warning that names
     * [what] it was part of.
     */
    private fun flowValues(values: Map<String, Any?>, what: String): Map<String, Any> {
        val kept = LinkedHashMap<String, Any>()
        for ((name, value) in values) {
            val usable: Any? = when (value) {
                is String, is Boolean -> value
                is Number -> value.takeIf { it.toDouble().isFinite() }
                is List<*> -> if (value.all { it is String }) JSONArray(value) else null
                else -> null
            }
            if (usable != null) {
                kept[name] = usable
            } else {
                onWarning(
                    "Dropped \"$name\" from the $what: only strings, numbers, booleans and lists " +
                        "of strings can be passed",
                )
            }
        }
        return kept
    }

    private fun granted(capability: FlowCapability): Boolean {
        if (capability in capabilities) return true
        onWarning(
            "Dropped a flow action: the app did not grant ${capability.wireName} " +
                "(VoidhashOptions.flowCapabilities)",
        )
        return false
    }

    private fun setAttribute(payload: JSONObject) {
        if (!granted(FlowCapability.ATTRIBUTES)) return
        val name = payload.getString("name")
        val value = payload.get("value")
        if (value is JSONObject || value is JSONArray) {
            onWarning("Dropped the flow attribute \"$name\": only strings, numbers and booleans can be set")
            return
        }
        scope.launch {
            suspendGuard("set the person attribute \"$name\"") {
                host.setAttribute(name, value.takeUnless { it === JSONObject.NULL })
            }
        }
    }

    /** The permissions the app lets flows ask for and read, by name. */
    private val grantedPermissions: List<String> =
        capabilities.filter { it == FlowCapability.NOTIFICATIONS || it == FlowCapability.TRACKING }
            .map { it.wireName }
            .sorted()

    /** A permission's system prompt being shown, and how many requests wait for its answer. */
    private class PermissionPrompt(val answer: Deferred<FlowPermissionResult>) {
        var waiting = 0
    }

    /**
     * Main thread. The system prompt of each permission being asked for, by name: a second
     * request for it, from this flow's runtime created anew or from another flow, waits for the
     * same answer instead of asking again. A prompt no live presentation waits for any more (each
     * request's wait is cancelled with its flow) is forgotten, so one that never returns holds up
     * only the presentations that asked while it was up.
     */
    private val permissionPrompts = mutableMapOf<String, PermissionPrompt>()

    /**
     * The status of each permission the app lets flows ask for, as `configure` and `context`
     * report them. Only those are read: an app that grants none reads nothing.
     */
    private suspend fun permissionStatuses(activity: Activity): Map<String, String> =
        grantedPermissions.associateWith { permission ->
            (suspendGuard("read the $permission permission") { host.permissionStatus(activity, permission) }
                ?: FlowPermissionStatus.UNAVAILABLE).wireName
        }

    /**
     * Answers a flow's `requestPermission` with how the user answered, once. A permission the app
     * does not let flows ask for, or that no handler knows, is `unavailable`, asked nothing.
     */
    private suspend fun requestPermission(flow: PresentedFlow, envelope: FlowInboundEnvelope) {
        val permission = envelope.payload.getString("permission")
        val requestId = envelope.requestId ?: run {
            onWarning("Dropped a request for the $permission permission without a request id")
            return
        }
        val result = if (permission !in grantedPermissions) {
            onWarning(
                "Dropped a flow's request for the $permission permission: the app did not grant " +
                    "$permission (VoidhashOptions.flowCapabilities)",
            )
            FlowPermissionResult.UNAVAILABLE
        } else {
            val prompt = withContext(mainDispatcher) {
                permissionPrompts.getOrPut(permission) {
                    PermissionPrompt(
                        scope.async {
                            // A handler that throws reads as unavailable.
                            suspendGuard("request the $permission permission") {
                                host.requestPermission(flow.activity, permission)
                            } ?: FlowPermissionResult.UNAVAILABLE
                        },
                    )
                }.also { it.waiting++ }
            }
            try {
                prompt.answer.await()
            } finally {
                withContext(NonCancellable + mainDispatcher) {
                    prompt.waiting--
                    if (prompt.waiting == 0 && permissionPrompts[permission] === prompt) {
                        permissionPrompts.remove(permission)
                        prompt.answer.cancel()
                    }
                }
            }
        }
        flow.permissionAnswered(permission, result.wireName)
        flow.post(
            FlowEnvelope.successResponse(
                "requestPermission",
                requestId,
                JSONObject().put("result", result.wireName),
            ),
        )
    }

    private suspend fun runAction(flow: PresentedFlow, envelope: FlowInboundEnvelope) {
        if (!flow.actionInFlight.compareAndSet(false, true)) {
            flow.post(
                FlowEnvelope.errorResponse(envelope.type, "ACTION_BUSY", ACTION_BUSY_MESSAGE, envelope.requestId),
            )
            return
        }

        try {
            if (envelope.type == "purchase") runPurchase(flow, envelope) else runRestore(flow, envelope)
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            reportActionFailure(flow, envelope, error)
        } finally {
            flow.actionInFlight.set(false)
        }
    }

    private suspend fun runPurchase(flow: PresentedFlow, envelope: FlowInboundEnvelope) {
        val requestedProductId = envelope.payload.getString("productId")
        flow.status(FlowEnvelope.statusMessage("purchasing", envelope.requestId, requestedProductId))

        val product = findProduct(requestedProductId)
        if (product == null) {
            val message = "Product not found: $requestedProductId"
            flow.status(FlowEnvelope.statusMessage("failed", envelope.requestId, error = message))
            flow.post(FlowEnvelope.errorResponse("purchase", "ACTION_FAILED", message, envelope.requestId))
            return
        }

        val offerId = envelope.payload.optString("offerId").ifEmpty { null }
        // A pending payment throws, and uses up no offer until it is made: the products stay as
        // they are, and the flow hears at once that it waits.
        when {
            flow.paywallContext != null -> host.purchase(product, offerId, flow.paywallContext)
            offerId == null -> host.purchase(product)
            else -> host.purchase(product, offerId)
        }

        // The purchase says whether the flow is done; one that does not
        // follows the flow (a paywall is done, an onboarding carries on).
        val endsFlow = endsFlow(flow, envelope)
        if (!endsFlow) refreshProducts(flow)
        flow.status(FlowEnvelope.statusMessage("purchased", envelope.requestId, product.slug))
        flow.post(
            FlowEnvelope.successResponse("purchase", envelope.requestId, JSONObject().put("productId", product.slug)),
        )
        if (!endsFlow) return
        guard("clear the flow state") { host.clearState(flow.stateKey) }
        flow.end(Result.success(FlowResult(FlowResult.PURCHASED, flow.output, product.slug)), FlowEnding.PURCHASE)
    }

    private suspend fun runRestore(flow: PresentedFlow, envelope: FlowInboundEnvelope) {
        flow.status(FlowEnvelope.statusMessage("restoring", envelope.requestId))

        host.restorePurchases()

        val endsFlow = endsFlow(flow, envelope)
        if (!endsFlow) refreshProducts(flow)
        flow.status(FlowEnvelope.statusMessage("restored", envelope.requestId))
        flow.post(FlowEnvelope.successResponse("restore", envelope.requestId))
        if (!endsFlow) return
        flow.end(Result.success(FlowResult(FlowResult.RESTORED, flow.output)), FlowEnding.RESTORE)
    }

    /**
     * Reads the store's products again for a flow that goes on after a purchase or restore that
     * went through, which may have changed what Play says of them (an introductory offer the end
     * user just took), and sends them in a `products` message; a runtime created anew later is
     * configured with them.
     *
     * Returns once they are sent or after [PRODUCT_REFRESH_WAIT_MS], whichever is first, so the flow
     * hears the result with the products as they are now unless Play is slow; products that come
     * later are sent when they come. A refresh of an earlier purchase or restore still running is
     * cancelled: what it read may be older. The refresh ends with the flow, and a store that fails
     * sends nothing: the flow keeps the products it had.
     */
    private suspend fun refreshProducts(flow: PresentedFlow) {
        flow.productRefresh?.cancel()
        val refresh = flow.handlers.launch {
            val products = try {
                host.products()
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                onWarning("The flow keeps the products it had: they could not be read again after a purchase or restore: ${error.message}")
                return@launch
            }
            currentCoroutineContext().ensureActive()
            flow.products = products
            val refreshed = buildFlowRuntimeConfig(flow.reference.productIds, products, locale).products
            if (refreshed.isNotEmpty()) flow.post(FlowEnvelope.productsMessage(refreshed))
        }
        flow.productRefresh = refresh
        withTimeoutOrNull(PRODUCT_REFRESH_WAIT_MS) { refresh.join() }
    }

    /**
     * Whether a successful purchase or restore ends the flow: as the action says
     * (`endsFlow`, flow packages from ABI 11), or else as the flow does.
     */
    private fun endsFlow(flow: PresentedFlow, envelope: FlowInboundEnvelope): Boolean =
        (envelope.payload.opt("endsFlow") as? Boolean) ?: flow.reference.shouldEndFlowOnPurchase

    /** Resolves the flow's product reference against the store products; see [findFlowProduct]. */
    private suspend fun findProduct(productId: String): VoidhashProduct? = findFlowProduct(host.products(), productId)

    private fun reportActionFailure(flow: PresentedFlow, envelope: FlowInboundEnvelope, error: Throwable) {
        val message = error.message.orEmpty().ifEmpty { "Unknown paywall bridge action error" }
        val cancelled = isPurchaseCancellation(error)

        flow.status(
            FlowEnvelope.statusMessage(if (cancelled) "cancelled" else "failed", envelope.requestId, error = message),
        )
        if (!cancelled) onWarning("Paywall ${envelope.type} action failed: $message")
        flow.post(FlowEnvelope.errorResponse(envelope.type, "ACTION_FAILED", message, envelope.requestId))
    }

    private fun isPurchaseCancellation(error: Throwable): Boolean {
        var current: Throwable? = error
        val visited = mutableSetOf<Throwable>()
        while (current != null && visited.add(current)) {
            if (current.message.orEmpty().startsWith("USER_CANCELLED")) return true
            current = current.cause
        }
        return false
    }

    /** Runs host code, which must not break message handling by throwing. */
    private fun <T> guard(context: String, block: () -> T): T? =
        try {
            block()
        } catch (error: Exception) {
            onWarning("Failed to $context: ${error.message}")
            null
        }

    private suspend fun <T> suspendGuard(context: String, block: suspend () -> T): T? =
        try {
            block()
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            onWarning("Failed to $context: ${error.message}")
            null
        }

    private fun onMain(block: () -> Unit) {
        if (mainDispatcher.isDispatchNeeded(EmptyCoroutineContext)) {
            mainDispatcher.dispatch(EmptyCoroutineContext, Runnable(block))
        } else {
            block()
        }
    }

    /** One presentation, across the renderer sessions that show it. */
    private inner class PresentedFlow(
        /** The activity the flow is shown above: the one it was presented from, or its recreation. */
        @Volatile var activity: Activity,
        val location: String,
        /** The paywall a purchase from this flow names; `null` when the server sent no showing. */
        val paywallContext: PurchasePaywallContext?,
        val reference: FlowPackageReference,
        val stateKey: String,
        /** The flow package, for a session presented again. */
        private val bytes: ByteArray,
        /** The inputs the app passes the flow, as of its last change; read and replaced under the flow's lock. */
        @Volatile var input: Map<String, Any>,
        /** The app's handlers of the actions the flow may call, by name. */
        val actions: Map<String, FlowActionHandler>,
        /** What the presentation reports to analytics; it outlives a recreated activity. */
        val report: FlowPresentationReport,
    ) : Application.ActivityLifecycleCallbacks {
        val result = CompletableDeferred<FlowResult>()

        /** The flow's outputs as it last reported them. */
        @Volatile
        var output: Map<String, Any> = emptyMap()

        /** Runs the app's action handlers; cancelled when the flow ends. */
        val handlers = CoroutineScope(scope.coroutineContext + SupervisorJob(scope.coroutineContext[Job]))
        val ended = AtomicBoolean(false)
        /** Completed by the flow's first message, which it sends from a drawn frame, or by its end. */
        val drawn = CompletableDeferred<Unit>()
        val configured = AtomicBoolean(false)
        val actionInFlight = AtomicBoolean(false)

        /** Whether a runtime of this presentation reported `ready` before. */
        val readied = AtomicBoolean(false)

        /** The SHA-256 the package's build recorded for each image it pins, by URL; read once. */
        val imageSha256: Map<String, String> by lazy { FlowPackageImages.of(bytes).sha256 }

        /**
         * The store products the flow was configured with, or read again after a purchase or
         * restore since; `null` until the store answered.
         */
        @Volatile
        var products: List<VoidhashProduct>? = null

        /**
         * The permission statuses the flow was last told, by name: read for each `configure`,
         * set by each answer, and read again whenever its activity resumes.
         */
        @Volatile
        var permissions: Map<String, String> = emptyMap()

        /** Reads the products again after the last purchase or restore; see [refreshProducts]. */
        @Volatile
        var productRefresh: Job? = null

        /**
         * Where the end user is in the flow, as its runtime last reported it; `null` before.
         * Sensitive: it holds what the flow's waiting logics work with, what the end user typed
         * among it, so it stays in memory with this presentation and is never saved or logged.
         */
        @Volatile
        var place: SensitivePlace? = null
            private set

        /** The variables the runtime last reported, as saved; `null` before it reported any. */
        @Volatile
        private var variables: JSONObject? = null

        /** Main thread. The session shown again after a recreation was configured before its first frame. */
        private var configuredEarly = false

        /**
         * Main thread. From a recreation until the new runtime is configured: what is posted
         * meanwhile, such as the app's answer to a call, waits in [held] for the configuration.
         */
        private var awaitingConfiguration = false

        /** Main thread. What was posted while no configured session showed the flow. */
        private val held = ArrayList<String>()

        /**
         * Keeps what the runtime reported last: its [variables] and its [place]. Returns whether
         * the variables changed since the last report, so only a change is saved.
         */
        fun saved(variables: JSONObject, place: JSONObject?): Boolean {
            val changed = this.variables?.toString() != variables.toString()
            this.variables = variables
            if (place != null) this.place = SensitivePlace(place)
            return changed
        }

        /** Touched on the main thread only, like everything below. */
        var session: FlowRendererSession? = null

        /** The renderer's host of the session on screen. */
        var attachment = Attachment()
            private set

        /** The last status the flow was told, which a session presented again starts with. */
        private var lastStatus: String? = null

        /** Whether a configured session showing the flow received [lastStatus]. */
        private var lastStatusDelivered = false

        /** Whether [activity] is being recreated and the flow waits for its successor. */
        private var recreating = false

        /** The recreated activity, between its creation and its start. */
        private var successor: Activity? = null

        /** Ends the flow when no successor of [activity] starts in time. */
        private var recreationDeadline: Job? = null

        /** Where the activity callbacks are registered while the flow is on screen. */
        private var application: Application? = null

        /**
         * Delivers [message] to the flow, after every message posted before it. While the activity
         * is recreated it waits for the next session, such as the app's answer to a call.
         */
        fun post(message: String) = onMain {
            val current = session
            when {
                ended.get() -> Unit
                recreating || awaitingConfiguration -> held.add(message)
                current != null -> current.postMessage(message)
            }
        }

        /**
         * Delivers the `configure` [message] to the session showing the flow, never held, then,
         * for a runtime created anew ([replay]) or after a recreation, what it has not had yet.
         */
        fun configureWith(message: String, replay: Boolean) = onMain {
            val current = session ?: return@onMain
            current.postMessage(message)
            val recreated = awaitingConfiguration
            awaitingConfiguration = false
            if (replay || recreated) replayTo(current)
        }

        /**
         * Main thread. Whether the session shown now was configured before its first frame, which
         * its `ready` then does not ask for again; true once.
         */
        fun takeConfiguredEarly(): Boolean = configuredEarly.also { configuredEarly = false }

        /**
         * Main thread. After a runtime created anew was configured: the last status, when no
         * configured session had it or it says a purchase or restore still runs (which the new
         * runtime goes on from; a result it was told already would show again), then what was
         * posted while no configured session showed the flow.
         */
        private fun replayTo(current: FlowRendererSession) {
            lastStatus?.takeIf { !lastStatusDelivered || isProgress(it) }?.let { status ->
                current.postMessage(status)
                lastStatusDelivered = true
            }
            held.forEach(current::postMessage)
            held.clear()
        }

        /**
         * The `configure` of a runtime shown again after a recreation, built at once from what
         * this presentation knows (the store's products, the variables and the place last
         * reported), so the runtime shows the place in its first frame and its screens do not
         * slide in; `null` when the products or the variables are not known yet.
         */
        private fun configurationAgain(): String? {
            val products = products ?: return null
            val variables = variables ?: return null
            return synchronized(this) {
                val config = buildFlowRuntimeConfig(
                    productIds = reference.productIds,
                    products = products,
                    locale = locale,
                    capabilities = capabilities.map { it.wireName },
                    state = variables,
                    input = JSONObject(input),
                    place = place?.json,
                    restoresPlace = true,
                    permissions = permissions,
                )
                FlowEnvelope.configureMessage(config)
            }
        }


        /** [post] for a `status`, which is kept for a session presented again. */
        fun status(message: String) = onMain {
            lastStatus = message
            val current = session.takeUnless { recreating || awaitingConfiguration }
            current?.postMessage(message)
            lastStatusDelivered = current != null
        }

        /** Sends the runtime its first configuration, off the main thread. */
        fun configureFirst() {
            scope.launch { if (configured.compareAndSet(false, true)) configure(this@PresentedFlow, requestId = null) }
        }

        /** Ends the presentation as dismissed, with the outputs the flow reported by now; [ending] says how. */
        fun dismiss(ending: FlowEnding) = end(Result.success(FlowResult(FlowResult.DISMISSED, output)), ending)

        /**
         * Ends the presentation with [outcome] and removes it from the screen, reporting [ending];
         * later calls do nothing.
         */
        fun end(outcome: Result<FlowResult>, ending: FlowEnding) {
            if (!ended.compareAndSet(false, true)) return
            drawn.complete(Unit)
            report.ended(ending)
            active.compareAndSet(this, null)
            outcome.fold(result::complete, result::completeExceptionally)
            handlers.cancel()
            onMain {
                application?.unregisterActivityLifecycleCallbacks(this)
                application = null
                recreationDeadline?.cancel()
                recreationDeadline = null
                successor = null
                held.clear()
                val presented = session
                session = null
                presented?.dismiss()
            }
        }

        /** Main thread. Watches [activity], to show the flow again when it is recreated. */
        fun followActivity() {
            application = activity.application?.also { it.registerActivityLifecycleCallbacks(this) }
        }

        /**
         * Main thread. Takes the session off the destroyed [activity] without ending the flow:
         * whatever the session still reports, its dismissal included, is no longer the flow's.
         */
        private fun awaitRecreation() {
            if (recreating) return
            recreating = true
            awaitingConfiguration = true
            attachment.detached = true
            val presented = session
            session = null
            // A renderer dismisses a session whose activity went away by itself; one that has
            // not yet must not keep a window on the destroyed activity.
            presented?.dismiss()
            // Without a successor to show the flow above, its caller must not wait for good.
            recreationDeadline = scope.launch {
                delay(RECREATION_WAIT_MS)
                onMain { if (recreating) dismiss(FlowEnding.APP) }
            }
        }

        /** Main thread. Shows the flow again above [recreated]. */
        private fun presentAgain(recreated: Activity) {
            recreating = false
            recreationDeadline?.cancel()
            recreationDeadline = null
            if (ended.get()) return
            activity = recreated
            guard("report the recreated activity") { onActivityChanged(recreated) }
            val next = Attachment()
            attachment = next
            val presented = try {
                renderer.present(recreated, bytes, reference, next)
            } catch (error: Exception) {
                end(
                    failed(
                        FlowFailure.PRESENTATION_FAILED,
                        "The flow could not be presented again after its activity was recreated: ${error.message}",
                    ),
                    FlowEnding.ERROR,
                )
                return
            }
            // Ended while the renderer was presenting, as in `show`: its window must not stay.
            if (ended.get()) {
                presented.dismiss()
                return
            }
            session = presented
            // The new runtime is configured before its first frame, where the end user was; one
            // this presentation cannot configure yet is configured on its `ready`. Either way the
            // last status and what waited for the session follow the configuration.
            val configuration = guard("configure the flow again") { configurationAgain() }
            if (configuration != null) {
                configuredEarly = true
                configureWith(configuration, replay = true)
            }
        }

        override fun onActivityDestroyed(destroyed: Activity) {
            if (ended.get()) return
            when {
                // Created to replace the flow's activity and gone before it started, as one that
                // finishes in `onCreate` is: there is nothing to show the flow above.
                destroyed === successor -> dismiss(FlowEnding.APP)
                destroyed !== activity -> Unit
                destroyed.isChangingConfigurations -> awaitRecreation()
                // Gone for good. Ended here rather than by the renderer's dismissal alone, which
                // a renderer that keeps no watch on its activity never reports.
                !recreating -> dismiss(FlowEnding.APP)
            }
        }

        // Android creates the successor of an activity it recreates right after destroying it.
        override fun onActivityCreated(created: Activity, savedInstanceState: Bundle?) {
            if (recreating && successor == null && created !== activity && created.javaClass == activity.javaClass) {
                successor = created
            }
        }

        // Shown once the activity is started, as Android shows an activity's own dialogs again.
        override fun onActivityStarted(started: Activity) {
            if (started !== successor) return
            successor = null
            presentAgain(started)
        }

        // Back from the system settings, where the user may have changed a permission, or from
        // the permission prompt: the flow hears the statuses that changed.
        override fun onActivityResumed(activity: Activity) {
            if (activity !== this.activity || ended.get() || permissions.isEmpty()) return
            handlers.launch {
                val now = permissionStatuses(activity)
                val changed = now.filter { (name, status) -> permissions[name] != status }
                if (changed.isEmpty()) return@launch
                permissions = permissions + changed
                post(FlowEnvelope.permissionsContext(changed))
            }
        }

        /** Records the answer to a request for [permission] as its status from now on. */
        fun permissionAnswered(permission: String, status: String) {
            permissions = permissions + (permission to status)
        }


        override fun onActivityPaused(activity: Activity) {}

        override fun onActivityStopped(activity: Activity) {}

        override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}

        /** The renderer's host for one session of the flow. */
        inner class Attachment : FlowRendererHost {
            /** Set once the session's activity is being recreated; main thread only. */
            var detached = false

            override fun onMessage(message: String) {
                drawn.complete(Unit)
                if (!detached && !ended.get()) handle(this@PresentedFlow, message)
            }

            override fun onWarning(message: String) {
                this@FlowCoordinator.onWarning("Paywall for \"$location\": $message")
            }

            override fun onFailure(message: String) {
                if (detached) return
                this@FlowCoordinator.onWarning("Paywall for \"$location\" failed: $message")
                end(failed(FlowFailure.PRESENTATION_FAILED, message), FlowEnding.ERROR)
            }

            override fun loadImage(url: String, onResult: (Result<ByteArray>) -> Unit): Boolean {
                val load = loadImage ?: return false
                scope.launch {
                    val result = try {
                        Result.success(load(url, imageSha256[url]))
                    } catch (error: CancellationException) {
                        throw error
                    } catch (error: FlowImageMismatchException) {
                        if (refusedImages.add("${reference.sha256}\n$url")) report.imageIntegrityFailed(url)
                        Result.failure(error)
                    } catch (error: Exception) {
                        // An image that cannot be had is the renderer's warning, never the flow's failure.
                        Result.failure(error)
                    }
                    onMain { onResult(result) }
                }
                return true
            }

            override fun onImageRejected(url: String) {
                scope.launch { suspendGuard("discard an image the renderer could not use") { discardImage(url) } }
            }

            override fun onDismiss() {
                if (detached) return
                // A renderer may report the dismissal before the coordinator hears of the
                // destroyed activity. Dismissed under an activity that is being recreated, the
                // session was not left by the user: the flow waits for the recreated activity.
                if (!ended.get() && activity.isChangingConfigurations) return awaitRecreation()
                session = null
                // Left by the end user, unless its activity is going away: then the app or the
                // system took the window.
                dismiss(if (activity.isFinishing || activity.isDestroyed) FlowEnding.APP else FlowEnding.SYSTEM)
            }
        }
    }
}

private fun failed(reason: FlowFailure, message: String): Result<FlowResult> =
    Result.failure(FlowException(reason, message))

/** A JSON object as Kotlin values: nested objects become maps, arrays lists, `null` null. */
private fun JSONObject?.toMap(): Map<String, Any?> {
    if (this == null) return emptyMap()
    return keys().asSequence().associateWith { key -> get(key).toKotlin() }
}

private fun Any?.toKotlin(): Any? = when (this) {
    JSONObject.NULL, null -> null
    is JSONObject -> toMap()
    is JSONArray -> (0 until length()).map { get(it).toKotlin() }
    else -> this
}

/**
 * What a flow sent by name, as the app reads it: strings, booleans, numbers as [Double] and
 * lists as [List] of [String]. A flow sends nothing else; anything else is left out.
 */
private fun JSONObject?.toFlowValues(): Map<String, Any> {
    if (this == null) return emptyMap()
    val values = LinkedHashMap<String, Any>()
    for (name in keys()) {
        when (val value = get(name)) {
            is String, is Boolean -> values[name] = value
            is Number -> values[name] = value.toDouble()
            is JSONArray -> {
                val strings = (0 until value.length()).map { value.get(it) }
                if (strings.all { it is String }) values[name] = strings.filterIsInstance<String>()
            }
        }
    }
    return values
}

/** Whether the `status` envelope [message] says a purchase or restore still runs. */
private fun isProgress(message: String): Boolean =
    runCatching { JSONObject(message).getJSONObject("payload").optString("status") }
        .getOrNull() in setOf("purchasing", "restoring")

/**
 * Where the end user is in a flow, as its runtime reports it in `state`: what a runtime created
 * anew for the same presentation goes on from. It holds the working values of the flow's
 * waiting logics, which can be what the end user typed or what the app answered, so it is kept
 * in memory for its presentation alone and never saved, logged or sent anywhere else; its
 * [toString] says nothing of it.
 */
internal class SensitivePlace(val json: JSONObject) {
    override fun toString(): String = "SensitivePlace(redacted)"
}

