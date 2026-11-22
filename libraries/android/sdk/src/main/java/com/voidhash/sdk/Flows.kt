package com.voidhash.sdk

import android.app.Activity

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

    /** Ask the user for permission to track. Android has no such prompt; a flow hears it is unavailable. */
    TRACKING("tracking"),

    /** Set attributes on the current person, as [VoidhashClient.setPersonAttributes] does. */
    ATTRIBUTES("attributes"),

    /** Open links in the browser or the app that handles them. */
    LINKS("links"),
}

/** Whether the user allowed a system permission, as a flow reads it without asking. */
enum class FlowPermissionStatus(val wireName: String) {
    GRANTED("granted"),
    DENIED("denied"),

    /** Not asked yet: asking shows the system prompt. */
    NOT_DETERMINED("notDetermined"),

    /** The platform has no such permission, or the app is not set up to ask for it. */
    UNAVAILABLE("unavailable"),
}

/** How the user answered a flow's request for a system permission. */
enum class FlowPermissionResult(val wireName: String) {
    GRANTED("granted"),
    DENIED("denied"),

    /** The app could not ask: the platform has no such permission, or the app is not set up to ask for it. */
    UNAVAILABLE("unavailable"),
}

/**
 * How the app reads and asks for one permission a flow requests, in place of the SDK's own
 * prompt: for an app that explains a permission before the system asks, or asks through its own
 * code. Register one per permission in [VoidhashOptions.flowPermissionHandlers], under its name:
 * [FlowCapability.NOTIFICATIONS] or [FlowCapability.TRACKING]'s [FlowCapability.wireName].
 *
 * - Both are called on a background dispatcher ([kotlinx.coroutines.Dispatchers.Default]):
 *   switch to the main thread yourself for UI work.
 * - [status] runs whenever a flow is configured and whenever its activity resumes, for each
 *   permission the app grants flows: keep it cheap, and never prompt from it.
 * - The [Activity] passed is the one the flow is shown above, which Android may destroy and
 *   recreate (a rotation) while [request] runs. A handler that registers for the result on it,
 *   with `activityResultRegistry.register(key, …)`, gets the answer only by registering the same
 *   key again on the activity that replaces it; otherwise its request does not return.
 * - [request] must return once the user answered, or at once when they decided before. Until it
 *   returns, that flow's request waits, and so does any other flow's request for the same
 *   permission. A flow that ends stops waiting; once none waits, the next request calls
 *   [request] again.
 * - A handler that throws reads as unavailable to the flow.
 *
 * A status is a best guess on Android, which cannot tell a permission never asked for from one
 * the user denied for good ("don't ask again"). The SDK's own handler reads `DENIED` after it
 * asked itself, or while Android suggests explaining the permission (denied once), and
 * `NOT_DETERMINED` otherwise: also for one the app asked for itself and the user denied twice,
 * and for one denied in the system settings without a prompt. Asking for such a one is answered
 * `DENIED` at once, without a prompt.
 *
 * ```kotlin
 * class NotificationHandler : FlowPermissionHandler {
 *     override suspend fun status(activity: Activity) =
 *         if (NotificationManagerCompat.from(activity).areNotificationsEnabled()) FlowPermissionStatus.GRANTED
 *         else FlowPermissionStatus.NOT_DETERMINED
 *
 *     override suspend fun request(activity: Activity): FlowPermissionResult {
 *         val registry = (activity as? ComponentActivity)?.activityResultRegistry
 *             ?: return FlowPermissionResult.UNAVAILABLE
 *         return withContext(Dispatchers.Main) {
 *             suspendCancellableCoroutine { continuation ->
 *                 lateinit var launcher: ActivityResultLauncher<String>
 *                 launcher = registry.register("app.notifications", ActivityResultContracts.RequestPermission()) {
 *                     launcher.unregister()
 *                     continuation.resume(if (it) FlowPermissionResult.GRANTED else FlowPermissionResult.DENIED)
 *                 }
 *                 continuation.invokeOnCancellation { launcher.unregister() }
 *                 launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
 *             }
 *         }
 *     }
 * }
 * ```
 */
interface FlowPermissionHandler {
    /** The permission's status above [activity], without asking. */
    suspend fun status(activity: Activity): FlowPermissionStatus

    /** Asks the user above [activity], or answers at once when they already decided. */
    suspend fun request(activity: Activity): FlowPermissionResult
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
    /**
     * Whether the flow reached the screen. `false` for a presentation that ended before it was
     * shown, with the outcome [DISMISSED]: the end user left the loading screen, or the app
     * dismissed it or presented another flow while it loaded. Not part of [equals].
     */
    var wasShown: Boolean = true
        internal set

    companion object {
        /** A purchase ended the flow. */
        const val PURCHASED = "purchased"

        /** A restore ended the flow. */
        const val RESTORED = "restored"

        /** The flow was closed without finishing. */
        const val DISMISSED = "dismissed"

        /** [DISMISSED] before the flow was shown. */
        internal fun dismissedUnshown(): FlowResult = FlowResult(DISMISSED).also { it.wasShown = false }
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
) {
    /** See [FlowResult.wasShown]. Not part of [equals]. */
    var wasShown: Boolean = true
        internal set
}

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

    /**
     * The app links no flow renderer: it depends on neither `com.voidhash:voidhash-ui` nor sets
     * [VoidhashOptions.flowRenderer].
     */
    RENDERER_MISSING,

    /**
     * The renderer cannot draw the flow: the build uses a package format this SDK build cannot
     * read ([FlowException.abiVersion] names it), or the renderer has no native library for this
     * device's CPU.
     */
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
