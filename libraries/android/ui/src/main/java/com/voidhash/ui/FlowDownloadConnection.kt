package com.voidhash.ui

import com.voidhash.sdk.flows.FlowUrlPolicy
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/** Redirects a flow download follows before it gives up. */
private const val MAX_REDIRECTS = 5

/**
 * Connects to [url] for a flow download ([what] names it in errors) and returns the connection
 * once it has a response that is not a redirect; the caller reads and disconnects it. Each URL,
 * the first and every one a redirect names, must be one [FlowUrlPolicy] permits, `https` from a
 * host on the internet apart from a local development server in a debug build, and is refused
 * before anything connects to it; [pinned] for an image its package pins. What is requested is
 * the URL the policy returns, read as the SDK reads URLs.
 */
internal fun openFlowDownload(url: String, what: String, connectTimeoutMs: Int, readTimeoutMs: Int, pinned: Boolean = false): HttpURLConnection {
    var current = FlowUrlPolicy.permitted(url, pinned) ?: throw IOException("$what URL refused: flows download only over https, from hosts on the internet")
    repeat(MAX_REDIRECTS + 1) {
        val connection = URL(current).openConnection() as HttpURLConnection
        connection.instanceFollowRedirects = false
        connection.connectTimeout = connectTimeoutMs
        connection.readTimeout = readTimeoutMs
        val status = try {
            connection.responseCode
        } catch (error: IOException) {
            connection.disconnect()
            throw error
        }
        if (status !in 300..399 || status == HttpURLConnection.HTTP_NOT_MODIFIED) return connection
        val location = connection.getHeaderField("Location")
        connection.disconnect()
        current = FlowUrlPolicy.permittedRedirect(current, location ?: throw IOException("HTTP $status without a location"), pinned)
            ?: throw IOException("$what redirected to a refused URL")
    }
    throw IOException("$what redirected more than $MAX_REDIRECTS times")
}
