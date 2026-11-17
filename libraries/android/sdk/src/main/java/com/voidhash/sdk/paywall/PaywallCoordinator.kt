package com.voidhash.sdk.paywall

import android.app.Activity
import android.app.Application
import android.os.Bundle
import com.voidhash.sdk.FlowActionHandler
import com.voidhash.sdk.FlowCapability
import com.voidhash.sdk.FlowException
import com.voidhash.sdk.FlowFailure
import com.voidhash.sdk.FlowResult
import com.voidhash.sdk.VoidhashException
import com.voidhash.sdk.api.FlowPackageReference
import com.voidhash.sdk.api.PurchasePaywallContext
import com.voidhash.sdk.api.ResolvedPaywall
import com.voidhash.sdk.billing.VoidhashProduct
import com.voidhash.sdk.network.FLOW_PRESENTATION_DEADLINE_MS
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.selects.select
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.util.Collections
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.coroutines.EmptyCoroutineContext

/**
 * What a presented flow reaches outside itself. [VoidhashClient][com.voidhash.sdk.VoidhashClient]
 * implements it for the SDK's own flows; an embedding host implements it to present flows
 * with its own purchase, analytics and storage. Methods may be called on any thread.
 */
interface FlowHost {
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

    /** Captures an analytics event the flow tracked. */
    fun capture(name: String, properties: Map<String, Any?>)

    /** Records the flow screen the user arrived at. */
    fun screen(name: String, properties: Map<String, Any?>)

    /** Sets one attribute of the current person; [value] is a string, number, boolean or `null`. */
    suspend fun setAttribute(name: String, value: Any?)

    /**
     * Asks the user for [permission] (`notifications` or `tracking`) above [activity].
     *
     * @return whether the permission is granted.
     */
    suspend fun requestPermission(activity: Activity, permission: String): Boolean

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

/** The event a flow's runtime tracks when it is first configured. */
private const val PAYWALL_VIEWED_EVENT = "\$paywall_viewed"

/**
 * Presents flows through a [PaywallRenderer] and handles every message they send.
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
 * first screen. `$paywall_viewed` is captured once per presentation all the same.
 *
 * An activity recreated for a configuration change — a rotation, a switch to dark mode, another
 * font size or locale, a resized window — takes the renderer's window with it. That is not the
 * user leaving: the same presentation is shown again above the recreated activity, configured
 * like any runtime created anew, and a purchase in flight still ends it. An activity destroyed
 * for any other reason closes the flow, and so does a recreated activity that never starts: one
 * that is destroyed first, or does not come within [RECREATION_WAIT_MS].
 *
 * @param loadPackage the verified bytes of a flow package, or `null` when they cannot be had.
 * @param scope runs message handling; the coordinator never blocks the main thread.
 * @param mainDispatcher the main thread, where every renderer call runs.
 * @param onWarning receives anomalies the coordinator recovers from.
 */
class PaywallCoordinator(
    private val host: FlowHost,
    private val renderer: PaywallRenderer,
    private val loadPackage: suspend (location: String, reference: FlowPackageReference) -> ByteArray?,
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
     * Loads an image a flow shows, by its URL, throwing when it cannot be had: the SDK's own
     * reads the images it keeps on the device before the network. `null` leaves images to the
     * renderer.
     */
    private val loadImage: (suspend (url: String) -> ByteArray)? = null,
    /**
     * Forgets an image [loadImage] handed out that the renderer could not use, so it is not
     * handed out again from where it is kept.
     */
    private val discardImage: suspend (url: String) -> Unit = {},
) {
    private val active = AtomicReference<PresentedFlow?>(null)

    /** Whether a flow is on screen or being presented. */
    val isPresenting: Boolean get() = active.get() != null

    /** Downloads the flow package of [paywall] ahead of its presentation, when it can be drawn. */
    suspend fun preload(location: String, paywall: ResolvedPaywall) {
        val reference = paywall.flowPackage ?: return
        if (renderer.supports(reference)) loadPackage(location, reference)
    }

    /**
     * A presentation that is not on screen yet: its paywall is still being resolved, or its
     * package downloaded. It ends without showing anything when [dismiss] cancels it, or when
     * [FLOW_PRESENTATION_DEADLINE_MS] pass before the flow is handed to the renderer: by then the
     * user has moved on, and a paywall appearing over whatever they are doing would be worse than
     * none. Either way what it was waiting for carries on, and is cached for the next presentation.
     */
    internal inner class PendingPresentation(private val location: String) {
        private val ended = CompletableDeferred<Unit>()
        private val outcome = AtomicReference<Result<FlowResult>?>(null)

        /** Measures the deadline on the coordinator's scope, from the moment the presentation began. */
        private val deadline = scope.launch {
            delay(FLOW_PRESENTATION_DEADLINE_MS)
            val message = "The flow for \"$location\" was not ready to show within " +
                "${FLOW_PRESENTATION_DEADLINE_MS / 1000} s; what was fetched for it is kept for the next presentation"
            if (end(failed(FlowFailure.UNAVAILABLE, message))) onWarning(message)
        }

        /** How the presentation ended before it reached the screen; `null` while it may still be shown. */
        val ending: Result<FlowResult>? get() = outcome.get()

        fun dismiss() {
            end(Result.success(FlowResult(FlowResult.DISMISSED)))
        }

        private fun end(result: Result<FlowResult>): Boolean {
            if (!outcome.compareAndSet(null, result)) return false
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

        /**
         * Stops the deadline and the wait for [dismiss]: the flow was handed to the renderer, or
         * the presentation was given up.
         */
        fun close() {
            deadline.cancel()
            pending.remove(this)
        }
    }

    /** The presentations that are not on screen yet. */
    private val pending: MutableSet<PendingPresentation> = Collections.newSetFromMap(ConcurrentHashMap())

    /**
     * Starts the presentation of the flow for [location], whose paywall is still to be resolved:
     * from here on [dismiss] cancels it and its deadline runs. Hand it to [present], or
     * [PendingPresentation.close] it.
     */
    internal fun beginPresentation(location: String): PendingPresentation =
        PendingPresentation(location).also { pending.add(it) }

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
    ): FlowResult = present(activity, location, paywall, beginPresentation(location), input, actions)

    /** [present] for a presentation begun with [beginPresentation], which this call closes. */
    internal suspend fun present(
        activity: Activity,
        location: String,
        paywall: ResolvedPaywall,
        presentation: PendingPresentation,
        input: Map<String, Any> = emptyMap(),
        actions: Map<String, FlowActionHandler> = emptyMap(),
    ): FlowResult = try {
        presentPending(activity, location, paywall, presentation, input, actions)
    } finally {
        presentation.close()
    }

    private suspend fun presentPending(
        activity: Activity,
        location: String,
        paywall: ResolvedPaywall,
        presentation: PendingPresentation,
        input: Map<String, Any>,
        actions: Map<String, FlowActionHandler>,
    ): FlowResult {
        presentation.ending?.let { return it.getOrThrow() }
        val reference = paywall.flowPackage ?: run {
            onWarning("The paywall for \"$location\" has no flow package")
            throw FlowException(FlowFailure.NOT_ASSIGNED, "The paywall for \"$location\" has no flow package")
        }
        if (!renderer.supports(reference)) {
            throw FlowException(
                FlowFailure.UNSUPPORTED_PACKAGE,
                "The flow for \"$location\" uses package version ${reference.abiVersion}, " +
                    "which this SDK cannot draw; update the Voidhash SDK",
                abiVersion = reference.abiVersion,
            )
        }
        // On the coordinator's scope, so a dismissal or the deadline ends the wait and not the download.
        val download = scope.async { loadPackage(location, reference) }
        val loaded = presentation.unlessEnded {
            try {
                download.await()
            } catch (error: CancellationException) {
                // The coordinator's scope went away under a caller that is still there.
                currentCoroutineContext().ensureActive()
                null
            }
        } ?: return presentation.ending?.getOrThrow() ?: FlowResult(FlowResult.DISMISSED)
        val bytes = loaded.value
            ?: throw FlowException(FlowFailure.UNAVAILABLE, "The flow for \"$location\" could not be downloaded")
        // In module mode, the runtime module the release needs; bounded by the renderer.
        val prepared = presentation.unlessEnded {
            try {
                renderer.prepare(activity, reference)
                null
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                error
            }
        } ?: return presentation.ending?.getOrThrow() ?: FlowResult(FlowResult.DISMISSED)
        prepared.value?.let { error ->
            onWarning("The flow runtime for \"$location\" is not available: ${error.message}")
            throw FlowException(FlowFailure.UNAVAILABLE, "The flow runtime for \"$location\" is not available")
        }

        val paywallContext = paywall.showingId?.let { showingId ->
            PurchasePaywallContext(showingId, location, paywall.paywallId, paywall.releaseId)
        }
        val flow = PresentedFlow(
            activity, location, paywall.paywallId, paywallContext, reference,
            stateKey = paywall.paywallId ?: location,
            bytes = bytes,
            input = flowValues(input, "input of the flow for \"$location\""),
            actions = actions,
        )
        try {
            if (withContext(mainDispatcher) { show(flow, bytes, presentation) }) {
                scope.launch { if (flow.configured.compareAndSet(false, true)) configure(flow, requestId = null) }
            }
            return flow.result.await()
        } catch (error: CancellationException) {
            flow.dismiss()
            throw error
        }
    }

    /**
     * Closes the flow on screen, if any, and cancels every presentation that is not on screen
     * yet; each one's [present] returns the outcome [FlowResult.DISMISSED].
     */
    fun dismiss() {
        // Before the flow on screen is read: a presentation that goes on screen meanwhile has
        // either seen its dismissal or is the active flow by then.
        pending.toList().forEach { it.dismiss() }
        active.get()?.dismiss()
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
            flow.post(PaywallEnvelope.inputMessage(JSONObject(changed)))
        }
    }

    /** Main thread. Returns whether [flow] is on screen. */
    private fun show(flow: PresentedFlow, bytes: ByteArray, presentation: PendingPresentation): Boolean {
        active.getAndSet(flow)?.dismiss()
        // Dismissed, or past its deadline, after the package arrived and before anything was shown.
        presentation.ending?.let { ending ->
            flow.end(ending)
            return false
        }
        // Handed to the renderer: from here on the flow has no deadline.
        presentation.close()
        val session = try {
            renderer.present(flow.activity, bytes, flow.reference, flow.attachment)
        } catch (error: Exception) {
            flow.end(failed(FlowFailure.PRESENTATION_FAILED, "The flow could not be presented: ${error.message}"))
            return false
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
     * before it saved. The store is asked for the products once per presentation.
     */
    private suspend fun configure(flow: PresentedFlow, requestId: String?) {
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

        // With `updateInput`, so a change of inputs is either part of this or posted after it.
        synchronized(flow) {
            val config = buildPaywallRuntimeConfig(
                productIds = flow.reference.productIds,
                products = products,
                locale = locale,
                capabilities = capabilities.map { it.wireName },
                state = state,
                input = JSONObject(flow.input),
                onSkippedProduct = { reference -> onWarning("Paywall product not available in the store: $reference") },
            )
            flow.post(PaywallEnvelope.configureMessage(config, requestId))
        }
    }

    /** Main thread, from the renderer. */
    private fun handle(flow: PresentedFlow, raw: String) {
        val envelope = try {
            PaywallEnvelope.parse(raw)
        } catch (error: PaywallEnvelopeParseException) {
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
                scope.launch {
                    if (!first || flow.configured.compareAndSet(false, true)) configure(flow, envelope.requestId)
                }
            }
            "purchase", "restore" -> scope.launch { runAction(flow, envelope) }
            "close" -> {
                payload.optJSONObject("output")?.let { flow.output = it.toFlowValues() }
                flow.dismiss()
            }
            "openExternal" -> if (granted(FlowCapability.LINKS)) {
                guard("open ${payload.getString("url")}") { host.openUrl(payload.getString("url")) }
            }
            "finish" -> {
                guard("clear the flow state") { host.clearState(flow.stateKey) }
                payload.optJSONObject("output")?.let { flow.output = it.toFlowValues() }
                flow.end(Result.success(FlowResult(payload.getString("result"), flow.output)))
            }
            "appAction" -> flow.handlers.launch { callApp(flow, envelope) }
            "requestPermission" -> scope.launch { requestPermission(flow, envelope) }
            "setAttribute" -> setAttribute(payload)
            "track" -> guard("capture a flow event") {
                // Each runtime reports its view; the presentation was viewed once.
                if (payload.getString("name") == PAYWALL_VIEWED_EVENT && !flow.viewed.compareAndSet(false, true)) {
                    return@guard
                }
                val properties = payload.optJSONObject("properties").toMap() +
                    ("paywall_location" to flow.location) +
                    listOfNotNull(flow.paywallId?.let { "paywall_id" to it })
                host.capture(payload.getString("name"), properties)
            }
            "screen" -> guard("record a flow screen") {
                host.screen(
                    payload.getString("name"),
                    mapOf(
                        "paywall_location" to flow.location,
                        "flow_screen_index" to (payload.get("index") as Number).toInt(),
                    ),
                )
            }
            "state" -> {
                // Kept for an ending that reports none itself: a purchase, a restore, a dismissal.
                payload.optJSONObject("output")?.let { flow.output = it.toFlowValues() }
                guard("save the flow state") { host.saveState(flow.stateKey, payload.getJSONObject("variables")) }
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
    private suspend fun callApp(flow: PresentedFlow, envelope: PaywallInboundEnvelope) {
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
            flow.post(PaywallEnvelope.appActionFailure(requestId, "No handler is registered for \"$name\""))
            return
        }
        val answer = try {
            val reply = handler.handle(envelope.payload.optJSONObject("args").toFlowValues())
            PaywallEnvelope.appActionReply(
                requestId,
                JSONObject(flowValues(reply, "reply of the app action \"$name\"")),
            )
        } catch (error: Throwable) {
            // Cancelled because the flow ended: there is nothing left to answer.
            currentCoroutineContext().ensureActive()
            onWarning("The handler of the app action \"$name\" failed: ${error.message}")
            PaywallEnvelope.appActionFailure(requestId, error.message.orEmpty().ifEmpty { "The app action failed" })
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

    private suspend fun requestPermission(flow: PresentedFlow, envelope: PaywallInboundEnvelope) {
        val permission = envelope.payload.getString("permission")
        val capability = FlowCapability.values().firstOrNull {
            it.wireName == permission && (it == FlowCapability.NOTIFICATIONS || it == FlowCapability.TRACKING)
        }
        val grantedByUser = when {
            capability == null -> {
                onWarning("Dropped a request for the unknown permission \"$permission\"")
                false
            }
            !granted(capability) -> false
            else -> suspendGuard("request the $permission permission") {
                host.requestPermission(flow.activity, permission)
            } ?: false
        }
        val requestId = envelope.requestId ?: return
        flow.post(
            PaywallEnvelope.successResponse(
                "requestPermission",
                requestId,
                JSONObject().put("granted", grantedByUser),
            ),
        )
    }

    private suspend fun runAction(flow: PresentedFlow, envelope: PaywallInboundEnvelope) {
        if (!flow.actionInFlight.compareAndSet(false, true)) {
            flow.post(
                PaywallEnvelope.errorResponse(envelope.type, "ACTION_BUSY", ACTION_BUSY_MESSAGE, envelope.requestId),
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

    private suspend fun runPurchase(flow: PresentedFlow, envelope: PaywallInboundEnvelope) {
        val requestedProductId = envelope.payload.getString("productId")
        flow.status(PaywallEnvelope.statusMessage("purchasing", envelope.requestId, requestedProductId))

        val product = findProduct(requestedProductId)
        if (product == null) {
            val message = "Product not found: $requestedProductId"
            flow.status(PaywallEnvelope.statusMessage("failed", envelope.requestId, error = message))
            flow.post(PaywallEnvelope.errorResponse("purchase", "ACTION_FAILED", message, envelope.requestId))
            return
        }

        val offerId = envelope.payload.optString("offerId").ifEmpty { null }
        when {
            flow.paywallContext != null -> host.purchase(product, offerId, flow.paywallContext)
            offerId == null -> host.purchase(product)
            else -> host.purchase(product, offerId)
        }

        flow.status(PaywallEnvelope.statusMessage("purchased", envelope.requestId, product.slug))
        flow.post(
            PaywallEnvelope.successResponse("purchase", envelope.requestId, JSONObject().put("productId", product.slug)),
        )
        // The purchase says whether the flow is done; one that does not
        // follows the flow (a paywall is done, an onboarding carries on).
        if (!endsFlow(flow, envelope)) return
        guard("clear the flow state") { host.clearState(flow.stateKey) }
        flow.end(Result.success(FlowResult(FlowResult.PURCHASED, flow.output, product.slug)))
    }

    private suspend fun runRestore(flow: PresentedFlow, envelope: PaywallInboundEnvelope) {
        flow.status(PaywallEnvelope.statusMessage("restoring", envelope.requestId))

        host.restorePurchases()

        flow.status(PaywallEnvelope.statusMessage("restored", envelope.requestId))
        flow.post(PaywallEnvelope.successResponse("restore", envelope.requestId))
        if (!endsFlow(flow, envelope)) return
        flow.end(Result.success(FlowResult(FlowResult.RESTORED, flow.output)))
    }

    /**
     * Whether a successful purchase or restore ends the flow: as the action says
     * (`endsFlow`, flow packages from ABI 11), or else as the flow does.
     */
    private fun endsFlow(flow: PresentedFlow, envelope: PaywallInboundEnvelope): Boolean =
        (envelope.payload.opt("endsFlow") as? Boolean) ?: flow.reference.shouldEndFlowOnPurchase

    /** Resolves the flow's product reference against the store products; see [findFlowProduct]. */
    private suspend fun findProduct(productId: String): VoidhashProduct? = findFlowProduct(host.products(), productId)

    private fun reportActionFailure(flow: PresentedFlow, envelope: PaywallInboundEnvelope, error: Throwable) {
        val message = error.message.orEmpty().ifEmpty { "Unknown paywall bridge action error" }
        val cancelled = isPurchaseCancellation(error)

        flow.status(
            PaywallEnvelope.statusMessage(if (cancelled) "cancelled" else "failed", envelope.requestId, error = message),
        )
        if (!cancelled) onWarning("Paywall ${envelope.type} action failed: $message")
        flow.post(PaywallEnvelope.errorResponse(envelope.type, "ACTION_FAILED", message, envelope.requestId))
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
        val paywallId: String?,
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
    ) : Application.ActivityLifecycleCallbacks {
        val result = CompletableDeferred<FlowResult>()

        /** The flow's outputs as it last reported them. */
        @Volatile
        var output: Map<String, Any> = emptyMap()

        /** Runs the app's action handlers; cancelled when the flow ends. */
        val handlers = CoroutineScope(scope.coroutineContext + SupervisorJob(scope.coroutineContext[Job]))
        val ended = AtomicBoolean(false)
        val configured = AtomicBoolean(false)
        val actionInFlight = AtomicBoolean(false)

        /** Whether a runtime of this presentation reported `ready` before. */
        val readied = AtomicBoolean(false)

        /** Whether the presentation's view was captured. */
        val viewed = AtomicBoolean(false)

        /** The store products the flow was configured with; `null` until the store answered. */
        @Volatile
        var products: List<VoidhashProduct>? = null

        /** Touched on the main thread only, like everything below. */
        var session: PaywallRendererSession? = null

        /** The renderer's host of the session on screen. */
        var attachment = Attachment()
            private set

        /** The last status the flow was told, which a session presented again starts with. */
        private var lastStatus: String? = null

        /** Whether [activity] is being recreated and the flow waits for its successor. */
        private var recreating = false

        /** The recreated activity, between its creation and its start. */
        private var successor: Activity? = null

        /** Ends the flow when no successor of [activity] starts in time. */
        private var recreationDeadline: Job? = null

        /** Where the activity callbacks are registered while the flow is on screen. */
        private var application: Application? = null

        /** Delivers [message] to the flow, after every message posted before it. */
        fun post(message: String) = onMain { session?.postMessage(message) }

        /** [post] for a `status`, which is kept for a session presented again. */
        fun status(message: String) = onMain {
            lastStatus = message
            session?.postMessage(message)
        }

        /** Ends the presentation as dismissed, with the outputs the flow reported by now. */
        fun dismiss() = end(Result.success(FlowResult(FlowResult.DISMISSED, output)))

        /** Ends the presentation with [outcome] and removes it from the screen; later calls do nothing. */
        fun end(outcome: Result<FlowResult>) {
            if (!ended.compareAndSet(false, true)) return
            active.compareAndSet(this, null)
            outcome.fold(result::complete, result::completeExceptionally)
            handlers.cancel()
            onMain {
                application?.unregisterActivityLifecycleCallbacks(this)
                application = null
                recreationDeadline?.cancel()
                recreationDeadline = null
                successor = null
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
            attachment.detached = true
            val presented = session
            session = null
            // A renderer dismisses a session whose activity went away by itself; one that has
            // not yet must not keep a window on the destroyed activity.
            presented?.dismiss()
            // Without a successor to show the flow above, its caller must not wait for good.
            recreationDeadline = scope.launch {
                delay(RECREATION_WAIT_MS)
                onMain { if (recreating) dismiss() }
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
                )
                return
            }
            // Ended while the renderer was presenting, as in `show`: its window must not stay.
            if (ended.get()) {
                presented.dismiss()
                return
            }
            session = presented
            // The new runtime reports `ready` and is configured from the saved state; an action
            // still running is not part of that state.
            lastStatus?.let(presented::postMessage)
        }

        override fun onActivityDestroyed(destroyed: Activity) {
            if (ended.get()) return
            when {
                // Created to replace the flow's activity and gone before it started, as one that
                // finishes in `onCreate` is: there is nothing to show the flow above.
                destroyed === successor -> dismiss()
                destroyed !== activity -> Unit
                destroyed.isChangingConfigurations -> awaitRecreation()
                // Gone for good. Ended here rather than by the renderer's dismissal alone, which
                // a renderer that keeps no watch on its activity never reports.
                !recreating -> dismiss()
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

        override fun onActivityResumed(activity: Activity) {}

        override fun onActivityPaused(activity: Activity) {}

        override fun onActivityStopped(activity: Activity) {}

        override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}

        /** The renderer's host for one session of the flow. */
        inner class Attachment : PaywallRendererHost {
            /** Set once the session's activity is being recreated; main thread only. */
            var detached = false

            override fun onMessage(message: String) {
                if (!detached && !ended.get()) handle(this@PresentedFlow, message)
            }

            override fun onWarning(message: String) {
                this@PaywallCoordinator.onWarning("Paywall for \"$location\": $message")
            }

            override fun onFailure(message: String) {
                if (detached) return
                this@PaywallCoordinator.onWarning("Paywall for \"$location\" failed: $message")
                end(failed(FlowFailure.PRESENTATION_FAILED, message))
            }

            override fun loadImage(url: String, onResult: (Result<ByteArray>) -> Unit): Boolean {
                val load = loadImage ?: return false
                scope.launch {
                    val result = try {
                        Result.success(load(url))
                    } catch (error: CancellationException) {
                        throw error
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
                dismiss()
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
