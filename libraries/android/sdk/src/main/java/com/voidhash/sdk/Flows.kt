package com.voidhash.sdk

/**
 * What a presented flow may do beyond showing screens, purchasing and restoring. Grant them
 * through [VoidhashOptions.flowCapabilities]; a flow action that needs a capability the app did
 * not grant is dropped.
 *
 * @property wireName the name the flow knows the capability by.
 */
enum class FlowCapability(val wireName: String) {
    /** Ask the user for permission to post notifications. */
    NOTIFICATIONS("notifications"),

    /** Ask the user for permission to track. Android has no such prompt; the request answers false. */
    TRACKING("tracking"),

    /** Set attributes on the current person, as [VoidhashClient.setPersonAttributes] does. */
    ATTRIBUTES("attributes"),

    /** Open links in the browser or the app that handles them. */
    LINKS("links"),
}

/** How a flow presented with [VoidhashClient.presentFlow] ended. */
sealed class FlowResult {
    /**
     * The flow reached one of its finish actions.
     *
     * @property result the name the flow gave this ending.
     * @property variables the flow's variables when it finished, such as answers to a survey.
     */
    data class Finished(val result: String, val variables: Map<String, Any?>) : FlowResult()

    /** The user bought the product [productSlug] from the flow. */
    data class Purchased(val productSlug: String) : FlowResult()

    /** The user restored their purchases from the flow. */
    data object Restored : FlowResult()

    /**
     * The flow was closed: by its close action, by the user leaving it, by
     * [VoidhashClient.dismissFlow], or by another flow presented in its place.
     */
    data object Closed : FlowResult()

    /** The flow could not be presented, or stopped because it could not keep running. */
    data class Failed(val error: FlowException) : FlowResult()
}

/** Why a flow could not be presented. */
enum class FlowFailure {
    /** The SDK is disabled or was shut down. */
    DISABLED,

    /** No flow is assigned to the placement for this user. */
    NOT_ASSIGNED,

    /**
     * Nothing is cached and Voidhash is unreachable, the flow could not be downloaded or
     * verified, or it was not ready to show within 15 seconds of the call that presents it.
     */
    UNAVAILABLE,

    /** The app did not configure a renderer ([VoidhashOptions.paywallRenderer]). */
    RENDERER_MISSING,

    /** This SDK cannot draw the flow's package version; update the SDK. */
    UNSUPPORTED_PACKAGE,

    /** The flow could not be shown, or failed while it was on screen. */
    PRESENTATION_FAILED,
}

/**
 * The error of a [FlowResult.Failed]. Its [code] is `FLOW_<reason>`.
 *
 * @property abiVersion the package version the renderer could not draw, for
 *   [FlowFailure.UNSUPPORTED_PACKAGE].
 */
class FlowException(
    val reason: FlowFailure,
    message: String,
    val abiVersion: Int? = null,
) : VoidhashException("FLOW_${reason.name}", message)
