package com.voidhash.sdk.flows

import androidx.annotation.RestrictTo

@Volatile
private var debuggableApp = false

/** Records that the app the SDK was configured in is a debuggable build. */
internal fun recordDebuggableApp() {
    debuggableApp = true
}

/**
 * For the SDK's own flow renderer only: whether the app the SDK was configured in is a
 * debuggable build, the only kind whose renderer trusts the development key that signs flow
 * runtime modules. The renderer has no context of its own before the SDK first resolves a flow,
 * and module mode is reported then.
 */
@RestrictTo(RestrictTo.Scope.LIBRARY_GROUP)
fun isDebuggableApp(): Boolean = debuggableApp
