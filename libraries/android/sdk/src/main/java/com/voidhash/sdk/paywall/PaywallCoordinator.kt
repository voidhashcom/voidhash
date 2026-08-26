package com.voidhash.sdk.paywall

import com.voidhash.core.paywall.PaywallPresenterCore
import com.voidhash.sdk.api.ResolvedPaywall
import com.voidhash.sdk.billing.VoidhashProduct
import com.voidhash.sdk.billing.VoidhashTransaction
import kotlinx.coroutines.CancellationException
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicBoolean

/** The presenter surface the coordinator drives; implemented by [PaywallPresenterCore]. */
interface PaywallPresenterPort {
    /**
     * Presents [htmlUrl] fullscreen for [locationSlug], routing page → native
     * messages to [onBridgeEvent] and the dismissal to [onDismiss].
     *
     * @return false when the paywall could not be presented.
     */
    suspend fun show(
        locationSlug: String,
        htmlUrl: String,
        onBridgeEvent: ((String) -> Unit)?,
        onDismiss: (() -> Unit)?,
    ): Boolean

    /** Dismisses the currently presented paywall. */
    suspend fun dismiss()

    /** Delivers one native → page bridge message to the paywall for [locationSlug]. */
    fun postMessage(locationSlug: String, data: String)
}

/** [PaywallPresenterPort] backed by the shared [PaywallPresenterCore]. */
class DefaultPaywallPresenterPort(
    private val presenter: PaywallPresenterCore,
) : PaywallPresenterPort {
    override suspend fun show(
        locationSlug: String,
        htmlUrl: String,
        onBridgeEvent: ((String) -> Unit)?,
        onDismiss: (() -> Unit)?,
    ): Boolean = presenter.show(locationSlug, htmlUrl, onBridgeEvent, onDismiss)

    override suspend fun dismiss() = presenter.dismiss()

    override fun postMessage(locationSlug: String, data: String) =
        presenter.postMessage(locationSlug, data)
}

/** Callbacks a host app can observe while a paywall is presented. */
interface PaywallListener {
    /** A custom analytics event emitted by the paywall bundle. */
    fun onEvent(name: String, properties: Map<String, Any?>) {}

    /** A log line emitted by the paywall bundle. */
    fun onLog(level: String, message: String) {}

    /** A purchase started from the paywall completed successfully. */
    fun onPurchaseCompleted(transaction: VoidhashTransaction) {}

    /** A purchase started from the paywall failed (never fires on user cancellation). */
    fun onPurchaseFailed(error: Throwable) {}

    /** A restore started from the paywall completed successfully. */
    fun onRestoreCompleted() {}

    /** The paywall was dismissed. */
    fun onDismiss() {}
}

/** Purchase and restore operations the coordinator delegates to. */
interface PaywallPurchaseHandler {
    suspend fun products(): List<VoidhashProduct>

    suspend fun purchase(product: VoidhashProduct): VoidhashTransaction

    suspend fun restorePurchases()
}

private const val ACTION_BUSY_MESSAGE = "Another paywall action is already running"

/**
 * Resolves the paywall configured for a location, presents it, and speaks the
 * bridge protocol on the native side: `ready` is answered with a `configure`
 * envelope carrying the runtime config, `purchase` and `restore` emit the
 * matching `status` sequences and dismiss on success, `close` dismisses, and
 * `event` / `log` are forwarded to the host listener.
 *
 * @param onCapture receives `event` envelopes for the SDK's analytics queue.
 * @param onWarning receives anomalies the coordinator recovers from.
 */
class PaywallCoordinator(
    private val presenter: PaywallPresenterPort,
    private val purchaseHandler: PaywallPurchaseHandler,
    private val resolvePaywall: suspend (String) -> ResolvedPaywall?,
    private val openExternal: (String) -> Unit = {},
    private val locale: String? = null,
    private val onCapture: (String, Map<String, Any?>) -> Unit = { _, _ -> },
    private val onWarning: (String) -> Unit = {},
) {
    @Volatile
    private var activePaywall: ResolvedPaywall? = null

    @Volatile
    private var activeListener: PaywallListener? = null

    private val actionInFlight = AtomicBoolean(false)

    /**
     * Presents the paywall configured for [locationSlug].
     *
     * @return false when the backend has no paywall showing for the location or
     * the presenter declines to show it.
     */
    suspend fun present(
        locationSlug: String,
        listener: PaywallListener?,
        onBridgeEvent: ((String) -> Unit)? = null,
    ): Boolean {
        val paywall = resolvePaywall(locationSlug) ?: return false

        activePaywall = paywall
        activeListener = listener
        actionInFlight.set(false)

        val shown = presenter.show(
            locationSlug,
            paywall.htmlUrl,
            onBridgeEvent,
            {
                activePaywall = null
                actionInFlight.set(false)
                listener?.onDismiss()
                activeListener = null
            },
        )

        if (!shown) {
            activePaywall = null
            activeListener = null
            return false
        }

        // A warm bundle announces `ready` once, before `show` attaches the
        // handler above, so the ready-triggered configure never runs for it.
        // The runtime applies `configure` idempotently, so re-sending it here
        // covers the warm path without breaking the cold one.
        sendConfigureMessage(locationSlug, requestId = null)
        return true
    }

    /** Handles one raw page → native bridge message for [locationSlug]. */
    suspend fun handleBridgeMessage(locationSlug: String, raw: String) {
        val envelope = try {
            PaywallEnvelope.parse(raw)
        } catch (error: PaywallEnvelopeParseException) {
            onWarning("Ignoring unrecognized paywall bridge message: ${error.message}")
            return
        }

        when (envelope.type) {
            "ready" -> sendConfigureMessage(locationSlug, envelope.requestId)
            "purchase", "restore" -> runBridgeAction(locationSlug, envelope)
            "close" -> presenter.dismiss()
            "openExternal" -> openExternal(envelope.payload.getString("url"))
            "event" -> handleEvent(locationSlug, envelope)
            "log" -> notifyListener("log") {
                activeListener?.onLog(
                    envelope.payload.getString("level"),
                    envelope.payload.getString("message"),
                )
            }
        }
    }

    /**
     * Answers a bridge message whose handling threw before it could respond, so
     * a paywall page never waits forever on a request that vanished.
     */
    fun reportBridgeMessageFailure(locationSlug: String, raw: String, error: Throwable) {
        onWarning("Failed to handle paywall bridge message: ${error.message}")

        val envelope = runCatching { PaywallEnvelope.parse(raw) }.getOrNull() ?: return
        val requestId = envelope.requestId ?: return

        presenter.postMessage(
            locationSlug,
            PaywallEnvelope.errorResponse(
                envelope.type,
                "ACTION_FAILED",
                error.message.orEmpty(),
                requestId,
            ),
        )
    }

    private suspend fun sendConfigureMessage(locationSlug: String, requestId: String?) {
        val paywall = activePaywall ?: return
        if (!paywall.hasRuntime) return

        // A store failure must not leave the bundle configless: it still gets
        // the release's variables, just without products.
        val products = try {
            purchaseHandler.products()
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            onWarning("Failed to resolve paywall products: ${error.message}")
            emptyList()
        }

        val config = buildPaywallRuntimeConfig(
            paywall = paywall,
            productsBySlug = products.associateBy { it.slug },
            locale = locale,
            onSkippedProductSlug = { slug ->
                onWarning("Paywall product slug not available in the store: $slug")
            },
        )

        presenter.postMessage(locationSlug, PaywallEnvelope.configureMessage(config, requestId))
    }

    private suspend fun runBridgeAction(locationSlug: String, envelope: PaywallInboundEnvelope) {
        if (!actionInFlight.compareAndSet(false, true)) {
            if (envelope.type == "purchase") {
                notifyListener("purchase failure") {
                    activeListener?.onPurchaseFailed(Error(ACTION_BUSY_MESSAGE))
                }
            }
            presenter.postMessage(
                locationSlug,
                PaywallEnvelope.errorResponse(
                    envelope.type,
                    "ACTION_BUSY",
                    ACTION_BUSY_MESSAGE,
                    envelope.requestId,
                ),
            )
            return
        }

        try {
            if (envelope.type == "purchase") {
                runPurchase(locationSlug, envelope)
            } else {
                runRestore(locationSlug, envelope)
            }
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            reportActionFailure(locationSlug, envelope, error)
        } finally {
            actionInFlight.set(false)
        }
    }

    private suspend fun runPurchase(locationSlug: String, envelope: PaywallInboundEnvelope) {
        val requestedProductId = envelope.payload.getString("productId")

        presenter.postMessage(
            locationSlug,
            PaywallEnvelope.statusMessage("purchasing", envelope.requestId, requestedProductId),
        )

        val product = findProduct(requestedProductId)
        if (product == null) {
            val message = "Product not found: $requestedProductId"
            presenter.postMessage(
                locationSlug,
                PaywallEnvelope.statusMessage("failed", envelope.requestId, error = message),
            )
            notifyListener("purchase failure") { activeListener?.onPurchaseFailed(Error(message)) }
            presenter.postMessage(
                locationSlug,
                PaywallEnvelope.errorResponse("purchase", "ACTION_FAILED", message, envelope.requestId),
            )
            return
        }

        val transaction = purchaseHandler.purchase(product)

        presenter.postMessage(
            locationSlug,
            PaywallEnvelope.statusMessage("purchased", envelope.requestId, product.id),
        )
        presenter.postMessage(
            locationSlug,
            PaywallEnvelope.successResponse(
                "purchase",
                envelope.requestId,
                JSONObject().put("productId", product.id),
            ),
        )

        notifyListener("purchase completion") { activeListener?.onPurchaseCompleted(transaction) }
        dismissQuietly()
    }

    private suspend fun runRestore(locationSlug: String, envelope: PaywallInboundEnvelope) {
        presenter.postMessage(
            locationSlug,
            PaywallEnvelope.statusMessage("restoring", envelope.requestId),
        )

        purchaseHandler.restorePurchases()

        presenter.postMessage(
            locationSlug,
            PaywallEnvelope.statusMessage("restored", envelope.requestId),
        )
        presenter.postMessage(
            locationSlug,
            PaywallEnvelope.successResponse("restore", envelope.requestId),
        )

        notifyListener("restore completion") { activeListener?.onRestoreCompleted() }
        dismissQuietly()
    }

    /**
     * Resolves the bridge's product id against the store products: by store id
     * first, then by slug. The Android store id *is* the Play provider product
     * id, so the TypeScript lookup's third step collapses into the first.
     */
    private suspend fun findProduct(productId: String): VoidhashProduct? {
        val products = purchaseHandler.products()
        return products.firstOrNull { it.id == productId }
            ?: products.firstOrNull { it.slug == productId }
    }

    private fun reportActionFailure(
        locationSlug: String,
        envelope: PaywallInboundEnvelope,
        error: Throwable,
    ) {
        val message = error.message.orEmpty().ifEmpty { "Unknown paywall bridge action error" }
        val cancelled = isPurchaseCancellation(error)

        presenter.postMessage(
            locationSlug,
            PaywallEnvelope.statusMessage(
                if (cancelled) "cancelled" else "failed",
                envelope.requestId,
                error = message,
            ),
        )

        if (!cancelled) {
            onWarning("Paywall ${envelope.type} action failed: $message")
            if (envelope.type == "purchase") {
                notifyListener("purchase failure") { activeListener?.onPurchaseFailed(error) }
            }
        }

        presenter.postMessage(
            locationSlug,
            PaywallEnvelope.errorResponse(envelope.type, "ACTION_FAILED", message, envelope.requestId),
        )
    }

    private fun handleEvent(locationSlug: String, envelope: PaywallInboundEnvelope) {
        val name = envelope.payload.getString("name")
        val properties = envelope.payload.optJSONObject("properties").toMap()

        onCapture(name, properties + ("paywall_location" to locationSlug))
        notifyListener("event") { activeListener?.onEvent(name, properties) }
    }

    private suspend fun dismissQuietly() {
        try {
            presenter.dismiss()
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            onWarning("Failed to dismiss the paywall: ${error.message}")
        }
    }

    /**
     * Runs a host callback. Host code is untrusted here: a listener that throws
     * must not turn an already-completed purchase into a failure envelope.
     */
    private fun notifyListener(context: String, notify: () -> Unit) {
        try {
            notify()
        } catch (error: Throwable) {
            onWarning("Paywall listener threw on $context: ${error.message}")
        }
    }

    private fun isPurchaseCancellation(error: Throwable): Boolean {
        var current: Throwable? = error
        val visited = mutableSetOf<Throwable>()
        while (current != null && visited.add(current)) {
            if (current.message.orEmpty().startsWith("USER_CANCELLED")) {
                return true
            }
            current = current.cause
        }
        return false
    }

    private fun JSONObject?.toMap(): Map<String, Any?> {
        if (this == null) return emptyMap()
        return keys().asSequence().associateWith { key ->
            get(key).takeUnless { it === JSONObject.NULL }
        }
    }
}
