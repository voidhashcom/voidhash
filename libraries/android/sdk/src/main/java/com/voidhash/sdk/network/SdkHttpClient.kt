package com.voidhash.sdk.network

import okhttp3.Call
import okhttp3.OkHttpClient
import okhttp3.Response
import java.util.concurrent.TimeUnit

/**
 * The longest response body the SDK reads, far above any answer of the API. An edge page can be
 * of any length, and one that never ends would otherwise be buffered until memory runs out.
 */
internal const val MAX_RESPONSE_BODY_BYTES = 4L * 1024 * 1024

/**
 * The response body as text, or `null` when it is longer than [MAX_RESPONSE_BODY_BYTES], of
 * which no more than that is read. Blocks on the socket; call it where the request was made.
 */
internal fun Response.bodyTextWithinLimit(): String? {
    if (body == null) return ""
    val read = peekBody(MAX_RESPONSE_BODY_BYTES + 1)
    return if (read.contentLength() > MAX_RESPONSE_BODY_BYTES) null else read.string()
}

/**
 * Builds the one OkHttp client the SDK shares across the API and ingest paths.
 *
 * A bare `OkHttpClient()` has no call timeout at all, so a half-open connection can hold a
 * request open indefinitely. The explicit budget is 5 s to connect, 10 s per read or write,
 * and 10 s for the whole call including retries and redirects, as on the other Voidhash SDKs.
 *
 * Sharing one instance also shares its connection pool and dispatcher, which is what OkHttp
 * is designed for; a per-component client leaks threads and sockets.
 */
fun buildSdkHttpClient(): OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(5, TimeUnit.SECONDS)
    .readTimeout(10, TimeUnit.SECONDS)
    .writeTimeout(10, TimeUnit.SECONDS)
    .callTimeout(10, TimeUnit.SECONDS)
    .build()

/**
 * A [Call.Factory] over one client [build] makes — [buildSdkHttpClient] unless replaced — built
 * on the first request rather than here. Building a client loads the platform's certificate
 * store, disk and CPU work the thread that configures the SDK, usually the UI thread, must not do.
 */
fun lazySdkHttpClient(build: () -> OkHttpClient = ::buildSdkHttpClient): Call.Factory {
    val client by lazy(build)
    return Call.Factory { request -> client.newCall(request) }
}
