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

/**
 * Answers an app action a flow calls while it is shown; see `actions` of
 * [VoidhashClient.presentFlow].
 */
fun interface FlowActionHandler {
    /**
     * Runs the action with the [arguments] the flow passed, by name, and returns the reply's
     * fields by name. Values are a [String], a [Number] or a [Boolean]; numbers arrive as
     * [Double]. Throwing fails the call, and the flow carries on as it was designed to for a
     * failed call. The coroutine is cancelled when the flow ends before the handler returns.
     */
    suspend fun handle(arguments: Map<String, Any>): Map<String, Any>
}

/**
 * How a flow presented with [VoidhashClient.presentFlow] ended.
 *
 * @property outcome [PURCHASED] when a purchase ended the flow, [RESTORED] when a restore did,
 *   [DISMISSED] when it was closed: by the user, by [VoidhashClient.dismissFlow], by another
 *   flow presented in its place, or because the client shut down. Otherwise the outcome the flow
 *   finished with, such as `completed`.
 * @property output the flow's outputs by name: each a [String], a [Double] or a [Boolean]. Empty
 *   when the flow has none or reported none.
 * @property productId the slug of the product that was bought, when the outcome is [PURCHASED].
 */
data class FlowResult(
    val outcome: String,
    val output: Map<String, Any> = emptyMap(),
    val productId: String? = null,
) {
    companion object {
        /** A purchase ended the flow. */
        const val PURCHASED = "purchased"

        /** A restore ended the flow. */
        const val RESTORED = "restored"

        /** The flow was closed without finishing. */
        const val DISMISSED = "dismissed"
    }
}

/**
 * The inputs of a location as a type; generated code declares one per location and converts it
 * to the values [VoidhashClient.presentFlow] takes.
 */
interface FlowInput {
    /** The inputs by name: each a [String], a [Number] or a [Boolean]. */
    fun toFlowValues(): Map<String, Any>
}

/**
 * The app actions of a location as a type; generated code declares one per location and adapts
 * its methods to handlers by name.
 */
interface FlowActions {
    /** A handler for each action, by the action's name. */
    fun flowHandlers(): Map<String, FlowActionHandler>
}

/** The input of a location that takes none. */
object NoFlowInput : FlowInput {
    override fun toFlowValues(): Map<String, Any> = emptyMap()
}

/** The actions of a location whose flows call none. */
object NoFlowActions : FlowActions {
    override fun flowHandlers(): Map<String, FlowActionHandler> = emptyMap()
}

/**
 * A location with the types of what crosses between the app and the flow shown there, for the
 * typed [VoidhashClient.presentFlow].
 *
 * @property slug the location's slug.
 * @property revision the revision of the location's interface these types were made from.
 * @property output reads the typed output from a flow's outputs by name; an output that is
 *   missing or of another type reads as its default.
 * @property outcome reads the typed outcome from its name, also for a name the types do not know.
 */
class FlowLocation<Input : FlowInput, Output, Outcome, Actions : FlowActions>(
    val slug: String,
    val revision: Int,
    val output: (Map<String, Any>) -> Output,
    val outcome: (String) -> Outcome,
)

/**
 * How a flow presented at a [FlowLocation] ended.
 *
 * @property productId the slug of the product that was bought, when a purchase ended the flow.
 */
data class TypedFlowResult<Output, Outcome>(
    val outcome: Outcome,
    val output: Output,
    val productId: String?,
)

/** Why a flow could not be presented. */
enum class FlowFailure {
    /** The SDK is disabled or was shut down. */
    DISABLED,

    /** No flow is assigned to the location for this user. */
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
 * Thrown by [VoidhashClient.presentFlow] for a flow that could not be presented, or that
 * stopped because it could not keep running. Its [code] is `FLOW_<reason>`.
 *
 * @property abiVersion the package version the renderer could not draw, for
 *   [FlowFailure.UNSUPPORTED_PACKAGE].
 */
class FlowException(
    val reason: FlowFailure,
    message: String,
    val abiVersion: Int? = null,
) : VoidhashException("FLOW_${reason.name}", message)
