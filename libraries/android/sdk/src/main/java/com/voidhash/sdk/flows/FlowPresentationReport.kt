package com.voidhash.sdk.flows

import com.voidhash.sdk.api.PaywallAnswer

/** The flow was drawn: one per presentation, its first event when it got that far. */
internal const val FLOW_VIEWED_EVENT = "\$paywall_viewed"

/** The presentation failed before its view. */
internal const val FLOW_LOAD_FAILED_EVENT = "\$paywall_load_failed"

/** The presentation was given up before its view. */
internal const val FLOW_LOAD_CANCELLED_EVENT = "\$paywall_load_cancelled"

/** A viewed flow ended through an end step, or a purchase or restore that ends it. */
internal const val FLOW_COMPLETED_EVENT = "\$paywall_completed"

/** A viewed flow was closed any other way. */
internal const val FLOW_DISMISSED_EVENT = "\$paywall_dismissed"

/**
 * An answer was handed to the app, which may show it however it likes. Not a presentation: it
 * carries the answer's exposure token, so the person is counted in the A/B test that chose it.
 */
internal const val FLOW_HANDED_OFF_EVENT = "\$paywall_handed_off"

/**
 * An image the flow's build pinned arrived as other bytes than the build recorded, so it was not
 * shown: a health signal of the release, not a presentation, with the image's `imageUrl`.
 */
internal const val FLOW_IMAGE_INTEGRITY_FAILED_EVENT = "\$paywall_image_integrity_failed"

/** The event names only the SDK reports: a flow tracking one of them is not passed on. */
internal val SDK_FLOW_EVENTS = setOf(
    FLOW_IMAGE_INTEGRITY_FAILED_EVENT,
    FLOW_VIEWED_EVENT,
    FLOW_LOAD_FAILED_EVENT,
    FLOW_LOAD_CANCELLED_EVENT,
    FLOW_COMPLETED_EVENT,
    FLOW_DISMISSED_EVENT,
    FLOW_HANDED_OFF_EVENT,
)

/** The property the answer's exposure token is sent as. */
internal const val EXPOSURE_TOKEN_PROPERTY = "exposureToken"

/** The properties of the runtime's view that the SDK's view carries. */
private val RUNTIME_VIEW_PROPERTIES = setOf("flow_screen_index", "flow_screen_name")

/**
 * Why a presentation failed before its view (`reason`). Android tells these apart; a flow
 * runtime failing and the renderer failing to draw both reach the SDK as the renderer's failure,
 * reported as [RENDER_FAILED], and a flow whose store products cannot be had is still shown,
 * its view carrying `productsUnavailable`.
 */
internal enum class FlowLoadFailure(val wireName: String) {
    PACKAGE_DOWNLOAD_FAILED("package_download_failed"),
    PACKAGE_INTEGRITY_FAILED("package_integrity_failed"),
    PACKAGE_UNSUPPORTED("package_unsupported"),
    RUNTIME_DOWNLOAD_FAILED("runtime_download_failed"),
    RENDER_FAILED("render_failed"),
    TIMEOUT("timeout"),

    /** Anything else, a package withdrawn with nothing to fall back to included. */
    OTHER("other"),
}

/** How a presented flow left the screen, or never got there. */
internal enum class FlowEnding {
    /** Through an end step (`finish`). */
    END_STEP,

    /** A successful purchase that ends the flow. */
    PURCHASE,

    /** A successful restore that ends the flow. */
    RESTORE,

    /** The flow's own close action. */
    CLOSE,

    /** The end user took it off the screen without it: the back gesture, a system dismissal. */
    SYSTEM,

    /**
     * The app closed it, or its window went away without the end user: `dismissFlow`, a
     * cancelled caller, another presentation, a shutdown, its activity destroyed for good.
     */
    APP,

    /** It could no longer be drawn. */
    ERROR,
}

/**
 * The properties naming the flow [answer] shows at [location], which every event about it carries:
 * the lifecycle events, its hand-off and the flow's own `track` and `$screen` events.
 */
internal fun flowProperties(location: String, answer: PaywallAnswer): Map<String, Any?> = buildMap {
    put("paywall_location", location)
    answer.locationId?.let { put("paywallLocationId", it) }
    answer.paywall.showingId?.let { put("paywallShowingId", it) }
    answer.paywall.paywallId?.let { put("paywallId", it) }
    answer.releaseId?.let { put("paywallReleaseId", it) }
}

/**
 * What one presentation of a flow reports to analytics, through [capture].
 *
 * A presentation is one attempt to show one resolve answer; a retry is a new one. It reports
 * exactly one first event: `$paywall_viewed`, or, before that, `$paywall_load_failed` or
 * `$paywall_load_cancelled`. A viewed presentation then reports exactly one ending,
 * `$paywall_completed` or `$paywall_dismissed`, unless the process dies first. One that never got
 * an answer naming a flow package ([show]) reports nothing: there was nothing to show.
 *
 * The view is the flow runtime's own `$paywall_viewed`, which it tracks once configured, with its
 * `flow_screen_*` properties; a flow that ends before its runtime tracked it was never viewed.
 *
 * The answer's exposure token rides on the first event only, unchanged. Every value is bounded:
 * no message of the device, the store or an error is ever reported. Thread-safe; events are
 * captured in the order they happened.
 *
 * @param startedAt when the app asked to present, in [now]'s monotonic milliseconds.
 */
internal class FlowPresentationReport(
    private val location: String,
    private val now: () -> Long,
    private val startedAt: Long = now(),
    private val capture: (name: String, properties: Map<String, Any?>) -> Unit,
) {
    private var answer: PaywallAnswer? = null
    private var viewed = false
    private var reportedFirst = false
    private var reportedEnding = false

    /**
     * Where the package shown came from, which every event about the flow carries once it is
     * known as `packageSource`: `network` (downloaded for this presentation), `cache` (already on
     * the device, a fallback to an earlier package included) or `bundled` (the app's own).
     */
    @Volatile
    var packageSource: String? = null

    /** Whether the flow was configured without its store products: the store failed, or had none of them. */
    @Volatile
    var productsUnavailable = false

    /** The presentation shows [answer]; until then it reports nothing. */
    @Synchronized
    fun show(answer: PaywallAnswer) {
        this.answer = answer
    }

    /** See [flowProperties]; only `paywall_location` before the answer is known. */
    @Synchronized
    fun context(): Map<String, Any?> {
        val answer = answer ?: return mapOf("paywall_location" to location)
        val properties = flowProperties(location, answer)
        return packageSource?.let { properties + ("packageSource" to it) } ?: properties
    }

    /** The flow's runtime tracked its view, with [properties]. */
    @Synchronized
    fun viewed(properties: Map<String, Any?>) {
        if (viewed || reportedFirst) return
        viewed = true
        val own = properties.filterKeys { it in RUNTIME_VIEW_PROPERTIES }
        first(FLOW_VIEWED_EVENT, if (productsUnavailable) own + ("productsUnavailable" to true) else own)
    }

    /** The presentation failed before its view. */
    @Synchronized
    fun failed(reason: FlowLoadFailure) {
        first(FLOW_LOAD_FAILED_EVENT, mapOf("reason" to reason.wireName))
    }

    /**
     * The image at [url], which the package pins, arrived as other bytes than its build recorded.
     * Its address alone is reported, never its bytes; nothing before the answer is known.
     */
    @Synchronized
    fun imageIntegrityFailed(url: String) {
        if (answer == null) return
        capture(FLOW_IMAGE_INTEGRITY_FAILED_EVENT, context() + ("imageUrl" to url))
    }

    /** The app gave up on the presentation before its view. */
    @Synchronized
    fun cancelledByApp() {
        first(FLOW_LOAD_CANCELLED_EVENT, mapOf("cancelledBy" to "app"))
    }

    /** The end user gave up on the presentation before its view, leaving its loading state. */
    @Synchronized
    fun cancelledByEndUser() {
        first(FLOW_LOAD_CANCELLED_EVENT, mapOf("cancelledBy" to "end_user"))
    }

    /**
     * The flow left the screen, [ending] as the reason: the ending of a viewed flow, else the
     * presentation's first event.
     */
    @Synchronized
    fun ended(ending: FlowEnding) {
        if (!viewed) {
            when (ending) {
                FlowEnding.ERROR -> failed(FlowLoadFailure.RENDER_FAILED)
                FlowEnding.APP -> cancelledByApp()
                else -> cancelledByEndUser()
            }
            return
        }
        if (reportedEnding) return
        reportedEnding = true
        val (name, outcome) = when (ending) {
            FlowEnding.END_STEP -> FLOW_COMPLETED_EVENT to ("completion" to "end_step")
            FlowEnding.PURCHASE -> FLOW_COMPLETED_EVENT to ("completion" to "purchase")
            FlowEnding.RESTORE -> FLOW_COMPLETED_EVENT to ("completion" to "restore")
            FlowEnding.CLOSE -> FLOW_DISMISSED_EVENT to ("reason" to "close")
            FlowEnding.SYSTEM -> FLOW_DISMISSED_EVENT to ("reason" to "system")
            FlowEnding.APP -> FLOW_DISMISSED_EVENT to ("reason" to "app")
            FlowEnding.ERROR -> FLOW_DISMISSED_EVENT to ("reason" to "error")
        }
        capture(name, context() + outcome)
    }

    private fun first(name: String, properties: Map<String, Any?>) {
        val answer = answer ?: return
        if (reportedFirst) return
        reportedFirst = true
        val measured = properties + ("loadDurationMs" to (now() - startedAt).coerceAtLeast(0))
        val token = answer.exposureToken?.let { mapOf(EXPOSURE_TOKEN_PROPERTY to it.value) }.orEmpty()
        capture(name, context() + measured + token)
    }
}
