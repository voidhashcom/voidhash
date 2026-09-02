package com.voidhash.sdk

import android.os.Bundle
import androidx.navigation.NavController
import com.voidhash.sdk.analytics.composeScreenView
import java.io.Closeable

/**
 * `$screen` capture for Jetpack Compose Navigation.
 *
 * ```kotlin
 * val navController = rememberNavController()
 * DisposableEffect(navController) {
 *     val handle = VoidhashScreenTracking.attach(navController)
 *     onDispose { handle.close() }
 * }
 * ```
 *
 * `androidx.navigation` is a `compileOnly` dependency of the SDK; this object
 * is only loaded by apps that call it.
 */
object VoidhashScreenTracking {
    /**
     * Emits a `$screen` for every destination change on [navController] and
     * suppresses the activity-level screen so a single-activity app does not
     * also report its host activity. Returns a handle that detaches the listener.
     *
     * Without a [client] and without a configured [Voidhash.shared] nothing is
     * attached and the handle is a no-op.
     */
    @JvmStatic
    @JvmOverloads
    fun attach(navController: NavController, client: VoidhashClient? = Voidhash.shared): Closeable {
        val target = client ?: return Closeable {}
        target.suppressActivityScreens()
        val listener = NavController.OnDestinationChangedListener { _, destination, arguments ->
            target.trackScreen(
                composeScreenView(
                    destinationId = destination.id,
                    route = destination.route,
                    arguments = arguments.toMap(),
                ),
            )
        }
        navController.addOnDestinationChangedListener(listener)
        return Closeable { navController.removeOnDestinationChangedListener(listener) }
    }

    @Suppress("DEPRECATION")
    private fun Bundle?.toMap(): Map<String, Any?> {
        if (this == null) return emptyMap()
        val values = LinkedHashMap<String, Any?>()
        for (key in keySet()) {
            values[key] = get(key)
        }
        return values
    }
}
