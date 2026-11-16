package com.voidhash.sdk.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import com.voidhash.sdk.diagnostics.DiagnosticEmitter
import com.voidhash.sdk.diagnostics.VoidhashDiagnosticKind

/**
 * Reports that the device regained a usable network.
 *
 * Injectable so tests can drive reconnection without a device: the SDK only ever needs the
 * edge, never the current state.
 */
interface ConnectivityMonitor {
    /**
     * Starts observing. [onAvailable] fires on each transition from no network to one, with
     * `becameValidated = false`, and with `becameValidated = true` when the current network
     * starts reaching the internet after it could not.
     */
    fun start(onAvailable: (becameValidated: Boolean) -> Unit)

    /** Stops observing and releases the platform callback. */
    fun stop()

    /** Whether the device has an active network right now; `true` when that cannot be told. */
    fun isNetworkAvailable(): Boolean = true
}

/** A monitor that never fires; used when the SDK has no context to observe from. */
object NoopConnectivityMonitor : ConnectivityMonitor {
    override fun start(onAvailable: (becameValidated: Boolean) -> Unit) = Unit

    override fun stop() = Unit
}

/**
 * Turns the platform's per-network callbacks into the single edge the SDK reacts to.
 *
 * `NetworkCallback.onAvailable` fires on registration, on every switch between networks
 * (Wi-Fi to cellular) and on every reconnect. Only the last is a reason to flush and
 * refresh, so a transition counts only when the device had no usable network before it.
 * A lost network that is not the current one — the old default after a switch — is ignored.
 *
 * A network can also be connected without reaching the internet, behind a captive portal or a
 * VPN still coming up. It becoming validated later is the same kind of edge.
 */
internal class ConnectivityEdge(initiallyConnected: Boolean) {
    private var connected = initiallyConnected
    private var current: Any? = null

    /** Whether [current] was last reported validated; `null` until its first report. */
    private var validated: Boolean? = null

    /** Records [network] becoming available; true when this restores connectivity. */
    @Synchronized
    fun onAvailable(network: Any): Boolean {
        if (network != current) validated = null
        current = network
        val restored = !connected
        connected = true
        return restored
    }

    /**
     * Records whether [network] reaches the internet; true when the current network has just
     * become validated after it was reported unvalidated.
     */
    @Synchronized
    fun onValidation(network: Any, isValidated: Boolean): Boolean {
        if (network != current) return false
        val wasValidated = validated
        validated = isValidated
        return isValidated && wasValidated == false
    }

    /** Records [network] going away; only the current network takes connectivity with it. */
    @Synchronized
    fun onLost(network: Any) {
        if (network != current) return
        current = null
        validated = null
        connected = false
    }
}

/**
 * [ConnectivityMonitor] backed by `ConnectivityManager.NetworkCallback`.
 *
 * Registration failure is not fatal — the foreground retry timer and the foreground trigger
 * cover the same ground more slowly — but it is reported, because recovery being slower than
 * designed is something a host should be able to see.
 */
class AndroidConnectivityMonitor(
    context: Context,
    private val diagnostics: DiagnosticEmitter = DiagnosticEmitter(),
) : ConnectivityMonitor {
    private val connectivityManager =
        context.applicationContext.getSystemService(Context.CONNECTIVITY_SERVICE)
            as? ConnectivityManager

    private var callback: ConnectivityManager.NetworkCallback? = null

    override fun start(onAvailable: (becameValidated: Boolean) -> Unit) {
        val manager = connectivityManager
        if (manager == null) {
            reportUnavailable("the platform has no connectivity service")
            return
        }
        if (callback != null) return

        // The callback reports the network that exists at registration as newly available;
        // seeding the edge with the current state keeps that from counting as a reconnect.
        val edge = ConnectivityEdge(initiallyConnected = isConnected(manager))
        val networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                if (edge.onAvailable(network)) onAvailable(false)
            }

            override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
                val validated = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
                if (edge.onValidation(network, validated)) onAvailable(true)
            }

            override fun onLost(network: Network) {
                edge.onLost(network)
            }
        }

        val registration = runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                manager.registerDefaultNetworkCallback(networkCallback)
            } else {
                manager.registerNetworkCallback(
                    NetworkRequest.Builder()
                        .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                        .build(),
                    networkCallback,
                )
            }
        }

        registration.fold(
            onSuccess = { callback = networkCallback },
            onFailure = { error -> reportUnavailable(error.message.orEmpty()) },
        )
    }

    private fun isConnected(manager: ConnectivityManager): Boolean =
        runCatching { manager.activeNetwork != null }.getOrDefault(false)

    override fun isNetworkAvailable(): Boolean {
        val manager = connectivityManager ?: return true
        return runCatching { manager.activeNetwork != null }.getOrDefault(true)
    }

    private fun reportUnavailable(reason: String) {
        diagnostics.emit(
            VoidhashDiagnosticKind.TRANSPORT,
            code = "CONNECTIVITY_OBSERVATION_UNAVAILABLE",
            operation = "connectivity.start",
            retryable = false,
            message = "Not observing connectivity ($reason). Queues are still retried on a " +
                "timer while the app is in the foreground and when it is foregrounded, just " +
                "less promptly after a reconnect.",
        )
    }

    override fun stop() {
        val networkCallback = callback ?: return
        callback = null
        runCatching { connectivityManager?.unregisterNetworkCallback(networkCallback) }
    }
}

/**
 * Whether the connection in use is billed by volume, such as cellular data, for work the SDK does
 * unasked and can leave for later. A platform that cannot say counts as metered.
 */
internal fun isActiveNetworkMetered(context: Context): Boolean {
    val manager = context.applicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        ?: return true
    return runCatching { manager.isActiveNetworkMetered }.getOrDefault(true)
}
