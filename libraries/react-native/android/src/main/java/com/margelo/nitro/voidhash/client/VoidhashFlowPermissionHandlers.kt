package com.margelo.nitro.voidhash

import com.voidhash.sdk.FlowPermissionHandler
import java.util.concurrent.ConcurrentHashMap

/**
 * The app's own handlers of the permissions flows ask for, which JavaScript cannot supply:
 * register them in native code before the JavaScript client starts (in `Application.onCreate`),
 * by the permission's name (`FlowCapability.NOTIFICATIONS.wireName`). A client started afterwards
 * uses them; see [FlowPermissionHandler] for when the SDK calls one.
 */
object VoidhashFlowPermissionHandlers {
    private val handlers = ConcurrentHashMap<String, FlowPermissionHandler>()

    /** Uses [handler] for [permission] in the clients started from now on. */
    @JvmStatic
    fun register(permission: String, handler: FlowPermissionHandler) {
        handlers[permission] = handler
    }

    internal fun registered(): Map<String, FlowPermissionHandler> = handlers.toMap()
}
